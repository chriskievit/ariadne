import { NextResponse } from 'next/server';
import { db } from '@/lib/db-instance';
import { getSavedViews, addSavedView, removeSavedView, reorderSavedViews } from '@/lib/saved-views';

export async function GET() {
  return NextResponse.json(getSavedViews(db));
}

export async function POST(request: Request) {
  const { label, query, shortcut } = await request.json();
  return NextResponse.json(addSavedView(db, { label, query, shortcut: shortcut ?? null }));
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get('id') ?? '';
  return NextResponse.json(removeSavedView(db, id));
}

export async function PUT(request: Request) {
  const { orderedIds } = await request.json();
  return NextResponse.json(reorderSavedViews(db, orderedIds));
}
