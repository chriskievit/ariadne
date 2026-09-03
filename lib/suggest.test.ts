import { describe, it, expect } from 'vitest';
import {
  resolveDuration,
  suggestDay,
  ANCHOR_MIN_MINUTES,
  FALLBACK_MINUTES,
  MIN_SAMPLES_FOR_MEDIAN,
  type SuggestCandidate,
  type SuggestInput,
} from './suggest';

function candidate(overrides: Partial<SuggestCandidate> = {}): SuggestCandidate {
  return {
    id: 1,
    source: 'github_pr',
    reason: 'review_requested',
    status: 'inbox',
    score: 40,
    rawUpdatedAt: '2026-09-01T09:00:00.000Z',
    estimateMinutes: null,
    ...overrides,
  };
}

describe('resolveDuration', () => {
  it("uses today's estimate when the item has one", () => {
    expect(resolveDuration(candidate({ estimateMinutes: 90 }), {}, new Map())).toEqual({
      minutes: 90,
      source: 'plan_estimate',
    });
  });

  it('falls back to an estimate the item carried on an earlier plan date', () => {
    expect(resolveDuration(candidate(), {}, new Map([[1, 75]]))).toEqual({
      minutes: 75,
      source: 'prior_estimate',
    });
  });

  it("prefers today's estimate over an earlier one", () => {
    expect(resolveDuration(candidate({ estimateMinutes: 90 }), {}, new Map([[1, 75]]))).toEqual({
      minutes: 90,
      source: 'plan_estimate',
    });
  });

  it('uses the logged median for the work type once there are enough samples', () => {
    const medians = { review: { medianMinutes: 37, sampleCount: MIN_SAMPLES_FOR_MEDIAN } };
    expect(resolveDuration(candidate(), medians, new Map())).toEqual({
      minutes: 37,
      source: 'logged_median',
    });
  });

  it('ignores a median below the sample floor and uses the fallback', () => {
    const medians = { review: { medianMinutes: 37, sampleCount: MIN_SAMPLES_FOR_MEDIAN - 1 } };
    expect(resolveDuration(candidate(), medians, new Map())).toEqual({
      minutes: FALLBACK_MINUTES.review,
      source: 'fallback',
    });
  });

  it('prefers an earlier estimate over the logged median', () => {
    const medians = { review: { medianMinutes: 37, sampleCount: 10 } };
    expect(resolveDuration(candidate(), medians, new Map([[1, 75]]))).toEqual({
      minutes: 75,
      source: 'prior_estimate',
    });
  });

  it('rounds a fractional median to whole minutes', () => {
    const medians = { review: { medianMinutes: 37.6, sampleCount: 5 } };
    expect(resolveDuration(candidate(), medians, new Map()).minutes).toBe(38);
  });

  it('classifies an ad-hoc item into the ad_hoc fallback', () => {
    const adhoc = candidate({ source: 'adhoc', reason: 'manual' });
    expect(resolveDuration(adhoc, {}, new Map())).toEqual({
      minutes: FALLBACK_MINUTES.ad_hoc,
      source: 'fallback',
    });
  });
});

const NOW = new Date('2026-09-03T09:00:00.000Z');

function input(overrides: Partial<SuggestInput> = {}): SuggestInput {
  return {
    candidates: [],
    capacityMinutes: 360,
    algorithm: 'urgency',
    lean: 2,
    medians: {},
    priorEstimates: new Map(),
    pinnedTodayCount: 0,
    now: NOW,
    ...overrides,
  };
}

// Every candidate carries an explicit estimate so these tests exercise the
// strategies rather than the duration fallbacks, which the resolveDuration
// tests already cover.
function sized(id: number, score: number, minutes: number, overrides: Partial<SuggestCandidate> = {}) {
  return candidate({ id, score, estimateMinutes: minutes, ...overrides });
}

describe('suggestDay', () => {
  it('reports an empty Signals list when there is nothing to suggest', () => {
    const result = suggestDay(input());
    expect(result.picks).toEqual([]);
    expect(result.note).toBe('signals_empty');
  });

  it('reports that everything is already planned when the pool is empty but items are pinned', () => {
    expect(suggestDay(input({ pinnedTodayCount: 3 })).note).toBe('all_pinned');
  });

  it('takes candidates in the given order for urgency, and never overfills', () => {
    const result = suggestDay(
      input({
        capacityMinutes: 120,
        candidates: [sized(1, 65, 90), sized(2, 45, 60), sized(3, 40, 30)],
      })
    );
    expect(result.picks.map((p) => p.itemId)).toEqual([1, 3]);
    expect(result.suggestedMinutes).toBe(120);
    expect(result.picks.every((p) => p.pickReason === 'top_urgency')).toBe(true);
  });

  it('reports an item that did not fit', () => {
    const result = suggestDay(
      input({ capacityMinutes: 60, candidates: [sized(1, 65, 90), sized(2, 45, 60)] })
    );
    expect(result.picks.map((p) => p.itemId)).toEqual([2]);
    expect(result.didNotFit.map((c) => c.itemId)).toEqual([1]);
    expect(result.didNotFit[0].exclusionReason).toBe('did_not_fit');
  });

  it('orders quick wins by score per minute', () => {
    const result = suggestDay(
      input({
        algorithm: 'quick_wins',
        capacityMinutes: 600,
        // Densities: 65/120 = 0.54, 45/30 = 1.5, 40/45 = 0.89
        candidates: [sized(1, 65, 120), sized(2, 45, 30), sized(3, 40, 45)],
      })
    );
    expect(result.picks.map((p) => p.itemId)).toEqual([2, 3, 1]);
    expect(result.picks.every((p) => p.pickReason === 'best_value')).toBe(true);
  });

  it('breaks a density tie by score, then by oldest activity first', () => {
    const result = suggestDay(
      input({
        algorithm: 'quick_wins',
        capacityMinutes: 600,
        candidates: [
          sized(1, 40, 40, { rawUpdatedAt: '2026-09-02T09:00:00.000Z' }),
          sized(2, 40, 40, { rawUpdatedAt: '2026-08-20T09:00:00.000Z' }),
          sized(3, 60, 60),
        ],
      })
    );
    // All three sit at density 1.0, so score wins first, then the older row.
    expect(result.picks.map((p) => p.itemId)).toEqual([3, 2, 1]);
  });

  it('anchors balanced on the highest-scoring long item, then fills with quick wins', () => {
    const result = suggestDay(
      input({
        algorithm: 'balanced',
        capacityMinutes: 300,
        candidates: [sized(1, 45, 30), sized(2, 65, 120), sized(3, 40, 45)],
      })
    );
    expect(result.picks[0]).toMatchObject({ itemId: 2, pickReason: 'anchor' });
    expect(result.picks.slice(1).map((p) => p.itemId)).toEqual([1, 3]);
    expect(result.picks.slice(1).every((p) => p.pickReason === 'fills_room')).toBe(true);
    expect(result.degradedToQuickWins).toBe(false);
  });

  it('degrades balanced to quick wins when nothing is long enough to anchor', () => {
    const result = suggestDay(
      input({
        algorithm: 'balanced',
        capacityMinutes: 300,
        candidates: [sized(1, 45, ANCHOR_MIN_MINUTES - 1), sized(2, 65, 30)],
      })
    );
    expect(result.degradedToQuickWins).toBe(true);
    expect(result.picks.every((p) => p.pickReason === 'best_value')).toBe(true);
  });

  it('takes no anchor when the only long item does not fit capacity', () => {
    const result = suggestDay(
      input({
        algorithm: 'balanced',
        capacityMinutes: 60,
        candidates: [sized(1, 65, 240), sized(2, 40, 30)],
      })
    );
    expect(result.degradedToQuickWins).toBe(true);
    expect(result.picks.map((p) => p.itemId)).toEqual([2]);
  });

  it('reports capacity too small when nothing at all fits', () => {
    const result = suggestDay(input({ capacityMinutes: 15, candidates: [sized(1, 65, 90)] }));
    expect(result.picks).toEqual([]);
    expect(result.note).toBe('capacity_too_small');
  });

  it('reports that nothing else fits when room is left over', () => {
    const result = suggestDay(
      input({ capacityMinutes: 100, candidates: [sized(1, 65, 60), sized(2, 45, 90)] })
    );
    expect(result.picks.map((p) => p.itemId)).toEqual([1]);
    expect(result.note).toBe('nothing_else_fits');
  });

  it('leaves the note unset when capacity is spent exactly', () => {
    const result = suggestDay(input({ capacityMinutes: 60, candidates: [sized(1, 65, 60)] }));
    expect(result.note).toBeNull();
  });

  it('flags rough durations only when no work type reaches the sample floor', () => {
    const candidates = [sized(1, 65, 60)];
    expect(suggestDay(input({ candidates })).durationsAreRough).toBe(true);
    expect(
      suggestDay(
        input({ candidates, medians: { review: { medianMinutes: 30, sampleCount: MIN_SAMPLES_FOR_MEDIAN } } })
      ).durationsAreRough
    ).toBe(false);
  });

  it('echoes the algorithm, lean, and capacity it was asked for', () => {
    const result = suggestDay(input({ algorithm: 'quick_wins', lean: 4, capacityMinutes: 240 }));
    expect(result).toMatchObject({ algorithm: 'quick_wins', lean: 4, capacityMinutes: 240 });
  });
});
