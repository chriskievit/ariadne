import { NextResponse } from 'next/server';
import { db } from '@/lib/db-instance';
import { setStatus, getItemById } from '@/lib/items-repo';
import { startTimer } from '@/lib/time-logs-repo';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await params;
  const id = Number(idParam);
  const body = (await request.json().catch(() => ({}))) as { withTimer?: boolean };
  setStatus(db, id, 'in_progress');
  // withTimer: false is used when a linked-item cascade also advances this
  // item's status -- the timer should stay on whichever item the user
  // actually clicked Start on, not silently move to the last linked item.
  if (body.withTimer !== false) startTimer(db, id);
  return NextResponse.json(getItemById(db, id));
}
