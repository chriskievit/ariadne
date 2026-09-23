// Zero-dependency helpers (see lib/date.ts) so they can be imported from a
// 'use client' component -- used to pre-fill the "hours spent" field when
// completing an item straight from the running-timer chip, and to render a
// running duration as a clock face.

export function elapsedHoursForInput(elapsedMs: number): string {
  const hours = Math.max(0, elapsedMs) / 3_600_000;
  const roundedToQuarterHour = Math.round(hours * 4) / 4;
  return String(roundedToQuarterHour);
}

// Formats a duration as "m:ss", growing to "h:mm:ss" past an hour. Shared by
// RunningTimerChip (the user's own ticking timer) and the complete dialog's
// agent-elapsed reference (ItemRow) -- one formatter, so the two clocks
// never drift into disagreeing about how a duration reads.
export function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
