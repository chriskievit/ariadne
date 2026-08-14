import { describe, it, expect } from 'vitest';
import { getStatusPill } from './status-pill';

describe('getStatusPill', () => {
  it('returns null for adhoc items', () => {
    expect(getStatusPill({ source: 'adhoc', prStatus: null, adoStatus: null })).toBeNull();
  });

  it('returns null when a github_pr item has no prStatus', () => {
    expect(getStatusPill({ source: 'github_pr', prStatus: null, adoStatus: null })).toBeNull();
  });

  it('returns null when an ado_workitem has no adoStatus', () => {
    expect(getStatusPill({ source: 'ado_workitem', prStatus: null, adoStatus: null })).toBeNull();
  });

  it.each([
    ['draft', 'Draft', 'outline'],
    ['ready_for_review', 'Ready for review', 'outline'],
    ['changes_requested', 'Changes requested', 'warning'],
    ['approved', 'Approved', 'outline'],
    ['merged', 'Merged', 'outline'],
  ] as const)('maps github_pr prStatus %s to label %s and variant %s', (prStatus, label, variant) => {
    expect(getStatusPill({ source: 'github_pr', prStatus, adoStatus: null })).toEqual({ label, variant });
  });

  it.each([
    ['New', 'outline'],
    ['Active', 'secondary'],
    ['Committed', 'secondary'],
    ['Resolved', 'success'],
    ['Closed', 'success'],
    ['Removed', 'destructive'],
    ['Blocked', 'blocked'],
  ] as const)('buckets ado_workitem state %s into variant %s', (adoStatus, variant) => {
    expect(getStatusPill({ source: 'ado_workitem', prStatus: null, adoStatus })).toEqual({ label: adoStatus, variant });
  });

  it('is case-insensitive when bucketing ado state', () => {
    expect(getStatusPill({ source: 'ado_workitem', prStatus: null, adoStatus: 'ACTIVE' })).toEqual({
      label: 'ACTIVE',
      variant: 'secondary',
    });
  });

  it('treats blocked as more urgent than an unrecognized neutral state', () => {
    expect(getStatusPill({ source: 'ado_workitem', prStatus: null, adoStatus: 'Blocked' })).toEqual({
      label: 'Blocked',
      variant: 'blocked',
    });
    expect(getStatusPill({ source: 'ado_workitem', prStatus: null, adoStatus: 'To Do' })).toEqual({
      label: 'To Do',
      variant: 'outline',
    });
  });

  it('falls back to outline for an unrecognized ado state', () => {
    expect(getStatusPill({ source: 'ado_workitem', prStatus: null, adoStatus: 'Some Custom State' })).toEqual({
      label: 'Some Custom State',
      variant: 'outline',
    });
  });

  it('never returns the default (indigo) variant', () => {
    const adoStatuses = ['Blocked', 'In Progress', 'To Do', 'Code Review', 'Removed', 'Done'];
    for (const adoStatus of adoStatuses) {
      expect(getStatusPill({ source: 'ado_workitem', prStatus: null, adoStatus })?.variant).not.toBe('default');
    }
    const prStatuses = ['draft', 'ready_for_review', 'changes_requested', 'approved', 'merged'] as const;
    for (const prStatus of prStatuses) {
      expect(getStatusPill({ source: 'github_pr', prStatus, adoStatus: null })?.variant).not.toBe('default');
    }
  });
});
