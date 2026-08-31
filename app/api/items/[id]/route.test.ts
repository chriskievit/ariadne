import { describe, it, expect, vi, beforeEach } from 'vitest';
import { openDb } from '@/lib/db';
import { createAdhocItem, getItemById } from '@/lib/items-repo';
import { startTimer, completeTimer } from '@/lib/time-logs-repo';
import { addPlanItem, getPlanItems } from '@/lib/plans-repo';

const testDb = openDb(':memory:');
vi.mock('@/lib/db-instance', () => ({ db: testDb }));

const { DELETE: deleteRoute } = await import('./route');

let itemId: number;

beforeEach(() => {
  testDb.exec('DELETE FROM plan_items; DELETE FROM item_links; DELETE FROM time_logs; DELETE FROM items;');
  itemId = createAdhocItem(testDb, { title: 'Test item' }).id;
});

const del = (id: number) =>
  deleteRoute(new Request('http://localhost', { method: 'DELETE' }), {
    params: Promise.resolve({ id: String(id) }),
  });

describe('DELETE /api/items/[id]', () => {
  it('deletes the item', async () => {
    const res = await del(itemId);

    expect(res.status).toBe(200);
    expect(getItemById(testDb, itemId)).toBeUndefined();
  });

  it("deletes an item that is on a day's plan, and its plan membership with it", async () => {
    addPlanItem(testDb, '2026-08-31', itemId);

    const res = await del(itemId);

    expect(res.status).toBe(200);
    expect(getItemById(testDb, itemId)).toBeUndefined();
    expect(getPlanItems(testDb, '2026-08-31')).toEqual([]);
  });

  it('refuses an item with logged time with a 400, not a 500', async () => {
    startTimer(testDb, itemId);
    completeTimer(testDb, itemId, { durationHours: 1.5 });

    const res = await del(itemId);

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: 'This item has logged time and cannot be deleted. Park it instead.',
    });
    expect(getItemById(testDb, itemId)).toBeDefined();
  });

  it('refuses an item whose timer is still running', async () => {
    startTimer(testDb, itemId);

    const res = await del(itemId);

    expect(res.status).toBe(400);
    expect(getItemById(testDb, itemId)).toBeDefined();
  });
});
