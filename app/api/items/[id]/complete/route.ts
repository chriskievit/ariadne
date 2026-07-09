import { NextResponse } from 'next/server';
import { db } from '@/lib/db-instance';
import { setStatus, getItemById } from '@/lib/items-repo';
import { completeTimer } from '@/lib/time-logs-repo';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  const body = (await request.json().catch(() => ({}))) as { durationHours?: number; note?: string };
  setStatus(db, id, 'done', new Date().toISOString());
  const log = completeTimer(db, id, body);
  return NextResponse.json({ item: getItemById(db, id), timeLog: log });
}
