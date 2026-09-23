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
  it('formats zero as 0:00', () => {
    expect(formatElapsed(0)).toBe('0:00');
  });

  it('formats sub-minute durations as m:ss', () => {
    expect(formatElapsed(5_000)).toBe('0:05');
  });

  it('formats minutes and seconds without an hour segment', () => {
    expect(formatElapsed(62_000)).toBe('1:02');
  });

  // Floors rather than rounds a sub-second remainder: 1999ms is 1.999s.
  // Math.round would carry that up to 2s ("0:02"); only Math.floor keeps it
  // at "0:01", which is the honest reading of "not yet a full second more".
  it('floors a sub-second remainder instead of rounding it up', () => {
    expect(formatElapsed(1_999)).toBe('0:01');
  });

  // One second short of the hour boundary: still no hour segment, and every
  // second of it belongs to the minutes/seconds pair. This is the case that
  // actually distinguishes a 3600 divisor from a 3599 one -- at exactly 3600
  // seconds both divisors floor to the same quotient (see the next test's
  // comment), but at 3599 seconds a 3599 divisor wrongly reaches the hour
  // segment a second early.
  it('stays in m:ss one second before the hour boundary', () => {
    expect(formatElapsed(3_599_000)).toBe('59:59');
  });

  // The exact hour boundary: the point where the format switches from m:ss
  // to h:mm:ss.
  it('switches to h:mm:ss at exactly the hour boundary', () => {
    expect(formatElapsed(3_600_000)).toBe('1:00:00');
  });

  it('grows an hour segment past 3600 seconds', () => {
    expect(formatElapsed(3_661_000)).toBe('1:01:01');
  });

  it('pads minutes and seconds to two digits once an hour segment is shown', () => {
    expect(formatElapsed(3_605_000)).toBe('1:00:05');
  });

  // 25 hours: must read "25:00:00", not wrap back around a 24-hour clock
  // face the way a literal wall clock would.
  it('does not wrap a duration past 24 hours', () => {
    expect(formatElapsed(25 * 3_600_000)).toBe('25:00:00');
  });

  it('treats a negative duration as zero', () => {
    expect(formatElapsed(-1000)).toBe('0:00');
  });
});
