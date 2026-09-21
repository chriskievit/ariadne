import type { AgentSession } from './types';
import type { AgentSessionPatch } from './agent-sessions-repo';

export type HookEventName = 'SessionStart' | 'PreToolUse' | 'PostToolUse' | 'Notification' | 'Stop' | 'SessionEnd';

// Only the fields this state machine reads. Claude Code sends more; ignoring
// the rest keeps a payload change from breaking the mapping.
export interface HookEvent {
  hook_event_name: HookEventName;
  session_id?: string;
  transcript_path?: string;
  cwd?: string;
  model?: string;
  tool_name?: string;
  message?: string;
  notification_type?: string;
  last_assistant_message?: string;
  reason?: string;
}

// How long a launched session may stay silent before Ariadne stops believing
// in it. Generous because Claude Code's folder-trust prompt fires before
// SessionStart, so a first run in an unfamiliar worktree legitimately waits
// on a human here.
export const LAUNCH_REGISTRATION_TIMEOUT_MS = 3 * 60 * 1000;

/**
 * Map one hook event onto the fields it changes.
 *
 * Pure, and deliberately so: this is the only place a session's state is
 * decided, and every transition is a unit test away from being checked.
 * Returns a patch rather than a session so a caller never has to guess which
 * fields an event was allowed to touch.
 */
export function applyHookEvent(session: AgentSession, event: HookEvent, now: Date): AgentSessionPatch {
  // A closed session is closed. A late hook from a tab that already exited
  // must never resurrect it.
  if (session.endedAt !== null) return {};

  const timestamp = now.toISOString();
  const patch: AgentSessionPatch = { lastEventAt: timestamp };

  switch (event.hook_event_name) {
    case 'SessionStart':
      patch.state = 'working';
      patch.registeredAt = timestamp;
      if (event.session_id) patch.agentSessionId = event.session_id;
      if (event.transcript_path) patch.transcriptPath = event.transcript_path;
      if (event.cwd) patch.cwd = event.cwd;
      if (event.model) patch.model = event.model;
      break;

    case 'PreToolUse':
    case 'PostToolUse':
      patch.state = 'working';
      patch.needsYouMessage = null;
      break;

    case 'Notification':
      // idle_prompt arrives after Stop and means "waiting for your next
      // instruction", which is what ready already says. Only a notification
      // that interrupts active work is a block.
      if (session.state === 'working') {
        patch.state = 'needs_you';
        patch.needsYouMessage = event.message ?? null;
      }
      break;

    case 'Stop':
      patch.state = 'ready';
      patch.needsYouMessage = null;
      if (event.last_assistant_message !== undefined) patch.lastMessage = event.last_assistant_message;
      break;

    case 'SessionEnd':
      patch.state = 'stopped';
      patch.endedAt = timestamp;
      patch.endReason = event.reason ?? null;
      break;
  }

  return patch;
}

/**
 * True when a session was launched, never reported in, and has been silent
 * long enough that something went wrong: an untrusted folder, a missing
 * binary, or a tab the user closed before the agent started.
 */
export function isNeverRegistered(session: AgentSession, now: Date): boolean {
  if (session.state !== 'launching') return false;
  if (session.registeredAt !== null) return false;
  return now.getTime() - new Date(session.createdAt).getTime() > LAUNCH_REGISTRATION_TIMEOUT_MS;
}
