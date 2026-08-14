import { NextResponse } from 'next/server';
import { db } from '@/lib/db-instance';
import { setPlanItemEstimate } from '@/lib/plans-repo';

export async function POST(request: Request) {
  const { date, itemId, minutes } = await request.json();
  setPlanItemEstimate(db, date, itemId, minutes);
  return new NextResponse(null, { status: 204 });
}
