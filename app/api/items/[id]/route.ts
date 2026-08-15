import { NextResponse } from 'next/server';
import { db } from '@/lib/db-instance';
import { deleteItem } from '@/lib/items-repo';

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await params;
  const id = Number(idParam);
  deleteItem(db, id);
  return NextResponse.json({ ok: true });
}
