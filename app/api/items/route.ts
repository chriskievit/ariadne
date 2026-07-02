import { NextResponse } from 'next/server';
import { db } from '@/lib/db-instance';
import { createAdhocItem } from '@/lib/items-repo';
import { getGroupedItems } from '@/lib/dashboard';

export async function GET() {
  return NextResponse.json(getGroupedItems(db, new Date()));
}

export async function POST(request: Request) {
  const body = (await request.json()) as { title: string; category?: string; dueDate?: string };
  const item = createAdhocItem(db, body);
  return NextResponse.json(item, { status: 201 });
}
