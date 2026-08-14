import { describe, it, expect, vi, beforeEach } from 'vitest';
import { openDb } from '@/lib/db';
import { createAdhocItem, setStatus } from '@/lib/items-repo';
import { addPlanItem, setPlanItemEstimate } from '@/lib/plans-repo';
import { localDateString } from '@/lib/date';

const testDb = openDb(':memory:');
vi.mock('@/lib/db-instance', () => ({ db: testDb }));

const { GET: summary } = await import('./route');

beforeEach(() => {
  testDb.exec('DELETE FROM time_logs; DELETE FROM plan_items; DELETE FROM items;');
});

describe('GET /api/today/summary', () => {
  it("returns today's plan with each done item carrying hoursLoggedToday", async () => {
    const item = createAdhocItem(testDb, { title: 'Test item' });
    testDb.prepare('UPDATE items SET today_date = ? WHERE id = ?').run(localDateString(new Date()), item.id);
    setStatus(testDb, item.id, 'in_progress'); // clears today_date
    setStatus(testDb, item.id, 'done', new Date().toISOString());
    testDb
      .prepare('INSERT INTO time_logs (item_id, started_at, ended_at, duration_hours) VALUES (?, ?, ?, ?)')
      .run(item.id, new Date().toISOString(), new Date().toISOString(), 2);

    const res = await summary();
    const body = await res.json();
    expect(body.doneToday).toHaveLength(1);
    expect(body.doneToday[0].hoursLoggedToday).toBe(2);
    expect(body.hoursLoggedToday).toBe(2);
  });

  it('carries the plan_items estimate for a done item, and null when there is none', async () => {
    const dateStr = localDateString(new Date());
    const estimated = createAdhocItem(testDb, { title: 'Estimated' });
    addPlanItem(testDb, dateStr, estimated.id);
    setPlanItemEstimate(testDb, dateStr, estimated.id, 30);
    setStatus(testDb, estimated.id, 'in_progress');
    setStatus(testDb, estimated.id, 'done', new Date().toISOString());

    const unestimated = createAdhocItem(testDb, { title: 'Unestimated' });
    testDb.prepare('UPDATE items SET today_date = ? WHERE id = ?').run(dateStr, unestimated.id);
    setStatus(testDb, unestimated.id, 'in_progress');
    setStatus(testDb, unestimated.id, 'done', new Date().toISOString());

    const res = await summary();
    const body = await res.json();
    const byTitle = (title: string) => body.doneToday.find((i: { title: string }) => i.title === title);
    expect(byTitle('Estimated').estimateMinutes).toBe(30);
    expect(byTitle('Unestimated').estimateMinutes).toBeNull();
  });

  it('returns a still-open planned item with no hoursLoggedToday enrichment needed', async () => {
    const item = createAdhocItem(testDb, { title: 'Still open' });
    testDb.prepare('UPDATE items SET today_date = ? WHERE id = ?').run(localDateString(new Date()), item.id);

    const res = await summary();
    const body = await res.json();
    expect(body.planned).toHaveLength(1);
    expect(body.planned[0].id).toBe(item.id);
    expect(body.doneToday).toHaveLength(0);
  });
});
