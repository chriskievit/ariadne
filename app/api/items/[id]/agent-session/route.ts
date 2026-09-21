import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db-instance';
import { getItemById, setStatus } from '@/lib/items-repo';
import { getPlanItems, reorderPlanItems } from '@/lib/plans-repo';
import { getSetting } from '@/lib/settings-repo';
import { localDateString } from '@/lib/date';
import { SETTINGS_KEYS, DEFAULT_AGENT_HOOK_BASE_URL } from '@/lib/config';
import { resolveWorkingDir, listLocalRepos } from '@/lib/warp';
import { createAgentSession, applyAgentSessionPatch, toPublicAgentSession } from '@/lib/agent-sessions-repo';
import { getAgentDefinition, DEFAULT_AGENT } from '@/lib/agents';
import { writeHookSettings } from '@/lib/agent-hooks-config';
import { sessionTabTitle, sessionWarpUrl, writeSessionTabConfig, AGENT_TAB_COLOR } from '@/lib/agent-launch';
import { agentTabConfigDir, agentSettingsDir } from '@/lib/agent-paths';
import type { AgentKind } from '@/lib/types';

function newLaunchToken(): string {
  return randomBytes(24).toString('base64url');
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await params;
  const id = Number(idParam);
  const item = getItemById(db, id);
  if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as { workingDir?: string; agent?: AgentKind };

  let workingDir: string | null;
  if (body.workingDir) {
    // Same rule as the Open in Claude route: the path is written unescaped
    // into a TOML file Warp executes from, so it must match a repo the
    // server already knows about rather than anything the client sends.
    const isKnownRepoPath = listLocalRepos(db).some((repo) => repo.path === body.workingDir);
    if (!isKnownRepoPath) {
      return NextResponse.json({ error: 'workingDir must match a configured local repo.' }, { status: 400 });
    }
    workingDir = body.workingDir;
  } else {
    workingDir = resolveWorkingDir(db, item);
  }

  if (!workingDir) {
    return NextResponse.json(
      { error: 'No working directory. Configure one in Settings or pick a folder.' },
      { status: 400 }
    );
  }

  const agentKind = body.agent ?? (getSetting(db, SETTINGS_KEYS.agentDefault) as AgentKind | null) ?? DEFAULT_AGENT;
  const agent = getAgentDefinition(agentKind);
  if (!agent) return NextResponse.json({ error: 'Unknown agent.' }, { status: 400 });

  const launchToken = newLaunchToken();
  const session = createAgentSession(db, {
    itemId: id,
    agent: agentKind,
    launchToken,
    tabTitle: sessionTabTitle(item),
    tabColor: AGENT_TAB_COLOR,
  });

  try {
    let settingsPath: string | null = null;
    if (agent.supportsHooks) {
      const baseUrl = getSetting(db, SETTINGS_KEYS.agentHookBaseUrl) ?? DEFAULT_AGENT_HOOK_BASE_URL;
      // The middleware rejects every request when ARIADNE_AUTH_TOKEN is set,
      // so the hook has to carry it. This writes the token into a file on
      // disk, the same trust model as the PATs in the settings table.
      settingsPath = writeHookSettings(
        agentSettingsDir(),
        launchToken,
        baseUrl,
        process.env.ARIADNE_AUTH_TOKEN ?? null
      );
    }

    writeSessionTabConfig(
      {
        sessionId: session.id,
        title: session.tabTitle,
        color: session.tabColor,
        directory: workingDir,
        command: agent.buildCommand({ settingsPath }),
      },
      agentTabConfigDir()
    );
  } catch {
    // Ariadne itself failed to write the launch files -- not the same thing
    // as an agent that never reported in. Task 9's reconciler marks any
    // session still 'launching' after its window as failed with
    // 'never_registered'; recording the real reason here now stops this row
    // from being blamed on the agent when it never had a chance to run.
    try {
      applyAgentSessionPatch(db, session.id, {
        state: 'failed',
        endedAt: new Date().toISOString(),
        endReason: 'launch_failed',
      });
    } catch {
      // The database write above is best-effort: if it also fails, the
      // session row is left misleading, but the 500 below must still reach
      // the client rather than being masked by a second thrown error.
    }
    return NextResponse.json({ error: 'Failed to write the Warp launch configuration.' }, { status: 500 });
  }

  // Handing a ticket to an agent is work beginning on it. Deliberately no
  // timer: startTimer() closes every other open log, and an agent working
  // while you do something else must not bill your hours.
  setStatus(db, id, 'in_progress');

  // Same rule as Start: if it is already on today's plan, this is the moment
  // it becomes what you are doing. It is never *added* to the plan here,
  // because Today and Signals are mutually exclusive and that would move it
  // out of Signals without being asked.
  const today = localDateString(new Date());
  const todayPlanItems = getPlanItems(db, today);
  if (todayPlanItems.some((pi) => pi.itemId === id)) {
    reorderPlanItems(db, today, [id, ...todayPlanItems.filter((pi) => pi.itemId !== id).map((pi) => pi.itemId)]);
  }

  // launchToken is the hook credential; a client rendering this response
  // never needs it, and phase 2 puts these responses in a browser where a
  // leaked token would matter a lot more than it does today.
  return NextResponse.json({ session: toPublicAgentSession(session), warpUrl: sessionWarpUrl(session.id) });
}
