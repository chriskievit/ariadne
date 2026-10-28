import { SETTINGS_KEYS } from '../config';
import type { Source } from '../types';
import { SOURCE_KEYS, type SettingGetter, type SourceKey } from './types';

// Pure, like types.ts: lib/sync-status.ts needs it to leave a source you
// never set up out of the sync status, and that module reaches the client.
// The adapters use the same checks, so "set up" means one thing everywhere.
export const SOURCE_CONFIGURED: Record<SourceKey, (get: SettingGetter) => boolean> = {
  github: (get) => !!get(SETTINGS_KEYS.githubPat),
  ado: (get) => !!(get(SETTINGS_KEYS.adoPat) && get(SETTINGS_KEYS.adoOrg) && get(SETTINGS_KEYS.adoProject)),
  jira: (get) => !!(get(SETTINGS_KEYS.jiraSite) && get(SETTINGS_KEYS.jiraEmail) && get(SETTINGS_KEYS.jiraToken)),
};

export function configuredSources(get: SettingGetter): SourceKey[] {
  return SOURCE_KEYS.filter((key) => SOURCE_CONFIGURED[key](get));
}

// The items each source syncs. Mirrors the adapters' itemSource, which
// adapters.test.ts holds to this map; it lives here so items-repo can read it
// without importing the adapters (github.ts imports items-repo).
export const SOURCE_ITEM: Record<SourceKey, Source> = {
  github: 'github_pr',
  ado: 'ado_workitem',
  jira: 'jira_issue',
};

export const SOURCE_ENABLED_KEY: Record<SourceKey, string> = {
  github: SETTINGS_KEYS.githubEnabled,
  ado: SETTINGS_KEYS.adoEnabled,
  jira: SETTINGS_KEYS.jiraEnabled,
};

// On unless switched off, so a source that predates the toggle keeps syncing.
export function isSourceEnabled(get: SettingGetter, key: SourceKey): boolean {
  return get(SOURCE_ENABLED_KEY[key]) !== 'false';
}

// Set up and switched on: the sources that sync and show a sync status.
export function activeSources(get: SettingGetter): SourceKey[] {
  return configuredSources(get).filter((key) => isSourceEnabled(get, key));
}

// Item sources to leave out of every overview. A switched-off source keeps
// its items in the database, so switching it back on shows them again.
export function hiddenItemSources(get: SettingGetter): Source[] {
  return SOURCE_KEYS.filter((key) => !isSourceEnabled(get, key)).map((key) => SOURCE_ITEM[key]);
}

// Accepts what people paste: "https://acme.atlassian.net/", or a board URL.
export function normalizeJiraSite(value: string): string {
  return value
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
    .toLowerCase();
}
