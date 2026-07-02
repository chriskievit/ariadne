import { describe, it, expect } from 'vitest';
import { scoreItem, sortByUrgency, getPriorityTier } from './scoring';

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
