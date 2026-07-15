import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const LAUNCH_CONFIG_NAME = 'activitydash';
export const WARP_LAUNCH_URL = `warp://tab_config/${LAUNCH_CONFIG_NAME}`;

function defaultTabConfigDir(): string {
  return join(homedir(), '.warp', 'tab_configs');
}

export function writeLaunchConfig(cwd: string, tabConfigDir: string = defaultTabConfigDir()): void {
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
