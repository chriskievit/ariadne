import { openDb } from '../lib/db';
import { upsertSyncedItem } from '../lib/items-repo';
import { E2E_DB_PATH } from './db-path';

// The needs-you count only fires on synced reasons (review_requested,
// mention, approved_unmerged) or a blocked ADO state, none of which the
// ad-hoc create API can produce -- an ad-hoc item is always `manual`, i.e.
// lower priority. Seed straight into the sqlite file the dev server under
// test points at, the same way seed-links.ts does.
export function seedNeedsYou(suffix: string): {
  waitingId: number;
  waitingTitle: string;
  snoozedId: number;
  snoozedTitle: string;
  movingId: number;
  movingTitle: string;
} {
  const db = openDb(E2E_DB_PATH);
  try {
    const base = `${Date.now()}${suffix}`;
    const waitingTitle = `Needs-you review requested ${suffix}`;
    const snoozedTitle = `Needs-you but snoozed ${suffix}`;
    const movingTitle = `Needs-you excluded authored ${suffix}`;

    const common = {
      source: 'github_pr' as const,
      url: 'https://example.test/pr',
      dueDate: null,
      sprintIteration: null,
      rawUpdatedAt: new Date().toISOString(),
      repo: null,
    };

    const waiting = upsertSyncedItem(db, {
      ...common,
      externalId: `${base}@waiting`,
      title: waitingTitle,
      reason: 'review_requested',
    });
    const snoozed = upsertSyncedItem(db, {
      ...common,
      externalId: `${base}@snoozed`,
      title: snoozedTitle,
      reason: 'review_requested',
    });
    const moving = upsertSyncedItem(db, {
      ...common,
      externalId: `${base}@moving`,
      title: movingTitle,
      reason: 'authored',
    });

    return {
      waitingId: waiting.id,
      waitingTitle,
      snoozedId: snoozed.id,
      snoozedTitle,
      movingId: moving.id,
      movingTitle,
    };
  } finally {
    db.close();
  }
}
