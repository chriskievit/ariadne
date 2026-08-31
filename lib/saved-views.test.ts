import { describe, it, expect, beforeEach } from 'vitest';
import { openDb } from './db';
import { getSavedViews, addSavedView, removeSavedView, reorderSavedViews } from './saved-views';
import type Database from 'better-sqlite3';

let db: Database.Database;

beforeEach(() => {
  db = openDb(':memory:');
});

describe('saved views', () => {
  it('starts empty', () => {
    expect(getSavedViews(db)).toEqual([]);
  });

  it('adds a view and persists it', () => {
    addSavedView(db, { label: 'Blocked in sprint', query: 'group:blocked sprint:current', shortcut: '2' });
    const views = getSavedViews(db);
    expect(views).toHaveLength(1);
    expect(views[0]).toMatchObject({ label: 'Blocked in sprint', query: 'group:blocked sprint:current', shortcut: '2' });
    expect(views[0].id).toBeTruthy();
  });

  it('has no arbitrary cap', () => {
    for (let i = 0; i < 30; i++) {
      addSavedView(db, { label: `View ${i}`, query: `repo:x${i}`, shortcut: null });
    }
    expect(getSavedViews(db)).toHaveLength(30);
  });

  it('removes a view by id', () => {
    const [added] = addSavedView(db, { label: 'Quiet 5 days+', query: 'stale:>5d', shortcut: '3' });
    const remaining = removeSavedView(db, added.id);
    expect(remaining).toEqual([]);
  });

  it('reorders views', () => {
    const afterFirst = addSavedView(db, { label: 'A', query: 'is:starred', shortcut: '1' });
    const afterSecond = addSavedView(db, { label: 'B', query: 'is:snoozed', shortcut: '2' });
    const idA = afterFirst[0].id;
    const idB = afterSecond[1].id;
    const reordered = reorderSavedViews(db, [idB, idA]);
    expect(reordered.map((v) => v.id)).toEqual([idB, idA]);
  });

  describe('reorderSavedViews refuses a list that is not the stored set', () => {
    function threeViews(): string[] {
      addSavedView(db, { label: 'A', query: 'is:starred', shortcut: '1' });
      addSavedView(db, { label: 'B', query: 'is:snoozed', shortcut: '2' });
      const all = addSavedView(db, { label: 'C', query: 'is:parked', shortcut: '3' });
      return all.map((v) => v.id);
    }

    it('does not delete the views left out of orderedIds', () => {
      const [idA, idB, idC] = threeViews();

      expect(() => reorderSavedViews(db, [idB, idA])).toThrow(/every saved view/i);

      expect(getSavedViews(db).map((v) => v.id)).toEqual([idA, idB, idC]);
    });

    it('names the ids that were missing', () => {
      const [idA, idB, idC] = threeViews();

      expect(() => reorderSavedViews(db, [idB, idA])).toThrow(new RegExp(idC));
    });

    it('rejects an unknown id rather than silently dropping it', () => {
      const [idA, idB, idC] = threeViews();

      expect(() => reorderSavedViews(db, [idA, idB, idC, 'not-a-view'])).toThrow(/not-a-view/);

      expect(getSavedViews(db)).toHaveLength(3);
    });

    it('rejects a duplicated id, which would otherwise drop a view', () => {
      const [idA, idB] = threeViews();

      expect(() => reorderSavedViews(db, [idA, idB, idB])).toThrow(/every saved view/i);

      expect(getSavedViews(db)).toHaveLength(3);
    });

    it('names a duplicated id, even when nothing is missing', () => {
      addSavedView(db, { label: 'A', query: 'is:starred', shortcut: '1' });
      const all = addSavedView(db, { label: 'B', query: 'is:snoozed', shortcut: '2' });
      const [idA, idB] = all.map((v) => v.id);

      expect(() => reorderSavedViews(db, [idA, idB, idB])).toThrow(
        new RegExp(`duplicated: ${idB}`),
      );

      expect(getSavedViews(db).map((v) => v.id)).toEqual([idA, idB]);
    });

    it('rejects an empty list when views exist', () => {
      threeViews();

      expect(() => reorderSavedViews(db, [])).toThrow(/every saved view/i);

      expect(getSavedViews(db)).toHaveLength(3);
    });

    it('accepts an empty list when there is nothing stored', () => {
      expect(reorderSavedViews(db, [])).toEqual([]);
    });
  });
});
