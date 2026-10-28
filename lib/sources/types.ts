import type Database from 'better-sqlite3';
import type { NewSyncedItemInput, Source } from '../types';

// Pure on purpose: lib/sync-status.ts imports SOURCE_KEYS, and that module is
// imported by client components. The adapters themselves live in index.ts.
export const SOURCE_KEYS = ['github', 'ado', 'jira'] as const;
export type SourceKey = (typeof SOURCE_KEYS)[number];

export type SettingGetter = (key: string) => string | null;

export interface SprintInfo {
  name: string;
  startDate: string;
  endDate: string;
}

export interface SourceSyncResult {
  items: NewSyncedItemInput[];
  // Undefined for a source without sprints. Null for one that has sprints but
  // no current one; phase 3 (#99) clears the stored sprint on null.
  sprint?: SprintInfo | null;
}

export interface SourceAdapter {
  key: SourceKey;
  // The sync key and the item source are different vocabularies ('github' vs
  // 'github_pr'); phase 3 needs this map to find a source's items.
  itemSource: Source;
  // A source that is not set up is skipped without a trace: no sync_log row,
  // no sync status, so a Jira-only setup never shows Azure DevOps as failed.
  isConfigured(get: SettingGetter): boolean;
  sync(get: SettingGetter): Promise<SourceSyncResult>;
  // Runs after the fetched items are upserted, for state the fetch itself
  // cannot see (a PR that left the open-PR search because it merged).
  reconcile?(db: Database.Database, fetched: NewSyncedItemInput[], get: SettingGetter): Promise<void>;
}
