import { SETTINGS_KEYS } from '../config';
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

// Accepts what people paste: "https://acme.atlassian.net/", or a board URL.
export function normalizeJiraSite(value: string): string {
  return value
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
    .toLowerCase();
}
