import { describe, it, expect, vi } from 'vitest';
import { openDb } from '@/lib/db';

const testDb = openDb(':memory:');
vi.mock('@/lib/db-instance', () => ({ db: testDb }));
vi.mock('@/lib/sync', () => ({
  runSync: vi.fn().mockResolvedValue([
    { source: 'github', itemCount: 2, error: null },
    { source: 'ado', itemCount: 1, error: null },
  ]),
}));

const { POST } = await import('./route');

describe('/api/sync', () => {
  it('returns outcomes from runSync', async () => {
    const res = await POST();
    const body = await res.json();
    expect(body.outcomes).toHaveLength(2);
    expect(body.outcomes[0].source).toBe('github');
  });
});
