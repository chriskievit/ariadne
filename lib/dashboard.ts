import type Database from 'better-sqlite3';
import { listItems } from './items-repo';
import { getSetting } from './settings-repo';
import { sortByUrgency, type ScoreBreakdownEntry } from './scoring';
import { getLinksForItems, type LinkedRef } from './links-repo';
import { localDateString } from './date';
import { sumHoursLoggedOn, sumHoursLoggedOnByItem } from './time-logs-repo';
import { getPlan, getPlanItems } from './plans-repo';
import { SETTINGS_KEYS } from './config';
import type { Item, Plan } from './types';

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
  todayPlannedMinutes: number;
  todayLoggedMinutes: number;
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

  // Today tracks plan membership (today_date), not status -- a planned item
  // stays visible here through Start/Pause/Complete instead of disappearing
  // into In-progress with no trace, so it can now legitimately appear in
  // both Today and In-progress at once. Signals stays exclusive of Today:
  // an item pinned to today's plan is a move out of Signals, not a copy.
  // Today is ordered by plan_items' sort_order rather than score -- it's a
  // hand-ordered list once chosen, not a re-derivation of the ranking that
  // put it there.
  const today = scored
    .filter((i) => i.todayDate === todayStr)
    .sort((a, b) => (sortOrderByItemId.get(a.id) ?? Infinity) - (sortOrderByItemId.get(b.id) ?? Infinity));
  const todayIds = new Set(today.map((i) => i.id));

  // Sourced from plan_items rather than the `today` bucket above. The two
  // usually agree, but plan membership is the thing that actually defines what
  // was planned for today: an item removed from the bucket (today_date cleared)
  // keeps its estimate and its logged hours counting here, which is what these
  // totals are for.
  const todayPlannedMinutes = planItems.reduce((sum, pi) => sum + (pi.estimateMinutes ?? 0), 0);
  const todayLoggedMinutes = planItems.reduce(
    (sum, pi) => sum + Math.round((loggedTodayByItemId.get(pi.itemId) ?? 0) * 60),
    0
  );

  return {
    today,
    signals: scored.filter((i) => i.status === 'inbox' && !todayIds.has(i.id)),
    inProgress: scored.filter((i) => i.status === 'in_progress' && !i.parked),
    parked: scored.filter((i) => i.status === 'in_progress' && i.parked),
    todayPlannedMinutes,
    todayLoggedMinutes,
  };
}

export interface TodaySummary {
  planned: Item[];
  doneToday: Item[];
  hoursLoggedToday: number;
  plan: Plan;
  plannedMinutes: number;
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
  const plan = getPlan(db, date);
  const plannedMinutes = getPlanItems(db, date).reduce((sum, pi) => sum + (pi.estimateMinutes ?? 0), 0);
  void now;
  return { planned, doneToday, hoursLoggedToday, plan, plannedMinutes };
}
