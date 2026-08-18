import { NextResponse } from 'next/server';
import { db } from '@/lib/db-instance';
import { setStatus, getItemById } from '@/lib/items-repo';
import { startTimer } from '@/lib/time-logs-repo';
import { getPlanItems, reorderPlanItems } from '@/lib/plans-repo';
import { localDateString } from '@/lib/date';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await params;
  const id = Number(idParam);
  const body = (await request.json().catch(() => ({}))) as { withTimer?: boolean };
  setStatus(db, id, 'in_progress');
  // If this item is on today's plan, starting it is also the moment it
  // becomes "what I'm doing" -- move it to the top of Today's hand-picked
  // order, persistently, so that's still true if it's later paused.
  const today = localDateString(new Date());
  const todayPlanItems = getPlanItems(db, today);
  if (todayPlanItems.some((pi) => pi.itemId === id)) {
    const orderedIds = [id, ...todayPlanItems.filter((pi) => pi.itemId !== id).map((pi) => pi.itemId)];
    reorderPlanItems(db, today, orderedIds);
  }
  // withTimer: false is used when a linked-item cascade also advances this
  // item's status -- the timer should stay on whichever item the user
  // actually clicked Start on, not silently move to the last linked item.
  if (body.withTimer !== false) startTimer(db, id);
  return NextResponse.json(getItemById(db, id));
}
