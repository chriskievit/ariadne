import { NextResponse } from 'next/server';
import { db } from '@/lib/db-instance';
import { setStarred, getItemById } from '@/lib/items-repo';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await params;
  const id = Number(idParam);
  const { starred } = await request.json();
  setStarred(db, id, Boolean(starred));
  return NextResponse.json(getItemById(db, id));
}
