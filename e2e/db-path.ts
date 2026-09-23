import path from 'node:path';
import os from 'node:os';

export const E2E_DB_PATH = path.join(os.tmpdir(), 'ariadne-e2e.db');
export const E2E_PORT = 4180;
export const E2E_BASE_URL = `http://127.0.0.1:${E2E_PORT}`;

// Handed to the dev server under test via playwright.config.ts's
// webServer.env, so ARIADNE_WARP_TAB_CONFIG_DIR/ARIADNE_AGENT_SETTINGS_DIR
// (lib/agent-paths.ts) point at a throwaway folder instead of the user's
// real ~/.warp and ~/.ariadne. A dismiss fired by this suite deletes a tab
// config named after an e2e session's numeric id -- against the real
// directory that could collide with, and delete, a genuine one. Cleaned up
// by global-teardown.ts once the run finishes.
export const E2E_AGENT_HOME = path.join(os.tmpdir(), 'ariadne-e2e-agent-home');
export const E2E_WARP_TAB_CONFIG_DIR = path.join(E2E_AGENT_HOME, 'tab_configs');
export const E2E_AGENT_SETTINGS_DIR = path.join(E2E_AGENT_HOME, 'agent-sessions');
