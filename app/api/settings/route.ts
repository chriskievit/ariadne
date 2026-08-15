import { NextResponse } from 'next/server';
import { db } from '@/lib/db-instance';
import { getRedactedSettings, setSetting } from '@/lib/settings-repo';

export async function GET() {
  return NextResponse.json(getRedactedSettings(db));
}

export async function POST(request: Request) {
  const body = (await request.json()) as Record<string, string>;
  for (const [key, value] of Object.entries(body)) {
    setSetting(db, key, value);
  }
  return NextResponse.json(getRedactedSettings(db));
}
