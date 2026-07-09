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
  options: { durationHours?: number; note?: string } = {}
): TimeLog {
  const openLog = db
    .prepare('SELECT * FROM time_logs WHERE item_id = ? AND ended_at IS NULL ORDER BY id DESC LIMIT 1')
    .get(itemId) as any;
  const now = new Date().toISOString();

  if (!openLog) {
    // No open timer (e.g. the item was never Started) — record an
    // already-closed log instead of failing the completion.
    const result = db
      .prepare('INSERT INTO time_logs (item_id, started_at, ended_at, duration_hours, note) VALUES (?, ?, ?, ?, ?)')
      .run(itemId, now, now, options.durationHours ?? 0, options.note ?? null);
    return rowToLog(db.prepare('SELECT * FROM time_logs WHERE id = ?').get(result.lastInsertRowid));
  }

  const duration =
    options.durationHours ??
    (new Date(now).getTime() - new Date(openLog.started_at).getTime()) / 3_600_000;

  db.prepare('UPDATE time_logs SET ended_at = ?, duration_hours = ?, note = ? WHERE id = ?').run(
    now,
    duration,
    options.note ?? null,
    openLog.id
  );
  return rowToLog(db.prepare('SELECT * FROM time_logs WHERE id = ?').get(openLog.id));
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
