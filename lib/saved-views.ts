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

/**
 * Thrown rather than writing a shortened list. writeViews replaces the whole
 * stored blob, so a partial orderedIds used to delete every view it left out.
 * Deleting is removeSavedView's job, not this one's.
 */
export class SavedViewOrderMismatchError extends Error {
  readonly unknownIds: string[];
  readonly missingIds: string[];
  readonly duplicatedIds: string[];

  constructor(unknownIds: string[], missingIds: string[], duplicatedIds: string[]) {
    const parts: string[] = [];
    if (unknownIds.length > 0) parts.push(`unknown: ${unknownIds.join(', ')}`);
    if (missingIds.length > 0) parts.push(`missing: ${missingIds.join(', ')}`);
    if (duplicatedIds.length > 0) parts.push(`duplicated: ${duplicatedIds.join(', ')}`);
    super(`orderedIds must list every saved view exactly once (${parts.join('; ')}).`);
    this.name = 'SavedViewOrderMismatchError';
    this.unknownIds = unknownIds;
    this.missingIds = missingIds;
    this.duplicatedIds = duplicatedIds;
  }
}

export function reorderSavedViews(db: Database.Database, orderedIds: string[]): SavedView[] {
  const views = readViews(db);
  const byId = new Map(views.map((v) => [v.id, v]));
  const requested = new Set(orderedIds);

  const unknownIds = orderedIds.filter((id) => !byId.has(id));
  const missingIds = views.filter((v) => !requested.has(v.id)).map((v) => v.id);
  // A duplicate makes the list longer than the set, which would push a view
  // off the end just as surely as omitting it.
  const seen = new Set<string>();
  const duplicatedIds = new Set<string>();
  for (const id of orderedIds) {
    if (seen.has(id) && byId.has(id)) duplicatedIds.add(id);
    seen.add(id);
  }
  if (unknownIds.length > 0 || missingIds.length > 0 || duplicatedIds.size > 0) {
    throw new SavedViewOrderMismatchError(unknownIds, missingIds, [...duplicatedIds]);
  }

  const reordered = orderedIds.map((id) => byId.get(id) as SavedView);
  writeViews(db, reordered);
  return reordered;
}
