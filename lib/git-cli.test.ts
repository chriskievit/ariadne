import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { runGit } from './git-cli';

let repo: string;

beforeAll(() => {
  // The failure-path cases below deliberately hit runGit's logWarn call.
  // Spying keeps that expected noise out of the test run's stderr.
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  repo = mkdtempSync(join(tmpdir(), 'ariadne-git-'));
  const git = (...args: string[]) => execFileSync('git', ['-C', repo, ...args], { stdio: 'pipe' });
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 'test@example.test');
  git('config', 'user.name', 'Test');
  writeFileSync(join(repo, 'a.txt'), 'one\n');
  git('add', '.');
  git('commit', '-qm', 'first');
});

afterAll(() => {
  rmSync(repo, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe('runGit', () => {
  it('returns stdout and ok for a command that succeeds', async () => {
    const result = await runGit(repo, ['rev-parse', '--abbrev-ref', 'HEAD']);
    expect(result.ok).toBe(true);
    expect(result.stdout.trim()).toBe('main');
  });

  it('reports failure instead of throwing, so a caller never has to guard it', async () => {
    const result = await runGit(repo, ['rev-parse', 'refs/heads/does-not-exist']);
    expect(result.ok).toBe(false);
    expect(result.stdout).toBe('');
  });

  it('reports failure for a directory that is not a repository', async () => {
    const empty = mkdtempSync(join(tmpdir(), 'ariadne-notgit-'));
    try {
      const result = await runGit(empty, ['status']);
      expect(result.ok).toBe(false);
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });

  it('reports failure for a directory that does not exist at all', async () => {
    const result = await runGit(join(tmpdir(), 'ariadne-absent-' + Date.now()), ['status']);
    expect(result.ok).toBe(false);
  });

  it('never interprets an argument as a shell token', async () => {
    // If this were built into a shell string, the subshell would run and the
    // file would exist. Passed as one argv element, git simply rejects it.
    const marker = join(tmpdir(), `ariadne-pwned-${Date.now()}`);
    const result = await runGit(repo, ['rev-parse', `$(touch ${marker})`]);
    expect(result.ok).toBe(false);
    const { existsSync } = await import('node:fs');
    expect(existsSync(marker)).toBe(false);
  });

  it('truncates output past the cap rather than holding a whole repository in memory', async () => {
    const result = await runGit(repo, ['log', '--format=%H'], { maxBytes: 8 });
    expect(result.stdout.length).toBeLessThanOrEqual(8);
    expect(result.truncated).toBe(true);
  });

  it('does not mark ordinary output as truncated', async () => {
    const result = await runGit(repo, ['rev-parse', 'HEAD']);
    expect(result.truncated).toBe(false);
  });
});
