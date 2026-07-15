import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type Database from 'better-sqlite3';
import { getSetting } from './settings-repo';
import { SETTINGS_KEYS } from './config';
import type { Item } from './types';

export interface LocalRepo {
  name: string;
  path: string;
}

export function parseRepoPathOverrides(raw: string): Record<string, string> {
  const overrides: Record<string, string> = {};
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const name = trimmed.slice(0, eq).trim();
    const path = trimmed.slice(eq + 1).trim();
    if (name && path) overrides[name] = path;
  }
  return overrides;
}

function readSubdirectories(dir: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  return entries.filter((name) => {
    try {
      return statSync(join(dir, name)).isDirectory();
    } catch {
      return false;
    }
  });
}

export function listLocalRepos(db: Database.Database): LocalRepo[] {
  const baseDir = getSetting(db, SETTINGS_KEYS.localReposBaseDir);
  const overrides = parseRepoPathOverrides(getSetting(db, SETTINGS_KEYS.repoPathOverrides) ?? '');

  const repos = new Map<string, string>();

  if (baseDir) {
    for (const name of readSubdirectories(baseDir)) {
      repos.set(name, join(baseDir, name));
    }
  }

  for (const [name, path] of Object.entries(overrides)) {
    repos.set(name, path);
  }

  return Array.from(repos.entries())
    .map(([name, path]) => ({ name, path }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function resolveWorkingDir(db: Database.Database, item: Pick<Item, 'repo'>): string | null {
  if (!item.repo) return null;

  const overrides = parseRepoPathOverrides(getSetting(db, SETTINGS_KEYS.repoPathOverrides) ?? '');
  if (overrides[item.repo]) return overrides[item.repo];

  const baseDir = getSetting(db, SETTINGS_KEYS.localReposBaseDir);
  if (!baseDir) return null;

  return join(baseDir, item.repo);
}
