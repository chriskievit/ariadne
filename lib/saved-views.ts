import type Database from 'better-sqlite3';
import { getSetting, setSetting } from './settings-repo';
import { SETTINGS_KEYS } from './config';

export interface SavedView {
  id: string;
  label: string;
  query: string;
  shortcut: string | null;
}

function readViews(db: Database.Database): SavedView[] {
  const raw = getSetting(db, SETTINGS_KEYS.savedViews);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as SavedView[];
  } catch {
    return [];
  }
}

function writeViews(db: Database.Database, views: SavedView[]): void {
  setSetting(db, SETTINGS_KEYS.savedViews, JSON.stringify(views));
}

export function getSavedViews(db: Database.Database): SavedView[] {
  return readViews(db);
}

export function setSavedViews(db: Database.Database, views: SavedView[]): void {
  writeViews(db, views);
}

// Unlimited by design -- the 15-saved-filter cap some providers impose
// exists to protect their shared infrastructure; a local SQLite file has no
// such constraint (see docs/wireframes/phase-2-speed-and-control.html).
export function addSavedView(db: Database.Database, view: Omit<SavedView, 'id'>): SavedView[] {
  const views = readViews(db);
  const withNew = [...views, { ...view, id: crypto.randomUUID() }];
  writeViews(db, withNew);
  return withNew;
}

export function removeSavedView(db: Database.Database, id: string): SavedView[] {
  const remaining = readViews(db).filter((v) => v.id !== id);
  writeViews(db, remaining);
  return remaining;
}

export function reorderSavedViews(db: Database.Database, orderedIds: string[]): SavedView[] {
  const views = readViews(db);
  const byId = new Map(views.map((v) => [v.id, v]));
  const reordered = orderedIds.map((id) => byId.get(id)).filter((v): v is SavedView => Boolean(v));
  writeViews(db, reordered);
  return reordered;
}
