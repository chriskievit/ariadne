import { NextResponse } from 'next/server';
import { db } from '@/lib/db-instance';
import { deleteItem, ItemHasLoggedTimeError } from '@/lib/items-repo';

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await params;
  const id = Number(idParam);
  try {
    deleteItem(db, id);
  } catch (error) {
    // Logged time is history the time report is built on, so this is a
    // refusal the caller should show, not a server fault.
    if (error instanceof ItemHasLoggedTimeError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
  return NextResponse.json({ ok: true });
}
