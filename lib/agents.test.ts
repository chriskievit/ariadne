import { describe, it, expect } from 'vitest';
import { AGENT_DEFINITIONS, getAgentDefinition, DEFAULT_AGENT } from './agents';

describe('AGENT_DEFINITIONS', () => {
  it('leads with Claude Code, the only agent with hook support', () => {
    expect(DEFAULT_AGENT).toBe('claude');
    expect(AGENT_DEFINITIONS[0].kind).toBe('claude');
    expect(AGENT_DEFINITIONS[0].supportsHooks).toBe(true);
    expect(AGENT_DEFINITIONS.filter((a) => a.supportsHooks).map((a) => a.kind)).toEqual(['claude']);
  });

  it('gives every agent a unique kind and binary', () => {
    const kinds = AGENT_DEFINITIONS.map((a) => a.kind);
    expect(new Set(kinds).size).toBe(kinds.length);
    expect(new Set(AGENT_DEFINITIONS.map((a) => a.binary)).size).toBe(AGENT_DEFINITIONS.length);
  });
});

describe('buildCommand', () => {
  it('passes a settings file to Claude Code so hooks apply to this session only', () => {
    const claude = getAgentDefinition('claude')!;
    expect(claude.buildCommand({ settingsPath: '/tmp/s.json' })).toBe('claude --settings "/tmp/s.json"');
  });

  it('omits the settings flag when there is none', () => {
    const claude = getAgentDefinition('claude')!;
    expect(claude.buildCommand({ settingsPath: null })).toBe('claude');
  });

  it('never passes a settings file to an agent that cannot use one', () => {
    const codex = getAgentDefinition('codex')!;
    expect(codex.buildCommand({ settingsPath: '/tmp/s.json' })).toBe('codex');
  });
});

describe('buildResumeCommand', () => {
  it('is implemented by exactly one definition -- resuming is a Claude Code-only capability', () => {
    expect(AGENT_DEFINITIONS.filter((a) => a.buildResumeCommand).map((a) => a.kind)).toEqual(['claude']);
  });

  it('includes the agent session id so Claude Code picks the right conversation back up', () => {
    const claude = getAgentDefinition('claude')!;
    const command = claude.buildResumeCommand!({ settingsPath: '/tmp/s.json' }, 'sess-123');
    expect(command).toBe('claude --resume "sess-123" --settings "/tmp/s.json"');
  });

  it('omits the settings flag when there is none', () => {
    const claude = getAgentDefinition('claude')!;
    expect(claude.buildResumeCommand!({ settingsPath: null }, 'sess-123')).toBe('claude --resume "sess-123"');
  });
});
