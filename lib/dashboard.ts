import type Database from 'better-sqlite3';
import { listItems } from './items-repo';
import { getSetting } from './settings-repo';
import { sortByUrgency, type ScoreBreakdownEntry } from './scoring';
import { getLinksForItems, type LinkedRef } from './links-repo';
import { localDateString } from './date';
import { sumHoursLoggedOn, sumHoursLoggedOnByItem } from './time-logs-repo';
import { getPlanItems } from './plans-repo';
import { SETTINGS_KEYS } from './config';
import type { Item } from './types';

export type ScoredItem = Item & {
  score: number;
  scoreBreakdown: ScoreBreakdownEntry[];
  notFired: string[];
  links: LinkedRef[];
  estimateMinutes: number | null;
  loggedMinutesToday: number;
};

export interface GroupedItems {
  today: ScoredItem[];
  signals: ScoredItem[];
  inProgress: ScoredItem[];
  parked: ScoredItem[];
}

export function getGroupedItems(db: Database.Database, now: Date): GroupedItems {
  const items = listItems(db);
  const sprintEnd = getSetting(db, SETTINGS_KEYS.sprintEnd);
  const links = getLinksForItems(db, items);
  const todayStr = localDateString(now);
  const planItems = getPlanItems(db, todayStr);
  const sortOrderByItemId = new Map(planItems.map((pi) => [pi.itemId, pi.sortOrder]));
  const estimateByItemId = new Map(planItems.map((pi) => [pi.itemId, pi.estimateMinutes]));
  const loggedTodayByItemId = sumHoursLoggedOnByItem(db, todayStr);

  const scored = sortByUrgency(items.map((item) => ({ ...item, sprintEnd })), now).map((item) => ({
    ...item,
    links: links.get(item.id) ?? [],
    estimateMinutes: estimateByItemId.get(item.id) ?? null,
    loggedMinutesToday: Math.round((loggedTodayByItemId.get(item.id) ?? 0) * 60),
  }));

  // Today is checked before Signals so pinning an item is a move out of its
  // score bucket, not a copy -- an item never appears in two sections at
  // once. Requiring status === 'inbox' here is belt-and-suspenders on top of
  // setStatus's own auto-clear: an in-progress item never shows up in Today
  // even if today_date somehow survived. Today is ordered by plan_items'
  // sort_order rather than score -- it's a hand-ordered list once chosen,
  // not a re-derivation of the ranking that put it there.
  const today = scored
    .filter((i) => i.status === 'inbox' && i.todayDate === todayStr)
    .sort((a, b) => (sortOrderByItemId.get(a.id) ?? Infinity) - (sortOrderByItemId.get(b.id) ?? Infinity));
  const todayIds = new Set(today.map((i) => i.id));

  return {
    today,
    signals: scored.filter((i) => i.status === 'inbox' && !todayIds.has(i.id)),
    inProgress: scored.filter((i) => i.status === 'in_progress' && !i.parked),
    parked: scored.filter((i) => i.status === 'in_progress' && i.parked),
  };
}

export interface TodaySummary {
  planned: Item[];
  doneToday: Item[];
  hoursLoggedToday: number;
}

// `now` is accepted (not just `date`) to mirror getGroupedItems's signature
// and keep the door open for future now-relative logic, even though only
// `date` is used today -- the two must never disagree about what day it is.
export function getTodaySummary(db: Database.Database, date: string, now: Date): TodaySummary {
  const items = listItems(db);
  const planned = items.filter((i) => i.todayDate === date && i.status !== 'done');
  const doneToday = items.filter(
    (i) => i.status === 'done' && i.completedAt !== null && localDateString(new Date(i.completedAt)) === date
  );
  const hoursLoggedToday = sumHoursLoggedOn(db, date);
  void now;
  return { planned, doneToday, hoursLoggedToday };
}
