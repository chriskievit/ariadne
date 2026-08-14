import { describe, it, expect, vi, beforeEach } from 'vitest';
import { openDb } from '@/lib/db';
import { createAdhocItem, getItemById } from '@/lib/items-repo';
import { localDateString, addDays } from '@/lib/date';
import { getPlanItems } from '@/lib/plans-repo';

const testDb = openDb(':memory:');
vi.mock('@/lib/db-instance', () => ({ db: testDb }));

const { POST: pinToday, DELETE: unpinToday } = await import('./route');

let itemId: number;

beforeEach(() => {
  testDb.exec('DELETE FROM time_logs; DELETE FROM plan_items; DELETE FROM plans; DELETE FROM items;');
  itemId = createAdhocItem(testDb, { title: 'Test item' }).id;
});

describe('POST /api/items/[id]/today', () => {
  it('defaults to today when no date is given', async () => {
    const res = await pinToday(new Request('http://localhost', { method: 'POST', body: '{}' }), {
      params: { id: String(itemId) },
    });
    expect(res.status).toBe(200);
    expect((await res.json()).todayDate).toBe(localDateString(new Date()));
  });

  it('sets a given date (e.g. tomorrow, for carry-to-tomorrow)', async () => {
    const tomorrow = addDays(localDateString(new Date()), 1);
    const res = await pinToday(
      new Request('http://localhost', { method: 'POST', body: JSON.stringify({ date: tomorrow }) }),
      { params: { id: String(itemId) } }
    );
    expect((await res.json()).todayDate).toBe(tomorrow);
  });
});

describe('DELETE /api/items/[id]/today', () => {
  it('clears today_date', async () => {
    await pinToday(new Request('http://localhost', { method: 'POST', body: '{}' }), { params: { id: String(itemId) } });
    const res = await unpinToday(new Request('http://localhost', { method: 'DELETE' }), {
      params: { id: String(itemId) },
    });
    expect((await res.json()).todayDate).toBeNull();
    expect(getItemById(testDb, itemId)?.todayDate).toBeNull();
  });
});

describe('POST /api/items/[id]/today plan integration', () => {
  it('adds the item to the plan for the pinned date', async () => {
    await pinToday(
      new Request('http://localhost', { method: 'POST', body: JSON.stringify({ date: '2026-08-20' }) }),
      { params: { id: String(itemId) } }
    );
    const items = getPlanItems(testDb, '2026-08-20');
    expect(items.map((i) => i.itemId)).toEqual([itemId]);
  });
});

describe('DELETE /api/items/[id]/today plan integration', () => {
  it('removes the item from its plan when unpinned', async () => {
    await pinToday(new Request('http://localhost', { method: 'POST', body: '{}' }), { params: { id: String(itemId) } });
    const today = localDateString(new Date());
    await unpinToday(new Request('http://localhost', { method: 'DELETE' }), { params: { id: String(itemId) } });
    expect(getPlanItems(testDb, today)).toEqual([]);
  });
});
