import path from 'node:path';
import os from 'node:os';

export const E2E_DB_PATH = path.join(os.tmpdir(), 'ariadne-e2e.db');
export const E2E_PORT = 4180;
export const E2E_BASE_URL = `http://127.0.0.1:${E2E_PORT}`;
