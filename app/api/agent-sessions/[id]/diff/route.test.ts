import { describe, it, expect, vi, beforeEach } from 'vitest';
import { openDb } from '@/lib/db';
import { createAdhocItem } from '@/lib/items-repo';
import { createAgentSession, applyAgentSessionPatch } from '@/lib/agent-sessions-repo';

const testDb = openDb(':memory:');
vi.mock('@/lib/db-instance', () => ({ db: testDb }));

// Route behaviour under test, not git's: Task 1 covers the subprocess and
// Task 2 covers this composition, so the route only needs to see whatever
// readSessionDiff hands back.
const readSessionDiff = vi.fn(async () => ({
  available: true as const,
  branch: 'feature/x',
  base: 'abc',
  files: [],
  patch: '',
  truncated: false,
}));
vi.mock('@/lib/agent-worktree', () => ({ readSessionDiff }));

const { GET } = await import('./route');

let itemId: number;

function get(id: number) {
  return GET(new Request('http://localhost/x'), { params: Promise.resolve({ id: String(id) }) });
}

beforeEach(() => {
  testDb.exec('DELETE FROM agent_sessions; DELETE FROM items;');
  readSessionDiff.mockClear();
  itemId = createAdhocItem(testDb, { title: 'Fix the pipeline' }).id;
});

describe('GET /api/agent-sessions/[id]/diff', () => {
  it('404s for a session that does not exist', async () => {
    const res = await get(99999);
    expect(res.status).toBe(404);
  });

  it('404s for a non-numeric id instead of erroring', async () => {
    const res = await GET(new Request('http://localhost/x'), { params: Promise.resolve({ id: 'not-a-number' }) });
    expect(res.status).toBe(404);
  });

  it('answers available:false when the session never reported a cwd', async () => {
    const session = createAgentSession(testDb, {
      itemId, agent: 'claude', launchToken: 'tok', tabTitle: 't', tabColor: 'yellow',
    });

    const res = await get(session.id);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.available).toBe(false);
    expect(typeof body.reason).toBe('string');
    expect(body.reason.length).toBeGreaterThan(0);
    expect(readSessionDiff).not.toHaveBeenCalled();
  });

  it('hands back the diff for a session with a cwd', async () => {
    const session = createAgentSession(testDb, {
      itemId, agent: 'claude', launchToken: 'tok', tabTitle: 't', tabColor: 'yellow',
    });
    applyAgentSessionPatch(testDb, session.id, { cwd: '/repos/pipelines' });

    const res = await get(session.id);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(readSessionDiff).toHaveBeenCalledWith('/repos/pipelines');
    expect(body).toEqual({
      available: true,
      branch: 'feature/x',
      base: 'abc',
      files: [],
      patch: '',
      truncated: false,
    });
  });

  it('never includes the launch token', async () => {
    const session = createAgentSession(testDb, {
      itemId, agent: 'claude', launchToken: 'super-secret-token', tabTitle: 't', tabColor: 'yellow',
    });
    applyAgentSessionPatch(testDb, session.id, { cwd: '/repos/pipelines' });

    const res = await get(session.id);
    const body = await res.json();

    expect(JSON.stringify(body)).not.toContain('super-secret-token');
  });
});
