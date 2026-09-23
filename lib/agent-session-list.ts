import type Database from 'better-sqlite3';
import {
  listOpenAgentSessions,
  listAgentSessions,
  applyAgentSessionPatch,
  toPublicAgentSession,
  type PublicAgentSession,
} from './agent-sessions-repo';
import { isNeverRegistered } from './agent-session-state';
import { readTranscriptTail, type TranscriptEntry } from './agent-transcript';
import { getPlanItems } from './plans-repo';
import { localDateString } from './date';

// How many transcript turns ride along with the list. Enough to show what a
// session is doing without turning the list endpoint into a log shipper.
export const TAIL_LIMIT = 5;

// How many ended sessions stay visible after they close. Unbounded would
// mean this re-reads every session that ever existed, forever; ten is enough
// that a just-finished session does not vanish from under you.
export const RECENT_ENDED_LIMIT = 10;

export interface SessionListEntry extends PublicAgentSession {
  lastLines: TranscriptEntry[];
  // Whether this session's item sits in today's plan_items, not whether
  // items.today_date happens to match -- the two can disagree (a plan
  // built through add_plan_item never touches today_date), and plan_items
  // is what Planning's Today concept actually tracks now. See
  // setStatus in lib/items-repo.ts for why today_date is legacy but still
  // present.
  onTodayPlan: boolean;
}

/**
 * Every session worth showing, reconciled and ready to render.
 *
 * Shared by the `/work` page, which calls it on the server at request time,
 * and by `GET /api/agent-sessions`, which the same page polls afterwards.
 * One function, so the first paint and every poll after it cannot disagree
 * about what a session is doing.
 */
export function listSessionsForDisplay(db: Database.Database, now: Date): SessionListEntry[] {
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

  // Hoisted so the table backing this list is read exactly once per call,
  // after reconciliation has had its say.
  const allSessions = listAgentSessions(db);
  const open = allSessions.filter((session) => session.endedAt === null);
  const recentlyEnded = allSessions
    .filter((session) => session.endedAt !== null)
    .sort((a, b) => (b.endedAt as string).localeCompare(a.endedAt as string))
    .slice(0, RECENT_ENDED_LIMIT);

  // One query for the whole day's plan, not one per session: plan_items for
  // a single date is a handful of rows at most, so this is a flat cost per
  // poll (both the rail's and Planning's) regardless of how many sessions
  // are on screen. A per-session lookup here would turn a bounded read into
  // an N+1 on every 5-second poll.
  const todayItemIds = new Set(getPlanItems(db, localDateString(now)).map((planItem) => planItem.itemId));

  return [...open, ...recentlyEnded].map((session) => ({
    ...toPublicAgentSession(session),
    // A stopped or failed session's transcript is not going to change, and
    // most of them are old: reading the tail for every one of them on every
    // poll is a statSync plus a 256KB read for nothing. Only the sessions
    // that can still move get one.
    lastLines:
      session.transcriptPath && session.state !== 'stopped' && session.state !== 'failed'
        ? readTranscriptTail(session.transcriptPath, TAIL_LIMIT)
        : [],
    onTodayPlan: todayItemIds.has(session.itemId),
  }));
}
