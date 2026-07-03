import type Database from 'better-sqlite3';
import { getSetting } from './settings-repo';
import { listItems } from './items-repo';
import { SETTINGS_KEYS, SPRINT_DONE_ADO_STATES } from './config';

export interface SprintProgress {
  name: string | null;
  startDate: string | null;
  endDate: string | null;
  totalCount: number;
  completedCount: number;
  lastSyncedAt: string | null;
}

function isComplete(item: { source: string; status: string; adoStatus: string | null }): boolean {
  if (item.source === 'ado_workitem') {
    return item.adoStatus != null && SPRINT_DONE_ADO_STATES.has(item.adoStatus.toLowerCase());
  }
  return item.status === 'done';
}

export function getSprintProgress(db: Database.Database): SprintProgress {
  const name = getSetting(db, SETTINGS_KEYS.sprintName);
  const startDate = getSetting(db, SETTINGS_KEYS.sprintStart);
  const endDate = getSetting(db, SETTINGS_KEYS.sprintEnd);
  const lastSyncedAt = (
    db.prepare('SELECT MAX(ran_at) as lastSyncedAt FROM sync_log').get() as { lastSyncedAt: string | null }
  ).lastSyncedAt;

  const items = listItems(db);
  const inSprint = items.filter((item) => {
    if (name && item.sprintIteration && (item.sprintIteration === name || item.sprintIteration.endsWith('\\' + name)))
      return true;
    if (startDate && endDate) return item.createdAt >= startDate && item.createdAt <= endDate;
    return false;
  });

  return {
    name,
    startDate,
    endDate,
    totalCount: inSprint.length,
    completedCount: inSprint.filter(isComplete).length,
    lastSyncedAt,
  };
}
