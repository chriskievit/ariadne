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

// Target share of capacity for Azure DevOps work items. The control the user
// sees is this table, nothing more: no score is ever multiplied to produce a
// suggestion, because a ranking number that disagreed with the score chip on
// the same row would break the one promise this product actually makes.
export const LEAN_WORK_ITEM_SHARE: Record<LeanNotch, number> = {
  0: 0.2,
  1: 0.35,
  2: 0.5,
  3: 0.65,
  4: 0.8,
};

export const DEFAULT_LEAN: LeanNotch = 2;

export function leanCaps(capacityMinutes: number, lean: LeanNotch): Record<LeanSide, number> {
  const workItem = Math.round(capacityMinutes * LEAN_WORK_ITEM_SHARE[lean]);
  return { work_item: workItem, pr: capacityMinutes - workItem };
}

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

export interface SuggestedPick {
  itemId: number;
  durationMinutes: number;
  durationSource: DurationSource;
  pickReason: PickReason;
}

export interface ExcludedCandidate {
  itemId: number;
  durationMinutes: number;
  durationSource: DurationSource;
  exclusionReason: ExclusionReason;
}

export interface SuggestInput {
  // Already in sortByUrgency() order. suggestDay never re-sorts for 'urgency'.
  candidates: SuggestCandidate[];
  capacityMinutes: number;
  algorithm: SuggestAlgorithm;
  lean: LeanNotch;
  medians: Partial<Record<WorkType, WorkTypeDuration>>;
  priorEstimates: Map<number, number>;
  // How many items the caller excluded from the pool solely because they are
  // already in today's plan. The only way to tell "Signals is empty" apart
  // from "you have already planned all of it" without re-querying.
  pinnedTodayCount: number;
  now: Date;
}

export interface Suggestion {
  algorithm: SuggestAlgorithm;
  lean: LeanNotch;
  capacityMinutes: number;
  suggestedMinutes: number;
  picks: SuggestedPick[];
  didNotFit: ExcludedCandidate[];
  deferredByLean: ExcludedCandidate[];
  degradedToQuickWins: boolean;
  durationsAreRough: boolean;
  note: SuggestionNote | null;
}

interface Sized extends SuggestCandidate {
  durationMinutes: number;
  durationSource: DurationSource;
}

interface PassState {
  remaining: number;
  committed: Record<LeanSide, number>;
  picks: SuggestedPick[];
  deferred: Sized[];
  didNotFit: Sized[];
}

// Ad-hoc items return null: they are exempt from the lean and are never
// counted toward either side of the split.
function leanSide(source: Source): LeanSide | null {
  if (source === 'github_pr') return 'pr';
  if (source === 'ado_workitem') return 'work_item';
  return null;
}

// Ties break by score, then by oldest activity first, matching
// sortByUrgency()'s tiebreak so two equal candidates never reorder between
// the Suggested and All signals views. Rows with no activity timestamp carry
// no staleness signal and sort last.
function byValueDensity(a: Sized, b: Sized): number {
  const densityA = a.score / a.durationMinutes;
  const densityB = b.score / b.durationMinutes;
  if (densityB !== densityA) return densityB - densityA;
  if (b.score !== a.score) return b.score - a.score;
  const timeA = a.rawUpdatedAt ? new Date(a.rawUpdatedAt).getTime() : Number.POSITIVE_INFINITY;
  const timeB = b.rawUpdatedAt ? new Date(b.rawUpdatedAt).getTime() : Number.POSITIVE_INFINITY;
  return timeA - timeB;
}

function take(state: PassState, item: Sized, pickReason: PickReason): void {
  state.picks.push({
    itemId: item.id,
    durationMinutes: item.durationMinutes,
    durationSource: item.durationSource,
    pickReason,
  });
  state.remaining -= item.durationMinutes;
  const side = leanSide(item.source);
  if (side) state.committed[side] += item.durationMinutes;
}

function excluded(item: Sized, exclusionReason: ExclusionReason): ExcludedCandidate {
  return {
    itemId: item.id,
    durationMinutes: item.durationMinutes,
    durationSource: item.durationSource,
    exclusionReason,
  };
}

// True when a later entry in this ordering sits on the other side of the
// split and would fit the room that is left. This look-ahead is what makes a
// cap self-lifting: the lean should shape a mix, never leave the day empty
// because one side ran out of work.
function otherSideStillHasAFit(order: Sized[], fromIndex: number, side: LeanSide, remaining: number): boolean {
  for (let i = fromIndex; i < order.length; i += 1) {
    const other = leanSide(order[i].source);
    if (other && other !== side && order[i].durationMinutes <= remaining) return true;
  }
  return false;
}

// One greedy pass over an ordering, applying the lean as a soft cap.
// Candidates the cap holds back land in state.deferred, and stay there: one
// pass, no retry. Deferring can leave part of the day unspent, and the
// instinct is to reclaim it, but unspent capacity sitting next to a
// "Deferred by your lean" disclosure is the clearest possible report of what
// the control just did. A retry that took the candidate anyway would make
// that list almost always empty, and the lean would feel inert. The lean is
// allowed to cost the user some minutes; it is not allowed to do so
// invisibly.
function runPass(
  state: PassState,
  order: Sized[],
  pickReason: PickReason,
  caps: Record<LeanSide, number>
): void {
  order.forEach((item, index) => {
    if (item.durationMinutes > state.remaining) {
      state.didNotFit.push(item);
      return;
    }

    const side = leanSide(item.source);
    if (
      side &&
      state.committed[side] + item.durationMinutes > caps[side] &&
      otherSideStillHasAFit(order, index + 1, side, state.remaining)
    ) {
      state.deferred.push(item);
      return;
    }

    take(state, item, pickReason);
  });
}

// The highest-scoring candidate long enough to be a day's anchor, provided it
// fits. Scans in the caller's order so a score tie resolves the same way
// sortByUrgency() already resolved it.
function pickAnchor(order: Sized[], capacityMinutes: number): Sized | null {
  let best: Sized | null = null;
  for (const item of order) {
    if (item.durationMinutes < ANCHOR_MIN_MINUTES) continue;
    if (item.durationMinutes > capacityMinutes) continue;
    if (!best || item.score > best.score) best = item;
  }
  return best;
}

/**
 * Propose a day. Pure, and deliberately so: every rule here is a unit test
 * away from being checked, which is the only reason a feature that recommends
 * work belongs in a product whose thesis is that its ranking is inspectable.
 *
 * Never overfills. The returned picks always sum to at most capacityMinutes.
 */
export function suggestDay(input: SuggestInput): Suggestion {
  const { candidates, capacityMinutes, algorithm, lean, medians, priorEstimates, pinnedTodayCount } = input;

  const sizedCandidates: Sized[] = candidates.map((item) => {
    const { minutes, source } = resolveDuration(item, medians, priorEstimates);
    return { ...item, durationMinutes: minutes, durationSource: source };
  });

  const durationsAreRough = !Object.values(medians).some(
    (median) => median !== undefined && median.sampleCount >= MIN_SAMPLES_FOR_MEDIAN
  );

  const empty: Suggestion = {
    algorithm,
    lean,
    capacityMinutes,
    suggestedMinutes: 0,
    picks: [],
    didNotFit: [],
    deferredByLean: [],
    degradedToQuickWins: false,
    durationsAreRough,
    note: null,
  };

  if (sizedCandidates.length === 0) {
    return { ...empty, note: pinnedTodayCount > 0 ? 'all_pinned' : 'signals_empty' };
  }

  const state: PassState = {
    remaining: capacityMinutes,
    committed: { pr: 0, work_item: 0 },
    picks: [],
    deferred: [],
    didNotFit: [],
  };

  const caps = leanCaps(capacityMinutes, lean);

  let degradedToQuickWins = false;

  if (algorithm === 'urgency') {
    runPass(state, sizedCandidates, 'top_urgency', caps);
  } else if (algorithm === 'quick_wins') {
    runPass(state, [...sizedCandidates].sort(byValueDensity), 'best_value', caps);
  } else {
    const anchor = pickAnchor(sizedCandidates, capacityMinutes);
    if (anchor) {
      // The anchor takes no cap check by design: it is the one pick this
      // strategy is named for, and capping it away would leave Balanced with
      // nothing to anchor on.
      take(state, anchor, 'anchor');
      const rest = sizedCandidates.filter((item) => item.id !== anchor.id).sort(byValueDensity);
      runPass(state, rest, 'fills_room', caps);
    } else {
      // No long item on the list, so this genuinely ran quick wins. Say so
      // rather than presenting it as an anchored plan.
      degradedToQuickWins = true;
      runPass(state, [...sizedCandidates].sort(byValueDensity), 'best_value', caps);
    }
  }

  const didNotFit = state.didNotFit.map((item) => excluded(item, 'did_not_fit'));
  const deferredByLean: ExcludedCandidate[] = [];
  for (const item of state.deferred) {
    // There was room and the lean is the only reason it is not on the list.
    // Anything that no longer fits is reported for what it is instead.
    if (item.durationMinutes <= state.remaining) {
      deferredByLean.push(excluded(item, 'deferred_by_lean'));
    } else {
      didNotFit.push(excluded(item, 'did_not_fit'));
    }
  }

  const suggestedMinutes = state.picks.reduce((sum, pick) => sum + pick.durationMinutes, 0);

  let note: SuggestionNote | null = null;
  if (state.picks.length === 0) {
    note = 'capacity_too_small';
  } else if (state.remaining > 0 && didNotFit.length > 0 && deferredByLean.length === 0) {
    note = 'nothing_else_fits';
  }

  return {
    algorithm,
    lean,
    capacityMinutes,
    suggestedMinutes,
    picks: state.picks,
    didNotFit,
    deferredByLean,
    degradedToQuickWins,
    durationsAreRough,
    note,
  };
}

/**
 * Whether an item can be suggested for a given day.
 *
 * A pure predicate rather than an inline filter in the API route, so the pool
 * rules are unit-testable alongside every other rule in the engine. An item
 * silently missing from a proposal is the hardest kind of bug to notice.
 *
 * Note the in-progress case: an in-progress item that is not in today's plan
 * is a legitimate candidate, because Today and In-progress are independent
 * axes in this product, not one bucket each.
 */
export function isSuggestCandidate(item: Item, today: string, now: Date): boolean {
  if (item.status === 'done') return false;
  if (item.status === 'in_progress' && item.parked) return false;
  if (item.triageState === 'done') return false;
  if (item.snoozedUntil !== null && item.snoozedUntil > now.toISOString()) return false;
  // Already planned for today, so re-suggesting it would propose work the
  // user has already committed to.
  if (item.todayDate === today) return false;
  return true;
}
