import { describe, it, expect, vi, beforeEach } from 'vitest';
import { openDb } from '@/lib/db';
import { createAdhocItem } from '@/lib/items-repo';

const testDb = openDb(':memory:');
vi.mock('@/lib/db-instance', () => ({ db: testDb }));

const { POST: start } = await import('./start/route');
const { POST: complete } = await import('./complete/route');
const { POST: undo } = await import('./undo/route');
const { POST: requeue } = await import('./requeue/route');

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
      new Request('http://localhost', { method: 'POST', body: JSON.stringify({ durationHours: 1.5 }) }),
      { params: { id: String(itemId) } }
    );
    const completeBody = await completeRes.json();
    expect(completeBody.item.status).toBe('done');
    expect(completeBody.timeLog.durationHours).toBe(1.5);

    const undoRes = await undo(new Request('http://localhost'), { params: { id: String(itemId) } });
    const undoBody = await undoRes.json();
    expect(undoBody.status).toBe('in_progress');
    expect(undoBody.completedAt).toBeNull();
  });
});

describe('start -> requeue', () => {
  it('returns an in-progress item to inbox and logs the elapsed time', async () => {
    const startRes = await start(new Request('http://localhost'), { params: { id: String(itemId) } });
    expect((await startRes.json()).status).toBe('in_progress');

    const requeueRes = await requeue(new Request('http://localhost'), { params: { id: String(itemId) } });
    const requeueBody = await requeueRes.json();
    expect(requeueBody.status).toBe('inbox');
    expect(requeueBody.completedAt).toBeNull();

    const logs = testDb.prepare('SELECT * FROM time_logs WHERE item_id = ?').all(itemId) as any[];
    expect(logs).toHaveLength(1);
    expect(logs[0].ended_at).not.toBeNull();
  });
});
