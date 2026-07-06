import type { Item, PrStatus } from './types';

export type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'warning' | 'success' | 'outline';

export interface StatusPill {
  label: string;
  variant: BadgeVariant;
}

const PR_STATUS_PILL: Record<PrStatus, StatusPill> = {
  draft: { label: 'Draft', variant: 'secondary' },
  ready_for_review: { label: 'Ready for review', variant: 'default' },
  changes_requested: { label: 'Changes requested', variant: 'warning' },
  approved: { label: 'Approved', variant: 'success' },
};

function adoStatusVariant(state: string): BadgeVariant {
  const s = state.toLowerCase();
  if (/new|propos|to do|backlog/.test(s)) return 'secondary';
  if (/active|committ|doing|progress|approved/.test(s)) return 'default';
  if (/resolv|done|closed|complet/.test(s)) return 'success';
  if (/remov/.test(s)) return 'destructive';
  return 'outline';
}

export function getStatusPill(item: Pick<Item, 'source' | 'prStatus' | 'adoStatus'>): StatusPill | null {
  if (item.source === 'github_pr' && item.prStatus) return PR_STATUS_PILL[item.prStatus];
  if (item.source === 'ado_workitem' && item.adoStatus) {
    return { label: item.adoStatus, variant: adoStatusVariant(item.adoStatus) };
  }
  return null;
}
