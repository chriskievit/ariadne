// Zero-dependency helper (see lib/date.ts) so it can be imported from a
// 'use client' component -- used to pre-fill the "hours spent" field when
// completing an item straight from the running-timer chip.

export function elapsedHoursForInput(elapsedMs: number): string {
  const hours = Math.max(0, elapsedMs) / 3_600_000;
  const roundedToQuarterHour = Math.round(hours * 4) / 4;
  return String(roundedToQuarterHour);
}
