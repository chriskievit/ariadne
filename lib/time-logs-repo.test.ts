import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { openDb } from './db';
import { createAdhocItem } from './items-repo';
import { localDateString } from './date';
import {
  startTimer,
  completeTimer,
  undoLastCompletion,
  listLogsByItem,
  elapsedHoursSinceStart,
  sumHoursLoggedOn,
  sumHoursLoggedOnByItem,
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
