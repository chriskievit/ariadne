import { describe, it, expect, vi, beforeEach } from 'vitest';
import { openDb } from '@/lib/db';
import { createAdhocItem } from '@/lib/items-repo';
import { createAgentSession, getAgentSessionById } from '@/lib/agent-sessions-repo';

const testDb = openDb(':memory:');
vi.mock('@/lib/db-instance', () => ({ db: testDb }));

const { POST } = await import('./route');

let sessionId: number;
const TOKEN = 'tok-aaaaaaaaaaaaaaaa';

function post(token: string, body: unknown) {
  return POST(new Request('http://localhost/api/agent-hooks/x', { method: 'POST', body: JSON.stringify(body) }), {
    params: Promise.resolve({ token }),
  });
}

beforeEach(() => {
  testDb.exec('DELETE FROM agent_sessions; DELETE FROM items;');
  const itemId = createAdhocItem(testDb, { title: 'Fix the pipeline' }).id;
  sessionId = createAgentSession(testDb, {
    itemId, agent: 'claude', launchToken: TOKEN, tabTitle: 't', tabColor: 'yellow',
  }).id;
});

describe('POST /api/agent-hooks/[token]', () => {
  it('registers the session on SessionStart', async () => {
    const res = await post(TOKEN, {
      hook_event_name: 'SessionStart',
      session_id: 'sess-9',
      transcript_path: '/t/sess-9.jsonl',
      cwd: '/w/pipelines',
      model: 'claude-opus-5',
    });

    expect(res.status).toBe(200);
    const session = getAgentSessionById(testDb, sessionId);
    expect(session?.state).toBe('working');
    expect(session?.agentSessionId).toBe('sess-9');
    expect(session?.transcriptPath).toBe('/t/sess-9.jsonl');
  });

  it('blocks the session on a Notification raised while working', async () => {
    await post(TOKEN, { hook_event_name: 'SessionStart', session_id: 's' });
    await post(TOKEN, { hook_event_name: 'Notification', message: 'Needs permission', notification_type: 'permission' });

    const session = getAgentSessionById(testDb, sessionId);
    expect(session?.state).toBe('needs_you');
    expect(session?.needsYouMessage).toBe('Needs permission');
  });

  // A stale settings file from a deleted session must never break the agent
  // that is still running with it.
  it('answers 200 for an unknown token without touching anything', async () => {
    const res = await post('tok-unknownaaaaaaaaa', { hook_event_name: 'Stop' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({});
    expect(getAgentSessionById(testDb, sessionId)?.state).toBe('launching');
  });

  it('answers 200 for a malformed body', async () => {
    const res = await POST(
      new Request('http://localhost/api/agent-hooks/x', { method: 'POST', body: 'not json' }),
      { params: Promise.resolve({ token: TOKEN }) }
    );
    expect(res.status).toBe(200);
    expect(getAgentSessionById(testDb, sessionId)?.state).toBe('launching');
  });

  it('answers 200 for an unrecognised event name', async () => {
    const res = await post(TOKEN, { hook_event_name: 'PreCompact' });
    expect(res.status).toBe(200);
    expect(getAgentSessionById(testDb, sessionId)?.state).toBe('launching');
  });
});
