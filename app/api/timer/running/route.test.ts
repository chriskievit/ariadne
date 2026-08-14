import { describe, it, expect, vi, beforeEach } from 'vitest';
import { openDb } from '@/lib/db';
import { createAdhocItem, setStatus } from '@/lib/items-repo';
import { startTimer } from '@/lib/time-logs-repo';

const testDb = openDb(':memory:');
vi.mock('@/lib/db-instance', () => ({ db: testDb }));

const { GET } = await import('./route');

beforeEach(() => {
  testDb.exec('DELETE FROM time_logs; DELETE FROM items;');
});

describe('GET /api/timer/running', () => {
  it('returns null when nothing is running', async () => {
    expect(await (await GET()).json()).toBeNull();
  });

  it('returns the running item', async () => {
    const item = createAdhocItem(testDb, { title: 'Running' });
    setStatus(testDb, item.id, 'in_progress');
    startTimer(testDb, item.id);
    const body = await (await GET()).json();
    expect(body.itemId).toBe(item.id);
  });
});
