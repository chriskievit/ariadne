import { openDb } from '../lib/db';
import { createAdhocItem } from '../lib/items-repo';
import { createAgentSession, applyAgentSessionPatch } from '../lib/agent-sessions-repo';
import type { AgentSessionState } from '../lib/types';
import { E2E_DB_PATH } from './db-path';

// Three ad-hoc items, one per session state the day proposal treats
// differently: working (out of the pool, listed), needs_you (out of the pool,
// counted), ready (in the pool, sized as a review). Seeded straight into the
// e2e database because no route moves a session on without a real agent
// sending hooks.
export function seedSuggestSessions(stamp: number): { working: string; needsYou: string; ready: string } {
  const titles = {
    working: `Suggest agent working ${stamp}`,
    needsYou: `Suggest agent needs you ${stamp}`,
    ready: `Suggest agent finished ${stamp}`,
  };
  const states: Record<keyof typeof titles, AgentSessionState> = {
    working: 'working',
    needsYou: 'needs_you',
    ready: 'ready',
  };

  const db = openDb(E2E_DB_PATH);
  try {
    for (const key of Object.keys(titles) as (keyof typeof titles)[]) {
      const item = createAdhocItem(db, { title: titles[key] });
      const session = createAgentSession(db, {
        itemId: item.id,
        agent: 'claude',
        launchToken: `suggest-${stamp}-${key}`,
        tabTitle: titles[key],
        tabColor: 'yellow',
      });
      const now = new Date().toISOString();
      applyAgentSessionPatch(db, session.id, { state: states[key], registeredAt: now, lastEventAt: now });
    }
  } finally {
    db.close();
  }
  return titles;
}
