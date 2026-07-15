import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { openDb } from './db';
import { upsertSyncedItem, createAdhocItem, setStatus } from './items-repo';
import { startTimer, completeTimer } from './time-logs-repo';
import { getTimeReport } from './report';

let db: Database.Database;

function completedItem(source: 'github_pr' | 'ado_workitem' | 'adhoc', completedAt: string) {
  const item =
    source === 'adhoc'
      ? createAdhocItem(db, { title: 'Ad-hoc task' })
      : upsertSyncedItem(db, {
          source,
          externalId: `${source}-${completedAt}`,
          title: 'Synced item',
          url: null,
          reason: source === 'github_pr' ? 'authored' : 'assigned',
          dueDate: null,
          sprintIteration: null,
          rawUpdatedAt: null,
          repo: null,
        });
  setStatus(db, item.id, 'done', completedAt);
  return item;
}

function logTime(itemId: number, startedAt: string, durationHours: number | null) {
  const log = startTimer(db, itemId);
  db.prepare('UPDATE time_logs SET started_at = ? WHERE id = ?').run(startedAt, log.id);
  if (durationHours === null) return; // leave open (no duration yet)
  completeTimer(db, itemId, { durationHours });
}

beforeEach(() => {
  db = openDb(':memory:');
});

describe('getTimeReport', () => {
  it('sums hours by source for items completed and logged within the range', () => {
    const gh = completedItem('github_pr', '2026-07-01T10:00:00.000Z');
    logTime(gh.id, '2026-07-01T09:00:00.000Z', 2);

    const ado = completedItem('ado_workitem', '2026-07-02T10:00:00.000Z');
    logTime(ado.id, '2026-07-02T09:00:00.000Z', 1.5);

    const report = getTimeReport(db, '2026-07-01', '2026-07-02');
    expect(report.totalsBySource).toEqual({ github_pr: 2, ado_workitem: 1.5, adhoc: 0 });
  });

  it('excludes an item completed outside the range even if it has an in-range time log', () => {
    const item = completedItem('adhoc', '2026-07-10T10:00:00.000Z');
    logTime(item.id, '2026-07-01T09:00:00.000Z', 3);

    const report = getTimeReport(db, '2026-07-01', '2026-07-02');
    expect(report.totalsBySource.adhoc).toBe(0);
  });

  it('excludes a time log outside the range even for an item completed inside it', () => {
    const item = completedItem('adhoc', '2026-07-01T10:00:00.000Z');
    logTime(item.id, '2026-06-01T09:00:00.000Z', 3);

    const report = getTimeReport(db, '2026-07-01', '2026-07-02');
    expect(report.totalsBySource.adhoc).toBe(0);
  });

  it('excludes an open timer (NULL duration) from the sum', () => {
    const item = completedItem('adhoc', '2026-07-01T10:00:00.000Z');
    logTime(item.id, '2026-07-01T09:00:00.000Z', null);

    const report = getTimeReport(db, '2026-07-01', '2026-07-02');
    expect(report.totalsBySource.adhoc).toBe(0);
  });

  it('includes a time log on the last day of the range regardless of time-of-day', () => {
    const item = completedItem('adhoc', '2026-07-02T23:00:00.000Z');
    logTime(item.id, '2026-07-02T23:30:00.000Z', 1);

    const report = getTimeReport(db, '2026-07-01', '2026-07-02');
    expect(report.totalsBySource.adhoc).toBe(1);
  });

  it('pivots dailySeries into one row per day with a column per source', () => {
    const gh = completedItem('github_pr', '2026-07-01T10:00:00.000Z');
    logTime(gh.id, '2026-07-01T09:00:00.000Z', 2);

    const ado = completedItem('ado_workitem', '2026-07-01T10:00:00.000Z');
    logTime(ado.id, '2026-07-01T11:00:00.000Z', 1);

    const gh2 = completedItem('github_pr', '2026-07-02T10:00:00.000Z');
    logTime(gh2.id, '2026-07-02T09:00:00.000Z', 3);

    const report = getTimeReport(db, '2026-07-01', '2026-07-02');
    expect(report.dailySeries).toEqual([
      { date: '2026-07-01', github_pr: 2, ado_workitem: 1, adhoc: 0 },
      { date: '2026-07-02', github_pr: 3, ado_workitem: 0, adhoc: 0 },
    ]);
  });

  it('buckets a time log that spans multiple days under the day the item was completed, not the day it started', () => {
    const item = completedItem('adhoc', '2026-07-07T10:00:00.000Z');
    logTime(item.id, '2026-07-03T09:00:00.000Z', 95.77);

    const report = getTimeReport(db, '2026-07-03', '2026-07-07');
    const day03 = report.dailySeries.find((d) => d.date === '2026-07-03');
    const day07 = report.dailySeries.find((d) => d.date === '2026-07-07');

    expect(day03).toBeUndefined();
    expect(day07?.adhoc).toBe(95.77);
  });

  it('returns all-zero totals and an empty dailySeries when nothing matches', () => {
    const report = getTimeReport(db, '2026-07-01', '2026-07-02');
    expect(report.totalsBySource).toEqual({ github_pr: 0, ado_workitem: 0, adhoc: 0 });
    expect(report.dailySeries).toEqual([]);
  });
});
