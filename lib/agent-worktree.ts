import { runGit, type GitResult, type RunGitOptions } from './git-cli';

type GitRunner = (cwd: string, args: string[], options?: RunGitOptions) => Promise<GitResult>;

// Tried in order when the remote does not publish its own HEAD. Two names,
// because guessing further would mean diffing against something arbitrary
// and calling the result the session's work.
export const DEFAULT_BRANCH_CANDIDATES = ['origin/main', 'origin/master'] as const;

export interface WorktreeFacts {
  branch: string | null;
  root: string | null;
}

/**
 * What git says about the directory a session reported working in.
 *
 * Read back rather than taken from the agent: Claude Code's hook payload
 * carries a cwd and nothing else, so `agent_sessions.git_branch` has been
 * null for every row ever written. This is where a branch actually comes
 * from, and why worktrees are observed rather than managed — Ariadne asks
 * where the session landed, it never decides.
 */
export async function readWorktreeFacts(cwd: string, git: GitRunner = runGit): Promise<WorktreeFacts> {
  const [branch, root] = await Promise.all([
    git(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']),
    git(cwd, ['rev-parse', '--show-toplevel']),
  ]);

  const name = branch.ok ? branch.stdout.trim() : '';
  return {
    // git answers the literal string "HEAD" when detached. Reporting that as
    // a branch name would be worse than admitting there is no branch.
    branch: name && name !== 'HEAD' ? name : null,
    root: root.ok ? root.stdout.trim() || null : null,
  };
}

export interface DiffFile {
  path: string;
  // null for a binary file, where git reports "-" rather than a count.
  added: number | null;
  removed: number | null;
}

export type SessionDiff =
  | { available: false; reason: string }
  | {
      available: true;
      branch: string | null;
      base: string;
      files: DiffFile[];
      patch: string;
      truncated: boolean;
    };

async function resolveBase(cwd: string, git: GitRunner): Promise<string | null> {
  // What the remote itself says is its default, first. The hardcoded names
  // are a fallback for a remote that never published a HEAD, and they are
  // tried after it rather than instead of it -- deduplicated, so a repo whose
  // origin/HEAD already points at origin/main is not probed for it twice.
  //
  // Both probes below pass quiet: true. `--quiet` on symbolic-ref and a
  // missing merge-base are misses this function expects and handles, not
  // faults -- runGit's default logging would otherwise warn on every one of
  // them, at this pane's five-second poll, for any repo with no `origin`.
  const published = await git(
    cwd,
    ['symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD'],
    { quiet: true }
  );
  const head = published.ok ? published.stdout.trim() : '';
  const refs = [...new Set([head, ...DEFAULT_BRANCH_CANDIDATES].filter(Boolean))];

  for (const ref of refs) {
    const base = await git(cwd, ['merge-base', 'HEAD', ref], { quiet: true });
    if (base.ok && base.stdout.trim()) return base.stdout.trim();
  }
  return null;
}

function parseNumstat(text: string): DiffFile[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [added, removed, ...rest] = line.split('\t');
      return {
        path: rest.join('\t'),
        added: added === '-' ? null : Number(added),
        removed: removed === '-' ? null : Number(removed),
      };
    })
    .filter((file) => file.path.length > 0);
}

/**
 * Everything on this branch that is not on the default branch.
 *
 * Deliberately NOT "what this session changed", and nothing in the product
 * may label it that way. Ariadne records no base commit at launch, so it
 * cannot tell the agent's commits from yours; a branch you had already been
 * working on shows your work here too. The honest frame is the branch, and
 * the pane says so.
 */
export async function readSessionDiff(cwd: string, git: GitRunner = runGit): Promise<SessionDiff> {
  const facts = await readWorktreeFacts(cwd, git);
  if (facts.root === null) return { available: false, reason: 'That folder is not a git repository any more.' };

  const base = await resolveBase(cwd, git);
  if (base === null) {
    return { available: false, reason: 'No default branch to compare against. Ariadne looked for origin/main and origin/master.' };
  }

  const [numstat, patch] = await Promise.all([
    git(cwd, ['diff', '--numstat', base]),
    git(cwd, ['diff', '--patch', base]),
  ]);

  // These are two invocations of the same diff against the same base, so the
  // ways they can fail are essentially identical -- one failing while the
  // other succeeds is close to impossible in practice. That is exactly why
  // it is not worth papering over: a fallback here would render a file list
  // that contradicts the patch beneath it. When the improbable happens,
  // saying so is worth more than showing something incoherent.
  if (!numstat.ok || !patch.ok) {
    return { available: false, reason: 'Ariadne could not read the diff for this branch.' };
  }

  return {
    available: true,
    branch: facts.branch,
    base,
    files: parseNumstat(numstat.stdout),
    patch: patch.stdout,
    truncated: patch.truncated || numstat.truncated,
  };
}
