import { describe, it, expect } from 'vitest';
import { readWorktreeFacts, readSessionDiff } from './agent-worktree';
import type { GitResult } from './git-cli';
import type { SessionDiff } from './agent-worktree';

const ok = (stdout: string, truncated = false): GitResult => ({ ok: true, stdout, truncated });
const fail = (): GitResult => ({ ok: false, stdout: '', truncated: false });

// SessionDiff is a discriminated union on `available`. `expect(...).toBe(...)`
// checks the value but doesn't narrow the type, so these assert the same
// condition in a way TypeScript can follow, for accessing the fields after.
function assertAvailable(result: SessionDiff): asserts result is Extract<SessionDiff, { available: true }> {
  if (!result.available) throw new Error(`expected an available diff, got unavailable: ${result.reason}`);
}
function assertUnavailable(result: SessionDiff): asserts result is Extract<SessionDiff, { available: false }> {
  if (result.available) throw new Error('expected the diff to be unavailable');
}

// A scripted git: matches on the first argument that identifies the command.
function scripted(map: Record<string, GitResult>) {
  const calls: string[][] = [];
  const git = async (_cwd: string, args: string[]) => {
    calls.push(args);
    const key = Object.keys(map).find((k) => args.join(' ').startsWith(k));
    return key ? map[key] : fail();
  };
  return { git, calls };
}

describe('readWorktreeFacts', () => {
  it('reads the branch and the worktree root back from git', async () => {
    const { git } = scripted({
      'rev-parse --abbrev-ref HEAD': ok('feature/thing\n'),
      'rev-parse --show-toplevel': ok('/repos/app\n'),
    });
    expect(await readWorktreeFacts('/repos/app', git)).toEqual({ branch: 'feature/thing', root: '/repos/app' });
  });

  it('reports nothing rather than guessing when the directory is not a repository', async () => {
    const { git } = scripted({});
    expect(await readWorktreeFacts('/tmp/nope', git)).toEqual({ branch: null, root: null });
  });

  it('reports a detached HEAD as detached rather than as a branch named HEAD', async () => {
    const { git } = scripted({
      'rev-parse --abbrev-ref HEAD': ok('HEAD\n'),
      'rev-parse --show-toplevel': ok('/repos/app\n'),
    });
    expect((await readWorktreeFacts('/repos/app', git)).branch).toBeNull();
  });
});

describe('readSessionDiff', () => {
  const facts = {
    'rev-parse --abbrev-ref HEAD': ok('feature/thing\n'),
    'rev-parse --show-toplevel': ok('/repos/app\n'),
  };

  it('diffs against the merge base with the default branch', async () => {
    const { git, calls } = scripted({
      ...facts,
      'symbolic-ref': ok('origin/main\n'),
      'merge-base': ok('abc123\n'),
      'diff --numstat': ok('3\t1\tsrc/a.ts\n10\t0\tsrc/b.ts\n'),
      'diff --patch': ok('diff --git a/src/a.ts b/src/a.ts\n'),
    });

    const result = await readSessionDiff('/repos/app', git);

    expect(result.available).toBe(true);
    assertAvailable(result);
    expect(result.base).toBe('abc123');
    expect(result.files).toEqual([
      { path: 'src/a.ts', added: 3, removed: 1 },
      { path: 'src/b.ts', added: 10, removed: 0 },
    ]);
    expect(calls.some((c) => c.join(' ').includes('merge-base'))).toBe(true);
  });

  it('falls back through the default-branch candidates when origin has no HEAD', async () => {
    const { git, calls } = scripted({
      ...facts,
      'merge-base HEAD origin/main': ok('base1\n'),
      'diff --numstat': ok(''),
      'diff --patch': ok(''),
    });

    const result = await readSessionDiff('/repos/app', git);

    expect(result.available).toBe(true);
    assertAvailable(result);
    expect(result.base).toBe('base1');
    expect(calls.some((c) => c.join(' ').includes('symbolic-ref'))).toBe(true);
  });

  it('says why there is no diff rather than showing an empty one', async () => {
    const { git } = scripted({});
    const result = await readSessionDiff('/tmp/nope', git);
    expect(result.available).toBe(false);
    assertUnavailable(result);
    expect(result.reason).toMatch(/not a git/i);
  });

  it('reports no comparable branch when every candidate is missing', async () => {
    const { git } = scripted({ ...facts });
    const result = await readSessionDiff('/repos/app', git);
    expect(result.available).toBe(false);
    assertUnavailable(result);
    expect(result.reason).toMatch(/default branch/i);
  });

  it('says the diff could not be read when numstat fails but patch succeeds', async () => {
    const { git } = scripted({
      ...facts,
      'symbolic-ref': ok('origin/main\n'),
      'merge-base': ok('abc123\n'),
      'diff --patch': ok('diff --git a/a b/a\n'),
    });
    const result = await readSessionDiff('/repos/app', git);
    expect(result.available).toBe(false);
    assertUnavailable(result);
    expect(result.reason).toMatch(/could not read the diff/i);
  });

  it('says the diff could not be read when patch fails but numstat succeeds', async () => {
    const { git } = scripted({
      ...facts,
      'symbolic-ref': ok('origin/main\n'),
      'merge-base': ok('abc123\n'),
      'diff --numstat': ok('1\t0\ta\n'),
    });
    const result = await readSessionDiff('/repos/app', git);
    expect(result.available).toBe(false);
    assertUnavailable(result);
    expect(result.reason).toMatch(/could not read the diff/i);
  });

  it('treats an empty numstat as a real answer, not a failure', async () => {
    const { git } = scripted({
      ...facts,
      'symbolic-ref': ok('origin/main\n'),
      'merge-base': ok('abc123\n'),
      'diff --numstat': ok(''),
      'diff --patch': ok(''),
    });
    const result = await readSessionDiff('/repos/app', git);
    expect(result.available).toBe(true);
    assertAvailable(result);
    expect(result.files).toEqual([]);
  });

  it('carries truncation through so the pane can say the patch was cut', async () => {
    const { git } = scripted({
      ...facts,
      'symbolic-ref': ok('origin/main\n'),
      'merge-base': ok('abc123\n'),
      'diff --numstat': ok('1\t0\ta\n'),
      'diff --patch': ok('diff --git a/a b/a\n', true),
    });
    const result = await readSessionDiff('/repos/app', git);
    assertAvailable(result);
    expect(result.truncated).toBe(true);
  });

  it('counts a binary file without inventing line numbers', async () => {
    const { git } = scripted({
      ...facts,
      'symbolic-ref': ok('origin/main\n'),
      'merge-base': ok('abc123\n'),
      'diff --numstat': ok('-\t-\tlogo.png\n'),
      'diff --patch': ok(''),
    });
    const result = await readSessionDiff('/repos/app', git);
    assertAvailable(result);
    expect(result.files).toEqual([{ path: 'logo.png', added: null, removed: null }]);
  });
});
