import { defineConfig } from '@playwright/test';
import {
  E2E_BASE_URL,
  E2E_DB_PATH,
  E2E_PORT,
  E2E_WARP_TAB_CONFIG_DIR,
  E2E_AGENT_SETTINGS_DIR,
} from './e2e/db-path';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  use: {
    baseURL: E2E_BASE_URL,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `npm run dev -- -p ${E2E_PORT}`,
    url: E2E_BASE_URL,
    reuseExistingServer: false,
    timeout: 30_000,
    // ARIADNE_WARP_TAB_CONFIG_DIR/ARIADNE_AGENT_SETTINGS_DIR redirect every
    // Warp tab config write and delete this suite triggers (park, snooze,
    // complete, dismiss, resume) away from the user's real ~/.warp and
    // ~/.ariadne -- see lib/agent-paths.ts and E2E_AGENT_HOME's own comment.
    env: {
      ARIADNE_DB_PATH: E2E_DB_PATH,
      ARIADNE_WARP_TAB_CONFIG_DIR: E2E_WARP_TAB_CONFIG_DIR,
      ARIADNE_AGENT_SETTINGS_DIR: E2E_AGENT_SETTINGS_DIR,
    },
  },
});
