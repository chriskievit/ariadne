import { describe, it, expect } from 'vitest';
import { openDb } from './db';
import { logSyncResult } from './sync';
import { getSourceStatus, getAllSourceStatuses, classifyError, STALE_AFTER_MINUTES } from './sync-status';
import type Database from 'better-sqlite3';

function db(): Database.Database {
  return openDb(':memory:');
}

describe('getSourceStatus', () => {
  it('is "error" when a source has never synced', () => {
    const status = getSourceStatus(db(), 'github', new Date());
    expect(status).toEqual({ source: 'github', lastSyncedAt: null, lastError: 'Never synced', state: 'error' });
  });

  it('is "ok" when the last sync succeeded recently', () => {
    const conn = db();
    const now = new Date('2026-08-14T12:00:00.000Z');
    logSyncResult(conn, 'github', 5, null);
    const status = getSourceStatus(conn, 'github', now);
    expect(status.state).toBe('ok');
    expect(status.lastError).toBeNull();
  });

  it('is "stale" when the last successful sync is older than the freshness window', () => {
    const conn = db();
    const past = new Date(Date.now() - (STALE_AFTER_MINUTES + 5) * 60_000);
    conn
      .prepare('INSERT INTO sync_log (source, ran_at, item_count, error) VALUES (?, ?, ?, NULL)')
      .run('github', past.toISOString(), 5);
    const status = getSourceStatus(conn, 'github', new Date());
    expect(status.state).toBe('stale');
  });

  it('is "error" when the only attempt failed and there is no prior success', () => {
    const conn = db();
    logSyncResult(conn, 'ado', 0, 'Bad credentials');
    const status = getSourceStatus(conn, 'ado', new Date());
    expect(status.state).toBe('error');
    expect(status.lastError).toBe('Bad credentials');
  });

  it('is "partial" when the latest attempt failed but an earlier one succeeded', () => {
    const conn = db();
    const now = new Date('2026-08-14T12:00:00.000Z');
    conn
      .prepare('INSERT INTO sync_log (source, ran_at, item_count, error) VALUES (?, ?, ?, NULL)')
      .run('ado', '2026-08-14T10:00:00.000Z', 14);
    conn
      .prepare('INSERT INTO sync_log (source, ran_at, item_count, error) VALUES (?, ?, ?, ?)')
      .run('ado', '2026-08-14T11:00:00.000Z', 0, 'Bad credentials');
    const status = getSourceStatus(conn, 'ado', now);
    expect(status.state).toBe('partial');
    expect(status.lastSyncedAt).toBe('2026-08-14T10:00:00.000Z');
    expect(status.lastError).toBe('Bad credentials');
  });
});

describe('getAllSourceStatuses', () => {
  it('returns both sources', () => {
    const statuses = getAllSourceStatuses(db(), new Date());
    expect(statuses.map((s) => s.source)).toEqual(['github', 'ado']);
  });
});

describe('classifyError', () => {
  it('classifies a bad-credentials message as auth', () => {
    const result = classifyError('Bad credentials', 'Azure DevOps');
    expect(result.cause).toBe('auth');
    expect(result.remedy).toContain('Azure DevOps token');
  });

  it('classifies a 401 message as auth', () => {
    expect(classifyError('Request failed with status 401', 'GitHub').cause).toBe('auth');
  });

  it('classifies a rate-limit message', () => {
    expect(classifyError('API rate limit exceeded', 'GitHub').cause).toBe('rate_limit');
  });

  it('classifies a network failure message', () => {
    expect(classifyError('fetch failed: ENOTFOUND api.github.com', 'GitHub').cause).toBe('network');
  });

  it('falls back to unknown for an unrecognized message', () => {
    expect(classifyError('Something unexpected happened', 'GitHub').cause).toBe('unknown');
  });
});
