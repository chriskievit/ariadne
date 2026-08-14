import { NextResponse } from 'next/server';
import { db } from '@/lib/db-instance';
import { reorderPlanItems } from '@/lib/plans-repo';

export async function PUT(request: Request) {
  const { date, orderedItemIds } = await request.json();
  return NextResponse.json(reorderPlanItems(db, date, orderedItemIds));
}
