import { describe, it, expect, vi, beforeEach } from 'vitest';
import { openDb } from '@/lib/db';
import { createAdhocItem, setStatus } from '@/lib/items-repo';
import { startTimer } from '@/lib/time-logs-repo';

const testDb = openDb(':memory:');
vi.mock('@/lib/db-instance', () => ({ db: testDb }));

const route = await import('./route');
const { GET } = route;

beforeEach(() => {
  testDb.exec('DELETE FROM time_logs; DELETE FROM items;');
});

describe('GET /api/timer/running', () => {
  it('opts out of static caching so pausing/resuming a timer is reflected on next fetch', () => {
    // GET has no dynamic API usage (no Request/cookies/headers), so Next.js
    // would otherwise statically cache this response at build time, e.g. the
    // header's Pause button would stop the timer server-side but the chip
    // would keep showing the stale cached "still running" snapshot forever.
    expect(route.dynamic).toBe('force-dynamic');
  });

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
