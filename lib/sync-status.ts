import type Database from 'better-sqlite3';

export type Source = 'github' | 'ado';
export type SourceState = 'ok' | 'stale' | 'error' | 'partial';

export interface SourceStatus {
  source: Source;
  lastSyncedAt: string | null;
  lastError: string | null;
  state: SourceState;
}

// A source is only "ok" inside this window; past it, the last-known data is
// shown but marked stale rather than presented as current.
export const STALE_AFTER_MINUTES = 15;

export function getSourceStatus(db: Database.Database, source: Source, now: Date): SourceStatus {
  const lastAttempt = db
    .prepare('SELECT ran_at, error FROM sync_log WHERE source = ? ORDER BY ran_at DESC LIMIT 1')
    .get(source) as { ran_at: string; error: string | null } | undefined;

  if (!lastAttempt) {
    return { source, lastSyncedAt: null, lastError: 'Never synced', state: 'error' };
  }

  const lastSuccess = db
    .prepare('SELECT ran_at FROM sync_log WHERE source = ? AND error IS NULL ORDER BY ran_at DESC LIMIT 1')
    .get(source) as { ran_at: string } | undefined;

  if (lastAttempt.error !== null) {
    return {
      source,
      lastSyncedAt: lastSuccess?.ran_at ?? null,
      lastError: lastAttempt.error,
      state: lastSuccess ? 'partial' : 'error',
    };
  }

  const ageMinutes = (now.getTime() - new Date(lastAttempt.ran_at).getTime()) / 60_000;
  return {
    source,
    lastSyncedAt: lastAttempt.ran_at,
    lastError: null,
    state: ageMinutes > STALE_AFTER_MINUTES ? 'stale' : 'ok',
  };
}

export function getAllSourceStatuses(db: Database.Database, now: Date): SourceStatus[] {
  return [getSourceStatus(db, 'github', now), getSourceStatus(db, 'ado', now)];
}

export interface ErrorClassification {
  cause: 'auth' | 'rate_limit' | 'network' | 'unknown';
  remedy: string;
}

// Gives a fix, not a countdown, per the issue's copy guardrail: "Try again
// later" makes the user run the experiment themselves.
export function classifyError(message: string, sourceLabel: string): ErrorClassification {
  const m = message.toLowerCase();
  if (/401|unauthoriz|bad credentials|token/.test(m)) {
    return { cause: 'auth', remedy: `Update the ${sourceLabel} token in Settings, then refresh.` };
  }
  if (/403|rate limit/.test(m)) {
    return { cause: 'rate_limit', remedy: `${sourceLabel}'s rate limit was hit. Refresh again in a few minutes.` };
  }
  if (/network|econnrefused|enotfound|fetch failed/.test(m)) {
    return { cause: 'network', remedy: `Check your connection, then refresh.` };
  }
  return { cause: 'unknown', remedy: `Refresh to try again.` };
}
