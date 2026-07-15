import type Database from 'better-sqlite3';
import { listItems } from './items-repo';
import { getSetting } from './settings-repo';
import { sortByUrgency, type ScoreBreakdownEntry } from './scoring';
import { getLinksForItems, type LinkedRef } from './links-repo';
import { SETTINGS_KEYS, NEEDS_ATTENTION_THRESHOLD } from './config';
import type { Item } from './types';

export type ScoredItem = Item & { score: number; scoreBreakdown: ScoreBreakdownEntry[]; links: LinkedRef[] };

export interface GroupedItems {
  needsAttention: ScoredItem[];
  inProgress: ScoredItem[];
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

  return {
    needsAttention: scored.filter(
      (i) => i.status === 'inbox' && (i.source === 'adhoc' || i.score >= NEEDS_ATTENTION_THRESHOLD)
    ),
    inProgress: scored.filter((i) => i.status === 'in_progress'),
    everythingElse: scored.filter(
      (i) => i.status === 'inbox' && i.source !== 'adhoc' && i.score < NEEDS_ATTENTION_THRESHOLD
    ),
  };
}
