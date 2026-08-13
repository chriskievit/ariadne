import type Database from 'better-sqlite3';
import { listItems } from './items-repo';
import { getSetting } from './settings-repo';
import { sortByUrgency, type ScoreBreakdownEntry } from './scoring';
import { getLinksForItems, type LinkedRef } from './links-repo';
import { localDateString } from './date';
import { sumHoursLoggedOn } from './time-logs-repo';
import { SETTINGS_KEYS, NEEDS_ATTENTION_THRESHOLD } from './config';
import type { Item } from './types';

export type ScoredItem = Item & { score: number; scoreBreakdown: ScoreBreakdownEntry[]; links: LinkedRef[] };

export interface GroupedItems {
  today: ScoredItem[];
  needsAttention: ScoredItem[];
  inProgress: ScoredItem[];
  parked: ScoredItem[];
  everythingElse: ScoredItem[];
}

export function getGroupedItems(db: Database.Database, now: Date): GroupedItems {
  const items = listItems(db);
  const sprintEnd = getSetting(db, SETTINGS_KEYS.sprintEnd);
  const links = getLinksForItems(db, items);
  const scored = sortByUrgency(items.map((item) => ({ ...item, sprintEnd })), now).map((item) => ({
    ...item,
    links: links.get(item.id) ?? [],
  }));

  // Today is checked before Needs Attention/Everything Else so pinning an
  // item is a move out of its score bucket, not a copy -- an item never
  // appears in two sections at once. Requiring status === 'inbox' here is
  // belt-and-suspenders on top of setStatus's own auto-clear: an in-progress
  // item never shows up in Today even if today_date somehow survived.
  const todayStr = localDateString(now);
  const today = scored.filter((i) => i.status === 'inbox' && i.todayDate === todayStr);
  const todayIds = new Set(today.map((i) => i.id));

  return {
    today,
    needsAttention: scored.filter(
      (i) =>
        i.status === 'inbox' && !todayIds.has(i.id) && (i.source === 'adhoc' || i.score >= NEEDS_ATTENTION_THRESHOLD)
    ),
    inProgress: scored.filter((i) => i.status === 'in_progress' && !i.parked),
    parked: scored.filter((i) => i.status === 'in_progress' && i.parked),
    everythingElse: scored.filter(
      (i) => i.status === 'inbox' && !todayIds.has(i.id) && i.source !== 'adhoc' && i.score < NEEDS_ATTENTION_THRESHOLD
    ),
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
