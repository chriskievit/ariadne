import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDb } from '@/lib/db';
import { createAdhocItem } from '@/lib/items-repo';
import { createAgentSession, applyAgentSessionPatch, getAgentSessionById } from '@/lib/agent-sessions-repo';
import { LAUNCH_REGISTRATION_TIMEOUT_MS } from '@/lib/agent-session-state';

const testDb = openDb(':memory:');
vi.mock('@/lib/db-instance', () => ({ db: testDb }));

const { GET } = await import('./route');
// Driving the real hook route rather than calling applyHookEvent directly:
// this exercises the same endedAt-null guard the hook handler relies on to
// decide a session is still revivable, not just the state machine in
// isolation.
const { POST: hookPost } = await import('../agent-hooks/[token]/route');

// Mirrors RECENT_ENDED_LIMIT in route.ts. Not imported because the route
// does not export it; kept here so the window-boundary tests read the same
// number they assert against.
const RECENT_ENDED_LIMIT = 10;

let itemId: number;
let dir: string;

beforeEach(() => {
  testDb.exec('DELETE FROM agent_sessions; DELETE FROM items;');
  itemId = createAdhocItem(testDb, { title: 'Fix the pipeline' }).id;
});

afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
});

function makeSession(token: string) {
  return createAgentSession(testDb, {
    itemId, agent: 'claude', launchToken: token, tabTitle: 't', tabColor: 'yellow',
  });
}

describe('GET /api/agent-sessions', () => {
  it('returns sessions with their state', async () => {
    const session = makeSession('tok-listaaaaaaaaaaaa');
    const body = await (await GET()).json();

    expect(body.sessions).toHaveLength(1);
    expect(body.sessions[0].id).toBe(session.id);
    expect(body.sessions[0].state).toBe('launching');
    expect(body.sessions[0].lastLines).toEqual([]);
  });

  // Claude Code's folder-trust prompt fires before SessionStart, so a session
  // launched into an untrusted folder never reports in at all. It must not
  // sit in launching for ever pretending to be about to start.
  it('fails a launching session that never registered past the timeout', async () => {
    const session = makeSession('tok-staleaaaaaaaaaaa');
    testDb
      .prepare('UPDATE agent_sessions SET created_at = ? WHERE id = ?')
      .run(new Date(Date.now() - LAUNCH_REGISTRATION_TIMEOUT_MS - 1000).toISOString(), session.id);

    const body = await (await GET()).json();

    expect(body.sessions[0].state).toBe('failed');
    expect(body.sessions[0].endReason).toBe('never_registered');
    expect(getAgentSessionById(testDb, session.id)?.state).toBe('failed');
  });

  it('leaves a registered session alone however old it is', async () => {
    const session = makeSession('tok-liveaaaaaaaaaaaa');
    applyAgentSessionPatch(testDb, session.id, { state: 'working', registeredAt: '2026-09-21T09:00:00.000Z' });
    testDb
      .prepare('UPDATE agent_sessions SET created_at = ? WHERE id = ?')
      .run('2026-01-01T00:00:00.000Z', session.id);

    const body = await (await GET()).json();
    expect(body.sessions[0].state).toBe('working');
  });

  it('includes the tail of the transcript when there is one', async () => {
    dir = mkdtempSync(join(tmpdir(), 'ariadne-sessions-test-'));
    const transcript = join(dir, 's.jsonl');
    writeFileSync(
      transcript,
      JSON.stringify({
        type: 'assistant',
        timestamp: '2026-09-21T10:00:00.000Z',
        message: { role: 'assistant', content: [{ type: 'text', text: 'Working on it.' }] },
      }) + '\n',
      'utf8'
    );

    const session = makeSession('tok-transcriptaaaaaa');
    applyAgentSessionPatch(testDb, session.id, {
      state: 'working',
      registeredAt: new Date().toISOString(),
      transcriptPath: transcript,
    });

    const body = await (await GET()).json();
    expect(body.sessions[0].lastLines).toEqual([
      { role: 'assistant', text: 'Working on it.', timestamp: '2026-09-21T10:00:00.000Z' },
    ]);
  });

  // The whole point of leaving endedAt null on a never-registered reconcile:
  // a hook that lands after the folder-trust prompt must be able to bring
  // the session back, not find a door that reconciliation already closed.
  it('lets a late SessionStart hook revive a session reconciliation marked failed', async () => {
    const session = makeSession('tok-revivedaaaaaaaaa');
    testDb
      .prepare('UPDATE agent_sessions SET created_at = ? WHERE id = ?')
      .run(new Date(Date.now() - LAUNCH_REGISTRATION_TIMEOUT_MS - 1000).toISOString(), session.id);

    const firstBody = await (await GET()).json();
    expect(firstBody.sessions[0].state).toBe('failed');
    expect(firstBody.sessions[0].endReason).toBe('never_registered');
    expect(getAgentSessionById(testDb, session.id)?.endedAt).toBeNull();

    await hookPost(
      new Request('http://localhost/x', {
        method: 'POST',
        body: JSON.stringify({
          hook_event_name: 'SessionStart',
          session_id: 'sess-late',
          transcript_path: '/t/sess-late.jsonl',
        }),
      }),
      { params: Promise.resolve({ token: session.launchToken }) }
    );

    const revived = getAgentSessionById(testDb, session.id);
    expect(revived?.state).toBe('working');
    expect(revived?.agentSessionId).toBe('sess-late');
  });

  it('does not return an ended session beyond the recent window', async () => {
    const old = makeSession('tok-old-endedaaaaaaaa');
    applyAgentSessionPatch(testDb, old.id, { state: 'stopped', endedAt: '2026-01-01T00:00:00.000Z' });

    for (let i = 0; i < RECENT_ENDED_LIMIT; i++) {
      const filler = makeSession(`tok-filler-${i}-aaaaaaaaaa`);
      applyAgentSessionPatch(testDb, filler.id, {
        state: 'stopped',
        endedAt: `2026-06-${String(10 + i).padStart(2, '0')}T00:00:00.000Z`,
      });
    }

    const body = await (await GET()).json();
    const ids = body.sessions.map((s: { id: number }) => s.id);
    expect(ids).not.toContain(old.id);
    expect(body.sessions).toHaveLength(RECENT_ENDED_LIMIT);
  });

  it('still returns a recently-ended session', async () => {
    const session = makeSession('tok-recent-endedaaaa');
    applyAgentSessionPatch(testDb, session.id, {
      state: 'stopped',
      endedAt: new Date().toISOString(),
    });

    const body = await (await GET()).json();
    expect(body.sessions.map((s: { id: number }) => s.id)).toContain(session.id);
  });

  it('gives a stopped session an empty transcript tail even when its file has content', async () => {
    dir = mkdtempSync(join(tmpdir(), 'ariadne-sessions-test-'));
    const transcript = join(dir, 's.jsonl');
    writeFileSync(
      transcript,
      JSON.stringify({
        type: 'assistant',
        timestamp: '2026-09-21T10:00:00.000Z',
        message: { role: 'assistant', content: [{ type: 'text', text: 'Still on disk.' }] },
      }) + '\n',
      'utf8'
    );

    const session = makeSession('tok-stopped-tailaaaa');
    applyAgentSessionPatch(testDb, session.id, {
      state: 'stopped',
      endedAt: new Date().toISOString(),
      transcriptPath: transcript,
    });

    const body = await (await GET()).json();
    expect(body.sessions[0].lastLines).toEqual([]);
  });

  it('never returns the launch token', async () => {
    makeSession('tok-no-leakaaaaaaaaaa');
    const body = await (await GET()).json();
    expect(body.sessions[0].launchToken).toBeUndefined();
  });
});
