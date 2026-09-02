import { openDb } from '../lib/db';
import { upsertSyncedItem } from '../lib/items-repo';
import { E2E_DB_PATH } from './db-path';

const DAY_MS = 86_400_000;

// Synced ADO work items assigned to you, seeded straight into sqlite the way
// seed-links.ts does. `assigned` scores 10, and anything untouched for more
// than 5 days picks up the +15 staleness bonus, so `ageDays` is how a test
// dials a row to exactly 25 or exactly 10 and builds a run of equal scores
// on purpose. `reason` picks the obligation group: 'assigned' lands in
// "Lower priority", which collapses, and 'mention' lands in "Waiting on
// you", which never does.
export function seedAssignedItems(
  suffix: string,
  rows: { ageDays: number; count: number }[],
  reason: 'assigned' | 'mention' = 'assigned'
): number[] {
  const db = openDb(E2E_DB_PATH);
  try {
    const ids: number[] = [];
    let n = 0;
    for (const { ageDays, count } of rows) {
      for (let i = 0; i < count; i++) {
        n++;
        const item = upsertSyncedItem(db, {
          source: 'ado_workitem',
          externalId: `collapse-${suffix}-${n}`,
          title: `Collapse ${suffix} row ${n} (${ageDays}d)`,
          url: `https://example.test/ado/collapse-${suffix}-${n}`,
          reason,
          dueDate: null,
          sprintIteration: null,
          rawUpdatedAt: new Date(Date.now() - ageDays * DAY_MS).toISOString(),
          repo: null,
        });
        ids.push(item.id);
      }
    }
    return ids;
  } finally {
    db.close();
  }
}
