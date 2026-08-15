import { defineConfig } from '@playwright/test';
import { E2E_BASE_URL, E2E_DB_PATH, E2E_PORT } from './e2e/db-path';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: E2E_BASE_URL,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `npm run dev -- -p ${E2E_PORT}`,
    url: E2E_BASE_URL,
    reuseExistingServer: false,
    timeout: 30_000,
    env: { ARIADNE_DB_PATH: E2E_DB_PATH },
  },
});
