import { describe, it, expect, vi } from 'vitest';
import { openDb } from '@/lib/db';
import { upsertSyncedItem, setStatus } from '@/lib/items-repo';
import { startTimer, completeTimer } from '@/lib/time-logs-repo';

const testDb = openDb(':memory:');
vi.mock('@/lib/db-instance', () => ({ db: testDb }));

const { GET } = await import('./route');

function request(query: string) {
  return new Request(`http://localhost/api/report${query}`);
}

describe('/api/report', () => {
  it('returns a time report for a valid range', async () => {
    const item = upsertSyncedItem(testDb, {
      source: 'github_pr',
      externalId: 'gh-1',
      title: 'PR',
      url: null,
      reason: 'authored',
      dueDate: null,
      sprintIteration: null,
      rawUpdatedAt: null,
      repo: null,
    });
    setStatus(testDb, item.id, 'done', '2026-07-01T10:00:00.000Z');
    const log = startTimer(testDb, item.id);
    testDb.prepare('UPDATE time_logs SET started_at = ? WHERE id = ?').run('2026-07-01T09:00:00.000Z', log.id);
    completeTimer(testDb, item.id, { durationHours: 2 });

    const res = await GET(request('?start=2026-07-01&end=2026-07-02'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totalsBySource.github_pr).toBe(2);
    expect(body.dailySeries).toEqual([{ date: '2026-07-01', github_pr: 2, ado_workitem: 0, adhoc: 0 }]);
  });

  it('returns 400 when start or end is missing', async () => {
    const res = await GET(request('?start=2026-07-01'));
    expect(res.status).toBe(400);
  });

  it('returns 400 when start is after end', async () => {
    const res = await GET(request('?start=2026-07-05&end=2026-07-01'));
    expect(res.status).toBe(400);
  });
});
