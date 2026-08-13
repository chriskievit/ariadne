import { NextResponse } from 'next/server';
import { db } from '@/lib/db-instance';
import { setParked, getItemById } from '@/lib/items-repo';

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  setParked(db, id, true);
  return NextResponse.json(getItemById(db, id));
}
