import { describe, it, expect, vi, beforeEach } from 'vitest';
import { openDb } from '@/lib/db';
import { upsertSyncedItem, getItemById, setTodayDate } from '@/lib/items-repo';
import { getRunningTimer } from '@/lib/time-logs-repo';
import { addPlanItem, getPlanItems } from '@/lib/plans-repo';
import { localDateString } from '@/lib/date';

const testDb = openDb(':memory:');
vi.mock('@/lib/db-instance', () => ({ db: testDb }));

const { POST } = await import('./route');

beforeEach(() => {
  testDb.exec('DELETE FROM time_logs; DELETE FROM plan_items; DELETE FROM items;');
});

function createItem(title: string) {
  return upsertSyncedItem(testDb, {
    source: 'ado_workitem',
    externalId: title,
    title,
    url: null,
    reason: 'assigned',
    dueDate: null,
    sprintIteration: null,
    rawUpdatedAt: null,
    repo: null,
  });
}

describe('POST /api/items/:id/start', () => {
  it('sets the item in_progress and starts its timer by default', async () => {
    const item = createItem('Started normally');

    await POST(new Request('http://localhost', { method: 'POST' }), { params: Promise.resolve({ id: String(item.id) }) });

    expect(getItemById(testDb, item.id)?.status).toBe('in_progress');
    expect(getRunningTimer(testDb)?.itemId).toBe(item.id);
  });

  it('sets the item in_progress without starting a timer when withTimer is false', async () => {
    const item = createItem('Started via link cascade');

    await POST(
      new Request('http://localhost', { method: 'POST', body: JSON.stringify({ withTimer: false }) }),
      { params: Promise.resolve({ id: String(item.id) }) }
    );

    expect(getItemById(testDb, item.id)?.status).toBe('in_progress');
    expect(getRunningTimer(testDb)).toBeNull();
  });

  it('never leaves two items with an open timer, even across two start calls', async () => {
    const first = createItem('First');
    const second = createItem('Second');

    await POST(new Request('http://localhost', { method: 'POST' }), { params: Promise.resolve({ id: String(first.id) }) });
    await POST(new Request('http://localhost', { method: 'POST' }), { params: Promise.resolve({ id: String(second.id) }) });

    expect(getRunningTimer(testDb)?.itemId).toBe(second.id);
  });

  it("moves a today-pinned item to the top of today's plan order when started", async () => {
    const first = createItem('First');
    const second = createItem('Second');
    const today = localDateString(new Date());
    setTodayDate(testDb, first.id, today);
    setTodayDate(testDb, second.id, today);
    addPlanItem(testDb, today, first.id);
    addPlanItem(testDb, today, second.id);

    await POST(new Request('http://localhost', { method: 'POST' }), { params: Promise.resolve({ id: String(second.id) }) });

    expect(getPlanItems(testDb, today).map((pi) => pi.itemId)).toEqual([second.id, first.id]);
  });

  it("leaves today's plan order untouched when starting an item that isn't on today's plan", async () => {
    const item = createItem('Not pinned');

    await POST(new Request('http://localhost', { method: 'POST' }), { params: Promise.resolve({ id: String(item.id) }) });

    expect(getPlanItems(testDb, localDateString(new Date()))).toEqual([]);
  });
});
