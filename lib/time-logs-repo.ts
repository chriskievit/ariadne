import type Database from 'better-sqlite3';
import type { TimeLog } from './types';

function rowToLog(row: any): TimeLog {
  return {
    id: row.id,
    itemId: row.item_id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    durationHours: row.duration_hours,
    note: row.note,
  };
}

export function startTimer(db: Database.Database, itemId: number): TimeLog {
  const now = new Date().toISOString();
  const result = db.prepare('INSERT INTO time_logs (item_id, started_at) VALUES (?, ?)').run(itemId, now);
  return rowToLog(db.prepare('SELECT * FROM time_logs WHERE id = ?').get(result.lastInsertRowid));
}

export function completeTimer(
  db: Database.Database,
  itemId: number,
  options: { durationHours: number; note?: string }
): TimeLog {
  if (typeof options.durationHours !== 'number' || !Number.isFinite(options.durationHours) || options.durationHours < 0) {
    throw new Error('durationHours is required and must be >= 0');
  }

  const openLog = db
    .prepare('SELECT * FROM time_logs WHERE item_id = ? AND ended_at IS NULL ORDER BY id DESC LIMIT 1')
    .get(itemId) as any;
  const now = new Date().toISOString();

  if (!openLog) {
    // No open timer (e.g. the item was never Started) — record an
    // already-closed log instead of failing the completion.
    const result = db
      .prepare('INSERT INTO time_logs (item_id, started_at, ended_at, duration_hours, note) VALUES (?, ?, ?, ?, ?)')
      .run(itemId, now, now, options.durationHours, options.note ?? null);
    return rowToLog(db.prepare('SELECT * FROM time_logs WHERE id = ?').get(result.lastInsertRowid));
  }

  db.prepare('UPDATE time_logs SET ended_at = ?, duration_hours = ?, note = ? WHERE id = ?').run(
    now,
    options.durationHours,
    options.note ?? null,
    openLog.id
  );
  return rowToLog(db.prepare('SELECT * FROM time_logs WHERE id = ?').get(openLog.id));
}

// Wall-clock hours since the item's open timer started, or 0 if there is no
// open timer. Kept separate from completeTimer so callers must be explicit
// about whether they want raw elapsed time (e.g. requeue) vs. a hand-entered
// duration (e.g. completing an item) -- conflating the two is what let a
// timer left open for days get silently logged as ~96 "hours worked".
export function elapsedHoursSinceStart(db: Database.Database, itemId: number): number {
  const openLog = db
    .prepare('SELECT * FROM time_logs WHERE item_id = ? AND ended_at IS NULL ORDER BY id DESC LIMIT 1')
    .get(itemId) as any;
  if (!openLog) return 0;
  return (Date.now() - new Date(openLog.started_at).getTime()) / 3_600_000;
}

export function undoLastCompletion(db: Database.Database, itemId: number): void {
  const lastLog = db.prepare('SELECT * FROM time_logs WHERE item_id = ? ORDER BY id DESC LIMIT 1').get(itemId) as any;
  if (lastLog) {
    db.prepare('DELETE FROM time_logs WHERE id = ?').run(lastLog.id);
  }
}

export function listLogsByItem(db: Database.Database, itemId: number): TimeLog[] {
  return db.prepare('SELECT * FROM time_logs WHERE item_id = ? ORDER BY started_at').all(itemId).map(rowToLog);
}
