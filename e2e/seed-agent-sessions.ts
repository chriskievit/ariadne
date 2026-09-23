import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDb } from '../lib/db';
import { createAdhocItem, setStatus, setParked, setTodayDate } from '../lib/items-repo';
import { createAgentSession, applyAgentSessionPatch } from '../lib/agent-sessions-repo';
import { addPlanItem } from '../lib/plans-repo';
import { localDateString } from '../lib/date';
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

    // launchToken is keyed on title (via `base`), same as every other
    // fixture here -- titles are unique per seed call, so this stays unique
    // too without threading a separate counter through.
    function launchOnItem(itemId: number, title: string) {
      return createAgentSession(db, {
        itemId,
        agent: 'claude',
        launchToken: `${base}-${title}`,
        tabTitle: title,
        tabColor: 'yellow',
      });
    }

    function launch(title: string) {
      const item = createAdhocItem(db, { title });
      return launchOnItem(item.id, title);
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

// Task 8's own fixtures, kept out of seedAgentSessions above on purpose:
// that function is called by several other spec files (session-pane.spec.ts,
// work-mode.spec.ts), each with its own suffix, and every one of those calls
// would otherwise also create these eight extra items as an unrequested side
// effect -- discovered the hard way, as a full-suite run that left a Today
// row and an In-progress row behind per seedAgentSessions call across the
// whole suite, breaking today-reorder.spec.ts's exact row-count assertions
// two files later. A second exported function, same file (per the brief:
// extend this file rather than write a parallel seed), called only from
// lifecycle-wiring.spec.ts.
export function seedLifecycleFixtures(suffix: string): {
  // Task 8, assertions 1-2: a Today row whose item has a working session --
  // the state's word, and the absence of Threadline Gold on it.
  todayWorkingTitle: string;
  todayWorkingItemId: number;
  // Three separate in-progress items, one per park outcome, so the decline,
  // accept and server-failure specs never contend over the same row.
  parkDeclineTitle: string;
  parkDeclineItemId: number;
  parkAcceptTitle: string;
  parkAcceptItemId: number;
  parkFailTitle: string;
  parkFailItemId: number;
  // registeredAt is stamped in the past (see launchParkable below), so the
  // complete dialog's agent-elapsed reference has real minutes to render.
  completeElapsedTitle: string;
  completeElapsedItemId: number;
  // The rail's Today mark and the case it must not fire on: pinned via
  // today_date vs. merely sitting in today's plan_items.
  railTodayMarkedTitle: string;
  railTodayMarkedItemId: number;
  railTodayUnmarkedTitle: string;
  railTodayUnmarkedItemId: number;
  // A parked item with no session attached -- this fixture is only for the
  // "Unpark" and "Parked · N" vocabulary, not for session wiring.
  vocabParkedTitle: string;
  vocabParkedItemId: number;
} {
  const db = openDb(E2E_DB_PATH);
  try {
    const base = `${Date.now()}${suffix}`;
    const todayStr = localDateString(new Date());
    const titles = {
      todayWorkingTitle: `Agent today working ${base}`,
      parkDeclineTitle: `Agent park decline ${base}`,
      parkAcceptTitle: `Agent park accept ${base}`,
      parkFailTitle: `Agent park fail ${base}`,
      completeElapsedTitle: `Agent complete elapsed ${base}`,
      railTodayMarkedTitle: `Agent rail pin marked ${base}`,
      railTodayUnmarkedTitle: `Agent rail pin unmarked ${base}`,
      vocabParkedTitle: `Agent vocab parked ${base}`,
    };

    function launchOnItem(itemId: number, title: string) {
      return createAgentSession(db, {
        itemId,
        agent: 'claude',
        launchToken: `${base}-${title}`,
        tabTitle: title,
        tabColor: 'yellow',
      });
    }

    // Assertions 1-2: a Today row whose item has a working session must
    // show the state's word, and the marker carrying that word must never
    // render in Threadline Gold -- gold marks the thread you are holding
    // (ItemRow's isTracking pulse, the running timer), and a delegated
    // session is precisely the one you are not (see the header comments on
    // lib/agent-session-display.ts and SessionRosterRow.tsx). Left at
    // status 'inbox' deliberately: today_date alone puts it in Today and
    // nowhere else. Pairing today_date with status 'in_progress' would also
    // land it in the In-progress list (getGroupedItems does not make Today
    // and In-progress exclusive), rendering the row twice and making every
    // locator ambiguous.
    const todayWorkingItem = createAdhocItem(db, { title: titles.todayWorkingTitle });
    setTodayDate(db, todayWorkingItem.id, todayStr);
    const todayWorking = launchOnItem(todayWorkingItem.id, titles.todayWorkingTitle);
    applyAgentSessionPatch(db, todayWorking.id, {
      state: 'working',
      registeredAt: new Date().toISOString(),
      lastEventAt: new Date().toISOString(),
    });

    // Assertions 3-7: an in-progress item with a live session, parking's
    // precondition for offering the dismiss-too question at all. Never
    // pinned to today, for the same single-row reason as above.
    // registeredAt is a parameter (not always "now") so the same helper can
    // also seed the complete-elapsed fixture below with a real, non-zero
    // elapsed time.
    function launchParkable(title: string, registeredAt = new Date().toISOString()): number {
      const item = createAdhocItem(db, { title });
      setStatus(db, item.id, 'in_progress');
      const session = launchOnItem(item.id, title);
      applyAgentSessionPatch(db, session.id, {
        state: 'working',
        registeredAt,
        lastEventAt: new Date().toISOString(),
      });
      return item.id;
    }

    const parkDeclineItemId = launchParkable(titles.parkDeclineTitle);
    const parkAcceptItemId = launchParkable(titles.parkAcceptTitle);
    const parkFailItemId = launchParkable(titles.parkFailTitle);
    // Five minutes in the past so formatElapsed has minutes to render
    // ("5:00", not "0:00") -- a dialog that fed the wrong field into the
    // reference would still show *something* at 0:00, so a zero elapsed
    // time would let that regression through.
    const completeElapsedItemId = launchParkable(
      titles.completeElapsedTitle,
      new Date(Date.now() - 5 * 60 * 1000).toISOString()
    );

    // Assertion 8: the rail's Today mark must mirror today_date -- the same
    // field Planning's own Today section filters on (getGroupedItems,
    // lib/dashboard.ts) -- not plan_items membership, which is a separate,
    // capacity-and-logged-hours fact that can disagree with it (see
    // lib/agent-session-list.ts's onToday comment, and the unit coverage in
    // lib/agent-session-list.test.ts this mirrors at the UI layer). One
    // session pinned via today_date, one merely sitting in today's
    // plan_items with today_date left null -- the divergent case an earlier
    // implementation got backwards.
    const railMarkedItem = createAdhocItem(db, { title: titles.railTodayMarkedTitle });
    setTodayDate(db, railMarkedItem.id, todayStr);
    launchOnItem(railMarkedItem.id, titles.railTodayMarkedTitle);

    const railUnmarkedItem = createAdhocItem(db, { title: titles.railTodayUnmarkedTitle });
    addPlanItem(db, todayStr, railUnmarkedItem.id);
    launchOnItem(railUnmarkedItem.id, titles.railTodayUnmarkedTitle);

    // Assertion 9 (vocabulary): parked, with no session attached -- this
    // fixture only ever backs the "Unpark" / "Parked · N" wording checks,
    // not session wiring. setStatus resets `parked` to 0 as a side effect
    // (see items-repo.ts), so it must run before setParked, not after.
    const vocabParkedItem = createAdhocItem(db, { title: titles.vocabParkedTitle });
    setStatus(db, vocabParkedItem.id, 'in_progress');
    setParked(db, vocabParkedItem.id, true);

    return {
      ...titles,
      todayWorkingItemId: todayWorkingItem.id,
      parkDeclineItemId,
      parkAcceptItemId,
      parkFailItemId,
      completeElapsedItemId,
      railTodayMarkedItemId: railMarkedItem.id,
      railTodayUnmarkedItemId: railUnmarkedItem.id,
      vocabParkedItemId: vocabParkedItem.id,
    };
  } finally {
    db.close();
  }
}
