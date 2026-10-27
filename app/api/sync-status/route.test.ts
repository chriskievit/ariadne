import { describe, it, expect, vi } from 'vitest';
import { openDb } from '@/lib/db';
import { setSetting } from '@/lib/settings-repo';
import { SETTINGS_KEYS } from '@/lib/config';

const testDb = openDb(':memory:');
vi.mock('@/lib/db-instance', () => ({ db: testDb }));

const { GET } = await import('./route');

describe('GET /api/sync-status', () => {
  it('returns only the sources that are set up', async () => {
    expect(await (await GET()).json()).toEqual([]);
    setSetting(testDb, SETTINGS_KEYS.githubPat, 'gh-pat');
    const body = await (await GET()).json();
    expect(body.map((s: any) => s.source)).toEqual(['github']);
  });
});
