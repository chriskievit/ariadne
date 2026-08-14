import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { openDb } from './db';
import { upsertSyncedItem, createAdhocItem, setStatus, setParked, setTodayDate } from './items-repo';
import { getGroupedItems, getTodaySummary } from './dashboard';
import { localDateString } from './date';
import { addPlanItem, setPlanItemEstimate, reorderPlanItems } from './plans-repo';
import { startTimer, completeTimer } from './time-logs-repo';

let db: Database.Database;

beforeEach(() => {
  db = openDb(':memory:');
});

describe('getGroupedItems', () => {
  it('splits items into signals and inProgress', () => {
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
    expect(grouped.signals.map((i) => i.id).sort()).toEqual([low.id, urgent.id].sort());
    expect(grouped.inProgress.map((i) => i.id)).toEqual([active.id]);
  });

  it('always includes inbox ad-hoc items in signals, regardless of score', () => {
    const adhoc = createAdhocItem(db, { title: 'Reply to Sarah re: deploy window' });

    const grouped = getGroupedItems(db, new Date());
    expect(grouped.signals.map((i) => i.id)).toEqual([adhoc.id]);
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
    expect(grouped.signals.map((i) => i.id)).toEqual([]);
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
    expect(grouped.signals.map((i) => i.id)).toEqual([item.id]);
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
    const all = [...grouped.signals, ...grouped.inProgress];
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
    expect(grouped.signals.find((i) => i.id === adhoc.id)?.links).toEqual([]);
  });
});

describe('getTodaySummary', () => {
  it('splits planned-today items into still-open vs done-today, independent of each other', () => {
    const stillOpen = createAdhocItem(db, { title: 'Still open' });
    setTodayDate(db, stillOpen.id, '2026-08-13');

    const finishedViaToday = upsertSyncedItem(db, {
      source: 'ado_workitem',
      externalId: '1',
      title: 'Finished, was pinned today',
      url: null,
      reason: 'assigned',
      dueDate: null,
      sprintIteration: null,
      rawUpdatedAt: null,
      repo: null,
    });
    setTodayDate(db, finishedViaToday.id, '2026-08-13');
    setStatus(db, finishedViaToday.id, 'in_progress'); // clears today_date, as expected
    setStatus(db, finishedViaToday.id, 'done', '2026-08-13T15:00:00.000Z');

    const finishedWithoutEverBeingPinned = upsertSyncedItem(db, {
      source: 'ado_workitem',
      externalId: '2',
      title: 'Finished, never pinned',
      url: null,
      reason: 'assigned',
      dueDate: null,
      sprintIteration: null,
      rawUpdatedAt: null,
      repo: null,
    });
    setStatus(db, finishedWithoutEverBeingPinned.id, 'done', '2026-08-13T16:00:00.000Z');

    const now = new Date(2026, 7, 13, 20, 0);
    const summary = getTodaySummary(db, '2026-08-13', now);

    expect(summary.planned.map((i) => i.id)).toEqual([stillOpen.id]);
    expect(summary.doneToday.map((i) => i.id).sort()).toEqual(
      [finishedViaToday.id, finishedWithoutEverBeingPinned.id].sort()
    );
  });

  it('excludes an item with a stale (past) today_date that was never carried forward or completed', () => {
    const stale = createAdhocItem(db, { title: 'Forgotten' });
    setTodayDate(db, stale.id, '2026-08-11');

    const now = new Date(2026, 7, 13, 20, 0);
    const summary = getTodaySummary(db, '2026-08-13', now);

    expect(summary.planned.map((i) => i.id)).toEqual([]);
    expect(summary.doneToday.map((i) => i.id)).toEqual([]);
  });

  it("sums hoursLoggedToday only from today's time_logs rows", () => {
    const item = createAdhocItem(db, { title: 'Multi-day item' });
    db.prepare('INSERT INTO time_logs (item_id, started_at, ended_at, duration_hours) VALUES (?, ?, ?, ?)').run(
      item.id,
      '2026-08-12T10:00:00.000Z',
      '2026-08-12T12:00:00.000Z',
      2
    );
    db.prepare('INSERT INTO time_logs (item_id, started_at, ended_at, duration_hours) VALUES (?, ?, ?, ?)').run(
      item.id,
      '2026-08-13T09:00:00.000Z',
      '2026-08-13T10:15:00.000Z',
      1.25
    );

    const now = new Date(2026, 7, 13, 20, 0);
    const summary = getTodaySummary(db, '2026-08-13', now);
    expect(summary.hoursLoggedToday).toBe(1.25);
  });
});

describe('getGroupedItems today ordering', () => {
  it('orders today items by plan_items.sort_order, not by score', () => {
    const now = new Date(2026, 7, 14, 9, 0);
    const todayStr = localDateString(now);

    const highScore = upsertSyncedItem(db, {
      source: 'github_pr',
      externalId: '1@a/b',
      title: 'High score, picked second',
      url: null,
      reason: 'approved_unmerged',
      dueDate: null,
      sprintIteration: null,
      rawUpdatedAt: null,
      repo: null,
    });
    const lowScore = upsertSyncedItem(db, {
      source: 'ado_workitem',
      externalId: '2',
      title: 'Low score, picked first',
      url: null,
      reason: 'assigned',
      dueDate: null,
      sprintIteration: null,
      rawUpdatedAt: null,
      repo: null,
    });
    setTodayDate(db, highScore.id, todayStr);
    setTodayDate(db, lowScore.id, todayStr);
    addPlanItem(db, todayStr, highScore.id);
    addPlanItem(db, todayStr, lowScore.id);
    reorderPlanItems(db, todayStr, [lowScore.id, highScore.id]);

    const grouped = getGroupedItems(db, now);
    expect(grouped.today.map((i) => i.id)).toEqual([lowScore.id, highScore.id]);
  });

  it('carries estimateMinutes and loggedMinutesToday onto each today item', () => {
    const now = new Date(2026, 7, 14, 9, 0);
    const todayStr = localDateString(now);
    const item = createAdhocItem(db, { title: 'Estimated' });
    setTodayDate(db, item.id, todayStr);
    addPlanItem(db, todayStr, item.id);
    setPlanItemEstimate(db, todayStr, item.id, 90);
    startTimer(db, item.id);
    completeTimer(db, item.id, { durationHours: 0.5 });
    db.prepare('UPDATE time_logs SET started_at = ?, ended_at = ? WHERE item_id = ?').run(
      now.toISOString(),
      now.toISOString(),
      item.id
    );

    const grouped = getGroupedItems(db, now);
    const found = grouped.today.find((i) => i.id === item.id);
    expect(found?.estimateMinutes).toBe(90);
    expect(found?.loggedMinutesToday).toBe(30);
  });
});
