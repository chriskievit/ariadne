import { describe, it, expect } from 'vitest';
import { applyHookEvent, isNeverRegistered, LAUNCH_REGISTRATION_TIMEOUT_MS } from './agent-session-state';
import type { AgentSession, AgentSessionState } from './types';

const NOW = new Date('2026-09-21T12:00:00.000Z');

function session(overrides: Partial<AgentSession> = {}): AgentSession {
  return {
    id: 1,
    itemId: 10,
    agent: 'claude',
    state: 'launching',
    launchToken: 'tok',
    agentSessionId: null,
    transcriptPath: null,
    cwd: null,
    gitBranch: null,
    model: null,
    tabTitle: '#4318 pipelines',
    tabColor: 'yellow',
    createdAt: '2026-09-21T11:58:00.000Z',
    registeredAt: null,
    lastEventAt: null,
    endedAt: null,
    endReason: null,
    lastMessage: null,
    needsYouMessage: null,
    ...overrides,
  };
}

describe('applyHookEvent: SessionStart', () => {
  it('registers the session and moves it to working', () => {
    const patch = applyHookEvent(
      session(),
      {
        hook_event_name: 'SessionStart',
        session_id: 'sess-1',
        transcript_path: '/t/sess-1.jsonl',
        cwd: '/Users/me/dev/ariadne',
        model: 'claude-opus-5',
      },
      NOW
    );

    expect(patch.state).toBe('working');
    expect(patch.agentSessionId).toBe('sess-1');
    expect(patch.transcriptPath).toBe('/t/sess-1.jsonl');
    expect(patch.cwd).toBe('/Users/me/dev/ariadne');
    expect(patch.model).toBe('claude-opus-5');
    expect(patch.registeredAt).toBe(NOW.toISOString());
    expect(patch.lastEventAt).toBe(NOW.toISOString());
  });
});

describe('applyHookEvent: Notification', () => {
  it('blocks a working session on you, recording the message', () => {
    const patch = applyHookEvent(
      session({ state: 'working' }),
      { hook_event_name: 'Notification', message: 'Claude needs your permission', notification_type: 'permission' },
      NOW
    );

    expect(patch.state).toBe('needs_you');
    expect(patch.needsYouMessage).toBe('Claude needs your permission');
  });

  // Observed in the spike: idle_prompt arrives AFTER Stop, and means "waiting
  // for your next instruction", not "blocked mid-task". A ready session that
  // flipped to needs_you here would report an interrupt that does not exist.
  it('leaves a ready session ready', () => {
    const patch = applyHookEvent(
      session({ state: 'ready' }),
      { hook_event_name: 'Notification', message: 'Claude is waiting for your input', notification_type: 'idle_prompt' },
      NOW
    );

    expect(patch.state).toBeUndefined();
    expect(patch.needsYouMessage).toBeUndefined();
    expect(patch.lastEventAt).toBe(NOW.toISOString());
  });
});

describe('applyHookEvent: PreToolUse', () => {
  it('clears a needs-you block once work resumes', () => {
    const patch = applyHookEvent(
      session({ state: 'needs_you', needsYouMessage: 'Claude needs your permission' }),
      { hook_event_name: 'PreToolUse', tool_name: 'Bash' },
      NOW
    );

    expect(patch.state).toBe('working');
    expect(patch.needsYouMessage).toBeNull();
  });
});

describe('applyHookEvent: Stop', () => {
  it('marks the session ready and keeps the last assistant message', () => {
    const patch = applyHookEvent(
      session({ state: 'working' }),
      { hook_event_name: 'Stop', last_assistant_message: 'Done, 3 files changed.' },
      NOW
    );

    expect(patch.state).toBe('ready');
    expect(patch.lastMessage).toBe('Done, 3 files changed.');
    expect(patch.needsYouMessage).toBeNull();
  });
});

describe('applyHookEvent: SessionEnd', () => {
  it('closes the session', () => {
    const patch = applyHookEvent(
      session({ state: 'ready' }),
      { hook_event_name: 'SessionEnd', reason: 'other' },
      NOW
    );

    expect(patch.state).toBe('stopped');
    expect(patch.endedAt).toBe(NOW.toISOString());
    expect(patch.endReason).toBe('other');
  });

  it('ignores any event after the session has ended', () => {
    const ended = session({ state: 'stopped', endedAt: '2026-09-21T11:59:00.000Z' });
    expect(applyHookEvent(ended, { hook_event_name: 'Stop', last_assistant_message: 'late' }, NOW)).toEqual({});
  });
});

describe('isNeverRegistered', () => {
  it('is false while the session is still inside the grace period', () => {
    const s = session({ createdAt: new Date(NOW.getTime() - 1000).toISOString() });
    expect(isNeverRegistered(s, NOW)).toBe(false);
  });

  // Claude Code's folder-trust prompt fires before SessionStart, so a session
  // launched into an untrusted directory sits at a prompt Ariadne cannot see.
  it('is true once a launching session has been silent past the timeout', () => {
    const s = session({
      createdAt: new Date(NOW.getTime() - LAUNCH_REGISTRATION_TIMEOUT_MS - 1).toISOString(),
    });
    expect(isNeverRegistered(s, NOW)).toBe(true);
  });

  it('is false for a session that did register', () => {
    const s = session({
      state: 'working' as AgentSessionState,
      createdAt: new Date(NOW.getTime() - LAUNCH_REGISTRATION_TIMEOUT_MS - 1).toISOString(),
      registeredAt: '2026-09-21T11:58:30.000Z',
    });
    expect(isNeverRegistered(s, NOW)).toBe(false);
  });

  // Five of the six registry agents cannot fire a hook at all: no settings
  // file is written for them, so silence is simply how they always look.
  it('is false for a hookless agent stuck in launching, however stale', () => {
    const s = session({
      agent: 'codex',
      createdAt: new Date(NOW.getTime() - LAUNCH_REGISTRATION_TIMEOUT_MS - 1).toISOString(),
    });
    expect(isNeverRegistered(s, NOW)).toBe(false);
  });

  it('is still true for a stale claude session, which does support hooks', () => {
    const s = session({
      agent: 'claude',
      createdAt: new Date(NOW.getTime() - LAUNCH_REGISTRATION_TIMEOUT_MS - 1).toISOString(),
    });
    expect(isNeverRegistered(s, NOW)).toBe(true);
  });
});
