import { describe, it, expect, vi, beforeEach } from 'vitest';
import { openDb } from '@/lib/db';
import { createAdhocItem } from '@/lib/items-repo';

const testDb = openDb(':memory:');
vi.mock('@/lib/db-instance', () => ({ db: testDb }));

const { POST } = await import('./route');

beforeEach(() => {
  testDb.exec('DELETE FROM items;');
});

describe('POST /api/items/:id/star', () => {
  it('stars an item', async () => {
    const item = createAdhocItem(testDb, { title: 'Star me' });
    const res = await POST(
      new Request('http://localhost/api/items/1/star', { method: 'POST', body: JSON.stringify({ starred: true }) }),
      { params: { id: String(item.id) } }
    );
    const body = await res.json();
    expect(body.starred).toBe(true);
  });

  it('unstars an item', async () => {
    const item = createAdhocItem(testDb, { title: 'Unstar me' });
    await POST(
      new Request('http://localhost/api/items/1/star', { method: 'POST', body: JSON.stringify({ starred: true }) }),
      { params: { id: String(item.id) } }
    );
    const res = await POST(
      new Request('http://localhost/api/items/1/star', { method: 'POST', body: JSON.stringify({ starred: false }) }),
      { params: { id: String(item.id) } }
    );
    const body = await res.json();
    expect(body.starred).toBe(false);
  });
});
