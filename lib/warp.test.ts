import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDb } from './db';
import { setSetting } from './settings-repo';
import { SETTINGS_KEYS } from './config';
import { listLocalRepos, resolveWorkingDir, parseRepoPathOverrides } from './warp';

let db: ReturnType<typeof openDb>;
let baseDir: string;

beforeEach(() => {
  db = openDb(':memory:');
  baseDir = mkdtempSync(join(tmpdir(), 'ariadne-warp-test-'));
  mkdirSync(join(baseDir, 'repo-a'));
  mkdirSync(join(baseDir, 'repo-b'));
  setSetting(db, SETTINGS_KEYS.localReposBaseDir, baseDir);
});

afterEach(() => {
  rmSync(baseDir, { recursive: true, force: true });
});

describe('parseRepoPathOverrides', () => {
  it('parses name=path lines, skipping blanks and malformed lines', () => {
    expect(parseRepoPathOverrides('repo-a=/x/y\n\nbad-line\nrepo-b=/z')).toEqual({
      'repo-a': '/x/y',
      'repo-b': '/z',
    });
  });
});

describe('listLocalRepos', () => {
  it('lists subdirectories of the base dir', () => {
    expect(listLocalRepos(db)).toEqual([
      { name: 'repo-a', path: join(baseDir, 'repo-a') },
      { name: 'repo-b', path: join(baseDir, 'repo-b') },
    ]);
  });

  it('overrides take precedence over a disk entry with the same name', () => {
    setSetting(db, SETTINGS_KEYS.repoPathOverrides, 'repo-a=/custom/path');
    const repos = listLocalRepos(db);
    expect(repos.find((r) => r.name === 'repo-a')).toEqual({ name: 'repo-a', path: '/custom/path' });
  });

  it('adds override-only entries not present on disk', () => {
    setSetting(db, SETTINGS_KEYS.repoPathOverrides, 'repo-c=/somewhere/else');
    const repos = listLocalRepos(db);
    expect(repos.find((r) => r.name === 'repo-c')).toEqual({ name: 'repo-c', path: '/somewhere/else' });
  });

  it('returns an empty list when the base dir is unset', () => {
    const freshDb = openDb(':memory:');
    expect(listLocalRepos(freshDb)).toEqual([]);
  });
});

describe('resolveWorkingDir', () => {
  it('returns null for an item with no repo', () => {
    expect(resolveWorkingDir(db, { repo: null })).toBeNull();
  });

  it('falls back to baseDir/repo when no override exists', () => {
    expect(resolveWorkingDir(db, { repo: 'repo-a' })).toBe(join(baseDir, 'repo-a'));
  });

  it('uses the override path when one exists for the repo', () => {
    setSetting(db, SETTINGS_KEYS.repoPathOverrides, 'repo-a=/custom/path');
    expect(resolveWorkingDir(db, { repo: 'repo-a' })).toBe('/custom/path');
  });

  it('returns null when repo is set but no base dir or override is configured', () => {
    const freshDb = openDb(':memory:');
    expect(resolveWorkingDir(freshDb, { repo: 'repo-a' })).toBeNull();
  });
});
