import type Database from 'better-sqlite3';
import { upsertSyncedItem } from './items-repo';
import { getSetting, setSetting } from './settings-repo';
import { SETTINGS_KEYS } from './config';
import { SOURCE_ADAPTERS } from './sources';
import type { SourceAdapter, SourceKey } from './sources/types';

export interface SyncOutcome {
  source: SourceKey;
  itemCount: number;
  error: string | null;
}

export function logSyncResult(db: Database.Database, source: string, itemCount: number, error: string | null): void {
  db.prepare('INSERT INTO sync_log (source, ran_at, item_count, error) VALUES (?, ?, ?, ?)').run(
    source,
    new Date().toISOString(),
    itemCount,
    error
  );
}

// One adapter's sync, isolated: whatever it throws is logged against that
// source only, so one broken token never hides another source's items.
async function syncSource(db: Database.Database, adapter: SourceAdapter): Promise<SyncOutcome> {
  const get = (key: string) => getSetting(db, key);
  if (!adapter.isConfigured(get)) {
    logSyncResult(db, adapter.key, 0, adapter.notConfiguredError);
    return { source: adapter.key, itemCount: 0, error: adapter.notConfiguredError };
  }

  try {
    const { items, sprint } = await adapter.sync(get);
    for (const item of items) upsertSyncedItem(db, item);
    // A null sprint leaves the stored one alone for now; per-source sprints
    // (#99) change this to clear it.
    if (sprint) {
      setSetting(db, SETTINGS_KEYS.sprintName, sprint.name);
      setSetting(db, SETTINGS_KEYS.sprintStart, sprint.startDate);
      setSetting(db, SETTINGS_KEYS.sprintEnd, sprint.endDate);
    }
    await adapter.reconcile?.(db, items, get);
    logSyncResult(db, adapter.key, items.length, null);
    return { source: adapter.key, itemCount: items.length, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logSyncResult(db, adapter.key, 0, message);
    return { source: adapter.key, itemCount: 0, error: message };
  }
}

export async function runSync(db: Database.Database): Promise<SyncOutcome[]> {
  return Promise.all(SOURCE_ADAPTERS.map((adapter) => syncSource(db, adapter)));
}
