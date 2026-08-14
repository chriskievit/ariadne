import { describe, it, expect } from 'vitest';
import { parseQuery, applyQuery, stateOf, withoutFilter } from './query';
import type { ScoredItem } from './dashboard';

const NOW = new Date('2026-08-14T12:00:00.000Z');

function item(overrides: Partial<ScoredItem> = {}): ScoredItem {
  return {
    id: 1,
    source: 'github_pr',
    externalId: null,
    title: 'Fix the flaky test',
    url: null,
    reason: 'review_requested',
    category: null,
    dueDate: null,
    sprintIteration: null,
    rawUpdatedAt: '2026-08-14T00:00:00.000Z',
    status: 'inbox',
    createdAt: '2026-08-14T00:00:00.000Z',
    completedAt: null,
    adoStatus: null,
    prStatus: null,
    repo: 'widgets',
    hasUnresolvedConversations: false,
    parked: false,
    todayDate: null,
    starred: false,
    snoozedUntil: null,
    triageState: 'none',
    wokeEarly: false,
    score: 40,
    scoreBreakdown: [],
    notFired: [],
    links: [],
    estimateMinutes: null,
    loggedMinutesToday: 0,
    ...overrides,
  };
}

const context = { now: NOW, currentSprintIteration: 'Sprint 42' };

describe('parseQuery', () => {
  it('parses a source filter with comma-OR values', () => {
    const parsed = parseQuery('source:github,adhoc');
    expect(parsed.errors).toEqual([]);
    expect(parsed.filters).toEqual([{ prefix: 'source', values: ['github', 'adhoc'], negate: false }]);
  });

  it('parses negation', () => {
    const parsed = parseQuery('-is:snoozed');
    expect(parsed.filters).toEqual([{ prefix: 'is', values: ['snoozed'], negate: true }]);
  });

  it('collects bare words separately from prefixed filters', () => {
    const parsed = parseQuery('source:github rotated pages');
    expect(parsed.bareWords).toEqual(['rotated', 'pages']);
    expect(parsed.filters).toEqual([{ prefix: 'source', values: ['github'], negate: false }]);
  });

  it('reports an error and keeps everything else for an unknown prefix', () => {
    const parsed = parseQuery('bogus:value source:github');
    expect(parsed.errors.length).toBe(1);
    expect(parsed.filters).toEqual([{ prefix: 'source', values: ['github'], negate: false }]);
  });

  it('reports an error for a malformed score comparator', () => {
    const parsed = parseQuery('score:>>25');
    expect(parsed.errors.length).toBe(1);
  });

  it('parses a score range', () => {
    const parsed = parseQuery('score:40..105');
    expect(parsed.filters).toEqual([{ prefix: 'score', values: ['40..105'], negate: false }]);
  });

  it('reports an error for an unknown reason key', () => {
    const parsed = parseQuery('reason:not_a_real_reason');
    expect(parsed.errors.length).toBe(1);
  });

  it('parses every documented prefix without error', () => {
    const queries = [
      'source:github',
      'group:waiting',
      'state:review',
      'score:>50',
      'score:<30',
      'repo:widgets',
      'sprint:current',
      'sprint:42',
      'is:starred',
      'stale:>5d',
      'reason:approved_unmerged',
    ];
    for (const q of queries) {
      expect(parseQuery(q).errors).toEqual([]);
    }
  });
});

describe('applyQuery', () => {
  it('filters by source', () => {
    const items = [item({ id: 1, source: 'github_pr' }), item({ id: 2, source: 'ado_workitem' })];
    const result = applyQuery(items, parseQuery('source:github'), context);
    expect(result.map((i) => i.id)).toEqual([1]);
  });

  it('filters by score comparator', () => {
    const items = [item({ id: 1, score: 60 }), item({ id: 2, score: 10 })];
    expect(applyQuery(items, parseQuery('score:>50'), context).map((i) => i.id)).toEqual([1]);
    expect(applyQuery(items, parseQuery('score:<30'), context).map((i) => i.id)).toEqual([2]);
  });

  it('filters by score range', () => {
    const items = [item({ id: 1, score: 45 }), item({ id: 2, score: 10 })];
    expect(applyQuery(items, parseQuery('score:40..105'), context).map((i) => i.id)).toEqual([1]);
  });

  it('negates a filter', () => {
    const items = [item({ id: 1, snoozedUntil: '2027-01-01T00:00:00.000Z' }), item({ id: 2, snoozedUntil: null })];
    expect(applyQuery(items, parseQuery('-is:snoozed'), context).map((i) => i.id)).toEqual([2]);
  });

  it('applies bare-word title matching alongside a prefix filter', () => {
    const items = [item({ id: 1, title: 'Fix the flaky test' }), item({ id: 2, title: 'Add a new endpoint' })];
    expect(applyQuery(items, parseQuery('source:github flaky'), context).map((i) => i.id)).toEqual([1]);
  });

  it('matches is:stale using the default staleness window', () => {
    const items = [
      item({ id: 1, rawUpdatedAt: '2026-08-01T00:00:00.000Z' }),
      item({ id: 2, rawUpdatedAt: '2026-08-14T00:00:00.000Z' }),
    ];
    expect(applyQuery(items, parseQuery('is:stale'), context).map((i) => i.id)).toEqual([1]);
  });

  it('matches stale:>Nd', () => {
    const items = [
      item({ id: 1, rawUpdatedAt: '2026-08-01T00:00:00.000Z' }),
      item({ id: 2, rawUpdatedAt: '2026-08-13T00:00:00.000Z' }),
    ];
    expect(applyQuery(items, parseQuery('stale:>5d'), context).map((i) => i.id)).toEqual([1]);
  });

  it('matches sprint:current against the supplied current iteration', () => {
    const items = [item({ id: 1, sprintIteration: 'Sprint 42' }), item({ id: 2, sprintIteration: 'Sprint 41' })];
    expect(applyQuery(items, parseQuery('sprint:current'), context).map((i) => i.id)).toEqual([1]);
  });

  it('matches sprint:current against a full ADO iteration path ending in the current sprint name', () => {
    const items = [
      item({ id: 1, sprintIteration: 'Project\\Sprint 42' }),
      item({ id: 2, sprintIteration: 'Project\\Sprint 41' }),
    ];
    expect(applyQuery(items, parseQuery('sprint:current'), context).map((i) => i.id)).toEqual([1]);
  });

  it('returns items unchanged for an empty query', () => {
    const items = [item({ id: 1 }), item({ id: 2 })];
    expect(applyQuery(items, parseQuery(''), context).map((i) => i.id)).toEqual([1, 2]);
  });
});

describe('stateOf', () => {
  it('maps a draft PR to draft', () => {
    expect(stateOf({ source: 'github_pr', adoStatus: null, prStatus: 'draft' })).toBe('draft');
  });

  it('maps a ready-for-review PR to review', () => {
    expect(stateOf({ source: 'github_pr', adoStatus: null, prStatus: 'ready_for_review' })).toBe('review');
  });

  it('maps a blocked ADO state to blocked', () => {
    expect(stateOf({ source: 'ado_workitem', adoStatus: 'Blocked', prStatus: null })).toBe('blocked');
  });

  it('maps an active ADO state to progress', () => {
    expect(stateOf({ source: 'ado_workitem', adoStatus: 'Active', prStatus: null })).toBe('progress');
  });

  it('maps a To Do ADO state to todo', () => {
    expect(stateOf({ source: 'ado_workitem', adoStatus: 'To Do', prStatus: null })).toBe('todo');
  });

  it('returns null when there is nothing to map', () => {
    expect(stateOf({ source: 'adhoc', adoStatus: null, prStatus: null })).toBeNull();
  });
});

describe('withoutFilter', () => {
  it('removes exactly the matching filter token and keeps the rest', () => {
    const result = withoutFilter('source:github group:blocked', { prefix: 'source', values: ['github'], negate: false });
    expect(result).toBe('group:blocked');
  });

  it('keeps negation and multi-value filters intact when dropping a different one', () => {
    const result = withoutFilter('-is:done source:github,ado', { prefix: 'is', values: ['done'], negate: true });
    expect(result).toBe('source:github,ado');
  });

  it('returns an empty string when the only filter is dropped', () => {
    const result = withoutFilter('source:github', { prefix: 'source', values: ['github'], negate: false });
    expect(result).toBe('');
  });
});
