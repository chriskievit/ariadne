import type Database from 'better-sqlite3';
import { SETTINGS_KEYS } from './config';

const SECRET_SETTINGS_KEYS: readonly string[] = [SETTINGS_KEYS.githubPat, SETTINGS_KEYS.adoPat];

export function getSetting(db: Database.Database, key: string): string | null {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row ? row.value : null;
}

export function setSetting(db: Database.Database, key: string, value: string): void {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  ).run(key, value, now);
}

export function getAllSettings(db: Database.Database): Record<string, string> {
  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

// For anything leaving the server (API responses, SSR payloads): PAT values
// never travel past this boundary in the clear, since either would put them
// in a page's HTML/RSC output or a plain JSON response any caller can read.
// `<key>.isSet` lets the UI show "a token is saved" without the value itself.
export function getRedactedSettings(db: Database.Database): Record<string, string> {
  const settings = getAllSettings(db);
  for (const key of SECRET_SETTINGS_KEYS) {
    const isSet = Boolean(settings[key]);
    settings[key] = '';
    settings[`${key}.isSet`] = String(isSet);
  }
  return settings;
}
