import { NextResponse } from 'next/server';
import { db } from '@/lib/db-instance';
import { getAllSourceStatuses } from '@/lib/sync-status';

export async function GET() {
  return NextResponse.json(getAllSourceStatuses(db, new Date()));
}
