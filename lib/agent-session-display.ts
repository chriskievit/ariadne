import { getAgentDefinition } from './agents';
import type { AgentKind, AgentSession, AgentSessionState } from './types';

// Glyph *names*, not lucide components. Keeps this module importable from a
// node-environment Vitest test and keeps the icon table next to the JSX that
// renders it.
export type AgentGlyph = 'hand' | 'alert-triangle' | 'file-diff' | 'loader' | 'circle-dashed' | 'circle-slash';

// Maps onto the Badge variants. 'neutral' is the outline treatment.
export type AgentTone = 'warning' | 'destructive' | 'neutral';

export interface AgentStateDisplay {
  label: string;
  glyph: AgentGlyph;
  tone: AgentTone;
}

/**
 * How a session state reads on screen.
 *
 * Every state carries a glyph and a word. Colour is the third channel, never
 * the only one, and only the two states that demand something of you are
 * filled -- the same Two-Band Rule the urgency chip obeys. A rail where all
 * six states were coloured would be a rail with no signal in it.
 *
 * Nothing here is Threadline Gold. Gold marks the thread you are holding,
 * and a delegated session is precisely the one you are not: Ariadne refuses
 * to start a timer for it for the same reason.
 */
export const AGENT_STATE_DISPLAY: Record<AgentSessionState, AgentStateDisplay> = {
  needs_you: { label: 'Needs you', glyph: 'hand', tone: 'warning' },
  failed: { label: 'Failed', glyph: 'alert-triangle', tone: 'destructive' },
  ready: { label: 'Ready', glyph: 'file-diff', tone: 'neutral' },
  working: { label: 'Working', glyph: 'loader', tone: 'neutral' },
  launching: { label: 'Launching', glyph: 'circle-dashed', tone: 'neutral' },
  stopped: { label: 'Stopped', glyph: 'circle-slash', tone: 'neutral' },
};

export function agentStateDisplay(state: AgentSessionState): AgentStateDisplay {
  return AGENT_STATE_DISPLAY[state];
}

/**
 * How much Ariadne can actually see of this session.
 *
 * Only Claude Code reports its own lifecycle. For everything else Ariadne
 * knows a tab was opened and nothing after that, and the difference is shown
 * rather than hidden: a state a tool cannot see is worse than one it admits
 * to not seeing.
 */
export type SessionFidelity = 'reported' | 'opened_only';

export function sessionFidelity(agent: AgentKind): SessionFidelity {
  return getAgentDefinition(agent)?.supportsHooks === true ? 'reported' : 'opened_only';
}

export type DisplaySession = Pick<AgentSession, 'agent' | 'state' | 'endReason'>;

/**
 * The one sentence this session needs beyond its state label, or null.
 *
 * Ordered most specific first. `never_registered` is the one that earns its
 * keep most often: Claude Code puts a folder-trust prompt up *before* it
 * fires SessionStart, so the commonest way a session dies is a dialog
 * sitting unanswered in a Warp tab. "Failed" alone would send you looking in
 * the wrong place.
 */
export function sessionExplanation(session: DisplaySession): string | null {
  if (session.endReason === 'never_registered') {
    return 'It never reported in. Claude Code asks you to trust a folder before it starts, so look for a prompt in its Warp tab.';
  }
  if (session.endReason === 'launch_failed') {
    return 'Ariadne could not write the Warp launch files, so nothing was started.';
  }
  if (sessionFidelity(session.agent) === 'opened_only') {
    const label = getAgentDefinition(session.agent)?.label ?? session.agent;
    return `${label} does not report back. Ariadne opened the tab and knows nothing after that.`;
  }
  return null;
}
