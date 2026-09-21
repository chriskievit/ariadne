export type Source = 'github_pr' | 'ado_workitem' | 'adhoc';
export type Reason =
  | 'mention'
  | 'review_requested'
  | 'assigned'
  | 'authored'
  | 'manual'
  | 'stale_own_pr'
  | 'approved_unmerged';
export type PrStatus = 'draft' | 'ready_for_review' | 'changes_requested' | 'approved' | 'merged';
export type Status = 'inbox' | 'in_progress' | 'done';
export type TriageState = 'none' | 'done';
// Set by hand, ad-hoc items only. Distinct from UrgencyBand in lib/scoring.ts,
// which is the band a score lands in and is derived, never set.
export type Priority = 'low' | 'medium' | 'high';

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
  parked: boolean;
  todayDate: string | null;
  starred: boolean;
  snoozedUntil: string | null;
  triageState: TriageState;
  wokeEarly: boolean;
  priority: Priority | null;
  prioritySetAt: string | null;
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
  priority?: Priority | null;
}

export interface TimeLog {
  id: number;
  itemId: number;
  startedAt: string;
  endedAt: string | null;
  durationHours: number | null;
  note: string | null;
}

export interface Plan {
  date: string;
  capacityMinutes: number;
  note: string | null;
}

export interface PlanItem {
  planDate: string;
  itemId: number;
  sortOrder: number;
  estimateMinutes: number | null;
}

// Which agent CLI ran the session. Claude Code is the only one with hook
// support today; see lib/agents.ts for the fidelity tiers.
export type AgentKind = 'claude' | 'codex' | 'cursor' | 'opencode' | 'gemini' | 'aider';

// launching: the Warp tab was opened but the agent has not reported in yet.
// Claude Code's folder-trust prompt fires before SessionStart, so a session
// can sit here legitimately for a while, and then never register at all.
export type AgentSessionState = 'launching' | 'working' | 'needs_you' | 'ready' | 'failed' | 'stopped';

export interface AgentSession {
  id: number;
  itemId: number;
  agent: AgentKind;
  state: AgentSessionState;
  // Ariadne-generated and unguessable. Baked into the hook URL so every hook
  // event is attributable before the agent's own session id is known.
  launchToken: string;
  agentSessionId: string | null;
  transcriptPath: string | null;
  cwd: string | null;
  gitBranch: string | null;
  model: string | null;
  tabTitle: string;
  tabColor: string;
  createdAt: string;
  registeredAt: string | null;
  lastEventAt: string | null;
  endedAt: string | null;
  endReason: string | null;
  lastMessage: string | null;
  needsYouMessage: string | null;
}
