import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { openDb } from './db';
import {
  upsertSyncedItem,
  createAdhocItem,
  listItems,
  getItemById,
  setStatus,
  setParked,
  setTodayDate,
  setStarred,
  setSnoozedUntil,
  setTriageState,
  deleteItem,
  getOpenGithubPrCandidates,
  setPrStatus,
} from './items-repo';

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
      repo: null,
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
      repo: null,
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
      repo: null,
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
      repo: null,
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
      repo: null,
    });

    expect(updated.status).toBe('done');
    expect(updated.completedAt).toBe('2026-07-01T12:00:00.000Z');
  });

  it('preserves an existing today_date on re-sync', () => {
    const first = upsertSyncedItem(db, {
      source: 'github_pr',
      externalId: 'gh-99',
      title: 'Fix bug',
      url: null,
      reason: 'review_requested',
      dueDate: null,
      sprintIteration: null,
      rawUpdatedAt: '2026-07-01T00:00:00.000Z',
      repo: null,
    });
    setTodayDate(db, first.id, '2026-08-13');

    upsertSyncedItem(db, {
      source: 'github_pr',
      externalId: 'gh-99',
      title: 'Fix bug (renamed)',
      url: null,
      reason: 'review_requested',
      dueDate: null,
      sprintIteration: null,
      rawUpdatedAt: '2026-07-02T00:00:00.000Z',
      repo: null,
    });

    expect(getItemById(db, first.id)?.todayDate).toBe('2026-08-13');
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
      repo: null,
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
      repo: null,
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
      repo: null,
    });
    expect(item.adoStatus).toBeNull();
  });

  it('stores and updates pr_status on re-sync', () => {
    const first = upsertSyncedItem(db, {
      source: 'github_pr',
      externalId: 'gh-10',
      title: 'Add feature',
      url: null,
      reason: 'review_requested',
      dueDate: null,
      sprintIteration: null,
      rawUpdatedAt: '2026-07-01T00:00:00.000Z',
      repo: null,
      prStatus: 'draft',
    });
    expect(first.prStatus).toBe('draft');

    const updated = upsertSyncedItem(db, {
      source: 'github_pr',
      externalId: 'gh-10',
      title: 'Add feature',
      url: null,
      reason: 'review_requested',
      dueDate: null,
      sprintIteration: null,
      rawUpdatedAt: '2026-07-02T00:00:00.000Z',
      repo: null,
      prStatus: 'approved',
    });
    expect(updated.prStatus).toBe('approved');
  });

  it('defaults pr_status to null when not provided', () => {
    const item = upsertSyncedItem(db, {
      source: 'ado_workitem',
      externalId: '202',
      title: 'Fix login bug',
      url: null,
      reason: 'assigned',
      dueDate: null,
      sprintIteration: null,
      rawUpdatedAt: '2026-07-01T00:00:00.000Z',
      repo: null,
      adoStatus: 'Active',
    });
    expect(item.prStatus).toBeNull();
  });

  it('stores and updates repo on re-sync', () => {
    const first = upsertSyncedItem(db, {
      source: 'github_pr',
      externalId: 'gh-20',
      title: 'Add feature',
      url: null,
      reason: 'review_requested',
      dueDate: null,
      sprintIteration: null,
      rawUpdatedAt: '2026-07-01T00:00:00.000Z',
      repo: 'widgets',
    });
    expect(first.repo).toBe('widgets');

    const updated = upsertSyncedItem(db, {
      source: 'github_pr',
      externalId: 'gh-20',
      title: 'Add feature',
      url: null,
      reason: 'review_requested',
      dueDate: null,
      sprintIteration: null,
      rawUpdatedAt: '2026-07-02T00:00:00.000Z',
      repo: 'gadgets',
    });
    expect(updated.repo).toBe('gadgets');
  });

  it('defaults repo to null when not provided', () => {
    const item = upsertSyncedItem(db, {
      source: 'ado_workitem',
      externalId: '303',
      title: 'Fix login bug',
      url: null,
      reason: 'assigned',
      dueDate: null,
      sprintIteration: null,
      rawUpdatedAt: '2026-07-01T00:00:00.000Z',
      repo: null,
    });
    expect(item.repo).toBeNull();
  });
});

describe('upsertSyncedItem wake-early', () => {
  it('clears an active snooze and marks woke_early when raw_updated_at changes upstream', () => {
    const input = {
      source: 'github_pr' as const,
      externalId: '9@a/b',
      title: 'Snoozed PR',
      url: null,
      reason: 'review_requested' as const,
      dueDate: null,
      sprintIteration: null,
      rawUpdatedAt: '2026-08-01T00:00:00.000Z',
      repo: null,
    };
    const item = upsertSyncedItem(db, input);
    setSnoozedUntil(db, item.id, '2026-09-01T00:00:00.000Z');

    upsertSyncedItem(db, { ...input, rawUpdatedAt: '2026-08-10T00:00:00.000Z' });

    const updated = getItemById(db, item.id);
    expect(updated?.snoozedUntil).toBeNull();
    expect(updated?.wokeEarly).toBe(true);
  });

  it('leaves an active snooze untouched when raw_updated_at does not change', () => {
    const input = {
      source: 'github_pr' as const,
      externalId: '10@a/b',
      title: 'Quiet snoozed PR',
      url: null,
      reason: 'review_requested' as const,
      dueDate: null,
      sprintIteration: null,
      rawUpdatedAt: '2026-08-01T00:00:00.000Z',
      repo: null,
    };
    const item = upsertSyncedItem(db, input);
    setSnoozedUntil(db, item.id, '2026-09-01T00:00:00.000Z');

    upsertSyncedItem(db, input);

    const updated = getItemById(db, item.id);
    expect(updated?.snoozedUntil).toBe('2026-09-01T00:00:00.000Z');
    expect(updated?.wokeEarly).toBe(false);
  });

  it('does nothing when the item was not snoozed', () => {
    const input = {
      source: 'github_pr' as const,
      externalId: '11@a/b',
      title: 'Never snoozed',
      url: null,
      reason: 'review_requested' as const,
      dueDate: null,
      sprintIteration: null,
      rawUpdatedAt: '2026-08-01T00:00:00.000Z',
      repo: null,
    };
    const item = upsertSyncedItem(db, input);
    upsertSyncedItem(db, { ...input, rawUpdatedAt: '2026-08-10T00:00:00.000Z' });

    const updated = getItemById(db, item.id);
    expect(updated?.snoozedUntil).toBeNull();
    expect(updated?.wokeEarly).toBe(false);
  });
});

describe('createAdhocItem', () => {
  it('creates an ad-hoc item with manual reason', () => {
    const item = createAdhocItem(db, { title: 'Reply to Sarah re: deploy window' });
    expect(item.source).toBe('adhoc');
    expect(item.reason).toBe('manual');
    expect(item.status).toBe('inbox');
  });

  it('returns repo: null for an ad-hoc item', () => {
    const item = createAdhocItem(db, { title: 'Reply to Sarah re: deploy window' });
    expect(item.repo).toBeNull();
  });
});

describe('deleteItem', () => {
  it('removes the item', () => {
    const item = createAdhocItem(db, { title: 'Test' });
    deleteItem(db, item.id);
    expect(getItemById(db, item.id)).toBeUndefined();
  });
});

describe('getOpenGithubPrCandidates / setPrStatus', () => {
  it('includes non-done github_pr items without a merged pr_status', () => {
    const pr = upsertSyncedItem(db, {
      source: 'github_pr',
      externalId: '1@a/b',
      title: 'Fix bug',
      url: null,
      reason: 'review_requested',
      dueDate: null,
      sprintIteration: null,
      rawUpdatedAt: '2026-07-01T00:00:00.000Z',
      repo: 'b',
      prStatus: 'approved',
    });
    expect(getOpenGithubPrCandidates(db).map((c) => c.id)).toContain(pr.id);
  });

  it('excludes items already marked done', () => {
    const pr = upsertSyncedItem(db, {
      source: 'github_pr',
      externalId: '2@a/b',
      title: 'Fix bug',
      url: null,
      reason: 'review_requested',
      dueDate: null,
      sprintIteration: null,
      rawUpdatedAt: '2026-07-01T00:00:00.000Z',
      repo: 'b',
    });
    setStatus(db, pr.id, 'done', '2026-07-01T12:00:00.000Z');
    expect(getOpenGithubPrCandidates(db).map((c) => c.id)).not.toContain(pr.id);
  });

  it('excludes items already marked merged', () => {
    const pr = upsertSyncedItem(db, {
      source: 'github_pr',
      externalId: '3@a/b',
      title: 'Fix bug',
      url: null,
      reason: 'review_requested',
      dueDate: null,
      sprintIteration: null,
      rawUpdatedAt: '2026-07-01T00:00:00.000Z',
      repo: 'b',
    });
    setPrStatus(db, pr.id, 'merged');
    expect(getOpenGithubPrCandidates(db).map((c) => c.id)).not.toContain(pr.id);
  });

  it('excludes ado_workitem items', () => {
    const wi = upsertSyncedItem(db, {
      source: 'ado_workitem',
      externalId: '600',
      title: 'Some work item',
      url: null,
      reason: 'assigned',
      dueDate: null,
      sprintIteration: null,
      rawUpdatedAt: '2026-07-01T00:00:00.000Z',
      repo: null,
    });
    expect(getOpenGithubPrCandidates(db).map((c) => c.id)).not.toContain(wi.id);
  });

  it('setPrStatus updates the stored pr_status', () => {
    const pr = upsertSyncedItem(db, {
      source: 'github_pr',
      externalId: '4@a/b',
      title: 'Fix bug',
      url: null,
      reason: 'review_requested',
      dueDate: null,
      sprintIteration: null,
      rawUpdatedAt: '2026-07-01T00:00:00.000Z',
      repo: 'b',
    });
    setPrStatus(db, pr.id, 'merged');
    expect(getItemById(db, pr.id)?.prStatus).toBe('merged');
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

describe('setParked', () => {
  it('marks an item parked', () => {
    const item = createAdhocItem(db, { title: 'Test' });
    setStatus(db, item.id, 'in_progress');
    setParked(db, item.id, true);
    expect(getItemById(db, item.id)?.parked).toBe(true);
  });

  it('unmarks a parked item', () => {
    const item = createAdhocItem(db, { title: 'Test' });
    setStatus(db, item.id, 'in_progress');
    setParked(db, item.id, true);
    setParked(db, item.id, false);
    expect(getItemById(db, item.id)?.parked).toBe(false);
  });
});

describe('setStatus clears parked', () => {
  it('resets parked to false on any status transition', () => {
    const item = createAdhocItem(db, { title: 'Test' });
    setStatus(db, item.id, 'in_progress');
    setParked(db, item.id, true);

    setStatus(db, item.id, 'inbox');

    expect(getItemById(db, item.id)?.parked).toBe(false);
  });
});

describe('setTodayDate', () => {
  it('sets today_date', () => {
    const item = createAdhocItem(db, { title: 'Test' });
    setTodayDate(db, item.id, '2026-08-13');
    expect(getItemById(db, item.id)?.todayDate).toBe('2026-08-13');
  });

  it('clears today_date when passed null', () => {
    const item = createAdhocItem(db, { title: 'Test' });
    setTodayDate(db, item.id, '2026-08-13');
    setTodayDate(db, item.id, null);
    expect(getItemById(db, item.id)?.todayDate).toBeNull();
  });
});

describe('setStarred', () => {
  it('toggles the starred flag', () => {
    const item = createAdhocItem(db, { title: 'Star me' });
    setStarred(db, item.id, true);
    expect(getItemById(db, item.id)?.starred).toBe(true);
    setStarred(db, item.id, false);
    expect(getItemById(db, item.id)?.starred).toBe(false);
  });
});

describe('setSnoozedUntil', () => {
  it('sets and clears the snooze timestamp', () => {
    const item = createAdhocItem(db, { title: 'Snooze me' });
    setSnoozedUntil(db, item.id, '2026-09-01T09:00:00.000Z');
    expect(getItemById(db, item.id)?.snoozedUntil).toBe('2026-09-01T09:00:00.000Z');
    setSnoozedUntil(db, item.id, null);
    expect(getItemById(db, item.id)?.snoozedUntil).toBeNull();
  });

  it('clears any woke_early marker when a new snooze is set', () => {
    const item = createAdhocItem(db, { title: 'Woke early item' });
    db.prepare('UPDATE items SET woke_early = 1 WHERE id = ?').run(item.id);
    setSnoozedUntil(db, item.id, '2026-09-01T09:00:00.000Z');
    expect(getItemById(db, item.id)?.wokeEarly).toBe(false);
  });
});

describe('setTriageState', () => {
  it('marks an item done locally and back to none', () => {
    const item = createAdhocItem(db, { title: 'Done me' });
    setTriageState(db, item.id, 'done');
    expect(getItemById(db, item.id)?.triageState).toBe('done');
    setTriageState(db, item.id, 'none');
    expect(getItemById(db, item.id)?.triageState).toBe('none');
  });
});

describe('setStatus today_date interaction', () => {
  it('leaves today_date untouched when starting an item pinned to today', () => {
    const item = createAdhocItem(db, { title: 'Test' });
    setTodayDate(db, item.id, '2026-08-13');
    setStatus(db, item.id, 'in_progress');
    expect(getItemById(db, item.id)?.todayDate).toBe('2026-08-13');
  });

  it('leaves today_date untouched when completing an item directly (never started)', () => {
    const item = createAdhocItem(db, { title: 'Test' });
    setTodayDate(db, item.id, '2026-08-13');
    setStatus(db, item.id, 'done', '2026-08-13T12:00:00.000Z');
    expect(getItemById(db, item.id)?.todayDate).toBe('2026-08-13');
  });

  it('leaves today_date untouched when returning an item to inbox', () => {
    const item = createAdhocItem(db, { title: 'Test' });
    setTodayDate(db, item.id, '2026-08-13');
    setStatus(db, item.id, 'inbox');
    expect(getItemById(db, item.id)?.todayDate).toBe('2026-08-13');
  });

  it('still resets parked to false on the in_progress transition, unchanged from before', () => {
    const item = createAdhocItem(db, { title: 'Test' });
    setStatus(db, item.id, 'in_progress');
    setParked(db, item.id, true);
    setTodayDate(db, item.id, '2026-08-13');
    setStatus(db, item.id, 'in_progress');
    expect(getItemById(db, item.id)?.parked).toBe(false);
    expect(getItemById(db, item.id)?.todayDate).toBe('2026-08-13');
  });
});

describe('upsertSyncedItem item_links', () => {
  it('writes item_links rows for a PR with linkedAdoExternalIds', () => {
    const pr = upsertSyncedItem(db, {
      source: 'github_pr',
      externalId: 'gh-40',
      title: 'Fix bug',
      url: null,
      reason: 'review_requested',
      dueDate: null,
      sprintIteration: null,
      rawUpdatedAt: '2026-07-01T00:00:00.000Z',
      repo: null,
      linkedAdoExternalIds: ['41363', '99'],
    });
    const rows = db
      .prepare('SELECT ado_external_id FROM item_links WHERE pr_item_id = ? ORDER BY ado_external_id')
      .all(pr.id) as { ado_external_id: string }[];
    expect(rows.map((r) => r.ado_external_id)).toEqual(['41363', '99']);
  });

  it('fully replaces item_links on re-sync when the referenced ids change', () => {
    const pr = upsertSyncedItem(db, {
      source: 'github_pr',
      externalId: 'gh-41',
      title: 'Fix bug',
      url: null,
      reason: 'review_requested',
      dueDate: null,
      sprintIteration: null,
      rawUpdatedAt: '2026-07-01T00:00:00.000Z',
      repo: null,
      linkedAdoExternalIds: ['1'],
    });
    upsertSyncedItem(db, {
      source: 'github_pr',
      externalId: 'gh-41',
      title: 'Fix bug',
      url: null,
      reason: 'review_requested',
      dueDate: null,
      sprintIteration: null,
      rawUpdatedAt: '2026-07-02T00:00:00.000Z',
      repo: null,
      linkedAdoExternalIds: ['2'],
    });
    const rows = db.prepare('SELECT ado_external_id FROM item_links WHERE pr_item_id = ?').all(pr.id) as {
      ado_external_id: string;
    }[];
    expect(rows.map((r) => r.ado_external_id)).toEqual(['2']);
  });

  it('does not write item_links rows when linkedAdoExternalIds is absent', () => {
    const pr = upsertSyncedItem(db, {
      source: 'github_pr',
      externalId: 'gh-42',
      title: 'Fix bug',
      url: null,
      reason: 'review_requested',
      dueDate: null,
      sprintIteration: null,
      rawUpdatedAt: '2026-07-01T00:00:00.000Z',
      repo: null,
    });
    const rows = db.prepare('SELECT * FROM item_links WHERE pr_item_id = ?').all(pr.id);
    expect(rows).toHaveLength(0);
  });

  it('does not write item_links rows for an ado_workitem upsert', () => {
    const wi = upsertSyncedItem(db, {
      source: 'ado_workitem',
      externalId: '500',
      title: 'Some work item',
      url: null,
      reason: 'assigned',
      dueDate: null,
      sprintIteration: null,
      rawUpdatedAt: '2026-07-01T00:00:00.000Z',
      repo: null,
    });
    const rows = db.prepare('SELECT * FROM item_links WHERE pr_item_id = ?').all(wi.id);
    expect(rows).toHaveLength(0);
  });
});
