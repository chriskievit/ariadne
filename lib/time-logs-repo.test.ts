import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { openDb } from './db';
import { startTimer, completeTimer, undoLastCompletion, listLogsByItem } from './time-logs-repo';

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

    const completed = completeTimer(db, itemId, { durationMinutes: 45, note: 'Paired with Alex' });
    expect(completed.id).toBe(started.id);
    expect(completed.durationMinutes).toBe(45);
    expect(completed.note).toBe('Paired with Alex');
    expect(completed.endedAt).not.toBeNull();
  });

  it('computes duration from elapsed time when none is given', () => {
    const started = startTimer(db, itemId);
    db.prepare('UPDATE time_logs SET started_at = ? WHERE id = ?').run(
      new Date(Date.now() - 10 * 60_000).toISOString(),
      started.id
    );
    const completed = completeTimer(db, itemId);
    expect(completed.durationMinutes).toBeGreaterThanOrEqual(9);
    expect(completed.durationMinutes).toBeLessThanOrEqual(11);
  });

  it('throws when there is no open log to complete', () => {
    expect(() => completeTimer(db, itemId)).toThrow('No open time log for item');
  });
});

describe('undoLastCompletion', () => {
  it('removes the most recent log entry', () => {
    startTimer(db, itemId);
    completeTimer(db, itemId, { durationMinutes: 20 });
    undoLastCompletion(db, itemId);
    expect(listLogsByItem(db, itemId)).toHaveLength(0);
  });
});
