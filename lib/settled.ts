import type { Item } from './types';

// An item is "settled" when its source system says there is nothing left to do
// on it, but Ariadne's own status still says otherwise. Ariadne is read-only
// against GitHub and Azure DevOps, so it can never act on that itself -- it can
// only surface it and let you Complete the item by hand.
//
// 'finished' means you got it over the line (merged, Done). 'gone' means it
// left your plate without being finished (an ADO work item set to Removed), so
// it must not wear the same affirmative marker.
export type SettledOutcome = 'finished' | 'gone';

// Azure DevOps work item states are free text per process template, so both
// checks are substring matches. Shared with lib/status-pill.ts, which colours
// the pill off the same two patterns -- the green pill and the settled check
// must never disagree about what a state means.
export const ADO_FINISHED_PATTERN = /resolv|done|closed|complet/i;
export const ADO_GONE_PATTERN = /remov/i;

export function settledOutcome(item: Pick<Item, 'source' | 'prStatus' | 'adoStatus'>): SettledOutcome | null {
  if (item.source === 'github_pr') {
    return item.prStatus === 'merged' ? 'finished' : null;
  }
  if (item.source === 'ado_workitem' && item.adoStatus) {
    // Gone wins a state that matches both: "Removed (was Done)" is removed.
    if (ADO_GONE_PATTERN.test(item.adoStatus)) return 'gone';
    if (ADO_FINISHED_PATTERN.test(item.adoStatus)) return 'finished';
  }
  return null;
}
