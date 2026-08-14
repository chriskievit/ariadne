import { describe, it, expect, vi } from 'vitest';
import { openDb } from '@/lib/db';

const testDb = openDb(':memory:');
vi.mock('@/lib/db-instance', () => ({ db: testDb }));

const { GET } = await import('./route');

describe('GET /api/sync-status', () => {
  it('returns both sources', async () => {
    const body = await (await GET()).json();
    expect(body.map((s: any) => s.source)).toEqual(['github', 'ado']);
  });
});
