import { describe, it, expect } from 'vitest';
import { settledOutcome } from './settled';
import { adoStateFields } from './sources/ado-state';

describe('settledOutcome', () => {
  it('returns null for adhoc items, which have no source system to settle in', () => {
    expect(settledOutcome({ source: 'adhoc', prStatus: null, upstreamStatus: null, statusCategory: null })).toBeNull();
  });

  it('returns null when a github_pr item has no prStatus', () => {
    expect(settledOutcome({ source: 'github_pr', prStatus: null, upstreamStatus: null, statusCategory: null })).toBeNull();
  });

  it('returns null when an ado_workitem has no upstreamStatus', () => {
    expect(settledOutcome({ source: 'ado_workitem', prStatus: null, upstreamStatus: null, statusCategory: null })).toBeNull();
  });

  it('treats a merged pull request as finished', () => {
    expect(settledOutcome({ source: 'github_pr', prStatus: 'merged', upstreamStatus: null, statusCategory: null })).toBe('finished');
  });

  it.each(['draft', 'ready_for_review', 'changes_requested', 'approved'] as const)(
    'leaves an open pull request in prStatus %s unsettled',
    (prStatus) => {
      expect(settledOutcome({ source: 'github_pr', prStatus, upstreamStatus: null, statusCategory: null })).toBeNull();
    }
  );

  it.each(['Done', 'Closed', 'Resolved', 'Completed', 'done', 'CLOSED'])(
    'treats ado state %s as finished',
    (adoStatus) => {
      expect(settledOutcome({ source: 'ado_workitem', prStatus: null, ...adoStateFields(adoStatus) })).toBe('finished');
    }
  );

  it.each(['Removed', 'removed'])('treats ado state %s as gone rather than finished', (adoStatus) => {
    expect(settledOutcome({ source: 'ado_workitem', prStatus: null, ...adoStateFields(adoStatus) })).toBe('gone');
  });

  it.each(['New', 'Active', 'Committed', 'Blocked', 'In Progress'])(
    'leaves ado state %s unsettled',
    (adoStatus) => {
      expect(settledOutcome({ source: 'ado_workitem', prStatus: null, ...adoStateFields(adoStatus) })).toBeNull();
    }
  );

  // A work item's state is free text from Azure DevOps, so the match has to be
  // a substring one -- but 'Ready for done-ness review' is not a done state.
  // These pin the substring behaviour that lib/status-pill.ts already relies on
  // so a future tightening of the regex has to break a test on purpose.
  it('matches a done state embedded in a longer custom state name', () => {
    expect(settledOutcome({ source: 'ado_workitem', prStatus: null, ...adoStateFields('Dev Done') })).toBe('finished');
  });

  it('prefers gone over finished when a state names both', () => {
    expect(settledOutcome({ source: 'ado_workitem', prStatus: null, ...adoStateFields('Removed (was Done)') })).toBe('gone');
  });

  it('ignores a stale prStatus on an ado work item', () => {
    expect(settledOutcome({ source: 'ado_workitem', prStatus: 'merged', ...adoStateFields('Active') })).toBeNull();
  });

  it('ignores a stale upstreamStatus on a pull request', () => {
    expect(settledOutcome({ source: 'github_pr', prStatus: 'approved', ...adoStateFields('Done') })).toBeNull();
  });

  it('reads the category, not the label, for finished', () => {
    // A label the ADO patterns never produced, paired with a done category,
    // as a future tracker would send it.
    expect(settledOutcome({ source: 'ado_workitem', prStatus: null, upstreamStatus: 'Shipped', statusCategory: 'done' })).toBe('finished');
  });
});
