import { homedir } from 'node:os';
import { join } from 'node:path';

// Overridable so the e2e suite (playwright.config.ts's webServer.env) can
// point both directories at a throwaway temp folder instead of the user's
// real ~/.warp and ~/.ariadne. Without this, a dismiss or a launch fired by
// the e2e suite writes and deletes real files there -- including, for
// dismiss, a config named after an e2e session's numeric id that could
// collide with a genuine one.
export function agentTabConfigDir(): string {
  return process.env.ARIADNE_WARP_TAB_CONFIG_DIR ?? join(homedir(), '.warp', 'tab_configs');
}

export function agentSettingsDir(): string {
  return process.env.ARIADNE_AGENT_SETTINGS_DIR ?? join(homedir(), '.ariadne', 'agent-sessions');
}
