import { describe, it, expect, vi, beforeEach } from 'vitest';
import { openDb } from '@/lib/db';
import { upsertSyncedItem, setStatus } from '@/lib/items-repo';

const testDb = openDb(':memory:');
vi.mock('@/lib/db-instance', () => ({ db: testDb }));

const { GET, POST } = await import('./route');

beforeEach(() => {
  testDb.exec('DELETE FROM items; DELETE FROM time_logs; DELETE FROM settings;');
});

describe('GET /api/items', () => {
  it('returns the grouped items from getGroupedItems', async () => {
    const urgent = upsertSyncedItem(testDb, {
      source: 'github_pr',
      externalId: '1@a/b',
      title: 'Ready to merge',
      url: null,
      reason: 'approved_unmerged',
      dueDate: null,
      sprintIteration: null,
      rawUpdatedAt: null,
    });

    const res = await GET();
    const body = await res.json();
    expect(body.needsAttention.map((i: any) => i.id)).toEqual([urgent.id]);
    expect(body.inProgress).toEqual([]);
    expect(body.everythingElse).toEqual([]);
  });
});

describe('POST /api/items', () => {
  it('creates an ad-hoc item', async () => {
    const res = await POST(
      new Request('http://localhost/api/items', {
        method: 'POST',
        body: JSON.stringify({ title: 'Reply to Sarah', category: 'meeting' }),
      })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.title).toBe('Reply to Sarah');
    expect(body.source).toBe('adhoc');
  });
});
