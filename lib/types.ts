export type Source = 'github_pr' | 'ado_workitem' | 'adhoc';
export type Reason =
  | 'mention'
  | 'review_requested'
  | 'assigned'
  | 'authored'
  | 'manual'
  | 'stale_own_pr'
  | 'approved_unmerged';
export type PrStatus = 'draft' | 'ready_for_review' | 'changes_requested' | 'approved';
export type Status = 'inbox' | 'in_progress' | 'done';

export interface Item {
  id: number;
  source: Source;
  externalId: string | null;
  title: string;
  url: string | null;
  reason: Reason;
  category: string | null;
  dueDate: string | null;
  sprintIteration: string | null;
  rawUpdatedAt: string | null;
  status: Status;
  createdAt: string;
  completedAt: string | null;
  adoStatus: string | null;
  prStatus: PrStatus | null;
  repo: string | null;
  hasUnresolvedConversations: boolean;
}

export interface NewSyncedItemInput {
  source: 'github_pr' | 'ado_workitem';
  externalId: string;
  title: string;
  url: string | null;
  reason: Reason;
  dueDate: string | null;
  sprintIteration: string | null;
  rawUpdatedAt: string | null;
  adoStatus?: string | null;
  prStatus?: PrStatus | null;
  repo: string | null;
  hasUnresolvedConversations?: boolean;
  linkedAdoExternalIds?: string[];
}

export interface NewAdhocItemInput {
  title: string;
  category?: string | null;
  dueDate?: string | null;
}

export interface TimeLog {
  id: number;
  itemId: number;
  startedAt: string;
  endedAt: string | null;
  durationHours: number | null;
  note: string | null;
}
