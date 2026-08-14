import type Database from 'better-sqlite3';
import type { Reason } from './types';

export type WorkType = 'review' | 'own_work' | 'assigned' | 'ad_hoc';

export const WORK_TYPE_LABEL: Record<WorkType, string> = {
  review: 'Review-type work',
  own_work: 'Your own work',
  assigned: 'Assigned work',
  ad_hoc: 'Ad-hoc work',
};

const REASON_WORK_TYPE: Record<Reason, WorkType> = {
  review_requested: 'review',
  approved_unmerged: 'review',
  stale_own_pr: 'own_work',
  authored: 'own_work',
  assigned: 'assigned',
  mention: 'assigned',
  manual: 'ad_hoc',
};

export function classifyWorkType(reason: Reason): WorkType {
  return REASON_WORK_TYPE[reason];
}

export interface CalibrationEntry {
  workType: WorkType;
  label: string;
  estimateMinutes: number;
  actualMinutes: number;
}

// Estimate vs actual, grouped by work type, for plan_items in [startDate,
// endDate]. Actual time is time_logs on the SAME plan date for that item --
// a scoped, precise definition ("today's plan vs today's logged time for
// that item"), not a lifetime total.
export function getCalibrationSummary(db: Database.Database, startDate: string, endDate: string): CalibrationEntry[] {
  const rows = db
    .prepare(
      `SELECT
         i.reason as reason,
         COALESCE(pi.estimate_minutes, 0) as estimateMinutes,
         COALESCE((
           SELECT SUM(tl.duration_hours) * 60 FROM time_logs tl
           WHERE tl.item_id = pi.item_id
             AND tl.duration_hours IS NOT NULL
             AND substr(tl.started_at, 1, 10) = pi.plan_date
         ), 0) as actualMinutes
       FROM plan_items pi
       JOIN items i ON i.id = pi.item_id
       WHERE pi.plan_date >= ? AND pi.plan_date <= ?`
    )
    .all(startDate, endDate) as { reason: Reason; estimateMinutes: number; actualMinutes: number }[];

  const totals = new Map<WorkType, { estimateMinutes: number; actualMinutes: number }>();
  for (const row of rows) {
    const workType = classifyWorkType(row.reason);
    const current = totals.get(workType) ?? { estimateMinutes: 0, actualMinutes: 0 };
    totals.set(workType, {
      estimateMinutes: current.estimateMinutes + row.estimateMinutes,
      actualMinutes: current.actualMinutes + row.actualMinutes,
    });
  }

  return Array.from(totals.entries()).map(([workType, sums]) => ({
    workType,
    label: WORK_TYPE_LABEL[workType],
    ...sums,
  }));
}

// Silence over a shaky number: no estimate to compare against, or actual
// didn't exceed it, means there is nothing worth saying -- "no productivity
// grades" extends to not manufacturing a sentence when the data doesn't
// support one.
export function formatCalibrationSentence(entry: CalibrationEntry): string | null {
  if (entry.estimateMinutes <= 0) return null;
  if (entry.actualMinutes <= entry.estimateMinutes) return null;
  const overPct = Math.round(((entry.actualMinutes - entry.estimateMinutes) / entry.estimateMinutes) * 100);
  return `${entry.label} ran ${overPct}% over estimate.`;
}
