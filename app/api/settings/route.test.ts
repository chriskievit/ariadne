import { describe, it, expect, vi } from 'vitest';
import { openDb } from '@/lib/db';
import { SETTINGS_KEYS } from '@/lib/config';

const testDb = openDb(':memory:');
vi.mock('@/lib/db-instance', () => ({ db: testDb }));

const { GET, POST } = await import('./route');

describe('/api/settings', () => {
  it('saves and returns settings', async () => {
    const postRes = await POST(
      new Request('http://localhost/api/settings', {
        method: 'POST',
        body: JSON.stringify({ [SETTINGS_KEYS.githubPat]: 'abc123' }),
      })
    );
    expect(postRes.status).toBe(200);

    const getRes = await GET();
    const body = await getRes.json();
    expect(body[SETTINGS_KEYS.githubPat]).toBe('abc123');
  });
});
