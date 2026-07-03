import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { openDb } from './db';
import { upsertSyncedItem, createAdhocItem, listItems, getItemById, setStatus } from './items-repo';

let db: Database.Database;

beforeEach(() => {
  db = openDb(':memory:');
});

describe('upsertSyncedItem', () => {
  it('inserts a new synced item', () => {
    const item = upsertSyncedItem(db, {
      source: 'github_pr',
      externalId: 'gh-1',
      title: 'Fix bug',
      url: 'https://github.com/x/y/pull/1',
      reason: 'review_requested',
      dueDate: null,
      sprintIteration: null,
      rawUpdatedAt: '2026-07-01T00:00:00.000Z',
    });
    expect(item.title).toBe('Fix bug');
    expect(item.status).toBe('inbox');
  });

  it('preserves local status and category on re-sync', () => {
    const first = upsertSyncedItem(db, {
      source: 'github_pr',
      externalId: 'gh-1',
      title: 'Fix bug',
      url: null,
      reason: 'review_requested',
      dueDate: null,
      sprintIteration: null,
      rawUpdatedAt: '2026-07-01T00:00:00.000Z',
    });
    setStatus(db, first.id, 'in_progress');

    const updated = upsertSyncedItem(db, {
      source: 'github_pr',
      externalId: 'gh-1',
      title: 'Fix bug (renamed)',
      url: null,
      reason: 'approved_unmerged',
      dueDate: null,
      sprintIteration: null,
      rawUpdatedAt: '2026-07-02T00:00:00.000Z',
    });

    expect(updated.id).toBe(first.id);
    expect(updated.title).toBe('Fix bug (renamed)');
    expect(updated.reason).toBe('approved_unmerged');
    expect(updated.status).toBe('in_progress');
  });

  it('preserves completed_at on re-sync', () => {
    const first = upsertSyncedItem(db, {
      source: 'github_pr',
      externalId: 'gh-2',
      title: 'Fix bug',
      url: null,
      reason: 'review_requested',
      dueDate: null,
      sprintIteration: null,
      rawUpdatedAt: '2026-07-01T00:00:00.000Z',
    });
    setStatus(db, first.id, 'done', '2026-07-01T12:00:00.000Z');

    const updated = upsertSyncedItem(db, {
      source: 'github_pr',
      externalId: 'gh-2',
      title: 'Fix bug',
      url: null,
      reason: 'mention',
      dueDate: null,
      sprintIteration: null,
      rawUpdatedAt: '2026-07-02T00:00:00.000Z',
    });

    expect(updated.status).toBe('done');
    expect(updated.completedAt).toBe('2026-07-01T12:00:00.000Z');
  });

  it('stores and updates ado_status on re-sync', () => {
    const first = upsertSyncedItem(db, {
      source: 'ado_workitem',
      externalId: '101',
      title: 'Fix login bug',
      url: null,
      reason: 'assigned',
      dueDate: null,
      sprintIteration: null,
      rawUpdatedAt: '2026-07-01T00:00:00.000Z',
      adoStatus: 'Active',
    });
    expect(first.adoStatus).toBe('Active');

    const updated = upsertSyncedItem(db, {
      source: 'ado_workitem',
      externalId: '101',
      title: 'Fix login bug',
      url: null,
      reason: 'assigned',
      dueDate: null,
      sprintIteration: null,
      rawUpdatedAt: '2026-07-02T00:00:00.000Z',
      adoStatus: 'Done',
    });
    expect(updated.adoStatus).toBe('Done');
  });

  it('defaults ado_status to null when not provided', () => {
    const item = upsertSyncedItem(db, {
      source: 'github_pr',
      externalId: 'gh-3',
      title: 'Fix bug',
      url: null,
      reason: 'review_requested',
      dueDate: null,
      sprintIteration: null,
      rawUpdatedAt: '2026-07-01T00:00:00.000Z',
    });
    expect(item.adoStatus).toBeNull();
  });
});

describe('createAdhocItem', () => {
  it('creates an ad-hoc item with manual reason', () => {
    const item = createAdhocItem(db, { title: 'Reply to Sarah re: deploy window' });
    expect(item.source).toBe('adhoc');
    expect(item.reason).toBe('manual');
    expect(item.status).toBe('inbox');
  });
});

describe('listItems / getItemById / setStatus', () => {
  it('lists and updates items', () => {
    const item = createAdhocItem(db, { title: 'Test' });
    setStatus(db, item.id, 'done', '2026-07-02T12:00:00.000Z');
    const updated = getItemById(db, item.id);
    expect(updated?.status).toBe('done');
    expect(updated?.completedAt).toBe('2026-07-02T12:00:00.000Z');
    expect(listItems(db)).toHaveLength(1);
  });
});
