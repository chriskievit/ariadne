import { describe, it, expect, vi, beforeEach } from 'vitest';
import { openDb } from '@/lib/db';
import { createAdhocItem } from '@/lib/items-repo';

const testDb = openDb(':memory:');
vi.mock('@/lib/db-instance', () => ({ db: testDb }));

const { POST } = await import('./route');

beforeEach(() => {
  testDb.exec('DELETE FROM items;');
});

describe('POST /api/items/:id/done', () => {
  it('marks an item locally done and reverses it', async () => {
    const item = createAdhocItem(testDb, { title: 'Done me' });
    const res = await POST(
      new Request('http://localhost/api/items/1/done', { method: 'POST', body: JSON.stringify({ done: true }) }),
      { params: Promise.resolve({ id: String(item.id) }) }
    );
    expect((await res.json()).triageState).toBe('done');

    const undone = await POST(
      new Request('http://localhost/api/items/1/done', { method: 'POST', body: JSON.stringify({ done: false }) }),
      { params: Promise.resolve({ id: String(item.id) }) }
    );
    expect((await undone.json()).triageState).toBe('none');
  });
});
