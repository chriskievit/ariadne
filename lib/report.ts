import type Database from 'better-sqlite3';
import type { Source } from './types';

export interface TimeReport {
  totalsBySource: Record<Source, number>;
  dailySeries: Array<{ date: string } & Record<Source, number>>;
}

const SOURCES: Source[] = ['github_pr', 'ado_workitem', 'adhoc'];

function emptyTotals(): Record<Source, number> {
  return { github_pr: 0, ado_workitem: 0, adhoc: 0 };
}

export function getTimeReport(db: Database.Database, startDate: string, endDate: string): TimeReport {
  const startBound = `${startDate}T00:00:00.000Z`;
  const endBound = `${endDate}T23:59:59.999Z`;

  const rows = db
    .prepare(
      `SELECT items.source as source, DATE(items.completed_at) as day, SUM(time_logs.duration_hours) as hours
       FROM time_logs
       JOIN items ON items.id = time_logs.item_id
       WHERE time_logs.duration_hours IS NOT NULL
         AND items.completed_at BETWEEN ? AND ?
         AND time_logs.started_at BETWEEN ? AND ?
       GROUP BY items.source, day
       ORDER BY day`
    )
    .all(startBound, endBound, startBound, endBound) as Array<{ source: Source; day: string; hours: number }>;

  const totalsBySource = emptyTotals();
  const byDay = new Map<string, Record<Source, number>>();

  for (const row of rows) {
    totalsBySource[row.source] += row.hours;
    if (!byDay.has(row.day)) byDay.set(row.day, emptyTotals());
    byDay.get(row.day)![row.source] += row.hours;
  }

  const dailySeries = Array.from(byDay.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, sources]) => ({ date, ...sources }));

  return { totalsBySource, dailySeries };
}

export { SOURCES };
