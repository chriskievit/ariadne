import { NextResponse } from 'next/server';
import { db } from '@/lib/db-instance';
import { getTimeReport } from '@/lib/report';

// GET has no dynamic API usage, so Next.js would statically bake this at
// build time otherwise (same class of bug already fixed for `/` and
// `/api/sprint`).
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');

  if (!start || !end || start > end) {
    return NextResponse.json(
      { error: 'start and end query params are required, with start <= end' },
      { status: 400 }
    );
  }

  return NextResponse.json(getTimeReport(db, start, end));
}
