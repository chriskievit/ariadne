import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDb } from '@/lib/db';
import { createAdhocItem } from '@/lib/items-repo';
import { createAgentSession, applyAgentSessionPatch, getAgentSessionById } from '@/lib/agent-sessions-repo';
import { writeSessionTabConfig, sessionTabConfigName } from '@/lib/agent-launch';
import { writeHookSettings } from '@/lib/agent-hooks-config';

const testDb = openDb(':memory:');
vi.mock('@/lib/db-instance', () => ({ db: testDb }));

let tabDir: string;

vi.mock('@/lib/agent-paths', () => ({
  agentTabConfigDir: () => tabDir,
  agentSettingsDir: () => tabDir,
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

beforeEach(() => {
  testDb.exec('DELETE FROM agent_sessions; DELETE FROM items;');
  tabDir = mkdtempSync(join(tmpdir(), 'ariadne-tabs-'));
  itemId = createAdhocItem(testDb, { title: 'Fix the pipeline' }).id;
});

afterEach(() => {
  rmSync(tabDir, { recursive: true, force: true });
});

describe('POST /api/agent-sessions/[id]/dismiss', () => {
  it('ends a live session and returns it', async () => {
    const session = createAgentSession(testDb, {
      itemId, agent: 'claude', launchToken: 'tok-live', tabTitle: 't', tabColor: 'yellow',
    });
    applyAgentSessionPatch(testDb, session.id, { state: 'working', registeredAt: new Date().toISOString() });

    const res = await post(session.id);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.session.id).toBe(session.id);
    expect(body.session.endedAt).not.toBeNull();
    expect(body.session.endReason).toBe('dismissed');
    // The state Claude Code last reported is left alone. Dismissing does not
    // pretend the session finished cleanly.
    expect(body.session.state).toBe('working');
    expect(getAgentSessionById(testDb, session.id)?.endedAt).not.toBeNull();
  });

  it('404s for an unknown session', async () => {
    const res = await post(99999);
    expect(res.status).toBe(404);
  });

  // The launch token is the hook credential. A browser reading this response
  // must never receive it, dismissed session or not.
  it('does not return the launch token', async () => {
    const session = createAgentSession(testDb, {
      itemId, agent: 'claude', launchToken: 'super-secret-token', tabTitle: 't', tabColor: 'yellow',
    });

    const res = await post(session.id);
    const body = await res.json();

    expect(JSON.stringify(body)).not.toContain('launchToken');
    expect(JSON.stringify(body)).not.toContain('super-secret-token');
  });

  it('removes the session\'s tab config so it cannot be reopened by accident', async () => {
    const session = createAgentSession(testDb, {
      itemId, agent: 'claude', launchToken: 'tok-tab', tabTitle: 't', tabColor: 'yellow',
    });
    writeSessionTabConfig(
      { sessionId: session.id, title: 't', color: 'yellow', directory: tabDir, command: 'claude' },
      tabDir
    );
    expect(existsSync(tabConfigPath(session.id))).toBe(true);

    await post(session.id);

    expect(existsSync(tabConfigPath(session.id))).toBe(false);
  });

  it("removes the session's hook settings file so its token does not sit on disk", async () => {
    const session = createAgentSession(testDb, {
      itemId, agent: 'claude', launchToken: 'tok-settings-abcdefgh', tabTitle: 't', tabColor: 'yellow',
    });
    const settingsPath = writeHookSettings(tabDir, session.launchToken, 'http://127.0.0.1:3000', null);
    expect(existsSync(settingsPath)).toBe(true);

    await post(session.id);

    expect(existsSync(settingsPath)).toBe(false);
  });

  it('dismisses successfully and warns, rather than failing, when the tab config cannot be removed', async () => {
    const session = createAgentSession(testDb, {
      itemId, agent: 'claude', launchToken: 'tok-stuck', tabTitle: 't', tabColor: 'yellow',
    });
    // A directory at the config's path makes the best-effort removal throw,
    // standing in for whatever real-world reason a file might not go away.
    mkdirSync(tabConfigPath(session.id));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      const res = await post(session.id);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.session.endedAt).not.toBeNull();
      expect(warn).toHaveBeenCalled();
    } finally {
      warn.mockRestore();
      rmSync(tabConfigPath(session.id), { recursive: true, force: true });
    }
  });

  it('leaves an already-ended session untouched', async () => {
    const session = createAgentSession(testDb, {
      itemId, agent: 'claude', launchToken: 'tok-ended', tabTitle: 't', tabColor: 'yellow',
    });
    applyAgentSessionPatch(testDb, session.id, {
      state: 'stopped',
      endedAt: '2026-09-20T09:00:00.000Z',
      endReason: 'closed',
    });

    const res = await post(session.id);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.session.endedAt).toBe('2026-09-20T09:00:00.000Z');
    expect(body.session.endReason).toBe('closed');
  });
});
