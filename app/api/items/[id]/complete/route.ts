import { NextResponse } from 'next/server';
import { db } from '@/lib/db-instance';
import { setStatus, getItemById } from '@/lib/items-repo';
import { completeTimer } from '@/lib/time-logs-repo';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  const body = (await request.json().catch(() => ({}))) as { durationHours?: number; note?: string };

  if (typeof body.durationHours !== 'number' || !Number.isFinite(body.durationHours) || body.durationHours < 0) {
    return NextResponse.json({ error: 'durationHours is required and must be >= 0' }, { status: 400 });
  }

  setStatus(db, id, 'done', new Date().toISOString());
  const log = completeTimer(db, id, { durationHours: body.durationHours, note: body.note });
  return NextResponse.json({ item: getItemById(db, id), timeLog: log });
}
