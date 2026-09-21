import { NextResponse } from 'next/server';
import { db } from '@/lib/db-instance';
import { listAgentSessions, applyAgentSessionPatch } from '@/lib/agent-sessions-repo';
import { isNeverRegistered } from '@/lib/agent-session-state';
import { readTranscriptTail } from '@/lib/agent-transcript';

// How many transcript turns ride along with the list. Enough to show what a
// session is doing without turning the list endpoint into a log shipper.
const TAIL_LIMIT = 5;

export async function GET() {
  const now = new Date();

  // Reconciled on read rather than on a timer: Ariadne has no background
  // scheduler, and a session nobody is looking at does not need its failure
  // recorded yet.
  for (const session of listAgentSessions(db)) {
    if (isNeverRegistered(session, now)) {
      applyAgentSessionPatch(db, session.id, {
        state: 'failed',
        endedAt: now.toISOString(),
        endReason: 'never_registered',
      });
    }
  }

  const sessions = listAgentSessions(db).map((session) => ({
    ...session,
    lastLines: session.transcriptPath ? readTranscriptTail(session.transcriptPath, TAIL_LIMIT) : [],
  }));

  return NextResponse.json({ sessions });
}
