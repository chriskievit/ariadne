import { NextResponse } from 'next/server';
import { db } from '@/lib/db-instance';
import { getItemById } from '@/lib/items-repo';
import { stopTimer } from '@/lib/time-logs-repo';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await params;
  const id = Number(idParam);
  stopTimer(db, id);
  return NextResponse.json(getItemById(db, id));
}
