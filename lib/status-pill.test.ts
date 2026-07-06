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
    ['draft', 'Draft', 'secondary'],
    ['ready_for_review', 'Ready for review', 'default'],
    ['changes_requested', 'Changes requested', 'warning'],
    ['approved', 'Approved', 'success'],
  ] as const)('maps github_pr prStatus %s to label %s and variant %s', (prStatus, label, variant) => {
    expect(getStatusPill({ source: 'github_pr', prStatus, adoStatus: null })).toEqual({ label, variant });
  });

  it.each([
    ['New', 'secondary'],
    ['Active', 'default'],
    ['Committed', 'default'],
    ['Resolved', 'success'],
    ['Closed', 'success'],
    ['Removed', 'destructive'],
  ] as const)('buckets ado_workitem state %s into variant %s', (adoStatus, variant) => {
    expect(getStatusPill({ source: 'ado_workitem', prStatus: null, adoStatus })).toEqual({ label: adoStatus, variant });
  });

  it('is case-insensitive when bucketing ado state', () => {
    expect(getStatusPill({ source: 'ado_workitem', prStatus: null, adoStatus: 'ACTIVE' })).toEqual({
      label: 'ACTIVE',
      variant: 'default',
    });
  });

  it('falls back to outline for an unrecognized ado state', () => {
    expect(getStatusPill({ source: 'ado_workitem', prStatus: null, adoStatus: 'Some Custom State' })).toEqual({
      label: 'Some Custom State',
      variant: 'outline',
    });
  });
});
