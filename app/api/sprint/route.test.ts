import { describe, it, expect, vi } from 'vitest';
import { openDb } from '@/lib/db';
import { setSetting } from '@/lib/settings-repo';
import { SETTINGS_KEYS } from '@/lib/config';

const testDb = openDb(':memory:');
vi.mock('@/lib/db-instance', () => ({ db: testDb }));

const { GET } = await import('./route');

describe('/api/sprint', () => {
  it('returns sprint progress from settings and items', async () => {
    setSetting(testDb, SETTINGS_KEYS.sprintName, 'Sprint 42');
    setSetting(testDb, SETTINGS_KEYS.sprintStart, '2026-06-29T00:00:00.000Z');
    setSetting(testDb, SETTINGS_KEYS.sprintEnd, '2026-07-12T00:00:00.000Z');

    const res = await GET();
    const body = await res.json();
    expect(body.name).toBe('Sprint 42');
    expect(body).toHaveProperty('totalCount');
    expect(body).toHaveProperty('completedCount');
  });
});
