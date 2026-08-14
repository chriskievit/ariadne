import { describe, it, expect, vi, beforeEach } from 'vitest';
import { openDb } from '@/lib/db';
import { createAdhocItem } from '@/lib/items-repo';

const testDb = openDb(':memory:');
vi.mock('@/lib/db-instance', () => ({ db: testDb }));

const { POST, DELETE } = await import('./route');

beforeEach(() => {
  testDb.exec('DELETE FROM plan_items; DELETE FROM plans; DELETE FROM items;');
});

describe('/api/plan/items', () => {
  it('adds an item to the plan', async () => {
    const item = createAdhocItem(testDb, { title: 'Pick me' });
    const res = await POST(
      new Request('http://localhost/api/plan/items', {
        method: 'POST',
        body: JSON.stringify({ date: '2026-08-14', itemId: item.id }),
      })
    );
    expect((await res.json()).itemId).toBe(item.id);
  });

  it('removes an item from the plan', async () => {
    const item = createAdhocItem(testDb, { title: 'Remove me' });
    await POST(
      new Request('http://localhost/api/plan/items', {
        method: 'POST',
        body: JSON.stringify({ date: '2026-08-14', itemId: item.id }),
      })
    );
    const res = await DELETE(
      new Request('http://localhost/api/plan/items?date=2026-08-14&itemId=' + item.id, { method: 'DELETE' })
    );
    expect(res.status).toBe(204);
  });
});
