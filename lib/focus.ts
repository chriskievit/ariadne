import type { Item } from './types';
import type { AgentSessionState } from './types';

// Zero-dependency (see lib/date.ts) so FocusView can import it from a
// 'use client' component and the test can run it without a database.

type FocusItem = Pick<Item, 'id' | 'status' | 'parked'>;

export interface FocusSelection<T extends FocusItem> {
  // The one item the Now pane shows, or null when nothing is started.
  now: T | null;
  // Today's plan, minus what is finished and minus `now`, in plan order.
  upNext: T[];
  // In progress, not parked, not on Today and not `now`: work that is open
  // but that this screen otherwise would not mention at all.
  alsoInProgress: number;
}

/**
 * What Focus shows, worked out from Planning's own buckets.
 *
 * `today` and `inProgress` are getGroupedItems()'s buckets as they are, so
 * Focus can never disagree with Planning about what is on today's plan or
 * what is in progress. Nothing here ranks: Today keeps its hand-set plan
 * order, and the choice of `now` is a fixed rule, not a score.
 *
 * `now` is the item the timer runs on, because that is the thread you are
 * holding. Without a timer it falls back to the first started item on
 * today's plan, then to any started item, so an item started with no timer
 * still reads as the thing you are on. A parked item is set aside, so it is
 * never `now`.
 */
export function selectFocus<T extends FocusItem>(
  today: readonly T[],
  inProgress: readonly T[],
  runningItemId: number | null
): FocusSelection<T> {
  const open = (i: T) => i.status !== 'done';
  const started = (i: T) => i.status === 'in_progress' && !i.parked;

  const byId = new Map<number, T>();
  for (const item of [...today, ...inProgress]) byId.set(item.id, item);

  const timed = runningItemId !== null ? byId.get(runningItemId) : undefined;
  const now = timed ?? today.filter(open).find(started) ?? inProgress.find(started) ?? null;

  const todayIds = new Set(today.map((i) => i.id));
  const upNext = today.filter((i) => open(i) && i.id !== now?.id);
  const alsoInProgress = inProgress.filter((i) => started(i) && !todayIds.has(i.id) && i.id !== now?.id).length;

  return { now, upNext, alsoInProgress };
}

type WaitingSession = { state: AgentSessionState; endedAt: string | null };

// Only a live session asking for you. A dismissed one keeps whatever state
// it last had (dismissAgentSession leaves state alone), so endedAt is what
// stops a session nobody is tracking any more from calling you back.
export function waitingOnYou<T extends WaitingSession>(sessions: readonly T[]): T[] {
  return sessions.filter((s) => s.state === 'needs_you' && s.endedAt === null);
}
