import { describe, it, expect } from 'vitest';
import { selectFocus, waitingOnYou } from './focus';
import type { Status } from './types';

function item(id: number, status: Status = 'inbox', parked = false) {
  return { id, status, parked };
}

describe('selectFocus', () => {
  it('puts the timed item in Now, wherever it sits on the plan', () => {
    const today = [item(1, 'in_progress'), item(2), item(3, 'in_progress')];
    const { now, upNext } = selectFocus(today, [today[0], today[2]], 3);
    expect(now?.id).toBe(3);
    expect(upNext.map((i) => i.id)).toEqual([1, 2]);
  });

  it('shows a timed item that is not on Today, and leaves Today whole', () => {
    const today = [item(1), item(2)];
    const { now, upNext } = selectFocus(today, [item(9, 'in_progress')], 9);
    expect(now?.id).toBe(9);
    expect(upNext.map((i) => i.id)).toEqual([1, 2]);
  });

  it('falls back to the first started item on the plan when no timer runs', () => {
    const today = [item(1), item(2, 'in_progress'), item(3, 'in_progress')];
    expect(selectFocus(today, [today[1], today[2]], null).now?.id).toBe(2);
  });

  it('falls back to any started item when nothing on the plan is started', () => {
    expect(selectFocus([item(1)], [item(7, 'in_progress')], null).now?.id).toBe(7);
  });

  it('never picks a parked item for Now', () => {
    const parked = item(4, 'in_progress', true);
    const { now, upNext } = selectFocus([parked], [], null);
    expect(now).toBeNull();
    expect(upNext.map((i) => i.id)).toEqual([4]);
  });

  it('drops finished items from Up next', () => {
    const { upNext } = selectFocus([item(1, 'done'), item(2)], [], null);
    expect(upNext.map((i) => i.id)).toEqual([2]);
  });

  it('counts started work off the plan, but not Now and not parked work', () => {
    const inProgress = [item(5, 'in_progress'), item(6, 'in_progress'), item(7, 'in_progress', true)];
    const { now, alsoInProgress } = selectFocus([item(1)], inProgress, 5);
    expect(now?.id).toBe(5);
    expect(alsoInProgress).toBe(1);
  });

  it('does not count a started item already listed in Up next', () => {
    const started = item(2, 'in_progress');
    expect(selectFocus([item(1, 'in_progress'), started], [item(1, 'in_progress'), started], 1).alsoInProgress).toBe(0);
  });

  it('returns an empty screen for an empty day', () => {
    expect(selectFocus([], [], null)).toEqual({ now: null, upNext: [], alsoInProgress: 0 });
  });
});

describe('waitingOnYou', () => {
  it('keeps live sessions that need you and nothing else', () => {
    const sessions = [
      { id: 1, state: 'needs_you' as const, endedAt: null },
      { id: 2, state: 'needs_you' as const, endedAt: '2026-10-27T10:00:00.000Z' },
      { id: 3, state: 'working' as const, endedAt: null },
    ];
    expect(waitingOnYou(sessions).map((s) => s.id)).toEqual([1]);
  });
});
