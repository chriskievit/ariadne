import { describe, it, expect } from 'vitest';
import { formatMinutes } from './format-duration';

describe('formatMinutes', () => {
  it('renders minutes alone under an hour', () => {
    expect(formatMinutes(45)).toBe('45m');
    expect(formatMinutes(0)).toBe('0m');
  });

  it('drops the minutes on a whole hour', () => {
    expect(formatMinutes(60)).toBe('1h');
    expect(formatMinutes(360)).toBe('6h');
  });

  it('renders both parts otherwise', () => {
    expect(formatMinutes(90)).toBe('1h 30m');
    expect(formatMinutes(125)).toBe('2h 5m');
  });

  it('rounds a fractional total rather than its remainder', () => {
    // Rounding the remainder alone would render this as "1h 60m".
    expect(formatMinutes(119.6)).toBe('2h');
    expect(formatMinutes(45.4)).toBe('45m');
    expect(formatMinutes(89.5)).toBe('1h 30m');
  });
});
