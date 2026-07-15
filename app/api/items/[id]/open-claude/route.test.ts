import { describe, it, expect, vi, beforeEach } from 'vitest';
import { openDb } from '@/lib/db';
import { createAdhocItem, upsertSyncedItem } from '@/lib/items-repo';
import { setSetting } from '@/lib/settings-repo';
import { SETTINGS_KEYS } from '@/lib/config';

const testDb = openDb(':memory:');
vi.mock('@/lib/db-instance', () => ({ db: testDb }));

const writeLaunchConfig = vi.fn();
vi.mock('@/lib/warp-launch', () => ({
  writeLaunchConfig: (...args: unknown[]) => writeLaunchConfig(...args),
  WARP_LAUNCH_URL: 'warp://launch/activitydash',
}));

const { POST } = await import('./route');

beforeEach(() => {
  testDb.exec('DELETE FROM items; DELETE FROM settings;');
  writeLaunchConfig.mockClear();
});

describe('POST /api/items/[id]/open-claude', () => {
  it('resolves the working dir from the item repo and writes the launch config', async () => {
    setSetting(testDb, SETTINGS_KEYS.localReposBaseDir, '/Users/chris/dev/github');
    const item = upsertSyncedItem(testDb, {
      source: 'github_pr',
      externalId: '1',
      title: 'Test PR',
      url: null,
      reason: 'authored',
      dueDate: null,
      sprintIteration: null,
      rawUpdatedAt: null,
      repo: 'repo-a',
    });

    const res = await POST(new Request('http://localhost', { method: 'POST', body: '{}' }), {
      params: { id: String(item.id) },
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ warpUrl: 'warp://launch/activitydash' });
    expect(writeLaunchConfig).toHaveBeenCalledWith('/Users/chris/dev/github/repo-a');
  });

  it('uses an explicit workingDir from the body over resolution', async () => {
    const item = createAdhocItem(testDb, { title: 'Ad-hoc' });

    const res = await POST(
      new Request('http://localhost', { method: 'POST', body: JSON.stringify({ workingDir: '/explicit/path' }) }),
      { params: { id: String(item.id) } }
    );

    expect(res.status).toBe(200);
    expect(writeLaunchConfig).toHaveBeenCalledWith('/explicit/path');
  });

  it('returns 400 when no working directory can be resolved', async () => {
    const item = createAdhocItem(testDb, { title: 'Ad-hoc' });

    const res = await POST(new Request('http://localhost', { method: 'POST', body: '{}' }), {
      params: { id: String(item.id) },
    });

    expect(res.status).toBe(400);
    expect(writeLaunchConfig).not.toHaveBeenCalled();
  });

  it('returns 404 for a missing item', async () => {
    const res = await POST(new Request('http://localhost', { method: 'POST', body: '{}' }), {
      params: { id: '999999' },
    });

    expect(res.status).toBe(404);
  });
});
