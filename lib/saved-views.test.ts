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
});
