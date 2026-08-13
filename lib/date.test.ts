import { describe, it, expect } from 'vitest';
import { localDateString, addDays } from './date';

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
