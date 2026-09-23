import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import { openDb } from './db';
import { createAdhocItem, setTodayDate } from './items-repo';
import { createAgentSession, applyAgentSessionPatch } from './agent-sessions-repo';
import { addPlanItem } from './plans-repo';
import { localDateString, addDays } from './date';
import { listSessionsForDisplay, RECENT_ENDED_LIMIT } from './agent-session-list';

let db: Database.Database;
let itemId: number;

beforeEach(() => {
  db = openDb(':memory:');
  itemId = createAdhocItem(db, { title: 'Ticket' }).id;
});

function launch(token: string) {
  return createAgentSession(db, { itemId, agent: 'claude', launchToken: token, tabTitle: 'Tab', tabColor: 'yellow' });
}

describe('listSessionsForDisplay', () => {
  it('never puts the launch token in the payload', () => {
    launch('secret-token');
    const [entry] = listSessionsForDisplay(db, new Date());
    expect(JSON.stringify(entry)).not.toContain('secret-token');
    expect(entry).not.toHaveProperty('launchToken');
  });

  it('marks a session that never reported in as failed without ending it', () => {
    const session = launch('never');
    const later = new Date(Date.parse(session.createdAt) + 10 * 60 * 1000);

    const [entry] = listSessionsForDisplay(db, later);
    expect(entry.state).toBe('failed');
    expect(entry.endReason).toBe('never_registered');
    // endedAt stays null so a late SessionStart can still revive the row.
    expect(entry.endedAt).toBeNull();
  });

  it('leaves a session inside its launch window alone', () => {
    const session = launch('fresh');
    const [entry] = listSessionsForDisplay(db, new Date(Date.parse(session.createdAt) + 1000));
    expect(entry.state).toBe('launching');
  });

  it('caps how many ended sessions come back, newest first', () => {
    for (let i = 0; i < RECENT_ENDED_LIMIT + 5; i += 1) {
      const session = launch(`ended-${i}`);
      applyAgentSessionPatch(db, session.id, {
        state: 'stopped',
        endedAt: new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString(),
        endReason: 'closed',
      });
    }
    const entries = listSessionsForDisplay(db, new Date());
    expect(entries).toHaveLength(RECENT_ENDED_LIMIT);
    const endedAts = entries.map((entry) => entry.endedAt as string);
    expect([...endedAts].sort().reverse()).toEqual(endedAts);
  });

  it('keeps every open session regardless of the ended cap', () => {
    for (let i = 0; i < RECENT_ENDED_LIMIT + 5; i += 1) {
      const session = launch(`closed-${i}`);
      applyAgentSessionPatch(db, session.id, {
        state: 'stopped',
        endedAt: new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString(),
        endReason: 'closed',
      });
    }
    const open = launch('open');
    applyAgentSessionPatch(db, open.id, { state: 'working', registeredAt: new Date().toISOString() });

    const entries = listSessionsForDisplay(db, new Date());
    expect(entries.filter((entry) => entry.endedAt === null).map((entry) => entry.id)).toEqual([open.id]);
  });

  it('gives a session with no transcript an empty tail rather than omitting the field', () => {
    launch('no-transcript');
    const [entry] = listSessionsForDisplay(db, new Date());
    expect(entry.lastLines).toEqual([]);
  });

  describe('onToday', () => {
    it('marks a session whose item is pinned to today (today_date)', () => {
      const now = new Date();
      setTodayDate(db, itemId, localDateString(now));
      launch('pinned-today');
      const [entry] = listSessionsForDisplay(db, now);
      expect(entry.onToday).toBe(true);
    });

    it('leaves a session unmarked when its item is pinned to yesterday, not today', () => {
      const now = new Date();
      setTodayDate(db, itemId, addDays(localDateString(now), -1));
      launch('pinned-yesterday');
      const [entry] = listSessionsForDisplay(db, now);
      expect(entry.onToday).toBe(false);
    });

    // This is Planning's own rule (getGroupedItems, lib/dashboard.ts:56):
    // Today is today_date, independent of plan_items membership. An item
    // pinned via /api/items/[id]/today without ever being added to a plan
    // (or added and then removed from one) still shows in Planning's Today
    // section, so the rail must mark it too, or the two modes disagree.
    it('marks a session whose item is pinned to today even though it is not in today\'s plan_items', () => {
      const now = new Date();
      setTodayDate(db, itemId, localDateString(now));
      launch('pinned-not-planned');
      const [entry] = listSessionsForDisplay(db, now);
      expect(entry.onToday).toBe(true);
    });

    // The other divergent case, and the one the join must not get backwards:
    // plan_items is capacity-and-logged-hours bookkeeping for the day
    // (dashboard.ts:60-64), not what Planning's Today section shows. An item
    // in today's plan_items whose today_date has been cleared -- removed
    // from Today while its estimate and logged time keep counting toward
    // the day's totals -- is not in Planning's Today section, so the rail
    // must not mark it either.
    it('leaves a session unmarked when its item is in today\'s plan_items but today_date is not today', () => {
      const now = new Date();
      addPlanItem(db, localDateString(now), itemId);
      launch('planned-not-pinned');
      const [entry] = listSessionsForDisplay(db, now);
      expect(entry.onToday).toBe(false);
    });
  });
});
