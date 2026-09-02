import { describe, it, expect } from 'vitest';
import { groupOf, isKeptVisible, needsYou, GROUP_ORDER, sortStarredFirst } from './grouping';
import type { Reason } from './types';

const ALL_REASONS: Reason[] = [
  'mention', 'review_requested', 'assigned', 'authored', 'manual', 'stale_own_pr', 'approved_unmerged',
];

function item(overrides: { source?: 'github_pr' | 'ado_workitem' | 'adhoc'; adoStatus?: string | null; reason: Reason }) {
  return { source: 'github_pr' as const, adoStatus: null, ...overrides };
}

describe('groupOf', () => {
  it('is total over every Reason', () => {
    for (const reason of ALL_REASONS) {
      expect(GROUP_ORDER).toContain(groupOf(item({ reason })));
    }
  });

  it('puts review_requested, mention, and approved_unmerged in waiting_on_you', () => {
    expect(groupOf(item({ reason: 'review_requested' }))).toBe('waiting_on_you');
    expect(groupOf(item({ reason: 'mention' }))).toBe('waiting_on_you');
    expect(groupOf(item({ reason: 'approved_unmerged' }))).toBe('waiting_on_you');
  });

  it('puts stale_own_pr and authored in moving_without_you', () => {
    expect(groupOf(item({ reason: 'stale_own_pr' }))).toBe('moving_without_you');
    expect(groupOf(item({ reason: 'authored' }))).toBe('moving_without_you');
  });

  it('puts assigned and manual in lower_priority', () => {
    expect(groupOf(item({ reason: 'assigned' }))).toBe('lower_priority');
    expect(groupOf(item({ reason: 'manual' }))).toBe('lower_priority');
  });

  it('classifies an ADO item whose state matches /block/ as blocked, regardless of reason', () => {
    expect(groupOf(item({ source: 'ado_workitem', adoStatus: 'Blocked', reason: 'assigned' }))).toBe('blocked');
  });

  it('blocked outranks waiting_on_you when both would otherwise apply', () => {
    expect(groupOf(item({ source: 'ado_workitem', adoStatus: 'Blocked', reason: 'approved_unmerged' }))).toBe('blocked');
  });

  it('a non-blocked ADO state does not trigger the blocked group', () => {
    expect(groupOf(item({ source: 'ado_workitem', adoStatus: 'In Progress', reason: 'assigned' }))).toBe('lower_priority');
  });
});

describe('needsYou', () => {
  it('is true for every waiting_on_you reason', () => {
    expect(needsYou(item({ reason: 'review_requested' }))).toBe(true);
    expect(needsYou(item({ reason: 'mention' }))).toBe(true);
    expect(needsYou(item({ reason: 'approved_unmerged' }))).toBe(true);
  });

  it('is true for a blocked item, whatever its reason', () => {
    expect(needsYou(item({ source: 'ado_workitem', adoStatus: 'Blocked', reason: 'assigned' }))).toBe(true);
  });

  it('is false for moving_without_you and lower_priority', () => {
    expect(needsYou(item({ reason: 'stale_own_pr' }))).toBe(false);
    expect(needsYou(item({ reason: 'authored' }))).toBe(false);
    expect(needsYou(item({ reason: 'assigned' }))).toBe(false);
    expect(needsYou(item({ reason: 'manual' }))).toBe(false);
  });

  it('agrees with groupOf for every reason', () => {
    for (const reason of ALL_REASONS) {
      const group = groupOf(item({ reason }));
      expect(needsYou(item({ reason }))).toBe(group === 'waiting_on_you' || group === 'blocked');
    }
  });
});

describe('isKeptVisible', () => {
  it('is true for an ad-hoc item scoring below the needs-attention threshold', () => {
    expect(isKeptVisible({ source: 'adhoc' }, 10)).toBe(true);
  });

  it('is false for an ad-hoc item scoring at or above the threshold', () => {
    expect(isKeptVisible({ source: 'adhoc' }, 25)).toBe(false);
  });

  it('is false for a non-ad-hoc item, regardless of score', () => {
    expect(isKeptVisible({ source: 'github_pr' }, 5)).toBe(false);
  });
});

describe('sortStarredFirst', () => {
  it('lifts starred items above unstarred ones', () => {
    const sorted = sortStarredFirst([
      { id: 1, starred: false },
      { id: 2, starred: true },
      { id: 3, starred: false },
    ]);
    expect(sorted.map((i) => i.id)).toEqual([2, 1, 3]);
  });

  // This is what makes the rule safe to layer on top of sortByUrgency: it
  // only moves starred rows, it never reshuffles the score order underneath.
  it('preserves the incoming order within each half', () => {
    const sorted = sortStarredFirst([
      { id: 1, starred: true },
      { id: 2, starred: false },
      { id: 3, starred: true },
      { id: 4, starred: false },
    ]);
    expect(sorted.map((i) => i.id)).toEqual([1, 3, 2, 4]);
  });

  it('does not mutate the array it was given', () => {
    const input = [
      { id: 1, starred: false },
      { id: 2, starred: true },
    ];
    sortStarredFirst(input);
    expect(input.map((i) => i.id)).toEqual([1, 2]);
  });

  it('leaves a list with no stars untouched', () => {
    const input = [
      { id: 1, starred: false },
      { id: 2, starred: false },
    ];
    expect(sortStarredFirst(input).map((i) => i.id)).toEqual([1, 2]);
  });
});
