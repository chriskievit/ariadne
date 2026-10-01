import { fetchGithubItems, fetchMergedExternalIds, type GithubConfig } from './github-client';
import { getOpenGithubPrCandidates, setPrStatus } from '../items-repo';
import { SETTINGS_KEYS, DEFAULT_STALE_DAYS } from '../config';
import type { SettingGetter, SourceAdapter } from './types';

function githubConfig(get: SettingGetter): GithubConfig {
  const parsedStaleDays = Number(get(SETTINGS_KEYS.staleDays) ?? DEFAULT_STALE_DAYS);
  const staleDays = Number.isNaN(parsedStaleDays) ? DEFAULT_STALE_DAYS : parsedStaleDays;
  return { pat: get(SETTINGS_KEYS.githubPat) ?? '', staleDays };
}

export const githubAdapter: SourceAdapter = {
  key: 'github',
  notConfiguredError: 'GitHub PAT not configured',
  isConfigured: (get) => !!get(SETTINGS_KEYS.githubPat),
  async sync(get) {
    return { items: await fetchGithubItems(githubConfig(get)) };
  },
  // A merged PR drops out of the open-PR search, so the fetch alone would
  // leave it looking open forever. Ask about exactly those.
  async reconcile(db, fetched, get) {
    const fetchedIds = new Set(fetched.map((item) => item.externalId));
    const candidates = getOpenGithubPrCandidates(db).filter((c) => !fetchedIds.has(c.externalId));
    if (candidates.length === 0) return;
    const merged = await fetchMergedExternalIds(githubConfig(get), candidates);
    for (const candidate of candidates) {
      if (merged.has(candidate.externalId)) setPrStatus(db, candidate.id, 'merged');
    }
  },
};
