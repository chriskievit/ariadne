import { describe, it, expect, beforeAll, afterAll, vi, type MockInstance } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { runGit, capOutput } from './git-cli';

let repo: string;
let warnSpy: MockInstance;

beforeAll(() => {
  // The failure-path cases below deliberately hit runGit's logWarn call.
  // Spying keeps that expected noise out of the test run's stderr, and the
  // reference is kept so the quiet-mode tests can assert on it directly.
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
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

  it('warns on a real failure by default', async () => {
    warnSpy.mockClear();
    const result = await runGit(repo, ['rev-parse', 'refs/heads/does-not-exist']);
    expect(result.ok).toBe(false);
    expect(warnSpy).toHaveBeenCalled();
  });

  it('says nothing for a quiet probe that misses, because a miss is the expected answer', async () => {
    warnSpy.mockClear();
    const result = await runGit(repo, ['rev-parse', 'refs/heads/does-not-exist'], { quiet: true });
    expect(result.ok).toBe(false);
    expect(warnSpy).not.toHaveBeenCalled();
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
    // Truncation is a truncated *success*, not a failure -- the command ran
    // and said something true, it just said more of it than fits.
    expect(result.ok).toBe(true);
  });

  it('does not mark ordinary output as truncated', async () => {
    const result = await runGit(repo, ['rev-parse', 'HEAD']);
    expect(result.truncated).toBe(false);
  });

  it('trims output that is over the cap but within the buffer, without Node killing the child', async () => {
    // A commit hash plus its trailing newline is 41 bytes. With maxBytes: 30,
    // that's over the cap (30) but under execFile's own buffer (60), so this
    // lands in the middle band: git finishes normally and runGit's own trim
    // -- not Node's kill -- is what makes this truncated.
    const result = await runGit(repo, ['log', '--format=%H'], { maxBytes: 30 });
    expect(result.ok).toBe(true);
    expect(result.truncated).toBe(true);
    expect(result.stdout.length).toBe(30);
  });
});

describe('capOutput', () => {
  it('passes text through untouched when it is under the cap', () => {
    const result = capOutput('short', 100);
    expect(result).toEqual({ stdout: 'short', truncated: false });
  });

  it('does not truncate text that lands exactly at the cap', () => {
    const result = capOutput('12345', 5);
    expect(result).toEqual({ stdout: '12345', truncated: false });
  });

  it('truncates text one byte over the cap', () => {
    const result = capOutput('123456', 5);
    expect(result).toEqual({ stdout: '12345', truncated: true });
  });

  it('truncates to empty output under a zero cap', () => {
    const result = capOutput('anything', 0);
    expect(result).toEqual({ stdout: '', truncated: true });
  });
});
