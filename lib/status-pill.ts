import { isGoneState } from './settled';
import { isTrackerSource } from './sources/tracker';
import type { Item, PrStatus } from './types';

export type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'warning' | 'success' | 'outline' | 'blocked';

export interface StatusPill {
  label: string;
  variant: BadgeVariant;
}

// Status is neutral outline by default; a filled variant is reserved for
// states that demand action. Azure ('default') never appears here — that
// channel is interactive-only (see docs/wireframes/phase-0-foundation.html).
const PR_STATUS_PILL: Record<PrStatus, StatusPill> = {
  draft: { label: 'Draft', variant: 'outline' },
  ready_for_review: { label: 'Ready for review', variant: 'outline' },
  changes_requested: { label: 'Changes requested', variant: 'warning' },
  approved: { label: 'Approved', variant: 'outline' },
  merged: { label: 'Merged', variant: 'outline' },
};

// The gone check comes from lib/settled.ts and the done category is what
// settled reads too -- the pill's colour and that check are two readings of
// the same fact and must not drift apart.
function trackerStatusVariant(item: Pick<Item, 'source' | 'upstreamStatus' | 'statusCategory'>): BadgeVariant {
  if (/block/i.test(item.upstreamStatus ?? '')) return 'blocked';
  if (isGoneState(item)) return 'destructive';
  if (item.statusCategory === 'done') return 'success';
  if (item.statusCategory === 'in_progress') return 'secondary';
  return 'outline';
}

export function getStatusPill(
  item: Pick<Item, 'source' | 'prStatus' | 'upstreamStatus' | 'statusCategory'>
): StatusPill | null {
  if (item.source === 'github_pr' && item.prStatus) return PR_STATUS_PILL[item.prStatus];
  if (isTrackerSource(item.source) && item.upstreamStatus) {
    return { label: item.upstreamStatus, variant: trackerStatusVariant(item) };
  }
  return null;
}
