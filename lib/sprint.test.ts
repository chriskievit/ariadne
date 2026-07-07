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
  it('counts an ADO item as complete when its synced status is Done', () => {
    upsertSyncedItem(db, {
      source: 'ado_workitem',
      externalId: '101',
      title: 'Fix login bug',
      url: null,
      reason: 'assigned',
      dueDate: null,
      sprintIteration: 'Sprint 42',
      rawUpdatedAt: null,
      repo: null,
      adoStatus: 'Done',
    });

    const progress = getSprintProgress(db);
    expect(progress.name).toBe('Sprint 42');
    expect(progress.totalCount).toBe(1);
    expect(progress.completedCount).toBe(1);
  });

  it.each(['Ready for Validation', 'Ready for Test', 'READY FOR TEST'])(
    'counts an ADO item as complete for synced status %s',
    (adoStatus) => {
      upsertSyncedItem(db, {
        source: 'ado_workitem',
        externalId: '101',
        title: 'Fix login bug',
        url: null,
        reason: 'assigned',
        dueDate: null,
        sprintIteration: 'Sprint 42',
        rawUpdatedAt: null,
        repo: null,
        adoStatus,
      });

      expect(getSprintProgress(db).completedCount).toBe(1);
    }
  );

  it('does not count an ADO item as complete for a non-terminal synced status, even if manually marked done', () => {
    const item = upsertSyncedItem(db, {
      source: 'ado_workitem',
      externalId: '101',
      title: 'Fix login bug',
      url: null,
      reason: 'assigned',
      dueDate: null,
      sprintIteration: 'Sprint 42',
      rawUpdatedAt: null,
      repo: null,
      adoStatus: 'Active',
    });
    setStatus(db, item.id, 'done', '2026-07-01T00:00:00.000Z');

    expect(getSprintProgress(db).completedCount).toBe(0);
  });

  it('counts an ad-hoc item created within the sprint window even without an iteration tag', () => {
    const item = createAdhocItem(db, { title: 'Reply to Sarah' });
    db.prepare('UPDATE items SET created_at = ? WHERE id = ?').run('2026-07-05T00:00:00.000Z', item.id);

    const progress = getSprintProgress(db);
    expect(progress.totalCount).toBe(1);
    expect(progress.completedCount).toBe(0);
  });

  it('counts an ad-hoc item as complete via the manual done toggle', () => {
    const item = createAdhocItem(db, { title: 'Reply to Sarah' });
    db.prepare('UPDATE items SET created_at = ? WHERE id = ?').run('2026-07-05T00:00:00.000Z', item.id);
    setStatus(db, item.id, 'done', '2026-07-05T00:00:00.000Z');

    expect(getSprintProgress(db).completedCount).toBe(1);
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
      repo: null,
    });
    db.prepare('UPDATE items SET created_at = ? WHERE id = ?').run('2026-05-01T00:00:00.000Z', item.id);

    expect(getSprintProgress(db).totalCount).toBe(0);
  });

  it('counts an ADO item whose iteration is a full path ending in the sprint name', () => {
    upsertSyncedItem(db, {
      source: 'ado_workitem',
      externalId: '202',
      title: 'Full path iteration',
      url: null,
      reason: 'assigned',
      dueDate: null,
      sprintIteration: 'Project\\Sprint 42',
      rawUpdatedAt: null,
      repo: null,
    });

    expect(getSprintProgress(db).totalCount).toBe(1);
  });

  it('reports lastSyncedAt as the most recent sync_log entry', () => {
    db.prepare('INSERT INTO sync_log (source, ran_at, item_count, error) VALUES (?, ?, ?, ?)').run(
      'github',
      '2026-07-01T00:00:00.000Z',
      1,
      null
    );
    db.prepare('INSERT INTO sync_log (source, ran_at, item_count, error) VALUES (?, ?, ?, ?)').run(
      'ado',
      '2026-07-02T12:00:00.000Z',
      2,
      null
    );

    expect(getSprintProgress(db).lastSyncedAt).toBe('2026-07-02T12:00:00.000Z');
  });

  it('reports lastSyncedAt as null when there is no sync history', () => {
    expect(getSprintProgress(db).lastSyncedAt).toBeNull();
  });
});
