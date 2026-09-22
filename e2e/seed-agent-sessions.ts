import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDb } from '../lib/db';
import { createAdhocItem } from '../lib/items-repo';
import { createAgentSession, applyAgentSessionPatch } from '../lib/agent-sessions-repo';
import { E2E_DB_PATH } from './db-path';

// Deliberately not this repository. Pointing the diff-bearing session at
// Ariadne's own checkout was tried first and rejected: the assertion it
// produced was anchored to the files-present variant of the framing, and
// once this branch merges, `origin/main` catches up to HEAD, the diff goes
// empty, and the anchored regex fails on main for everyone. A throwaway
// fixture repo is still real git -- real merge-base, real --numstat, real
// --patch -- but the branch name and the diff it carries are fixed at seed
// time instead of being whatever this checkout happens to be sitting on.
// Same construction lib/git-cli.test.ts already uses: mkdtempSync, a real
// `git init`, a user.email/name so commit does not fail on a machine with
// no global git config.
const DIFF_FIXTURE_BRANCH = 'work/e2e-diff-fixture';
const DIFF_FIXTURE_FILE = 'e2e-diff-fixture.txt';

// Shared with global-teardown.ts, which is the only thing that ever removes
// what these prefixes name. Unlike E2E_DB_PATH, which global-setup wipes
// before every run, nothing else in this suite revisits os.tmpdir() -- these
// prefixes are what lets teardown find every fixture repo and transcript
// file this module writes, from a separate process, after the run that
// created them has already finished.
export const DIFF_FIXTURE_DIR_PREFIX = 'ariadne-e2e-diff-';
export const TRANSCRIPT_FIXTURE_PREFIX = 'ariadne-e2e-transcript-';

function git(dir: string, args: string[]): void {
  execFileSync('git', ['-C', dir, ...args], { stdio: 'pipe' });
}

/**
 * A throwaway repo with a known default branch and, optionally, a feature
 * branch carrying a known change on top of it.
 *
 * `refs/remotes/origin/main` is written directly with `update-ref` rather
 * than through an actual remote -- lib/agent-worktree.ts's resolveBase only
 * ever reads that ref (`symbolic-ref` for the remote's default, then
 * `merge-base` against it), it never fetches, so a real remote would add
 * ceremony without testing anything this component actually does.
 *
 * `withChanges: false` leaves HEAD sitting on the default branch itself, so
 * the diff route's other real variant -- available, but nothing on this
 * branch yet -- is reachable too, from an equally deterministic fixture.
 */
function createDiffFixtureRepo(withChanges: boolean): { dir: string; branch: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), DIFF_FIXTURE_DIR_PREFIX));
  git(dir, ['init', '-q', '-b', 'main']);
  git(dir, ['config', 'user.email', 'e2e@example.test']);
  git(dir, ['config', 'user.name', 'Ariadne E2E']);
  fs.writeFileSync(path.join(dir, 'README.md'), 'fixture repo for the session-pane e2e spec\n');
  git(dir, ['add', '.']);
  git(dir, ['commit', '-qm', 'initial']);
  git(dir, ['update-ref', 'refs/remotes/origin/main', 'main']);
  // A real `git clone` sets this too; without it, resolveBase's first probe
  // (the remote's own published default) fails and falls through to the
  // origin/main guess, which still works but logs a warning on every call --
  // noise this fixture can avoid just by looking like an ordinary clone.
  git(dir, ['symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/main']);

  if (!withChanges) {
    return { dir, branch: 'main' };
  }

  git(dir, ['checkout', '-qb', DIFF_FIXTURE_BRANCH]);
  // Three added lines, so --numstat has a non-zero, assertable count and
  // the patch has real content to check for beyond a file name.
  fs.writeFileSync(path.join(dir, DIFF_FIXTURE_FILE), 'one\ntwo\nthree\n');
  git(dir, ['add', '.']);
  git(dir, ['commit', '-qm', 'add the fixture file']);
  return { dir, branch: DIFF_FIXTURE_BRANCH };
}

// Agent sessions cannot be produced through the UI under test: launching one
// writes a Warp tab config and opens it. Seed straight into the sqlite file
// the dev server points at, the same way seed-needs-you.ts does.
export function seedAgentSessions(suffix: string): {
  workingTitle: string;
  needsYouTitle: string;
  needsYouMessage: string;
  neverRegisteredTitle: string;
  endedTitle: string;
  transcriptTitle: string;
  transcriptOldest: string;
  transcriptNewest: string;
  diffTitle: string;
  diffBranch: string;
  diffFixtureFile: string;
  diffEmptyTitle: string;
  diffEmptyBranch: string;
  dismissableTitle: string;
  dismissedTitle: string;
} {
  const db = openDb(E2E_DB_PATH);
  try {
    const base = `${Date.now()}${suffix}`;
    const titles = {
      workingTitle: `Agent working ${base}`,
      needsYouTitle: `Agent needs you ${base}`,
      neverRegisteredTitle: `Agent never registered ${base}`,
      endedTitle: `Agent ended ${base}`,
      transcriptTitle: `Agent with transcript ${base}`,
      diffTitle: `Agent with diff ${base}`,
      diffEmptyTitle: `Agent with no diff yet ${base}`,
      dismissableTitle: `Agent to dismiss ${base}`,
      dismissedTitle: `Agent already dismissed ${base}`,
    };
    const needsYouMessage = `Which migration should run first, ${base}?`;

    function launch(title: string) {
      const item = createAdhocItem(db, { title });
      return createAgentSession(db, {
        itemId: item.id,
        agent: 'claude',
        launchToken: `${base}-${title}`,
        tabTitle: title,
        tabColor: 'yellow',
      });
    }

    const working = launch(titles.workingTitle);
    applyAgentSessionPatch(db, working.id, {
      state: 'working',
      registeredAt: new Date().toISOString(),
      lastEventAt: new Date().toISOString(),
    });

    const needsYou = launch(titles.needsYouTitle);
    applyAgentSessionPatch(db, needsYou.id, {
      state: 'needs_you',
      registeredAt: new Date().toISOString(),
      lastEventAt: new Date().toISOString(),
      needsYouMessage,
    });

    // No registeredAt and a created_at well past the launch window, so the
    // reconciler in listSessionsForDisplay marks it on the first read. This
    // is the state Claude Code's folder-trust prompt actually produces.
    const never = launch(titles.neverRegisteredTitle);
    db.prepare('UPDATE agent_sessions SET created_at = ? WHERE id = ?').run(
      new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      never.id
    );

    const ended = launch(titles.endedTitle);
    applyAgentSessionPatch(db, ended.id, {
      state: 'stopped',
      registeredAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      endReason: 'closed',
    });

    // A small, real JSONL transcript, written to a temp file the same way
    // Claude Code's hooks write one. Two markers far enough apart in the
    // text that a test can tell them apart, and ordered oldest-line-first
    // in the file itself -- readTranscriptTail renders lines in the order
    // it encounters them, so the file's own order *is* the thing under
    // test.
    const transcriptOldest = `E2E oldest turn ${base}`;
    const transcriptNewest = `E2E newest turn ${base}`;
    const transcriptPath = path.join(os.tmpdir(), `${TRANSCRIPT_FIXTURE_PREFIX}${base}.jsonl`);
    const transcriptLines = [
      { type: 'user', timestamp: '2026-09-22T09:00:00.000Z', message: { role: 'user', content: transcriptOldest } },
      {
        type: 'assistant',
        timestamp: '2026-09-22T09:00:05.000Z',
        message: { role: 'assistant', content: [{ type: 'text', text: `E2E middle turn ${base}` }] },
      },
      { type: 'user', timestamp: '2026-09-22T09:00:10.000Z', message: { role: 'user', content: transcriptNewest } },
    ];
    fs.writeFileSync(transcriptPath, transcriptLines.map((line) => JSON.stringify(line)).join('\n') + '\n', 'utf8');

    const transcript = launch(titles.transcriptTitle);
    applyAgentSessionPatch(db, transcript.id, {
      state: 'working',
      registeredAt: new Date().toISOString(),
      lastEventAt: new Date().toISOString(),
      transcriptPath,
    });

    // Two fixture repos: one carrying a real, known change on a feature
    // branch, one sitting exactly on the default branch with nothing ahead
    // of it -- the diff route's two "available" variants, files-present and
    // "No changes yet.", both real git, neither depending on this
    // checkout's own branch or history.
    const diffFixture = createDiffFixtureRepo(true);
    const diff = launch(titles.diffTitle);
    applyAgentSessionPatch(db, diff.id, {
      state: 'working',
      registeredAt: new Date().toISOString(),
      lastEventAt: new Date().toISOString(),
      cwd: diffFixture.dir,
    });

    const diffEmptyFixture = createDiffFixtureRepo(false);
    const diffEmpty = launch(titles.diffEmptyTitle);
    applyAgentSessionPatch(db, diffEmpty.id, {
      state: 'working',
      registeredAt: new Date().toISOString(),
      lastEventAt: new Date().toISOString(),
      cwd: diffEmptyFixture.dir,
    });

    // Left live, for a spec to dismiss through the UI itself.
    const dismissable = launch(titles.dismissableTitle);
    applyAgentSessionPatch(db, dismissable.id, {
      state: 'working',
      registeredAt: new Date().toISOString(),
      lastEventAt: new Date().toISOString(),
    });

    // Already dismissed, with an agentSessionId on it -- everything Resume
    // would need except the one thing that must still refuse it: the agent
    // behind this row may still be alive, and dismissal never stopped it.
    const dismissed = launch(titles.dismissedTitle);
    applyAgentSessionPatch(db, dismissed.id, {
      state: 'stopped',
      registeredAt: new Date().toISOString(),
      agentSessionId: `${base}-resumable`,
      endedAt: new Date().toISOString(),
      endReason: 'dismissed',
    });

    return {
      ...titles,
      needsYouMessage,
      transcriptOldest,
      transcriptNewest,
      diffBranch: diffFixture.branch,
      diffFixtureFile: DIFF_FIXTURE_FILE,
      diffEmptyBranch: diffEmptyFixture.branch,
    };
  } finally {
    db.close();
  }
}
