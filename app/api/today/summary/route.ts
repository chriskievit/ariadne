import { NextResponse } from 'next/server';
import { db } from '@/lib/db-instance';
import { getTodaySummary } from '@/lib/dashboard';
import { sumHoursLoggedOnByItem } from '@/lib/time-logs-repo';
import { getPlanItems } from '@/lib/plans-repo';
import { localDateString } from '@/lib/date';

export async function GET() {
  const now = new Date();
  const date = localDateString(now);
  const summary = getTodaySummary(db, date, now);
  const hoursByItem = sumHoursLoggedOnByItem(db, date);
  const estimateByItem = new Map(getPlanItems(db, date).map((pi) => [pi.itemId, pi.estimateMinutes]));

  return NextResponse.json({
    ...summary,
    doneToday: summary.doneToday.map((item) => ({
      ...item,
      hoursLoggedToday: hoursByItem.get(item.id) ?? 0,
      estimateMinutes: estimateByItem.get(item.id) ?? null,
    })),
  });
}
