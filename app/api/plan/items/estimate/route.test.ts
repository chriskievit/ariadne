import { describe, it, expect, vi, beforeEach } from 'vitest';
import { openDb } from '@/lib/db';
import { createAdhocItem } from '@/lib/items-repo';
import { addPlanItem, getPlanItems } from '@/lib/plans-repo';

const testDb = openDb(':memory:');
vi.mock('@/lib/db-instance', () => ({ db: testDb }));

const { POST } = await import('./route');

beforeEach(() => {
  testDb.exec('DELETE FROM plan_items; DELETE FROM plans; DELETE FROM items;');
});

describe('POST /api/plan/items/estimate', () => {
  it('sets an estimate in minutes', async () => {
    const item = createAdhocItem(testDb, { title: 'Estimate me' });
    addPlanItem(testDb, '2026-08-14', item.id);
    await POST(
      new Request('http://localhost/api/plan/items/estimate', {
        method: 'POST',
        body: JSON.stringify({ date: '2026-08-14', itemId: item.id, minutes: 90 }),
      })
    );
    expect(getPlanItems(testDb, '2026-08-14')[0].estimateMinutes).toBe(90);
  });
});
