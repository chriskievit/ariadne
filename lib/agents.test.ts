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
