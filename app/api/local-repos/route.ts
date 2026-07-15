import { NextResponse } from 'next/server';
import { db } from '@/lib/db-instance';
import { listLocalRepos } from '@/lib/warp';

export async function GET() {
  return NextResponse.json(listLocalRepos(db));
}
