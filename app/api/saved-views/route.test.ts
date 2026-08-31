import { describe, it, expect, vi, beforeEach } from 'vitest';
import { openDb } from '@/lib/db';

const testDb = openDb(':memory:');
vi.mock('@/lib/db-instance', () => ({ db: testDb }));

const { GET, POST, DELETE, PUT } = await import('./route');

beforeEach(() => {
  testDb.exec("DELETE FROM settings WHERE key = 'ui.savedViews';");
});

describe('/api/saved-views', () => {
  it('starts empty, adds a view, lists it, deletes it', async () => {
    expect(await (await GET()).json()).toEqual([]);

    const afterAdd = await (
      await POST(
        new Request('http://localhost/api/saved-views', {
          method: 'POST',
          body: JSON.stringify({ label: 'Starred', query: 'is:starred', shortcut: '1' }),
        })
      )
    ).json();
    expect(afterAdd).toHaveLength(1);

    const id = afterAdd[0].id;
    const afterDelete = await (
      await DELETE(new Request(`http://localhost/api/saved-views?id=${id}`, { method: 'DELETE' }))
    ).json();
    expect(afterDelete).toEqual([]);
  });

  it('reorders views', async () => {
    const first = await (
      await POST(
        new Request('http://localhost/api/saved-views', {
          method: 'POST',
          body: JSON.stringify({ label: 'A', query: 'is:starred', shortcut: '1' }),
        })
      )
    ).json();
    const second = await (
      await POST(
        new Request('http://localhost/api/saved-views', {
          method: 'POST',
          body: JSON.stringify({ label: 'B', query: 'is:snoozed', shortcut: '2' }),
        })
      )
    ).json();
    const idA = first[0].id;
    const idB = second[1].id;

    const reordered = await (
      await PUT(
        new Request('http://localhost/api/saved-views', {
          method: 'PUT',
          body: JSON.stringify({ orderedIds: [idB, idA] }),
        })
      )
    ).json();
    expect(reordered.map((v: { id: string }) => v.id)).toEqual([idB, idA]);
  });
  it('refuses a reorder that leaves a view out, with a 400 rather than deleting it', async () => {
    const add = (label: string, query: string) =>
      POST(
        new Request('http://localhost/api/saved-views', {
          method: 'POST',
          body: JSON.stringify({ label, query, shortcut: null }),
        })
      );
    await add('A', 'is:starred');
    await add('B', 'is:snoozed');
    const all = await (await add('C', 'is:parked')).json();
    const ids = all.map((v: { id: string }) => v.id);

    const res = await PUT(
      new Request('http://localhost/api/saved-views', {
        method: 'PUT',
        body: JSON.stringify({ orderedIds: [ids[1], ids[0]] }),
      })
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/every saved view/i);
    expect(body.error).toContain(ids[2]);

    const stillThere = await (await GET()).json();
    expect(stillThere.map((v: { id: string }) => v.id)).toEqual(ids);
  });
});
