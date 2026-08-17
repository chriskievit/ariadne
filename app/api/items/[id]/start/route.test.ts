import { describe, it, expect, vi, beforeEach } from 'vitest';
import { openDb } from '@/lib/db';
import { upsertSyncedItem, getItemById } from '@/lib/items-repo';
import { getRunningTimer } from '@/lib/time-logs-repo';

const testDb = openDb(':memory:');
vi.mock('@/lib/db-instance', () => ({ db: testDb }));

const { POST } = await import('./route');

beforeEach(() => {
  testDb.exec('DELETE FROM time_logs; DELETE FROM items;');
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
});
