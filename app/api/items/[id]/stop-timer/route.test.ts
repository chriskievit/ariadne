import { describe, it, expect, vi, beforeEach } from 'vitest';
import { openDb } from '@/lib/db';
import { createAdhocItem, setStatus } from '@/lib/items-repo';
import { startTimer, listLogsByItem } from '@/lib/time-logs-repo';

const testDb = openDb(':memory:');
vi.mock('@/lib/db-instance', () => ({ db: testDb }));

const { POST } = await import('./route');

beforeEach(() => {
  testDb.exec('DELETE FROM time_logs; DELETE FROM items;');
});

describe('POST /api/items/:id/stop-timer', () => {
  it('stops the running timer without changing status', async () => {
    const item = createAdhocItem(testDb, { title: 'Running' });
    setStatus(testDb, item.id, 'in_progress');
    startTimer(testDb, item.id);

    const res = await POST(new Request('http://localhost', { method: 'POST' }), { params: Promise.resolve({ id: String(item.id) }) });
    const body = await res.json();
    expect(body.status).toBe('in_progress');
    expect(listLogsByItem(testDb, item.id)[0].endedAt).not.toBeNull();
  });
});
