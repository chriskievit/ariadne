import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { agentTabConfigDir } from './agent-paths';
import { WARP_COLORS, isWarpColor } from './warp-colors';
import type { Item } from './types';

// Yellow is the closest Warp offers to Threadline Gold, which is the colour
// DESIGN.md reserves for "your thread, live right now". An agent session is
// exactly that, so the Warp tab and the Ariadne row agree.
export const AGENT_TAB_COLOR = 'yellow';

const MAX_TAB_TITLE = 32;

function assertTomlSafe(value: string, label: string): void {
  // Values are interpolated unescaped into a TOML file that Warp executes
  // commands from, so a quote, backslash, or newline could inject arbitrary
  // keys or corrupt values. TOML basic strings treat \ as an escape introducer;
  // a stray backslash is a parse error, and a recognized escape like \t silently
  // corrupts the value. Same guard as lib/warp-launch.ts, applied to every
  // interpolated value here rather than only the directory.
  if (/["\\\n\r]/.test(value)) {
    throw new Error(`${label} must not contain quotes, backslashes, or newlines.`);
  }
}

function assertShellSafe(value: string, label: string): void {
  // Stricter than assertTomlSafe, for the two values Warp hands to a shell.
  // `$` and a backtick need no quote to escape: bash expands both inside a
  // double-quoted string. The tab title is exempt because Warp only displays
  // it, and a work item legitimately called "Fix $ formatting" must not fail
  // to launch.
  assertTomlSafe(value, label);
  if (/[$`]/.test(value)) {
    throw new Error(`${label} must not contain shell expansion characters.`);
  }
}

export function sessionTabConfigName(sessionId: number): string {
  return `ariadne-session-${sessionId}`;
}

export function sessionWarpUrl(sessionId: number): string {
  return `warp://tab_config/${sessionTabConfigName(sessionId)}`;
}

function shortLabel(item: Item): string | null {
  if (item.externalId === null) return null;
  if (item.source === 'ado_workitem') return `#${item.externalId}`;
  const match = item.externalId.match(/^(\d+)@/);
  return match ? `#${match[1]}` : null;
}

/**
 * The Warp tab's name. There is no way to focus an existing tab, so the title
 * is how the user finds the right one by eye; it leads with the identifier
 * they already think in.
 */
export function sessionTabTitle(item: Item): string {
  const label = shortLabel(item);
  const parts = [label, item.repo].filter((part): part is string => Boolean(part));
  const raw = parts.length > 0 ? parts.join(' ') : item.title;
  return raw.replace(/["\\\n\r]/g, '').slice(0, MAX_TAB_TITLE).trim();
}

export interface SessionTabConfigInput {
  sessionId: number;
  title: string;
  color: string;
  directory: string;
  command: string;
}

export function writeSessionTabConfig(input: SessionTabConfigInput, tabConfigDir: string = agentTabConfigDir()): void {
  assertShellSafe(input.directory, 'Working directory');
  assertTomlSafe(input.title, 'Tab title');
  if (!isWarpColor(input.color)) {
    throw new Error(`Invalid tab colour: must be one of ${WARP_COLORS.join(', ')}.`);
  }
  // The command legitimately contains quotes (a --settings path), so it is
  // escaped for TOML rather than rejected. Newlines are still fatal.
  if (/[\n\r]/.test(input.command)) throw new Error('Command must not contain newlines.');
  if (/[$`]/.test(input.command)) throw new Error('Command must not contain shell expansion characters.');
  const escapedCommand = input.command.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

  if (!existsSync(tabConfigDir)) mkdirSync(tabConfigDir, { recursive: true });

  const toml = [
    `name = "${sessionTabConfigName(input.sessionId)}"`,
    `title = "${input.title}"`,
    `color = "${input.color}"`,
    '[[panes]]',
    'id = "main"',
    'type = "terminal"',
    `directory = "${input.directory}"`,
    `commands = ["${escapedCommand}"]`,
    '',
  ].join('\n');

  writeFileSync(join(tabConfigDir, `${sessionTabConfigName(input.sessionId)}.toml`), toml, 'utf8');
}

export function removeSessionTabConfig(sessionId: number, tabConfigDir: string = agentTabConfigDir()): void {
  rmSync(join(tabConfigDir, `${sessionTabConfigName(sessionId)}.toml`), { force: true });
}
