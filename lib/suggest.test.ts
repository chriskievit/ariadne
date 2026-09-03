import { describe, it, expect } from 'vitest';
import { resolveDuration, FALLBACK_MINUTES, MIN_SAMPLES_FOR_MEDIAN, type SuggestCandidate } from './suggest';

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
