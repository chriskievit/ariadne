import { NextResponse } from 'next/server';
import { db } from '@/lib/db-instance';
import { setSnoozedUntil, getItemById } from '@/lib/items-repo';
import { computeSnoozeUntil, type SnoozeOption } from '@/lib/snooze';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await params;
  const id = Number(idParam);
  const { option } = (await request.json()) as { option: SnoozeOption };
  setSnoozedUntil(db, id, computeSnoozeUntil(option, new Date()));
  return NextResponse.json(getItemById(db, id));
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await params;
  const id = Number(idParam);
  setSnoozedUntil(db, id, null);
  return NextResponse.json(getItemById(db, id));
}
