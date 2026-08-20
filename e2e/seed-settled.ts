import { openDb } from '../lib/db';
import { upsertSyncedItem } from '../lib/items-repo';
import { E2E_DB_PATH } from './db-path';

// A merged PR and a Done work item only ever reach this state through a real
// sync against GitHub/ADO, which e2e tests can't do. Seed them straight into
// the sqlite file the dev server under test points at, the same way
// seed-links.ts does.
export function seedSettledPair(suffix: string): {
  mergedPrId: number;
  doneAdoId: number;
  openPrId: number;
  mergedPrTitle: string;
  doneAdoTitle: string;
  openPrTitle: string;
} {
  const db = openDb(E2E_DB_PATH);
  try {
    const base = `${Date.now()}${suffix}`;
    const mergedPrTitle = `Merged PR ${suffix}`;
    const doneAdoTitle = `Done work item ${suffix}`;
    const openPrTitle = `Open PR ${suffix}`;

    const mergedPr = upsertSyncedItem(db, {
      source: 'github_pr',
      externalId: `${base}@merged-pr`,
      title: mergedPrTitle,
      url: 'https://example.test/pr/merged',
      reason: 'authored',
      dueDate: null,
      sprintIteration: null,
      rawUpdatedAt: new Date().toISOString(),
      prStatus: 'merged',
      repo: null,
    });

    const doneAdo = upsertSyncedItem(db, {
      source: 'ado_workitem',
      externalId: `${base}@done-ado`,
      title: doneAdoTitle,
      url: 'https://example.test/ado/done',
      reason: 'assigned',
      dueDate: null,
      sprintIteration: null,
      rawUpdatedAt: new Date().toISOString(),
      adoStatus: 'Done',
      repo: null,
    });

    // The control: same shape, still open upstream, so the test can tell the
    // settled treatment apart from "every row looks like this now".
    const openPr = upsertSyncedItem(db, {
      source: 'github_pr',
      externalId: `${base}@open-pr`,
      title: openPrTitle,
      url: 'https://example.test/pr/open',
      reason: 'authored',
      dueDate: null,
      sprintIteration: null,
      rawUpdatedAt: new Date().toISOString(),
      prStatus: 'ready_for_review',
      repo: null,
    });

    return {
      mergedPrId: mergedPr.id,
      doneAdoId: doneAdo.id,
      openPrId: openPr.id,
      mergedPrTitle,
      doneAdoTitle,
      openPrTitle,
    };
  } finally {
    db.close();
  }
}
