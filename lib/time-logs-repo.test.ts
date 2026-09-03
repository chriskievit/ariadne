import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { openDb } from './db';
import { createAdhocItem, upsertSyncedItem } from './items-repo';
import { localDateString } from './date';
import {
  startTimer,
  completeTimer,
  undoLastCompletion,
  listLogsByItem,
  elapsedHoursSinceStart,
  sumHoursLoggedOn,
  sumHoursLoggedOnByItem,
  stopTimer,
  getRunningTimer,
  medianMinutesByWorkType,
} from './time-logs-repo';

let db: Database.Database;
let itemId: number;

beforeEach(() => {
  db = openDb(':memory:');
  const now = new Date().toISOString();
  const result = db
    .prepare(
      `INSERT INTO items (source, external_id, title, reason, status, created_at) VALUES ('adhoc', NULL, 'Test item', 'manual', 'inbox', ?)`
    )
    .run(now);
  itemId = Number(result.lastInsertRowid);
});

describe('startTimer / completeTimer', () => {
  it('starts an open log and closes it with a manual duration', () => {
    const started = startTimer(db, itemId);
    expect(started.endedAt).toBeNull();

    const completed = completeTimer(db, itemId, { durationHours: 0.75, note: 'Paired with Alex' });
    expect(completed.id).toBe(started.id);
    expect(completed.durationHours).toBe(0.75);
    expect(completed.note).toBe('Paired with Alex');
    expect(completed.endedAt).not.toBeNull();
  });

  it('creates an already-closed log when there is no open timer', () => {
    const completed = completeTimer(db, itemId, { durationHours: 0.25 });
    expect(completed.durationHours).toBe(0.25);
    expect(completed.endedAt).not.toBeNull();
  });

  it('throws when durationHours is missing', () => {
    startTimer(db, itemId);
    expect(() => completeTimer(db, itemId, {} as any)).toThrow(/durationHours/);
  });

  it('throws when durationHours is negative', () => {
    startTimer(db, itemId);
    expect(() => completeTimer(db, itemId, { durationHours: -1 })).toThrow(/durationHours/);
  });
});

describe('startTimer enforces a single running timer', () => {
  it('closes any other item\'s open timer before opening a new one', () => {
    const other = createAdhocItem(db, { title: 'Was already running' });
    startTimer(db, other.id);
    expect(getRunningTimer(db)?.itemId).toBe(other.id);

    startTimer(db, itemId);

    // Exactly one open timer should exist across the whole table, and it
    // should be the one just started -- not both.
    const openCount = db.prepare('SELECT COUNT(*) as n FROM time_logs WHERE ended_at IS NULL').get() as { n: number };
    expect(openCount.n).toBe(1);
    expect(getRunningTimer(db)?.itemId).toBe(itemId);

    // The previously-running item's elapsed time should be banked, not
    // discarded, when it gets closed out this way.
    const otherLogs = listLogsByItem(db, other.id);
    expect(otherLogs).toHaveLength(1);
    expect(otherLogs[0].endedAt).not.toBeNull();
    expect(otherLogs[0].durationHours).not.toBeNull();
  });
});

describe('elapsedHoursSinceStart', () => {
  it('returns the wall-clock hours elapsed since the open timer started', () => {
    const started = startTimer(db, itemId);
    db.prepare('UPDATE time_logs SET started_at = ? WHERE id = ?').run(
      new Date(Date.now() - 10 * 60_000).toISOString(),
      started.id
    );
    const hours = elapsedHoursSinceStart(db, itemId);
    expect(hours).toBeGreaterThanOrEqual(9 / 60);
    expect(hours).toBeLessThanOrEqual(11 / 60);
  });

  it('returns 0 when there is no open timer', () => {
    expect(elapsedHoursSinceStart(db, itemId)).toBe(0);
  });
});

describe('undoLastCompletion', () => {
  it('removes the most recent log entry', () => {
    startTimer(db, itemId);
    completeTimer(db, itemId, { durationHours: 1.5 });
    undoLastCompletion(db, itemId);
    expect(listLogsByItem(db, itemId)).toHaveLength(0);
  });
});

describe('sumHoursLoggedOn / sumHoursLoggedOnByItem', () => {
  it('sums duration_hours only for logs ended on the given date', () => {
    const testDb = openDb(':memory:');
    const item = createAdhocItem(testDb, { title: 'Test' });
    testDb
      .prepare('INSERT INTO time_logs (item_id, started_at, ended_at, duration_hours) VALUES (?, ?, ?, ?)')
      .run(item.id, '2026-08-12T10:00:00.000Z', '2026-08-12T12:00:00.000Z', 2);
    testDb
      .prepare('INSERT INTO time_logs (item_id, started_at, ended_at, duration_hours) VALUES (?, ?, ?, ?)')
      .run(item.id, '2026-08-13T10:00:00.000Z', '2026-08-13T11:30:00.000Z', 1.5);

    expect(sumHoursLoggedOn(testDb, '2026-08-13')).toBe(1.5);
    expect(sumHoursLoggedOnByItem(testDb, '2026-08-13').get(item.id)).toBe(1.5);
    testDb.close();
  });

  it('ignores open timers (no ended_at)', () => {
    const testDb = openDb(':memory:');
    const item = createAdhocItem(testDb, { title: 'Test' });
    startTimer(testDb, item.id);

    expect(sumHoursLoggedOn(testDb, localDateString(new Date()))).toBe(0);
    testDb.close();
  });

  it('returns 0 / an empty map when there are no logs on the date', () => {
    const testDb = openDb(':memory:');
    expect(sumHoursLoggedOn(testDb, '2026-08-13')).toBe(0);
    expect(sumHoursLoggedOnByItem(testDb, '2026-08-13').size).toBe(0);
    testDb.close();
  });
});

describe('stopTimer', () => {
  it('closes the open log and banks the elapsed time, without requiring a status change', () => {
    const item = createAdhocItem(db, { title: 'Timed' });
    startTimer(db, item.id);
    stopTimer(db, item.id);
    const logs = listLogsByItem(db, item.id);
    expect(logs).toHaveLength(1);
    expect(logs[0].endedAt).not.toBeNull();
    expect(logs[0].durationHours).not.toBeNull();
  });

  it('is a no-op when there is no open timer', () => {
    const item = createAdhocItem(db, { title: 'Never started' });
    expect(() => stopTimer(db, item.id)).not.toThrow();
    expect(listLogsByItem(db, item.id)).toHaveLength(0);
  });
});

describe('getRunningTimer', () => {
  it('returns null when nothing is running', () => {
    expect(getRunningTimer(db)).toBeNull();
  });

  it('returns the running item id, title, and start time', () => {
    const item = createAdhocItem(db, { title: 'Active work' });
    startTimer(db, item.id);
    const running = getRunningTimer(db);
    expect(running?.itemId).toBe(item.id);
    expect(running?.itemTitle).toBe('Active work');
    expect(running?.startedAt).toBeTruthy();
  });

  it('returns null again after the timer is stopped', () => {
    const item = createAdhocItem(db, { title: 'Active work' });
    startTimer(db, item.id);
    stopTimer(db, item.id);
    expect(getRunningTimer(db)).toBeNull();
  });
});

// duration_hours is what the schema stores; the engine wants minutes, so
// these helpers write hours and assert on minutes deliberately.
function logHours(database: Database.Database, id: number, hours: number) {
  database
    .prepare(
      "INSERT INTO time_logs (item_id, started_at, ended_at, duration_hours) VALUES (?, '2026-09-01T09:00:00.000Z', '2026-09-01T10:00:00.000Z', ?)"
    )
    .run(id, hours);
}

function syncedItem(database: Database.Database, externalId: string, reason: 'review_requested' | 'authored') {
  return upsertSyncedItem(database, {
    source: 'github_pr',
    externalId,
    title: `PR ${externalId}`,
    url: null,
    reason,
    dueDate: null,
    sprintIteration: null,
    rawUpdatedAt: null,
    repo: 'org/repo',
  });
}

describe('medianMinutesByWorkType', () => {
  it('returns nothing when there are no logs', () => {
    expect(medianMinutesByWorkType(db)).toEqual({});
  });

  it('takes the middle value for an odd number of samples', () => {
    const item = syncedItem(db, 'pr-1', 'review_requested');
    logHours(db, item.id, 0.5);
    logHours(db, item.id, 1);
    logHours(db, item.id, 3);
    expect(medianMinutesByWorkType(db).review).toEqual({ medianMinutes: 60, sampleCount: 3 });
  });

  it('averages the two middle values for an even number of samples', () => {
    const item = createAdhocItem(db, { title: 'A favour' });
    logHours(db, item.id, 0.5);
    logHours(db, item.id, 1.5);
    expect(medianMinutesByWorkType(db).ad_hoc).toEqual({ medianMinutes: 60, sampleCount: 2 });
  });

  it('ignores a log with no recorded duration', () => {
    const item = createAdhocItem(db, { title: 'A favour' });
    logHours(db, item.id, 1);
    db.prepare("INSERT INTO time_logs (item_id, started_at) VALUES (?, '2026-09-01T09:00:00.000Z')").run(item.id);
    expect(medianMinutesByWorkType(db).ad_hoc).toEqual({ medianMinutes: 60, sampleCount: 1 });
  });

  it('groups by work type rather than by source', () => {
    const review = syncedItem(db, 'pr-1', 'review_requested');
    const ownWork = syncedItem(db, 'pr-2', 'authored');
    logHours(db, review.id, 0.5);
    logHours(db, ownWork.id, 2);
    const medians = medianMinutesByWorkType(db);
    expect(medians.review).toEqual({ medianMinutes: 30, sampleCount: 1 });
    expect(medians.own_work).toEqual({ medianMinutes: 120, sampleCount: 1 });
  });
});
