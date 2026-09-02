import { relativeAge } from './date';
import type { Priority, Reason, Source, Status } from './types';

export interface ScorableItem {
  source: Source;
  reason: Reason;
  status: Status;
  dueDate: string | null;
  sprintEnd: string | null;
  rawUpdatedAt: string | null;
  hasUnresolvedConversations?: boolean;
  priority?: Priority | null;
  prioritySetAt?: string | null;
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

// The one term in the formula you set yourself, so it is priced to land a
// bare ad-hoc item in the band it was named after: high -> 50 (High starts
// at 40), medium -> 30 (Medium starts at 25), low -> 10 (Low). That is a
// teaching aid, not a promise -- the moment a second rule fires the totals
// move, which is why the control is labelled with its points rather than
// with the band it would produce on its own.
const PRIORITY_SCORE: Record<Priority, number> = {
  high: 40,
  medium: 20,
  low: 0,
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export const PRIORITY_ORDER: Priority[] = ['high', 'medium', 'low'];

export function priorityPoints(priority: Priority): number {
  return PRIORITY_SCORE[priority];
}

// Only ad-hoc items can carry one. Ariadne is read-only against GitHub and
// Azure DevOps, and that commitment extends to ranking: you do not get to
// hand-tune the position of work the sources gave you, only of work you
// invented. Enforced here as well as in the repo layer so a score can never
// disagree with what the row is allowed to store.
export function canCarryPriority(source: Source): boolean {
  return source === 'adhoc';
}

// 'you' marks a term the user asserted; everything else was reported by a
// source system. The score chip groups by this so a hand-set number can
// never masquerade as an observation.
export type Provenance = 'you';

export interface ScoreBreakdownEntry {
  label: string;
  points: number;
  provenance?: Provenance;
  detail?: string | null;
}

export const MAX_SCORE = 105;

// Ad-hoc items are inserted without raw_updated_at or
// has_unresolved_conversations, and only upsertSyncedItem ever writes
// either, so the +15 staleness and +20 conversations rules are structurally
// unreachable on them. Their real ceiling is 10 + 40 + 25.
export const MAX_ADHOC_SCORE = 75;

export function maxScoreFor(source: Source): number {
  return source === 'adhoc' ? MAX_ADHOC_SCORE : MAX_SCORE;
}

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
  } else if (!canCarryPriority(item.source)) {
    // An ad-hoc item can never have one, so listing it as a rule that
    // "didn't fire" reads as a defect rather than as disclosure.
    notFired.push('No activity timestamp');
  }

  if (item.hasUnresolvedConversations) {
    entries.push({ label: 'Unresolved conversations', points: 20 });
  } else if (!canCarryPriority(item.source)) {
    notFired.push('No unresolved conversations');
  }

  // Deliberately last, and only on the rows that can hold one. A low
  // priority still fires as a 0-point entry: the user made a decision and
  // the breakdown should say so, rather than reporting it as an absence.
  if (canCarryPriority(item.source)) {
    if (item.priority) {
      const age = relativeAge(item.prioritySetAt, now);
      entries.push({
        label: `You marked this ${item.priority}`,
        points: PRIORITY_SCORE[item.priority],
        provenance: 'you',
        detail: age ? `set ${age}` : null,
      });
    } else {
      notFired.push('No priority set');
    }
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

// The urgency band a score falls into. Named for what it is -- a derived
// reading -- and deliberately NOT called a priority: `priority` is the
// value the user sets by hand, and one of the two feeds the other.
export type UrgencyBand = 'low' | 'medium' | 'high' | 'critical';

// Boundaries line up with NEEDS_ATTENTION_THRESHOLD (25) in lib/config.ts —
// 'low' never appears in the Needs Attention UI, only medium/high/critical do.
// Max achievable score is 105: approved_unmerged (45) + due-date urgency (25)
// + unresolved conversations (20) + stale (15); a hand-set priority is
// excluded because it only applies to ad-hoc rows, which cap at 75 (see
// MAX_ADHOC_SCORE). The --urgency-* CSS tokens (app/globals.css) are keyed
// to these same cuts.
export function getUrgencyBand(score: number): UrgencyBand {
  if (score >= 60) return 'critical';
  if (score >= 40) return 'high';
  if (score >= 25) return 'medium';
  return 'low';
}

export const BAND_LABEL: Record<UrgencyBand, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

export interface ScoringReferenceRow {
  label: string;
  points: number;
}

export interface ScoringReferenceBand {
  tier: UrgencyBand;
  label: string;
  range: string;
}

export interface ScoringReference {
  primaryReasons: ScoringReferenceRow[];
  stackingRules: ScoringReferenceRow[];
  selfSetRules: ScoringReferenceRow[];
  maxScore: number;
  maxScoreAdhoc: number;
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
    selfSetRules: PRIORITY_ORDER.map((priority) => ({
      label: `You marked it ${priority}`,
      points: PRIORITY_SCORE[priority],
    })),
    maxScore: MAX_SCORE,
    maxScoreAdhoc: MAX_ADHOC_SCORE,
    bands: [
      { tier: 'critical', label: 'Critical', range: '60–105' },
      { tier: 'high', label: 'High', range: '40–59' },
      { tier: 'medium', label: 'Medium', range: '25–39' },
      { tier: 'low', label: 'Low', range: '0–24' },
    ],
    nonPointRules: [
      'Anything you’ve started sorts first, whatever it scores. Work in progress outranks work you haven’t touched.',
      'Starred items sort first inside their group, whatever they score. Starring is a bookmark, not a score.',
      'Ad-hoc requests stay visible below 25, because the signals that lift other rows (review activity, staleness) never reach them. Rows held by that rule are marked "Kept visible".',
      'Rows on the same score sort oldest activity first, so something that has sat untouched for a week comes before something that moved this morning.',
      'Each group shows its highest-scoring rows and collapses the rest behind "Lower scoring". The cut never splits a tie: rows on the same score are always shown together, and "Waiting on you" never collapses at all.',
    ],
  };
}
