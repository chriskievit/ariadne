import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const LAUNCH_CONFIG_NAME = 'ariadne';
export const WARP_LAUNCH_URL = `warp://tab_config/${LAUNCH_CONFIG_NAME}`;

function defaultTabConfigDir(): string {
  return join(homedir(), '.warp', 'tab_configs');
}

export function writeLaunchConfig(cwd: string, tabConfigDir: string = defaultTabConfigDir()): void {
  if (/["\n\r]/.test(cwd)) {
    // cwd is interpolated unescaped into a TOML string below — a quote or
    // newline would let it break out of `directory = "..."` and inject
    // arbitrary keys (e.g. a `commands` override) into the launch config.
    throw new Error('Invalid working directory: must not contain quotes or newlines.');
  }

  if (!existsSync(tabConfigDir)) {
    mkdirSync(tabConfigDir, { recursive: true });
  }

  const toml = [
    `name = "${LAUNCH_CONFIG_NAME}"`,
    '[[panes]]',
    'id = "main"',
    'type = "terminal"',
    `directory = "${cwd}"`,
    'commands = ["claude"]',
    '',
  ].join('\n');

  writeFileSync(join(tabConfigDir, `${LAUNCH_CONFIG_NAME}.toml`), toml, 'utf8');
}
