import type Database from 'better-sqlite3';
import { getSetting } from './settings-repo';
import { listItems } from './items-repo';
import { SETTINGS_KEYS } from './config';

export interface SprintProgress {
  name: string | null;
  startDate: string | null;
  endDate: string | null;
  totalCount: number;
  completedCount: number;
}

export function getSprintProgress(db: Database.Database): SprintProgress {
  const name = getSetting(db, SETTINGS_KEYS.sprintName);
  const startDate = getSetting(db, SETTINGS_KEYS.sprintStart);
  const endDate = getSetting(db, SETTINGS_KEYS.sprintEnd);

  const items = listItems(db);
  const inSprint = items.filter((item) => {
    if (name && item.sprintIteration === name) return true;
    if (startDate && endDate) return item.createdAt >= startDate && item.createdAt <= endDate;
    return false;
  });

  return {
    name,
    startDate,
    endDate,
    totalCount: inSprint.length,
    completedCount: inSprint.filter((i) => i.status === 'done').length,
  };
}
