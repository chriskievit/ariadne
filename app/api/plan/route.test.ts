import { describe, it, expect, vi, beforeEach } from 'vitest';
import { openDb } from '@/lib/db';

const testDb = openDb(':memory:');
vi.mock('@/lib/db-instance', () => ({ db: testDb }));

const { GET, POST } = await import('./route');

beforeEach(() => {
  testDb.exec('DELETE FROM plan_items; DELETE FROM plans;');
});

describe('/api/plan', () => {
  it('returns the default plan and empty items for an unplanned date', async () => {
    const res = await GET(new Request('http://localhost/api/plan?date=2026-08-14'));
    const body = await res.json();
    expect(body.plan.date).toBe('2026-08-14');
    expect(body.items).toEqual([]);
  });

  it('updates capacity and note', async () => {
    const res = await POST(
      new Request('http://localhost/api/plan', {
        method: 'POST',
        body: JSON.stringify({ date: '2026-08-14', capacityMinutes: 240, note: 'Light day' }),
      })
    );
    const body = await res.json();
    expect(body).toEqual({ date: '2026-08-14', capacityMinutes: 240, note: 'Light day' });
  });
});
