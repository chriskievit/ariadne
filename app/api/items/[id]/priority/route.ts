import { NextResponse } from 'next/server';
import { db } from '@/lib/db-instance';
import { setPriority, getItemById, PriorityNotAllowedError } from '@/lib/items-repo';
import type { Priority } from '@/lib/types';

const VALID: Priority[] = ['low', 'medium', 'high'];

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await params;
  const id = Number(idParam);
  const { priority } = (await request.json()) as { priority: Priority | null };

  if (priority !== null && !VALID.includes(priority)) {
    return NextResponse.json({ error: 'priority must be low, medium, high, or null' }, { status: 400 });
  }

  try {
    setPriority(db, id, priority);
  } catch (error) {
    // A synced row refusing a priority is a rule the caller should show, not
    // a server fault -- the message names the reason so an MCP client or a
    // menu can repeat it verbatim.
    if (error instanceof PriorityNotAllowedError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
  return NextResponse.json(getItemById(db, id));
}
