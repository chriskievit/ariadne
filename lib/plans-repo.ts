import type Database from 'better-sqlite3';
import { DEFAULT_CAPACITY_MINUTES } from './config';
import type { Plan, PlanItem } from './types';

function rowToPlan(row: any, date: string): Plan {
  if (!row) return { date, capacityMinutes: DEFAULT_CAPACITY_MINUTES, note: null };
  return { date: row.date, capacityMinutes: row.capacity_minutes, note: row.note };
}

function rowToPlanItem(row: any): PlanItem {
  return {
    planDate: row.plan_date,
    itemId: row.item_id,
    sortOrder: row.sort_order,
    estimateMinutes: row.estimate_minutes,
  };
}

export function getPlan(db: Database.Database, date: string): Plan {
  const row = db.prepare('SELECT * FROM plans WHERE date = ?').get(date);
  return rowToPlan(row, date);
}

export function upsertPlan(
  db: Database.Database,
  date: string,
  input: { capacityMinutes?: number; note?: string | null }
): Plan {
  const existing = getPlan(db, date);
  const capacityMinutes = input.capacityMinutes ?? existing.capacityMinutes;
  const note = input.note !== undefined ? input.note : existing.note;
  db.prepare(
    `INSERT INTO plans (date, capacity_minutes, note) VALUES (?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET capacity_minutes = excluded.capacity_minutes, note = excluded.note`
  ).run(date, capacityMinutes, note);
  return { date, capacityMinutes, note };
}

export function getPlanItems(db: Database.Database, date: string): PlanItem[] {
  return db
    .prepare('SELECT * FROM plan_items WHERE plan_date = ? ORDER BY sort_order')
    .all(date)
    .map(rowToPlanItem);
}

// Ensures the day's plan row exists (defaulting capacity), then appends the
// item at the next sort position. Idempotent: adding an already-present
// item is a no-op rather than a duplicate or a reorder, so the quick 't'
// pin path and the ritual's Choose step can both call this safely.
export function addPlanItem(db: Database.Database, date: string, itemId: number): PlanItem {
  if (!db.prepare('SELECT 1 FROM plans WHERE date = ?').get(date)) {
    upsertPlan(db, date, {});
  }
  const existing = db.prepare('SELECT * FROM plan_items WHERE plan_date = ? AND item_id = ?').get(date, itemId);
  if (existing) return rowToPlanItem(existing);

  const { maxOrder } = db
    .prepare('SELECT MAX(sort_order) as maxOrder FROM plan_items WHERE plan_date = ?')
    .get(date) as { maxOrder: number | null };
  const sortOrder = maxOrder === null ? 0 : maxOrder + 1;
  db.prepare('INSERT INTO plan_items (plan_date, item_id, sort_order) VALUES (?, ?, ?)').run(date, itemId, sortOrder);
  return { planDate: date, itemId, sortOrder, estimateMinutes: null };
}

export function removePlanItem(db: Database.Database, date: string, itemId: number): void {
  db.prepare('DELETE FROM plan_items WHERE plan_date = ? AND item_id = ?').run(date, itemId);
}

export function setPlanItemEstimate(db: Database.Database, date: string, itemId: number, minutes: number | null): void {
  db.prepare('UPDATE plan_items SET estimate_minutes = ? WHERE plan_date = ? AND item_id = ?').run(minutes, date, itemId);
}

export function reorderPlanItems(db: Database.Database, date: string, orderedItemIds: number[]): PlanItem[] {
  const update = db.prepare('UPDATE plan_items SET sort_order = ? WHERE plan_date = ? AND item_id = ?');
  orderedItemIds.forEach((itemId, index) => update.run(index, date, itemId));
  return getPlanItems(db, date);
}

// The last size the user gave an item on any earlier day. Carried-over work
// should keep the number the user chose rather than being re-guessed from a
// bucket average, so this beats the logged median in resolveDuration's order.
// Rows with no estimate are skipped rather than treated as zero: never sized
// is not the same fact as sized at nothing.
export function getLatestPriorEstimates(db: Database.Database, beforeDate: string): Map<number, number> {
  const rows = db
    .prepare(
      `SELECT item_id as itemId, estimate_minutes as estimateMinutes
       FROM plan_items
       WHERE plan_date < ? AND estimate_minutes IS NOT NULL
       ORDER BY plan_date ASC`
    )
    .all(beforeDate) as { itemId: number; estimateMinutes: number }[];

  // Ascending order means a later row overwrites an earlier one, leaving the
  // most recent estimate per item.
  const byItem = new Map<number, number>();
  for (const row of rows) byItem.set(row.itemId, row.estimateMinutes);
  return byItem;
}
