import type { AgentSession, AgentSessionState } from './types';

// Agent state moves in seconds, not minutes -- the dashboard's five-minute
// sync interval would make a running session feel stalled. Shared by
// WatchFloor (the rail) and SessionPane (the transcript and diff it polls
// once a session is selected), so the two halves of one screen cannot drift
// out of step with each other.
export const AGENT_POLL_INTERVAL_MS = 5000;

/**
 * The order the rail puts sessions in, and the reason for it.
 *
 * This is a fixed rule, not a score. There is exactly one ranking number in
 * Ariadne and it belongs to the score chip; a second one here would mean two
 * competing claims about what to look at first. The order is instead a
 * straight answer to "whose turn is it": the three states where the next
 * move is yours come first, then the two where it is the agent's, then the
 * ones that are over.
 *
 * `launching` sits below `working` deliberately. Both mean "nothing is being
 * asked of you", and of the two, launching is the one Ariadne knows least
 * about -- Claude Code's folder-trust prompt fires before SessionStart, so a
 * session can sit here for minutes while being perfectly healthy.
 */
export const ROSTER_BAND_ORDER: readonly AgentSessionState[] = [
  'needs_you',
  'failed',
  'ready',
  'working',
  'launching',
  'stopped',
] as const;

export const ROSTER_BAND_REASON: Record<AgentSessionState, string> = {
  needs_you: 'The agent asked you something and is waiting.',
  failed: 'It stopped without finishing. Nothing is running.',
  ready: 'It finished a turn. There is a diff to read.',
  working: 'It is running. Nothing is being asked of you.',
  launching: 'The tab is open. The agent has not reported in yet.',
  stopped: 'The session is closed.',
};

// The fields the ordering actually reads. Structural rather than the whole
// row, so this module never depends on the launch token or the transcript.
export type RosterSession = Pick<AgentSession, 'id' | 'state' | 'createdAt' | 'registeredAt' | 'lastEventAt'>;

/**
 * When this session entered the condition it is in now.
 *
 * Not `createdAt`: a session that has been working for an hour and one that
 * went quiet a minute ago are both "started this morning", and it is the
 * quiet one the rail must not push to the top.
 */
export function rosterWaitingSince(session: RosterSession): string {
  return session.lastEventAt ?? session.registeredAt ?? session.createdAt;
}

export function compareRoster(a: RosterSession, b: RosterSession): number {
  const bandDelta = ROSTER_BAND_ORDER.indexOf(a.state) - ROSTER_BAND_ORDER.indexOf(b.state);
  if (bandDelta !== 0) return bandDelta;

  // ISO-8601 strings, so lexicographic is chronological. Ascending, because
  // longest-waiting first is the whole point of the band.
  const waitDelta = rosterWaitingSince(a).localeCompare(rosterWaitingSince(b));
  if (waitDelta !== 0) return waitDelta;

  // A total order, not a nicety: the rail re-sorts on every poll, and two
  // sessions that tie on a same-second timestamp would otherwise be free to
  // swap places under the cursor every few seconds.
  return a.id - b.id;
}

export function sortRoster<T extends RosterSession>(sessions: readonly T[]): T[] {
  return [...sessions].sort(compareRoster);
}

// The fields ended-list ordering reads. Just the id and the timestamp that
// answers "what just happened" -- this module never needs the rest of the row.
export type EndedRosterSession = Pick<AgentSession, 'id' | 'endedAt'>;

/**
 * The order the Ended list puts closed sessions in, and why it is the
 * opposite of `compareRoster`.
 *
 * A live band answers "how long has this been waiting on me", so the
 * longest wait sorts first and pulls your attention to what has gone
 * stalest. A closed session asks nothing of you any more; the only useful
 * question left is "what just happened", so the one that closed most
 * recently belongs on top instead of buried under nine-year-old sessions
 * that happen to have a later id.
 */
export function compareEndedRoster(a: EndedRosterSession, b: EndedRosterSession): number {
  // Both rows come from the already-filtered ended set, so endedAt is never
  // actually null here; the fallback only keeps the comparator total if a
  // caller ever passes a live row by mistake.
  const endedDelta = (b.endedAt ?? '').localeCompare(a.endedAt ?? '');
  if (endedDelta !== 0) return endedDelta;

  // Same reasoning as compareRoster's id tiebreak: two sessions that ended in
  // the same second must not be free to swap order on every re-render.
  return b.id - a.id;
}

export function sortEndedRoster<T extends EndedRosterSession>(sessions: readonly T[]): T[] {
  return [...sessions].sort(compareEndedRoster);
}

export interface RosterBandCount {
  state: AgentSessionState;
  count: number;
}

/** Occupied bands only, in rail order. Drives the glance state's summary. */
export function rosterBandCounts(sessions: readonly RosterSession[]): RosterBandCount[] {
  return ROSTER_BAND_ORDER.map((state) => ({
    state,
    count: sessions.filter((session) => session.state === state).length,
  })).filter((band) => band.count > 0);
}

export interface RosterReferenceRow {
  state: AgentSessionState;
  reason: string;
}

/**
 * The published form of the rule, for the in-app reference dialog.
 *
 * Generated from the same constant the sort uses, so the dialog cannot drift
 * from the behaviour -- the same contract `getScoringReference()` holds for
 * the score.
 */
export function getRosterReference(): RosterReferenceRow[] {
  return ROSTER_BAND_ORDER.map((state) => ({ state, reason: ROSTER_BAND_REASON[state] }));
}
