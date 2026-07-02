import { NextResponse } from 'next/server';
import { db } from '@/lib/db-instance';
import { getSprintProgress } from '@/lib/sprint';

export async function GET() {
  return NextResponse.json(getSprintProgress(db));
}
