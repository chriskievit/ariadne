import type { AgentKind } from './types';

// Client components reach this module *by value* through
// agent-session-display.ts (agentStateDisplay, sessionFidelity both call
// getAgentDefinition), so it ends up in the browser bundle. Keep it free of
// node built-ins and anything else that only makes sense on a server --
// filesystem probes and the like belong in agent-detect.ts instead. tsc and
// vitest will not catch a violation of this; only `npm run build` will.

export interface BuildCommandOptions {
  // Path to a per-session settings file, for agents that can take one.
  settingsPath: string | null;
}

export interface AgentDefinition {
  kind: AgentKind;
  label: string;
  binary: string;
  // True only where the agent can report its own lifecycle back to Ariadne.
  // Everything else runs on the lower tier: Ariadne knows a tab was opened
  // and nothing more. The tier is shown to the user rather than hidden,
  // because a state Ariadne cannot see is worse than one it admits to.
  supportsHooks: boolean;
  buildCommand(options: BuildCommandOptions): string;
}

export const DEFAULT_AGENT: AgentKind = 'claude';

function plainCommand(binary: string) {
  return () => binary;
}

export const AGENT_DEFINITIONS: AgentDefinition[] = [
  {
    kind: 'claude',
    label: 'Claude Code',
    binary: 'claude',
    supportsHooks: true,
    buildCommand: ({ settingsPath }) => (settingsPath ? `claude --settings "${settingsPath}"` : 'claude'),
  },
  { kind: 'codex', label: 'Codex', binary: 'codex', supportsHooks: false, buildCommand: plainCommand('codex') },
  {
    kind: 'cursor',
    label: 'Cursor Agent',
    binary: 'cursor-agent',
    supportsHooks: false,
    buildCommand: plainCommand('cursor-agent'),
  },
  {
    kind: 'opencode',
    label: 'OpenCode',
    binary: 'opencode',
    supportsHooks: false,
    buildCommand: plainCommand('opencode'),
  },
  { kind: 'gemini', label: 'Gemini CLI', binary: 'gemini', supportsHooks: false, buildCommand: plainCommand('gemini') },
  { kind: 'aider', label: 'Aider', binary: 'aider', supportsHooks: false, buildCommand: plainCommand('aider') },
];

export function getAgentDefinition(kind: AgentKind): AgentDefinition | undefined {
  return AGENT_DEFINITIONS.find((agent) => agent.kind === kind);
}
