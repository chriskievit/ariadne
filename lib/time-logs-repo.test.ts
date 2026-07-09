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

    const completed = completeTimer(db, itemId, { durationHours: 0.75, note: 'Paired with Alex' });
    expect(completed.id).toBe(started.id);
    expect(completed.durationHours).toBe(0.75);
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
    expect(completed.durationHours).toBeGreaterThanOrEqual(9 / 60);
    expect(completed.durationHours).toBeLessThanOrEqual(11 / 60);
  });

  it('creates an already-closed log when there is no open timer', () => {
    const completed = completeTimer(db, itemId, { durationHours: 0.25 });
    expect(completed.durationHours).toBe(0.25);
    expect(completed.endedAt).not.toBeNull();
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
