import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  scoreItem,
  scoreBreakdown,
  sortByUrgency,
  getUrgencyBand,
  getScoringReference,
  maxScoreFor,
} from './scoring';

const NOW = new Date('2026-07-02T12:00:00.000Z');

function explain(item: Parameters<typeof scoreItem>[0]) {
  const withScore = sortByUrgency([item], NOW)[0];
  return { entries: withScore.scoreBreakdown, notFired: withScore.notFired };
}

function baseItem(overrides: Partial<Parameters<typeof scoreItem>[0]> = {}) {
  return {
    source: 'adhoc' as const,
    reason: 'manual' as const,
    status: 'inbox' as const,
    dueDate: null,
    sprintEnd: null,
    rawUpdatedAt: null,
    ...overrides,
  };
}

describe('scoreItem', () => {
  it('scores an approved-unmerged PR highest among reasons', () => {
    expect(scoreItem(baseItem({ reason: 'approved_unmerged' }), NOW)).toBe(45);
  });

  it('scores a mention or review request at 40', () => {
    expect(scoreItem(baseItem({ reason: 'mention' }), NOW)).toBe(40);
    expect(scoreItem(baseItem({ reason: 'review_requested' }), NOW)).toBe(40);
  });

  it('scores a stale own PR at 30', () => {
    expect(scoreItem(baseItem({ reason: 'stale_own_pr' }), NOW)).toBe(30);
  });

  it('scores baseline reasons at 10', () => {
    expect(scoreItem(baseItem({ reason: 'assigned' }), NOW)).toBe(10);
    expect(scoreItem(baseItem({ reason: 'authored' }), NOW)).toBe(10);
    expect(scoreItem(baseItem({ reason: 'manual' }), NOW)).toBe(10);
  });

  it('adds 25 when the due date is within 2 days', () => {
    const score = scoreItem(baseItem({ dueDate: '2026-07-03T12:00:00.000Z' }), NOW);
    expect(score).toBe(10 + 25);
  });

  it('does not add the due-date bonus when the due date is more than 2 days out', () => {
    const score = scoreItem(baseItem({ dueDate: '2026-07-10T12:00:00.000Z' }), NOW);
    expect(score).toBe(10);
  });

  it('falls back to sprintEnd when there is no due date', () => {
    const score = scoreItem(baseItem({ sprintEnd: '2026-07-03T12:00:00.000Z' }), NOW);
    expect(score).toBe(10 + 25);
  });

  it('adds 15 when the item has been untouched for more than 5 days', () => {
    const score = scoreItem(baseItem({ rawUpdatedAt: '2026-06-20T12:00:00.000Z' }), NOW);
    expect(score).toBe(10 + 15);
  });

  it('stacks the due-date and staleness bonuses on top of the reason score', () => {
    const score = scoreItem(
      baseItem({ reason: 'review_requested', dueDate: '2026-07-03T12:00:00.000Z', rawUpdatedAt: '2026-06-20T12:00:00.000Z' }),
      NOW
    );
    expect(score).toBe(40 + 25 + 15);
  });

  it('adds 20 when the item has unresolved conversations', () => {
    const score = scoreItem(baseItem({ reason: 'review_requested', hasUnresolvedConversations: true }), NOW);
    expect(score).toBe(40 + 20);
  });

  it('stacks the unresolved-conversations bonus with the due-date and staleness bonuses', () => {
    const score = scoreItem(
      baseItem({
        reason: 'review_requested',
        dueDate: '2026-07-03T12:00:00.000Z',
        rawUpdatedAt: '2026-06-20T12:00:00.000Z',
        hasUnresolvedConversations: true,
      }),
      NOW
    );
    expect(score).toBe(40 + 25 + 15 + 20);
  });
});

describe('scoreBreakdown', () => {
  it('includes only the reason entry when there is no deadline or staleness', () => {
    const breakdown = scoreBreakdown(baseItem({ reason: 'manual' }), NOW);
    expect(breakdown).toEqual([{ label: 'Ad-hoc', points: 10 }]);
  });

  it('includes the deadline entry when the due date is within 2 days', () => {
    const breakdown = scoreBreakdown(baseItem({ dueDate: '2026-07-03T12:00:00.000Z' }), NOW);
    expect(breakdown).toEqual([
      { label: 'Due in 1 day', points: 25 },
      { label: 'Ad-hoc', points: 10 },
    ]);
  });

  it('omits the deadline entry when the due date is more than 2 days out', () => {
    const breakdown = scoreBreakdown(baseItem({ dueDate: '2026-07-10T12:00:00.000Z' }), NOW);
    expect(breakdown).toEqual([{ label: 'Ad-hoc', points: 10 }]);
  });

  it('includes the staleness entry when rawUpdatedAt is older than 5 days', () => {
    const breakdown = scoreBreakdown(baseItem({ rawUpdatedAt: '2026-06-20T12:00:00.000Z' }), NOW);
    expect(breakdown).toEqual([
      { label: 'Stale 12 days', points: 15 },
      { label: 'Ad-hoc', points: 10 },
    ]);
  });

  it('sorts entries descending by points when multiple are present', () => {
    const breakdown = scoreBreakdown(
      baseItem({
        reason: 'review_requested',
        dueDate: '2026-07-03T12:00:00.000Z',
        rawUpdatedAt: '2026-06-20T12:00:00.000Z',
      }),
      NOW
    );
    expect(breakdown).toEqual([
      { label: 'Review requested', points: 40 },
      { label: 'Due in 1 day', points: 25 },
      { label: 'Stale 12 days', points: 15 },
    ]);
  });

  it('includes the unresolved-conversations entry when hasUnresolvedConversations is true', () => {
    const breakdown = scoreBreakdown(baseItem({ reason: 'manual', hasUnresolvedConversations: true }), NOW);
    expect(breakdown).toEqual([
      { label: 'Unresolved conversations', points: 20 },
      { label: 'Ad-hoc', points: 10 },
    ]);
  });

  it('omits the unresolved-conversations entry when false or undefined', () => {
    expect(scoreBreakdown(baseItem({ reason: 'manual', hasUnresolvedConversations: false }), NOW)).toEqual([
      { label: 'Ad-hoc', points: 10 },
    ]);
    expect(scoreBreakdown(baseItem({ reason: 'manual' }), NOW)).toEqual([{ label: 'Ad-hoc', points: 10 }]);
  });

  it('sorts the unresolved-conversations entry relative to other entries by points', () => {
    const breakdown = scoreBreakdown(
      baseItem({
        reason: 'review_requested',
        dueDate: '2026-07-03T12:00:00.000Z',
        rawUpdatedAt: '2026-06-20T12:00:00.000Z',
        hasUnresolvedConversations: true,
      }),
      NOW
    );
    expect(breakdown).toEqual([
      { label: 'Review requested', points: 40 },
      { label: 'Due in 1 day', points: 25 },
      { label: 'Unresolved conversations', points: 20 },
      { label: 'Stale 12 days', points: 15 },
    ]);
  });
});

describe('sortByUrgency', () => {
  it('always ranks in_progress items above their score would otherwise place them', () => {
    const items = [
      baseItem({ reason: 'approved_unmerged' }),
      { ...baseItem({ reason: 'manual' }), status: 'in_progress' as const },
    ];
    const sorted = sortByUrgency(items, NOW);
    expect(sorted[0].status).toBe('in_progress');
  });

  it('otherwise sorts by descending score', () => {
    const items = [baseItem({ reason: 'manual' }), baseItem({ reason: 'approved_unmerged' }), baseItem({ reason: 'mention' })];
    const sorted = sortByUrgency(items, NOW);
    expect(sorted.map((i) => i.reason)).toEqual(['approved_unmerged', 'mention', 'manual']);
  });
});

describe('sortByUrgency tiebreak', () => {
  it('breaks a score tie by oldest activity first', () => {
    const items = [
      baseItem({ reason: 'assigned', rawUpdatedAt: '2026-06-25T12:00:00.000Z' }),
      baseItem({ reason: 'assigned', rawUpdatedAt: '2026-06-20T12:00:00.000Z' }),
    ];
    const sorted = sortByUrgency(items, NOW);
    expect(sorted.map((i) => i.rawUpdatedAt)).toEqual([
      '2026-06-20T12:00:00.000Z',
      '2026-06-25T12:00:00.000Z',
    ]);
  });

  it('sorts items with no timestamp after items that have one, when scores tie', () => {
    const items = [
      baseItem({ reason: 'assigned', rawUpdatedAt: null }),
      baseItem({ reason: 'assigned', rawUpdatedAt: '2026-06-20T12:00:00.000Z' }),
    ];
    const sorted = sortByUrgency(items, NOW);
    expect(sorted.map((i) => i.rawUpdatedAt)).toEqual(['2026-06-20T12:00:00.000Z', null]);
  });
});

describe('scoreBreakdown property', () => {
  it('always sums to scoreItem, for any generated item', () => {
    const reasonArb = fc.constantFrom(
      'mention', 'review_requested', 'assigned', 'authored', 'manual', 'stale_own_pr', 'approved_unmerged'
    );
    const statusArb = fc.constantFrom('inbox', 'in_progress', 'done');
    const isoDateArb = fc.option(
      fc
        .date({ min: new Date('2026-01-01'), max: new Date('2026-12-31'), noInvalidDate: true })
        .map((d) => d.toISOString()),
      { nil: null }
    );
    const itemArb = fc.record({
      source: fc.constantFrom('github_pr', 'ado_workitem', 'adhoc'),
      priority: fc.option(fc.constantFrom('low', 'medium', 'high'), { nil: null }),
      prioritySetAt: fc.option(fc.constant('2026-08-01T00:00:00.000Z'), { nil: null }),
      reason: reasonArb,
      status: statusArb,
      dueDate: isoDateArb,
      sprintEnd: isoDateArb,
      rawUpdatedAt: isoDateArb,
      hasUnresolvedConversations: fc.boolean(),
    });

    fc.assert(
      fc.property(itemArb, (item) => {
        const breakdown = scoreBreakdown(item, NOW);
        const total = breakdown.reduce((sum, e) => sum + e.points, 0);
        expect(total).toBe(scoreItem(item, NOW));
      })
    );
  });
});

describe('getUrgencyBand', () => {
  it('returns low below the needs-attention threshold', () => {
    expect(getUrgencyBand(24)).toBe('low');
  });

  it('returns medium from 25 up to 39', () => {
    expect(getUrgencyBand(25)).toBe('medium');
    expect(getUrgencyBand(39)).toBe('medium');
  });

  it('returns high from 40 up to 59', () => {
    expect(getUrgencyBand(40)).toBe('high');
    expect(getUrgencyBand(59)).toBe('high');
  });

  it('returns critical at 60 and above', () => {
    expect(getUrgencyBand(60)).toBe('critical');
    expect(getUrgencyBand(85)).toBe('critical');
  });
});

describe('getScoringReference', () => {
  it('generates the primary-reason rows from REASON_LABEL, one per reason', () => {
    const ref = getScoringReference();
    expect(ref.primaryReasons).toHaveLength(7);
    const readyToMerge = ref.primaryReasons.find((r) => r.label === 'Ready to merge');
    expect(readyToMerge?.points).toBe(45);
  });

  it('sorts primary reasons by points descending', () => {
    const ref = getScoringReference();
    const points = ref.primaryReasons.map((r) => r.points);
    expect(points).toEqual([...points].sort((a, b) => b - a));
  });

  it('includes the three stacking rules with their point values', () => {
    const ref = getScoringReference();
    expect(ref.stackingRules).toEqual([
      { label: 'Due, or overdue, within 2 days', points: 25 },
      { label: 'Unresolved review conversations', points: 20 },
      { label: 'No activity for more than 5 days', points: 15 },
    ]);
  });

  it('reports the max score and the four bands matching getPriorityTier', () => {
    const ref = getScoringReference();
    expect(ref.maxScore).toBe(105);
    expect(ref.bands).toEqual([
      { tier: 'critical', label: 'Critical', range: '60–105' },
      { tier: 'high', label: 'High', range: '40–59' },
      { tier: 'medium', label: 'Medium', range: '25–39' },
      { tier: 'low', label: 'Low', range: '0–24' },
    ]);
  });

  it('discloses all three rules that are not points, including the starred-first sort', () => {
    const ref = getScoringReference();
    expect(ref.nonPointRules).toHaveLength(3);
    expect(ref.nonPointRules[0]).toMatch(/in progress/i);
    expect(ref.nonPointRules[1]).toMatch(/starred/i);
    expect(ref.nonPointRules[2]).toMatch(/ad-hoc/i);
  });

  // The old copy claimed ad-hoc items "have no upstream activity to earn
  // points from", which stopped being true the moment priority was a way
  // to earn them.
  it('no longer claims ad-hoc items cannot earn points', () => {
    const ref = getScoringReference();
    expect(ref.nonPointRules[2]).not.toMatch(/no upstream activity to earn points/i);
  });

  it('publishes the self-set priority rows separately from the source-observed ones', () => {
    const ref = getScoringReference();
    expect(ref.selfSetRules).toEqual([
      { label: 'You marked it high', points: 40 },
      { label: 'You marked it medium', points: 20 },
      { label: 'You marked it low', points: 0 },
    ]);
  });
});

describe('manual priority', () => {
  it('adds 40 for high, 20 for medium, and nothing for low', () => {
    expect(scoreItem(baseItem({ priority: 'high' }), NOW)).toBe(10 + 40);
    expect(scoreItem(baseItem({ priority: 'medium' }), NOW)).toBe(10 + 20);
    expect(scoreItem(baseItem({ priority: 'low' }), NOW)).toBe(10);
  });

  it('lands a bare ad-hoc item in the band it was named after', () => {
    expect(getUrgencyBand(scoreItem(baseItem({ priority: 'high' }), NOW))).toBe('high');
    expect(getUrgencyBand(scoreItem(baseItem({ priority: 'medium' }), NOW))).toBe('medium');
    expect(getUrgencyBand(scoreItem(baseItem({ priority: 'low' }), NOW))).toBe('low');
  });

  it('is ignored on synced items, which cannot carry a priority', () => {
    const pr = baseItem({ source: 'github_pr', reason: 'authored', priority: 'high' });
    expect(scoreItem(pr, NOW)).toBe(10);
    expect(scoreBreakdown(pr, NOW)).toEqual([{ label: 'Your PR', points: 10 }]);
  });

  it('marks the priority entry as self-set, so the popover can separate provenance', () => {
    const breakdown = scoreBreakdown(baseItem({ priority: 'high' }), NOW);
    expect(breakdown).toEqual([
      { label: 'You marked this high', points: 40, provenance: 'you', detail: null },
      { label: 'Ad-hoc', points: 10 },
    ]);
  });

  it('carries the age of the assertion when prioritySetAt is known', () => {
    const breakdown = scoreBreakdown(
      baseItem({ priority: 'high', prioritySetAt: '2026-06-11T12:00:00.000Z' }),
      NOW
    );
    expect(breakdown[0]).toEqual({
      label: 'You marked this high',
      points: 40,
      provenance: 'you',
      detail: 'set 3 weeks ago',
    });
  });

  it('shows a low priority as a fired 0-point entry, not as an unfired rule', () => {
    const { entries, notFired } = explain(baseItem({ priority: 'low' }));
    expect(entries).toContainEqual({
      label: 'You marked this low',
      points: 0,
      provenance: 'you',
      detail: null,
    });
    expect(notFired).not.toContain('No priority set');
  });

  it('reports an unset priority as an unfired rule on ad-hoc items only', () => {
    expect(explain(baseItem()).notFired).toContain('No priority set');
    expect(explain(baseItem({ source: 'github_pr', reason: 'authored' })).notFired).not.toContain(
      'No priority set'
    );
  });

  it('stacks with a deadline, so the named band is not the band you always land in', () => {
    const score = scoreItem(baseItem({ priority: 'medium', dueDate: '2026-07-03T12:00:00.000Z' }), NOW);
    expect(score).toBe(10 + 20 + 25);
    expect(getUrgencyBand(score)).toBe('high');
  });

  it('sorts a high ad-hoc item above a review request', () => {
    const sorted = sortByUrgency(
      [
        { ...baseItem({ source: 'github_pr', reason: 'review_requested' }), id: 'pr' },
        { ...baseItem({ priority: 'high' }), id: 'adhoc' },
      ],
      NOW
    );
    expect(sorted.map((i) => i.id)).toEqual(['adhoc', 'pr']);
  });
});

describe('maxScoreFor', () => {
  // Ad-hoc items are created without raw_updated_at or unresolved
  // conversations and nothing ever sets them, so the +15 and +20 rules are
  // structurally unreachable there. Reporting "of 105" on a row capped at
  // 75 overstates the headroom.
  it('caps ad-hoc items at 75, the only rules that can actually fire', () => {
    expect(maxScoreFor('adhoc')).toBe(75);
  });

  it('leaves synced items at the full 105', () => {
    expect(maxScoreFor('github_pr')).toBe(105);
    expect(maxScoreFor('ado_workitem')).toBe(105);
  });

  it('is never exceeded by any reachable ad-hoc score', () => {
    const worst = scoreItem(
      baseItem({ priority: 'high', dueDate: '2026-07-01T12:00:00.000Z', rawUpdatedAt: null }),
      NOW
    );
    expect(worst).toBeLessThanOrEqual(maxScoreFor('adhoc'));
  });
});
