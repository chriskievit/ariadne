import { NextResponse } from 'next/server';
import { db } from '@/lib/db-instance';
import { getRunningTimer } from '@/lib/time-logs-repo';

export async function GET() {
  return NextResponse.json(getRunningTimer(db));
}
