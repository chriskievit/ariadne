import { NextResponse } from 'next/server';
import { db } from '@/lib/db-instance';
import { setTriageState, getItemById } from '@/lib/items-repo';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await params;
  const id = Number(idParam);
  const { done } = await request.json();
  setTriageState(db, id, done ? 'done' : 'none');
  return NextResponse.json(getItemById(db, id));
}
