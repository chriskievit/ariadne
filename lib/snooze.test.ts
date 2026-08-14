import { describe, it, expect } from 'vitest';
import { computeSnoozeUntil, isSnoozed, INDEFINITE_SNOOZE } from './snooze';

describe('computeSnoozeUntil', () => {
  const morning = new Date('2026-08-14T09:00:00.000Z'); // Friday

  it('later_today snoozes to 17:00 the same day when before 17:00', () => {
    const until = new Date(computeSnoozeUntil('later_today', morning));
    expect(until.getDate()).toBe(morning.getDate());
    expect(until.getHours()).toBe(17);
  });

  it('later_today rolls to tomorrow 17:00 when already past 17:00', () => {
    const evening = new Date('2026-08-14T20:00:00.000Z');
    const until = new Date(computeSnoozeUntil('later_today', evening));
    expect(until.getDate()).toBe(15);
    expect(until.getHours()).toBe(17);
  });

  it('tomorrow snoozes to 09:00 the next day', () => {
    const until = new Date(computeSnoozeUntil('tomorrow', morning));
    expect(until.getDate()).toBe(15);
    expect(until.getHours()).toBe(9);
  });

  it('next_week snoozes to 09:00 next Monday', () => {
    const until = new Date(computeSnoozeUntil('next_week', morning)); // Friday -> Monday
    expect(until.getDay()).toBe(1);
    expect(until.getHours()).toBe(9);
    expect(until.getTime()).toBeGreaterThan(morning.getTime());
  });

  it('until_activity returns the indefinite sentinel', () => {
    expect(computeSnoozeUntil('until_activity', morning)).toBe(INDEFINITE_SNOOZE);
  });
});

describe('isSnoozed', () => {
  const now = new Date('2026-08-14T12:00:00.000Z');

  it('is false when there is no snooze', () => {
    expect(isSnoozed(null, now)).toBe(false);
  });

  it('is true when snoozed_until is in the future', () => {
    expect(isSnoozed('2026-08-15T00:00:00.000Z', now)).toBe(true);
  });

  it('is false when snoozed_until has already passed', () => {
    expect(isSnoozed('2026-08-13T00:00:00.000Z', now)).toBe(false);
  });

  it('is true for the indefinite sentinel', () => {
    expect(isSnoozed(INDEFINITE_SNOOZE, now)).toBe(true);
  });
});
