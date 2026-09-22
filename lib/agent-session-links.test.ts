import { describe, it, expect } from 'vitest';
import { liveSessionsByItem, liveSessionFor, type LiveSessionSummary } from './agent-session-links';

const session = (over: Partial<LiveSessionSummary> & { id: number; itemId: number }) => ({
  state: 'working' as const, endedAt: null, registeredAt: null, createdAt: '2026-09-22T09:00:00.000Z', ...over,
});

describe('liveSessionsByItem', () => {
  it('indexes a live session by its item', () => {
    const map = liveSessionsByItem([session({ id: 1, itemId: 7 })]);
    expect(liveSessionFor(map, 7)?.id).toBe(1);
  });

  it('ignores an ended session, so a dialog does not warn about one that is over', () => {
    const map = liveSessionsByItem([session({ id: 1, itemId: 7, endedAt: '2026-09-22T10:00:00.000Z' })]);
    expect(liveSessionFor(map, 7)).toBeUndefined();
  });

  it('keeps a failed session that never ended, because its agent may still be alive', () => {
    // never_registered keeps a null endedAt on purpose so a late SessionStart
    // can revive it. Treating it as gone would hide a real process.
    const map = liveSessionsByItem([session({ id: 1, itemId: 7, state: 'failed' })]);
    expect(liveSessionFor(map, 7)?.id).toBe(1);
  });

  it('prefers the most recently launched when an item somehow has two', () => {
    const map = liveSessionsByItem([session({ id: 1, itemId: 7 }), session({ id: 4, itemId: 7 })]);
    expect(liveSessionFor(map, 7)?.id).toBe(4);
  });

  it('returns undefined for an item with no session at all', () => {
    expect(liveSessionFor(liveSessionsByItem([]), 7)).toBeUndefined();
  });
});
