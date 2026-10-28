import type Database from 'better-sqlite3';
import { upsertSyncedItem } from './items-repo';
import { getSetting, setSetting } from './settings-repo';
import { SETTINGS_KEYS } from './config';
import { SOURCE_ADAPTERS } from './sources';
import { isSourceEnabled } from './sources/configured';
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

// The sprint.* settings keys hold one sprint until #99 gives each tracker its
// own. Azure DevOps keeps them when it is set up, so two trackers never race
// for them; a Jira-only setup gets its sprint header now rather than in #99.
function sprintOwner(adapters: SourceAdapter[]): SourceKey | null {
  const keys = adapters.map((a) => a.key);
  return keys.includes('ado') ? 'ado' : keys.includes('jira') ? 'jira' : null;
}

// One adapter's sync, isolated: whatever it throws is logged against that
// source only, so one broken token never hides another source's items.
async function syncSource(db: Database.Database, adapter: SourceAdapter, ownsSprint: boolean): Promise<SyncOutcome> {
  const get = (key: string) => getSetting(db, key);
  try {
    const { items, sprint } = await adapter.sync(get);
    for (const item of items) upsertSyncedItem(db, item);
    // A null sprint leaves the stored one alone for now; #99 changes this to clear it.
    if (sprint && ownsSprint) {
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

// Only sources that are set up and switched on run. One that is not leaves
// no sync_log row, so it never reads as failed: you may simply not use that
// tracker, or not want it right now.
export async function runSync(db: Database.Database): Promise<SyncOutcome[]> {
  const get = (key: string) => getSetting(db, key);
  const active = SOURCE_ADAPTERS.filter((adapter) => adapter.isConfigured(get) && isSourceEnabled(get, adapter.key));
  const owner = sprintOwner(active);
  return Promise.all(active.map((adapter) => syncSource(db, adapter, adapter.key === owner)));
}
