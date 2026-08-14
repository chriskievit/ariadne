import type { Item, PrStatus } from './types';

export type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'warning' | 'success' | 'outline' | 'blocked';

export interface StatusPill {
  label: string;
  variant: BadgeVariant;
}

// Status is neutral outline by default; a filled variant is reserved for
// states that demand action. Indigo ('default') never appears here — that
// channel is interactive-only (see docs/wireframes/phase-0-foundation.html).
const PR_STATUS_PILL: Record<PrStatus, StatusPill> = {
  draft: { label: 'Draft', variant: 'outline' },
  ready_for_review: { label: 'Ready for review', variant: 'outline' },
  changes_requested: { label: 'Changes requested', variant: 'warning' },
  approved: { label: 'Approved', variant: 'outline' },
  merged: { label: 'Merged', variant: 'outline' },
};

function adoStatusVariant(state: string): BadgeVariant {
  const s = state.toLowerCase();
  if (/block/.test(s)) return 'blocked';
  if (/resolv|done|closed|complet/.test(s)) return 'success';
  if (/remov/.test(s)) return 'destructive';
  if (/active|committ|doing|progress/.test(s)) return 'secondary';
  return 'outline';
}

export function getStatusPill(item: Pick<Item, 'source' | 'prStatus' | 'adoStatus'>): StatusPill | null {
  if (item.source === 'github_pr' && item.prStatus) return PR_STATUS_PILL[item.prStatus];
  if (item.source === 'ado_workitem' && item.adoStatus) {
    return { label: item.adoStatus, variant: adoStatusVariant(item.adoStatus) };
  }
  return null;
}
