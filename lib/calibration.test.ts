import { describe, it, expect, beforeEach } from 'vitest';
import { openDb } from './db';
import { upsertSyncedItem, createAdhocItem } from './items-repo';
import { addPlanItem, setPlanItemEstimate } from './plans-repo';
import { startTimer, completeTimer } from './time-logs-repo';
import { classifyWorkType, getCalibrationSummary, formatCalibrationSentence } from './calibration';
import type Database from 'better-sqlite3';

let db: Database.Database;

beforeEach(() => {
  db = openDb(':memory:');
});

describe('classifyWorkType', () => {
  it('classifies review_requested and approved_unmerged as review', () => {
    expect(classifyWorkType('review_requested')).toBe('review');
    expect(classifyWorkType('approved_unmerged')).toBe('review');
  });

  it('classifies stale_own_pr and authored as own_work', () => {
    expect(classifyWorkType('stale_own_pr')).toBe('own_work');
    expect(classifyWorkType('authored')).toBe('own_work');
  });

  it('classifies assigned and mention as assigned', () => {
    expect(classifyWorkType('assigned')).toBe('assigned');
    expect(classifyWorkType('mention')).toBe('assigned');
  });

  it('classifies manual as ad_hoc', () => {
    expect(classifyWorkType('manual')).toBe('ad_hoc');
  });
});

describe('getCalibrationSummary', () => {
  it('sums estimate and actual minutes per work type for the date range', () => {
    const pr = upsertSyncedItem(db, {
      source: 'github_pr',
      externalId: '1@a/b',
      title: 'Review this',
      url: null,
      reason: 'review_requested',
      dueDate: null,
      sprintIteration: null,
      rawUpdatedAt: null,
      repo: null,
    });
    addPlanItem(db, '2026-08-14', pr.id);
    setPlanItemEstimate(db, '2026-08-14', pr.id, 60);
    startTimer(db, pr.id);
    completeTimer(db, pr.id, { durationHours: 1.5 });
    // Backdate the log to the plan date so the join lines up in the test.
    db.prepare("UPDATE time_logs SET started_at = '2026-08-14T09:00:00.000Z' WHERE item_id = ?").run(pr.id);

    const summary = getCalibrationSummary(db, '2026-08-14', '2026-08-14');
    const review = summary.find((s) => s.workType === 'review');
    expect(review).toEqual({ workType: 'review', label: 'Review-type work', estimateMinutes: 60, actualMinutes: 90 });
  });

  it('returns an empty array when there is no plan data in range', () => {
    expect(getCalibrationSummary(db, '2026-01-01', '2026-01-02')).toEqual([]);
  });
});

describe('formatCalibrationSentence', () => {
  it('states the percentage over estimate when actual exceeds estimate', () => {
    const sentence = formatCalibrationSentence({
      workType: 'review',
      label: 'Review-type work',
      estimateMinutes: 60,
      actualMinutes: 90,
    });
    expect(sentence).toBe('Review-type work ran 50% over estimate.');
  });

  it('returns null when estimate is zero (nothing to compare against)', () => {
    expect(
      formatCalibrationSentence({ workType: 'review', label: 'Review-type work', estimateMinutes: 0, actualMinutes: 30 })
    ).toBeNull();
  });

  it('returns null when actual is at or under estimate (nothing worth flagging)', () => {
    expect(
      formatCalibrationSentence({ workType: 'review', label: 'Review-type work', estimateMinutes: 60, actualMinutes: 60 })
    ).toBeNull();
  });
});
