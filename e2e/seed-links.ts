import { openDb } from '../lib/db';
import { upsertSyncedItem } from '../lib/items-repo';
import { E2E_DB_PATH } from './db-path';

// Linked items (a GitHub PR <-> an ADO work item) only ever come from a real
// sync against GitHub/ADO, which e2e tests can't do. Seed them directly
// against the same sqlite file the dev server under test points at.
export function seedLinkedPair(suffix: string): { prItemId: number; adoItemId: number; prTitle: string; adoTitle: string } {
  const db = openDb(E2E_DB_PATH);
  try {
    const adoExternalId = `${Date.now()}${suffix}`;
    const adoTitle = `Linked ADO item ${suffix}`;
    const prTitle = `Linked PR item ${suffix}`;

    const adoItem = upsertSyncedItem(db, {
      source: 'ado_workitem',
      externalId: adoExternalId,
      title: adoTitle,
      url: 'https://example.test/ado/1',
      reason: 'assigned',
      dueDate: null,
      sprintIteration: null,
      rawUpdatedAt: new Date().toISOString(),
      repo: null,
    });

    const prItem = upsertSyncedItem(db, {
      source: 'github_pr',
      externalId: `${adoExternalId}@pr`,
      title: prTitle,
      url: 'https://example.test/pr/1',
      reason: 'authored',
      dueDate: null,
      sprintIteration: null,
      rawUpdatedAt: new Date().toISOString(),
      repo: null,
      linkedAdoExternalIds: [adoExternalId],
    });

    return { prItemId: prItem.id, adoItemId: adoItem.id, prTitle, adoTitle };
  } finally {
    db.close();
  }
}
