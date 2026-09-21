import { homedir } from 'node:os';
import { join } from 'node:path';

export function agentTabConfigDir(): string {
  return join(homedir(), '.warp', 'tab_configs');
}

export function agentSettingsDir(): string {
  return join(homedir(), '.ariadne', 'agent-sessions');
}
