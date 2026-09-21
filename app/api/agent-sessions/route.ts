import { NextResponse } from 'next/server';
import { db } from '@/lib/db-instance';
import { listSessionsForDisplay } from '@/lib/agent-session-list';

// The list itself lives in lib/agent-session-list.ts because the /work page
// renders it on the server too, and a page fetching its own API over HTTP to
// paint itself is a round trip for nothing.
export async function GET() {
  return NextResponse.json({ sessions: listSessionsForDisplay(db, new Date()) });
}
