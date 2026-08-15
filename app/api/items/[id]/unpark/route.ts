import { NextResponse } from 'next/server';
import { db } from '@/lib/db-instance';
import { setParked, getItemById } from '@/lib/items-repo';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await params;
  const id = Number(idParam);
  setParked(db, id, false);
  return NextResponse.json(getItemById(db, id));
}
