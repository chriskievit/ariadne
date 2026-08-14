import { describe, it, expect } from 'vitest';
import { matchesQuery } from './search';

describe('matchesQuery', () => {
  it('matches a case-insensitive substring of the title', () => {
    expect(matchesQuery('Fix login redirect bug', 'login')).toBe(true);
    expect(matchesQuery('Fix login redirect bug', 'LOGIN')).toBe(true);
  });

  it('does not match when the query is not a substring', () => {
    expect(matchesQuery('Fix login redirect bug', 'billing')).toBe(false);
  });

  it('treats an empty or whitespace-only query as matching everything', () => {
    expect(matchesQuery('Fix login redirect bug', '')).toBe(true);
    expect(matchesQuery('Fix login redirect bug', '   ')).toBe(true);
  });

  it('trims surrounding whitespace from the query before matching', () => {
    expect(matchesQuery('Fix login redirect bug', '  login  ')).toBe(true);
  });
});
