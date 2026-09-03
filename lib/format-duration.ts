// Zero-dependency helper (see lib/elapsed.ts) so it can be imported from a
// 'use client' component. One copy, because a duration rendered as "1h 30m"
// in one panel and "90m" in the next reads as two different facts.
//
// The total is rounded before it is split, not after. Callers pass minutes
// derived from logged hours, so a fractional value is normal; rounding the
// remainder alone renders 119.6 as "1h 60m", which is what two of the three
// copies this replaced would have done.
export function formatMinutes(minutes: number): string {
  const total = Math.round(minutes);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
