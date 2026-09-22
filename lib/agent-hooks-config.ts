import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { HookEventName } from './agent-session-state';

// The five events that move a session's state. PostToolUse is deliberately
// not registered: PreToolUse already proves work is happening, and doubling
// the hook count doubles the curl calls for no extra signal.
export const HOOK_EVENTS: HookEventName[] = ['SessionStart', 'PreToolUse', 'Notification', 'Stop', 'SessionEnd'];

const LAUNCH_TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;

function assertShellSafe(value: string, label: string): void {
  // The value is interpolated unescaped into a shell command that Claude Code
  // executes. It is placed inside double-quoted strings, where bash performs
  // command substitution on $ and backticks. Quotes and backslashes also break
  // out of the string. All must be rejected to prevent arbitrary command execution.
  if (/["'$`\n\r\\]/.test(value)) {
    throw new Error(`${label} must not contain quotes, dollar signs, backticks, backslashes, or newlines.`);
  }
}

export function hookSettingsPath(dir: string, token: string): string {
  return join(dir, `hooks-${token}.json`);
}

function curlCommand(url: string, authToken: string | null): string {
  const auth = authToken ? ` -u ":${authToken}"` : '';
  // -m 5 bounds the hang, || true bounds the damage: a non-zero exit from a
  // hook can block the agent, and Ariadne being unreachable must never do
  // that to the user's session.
  return (
    `curl -s -m 5 -X POST -H "Content-Type: application/json"${auth} ` +
    `--data-binary @- "${url}" >/dev/null 2>&1 || true`
  );
}

export function buildHookSettings(hookUrl: string, authToken: string | null): object {
  assertShellSafe(hookUrl, 'Hook URL');
  if (authToken !== null) assertShellSafe(authToken, 'Auth token');

  const command = curlCommand(hookUrl, authToken);
  const hooks: Record<string, unknown[]> = {};

  for (const event of HOOK_EVENTS) {
    const entry: Record<string, unknown> = { hooks: [{ type: 'command', command }] };
    // Tool hooks are matcher-scoped; the lifecycle ones are not.
    if (event === 'PreToolUse') entry.matcher = '*';
    hooks[event] = [entry];
  }

  return { hooks };
}

export function writeHookSettings(
  dir: string,
  token: string,
  baseUrl: string,
  authToken: string | null
): string {
  if (!LAUNCH_TOKEN_PATTERN.test(token)) {
    throw new Error('Invalid launch token: must be 16-64 url-safe characters.');
  }

  const settings = buildHookSettings(`${baseUrl.replace(/\/+$/, '')}/api/agent-hooks/${token}`, authToken);
  // This file can contain ARIADNE_AUTH_TOKEN in plaintext (see curlCommand
  // above), so both the directory and the file get an explicit, restrictive
  // mode rather than whatever the process umask happens to leave: without
  // this, the default is 0644 and the operator's token sits world-readable.
  // Dismissing a session or deleting its item now calls removeHookSettings
  // for it (see those routes), but a session that simply stops on its own --
  // SessionEnd, with nobody dismissing or deleting it after -- is never
  // cleaned up; the mode is what keeps that one harmless rather than leaving
  // it world-readable.
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });

  const path = hookSettingsPath(dir, token);
  // The token is also visible to anything that can read this process's
  // argv (e.g. `ps -u ":$token"` on the curl command line, via /proc or
  // ps on most systems). Moving it to a curl config file instead of the
  // command line closes that too, but is deferred past phase 1.
  writeFileSync(path, `${JSON.stringify(settings, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  return path;
}

/**
 * Remove a session's hook settings file from disk.
 *
 * Callers must only reach for this once a session has ended -- a live one
 * may still have Claude Code reading the file to fire its remaining hooks,
 * and Ariadne has no process handle to know when that stops being true.
 * force: true makes this idempotent for a file already gone, matching
 * removeSessionTabConfig's own best-effort shape.
 */
export function removeHookSettings(dir: string, token: string): void {
  rmSync(hookSettingsPath(dir, token), { force: true });
}
