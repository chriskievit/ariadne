import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { scoreItem, scoreBreakdown, sortByUrgency, getPriorityTier } from './scoring';

const NOW = new Date('2026-07-02T12:00:00.000Z');

function baseItem(overrides: Partial<Parameters<typeof scoreItem>[0]> = {}) {
  return {
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

describe('getPriorityTier', () => {
  it('returns low below the needs-attention threshold', () => {
    expect(getPriorityTier(24)).toBe('low');
  });

  it('returns medium from 25 up to 39', () => {
    expect(getPriorityTier(25)).toBe('medium');
    expect(getPriorityTier(39)).toBe('medium');
  });

  it('returns high from 40 up to 59', () => {
    expect(getPriorityTier(40)).toBe('high');
    expect(getPriorityTier(59)).toBe('high');
  });

  it('returns critical at 60 and above', () => {
    expect(getPriorityTier(60)).toBe('critical');
    expect(getPriorityTier(85)).toBe('critical');
  });
});
