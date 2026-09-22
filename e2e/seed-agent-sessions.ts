import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDb } from '../lib/db';
import { createAdhocItem } from '../lib/items-repo';
import { createAgentSession, applyAgentSessionPatch } from '../lib/agent-sessions-repo';
import { E2E_DB_PATH } from './db-path';

// The repo this file lives in, used as `cwd` for the diff-bearing session.
// It is a real git repository with a real branch and a real diff against
// origin/main, which is what lib/agent-worktree.ts actually shells out to --
// a mock diff would only prove the component can render fixture data, not
// that it can survive what git really says.
const REPO_ROOT = path.resolve(__dirname, '..');

// Read straight from git rather than hardcoded, so the spec keeps asserting
// against whatever this checkout's branch actually is instead of a string
// that goes stale the next time this branch is renamed or merged.
function currentBranch(): string {
  return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: REPO_ROOT }).toString().trim();
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
    const transcriptPath = path.join(os.tmpdir(), `ariadne-e2e-transcript-${base}.jsonl`);
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

    // Points the diff route at this actual checkout. Whatever branch and
    // diff-against-origin/main exist here at test time are what the pane
    // must show -- see readSessionDiff in lib/agent-worktree.ts.
    const diff = launch(titles.diffTitle);
    applyAgentSessionPatch(db, diff.id, {
      state: 'working',
      registeredAt: new Date().toISOString(),
      lastEventAt: new Date().toISOString(),
      cwd: REPO_ROOT,
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

    return { ...titles, needsYouMessage, transcriptOldest, transcriptNewest, diffBranch: currentBranch() };
  } finally {
    db.close();
  }
}
