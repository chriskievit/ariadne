import { describe, expect, it } from 'vitest';
import { elapsedHoursForInput } from './elapsed';

describe('elapsedHoursForInput', () => {
  it('rounds down to the nearest quarter hour', () => {
    expect(elapsedHoursForInput(20 * 60_000)).toBe('0.25');
  });

  it('rounds up to the nearest quarter hour', () => {
    expect(elapsedHoursForInput(40 * 60_000)).toBe('0.75');
  });

  it('formats whole hours without a decimal', () => {
    expect(elapsedHoursForInput(2 * 3_600_000)).toBe('2');
  });

  it('formats a mid-value quarter hour', () => {
    expect(elapsedHoursForInput(90 * 60_000)).toBe('1.5');
  });

  it('returns 0 for a just-started timer', () => {
    expect(elapsedHoursForInput(5000)).toBe('0');
  });

  it('never returns a negative value', () => {
    expect(elapsedHoursForInput(-1000)).toBe('0');
  });
});
