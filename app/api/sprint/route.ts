import { NextResponse } from 'next/server';
import { db } from '@/lib/db-instance';
import { getSprintProgress } from '@/lib/sprint';

// GET has no dynamic API usage, so Next.js would statically bake this at build time otherwise.
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(getSprintProgress(db));
}
