import os from 'node:os';
import path from 'node:path';
import { defineConfig } from '@playwright/test';

// Deliberately outside e2e/ so `npm run test:e2e` never picks this up --
// regenerating the README images is a manual, on-demand job, not a test.
export const SCREENSHOT_DB_PATH = path.join(os.tmpdir(), 'ariadne-screenshots.db');
const PORT = 4190;
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: __dirname,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  timeout: 120_000,
  use: {
    baseURL: BASE_URL,
    // Retina output, matching the images already in docs/.
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    colorScheme: 'dark',
  },
  webServer: {
    command: `npm run dev -- -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { ARIADNE_DB_PATH: SCREENSHOT_DB_PATH },
  },
});
