import ReportDashboard from '@/components/ReportDashboard';
import { db } from '@/lib/db-instance';
import { getTimeReport } from '@/lib/report';
import { getSetting } from '@/lib/settings-repo';
import { SETTINGS_KEYS } from '@/lib/config';

// GET has no dynamic API usage, so Next.js would statically bake this at
// build time otherwise (same class of bug already fixed for `/` and
// `/api/sprint`).
export const dynamic = 'force-dynamic';

function toDateOnly(iso: string): string {
  return iso.slice(0, 10);
}

function lastFourteenDays(): { start: string; end: string } {
  const today = new Date();
  const start = new Date(today.getTime() - 13 * 86_400_000);
  return { start: toDateOnly(start.toISOString()), end: toDateOnly(today.toISOString()) };
}

export default function ReportPage() {
  const sprintStart = getSetting(db, SETTINGS_KEYS.sprintStart);
  const sprintEnd = getSetting(db, SETTINGS_KEYS.sprintEnd);
  const sprintRange =
    sprintStart && sprintEnd ? { start: toDateOnly(sprintStart), end: toDateOnly(sprintEnd) } : null;

  const range = sprintRange ?? lastFourteenDays();
  const report = getTimeReport(db, range.start, range.end);

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6">
      <h1 className="text-lg font-semibold">Time report</h1>
      <ReportDashboard initialReport={report} initialRange={range} sprintRange={sprintRange} />
    </main>
  );
}
