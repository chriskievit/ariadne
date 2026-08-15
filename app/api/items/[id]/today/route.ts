import { NextResponse } from 'next/server';
import { db } from '@/lib/db-instance';
import { setTodayDate, getItemById } from '@/lib/items-repo';
import { localDateString } from '@/lib/date';
import { addPlanItem, removePlanItem } from '@/lib/plans-repo';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await params;
  const id = Number(idParam);
  const body = (await request.json().catch(() => ({}))) as { date?: string };
  const date = body.date ?? localDateString(new Date());
  setTodayDate(db, id, date);
  addPlanItem(db, date, id);
  return NextResponse.json(getItemById(db, id));
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await params;
  const id = Number(idParam);
  const item = getItemById(db, id);
  if (item?.todayDate) removePlanItem(db, item.todayDate, id);
  setTodayDate(db, id, null);
  return NextResponse.json(getItemById(db, id));
}
