import { NextResponse } from 'next/server';
import { db } from '@/lib/db-instance';
import { deleteItem } from '@/lib/items-repo';

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  deleteItem(db, id);
  return NextResponse.json({ ok: true });
}
