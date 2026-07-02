import { NextResponse } from 'next/server';
import { db } from '@/lib/db-instance';
import { runSync } from '@/lib/sync';

export async function POST() {
  const outcomes = await runSync(db);
  return NextResponse.json({ outcomes });
}
