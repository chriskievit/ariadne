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

/**
 * The session currently occupying a ticket, if one does.
 *
 * "Active" is narrower than the rail's "live". The rail shows everything
 * with a null ended_at, which deliberately includes a session the
 * reconciler marked failed for never registering -- that row keeps a null
 * ended_at precisely so a late SessionStart can revive it.
 *
 * A failed session must not block a relaunch, though. Claude Code puts its
 * folder-trust prompt up before SessionStart, so the commonest way a
 * session dies is a dialog nobody answered in time; treating that row as
 * occupying the ticket would lock the ticket out of ever being handed over
 * again, and the only escape would be a dismissal action that does not
 * exist yet. A rare duplicate is the cheaper failure.
 */
export function getActiveAgentSessionForItem(db: Database.Database, itemId: number): AgentSession | undefined {
  const row = db
    .prepare("SELECT * FROM agent_sessions WHERE item_id = ? AND ended_at IS NULL AND state != 'failed' ORDER BY id DESC LIMIT 1")
    .get(itemId) as AgentSessionRow | undefined;
  return row ? rowToSession(row) : undefined;
}

/**
 * Stop tracking a session, whatever state it is stuck in.
 *
 * The escape hatch the rail has never had. A never-registered session keeps
 * a null ended_at on purpose so a late SessionStart can revive it, an agent
 * without hook support can never report that it finished, and a process that
 * died without a SessionEnd leaves a row claiming to be working for ever.
 * None of those can leave the live list on their own.
 *
 * This ends Ariadne's record and nothing else. Ariadne has no handle on the
 * process -- Warp owns it -- so a dismissed agent keeps running until it is
 * stopped in Warp, and every label on this action says so.
 *
 * Already-ended sessions are left alone rather than restamped, so dismissing
 * twice cannot rewrite the moment something actually finished.
 */
export function dismissAgentSession(db: Database.Database, id: number, now: Date): AgentSession | undefined {
  const session = getAgentSessionById(db, id);
  if (!session) return undefined;
  if (session.endedAt !== null) return session;

  applyAgentSessionPatch(db, id, { endedAt: now.toISOString(), endReason: 'dismissed' });
  return getAgentSessionById(db, id);
}

// The shape of an AgentSession an API response may return. Named fields
// rather than a spread-and-omit of AgentSession, so a column added to the
// session later is excluded by default instead of leaking until someone
// remembers to strip it. launchToken is the hook credential and must never
// reach a client; phase 2 renders these responses in a browser, and this is
// easy to forget by then.
export interface PublicAgentSession {
  id: number;
  itemId: number;
  agent: AgentKind;
  state: AgentSessionState;
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

export function toPublicAgentSession(session: AgentSession): PublicAgentSession {
  return {
    id: session.id,
    itemId: session.itemId,
    agent: session.agent,
    state: session.state,
    agentSessionId: session.agentSessionId,
    transcriptPath: session.transcriptPath,
    cwd: session.cwd,
    gitBranch: session.gitBranch,
    model: session.model,
    tabTitle: session.tabTitle,
    tabColor: session.tabColor,
    createdAt: session.createdAt,
    registeredAt: session.registeredAt,
    lastEventAt: session.lastEventAt,
    endedAt: session.endedAt,
    endReason: session.endReason,
    lastMessage: session.lastMessage,
    needsYouMessage: session.needsYouMessage,
  };
}

export function applyAgentSessionPatch(db: Database.Database, id: number, patch: AgentSessionPatch): void {
  const keys = (Object.keys(patch) as (keyof AgentSessionPatch)[]).filter((key) => patch[key] !== undefined);
  if (keys.length === 0) return;

  const assignments = keys.map((key) => `${PATCH_COLUMNS[key]} = ?`).join(', ');
  const values = keys.map((key) => patch[key] as string | null);
  db.prepare(`UPDATE agent_sessions SET ${assignments} WHERE id = ?`).run(...values, id);
}
