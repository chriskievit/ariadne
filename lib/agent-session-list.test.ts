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

  describe('onTodayPlan', () => {
    it('marks a session whose item is on today\'s plan', () => {
      const now = new Date();
      addPlanItem(db, localDateString(now), itemId);
      launch('on-plan');
      const [entry] = listSessionsForDisplay(db, now);
      expect(entry.onTodayPlan).toBe(true);
    });

    it('leaves a session unmarked when its item is on yesterday\'s plan, not today\'s', () => {
      const now = new Date();
      addPlanItem(db, addDays(localDateString(now), -1), itemId);
      launch('on-yesterday');
      const [entry] = listSessionsForDisplay(db, now);
      expect(entry.onTodayPlan).toBe(false);
    });

    // The trap: today_date is a legacy field a plan built through
    // add_plan_item never touches (see the MCP add_plan_item tool, which
    // calls addPlanItem directly). A join that reads today_date instead of
    // plan_items would mark this row, and it would look plausible doing it.
    it('leaves a session unmarked when its item has today_date set but is not in plan_items', () => {
      const now = new Date();
      setTodayDate(db, itemId, localDateString(now));
      launch('stale-today-date');
      const [entry] = listSessionsForDisplay(db, now);
      expect(entry.onTodayPlan).toBe(false);
    });
  });
});
