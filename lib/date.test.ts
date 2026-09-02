import { describe, it, expect } from 'vitest';
import { localDateString, addDays, relativeAge } from './date';

describe('localDateString', () => {
  it('formats a date as YYYY-MM-DD using local calendar fields', () => {
    expect(localDateString(new Date(2026, 7, 13, 23, 59))).toBe('2026-08-13');
  });

  it('zero-pads single-digit month and day', () => {
    expect(localDateString(new Date(2026, 0, 5, 8, 0))).toBe('2026-01-05');
  });
});

describe('addDays', () => {
  it('adds a day within the same month', () => {
    expect(addDays('2026-08-13', 1)).toBe('2026-08-14');
  });

  it('rolls over a month boundary', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01');
  });

  it('rolls over a year boundary', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('relativeAge', () => {
  const now = new Date('2026-09-02T12:00:00.000Z');

  it('reports the same day as today', () => {
    expect(relativeAge('2026-09-02T09:00:00.000Z', now)).toBe('today');
  });

  it('reports one day back as yesterday', () => {
    expect(relativeAge('2026-09-01T09:00:00.000Z', now)).toBe('yesterday');
  });

  it('reports days up to a week', () => {
    expect(relativeAge('2026-08-30T12:00:00.000Z', now)).toBe('3 days ago');
    expect(relativeAge('2026-08-27T12:00:00.000Z', now)).toBe('6 days ago');
  });

  it('reports whole weeks from a week out', () => {
    expect(relativeAge('2026-08-26T12:00:00.000Z', now)).toBe('1 week ago');
    expect(relativeAge('2026-08-12T12:00:00.000Z', now)).toBe('3 weeks ago');
  });

  it('reports whole months past four weeks', () => {
    expect(relativeAge('2026-07-20T12:00:00.000Z', now)).toBe('1 month ago');
    expect(relativeAge('2026-06-02T12:00:00.000Z', now)).toBe('3 months ago');
  });

  // A clock skew or a future timestamp must not render "-2 days ago".
  it('treats a future timestamp as today rather than going negative', () => {
    expect(relativeAge('2026-09-05T12:00:00.000Z', now)).toBe('today');
  });

  it('returns null for a missing timestamp', () => {
    expect(relativeAge(null, now)).toBeNull();
  });
});
