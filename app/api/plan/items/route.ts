import { NextResponse } from 'next/server';
import { db } from '@/lib/db-instance';
import { addPlanItem, removePlanItem } from '@/lib/plans-repo';

export async function POST(request: Request) {
  const { date, itemId } = await request.json();
  return NextResponse.json(addPlanItem(db, date, itemId));
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const date = url.searchParams.get('date') ?? '';
  const itemId = Number(url.searchParams.get('itemId'));
  removePlanItem(db, date, itemId);
  return new NextResponse(null, { status: 204 });
}
