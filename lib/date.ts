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
