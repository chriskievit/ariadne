import { describe, it, expect, vi, beforeEach } from 'vitest';
import { openDb } from '@/lib/db';
import { createAdhocItem, upsertSyncedItem } from '@/lib/items-repo';

const testDb = openDb(':memory:');
vi.mock('@/lib/db-instance', () => ({ db: testDb }));

const { POST } = await import('./route');

beforeEach(() => {
  testDb.exec('DELETE FROM items;');
});

function post(id: number, priority: unknown) {
  return POST(
    new Request('http://localhost/api/items/1/priority', {
      method: 'POST',
      body: JSON.stringify({ priority }),
    }),
    { params: Promise.resolve({ id: String(id) }) }
  );
}

describe('POST /api/items/:id/priority', () => {
  it('sets a priority on an ad-hoc item and returns the updated row', async () => {
    const item = createAdhocItem(testDb, { title: 'Weigh me' });
    const res = await post(item.id, 'high');
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.priority).toBe('high');
    expect(body.prioritySetAt).not.toBeNull();
  });

  it('clears a priority when given null', async () => {
    const item = createAdhocItem(testDb, { title: 'Never mind', priority: 'high' });
    const body = await (await post(item.id, null)).json();
    expect(body.priority).toBeNull();
    expect(body.prioritySetAt).toBeNull();
  });

  it('rejects a value outside the scale', async () => {
    const item = createAdhocItem(testDb, { title: 'Nope' });
    const res = await post(item.id, 'urgent');
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/low, medium, high/);
  });

  // The refusal has to carry prose, not just a status code: an MCP client
  // shows the message to the model, and the row menu shows it in a toast.
  it('refuses a synced item with a message explaining why', async () => {
    const pr = upsertSyncedItem(testDb, {
      source: 'github_pr',
      externalId: 'gh-route-1',
      title: 'A PR',
      url: null,
      reason: 'authored',
      dueDate: null,
      sprintIteration: null,
      rawUpdatedAt: null,
      repo: 'x/y',
    });
    const res = await post(pr.id, 'high');
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Only ad-hoc items/);
  });
});
