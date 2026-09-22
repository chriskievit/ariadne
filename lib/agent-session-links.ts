import type { AgentSession, AgentSessionState } from './types';

// Only what Planning needs from a session. Structural rather than the whole
// row, so this never depends on the transcript or the launch token.
export type LiveSessionSummary = Pick<AgentSession, 'id' | 'itemId' | 'state' | 'endedAt' | 'registeredAt' | 'createdAt'>;

/**
 * The live session on each item, for a Planning surface that needs to know
 * whether acting on an item would strand an agent.
 *
 * "Live" is `endedAt === null` and never a state check. A session the
 * reconciler marked failed for never reporting in keeps a null endedAt on
 * purpose, so that a late SessionStart can revive it -- and so that Ariadne
 * does not quietly stop mentioning a process that may well still be running.
 * That is exactly the case a park or complete dialog most needs to raise.
 */
export function liveSessionsByItem<T extends LiveSessionSummary>(sessions: readonly T[]): Map<number, T> {
  const byItem = new Map<number, T>();
  for (const session of sessions) {
    if (session.endedAt !== null) continue;
    // One session per ticket is enforced at launch, so a second here means
    // something unusual happened. The newest is the one a dialog should talk
    // about, because it is the one the user most recently started.
    const existing = byItem.get(session.itemId);
    if (!existing || session.id > existing.id) byItem.set(session.itemId, session);
  }
  return byItem;
}

export function liveSessionFor<T extends LiveSessionSummary>(map: Map<number, T>, itemId: number): T | undefined {
  return map.get(itemId);
}
