import { NextResponse } from 'next/server';
import { db } from '@/lib/db-instance';
import {
  listOpenAgentSessions,
  listAgentSessions,
  applyAgentSessionPatch,
  toPublicAgentSession,
} from '@/lib/agent-sessions-repo';
import { isNeverRegistered } from '@/lib/agent-session-state';
import { readTranscriptTail } from '@/lib/agent-transcript';

// How many transcript turns ride along with the list. Enough to show what a
// session is doing without turning the list endpoint into a log shipper.
const TAIL_LIMIT = 5;

// How many ended sessions stay visible after they close. Unbounded would
// mean this route re-reads every session that ever existed, forever; ten is
// enough that a just-finished session does not vanish from under you.
const RECENT_ENDED_LIMIT = 10;

export async function GET() {
  const now = new Date();

  // Reconciled on read rather than on a timer: Ariadne has no background
  // scheduler, and a session nobody is looking at does not need its failure
  // recorded yet. Only open sessions can possibly be stale in this way, so
  // reconciliation walks that (bounded) set rather than the whole table.
  for (const session of listOpenAgentSessions(db)) {
    if (isNeverRegistered(session, now)) {
      applyAgentSessionPatch(db, session.id, {
        state: 'failed',
        // Deliberately no endedAt. applyHookEvent refuses any event once
        // endedAt is set, and three minutes is not generous for "the
        // folder-trust prompt is still up." Leaving it null keeps the door
        // open for a late SessionStart to revive this row instead of the
        // agent starting fine while Ariadne shows it as permanently dead.
        endReason: 'never_registered',
      });
    }
  }

  // Hoisted so the table backing this list is read exactly once per
  // request, after reconciliation has had its say.
  const allSessions = listAgentSessions(db);
  const open = allSessions.filter((session) => session.endedAt === null);
  const recentlyEnded = allSessions
    .filter((session) => session.endedAt !== null)
    .sort((a, b) => (b.endedAt as string).localeCompare(a.endedAt as string))
    .slice(0, RECENT_ENDED_LIMIT);

  const sessions = [...open, ...recentlyEnded].map((session) => ({
    ...toPublicAgentSession(session),
    // A stopped or failed session's transcript is not going to change, and
    // most of them are old: reading the tail for every one of them on every
    // poll is a statSync plus a 256KB read for nothing. Only the sessions
    // that can still move get one.
    lastLines:
      session.transcriptPath && session.state !== 'stopped' && session.state !== 'failed'
        ? readTranscriptTail(session.transcriptPath, TAIL_LIMIT)
        : [],
  }));

  return NextResponse.json({ sessions });
}
