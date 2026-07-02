import { describe, it, expect, vi, beforeEach } from 'vitest';
import { openDb } from '@/lib/db';
import { createAdhocItem } from '@/lib/items-repo';

const testDb = openDb(':memory:');
vi.mock('@/lib/db-instance', () => ({ db: testDb }));

const { POST: start } = await import('./start/route');
const { POST: complete } = await import('./complete/route');
const { POST: undo } = await import('./undo/route');

let itemId: number;

beforeEach(() => {
  testDb.exec('DELETE FROM items; DELETE FROM time_logs;');
  itemId = createAdhocItem(testDb, { title: 'Test item' }).id;
});

describe('start -> complete -> undo', () => {
  it('walks an item through the full lifecycle', async () => {
    const startRes = await start(new Request('http://localhost'), { params: { id: String(itemId) } });
    expect((await startRes.json()).status).toBe('in_progress');

    const completeRes = await complete(
      new Request('http://localhost', { method: 'POST', body: JSON.stringify({ durationMinutes: 30 }) }),
      { params: { id: String(itemId) } }
    );
    const completeBody = await completeRes.json();
    expect(completeBody.item.status).toBe('done');
    expect(completeBody.timeLog.durationMinutes).toBe(30);

    const undoRes = await undo(new Request('http://localhost'), { params: { id: String(itemId) } });
    const undoBody = await undoRes.json();
    expect(undoBody.status).toBe('in_progress');
    expect(undoBody.completedAt).toBeNull();
  });
});
