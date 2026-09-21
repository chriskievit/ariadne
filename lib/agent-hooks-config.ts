import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { HookEventName } from './agent-session-state';

// The five events that move a session's state. PostToolUse is deliberately
// not registered: PreToolUse already proves work is happening, and doubling
// the hook count doubles the curl calls for no extra signal.
export const HOOK_EVENTS: HookEventName[] = ['SessionStart', 'PreToolUse', 'Notification', 'Stop', 'SessionEnd'];

const LAUNCH_TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;

function assertNoQuotes(value: string, label: string): void {
  // The value is interpolated unescaped into a shell command that Claude Code
  // executes, so a quote would let it break out and run anything.
  if (/["'\n\r\\]/.test(value)) {
    throw new Error(`${label} must not contain quotes, backslashes, or newlines.`);
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
  assertNoQuotes(hookUrl, 'Hook URL');
  if (authToken !== null) assertNoQuotes(authToken, 'Auth token');

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
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const path = hookSettingsPath(dir, token);
  writeFileSync(path, `${JSON.stringify(settings, null, 2)}\n`, 'utf8');
  return path;
}
