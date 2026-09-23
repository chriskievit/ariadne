import { describe, expect, it } from 'vitest';
import { elapsedHoursForInput, formatElapsed } from './elapsed';

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

describe('formatElapsed', () => {
  it('formats sub-minute durations as m:ss', () => {
    expect(formatElapsed(5_000)).toBe('0:05');
  });

  it('formats minutes and seconds without an hour segment', () => {
    expect(formatElapsed(62_000)).toBe('1:02');
  });

  it('grows an hour segment past 3600 seconds', () => {
    expect(formatElapsed(3_661_000)).toBe('1:01:01');
  });

  it('pads minutes and seconds to two digits once an hour segment is shown', () => {
    expect(formatElapsed(3_605_000)).toBe('1:00:05');
  });

  it('treats a negative duration as zero', () => {
    expect(formatElapsed(-1000)).toBe('0:00');
  });
});
