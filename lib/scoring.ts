import type { Reason, Status } from './types';

export interface ScorableItem {
  reason: Reason;
  status: Status;
  dueDate: string | null;
  sprintEnd: string | null;
  rawUpdatedAt: string | null;
}

const REASON_SCORE: Record<Reason, number> = {
  approved_unmerged: 45,
  mention: 40,
  review_requested: 40,
  stale_own_pr: 30,
  assigned: 10,
  authored: 10,
  manual: 10,
};

export const REASON_LABEL: Record<Reason, string> = {
  approved_unmerged: 'Ready to merge',
  mention: 'Mentioned you',
  review_requested: 'Review requested',
  stale_own_pr: 'Stale — no reviews',
  assigned: 'Assigned to you',
  authored: 'Your PR',
  manual: 'Ad-hoc',
};

export interface ScoreBreakdownEntry {
  label: string;
  points: number;
}

// Due-date urgency and staleness age are independent of *why* the item
// exists, so they stack on top of the reason score rather than replacing it.
export function scoreBreakdown(item: ScorableItem, now: Date): ScoreBreakdownEntry[] {
  const entries: ScoreBreakdownEntry[] = [
    { label: REASON_LABEL[item.reason], points: REASON_SCORE[item.reason] },
  ];

  const deadline = item.dueDate ?? item.sprintEnd;
  if (deadline) {
    const daysUntil = (new Date(deadline).getTime() - now.getTime()) / 86_400_000;
    if (daysUntil <= 2) {
      const roundedDays = Math.max(0, Math.round(daysUntil));
      const label = daysUntil < 0 ? 'Overdue' : `Due in ${roundedDays} day${roundedDays === 1 ? '' : 's'}`;
      entries.push({ label, points: 25 });
    }
  }

  if (item.rawUpdatedAt) {
    const ageDays = (now.getTime() - new Date(item.rawUpdatedAt).getTime()) / 86_400_000;
    if (ageDays > 5) {
      entries.push({ label: `Stale ${Math.round(ageDays)} days`, points: 15 });
    }
  }

  return entries.sort((a, b) => b.points - a.points);
}

export function scoreItem(item: ScorableItem, now: Date): number {
  return scoreBreakdown(item, now).reduce((sum, e) => sum + e.points, 0);
}

export function sortByUrgency<T extends ScorableItem>(
  items: T[],
  now: Date
): (T & { score: number; scoreBreakdown: ScoreBreakdownEntry[] })[] {
  return items
    .map((item) => {
      const breakdown = scoreBreakdown(item, now);
      const score = breakdown.reduce((sum, e) => sum + e.points, 0);
      return { ...item, score, scoreBreakdown: breakdown };
    })
    .sort((a, b) => {
      if (a.status === 'in_progress' && b.status !== 'in_progress') return -1;
      if (b.status === 'in_progress' && a.status !== 'in_progress') return 1;
      return b.score - a.score;
    });
}

export type PriorityTier = 'low' | 'medium' | 'high' | 'critical';

// Boundaries line up with NEEDS_ATTENTION_THRESHOLD (25) in lib/config.ts —
// 'low' never appears in the Needs Attention UI, only medium/high/critical do.
export function getPriorityTier(score: number): PriorityTier {
  if (score >= 60) return 'critical';
  if (score >= 40) return 'high';
  if (score >= 25) return 'medium';
  return 'low';
}
