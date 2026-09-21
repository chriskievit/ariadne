import { describe, it, expect } from 'vitest';
import {
  ROSTER_BAND_ORDER,
  rosterWaitingSince,
  sortRoster,
  rosterBandCounts,
  getRosterReference,
  type RosterSession,
} from './agent-roster';
import type { AgentSessionState } from './types';

function session(overrides: Partial<RosterSession> & { id: number; state: AgentSessionState }): RosterSession {
  return {
    createdAt: '2026-09-21T10:00:00.000Z',
    registeredAt: null,
    lastEventAt: null,
    ...overrides,
  };
}

describe('ROSTER_BAND_ORDER', () => {
  it('puts the states that want your eyes above the ones that do not', () => {
    expect(ROSTER_BAND_ORDER).toEqual(['needs_you', 'failed', 'ready', 'working', 'launching', 'stopped']);
  });

  it('covers every session state exactly once, so no state can sort off the end of the rail', () => {
    const states: AgentSessionState[] = ['launching', 'working', 'needs_you', 'ready', 'failed', 'stopped'];
    expect([...ROSTER_BAND_ORDER].sort()).toEqual([...states].sort());
    expect(new Set(ROSTER_BAND_ORDER).size).toBe(ROSTER_BAND_ORDER.length);
  });
});

describe('rosterWaitingSince', () => {
  it('prefers the last event, because that is when the session entered the state it is in', () => {
    expect(
      rosterWaitingSince(
        session({
          id: 1,
          state: 'working',
          createdAt: '2026-09-21T10:00:00.000Z',
          registeredAt: '2026-09-21T10:01:00.000Z',
          lastEventAt: '2026-09-21T10:02:00.000Z',
        })
      )
    ).toBe('2026-09-21T10:02:00.000Z');
  });

  it('falls back to registration, then to creation, so a session with no events still sorts', () => {
    expect(
      rosterWaitingSince(session({ id: 1, state: 'working', registeredAt: '2026-09-21T10:01:00.000Z' }))
    ).toBe('2026-09-21T10:01:00.000Z');
    expect(rosterWaitingSince(session({ id: 1, state: 'launching' }))).toBe('2026-09-21T10:00:00.000Z');
  });
});

describe('sortRoster', () => {
  it('orders by band before anything else', () => {
    const sorted = sortRoster([
      session({ id: 1, state: 'stopped' }),
      session({ id: 2, state: 'working' }),
      session({ id: 3, state: 'needs_you' }),
      session({ id: 4, state: 'ready' }),
      session({ id: 5, state: 'failed' }),
      session({ id: 6, state: 'launching' }),
    ]);
    expect(sorted.map((s) => s.state)).toEqual([
      'needs_you',
      'failed',
      'ready',
      'working',
      'launching',
      'stopped',
    ]);
  });

  it('puts the longest waiting first inside a band', () => {
    const sorted = sortRoster([
      session({ id: 1, state: 'needs_you', lastEventAt: '2026-09-21T12:00:00.000Z' }),
      session({ id: 2, state: 'needs_you', lastEventAt: '2026-09-21T09:00:00.000Z' }),
      session({ id: 3, state: 'needs_you', lastEventAt: '2026-09-21T11:00:00.000Z' }),
    ]);
    expect(sorted.map((s) => s.id)).toEqual([2, 3, 1]);
  });

  it('breaks an exact tie by id, so the rail does not reshuffle between two polls', () => {
    const at = '2026-09-21T09:00:00.000Z';
    const first = sortRoster([
      session({ id: 9, state: 'working', lastEventAt: at }),
      session({ id: 4, state: 'working', lastEventAt: at }),
    ]);
    const second = sortRoster([
      session({ id: 4, state: 'working', lastEventAt: at }),
      session({ id: 9, state: 'working', lastEventAt: at }),
    ]);
    expect(first.map((s) => s.id)).toEqual([4, 9]);
    expect(second.map((s) => s.id)).toEqual([4, 9]);
  });

  it('does not mutate its input', () => {
    const input = [session({ id: 1, state: 'stopped' }), session({ id: 2, state: 'needs_you' })];
    sortRoster(input);
    expect(input.map((s) => s.id)).toEqual([1, 2]);
  });
});

describe('rosterBandCounts', () => {
  it('reports occupied bands only, in rail order', () => {
    expect(
      rosterBandCounts([
        session({ id: 1, state: 'working' }),
        session({ id: 2, state: 'needs_you' }),
        session({ id: 3, state: 'working' }),
      ])
    ).toEqual([
      { state: 'needs_you', count: 1 },
      { state: 'working', count: 2 },
    ]);
  });

  it('is empty for no sessions', () => {
    expect(rosterBandCounts([])).toEqual([]);
  });
});

describe('getRosterReference', () => {
  it('publishes one row per band, in order, each with a reason', () => {
    const rows = getRosterReference();
    expect(rows).toHaveLength(ROSTER_BAND_ORDER.length);
    expect(rows.map((row) => row.state)).toEqual(ROSTER_BAND_ORDER);
    for (const row of rows) {
      expect(row.reason.length).toBeGreaterThan(0);
    }
  });
});
