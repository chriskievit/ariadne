import fs from 'node:fs';
import { E2E_DB_PATH } from './db-path';

export default function globalSetup(): void {
  for (const suffix of ['', '-wal', '-shm']) {
    fs.rmSync(`${E2E_DB_PATH}${suffix}`, { force: true });
  }
}
