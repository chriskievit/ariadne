import type { AgentKind } from './types';

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

/**
 * Which agents are installed, in registry order.
 *
 * Takes the PATH string and an existence predicate rather than reading the
 * filesystem itself, so the probe is testable without a fixture tree.
 */
export function detectInstalledAgents(pathEnv: string, exists: (candidate: string) => boolean): AgentKind[] {
  const dirs = pathEnv.split(':').filter(Boolean);
  // A plain join, not node:path: PATH is already parsed as POSIX (split on
  // ':'), and this module is imported by value from client components
  // through agent-session-display.ts, so pulling in a node built-in here
  // would break that bundle for the one function that needs it least.
  return AGENT_DEFINITIONS.filter((agent) =>
    dirs.some((dir) => exists(`${dir.replace(/\/+$/, '')}/${agent.binary}`))
  ).map((agent) => agent.kind);
}
