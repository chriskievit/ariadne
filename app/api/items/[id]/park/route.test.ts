import { describe, it, expect, vi, beforeEach } from 'vitest';
import { openDb } from '@/lib/db';
import { upsertSyncedItem, setStatus } from '@/lib/items-repo';
import { startTimer, listLogsByItem } from '@/lib/time-logs-repo';

const testDb = openDb(':memory:');
vi.mock('@/lib/db-instance', () => ({ db: testDb }));

const { POST } = await import('./route');

beforeEach(() => {
  testDb.exec('DELETE FROM time_logs; DELETE FROM items;');
});

describe('POST /api/items/:id/park', () => {
  it('stops the running timer when parking', async () => {
    const item = upsertSyncedItem(testDb, {
      source: 'ado_workitem',
      externalId: '1',
      title: 'Parked with a running timer',
      url: null,
      reason: 'assigned',
      dueDate: null,
      sprintIteration: null,
      rawUpdatedAt: null,
      repo: null,
    });
    setStatus(testDb, item.id, 'in_progress');
    startTimer(testDb, item.id);

    await POST(new Request('http://localhost', { method: 'POST' }), { params: Promise.resolve({ id: String(item.id) }) });

    const logs = listLogsByItem(testDb, item.id);
    expect(logs).toHaveLength(1);
    expect(logs[0].endedAt).not.toBeNull();
  });
});
