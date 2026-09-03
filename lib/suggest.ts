import { classifyWorkType, type WorkType } from './calibration';
import type { ScoreBreakdownEntry } from './scoring';
import type { Item, Reason, Source, Status } from './types';

export type SuggestAlgorithm = 'urgency' | 'quick_wins' | 'balanced';

// 0 leans hardest toward pull requests, 4 hardest toward work items, 2 is
// neutral. Discrete notches rather than a continuous value because the
// mechanism is a soft cap, and a slider would imply a precision it does not
// have.
export type LeanNotch = 0 | 1 | 2 | 3 | 4;

export type DurationSource = 'plan_estimate' | 'prior_estimate' | 'logged_median' | 'fallback';

export type PickReason = 'anchor' | 'top_urgency' | 'best_value' | 'fills_room';

export type ExclusionReason = 'did_not_fit' | 'deferred_by_lean';

export type SuggestionNote = 'signals_empty' | 'all_pinned' | 'capacity_too_small' | 'nothing_else_fits';

// Which side of the pull-request / work-item split an item sits on. Ad-hoc
// items sit on neither and are exempt from the lean entirely.
export type LeanSide = 'pr' | 'work_item';

// What the panel needs to render a row: an item plus the three fields
// sortByUrgency() adds. Deliberately narrower than dashboard.ts's ScoredItem,
// which also carries links, estimates, and logged time the panel never reads.
export type SuggestionItem = Item & {
  score: number;
  scoreBreakdown: ScoreBreakdownEntry[];
  notFired: string[];
};

export interface SuggestCandidate {
  id: number;
  source: Source;
  reason: Reason;
  status: Status;
  score: number;
  rawUpdatedAt: string | null;
  estimateMinutes: number | null;
}

export interface WorkTypeDuration {
  medianMinutes: number;
  sampleCount: number;
}

export interface ResolvedDuration {
  minutes: number;
  source: DurationSource;
}

// Below this many logged samples a work type's median is noise, so the fixed
// default is the more honest number.
export const MIN_SAMPLES_FOR_MEDIAN = 3;

export const FALLBACK_MINUTES: Record<WorkType, number> = {
  review: 30,
  own_work: 90,
  assigned: 120,
  ad_hoc: 45,
};

// What counts as "a long item" for the Balanced anchor.
export const ANCHOR_MIN_MINUTES = 60;

/**
 * How long this item is likely to take, and where that number came from.
 *
 * Provenance travels with the number because the panel renders the two kinds
 * differently: a duration the user set is stated plainly, a derived one is
 * marked. A guessed number that looks like a stated one is the single most
 * misleading thing this feature could do.
 */
export function resolveDuration(
  candidate: SuggestCandidate,
  medians: Partial<Record<WorkType, WorkTypeDuration>>,
  priorEstimates: Map<number, number>
): ResolvedDuration {
  if (candidate.estimateMinutes !== null && candidate.estimateMinutes > 0) {
    return { minutes: candidate.estimateMinutes, source: 'plan_estimate' };
  }

  // Carried-over work keeps the size the user already gave it, rather than
  // being re-guessed from a bucket average.
  const prior = priorEstimates.get(candidate.id);
  if (prior !== undefined && prior > 0) {
    return { minutes: prior, source: 'prior_estimate' };
  }

  const workType = classifyWorkType(candidate.reason);
  const median = medians[workType];
  if (median && median.sampleCount >= MIN_SAMPLES_FOR_MEDIAN && median.medianMinutes > 0) {
    return { minutes: Math.round(median.medianMinutes), source: 'logged_median' };
  }

  return { minutes: FALLBACK_MINUTES[workType], source: 'fallback' };
}
