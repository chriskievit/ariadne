import { NextResponse } from 'next/server';
import { db } from '@/lib/db-instance';
import { getPlan, upsertPlan, getPlanItems } from '@/lib/plans-repo';

export async function GET(request: Request) {
  const date = new URL(request.url).searchParams.get('date') ?? '';
  return NextResponse.json({ plan: getPlan(db, date), items: getPlanItems(db, date) });
}

export async function POST(request: Request) {
  const { date, capacityMinutes, note } = await request.json();
  return NextResponse.json(upsertPlan(db, date, { capacityMinutes, note }));
}
