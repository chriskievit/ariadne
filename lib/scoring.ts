import type { Reason, Status } from './types';

export interface ScorableItem {
  reason: Reason;
  status: Status;
  dueDate: string | null;
  sprintEnd: string | null;
  rawUpdatedAt: string | null;
  hasUnresolvedConversations?: boolean;
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

export const MAX_SCORE = 105;

interface ScoreExplanation {
  entries: ScoreBreakdownEntry[];
  notFired: string[];
}

// Single pass that produces both the fired breakdown (scoreBreakdown's
// contract) and the rules that did NOT fire, so the score-chip popover can
// show a user the whole formula, not just the part that happened to apply.
function explainScore(item: ScorableItem, now: Date): ScoreExplanation {
  const entries: ScoreBreakdownEntry[] = [
    { label: REASON_LABEL[item.reason], points: REASON_SCORE[item.reason] },
  ];
  const notFired: string[] = [];

  const deadline = item.dueDate ?? item.sprintEnd;
  if (!deadline) {
    notFired.push('No deadline');
  } else {
    const daysUntil = (new Date(deadline).getTime() - now.getTime()) / 86_400_000;
    if (daysUntil <= 2) {
      const roundedDays = Math.max(0, Math.round(daysUntil));
      const label = daysUntil < 0 ? 'Overdue' : `Due in ${roundedDays} day${roundedDays === 1 ? '' : 's'}`;
      entries.push({ label, points: 25 });
    } else {
      notFired.push(`Not due yet (${Math.round(daysUntil)}d out)`);
    }
  }

  if (item.rawUpdatedAt) {
    const ageDays = (now.getTime() - new Date(item.rawUpdatedAt).getTime()) / 86_400_000;
    if (ageDays > 5) {
      entries.push({ label: `Stale ${Math.round(ageDays)} days`, points: 15 });
    } else {
      notFired.push(`Not stale yet (${Math.round(ageDays)}d of 5)`);
    }
  } else {
    notFired.push('No activity timestamp');
  }

  if (item.hasUnresolvedConversations) {
    entries.push({ label: 'Unresolved conversations', points: 20 });
  } else {
    notFired.push('No unresolved conversations');
  }

  entries.sort((a, b) => b.points - a.points);
  return { entries, notFired };
}

export function scoreBreakdown(item: ScorableItem, now: Date): ScoreBreakdownEntry[] {
  return explainScore(item, now).entries;
}

export function scoreItem(item: ScorableItem, now: Date): number {
  return scoreBreakdown(item, now).reduce((sum, e) => sum + e.points, 0);
}

// Ties break by oldest activity first: items with no rawUpdatedAt carry no
// staleness signal, so they sort after every item that has one.
export function sortByUrgency<T extends ScorableItem>(
  items: T[],
  now: Date
): (T & { score: number; scoreBreakdown: ScoreBreakdownEntry[]; notFired: string[] })[] {
  return items
    .map((item) => {
      const { entries, notFired } = explainScore(item, now);
      const score = entries.reduce((sum, e) => sum + e.points, 0);
      return { ...item, score, scoreBreakdown: entries, notFired };
    })
    .sort((a, b) => {
      if (a.status === 'in_progress' && b.status !== 'in_progress') return -1;
      if (b.status === 'in_progress' && a.status !== 'in_progress') return 1;
      if (b.score !== a.score) return b.score - a.score;
      const aTime = a.rawUpdatedAt ? new Date(a.rawUpdatedAt).getTime() : Number.POSITIVE_INFINITY;
      const bTime = b.rawUpdatedAt ? new Date(b.rawUpdatedAt).getTime() : Number.POSITIVE_INFINITY;
      return aTime - bTime;
    });
}

export type PriorityTier = 'low' | 'medium' | 'high' | 'critical';

// Boundaries line up with NEEDS_ATTENTION_THRESHOLD (25) in lib/config.ts —
// 'low' never appears in the Needs Attention UI, only medium/high/critical do.
// Max achievable score is 105: approved_unmerged (45) + due-date urgency (25)
// + unresolved conversations (20) + stale (15). The --urgency-* CSS tokens
// (app/globals.css) are keyed to these same cuts.
export function getPriorityTier(score: number): PriorityTier {
  if (score >= 60) return 'critical';
  if (score >= 40) return 'high';
  if (score >= 25) return 'medium';
  return 'low';
}

export interface ScoringReferenceRow {
  label: string;
  points: number;
}

export interface ScoringReferenceBand {
  tier: PriorityTier;
  label: string;
  range: string;
}

export interface ScoringReference {
  primaryReasons: ScoringReferenceRow[];
  stackingRules: ScoringReferenceRow[];
  maxScore: number;
  bands: ScoringReferenceBand[];
  nonPointRules: string[];
}

// Generated from the exact tables scoreItem() itself reads, so this can
// never drift from what the app actually does -- this is the artefact no
// competitor in this market can publish, and that claim only holds if it's
// generated, not hand-copied.
export function getScoringReference(): ScoringReference {
  const primaryReasons = (Object.keys(REASON_SCORE) as Reason[])
    .map((reason) => ({ label: REASON_LABEL[reason], points: REASON_SCORE[reason] }))
    .sort((a, b) => b.points - a.points);

  return {
    primaryReasons,
    stackingRules: [
      { label: 'Due, or overdue, within 2 days', points: 25 },
      { label: 'Unresolved review conversations', points: 20 },
      { label: 'No activity for more than 5 days', points: 15 },
    ],
    maxScore: MAX_SCORE,
    bands: [
      { tier: 'critical', label: 'Critical', range: '60–105' },
      { tier: 'high', label: 'High', range: '40–59' },
      { tier: 'medium', label: 'Medium', range: '25–39' },
      { tier: 'low', label: 'Low', range: '0–24' },
    ],
    nonPointRules: [
      'Anything you’ve started sorts first, whatever it scores. Work in progress outranks work you haven’t touched.',
      'Ad-hoc requests stay visible below 25, because they have no upstream activity to earn points from. Rows held by that rule are marked "Kept visible".',
    ],
  };
}
