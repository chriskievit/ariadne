import { NextResponse } from 'next/server';
import { db } from '@/lib/db-instance';
import { createAdhocItem } from '@/lib/items-repo';
import { getGroupedItems } from '@/lib/dashboard';
import type { Priority } from '@/lib/types';

export async function GET() {
  return NextResponse.json(getGroupedItems(db, new Date()));
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    title: string;
    category?: string;
    dueDate?: string;
    priority?: Priority | null;
  };
  const item = createAdhocItem(db, body);
  return NextResponse.json(item, { status: 201 });
}
