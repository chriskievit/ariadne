import { describe, it, expect, beforeEach } from 'vitest';
import { openDb } from './db';
import { createAdhocItem } from './items-repo';
import {
  getPlan,
  upsertPlan,
  getPlanItems,
  addPlanItem,
  removePlanItem,
  setPlanItemEstimate,
  reorderPlanItems,
  getLatestPriorEstimates,
} from './plans-repo';
import { DEFAULT_CAPACITY_MINUTES } from './config';
import type Database from 'better-sqlite3';

let db: Database.Database;
const DATE = '2026-08-14';

beforeEach(() => {
  db = openDb(':memory:');
});

describe('getPlan', () => {
  it('returns the default capacity and no note for a date with no plan row yet', () => {
    expect(getPlan(db, DATE)).toEqual({ date: DATE, capacityMinutes: DEFAULT_CAPACITY_MINUTES, note: null });
  });
});

describe('upsertPlan', () => {
  it('creates a plan with a custom capacity', () => {
    const plan = upsertPlan(db, DATE, { capacityMinutes: 240 });
    expect(plan).toEqual({ date: DATE, capacityMinutes: 240, note: null });
  });

  it('updates only the given fields, leaving the rest as previously set', () => {
    upsertPlan(db, DATE, { capacityMinutes: 240, note: 'Quiet Friday' });
    const updated = upsertPlan(db, DATE, { capacityMinutes: 300 });
    expect(updated).toEqual({ date: DATE, capacityMinutes: 300, note: 'Quiet Friday' });
  });
});

describe('addPlanItem / getPlanItems', () => {
  it('creates the plan row on first add if it does not exist, defaulting capacity', () => {
    const item = createAdhocItem(db, { title: 'First pick' });
    addPlanItem(db, DATE, item.id);
    expect(getPlan(db, DATE).capacityMinutes).toBe(DEFAULT_CAPACITY_MINUTES);
    expect(getPlanItems(db, DATE)).toEqual([{ planDate: DATE, itemId: item.id, sortOrder: 0, estimateMinutes: null }]);
  });

  it('appends subsequent items at increasing sort_order', () => {
    const a = createAdhocItem(db, { title: 'A' });
    const b = createAdhocItem(db, { title: 'B' });
    addPlanItem(db, DATE, a.id);
    addPlanItem(db, DATE, b.id);
    expect(getPlanItems(db, DATE).map((i) => [i.itemId, i.sortOrder])).toEqual([
      [a.id, 0],
      [b.id, 1],
    ]);
  });

  it('is idempotent — adding the same item twice does not duplicate or reorder it', () => {
    const a = createAdhocItem(db, { title: 'A' });
    addPlanItem(db, DATE, a.id);
    addPlanItem(db, DATE, a.id);
    expect(getPlanItems(db, DATE)).toHaveLength(1);
  });
});

describe('removePlanItem', () => {
  it('removes the item and leaves the others', () => {
    const a = createAdhocItem(db, { title: 'A' });
    const b = createAdhocItem(db, { title: 'B' });
    addPlanItem(db, DATE, a.id);
    addPlanItem(db, DATE, b.id);
    removePlanItem(db, DATE, a.id);
    expect(getPlanItems(db, DATE).map((i) => i.itemId)).toEqual([b.id]);
  });
});

describe('setPlanItemEstimate', () => {
  it('sets and clears an estimate', () => {
    const a = createAdhocItem(db, { title: 'A' });
    addPlanItem(db, DATE, a.id);
    setPlanItemEstimate(db, DATE, a.id, 90);
    expect(getPlanItems(db, DATE)[0].estimateMinutes).toBe(90);
    setPlanItemEstimate(db, DATE, a.id, null);
    expect(getPlanItems(db, DATE)[0].estimateMinutes).toBeNull();
  });
});

describe('reorderPlanItems', () => {
  it('reassigns sort_order to match the given item order', () => {
    const a = createAdhocItem(db, { title: 'A' });
    const b = createAdhocItem(db, { title: 'B' });
    const c = createAdhocItem(db, { title: 'C' });
    addPlanItem(db, DATE, a.id);
    addPlanItem(db, DATE, b.id);
    addPlanItem(db, DATE, c.id);
    const reordered = reorderPlanItems(db, DATE, [c.id, a.id, b.id]);
    expect(reordered.map((i) => i.itemId)).toEqual([c.id, a.id, b.id]);
    expect(reordered.map((i) => i.sortOrder)).toEqual([0, 1, 2]);
  });
});

describe('getLatestPriorEstimates', () => {
  it('returns nothing when no earlier plan carried an estimate', () => {
    expect(getLatestPriorEstimates(db, DATE)).toEqual(new Map());
  });

  it('returns the most recent estimate before the given date', () => {
    const item = createAdhocItem(db, { title: 'Carried over' });
    addPlanItem(db, '2026-08-10', item.id);
    setPlanItemEstimate(db, '2026-08-10', item.id, 30);
    addPlanItem(db, '2026-08-12', item.id);
    setPlanItemEstimate(db, '2026-08-12', item.id, 90);
    expect(getLatestPriorEstimates(db, DATE)).toEqual(new Map([[item.id, 90]]));
  });

  it('ignores the given date itself and anything after it', () => {
    const item = createAdhocItem(db, { title: 'Today only' });
    addPlanItem(db, DATE, item.id);
    setPlanItemEstimate(db, DATE, item.id, 45);
    expect(getLatestPriorEstimates(db, DATE)).toEqual(new Map());
  });

  it('skips a plan row that never got an estimate', () => {
    const item = createAdhocItem(db, { title: 'Never sized' });
    addPlanItem(db, '2026-08-10', item.id);
    expect(getLatestPriorEstimates(db, DATE)).toEqual(new Map());
  });

  it('falls back to the most recent row that does carry an estimate', () => {
    const item = createAdhocItem(db, { title: 'Sized once' });
    addPlanItem(db, '2026-08-10', item.id);
    setPlanItemEstimate(db, '2026-08-10', item.id, 30);
    addPlanItem(db, '2026-08-12', item.id);
    expect(getLatestPriorEstimates(db, DATE)).toEqual(new Map([[item.id, 30]]));
  });
});
