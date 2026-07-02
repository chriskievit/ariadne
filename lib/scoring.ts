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

// Due-date urgency and staleness age are independent of *why* the item
// exists, so they stack on top of the reason score rather than replacing it.
export function scoreItem(item: ScorableItem, now: Date): number {
  let score = REASON_SCORE[item.reason];

  const deadline = item.dueDate ?? item.sprintEnd;
  if (deadline) {
    const daysUntil = (new Date(deadline).getTime() - now.getTime()) / 86_400_000;
    if (daysUntil <= 2) score += 25;
  }

  if (item.rawUpdatedAt) {
    const ageDays = (now.getTime() - new Date(item.rawUpdatedAt).getTime()) / 86_400_000;
    if (ageDays > 5) score += 15;
  }

  return score;
}

export function sortByUrgency<T extends ScorableItem>(items: T[], now: Date): (T & { score: number })[] {
  return items
    .map((item) => ({ ...item, score: scoreItem(item, now) }))
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
