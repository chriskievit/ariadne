import type Database from 'better-sqlite3';
import { fetchGithubItems } from './github-client';
import { fetchAdoData } from './ado-client';
import { upsertSyncedItem } from './items-repo';
import { getSetting, setSetting } from './settings-repo';
import { SETTINGS_KEYS, DEFAULT_STALE_DAYS } from './config';

export interface SyncOutcome {
  source: 'github' | 'ado';
  itemCount: number;
  error: string | null;
}

function logSyncResult(db: Database.Database, source: string, itemCount: number, error: string | null): void {
  db.prepare('INSERT INTO sync_log (source, ran_at, item_count, error) VALUES (?, ?, ?, ?)').run(
    source,
    new Date().toISOString(),
    itemCount,
    error
  );
}

async function syncGithub(db: Database.Database): Promise<SyncOutcome> {
  const pat = getSetting(db, SETTINGS_KEYS.githubPat);
  if (!pat) {
    const error = 'GitHub PAT not configured';
    logSyncResult(db, 'github', 0, error);
    return { source: 'github', itemCount: 0, error };
  }

  const parsedStaleDays = Number(getSetting(db, SETTINGS_KEYS.staleDays) ?? DEFAULT_STALE_DAYS);
  const staleDays = Number.isNaN(parsedStaleDays) ? DEFAULT_STALE_DAYS : parsedStaleDays;
  try {
    const items = await fetchGithubItems({ pat, staleDays });
    for (const item of items) upsertSyncedItem(db, item);
    logSyncResult(db, 'github', items.length, null);
    return { source: 'github', itemCount: items.length, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logSyncResult(db, 'github', 0, message);
    return { source: 'github', itemCount: 0, error: message };
  }
}

async function syncAdo(db: Database.Database): Promise<SyncOutcome> {
  const pat = getSetting(db, SETTINGS_KEYS.adoPat);
  const org = getSetting(db, SETTINGS_KEYS.adoOrg);
  const project = getSetting(db, SETTINGS_KEYS.adoProject);
  if (!pat || !org || !project) {
    const error = 'Azure DevOps settings not configured';
    logSyncResult(db, 'ado', 0, error);
    return { source: 'ado', itemCount: 0, error };
  }

  try {
    const team = getSetting(db, SETTINGS_KEYS.adoTeam) ?? undefined;
    const { items, iteration } = await fetchAdoData({ pat, org, project, team });
    for (const item of items) upsertSyncedItem(db, item);
    if (iteration) {
      setSetting(db, SETTINGS_KEYS.sprintName, iteration.name);
      setSetting(db, SETTINGS_KEYS.sprintStart, iteration.startDate);
      setSetting(db, SETTINGS_KEYS.sprintEnd, iteration.endDate);
    }
    logSyncResult(db, 'ado', items.length, null);
    return { source: 'ado', itemCount: items.length, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logSyncResult(db, 'ado', 0, message);
    return { source: 'ado', itemCount: 0, error: message };
  }
}

export async function runSync(db: Database.Database): Promise<SyncOutcome[]> {
  return Promise.all([syncGithub(db), syncAdo(db)]);
}
