import { describe, it, expect, vi, beforeEach } from 'vitest';
import { openDb } from '@/lib/db';
import { createAdhocItem } from '@/lib/items-repo';

const testDb = openDb(':memory:');
vi.mock('@/lib/db-instance', () => ({ db: testDb }));

const { POST, DELETE } = await import('./route');

beforeEach(() => {
  testDb.exec('DELETE FROM items;');
});

describe('POST /api/items/:id/snooze', () => {
  it('snoozes an item until tomorrow', async () => {
    const item = createAdhocItem(testDb, { title: 'Snooze me' });
    const res = await POST(
      new Request('http://localhost/api/items/1/snooze', { method: 'POST', body: JSON.stringify({ option: 'tomorrow' }) }),
      { params: { id: String(item.id) } }
    );
    const body = await res.json();
    expect(body.snoozedUntil).not.toBeNull();
  });
});

describe('DELETE /api/items/:id/snooze', () => {
  it('undoes a snooze', async () => {
    const item = createAdhocItem(testDb, { title: 'Unsnooze me' });
    await POST(
      new Request('http://localhost/api/items/1/snooze', { method: 'POST', body: JSON.stringify({ option: 'tomorrow' }) }),
      { params: { id: String(item.id) } }
    );
    const res = await DELETE(new Request('http://localhost/api/items/1/snooze', { method: 'DELETE' }), {
      params: { id: String(item.id) },
    });
    const body = await res.json();
    expect(body.snoozedUntil).toBeNull();
  });
});
