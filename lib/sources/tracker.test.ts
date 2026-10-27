import { describe, it, expect } from 'vitest';
import { isTrackerSource } from './tracker';

describe('isTrackerSource', () => {
  it('is true for sources that carry an upstream state', () => {
    expect(isTrackerSource('ado_workitem')).toBe(true);
  });

  it.each(['github_pr', 'adhoc'] as const)('is false for %s', (source) => {
    expect(isTrackerSource(source)).toBe(false);
  });
});
