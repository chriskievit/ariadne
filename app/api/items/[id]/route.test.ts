import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDb } from '@/lib/db';
import { createAdhocItem, getItemById } from '@/lib/items-repo';
import { startTimer, completeTimer } from '@/lib/time-logs-repo';
import { addPlanItem, getPlanItems } from '@/lib/plans-repo';
import { createAgentSession, applyAgentSessionPatch, getAgentSessionsForItem } from '@/lib/agent-sessions-repo';
import { commitAgentSessionLaunch } from '@/lib/agent-session-launch';
import { getAgentDefinition } from '@/lib/agents';
import { sessionTabConfigName } from '@/lib/agent-launch';
import { hookSettingsPath } from '@/lib/agent-hooks-config';

const testDb = openDb(':memory:');
vi.mock('@/lib/db-instance', () => ({ db: testDb }));

let tabDir: string;
let settingsDir: string;

vi.mock('@/lib/agent-paths', () => ({
  agentTabConfigDir: () => tabDir,
  agentSettingsDir: () => settingsDir,
}));

const { DELETE: deleteRoute } = await import('./route');

let itemId: number;

// Writes the same two files a real launch does -- the Warp tab config and
// the hook settings file -- by calling the production write path directly
// rather than going through the HTTP launch route, so this test doesn't
// also have to stand up a configured local repo just to prove a delete
// cleans up after a launch.
function launchAgentAgainst(id: number): { sessionId: number; tabConfigPath: string; settingsPath: string } {
  const agent = getAgentDefinition('claude')!;
  const session = createAgentSession(testDb, {
    itemId: id, agent: 'claude', launchToken: 'tok-launched-abcdefgh', tabTitle: 't', tabColor: 'yellow',
  });
  commitAgentSessionLaunch(testDb, session, agent, tabDir, (options) => agent.buildCommand(options));
  return {
    sessionId: session.id,
    tabConfigPath: join(tabDir, `${sessionTabConfigName(session.id)}.toml`),
    settingsPath: hookSettingsPath(settingsDir, session.launchToken),
  };
}

beforeEach(() => {
  testDb.exec(
    'DELETE FROM plan_items; DELETE FROM item_links; DELETE FROM time_logs; DELETE FROM agent_sessions; DELETE FROM items;'
  );
  tabDir = mkdtempSync(join(tmpdir(), 'ariadne-tabs-'));
  settingsDir = mkdtempSync(join(tmpdir(), 'ariadne-settings-'));
  itemId = createAdhocItem(testDb, { title: 'Test item' }).id;
});

afterEach(() => {
  rmSync(tabDir, { recursive: true, force: true });
  rmSync(settingsDir, { recursive: true, force: true });
});

const del = (id: number) =>
  deleteRoute(new Request('http://localhost', { method: 'DELETE' }), {
    params: Promise.resolve({ id: String(id) }),
  });

describe('DELETE /api/items/[id]', () => {
  it('deletes the item', async () => {
    const res = await del(itemId);

    expect(res.status).toBe(200);
    expect(getItemById(testDb, itemId)).toBeUndefined();
  });

  it("deletes an item that is on a day's plan, and its plan membership with it", async () => {
    addPlanItem(testDb, '2026-08-31', itemId);

    const res = await del(itemId);

    expect(res.status).toBe(200);
    expect(getItemById(testDb, itemId)).toBeUndefined();
    expect(getPlanItems(testDb, '2026-08-31')).toEqual([]);
  });

  it('refuses an item with logged time with a 400, not a 500', async () => {
    startTimer(testDb, itemId);
    completeTimer(testDb, itemId, { durationHours: 1.5 });

    const res = await del(itemId);

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: 'This item has logged time and cannot be deleted. Park it instead.',
    });
    expect(getItemById(testDb, itemId)).toBeDefined();
  });

  it('refuses an item whose timer is still running', async () => {
    startTimer(testDb, itemId);

    const res = await del(itemId);

    expect(res.status).toBe(400);
    expect(getItemById(testDb, itemId)).toBeDefined();
  });

  // The reproduction from the review: launch an agent against an ad-hoc
  // item, then delete the item through this route. Before this fix, the
  // Warp tab config and the hook settings file (the launch token, and
  // ARIADNE_AUTH_TOKEN when set, in plaintext) both survived on disk --
  // still pointing at a session that no longer has a row, letting a
  // reopened tab start a second process whose hook events the receiver
  // could only drop.
  it('cleans up a live agent session\'s tab config and hook settings when its item is deleted', async () => {
    const { sessionId, tabConfigPath, settingsPath } = launchAgentAgainst(itemId);
    applyAgentSessionPatch(testDb, sessionId, { state: 'working', registeredAt: new Date().toISOString() });

    // Before: both files a launch writes are on disk, for a session that is
    // still live.
    expect(existsSync(tabConfigPath)).toBe(true);
    expect(existsSync(settingsPath)).toBe(true);

    const res = await del(itemId);

    // After: the item and its session row are gone, its Watch Floor entry
    // with them, and the tab config -- the file that could relaunch this
    // agent under a now-dead token -- is gone too. The settings file is a
    // live session's, so it is deliberately left: an agent this route has
    // no process handle on may still be reading it to fire its remaining
    // hooks.
    expect(res.status).toBe(200);
    expect(getItemById(testDb, itemId)).toBeUndefined();
    expect(getAgentSessionsForItem(testDb, itemId)).toEqual([]);
    expect(existsSync(tabConfigPath)).toBe(false);
    expect(existsSync(settingsPath)).toBe(true);
  });

  it("cleans up an already-ended agent session's tab config and hook settings when its item is deleted", async () => {
    const { sessionId, tabConfigPath, settingsPath } = launchAgentAgainst(itemId);
    applyAgentSessionPatch(testDb, sessionId, {
      state: 'stopped',
      endedAt: new Date().toISOString(),
      endReason: 'closed',
    });

    const res = await del(itemId);

    expect(res.status).toBe(200);
    expect(existsSync(tabConfigPath)).toBe(false);
    // Unlike the live case, nothing can still be reading this one: the
    // session had already ended before the item was deleted.
    expect(existsSync(settingsPath)).toBe(false);
  });

  it('does not touch disk for a refused delete', async () => {
    const { sessionId, tabConfigPath, settingsPath } = launchAgentAgainst(itemId);
    applyAgentSessionPatch(testDb, sessionId, {
      state: 'stopped',
      endedAt: new Date().toISOString(),
      endReason: 'closed',
    });
    startTimer(testDb, itemId);
    completeTimer(testDb, itemId, { durationHours: 1 });

    const res = await del(itemId);

    expect(res.status).toBe(400);
    // The item was never deleted, so cleaning up its session's files would
    // have been tidying up something still in use.
    expect(existsSync(tabConfigPath)).toBe(true);
    expect(existsSync(settingsPath)).toBe(true);
  });
});
