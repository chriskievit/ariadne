import { NextResponse } from 'next/server';
import { db } from '@/lib/db-instance';
import { setTodayDate, getItemById } from '@/lib/items-repo';
import { localDateString } from '@/lib/date';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  const body = (await request.json().catch(() => ({}))) as { date?: string };
  const date = body.date ?? localDateString(new Date());
  setTodayDate(db, id, date);
  return NextResponse.json(getItemById(db, id));
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  setTodayDate(db, id, null);
  return NextResponse.json(getItemById(db, id));
}
