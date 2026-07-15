import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const LAUNCH_CONFIG_NAME = 'activitydash';
export const WARP_LAUNCH_URL = `warp://launch/${LAUNCH_CONFIG_NAME}`;

function defaultLaunchConfigDir(): string {
  return join(homedir(), '.warp', 'launch_configurations');
}

export function writeLaunchConfig(cwd: string, launchConfigDir: string = defaultLaunchConfigDir()): void {
  if (!existsSync(launchConfigDir)) {
    mkdirSync(launchConfigDir, { recursive: true });
  }

  const yaml = [
    `name: ${LAUNCH_CONFIG_NAME}`,
    'windows:',
    '  - tabs:',
    `      - cwd: ${cwd}`,
    '        commands:',
    '          - exec: claude',
    '',
  ].join('\n');

  writeFileSync(join(launchConfigDir, `${LAUNCH_CONFIG_NAME}.yaml`), yaml, 'utf8');
}
