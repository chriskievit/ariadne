import { describe, it, expect } from 'vitest';
import {
  AGENT_STATE_DISPLAY,
  agentStateDisplay,
  sessionFidelity,
  sessionExplanation,
  type DisplaySession,
} from './agent-session-display';
import { AGENT_DEFINITIONS } from './agents';
import type { AgentSessionState } from './types';

const ALL_STATES: AgentSessionState[] = ['launching', 'working', 'needs_you', 'ready', 'failed', 'stopped'];

function session(overrides: Partial<DisplaySession> = {}): DisplaySession {
  return { agent: 'claude', state: 'working', endReason: null, ...overrides };
}

describe('AGENT_STATE_DISPLAY', () => {
  it('gives every state a label and a glyph, so no state is ever colour alone', () => {
    for (const state of ALL_STATES) {
      const display = agentStateDisplay(state);
      expect(display.label.length).toBeGreaterThan(0);
      expect(display.glyph.length).toBeGreaterThan(0);
    }
    expect(Object.keys(AGENT_STATE_DISPLAY).sort()).toEqual([...ALL_STATES].sort());
  });

  it('gives every state its own glyph, so the rail is readable with the colour removed', () => {
    const glyphs = ALL_STATES.map((state) => agentStateDisplay(state).glyph);
    expect(new Set(glyphs).size).toBe(glyphs.length);
  });

  it('fills exactly the two states that demand action, per the Two-Band Rule', () => {
    const filled = ALL_STATES.filter((state) => agentStateDisplay(state).tone !== 'neutral');
    expect(filled.sort()).toEqual(['failed', 'needs_you']);
    expect(agentStateDisplay('needs_you').tone).toBe('warning');
    expect(agentStateDisplay('failed').tone).toBe('destructive');
  });

  it('never tones a state with the interactive channel', () => {
    for (const state of ALL_STATES) {
      // 'default' is the Badge variant that carries Azure Focus.
      expect(agentStateDisplay(state).tone).not.toBe('default');
    }
  });
});

describe('sessionFidelity', () => {
  it('reports the tier from the agent registry rather than guessing', () => {
    expect(sessionFidelity('claude')).toBe('reported');
    for (const definition of AGENT_DEFINITIONS.filter((a) => !a.supportsHooks)) {
      expect(sessionFidelity(definition.kind)).toBe('opened_only');
    }
  });
});

describe('sessionExplanation', () => {
  it('explains the folder-trust prompt, because that is the failure a person can actually fix', () => {
    const text = sessionExplanation(session({ state: 'failed', endReason: 'never_registered' }));
    expect(text).toMatch(/trust/i);
    expect(text).toMatch(/Warp/);
  });

  it('separates Ariadne failing to launch from the agent failing to report', () => {
    const launch = sessionExplanation(session({ state: 'failed', endReason: 'launch_failed' }));
    expect(launch).toMatch(/Ariadne/);
    expect(launch).not.toMatch(/trust/i);
  });

  it('admits the lower tier instead of showing an unreporting agent as silent', () => {
    const text = sessionExplanation(session({ agent: 'codex', state: 'launching' }));
    expect(text).toMatch(/Codex/);
    expect(text).toMatch(/does not report back/);
  });

  it('says nothing about an ordinary reporting session', () => {
    expect(sessionExplanation(session({ state: 'working' }))).toBeNull();
    expect(sessionExplanation(session({ state: 'ready' }))).toBeNull();
  });

  it('prefers the specific end reason over the tier note', () => {
    const text = sessionExplanation(session({ agent: 'codex', state: 'failed', endReason: 'launch_failed' }));
    expect(text).toMatch(/Ariadne/);
  });

  it('says the same thing the dismiss dialog said, past the moment of confirming', () => {
    const text = sessionExplanation(session({ state: 'working', endReason: 'dismissed' }));
    expect(text).toMatch(/stopped tracking/i);
    expect(text).toMatch(/Warp/);
  });

  it('still shows the folder-trust explanation for a never-registered session, dismissed or not', () => {
    // dismissAgentSession leaves endReason alone when one already explains
    // the row, so a dismissed never_registered session is never passed here
    // with endReason: 'dismissed' -- this pins that the explanation this
    // function shows for it is unaffected by dismissal ever happening.
    const text = sessionExplanation(session({ state: 'failed', endReason: 'never_registered' }));
    expect(text).toMatch(/trust/i);
  });
});
