import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDb } from '@/lib/db';
import { setSetting } from '@/lib/settings-repo';
import { SETTINGS_KEYS } from '@/lib/config';

const testDb = openDb(':memory:');
vi.mock('@/lib/db-instance', () => ({ db: testDb }));

const { GET } = await import('./route');

let baseDir: string;

beforeEach(() => {
  testDb.exec('DELETE FROM settings;');
  baseDir = mkdtempSync(join(tmpdir(), 'ariadne-local-repos-test-'));
  mkdirSync(join(baseDir, 'repo-a'));
  setSetting(testDb, SETTINGS_KEYS.localReposBaseDir, baseDir);
});

afterEach(() => {
  rmSync(baseDir, { recursive: true, force: true });
});

describe('GET /api/local-repos', () => {
  it('returns local repos from the configured base directory', async () => {
    const res = await GET();
    expect(await res.json()).toEqual([{ name: 'repo-a', path: join(baseDir, 'repo-a') }]);
  });
});
