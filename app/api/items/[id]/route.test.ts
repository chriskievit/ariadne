import { describe, it, expect, vi, beforeEach } from 'vitest';
import { openDb } from '@/lib/db';
import { createAdhocItem, getItemById } from '@/lib/items-repo';

const testDb = openDb(':memory:');
vi.mock('@/lib/db-instance', () => ({ db: testDb }));

const { DELETE: deleteRoute } = await import('./route');

let itemId: number;

beforeEach(() => {
  testDb.exec('DELETE FROM items; DELETE FROM time_logs;');
  itemId = createAdhocItem(testDb, { title: 'Test item' }).id;
});

describe('DELETE /api/items/[id]', () => {
  it('deletes the item', async () => {
    const res = await deleteRoute(new Request('http://localhost', { method: 'DELETE' }), {
      params: { id: String(itemId) },
    });
    expect(res.status).toBe(200);
    expect(getItemById(testDb, itemId)).toBeUndefined();
  });
});
