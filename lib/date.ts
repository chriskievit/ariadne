// Local-calendar-day helpers with zero dependencies (no better-sqlite3, no
// Next.js server APIs) so both API routes and 'use client' components can
// import this safely -- unlike lib/dashboard.ts, which pulls in the DB
// driver and can't be bundled into the browser.

export function localDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d + days);
  return localDateString(date);
}

// Coarse, human relative age for a timestamp the user set themselves. It
// deliberately loses precision as it goes back -- the point is never "how
// long exactly", it is "is this assertion still fresh?", and "3 weeks ago"
// answers that better than "23 days ago". Clamped at zero so a future
// timestamp (clock skew, a hand-edited row) reads as today rather than
// rendering a negative age.
export function relativeAge(iso: string | null | undefined, now: Date): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;

  const days = Math.max(0, Math.floor((now.getTime() - then) / 86_400_000));
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;

  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} week${weeks === 1 ? '' : 's'} ago`;

  const months = Math.max(1, Math.round(days / 30));
  return `${months} month${months === 1 ? '' : 's'} ago`;
}
