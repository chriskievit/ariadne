import { statSync } from 'node:fs';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db-instance';
import { getItemById } from '@/lib/items-repo';
import {
  createAgentSession,
  getAgentSessionById,
  getActiveAgentSessionForItem,
  toPublicAgentSession,
} from '@/lib/agent-sessions-repo';
import { getAgentDefinition } from '@/lib/agents';
import { sessionTabTitle, sessionWarpUrl, writeSessionTabConfig, AGENT_TAB_COLOR } from '@/lib/agent-launch';
import { agentTabConfigDir } from '@/lib/agent-paths';
import { newLaunchToken, commitAgentSessionLaunch, ensureHookSettingsFile } from '@/lib/agent-session-launch';
import { logError } from '@/lib/log';

// agentSessionId arrives in the agent's own hook payload -- an HTTP POST this
// server accepts from anything that can reach it -- and it ends up inside a
// command string Warp runs in a shell. Checked here regardless of what
// writeSessionTabConfig already guards: that guard lives next to the TOML
// writer, this one lives next to where the id first gets used, and a future
// refactor is far more likely to drop one of the two than both.
const AGENT_SESSION_ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await params;
  const session = getAgentSessionById(db, Number(idParam));
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

  if (!session.agentSessionId) {
    return NextResponse.json(
      { error: 'This session has not reported an agent session id yet, so there is nothing to resume.' },
      { status: 400 }
    );
  }
  if (!AGENT_SESSION_ID_PATTERN.test(session.agentSessionId)) {
    return NextResponse.json({ error: 'Stored agent session id is not a plain identifier.' }, { status: 400 });
  }

  const agent = getAgentDefinition(session.agent);
  if (!agent?.buildResumeCommand) {
    return NextResponse.json(
      { error: `${agent?.label ?? session.agent} cannot resume a previous conversation.` },
      { status: 400 }
    );
  }

  // Deletion cascades: deleteItem removes every agent_sessions row for the
  // item in the same transaction (lib/items-repo.ts), so a session whose
  // item is gone is gone itself and getAgentSessionById already returned
  // undefined above. This check exists only so TypeScript -- and any future
  // caller that reaches this line by some other path -- cannot treat item as
  // defined when it is not.
  const item = getItemById(db, session.itemId);
  if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

  // Set on the same SessionStart event as agentSessionId, so in practice the
  // two arrive together. Nothing enforces that at the type level, and
  // resuming into the wrong directory -- or no directory -- is worse than
  // refusing outright: Claude Code keys a conversation's history off the
  // directory it ran in.
  if (!session.cwd) {
    return NextResponse.json(
      { error: 'This session never reported a working directory, so it cannot be resumed.' },
      { status: 400 }
    );
  }
  const workingDir = session.cwd;

  // Deliberately not the launch route's allowlist (workingDir must match a
  // configured local repo). Worktrees are observed here, not managed: an
  // agent legitimately working out of a worktree would never match a
  // configured repo path, and an allowlist would break exactly the case this
  // feature exists to support. The only property that matters for resume is
  // that the directory is real, so a bad hook-reported value surfaces as a
  // clean 400 instead of a 500 from Warp trying to `cd` into nothing.
  let cwdIsDirectory = false;
  try {
    cwdIsDirectory = statSync(workingDir).isDirectory();
  } catch {
    cwdIsDirectory = false;
  }
  if (!cwdIsDirectory) {
    return NextResponse.json(
      { error: "This session's working directory no longer exists on disk." },
      { status: 400 }
    );
  }

  const agentSessionId = session.agentSessionId;
  const resumeCommand = agent.buildResumeCommand;

  if (session.endedAt === null) {
    // Still live: rewrite this row's own tab config in place, reusing its
    // launch token and settings file. Hook events keep attributing to the
    // same row, so resuming does not fork Ariadne's record of one
    // conversation into two.
    try {
      // ensureHookSettingsFile reuses the file already on disk from the
      // original launch and only recreates it if something removed it --
      // nothing does today, but the path is deterministic from the token, so
      // regenerating is strictly better than resuming into a
      // `--settings <gone>` that fails inside Warp while this route still
      // answered 200. Inside the same try as the tab config write: a failure
      // here is exactly as much "Ariadne failed before Warp ever ran" as one
      // there, and must answer the same way.
      const settingsPath = agent.supportsHooks ? ensureHookSettingsFile(db, session.launchToken) : null;
      writeSessionTabConfig(
        {
          sessionId: session.id,
          title: session.tabTitle,
          color: session.tabColor,
          directory: workingDir,
          command: resumeCommand({ settingsPath }, agentSessionId),
        },
        agentTabConfigDir()
      );
    } catch (error) {
      // Nothing in the database changed -- this row was never touched -- so
      // there is no state to correct the way commitAgentSessionLaunch
      // corrects a freshly created row below. Just say so, loudly.
      logError('agent-launch', `could not rewrite the launch files for session ${session.id}`, error);
      return NextResponse.json({ error: 'Failed to write the Warp launch configuration.' }, { status: 500 });
    }
    return NextResponse.json({ warpUrl: sessionWarpUrl(session.id), session: toPublicAgentSession(session) });
  }

  // Ended: a new row for the same item, so the old one is left exactly as it
  // was -- it is history. getActiveAgentSessionForItem guards this from
  // bypassing the one-session-per-ticket rule: the old row cannot hold the
  // ticket any more (it already ended), but a different session launched
  // since could.
  const active = getActiveAgentSessionForItem(db, item.id);
  if (active) {
    return NextResponse.json({ error: 'Another session is already running for this ticket.' }, { status: 400 });
  }

  const launchToken = newLaunchToken();
  const newSession = createAgentSession(db, {
    itemId: item.id,
    agent: session.agent,
    launchToken,
    tabTitle: sessionTabTitle(item),
    tabColor: AGENT_TAB_COLOR,
  });

  try {
    commitAgentSessionLaunch(db, newSession, agent, workingDir, (options) =>
      resumeCommand(options, agentSessionId)
    );
  } catch {
    return NextResponse.json({ error: 'Failed to write the Warp launch configuration.' }, { status: 500 });
  }

  return NextResponse.json({ warpUrl: sessionWarpUrl(newSession.id), session: toPublicAgentSession(newSession) });
}
