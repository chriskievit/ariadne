import { describe, it, expect } from 'vitest';
import { adoStatusCategory, adoCountsAsSprintDone, adoStateFields } from './ado-state';

describe('adoStatusCategory', () => {
  it.each(['Done', 'Closed', 'Resolved', 'Completed', 'done', 'CLOSED'])('maps %s to done', (state) => {
    expect(adoStatusCategory(state)).toBe('done');
  });

  it.each(['Active', 'Committed', 'Doing', 'In Progress'])('maps %s to in_progress', (state) => {
    expect(adoStatusCategory(state)).toBe('in_progress');
  });

  it.each(['New', 'To Do', 'ToDo'])('maps %s to todo', (state) => {
    expect(adoStatusCategory(state)).toBe('todo');
  });

  it.each(['Blocked', 'Removed', 'Ready for Test', 'In Review', 'Design'])('maps %s to null', (state) => {
    expect(adoStatusCategory(state)).toBeNull();
  });

  it('returns null for a missing state', () => {
    expect(adoStatusCategory(null)).toBeNull();
  });

  it('checks finished before in-progress, as the pill always has', () => {
    // "Done (in progress review)" matches both patterns, and finished must win.
    expect(adoStatusCategory('Done (in progress review)')).toBe('done');
  });
});

describe('adoCountsAsSprintDone', () => {
  it.each(['Done', 'Ready for validation', 'Ready for Test', 'ready for test'])('counts %s', (state) => {
    expect(adoCountsAsSprintDone(state)).toBe(true);
  });

  it.each(['Closed', 'Resolved', 'Active', 'New'])('does not count %s', (state) => {
    expect(adoCountsAsSprintDone(state)).toBe(false);
  });

  it('does not count a missing state', () => {
    expect(adoCountsAsSprintDone(null)).toBe(false);
  });
});

describe('adoStateFields', () => {
  it('pairs the raw label with its category', () => {
    expect(adoStateFields('Active')).toEqual({ upstreamStatus: 'Active', statusCategory: 'in_progress' });
    expect(adoStateFields(null)).toEqual({ upstreamStatus: null, statusCategory: null });
  });
});
