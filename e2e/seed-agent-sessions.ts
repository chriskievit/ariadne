import { openDb } from '../lib/db';
import { createAdhocItem } from '../lib/items-repo';
import { createAgentSession, applyAgentSessionPatch } from '../lib/agent-sessions-repo';
import { E2E_DB_PATH } from './db-path';

// Agent sessions cannot be produced through the UI under test: launching one
// writes a Warp tab config and opens it. Seed straight into the sqlite file
// the dev server points at, the same way seed-needs-you.ts does.
export function seedAgentSessions(suffix: string): {
  workingTitle: string;
  needsYouTitle: string;
  neverRegisteredTitle: string;
  endedTitle: string;
} {
  const db = openDb(E2E_DB_PATH);
  try {
    const base = `${Date.now()}${suffix}`;
    const titles = {
      workingTitle: `Agent working ${base}`,
      needsYouTitle: `Agent needs you ${base}`,
      neverRegisteredTitle: `Agent never registered ${base}`,
      endedTitle: `Agent ended ${base}`,
    };

    function launch(title: string) {
      const item = createAdhocItem(db, { title });
      return createAgentSession(db, {
        itemId: item.id,
        agent: 'claude',
        launchToken: `${base}-${title}`,
        tabTitle: title,
        tabColor: 'yellow',
      });
    }

    const working = launch(titles.workingTitle);
    applyAgentSessionPatch(db, working.id, {
      state: 'working',
      registeredAt: new Date().toISOString(),
      lastEventAt: new Date().toISOString(),
    });

    const needsYou = launch(titles.needsYouTitle);
    applyAgentSessionPatch(db, needsYou.id, {
      state: 'needs_you',
      registeredAt: new Date().toISOString(),
      lastEventAt: new Date().toISOString(),
    });

    // No registeredAt and a created_at well past the launch window, so the
    // reconciler in listSessionsForDisplay marks it on the first read. This
    // is the state Claude Code's folder-trust prompt actually produces.
    const never = launch(titles.neverRegisteredTitle);
    db.prepare('UPDATE agent_sessions SET created_at = ? WHERE id = ?').run(
      new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      never.id
    );

    const ended = launch(titles.endedTitle);
    applyAgentSessionPatch(db, ended.id, {
      state: 'stopped',
      registeredAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      endReason: 'closed',
    });

    return titles;
  } finally {
    db.close();
  }
}
