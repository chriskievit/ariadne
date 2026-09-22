import { existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import type Database from 'better-sqlite3';
import { getSetting } from './settings-repo';
import { SETTINGS_KEYS, DEFAULT_AGENT_HOOK_BASE_URL } from './config';
import { writeHookSettings, hookSettingsPath } from './agent-hooks-config';
import { agentSettingsDir, agentTabConfigDir } from './agent-paths';
import { writeSessionTabConfig } from './agent-launch';
import { applyAgentSessionPatch } from './agent-sessions-repo';
import { logError } from './log';
import type { AgentDefinition, BuildCommandOptions } from './agents';
import type { AgentSession } from './types';

export function newLaunchToken(): string {
  return randomBytes(24).toString('base64url');
}

// The middleware rejects every request when ARIADNE_AUTH_TOKEN is set, so the
// hook has to carry it. This writes the token into a file on disk, the same
// trust model as the PATs in the settings table.
function writeSessionHookSettings(db: Database.Database, launchToken: string): string {
  const baseUrl = getSetting(db, SETTINGS_KEYS.agentHookBaseUrl) ?? DEFAULT_AGENT_HOOK_BASE_URL;
  return writeHookSettings(agentSettingsDir(), launchToken, baseUrl, process.env.ARIADNE_AUTH_TOKEN ?? null);
}

/**
 * The settings path for a token that is already live, writing the file only
 * if it is not there.
 *
 * Nothing in this codebase deletes a live session's settings file today, so
 * in the ordinary case this is just `hookSettingsPath` with an existence
 * check attached. But the path is deterministic from the directory and the
 * token, so if the file were ever tidied away or lost, regenerating it here
 * is strictly better than resuming into a `--settings <gone>` that fails
 * inside Warp while this route still answered 200: the next resume self-heals
 * instead of requiring someone to notice and re-launch from scratch.
 */
export function ensureHookSettingsFile(db: Database.Database, launchToken: string): string {
  const path = hookSettingsPath(agentSettingsDir(), launchToken);
  if (existsSync(path)) return path;
  return writeSessionHookSettings(db, launchToken);
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
    const settingsPath = agent.supportsHooks ? writeSessionHookSettings(db, session.launchToken) : null;

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
