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

// The header stat and the Signals sub-heading both count "needs something
// from you", and they must never disagree -- one predicate so there is only
// one definition. Blocked is included: the next move is not yours, but
// getting someone to make it is.
export function needsYou(item: Pick<Item, 'source' | 'adoStatus' | 'reason'>): boolean {
  const group = groupOf(item);
  return group === 'waiting_on_you' || group === 'blocked';
}

// Ad-hoc items always render, even below the score threshold that used to
// gate the old "Needs attention" section -- this says which rows are only
// visible because of that exemption, so the UI can name it (the score-chip
// popover, and the row's inline badge).
//
// It no longer drives the collapse-after-5 cut: SignalsBoard exempts every
// ad-hoc row from that, not just the ones below the threshold, so earning a
// priority can never push an item behind "Show N more".
export function isKeptVisible(item: Pick<Item, 'source'>, score: number): boolean {
  return item.source === 'adhoc' && score < NEEDS_ATTENTION_THRESHOLD;
}

// The third non-point ordering rule, and until now the only undisclosed one:
// a starred item sorts to the top of its group whatever it scores. Extracted
// out of SignalsBoard so it has a name, a test, and a single definition that
// getScoringReference()'s nonPointRules can be checked against -- PRODUCT.md
// commits that every rule affecting order stays disclosed wherever the
// scoring is explained, and an anonymous comparator inside a component is
// not disclosure.
//
// Stable by construction: Array.prototype.sort is stable in every runtime
// this ships on, so items that are both starred or both unstarred keep the
// score order sortByUrgency already put them in.
export function sortStarredFirst<T extends { starred: boolean }>(items: T[]): T[] {
  return [...items].sort((a, b) => Number(b.starred) - Number(a.starred));
}

// How many rows a group shows before it collapses the rest, and the ceiling
// a tie is allowed to push that to.
export const VISIBLE_PER_GROUP = 5;
export const VISIBLE_PER_GROUP_MAX = 12;

// "Waiting on you" means the next move is yours on every row in it. A group
// defined by owed action cannot hide part of what is owed -- the header
// count is a promise the rows have to keep -- so it never collapses.
const NEVER_COLLAPSED = new Set<ObligationGroup>(['waiting_on_you']);

// The fourth non-point rule, and the one that cost the most: how many rows a
// group renders. It lives here rather than as a bare constant inside
// SignalsBoard for the same reason sortStarredFirst does -- it changes what
// you can see, PRODUCT.md commits to disclosing every such rule, and an
// anonymous `slice(0, 5)` inside a component is not disclosure.
//
// The cut may never split a run of equal scores. Rows that score the same
// lost no comparison, so showing one and hiding another claims a ranking
// sortByUrgency does not have at that index -- it only has its
// oldest-activity-first tie-break, which is anti-correlated with what a
// triage surface is for: it pushes the rows that changed today to the back.
// That is exactly how a freshly-opened review request ended up behind
// "Show 4 more" while five older ones stayed visible.
//
// `filtered` is true when a query is narrowing the board. A query is an
// explicit request to see a set, so collapsing the answer to it truncates
// something the user just asked for -- and it is what made the
// "Show these in Signals" handoff from the waiting-on-you popover land on
// fewer rows than the count it came from promised.
export function visibleCount(
  rows: { score: number }[],
  group: ObligationGroup,
  filtered: boolean
): number {
  if (filtered || NEVER_COLLAPSED.has(group)) return rows.length;
  if (rows.length <= VISIBLE_PER_GROUP) return rows.length;
  let n = VISIBLE_PER_GROUP;
  while (n < rows.length && n < VISIBLE_PER_GROUP_MAX && rows[n].score === rows[n - 1].score) n++;
  return n;
}
