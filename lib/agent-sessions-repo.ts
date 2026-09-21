import type Database from 'better-sqlite3';
import type { AgentKind, AgentSession, AgentSessionState } from './types';

export interface NewAgentSessionInput {
  itemId: number;
  agent: AgentKind;
  launchToken: string;
  tabTitle: string;
  tabColor: string;
}

// Every field a hook event is allowed to move. Deliberately a partial:
// applyAgentSessionPatch writes only the keys present, so one hook never
// clears a field another hook set.
export interface AgentSessionPatch {
  state?: AgentSessionState;
  agentSessionId?: string | null;
  transcriptPath?: string | null;
  cwd?: string | null;
  gitBranch?: string | null;
  model?: string | null;
  registeredAt?: string | null;
  lastEventAt?: string | null;
  endedAt?: string | null;
  endReason?: string | null;
  lastMessage?: string | null;
  needsYouMessage?: string | null;
}

interface AgentSessionRow {
  id: number;
  item_id: number;
  agent: string;
  state: string;
  launch_token: string;
  agent_session_id: string | null;
  transcript_path: string | null;
  cwd: string | null;
  git_branch: string | null;
  model: string | null;
  tab_title: string;
  tab_color: string;
  created_at: string;
  registered_at: string | null;
  last_event_at: string | null;
  ended_at: string | null;
  end_reason: string | null;
  last_message: string | null;
  needs_you_message: string | null;
}

const PATCH_COLUMNS: Record<keyof AgentSessionPatch, string> = {
  state: 'state',
  agentSessionId: 'agent_session_id',
  transcriptPath: 'transcript_path',
  cwd: 'cwd',
  gitBranch: 'git_branch',
  model: 'model',
  registeredAt: 'registered_at',
  lastEventAt: 'last_event_at',
  endedAt: 'ended_at',
  endReason: 'end_reason',
  lastMessage: 'last_message',
  needsYouMessage: 'needs_you_message',
};

function rowToSession(row: AgentSessionRow): AgentSession {
  return {
    id: row.id,
    itemId: row.item_id,
    agent: row.agent as AgentKind,
    state: row.state as AgentSessionState,
    launchToken: row.launch_token,
    agentSessionId: row.agent_session_id,
    transcriptPath: row.transcript_path,
    cwd: row.cwd,
    gitBranch: row.git_branch,
    model: row.model,
    tabTitle: row.tab_title,
    tabColor: row.tab_color,
    createdAt: row.created_at,
    registeredAt: row.registered_at,
    lastEventAt: row.last_event_at,
    endedAt: row.ended_at,
    endReason: row.end_reason,
    lastMessage: row.last_message,
    needsYouMessage: row.needs_you_message,
  };
}

export function createAgentSession(db: Database.Database, input: NewAgentSessionInput): AgentSession {
  const now = new Date().toISOString();
  const result = db
    .prepare(
      `INSERT INTO agent_sessions (item_id, agent, state, launch_token, tab_title, tab_color, created_at)
       VALUES (?, ?, 'launching', ?, ?, ?, ?)`
    )
    .run(input.itemId, input.agent, input.launchToken, input.tabTitle, input.tabColor, now);
  return getAgentSessionById(db, Number(result.lastInsertRowid)) as AgentSession;
}

export function getAgentSessionById(db: Database.Database, id: number): AgentSession | undefined {
  const row = db.prepare('SELECT * FROM agent_sessions WHERE id = ?').get(id) as AgentSessionRow | undefined;
  return row ? rowToSession(row) : undefined;
}

export function getAgentSessionByToken(db: Database.Database, token: string): AgentSession | undefined {
  const row = db.prepare('SELECT * FROM agent_sessions WHERE launch_token = ?').get(token) as
    | AgentSessionRow
    | undefined;
  return row ? rowToSession(row) : undefined;
}

export function listAgentSessions(db: Database.Database): AgentSession[] {
  const rows = db.prepare('SELECT * FROM agent_sessions ORDER BY id DESC').all() as AgentSessionRow[];
  return rows.map(rowToSession);
}

export function listOpenAgentSessions(db: Database.Database): AgentSession[] {
  const rows = db
    .prepare('SELECT * FROM agent_sessions WHERE ended_at IS NULL ORDER BY id DESC')
    .all() as AgentSessionRow[];
  return rows.map(rowToSession);
}

export function applyAgentSessionPatch(db: Database.Database, id: number, patch: AgentSessionPatch): void {
  const keys = (Object.keys(patch) as (keyof AgentSessionPatch)[]).filter((key) => patch[key] !== undefined);
  if (keys.length === 0) return;

  const assignments = keys.map((key) => `${PATCH_COLUMNS[key]} = ?`).join(', ');
  const values = keys.map((key) => patch[key] as string | null);
  db.prepare(`UPDATE agent_sessions SET ${assignments} WHERE id = ?`).run(...values, id);
}
