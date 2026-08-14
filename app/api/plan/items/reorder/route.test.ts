import { describe, it, expect, vi, beforeEach } from 'vitest';
import { openDb } from '@/lib/db';
import { createAdhocItem } from '@/lib/items-repo';
import { addPlanItem } from '@/lib/plans-repo';

const testDb = openDb(':memory:');
vi.mock('@/lib/db-instance', () => ({ db: testDb }));

const { PUT } = await import('./route');

beforeEach(() => {
  testDb.exec('DELETE FROM plan_items; DELETE FROM plans; DELETE FROM items;');
});

describe('PUT /api/plan/items/reorder', () => {
  it('reassigns sort order', async () => {
    const a = createAdhocItem(testDb, { title: 'A' });
    const b = createAdhocItem(testDb, { title: 'B' });
    addPlanItem(testDb, '2026-08-14', a.id);
    addPlanItem(testDb, '2026-08-14', b.id);

    const res = await PUT(
      new Request('http://localhost/api/plan/items/reorder', {
        method: 'PUT',
        body: JSON.stringify({ date: '2026-08-14', orderedItemIds: [b.id, a.id] }),
      })
    );
    const body = await res.json();
    expect(body.map((i: any) => i.itemId)).toEqual([b.id, a.id]);
  });
});
