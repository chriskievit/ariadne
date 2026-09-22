import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDb } from '@/lib/db';
import { createAdhocItem } from '@/lib/items-repo';
import {
  createAgentSession,
  applyAgentSessionPatch,
  listAgentSessions,
  getAgentSessionById,
} from '@/lib/agent-sessions-repo';
import { sessionWarpUrl, sessionTabConfigName } from '@/lib/agent-launch';
import { hookSettingsPath } from '@/lib/agent-hooks-config';

const testDb = openDb(':memory:');
vi.mock('@/lib/db-instance', () => ({ db: testDb }));

let tabDir: string;
let settingsDir: string;

vi.mock('@/lib/agent-paths', () => ({
  agentTabConfigDir: () => tabDir,
  agentSettingsDir: () => settingsDir,
}));

const { POST } = await import('./route');

let itemId: number;

function post(id: number) {
  return POST(new Request('http://localhost/x', { method: 'POST' }), {
    params: Promise.resolve({ id: String(id) }),
  });
}

function tabConfigPath(sessionId: number): string {
  return join(tabDir, `${sessionTabConfigName(sessionId)}.toml`);
}

// A launching-to-ready-ish session that already picked up an agent session
// id, the minimum SessionStart hands back before anything is resumable.
function createLiveSession(overrides: Partial<Parameters<typeof applyAgentSessionPatch>[2]> = {}) {
  const session = createAgentSession(testDb, {
    itemId,
    agent: 'claude',
    launchToken: `tok-${Math.random().toString(36).slice(2)}`,
    tabTitle: 'pipeline',
    tabColor: 'yellow',
  });
  applyAgentSessionPatch(testDb, session.id, {
    state: 'working',
    registeredAt: new Date().toISOString(),
    agentSessionId: 'claude-sess-abc123',
    cwd: '/repo/checkout',
    ...overrides,
  });
  return getAgentSessionById(testDb, session.id)!;
}

function createEndedSession(overrides: Partial<Parameters<typeof applyAgentSessionPatch>[2]> = {}) {
  return createLiveSession({
    state: 'stopped',
    endedAt: '2026-09-20T09:00:00.000Z',
    endReason: 'closed',
    ...overrides,
  });
}

beforeEach(() => {
  testDb.exec('DELETE FROM agent_sessions; DELETE FROM items;');
  tabDir = mkdtempSync(join(tmpdir(), 'ariadne-tabs-'));
  settingsDir = mkdtempSync(join(tmpdir(), 'ariadne-settings-'));
  itemId = createAdhocItem(testDb, { title: 'Fix the pipeline' }).id;
});

afterEach(() => {
  for (const dir of [tabDir, settingsDir]) rmSync(dir, { recursive: true, force: true });
});

describe('POST /api/agent-sessions/[id]/resume', () => {
  it('404s for an unknown session', async () => {
    const res = await post(99999);
    expect(res.status).toBe(404);
  });

  it('400s when the agent has never reported a session id', async () => {
    const session = createLiveSession({ agentSessionId: null });
    const res = await post(session.id);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(typeof body.error).toBe('string');
    expect(listAgentSessions(testDb)).toHaveLength(1);
  });

  it('400s for an agent that cannot resume', async () => {
    const session = createAgentSession(testDb, {
      itemId,
      agent: 'codex',
      launchToken: 'tok-codex',
      tabTitle: 'pipeline',
      tabColor: 'yellow',
    });
    applyAgentSessionPatch(testDb, session.id, { agentSessionId: 'codex-sess-1', cwd: '/repo/checkout' });

    const res = await post(session.id);
    expect(res.status).toBe(400);
  });

  it('400s for a session id that is not a plain identifier', async () => {
    const session = createLiveSession({ agentSessionId: 'sess; rm -rf /' });
    const res = await post(session.id);
    expect(res.status).toBe(400);
  });

  it('400s when the session never reported a working directory', async () => {
    const session = createLiveSession({ cwd: null });
    const res = await post(session.id);
    expect(res.status).toBe(400);
  });

  it('reuses the same session row while the session is still live', async () => {
    const session = createLiveSession();

    const res = await post(session.id);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.warpUrl).toBe(sessionWarpUrl(session.id));
    expect(body.session.id).toBe(session.id);
    expect(listAgentSessions(testDb)).toHaveLength(1);

    const toml = readFileSync(tabConfigPath(session.id), 'utf8');
    expect(toml).toContain('claude --resume \\"claude-sess-abc123\\"');
    expect(toml).toContain(hookSettingsPath(settingsDir, session.launchToken));
    expect(toml).toContain('/repo/checkout');
  });

  it('creates a new session row once the old one has ended, leaving the old row untouched', async () => {
    const old = createEndedSession();

    const res = await post(old.id);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.session.id).not.toBe(old.id);
    expect(body.session.itemId).toBe(itemId);
    expect(body.warpUrl).toBe(sessionWarpUrl(body.session.id));

    const sessions = listAgentSessions(testDb);
    expect(sessions).toHaveLength(2);

    const stillOld = getAgentSessionById(testDb, old.id)!;
    expect(stillOld.endedAt).toBe('2026-09-20T09:00:00.000Z');
    expect(stillOld.endReason).toBe('closed');
    expect(stillOld.launchToken).toBe(old.launchToken);

    const fresh = getAgentSessionById(testDb, body.session.id)!;
    expect(fresh.launchToken).not.toBe(old.launchToken);
    expect(fresh.endedAt).toBeNull();

    const toml = readFileSync(tabConfigPath(fresh.id), 'utf8');
    expect(toml).toContain('claude --resume \\"claude-sess-abc123\\"');
    expect(toml).toContain(hookSettingsPath(settingsDir, fresh.launchToken));
    expect(existsSync(hookSettingsPath(settingsDir, fresh.launchToken))).toBe(true);
  });

  it('refuses when another live session already holds the ticket', async () => {
    const old = createEndedSession();
    createLiveSession(); // a second, live session on the same item

    const res = await post(old.id);
    expect(res.status).toBe(400);
    expect(listAgentSessions(testDb)).toHaveLength(2);
  });

  it('never returns the launch token', async () => {
    const session = createLiveSession();
    const res = await post(session.id);
    const body = await res.json();

    expect(JSON.stringify(body)).not.toContain('launchToken');
    expect(JSON.stringify(body)).not.toContain(session.launchToken);
  });

  it('marks the new row failed, not left launching, when the tab config write fails', async () => {
    const old = createEndedSession();

    // Same trick as the launch route's equivalent test: point the tab config
    // dir at a path nested under a plain file, so mkdirSync can never create
    // into it.
    const originalTabDir = tabDir;
    const blockerFile = join(originalTabDir, 'blocker');
    writeFileSync(blockerFile, '');
    tabDir = join(blockerFile, 'nested');
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      const res = await post(old.id);
      expect(res.status).toBe(500);

      const sessions = listAgentSessions(testDb);
      expect(sessions).toHaveLength(2);
      const fresh = sessions.find((s) => s.id !== old.id)!;
      expect(fresh.state).toBe('failed');
      expect(fresh.endReason).toBe('launch_failed');
      expect(error).toHaveBeenCalled();
    } finally {
      tabDir = originalTabDir;
      error.mockRestore();
    }
  });

  it('answers 500 and leaves the row alone when the live branch\'s tab config write fails', async () => {
    const session = createLiveSession();

    const originalTabDir = tabDir;
    const blockerFile = join(originalTabDir, 'blocker');
    writeFileSync(blockerFile, '');
    tabDir = join(blockerFile, 'nested');
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      const res = await post(session.id);
      expect(res.status).toBe(500);

      // No row was created and the live one was never touched -- there is
      // nothing here for commitAgentSessionLaunch's failure handling to
      // correct, unlike the ended branch, which creates a row first.
      expect(listAgentSessions(testDb)).toHaveLength(1);
      const untouched = getAgentSessionById(testDb, session.id)!;
      expect(untouched.state).toBe('working');
      expect(untouched.endedAt).toBeNull();
      expect(error).toHaveBeenCalled();
    } finally {
      tabDir = originalTabDir;
      error.mockRestore();
    }
  });
});
