import type Database from 'better-sqlite3';
import type { TimeLog } from './types';
import { localDateString } from './date';

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

// Enforces the single-running-timer invariant here, at the source, rather
// than relying on every caller to stop the previous timer first -- that's
// exactly the discipline the link-start cascade (Dashboard.tsx) forgot,
// leaving multiple items with an open timer at once. Closing any other
// open timer first (banking its elapsed time, same as stopTimer) means
// that can't happen again regardless of what a future caller does.
export function startTimer(db: Database.Database, itemId: number): TimeLog {
  const others = db
    .prepare('SELECT item_id FROM time_logs WHERE ended_at IS NULL AND item_id != ?')
    .all(itemId) as { item_id: number }[];
  for (const other of others) stopTimer(db, other.item_id);

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

// Closes the currently open timer for an item, banking elapsed time as a
// log entry, without touching the item's status. This is "pause the
// clock, not the work" -- used by park (which used to leave a timer open
// indefinitely) and by the timer-switch flow when the user starts a
// different item while one is already running.
export function stopTimer(db: Database.Database, itemId: number): void {
  const openLog = db
    .prepare('SELECT * FROM time_logs WHERE item_id = ? AND ended_at IS NULL ORDER BY id DESC LIMIT 1')
    .get(itemId) as any;
  if (!openLog) return;
  const elapsed = elapsedHoursSinceStart(db, itemId);
  db.prepare('UPDATE time_logs SET ended_at = ?, duration_hours = ? WHERE id = ?').run(
    new Date().toISOString(),
    elapsed,
    openLog.id
  );
}

export interface RunningTimer {
  itemId: number;
  itemTitle: string;
  startedAt: string;
}

// At most one row should ever satisfy ended_at IS NULL across the whole
// table -- every path that starts a timer (start, and the switch flow)
// stops whatever was running first.
export function getRunningTimer(db: Database.Database): RunningTimer | null {
  const row = db
    .prepare(
      `SELECT tl.item_id as itemId, tl.started_at as startedAt, i.title as itemTitle
       FROM time_logs tl JOIN items i ON i.id = tl.item_id
       WHERE tl.ended_at IS NULL
       ORDER BY tl.started_at DESC LIMIT 1`
    )
    .get() as RunningTimer | undefined;
  return row ?? null;
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

// Grouped by item so the shutdown dialog can show hours-logged-today per
// item, not just the day's total.
export function sumHoursLoggedOnByItem(db: Database.Database, date: string): Map<number, number> {
  const rows = db
    .prepare(
      'SELECT item_id, ended_at, duration_hours FROM time_logs WHERE ended_at IS NOT NULL AND duration_hours IS NOT NULL'
    )
    .all() as { item_id: number; ended_at: string; duration_hours: number }[];
  const byItem = new Map<number, number>();
  for (const row of rows) {
    if (localDateString(new Date(row.ended_at)) !== date) continue;
    byItem.set(row.item_id, (byItem.get(row.item_id) ?? 0) + row.duration_hours);
  }
  return byItem;
}

export function sumHoursLoggedOn(db: Database.Database, date: string): number {
  let total = 0;
  for (const hours of sumHoursLoggedOnByItem(db, date).values()) total += hours;
  return total;
}
