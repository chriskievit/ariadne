import { NextResponse } from 'next/server';
import { db } from '@/lib/db-instance';
import { getRunningTimer } from '@/lib/time-logs-repo';

// GET has no dynamic API usage, so Next.js would statically bake this at build time otherwise.
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(getRunningTimer(db));
}
