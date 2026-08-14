import { describe, it, expect, vi, beforeEach } from 'vitest';
import { openDb } from '@/lib/db';
import { createAdhocItem } from '@/lib/items-repo';
import { addPlanItem, setPlanItemEstimate } from '@/lib/plans-repo';

const testDb = openDb(':memory:');
vi.mock('@/lib/db-instance', () => ({ db: testDb }));

const { GET } = await import('./route');

beforeEach(() => {
  testDb.exec('DELETE FROM time_logs; DELETE FROM plan_items; DELETE FROM items;');
});

describe('GET /api/calibration', () => {
  it('returns an empty array when there is nothing planned in range', async () => {
    const res = await GET(new Request('http://localhost/api/calibration?start=2026-08-14&end=2026-08-14'));
    const body = await res.json();
    expect(body).toEqual([]);
  });

  it('returns a calibration entry once a plan_item with logged time exists in range', async () => {
    const item = createAdhocItem(testDb, { title: 'Review this' });
    addPlanItem(testDb, '2026-08-14', item.id);
    setPlanItemEstimate(testDb, '2026-08-14', item.id, 30);
    testDb
      .prepare('INSERT INTO time_logs (item_id, started_at, ended_at, duration_hours) VALUES (?, ?, ?, ?)')
      .run(item.id, '2026-08-14T10:00:00.000Z', '2026-08-14T11:00:00.000Z', 1);

    const res = await GET(new Request('http://localhost/api/calibration?start=2026-08-14&end=2026-08-14'));
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].estimateMinutes).toBe(30);
    expect(body[0].actualMinutes).toBe(60);
  });
});
