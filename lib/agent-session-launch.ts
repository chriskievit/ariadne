import { randomBytes } from 'node:crypto';
import type Database from 'better-sqlite3';
import { getSetting } from './settings-repo';
import { SETTINGS_KEYS, DEFAULT_AGENT_HOOK_BASE_URL } from './config';
import { writeHookSettings } from './agent-hooks-config';
import { agentSettingsDir, agentTabConfigDir } from './agent-paths';
import { writeSessionTabConfig } from './agent-launch';
import { applyAgentSessionPatch } from './agent-sessions-repo';
import { logError } from './log';
import type { AgentDefinition, BuildCommandOptions } from './agents';
import type { AgentSession } from './types';

export function newLaunchToken(): string {
  return randomBytes(24).toString('base64url');
}

/**
 * Write the two files that make a session row launchable: the per-session
 * hook settings (only for agents that support hooks) and the Warp tab config
 * that runs `buildCommand`'s result in `workingDir`.
 *
 * Shared by the initial launch route and the resume route's "session already
 * ended" branch, which both create a fresh row and then have to get it onto
 * disk the same way. A write failure here is not the agent's fault -- Ariadne
 * failed before the agent ever ran -- so the row is marked 'failed' with
 * 'launch_failed' rather than left claiming to be launching forever, and the
 * error is rethrown so the caller can answer with its own response.
 */
export function commitAgentSessionLaunch(
  db: Database.Database,
  session: AgentSession,
  agent: AgentDefinition,
  workingDir: string,
  buildCommand: (options: BuildCommandOptions) => string
): void {
  try {
    let settingsPath: string | null = null;
    if (agent.supportsHooks) {
      const baseUrl = getSetting(db, SETTINGS_KEYS.agentHookBaseUrl) ?? DEFAULT_AGENT_HOOK_BASE_URL;
      // The middleware rejects every request when ARIADNE_AUTH_TOKEN is set,
      // so the hook has to carry it. This writes the token into a file on
      // disk, the same trust model as the PATs in the settings table.
      settingsPath = writeHookSettings(
        agentSettingsDir(),
        session.launchToken,
        baseUrl,
        process.env.ARIADNE_AUTH_TOKEN ?? null
      );
    }

    writeSessionTabConfig(
      {
        sessionId: session.id,
        title: session.tabTitle,
        color: session.tabColor,
        directory: workingDir,
        command: buildCommand({ settingsPath }),
      },
      agentTabConfigDir()
    );
  } catch (error) {
    logError('agent-launch', `could not write the launch files for session ${session.id}`, error);
    try {
      applyAgentSessionPatch(db, session.id, {
        state: 'failed',
        endedAt: new Date().toISOString(),
        endReason: 'launch_failed',
      });
    } catch (patchError) {
      // The database write above is best-effort: if it also fails, the
      // session row is left misleading, but the caller still has to answer
      // the request rather than being masked by a second thrown error.
      logError('agent-launch', `could not mark session ${session.id} as failed`, patchError);
    }
    throw error;
  }
}
