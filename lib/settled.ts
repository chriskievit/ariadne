import type { Item, Source } from './types';
import { ADO_GONE_PATTERN } from './sources/ado-state';
import { isTrackerSource } from './sources/tracker';

// An item is "settled" when its source system says there is nothing left to do
// on it, but Ariadne's own status still says otherwise. Ariadne is read-only
// against GitHub and Azure DevOps, so it can never act on that itself -- it can
// only surface it and let you Complete the item by hand.
//
// 'finished' means you got it over the line (merged, Done). 'gone' means it
// left your plate without being finished (an ADO work item set to Removed), so
// it must not wear the same affirmative marker.
export type SettledOutcome = 'finished' | 'gone';

// Labels that mean "left your plate without being finished", per tracker.
// A label match, because no tracker has a category for it: Jira, for one,
// files "Won't Do" under done.
const GONE_PATTERNS: Partial<Record<Source, RegExp>> = {
  ado_workitem: ADO_GONE_PATTERN,
};

// Shared with lib/status-pill.ts, which colours the pill off the same facts --
// the pill and the settled check must never disagree about what a state means.
export function isGoneState(item: Pick<Item, 'source' | 'upstreamStatus'>): boolean {
  const pattern = GONE_PATTERNS[item.source];
  return pattern !== undefined && item.upstreamStatus !== null && pattern.test(item.upstreamStatus);
}

export function settledOutcome(
  item: Pick<Item, 'source' | 'prStatus' | 'upstreamStatus' | 'statusCategory'>
): SettledOutcome | null {
  if (item.source === 'github_pr') {
    return item.prStatus === 'merged' ? 'finished' : null;
  }
  if (isTrackerSource(item.source)) {
    // Gone wins a state that is both: "Removed (was Done)" is removed.
    if (isGoneState(item)) return 'gone';
    if (item.statusCategory === 'done') return 'finished';
  }
  return null;
}
