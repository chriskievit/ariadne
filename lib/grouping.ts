import { NEEDS_ATTENTION_THRESHOLD } from './config';
import type { Item, Reason } from './types';

export type ObligationGroup = 'blocked' | 'waiting_on_you' | 'moving_without_you' | 'lower_priority';

// Display order on the Signals list. This is independent of groupOf()'s
// internal classification precedence below (blocked is checked first there
// so it wins ties) -- "Waiting on you" is shown first because it is the
// group most directly actionable by you; "Blocked" needs someone else to
// unblock it first.
export const GROUP_ORDER: ObligationGroup[] = [
  'waiting_on_you',
  'blocked',
  'moving_without_you',
  'lower_priority',
];

export const GROUP_LABEL: Record<ObligationGroup, string> = {
  waiting_on_you: 'Waiting on you',
  blocked: 'Blocked',
  moving_without_you: 'Moving without you',
  lower_priority: 'Lower priority',
};

const WAITING_ON_YOU_REASONS = new Set<Reason>(['review_requested', 'mention', 'approved_unmerged']);
const MOVING_WITHOUT_YOU_REASONS = new Set<Reason>(['stale_own_pr', 'authored']);

function isBlocked(item: Pick<Item, 'source' | 'adoStatus'>): boolean {
  return item.source === 'ado_workitem' && !!item.adoStatus && /block/i.test(item.adoStatus);
}

// Total over Reason: every branch of the union lands in exactly one group.
// Classification precedence: a blocked ADO state wins regardless of reason
// (checked first below); otherwise the reason alone determines the group.
// approved_unmerged is filed under Waiting on you, not Moving without you --
// it is the highest-scoring reason (45) and the ball is in your court to
// merge, a deliberate deviation from the source proposal (see
// docs/wireframes/README.md).
export function groupOf(item: Pick<Item, 'source' | 'adoStatus' | 'reason'>): ObligationGroup {
  if (isBlocked(item)) return 'blocked';
  if (WAITING_ON_YOU_REASONS.has(item.reason)) return 'waiting_on_you';
  if (MOVING_WITHOUT_YOU_REASONS.has(item.reason)) return 'moving_without_you';
  return 'lower_priority';
}

// Ad-hoc items always render, even below the score threshold that used to
// gate the old "Needs attention" section -- this says which rows are only
// visible because of that exemption, so the UI can name it (score-chip
// popover) and exempt it from the collapse-after-5 cut (SignalsBoard).
export function isKeptVisible(item: Pick<Item, 'source'>, score: number): boolean {
  return item.source === 'adhoc' && score < NEEDS_ATTENTION_THRESHOLD;
}
