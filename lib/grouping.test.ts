import { describe, it, expect } from 'vitest';
import { groupOf, isKeptVisible, GROUP_ORDER } from './grouping';
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
