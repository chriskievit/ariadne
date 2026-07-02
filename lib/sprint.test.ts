import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { openDb } from './db';
import { setSetting } from './settings-repo';
import { createAdhocItem, upsertSyncedItem, setStatus } from './items-repo';
import { SETTINGS_KEYS } from './config';
import { getSprintProgress } from './sprint';

let db: Database.Database;

beforeEach(() => {
  db = openDb(':memory:');
  setSetting(db, SETTINGS_KEYS.sprintName, 'Sprint 42');
  setSetting(db, SETTINGS_KEYS.sprintStart, '2026-06-29T00:00:00.000Z');
  setSetting(db, SETTINGS_KEYS.sprintEnd, '2026-07-12T00:00:00.000Z');
});

describe('getSprintProgress', () => {
  it('counts an ADO item tagged with the current iteration', () => {
    const item = upsertSyncedItem(db, {
      source: 'ado_workitem',
      externalId: '101',
      title: 'Fix login bug',
      url: null,
      reason: 'assigned',
      dueDate: null,
      sprintIteration: 'Sprint 42',
      rawUpdatedAt: null,
    });
    setStatus(db, item.id, 'done', '2026-07-01T00:00:00.000Z');

    const progress = getSprintProgress(db);
    expect(progress.name).toBe('Sprint 42');
    expect(progress.totalCount).toBe(1);
    expect(progress.completedCount).toBe(1);
  });

  it('counts an ad-hoc item created within the sprint window even without an iteration tag', () => {
    const item = createAdhocItem(db, { title: 'Reply to Sarah' });
    db.prepare('UPDATE items SET created_at = ? WHERE id = ?').run('2026-07-05T00:00:00.000Z', item.id);

    const progress = getSprintProgress(db);
    expect(progress.totalCount).toBe(1);
    expect(progress.completedCount).toBe(0);
  });

  it('excludes items outside the sprint window with no matching iteration', () => {
    const item = upsertSyncedItem(db, {
      source: 'github_pr',
      externalId: '1@a/b',
      title: 'Old PR',
      url: null,
      reason: 'authored',
      dueDate: null,
      sprintIteration: null,
      rawUpdatedAt: null,
    });
    db.prepare('UPDATE items SET created_at = ? WHERE id = ?').run('2026-05-01T00:00:00.000Z', item.id);

    expect(getSprintProgress(db).totalCount).toBe(0);
  });
});
