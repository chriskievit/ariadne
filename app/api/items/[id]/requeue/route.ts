import { NextResponse } from 'next/server';
import { db } from '@/lib/db-instance';
import { setStatus, getItemById } from '@/lib/items-repo';
import { completeTimer, elapsedHoursSinceStart } from '@/lib/time-logs-repo';

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  completeTimer(db, id, { durationHours: elapsedHoursSinceStart(db, id) });
  setStatus(db, id, 'inbox');
  return NextResponse.json(getItemById(db, id));
}
