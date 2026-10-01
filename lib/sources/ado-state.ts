import type { StatusCategory } from '../types';

// Azure DevOps work item states are free text per process template, so every
// rule here is a substring match on the state name. This module is pure:
// lib/settled.ts and lib/status-pill.ts run in client components; settled.ts
// imports it, and status-pill.ts reaches it through settled.

export const ADO_FINISHED_PATTERN = /resolv|done|closed|complet/i;
export const ADO_GONE_PATTERN = /remov/i;
const ADO_IN_PROGRESS_PATTERN = /active|committ|doing|progress/i;
const ADO_TODO_PATTERN = /to ?do|new/i;

// Wider than ADO_FINISHED_PATTERN on purpose: a hand-off state like "Ready for
// test" counts toward sprint progress, but it is not settled -- the item can
// still bounce back to you.
export const SPRINT_DONE_ADO_STATES: ReadonlySet<string> = new Set(['done', 'ready for validation', 'ready for test']);

// Order matters and matches what the status pill always did: finished wins
// over in-progress, which wins over to-do.
export function adoStatusCategory(state: string | null): StatusCategory | null {
  if (!state) return null;
  if (ADO_FINISHED_PATTERN.test(state)) return 'done';
  if (ADO_IN_PROGRESS_PATTERN.test(state)) return 'in_progress';
  if (ADO_TODO_PATTERN.test(state)) return 'todo';
  return null;
}

export function adoCountsAsSprintDone(state: string | null): boolean {
  return state != null && SPRINT_DONE_ADO_STATES.has(state.toLowerCase());
}

// The two fields always travel together for an ADO item. The client, the
// migration backfill and every seed use this so the category can never drift
// from the label it was derived from.
export function adoStateFields(state: string | null): { upstreamStatus: string | null; statusCategory: StatusCategory | null } {
  return { upstreamStatus: state, statusCategory: adoStatusCategory(state) };
}
