import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { openDb } from './db';
import { upsertSyncedItem, createAdhocItem, setStatus, setParked, setTodayDate } from './items-repo';
import { getGroupedItems } from './dashboard';

let db: Database.Database;

beforeEach(() => {
  db = openDb(':memory:');
});

describe('getGroupedItems', () => {
  it('splits items into needsAttention, inProgress, and everythingElse', () => {
    const urgent = upsertSyncedItem(db, {
      source: 'github_pr',
      externalId: '1@a/b',
      title: 'Ready to merge',
      url: null,
      reason: 'approved_unmerged',
      dueDate: null,
      sprintIteration: null,
      rawUpdatedAt: null,
      repo: null,
    });
    const low = upsertSyncedItem(db, {
      source: 'ado_workitem',
      externalId: '101',
      title: 'Backlog item',
      url: null,
      reason: 'assigned',
      dueDate: null,
      sprintIteration: null,
      rawUpdatedAt: null,
      repo: null,
    });
    const active = upsertSyncedItem(db, {
      source: 'ado_workitem',
      externalId: '102',
      title: 'In flight',
      url: null,
      reason: 'assigned',
      dueDate: null,
      sprintIteration: null,
      rawUpdatedAt: null,
      repo: null,
    });
    setStatus(db, active.id, 'in_progress');

    const grouped = getGroupedItems(db, new Date());
    expect(grouped.needsAttention.map((i) => i.id)).toEqual([urgent.id]);
    expect(grouped.inProgress.map((i) => i.id)).toEqual([active.id]);
    expect(grouped.everythingElse.map((i) => i.id)).toEqual([low.id]);
  });

  it('always puts inbox ad-hoc items in needsAttention, regardless of score', () => {
    const adhoc = createAdhocItem(db, { title: 'Reply to Sarah re: deploy window' });

    const grouped = getGroupedItems(db, new Date());
    expect(grouped.needsAttention.map((i) => i.id)).toEqual([adhoc.id]);
    expect(grouped.everythingElse.map((i) => i.id)).toEqual([]);
  });
});

describe('getGroupedItems parked', () => {
  it('moves a parked in-progress item out of inProgress and into parked', () => {
    const active = upsertSyncedItem(db, {
      source: 'ado_workitem',
      externalId: '200',
      title: 'Active item',
      url: null,
      reason: 'assigned',
      dueDate: null,
      sprintIteration: null,
      rawUpdatedAt: null,
      repo: null,
    });
    const parked = upsertSyncedItem(db, {
      source: 'ado_workitem',
      externalId: '201',
      title: 'Parked item',
      url: null,
      reason: 'assigned',
      dueDate: null,
      sprintIteration: null,
      rawUpdatedAt: null,
      repo: null,
    });
    setStatus(db, active.id, 'in_progress');
    setStatus(db, parked.id, 'in_progress');
    setParked(db, parked.id, true);

    const grouped = getGroupedItems(db, new Date());
    expect(grouped.inProgress.map((i) => i.id)).toEqual([active.id]);
    expect(grouped.parked.map((i) => i.id)).toEqual([parked.id]);
  });
});

describe('getGroupedItems today bucket', () => {
  it('puts an item pinned to today in the today bucket instead of its score bucket', () => {
    const urgent = upsertSyncedItem(db, {
      source: 'github_pr',
      externalId: '1@a/b',
      title: 'Ready to merge',
      url: null,
      reason: 'approved_unmerged',
      dueDate: null,
      sprintIteration: null,
      rawUpdatedAt: null,
      repo: null,
    });
    setTodayDate(db, urgent.id, '2026-08-13');

    const now = new Date(2026, 7, 13, 9, 0);
    const grouped = getGroupedItems(db, now);
    expect(grouped.today.map((i) => i.id)).toEqual([urgent.id]);
    expect(grouped.needsAttention.map((i) => i.id)).toEqual([]);
  });

  it('does not put a stale (past) today_date item in the today bucket', () => {
    const item = upsertSyncedItem(db, {
      source: 'ado_workitem',
      externalId: '200',
      title: 'Old plan',
      url: null,
      reason: 'assigned',
      dueDate: null,
      sprintIteration: null,
      rawUpdatedAt: null,
      repo: null,
    });
    setTodayDate(db, item.id, '2026-08-11');

    const now = new Date(2026, 7, 13, 9, 0);
    const grouped = getGroupedItems(db, now);
    expect(grouped.today.map((i) => i.id)).toEqual([]);
    expect(grouped.everythingElse.map((i) => i.id)).toEqual([item.id]);
  });

  it('never puts an in-progress item in the today bucket even if today_date is still set', () => {
    const item = createAdhocItem(db, { title: 'Test' });
    setTodayDate(db, item.id, '2026-08-13');
    // Bypass setStatus's own auto-clear to simulate a stale write reaching
    // this state some other way -- belt-and-suspenders on top of Task 4.
    db.prepare("UPDATE items SET status = 'in_progress' WHERE id = ?").run(item.id);

    const now = new Date(2026, 7, 13, 9, 0);
    const grouped = getGroupedItems(db, now);
    expect(grouped.today.map((i) => i.id)).toEqual([]);
    expect(grouped.inProgress.map((i) => i.id)).toEqual([item.id]);
  });
});

describe('getGroupedItems links', () => {
  it('attaches linked items to both sides of a link', () => {
    const wi = upsertSyncedItem(db, {
      source: 'ado_workitem',
      externalId: '41363',
      title: 'WI',
      url: null,
      reason: 'assigned',
      dueDate: null,
      sprintIteration: null,
      rawUpdatedAt: null,
      repo: null,
    });
    const pr = upsertSyncedItem(db, {
      source: 'github_pr',
      externalId: '5654@acme/widgets',
      title: 'PR',
      url: null,
      reason: 'review_requested',
      dueDate: null,
      sprintIteration: null,
      rawUpdatedAt: null,
      repo: 'widgets',
      linkedAdoExternalIds: ['41363'],
    });

    const grouped = getGroupedItems(db, new Date());
    const all = [...grouped.needsAttention, ...grouped.inProgress, ...grouped.everythingElse];
    const wiItem = all.find((i) => i.id === wi.id);
    const prItem = all.find((i) => i.id === pr.id);

    expect(wiItem?.links).toEqual([
      { source: 'github_pr', shortLabel: '#5654', title: 'PR', url: '', status: 'inbox', itemId: pr.id },
    ]);
    expect(prItem?.links).toEqual([
      { source: 'ado_workitem', shortLabel: 'WI-41363', title: 'WI', url: '', status: 'inbox', itemId: wi.id },
    ]);
  });

  it('defaults links to an empty array when there are none', () => {
    const adhoc = createAdhocItem(db, { title: 'Reply to Sarah re: deploy window' });
    const grouped = getGroupedItems(db, new Date());
    expect(grouped.needsAttention.find((i) => i.id === adhoc.id)?.links).toEqual([]);
  });
});
