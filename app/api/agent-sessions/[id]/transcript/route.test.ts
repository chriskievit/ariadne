import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDb } from '@/lib/db';
import { createAdhocItem } from '@/lib/items-repo';
import { createAgentSession, applyAgentSessionPatch } from '@/lib/agent-sessions-repo';

const testDb = openDb(':memory:');
vi.mock('@/lib/db-instance', () => ({ db: testDb }));

const { GET } = await import('./route');
const { PANE_TAIL_LIMIT } = await import('@/lib/agent-transcript');

let itemId: number;
let dir: string;

function get(id: number | string) {
  return GET(new Request('http://localhost/x'), { params: Promise.resolve({ id: String(id) }) });
}

function writeTranscript(lines: unknown[]): string {
  dir = mkdtempSync(join(tmpdir(), 'ariadne-pane-transcript-test-'));
  const path = join(dir, 'session.jsonl');
  writeFileSync(path, lines.map((line) => JSON.stringify(line)).join('\n') + '\n', 'utf8');
  return path;
}

beforeEach(() => {
  testDb.exec('DELETE FROM agent_sessions; DELETE FROM items;');
  itemId = createAdhocItem(testDb, { title: 'Fix the pipeline' }).id;
});

afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
});

describe('GET /api/agent-sessions/[id]/transcript', () => {
  it('404s for a session that does not exist', async () => {
    const res = await get(99999);
    expect(res.status).toBe(404);
  });

  it('404s for a non-numeric id instead of erroring', async () => {
    const res = await get('not-a-number');
    expect(res.status).toBe(404);
  });

  it('returns an empty list when the session has no transcript path yet', async () => {
    const session = createAgentSession(testDb, {
      itemId, agent: 'claude', launchToken: 'tok', tabTitle: 't', tabColor: 'yellow',
    });

    const res = await get(session.id);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ entries: [] });
  });

  it('returns the tail for a session that has one, beyond the rail\'s five-turn limit', async () => {
    // Seven turns: more than the rail's TAIL_LIMIT of 5, so a route that
    // (wrongly) reused the rail's limit would drop the earliest two and this
    // assertion on all seven would catch it.
    const path = writeTranscript(
      Array.from({ length: 7 }, (_, i) => ({
        type: 'assistant',
        timestamp: `2026-09-21T10:00:0${i}.000Z`,
        message: { role: 'assistant', content: [{ type: 'text', text: `msg ${i}` }] },
      }))
    );
    const session = createAgentSession(testDb, {
      itemId, agent: 'claude', launchToken: 'tok', tabTitle: 't', tabColor: 'yellow',
    });
    applyAgentSessionPatch(testDb, session.id, { transcriptPath: path });

    const res = await get(session.id);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.entries).toHaveLength(7);
    expect(body.entries.map((e: { text: string }) => e.text)).toEqual([
      'msg 0', 'msg 1', 'msg 2', 'msg 3', 'msg 4', 'msg 5', 'msg 6',
    ]);
  });

  it('returns entries oldest-first, so the pane reads downward', async () => {
    const path = writeTranscript([
      { type: 'user', timestamp: '2026-09-21T10:00:00.000Z', message: { role: 'user', content: 'FIRST_MARKER' } },
      {
        type: 'assistant',
        timestamp: '2026-09-21T10:00:05.000Z',
        message: { role: 'assistant', content: [{ type: 'text', text: 'LAST_MARKER' }] },
      },
    ]);
    const session = createAgentSession(testDb, {
      itemId, agent: 'claude', launchToken: 'tok', tabTitle: 't', tabColor: 'yellow',
    });
    applyAgentSessionPatch(testDb, session.id, { transcriptPath: path });

    const res = await get(session.id);
    const body = await res.json();

    expect(body.entries[0].text).toBe('FIRST_MARKER');
    expect(body.entries[1].text).toBe('LAST_MARKER');
  });

  it('exposes the pane limit as 50, well beyond the rail\'s 5', () => {
    expect(PANE_TAIL_LIMIT).toBe(50);
  });
});
