import { join } from 'node:path';
import { AGENT_DEFINITIONS } from './agents';
import type { AgentKind } from './types';

/**
 * Which agents are installed, in registry order.
 *
 * Takes the PATH string and an existence predicate rather than reading the
 * filesystem itself, so the probe is testable without a fixture tree.
 *
 * Server-only, and kept in its own module for exactly that reason: nothing
 * imports this from a client component, so the real `node:path` join is
 * safe to use here even though it is not safe in lib/agents.ts.
 */
export function detectInstalledAgents(pathEnv: string, exists: (candidate: string) => boolean): AgentKind[] {
  const dirs = pathEnv.split(':').filter(Boolean);
  return AGENT_DEFINITIONS.filter((agent) => dirs.some((dir) => exists(join(dir, agent.binary)))).map(
    (agent) => agent.kind
  );
}
