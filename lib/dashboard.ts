import type Database from 'better-sqlite3';
import { listItems } from './items-repo';
import { getSetting } from './settings-repo';
import { sortByUrgency } from './scoring';
import { SETTINGS_KEYS, NEEDS_ATTENTION_THRESHOLD } from './config';
import type { Item } from './types';

export interface GroupedItems {
  needsAttention: (Item & { score: number })[];
  inProgress: (Item & { score: number })[];
  everythingElse: (Item & { score: number })[];
}

export function getGroupedItems(db: Database.Database, now: Date): GroupedItems {
  const items = listItems(db);
  const sprintEnd = getSetting(db, SETTINGS_KEYS.sprintEnd);
  const scored = sortByUrgency(items.map((item) => ({ ...item, sprintEnd })), now);

  return {
    needsAttention: scored.filter((i) => i.status === 'inbox' && i.score >= NEEDS_ATTENTION_THRESHOLD),
    inProgress: scored.filter((i) => i.status === 'in_progress'),
    everythingElse: scored.filter((i) => i.status === 'inbox' && i.score < NEEDS_ATTENTION_THRESHOLD),
  };
}
