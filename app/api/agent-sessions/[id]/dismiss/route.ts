import { NextResponse } from 'next/server';
import { db } from '@/lib/db-instance';
import { dismissAgentSession, toPublicAgentSession } from '@/lib/agent-sessions-repo';
import { removeSessionTabConfig } from '@/lib/agent-launch';
import { removeHookSettings } from '@/lib/agent-hooks-config';
import { agentSettingsDir } from '@/lib/agent-paths';
import { logWarn } from '@/lib/log';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await params;
  const session = dismissAgentSession(db, Number(idParam), new Date());
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

  // The tab config is the file Warp would run to start this agent again.
  // Once a session is dismissed it must not be re-openable by accident: the
  // config still carries the agent's command, so opening it would start a
  // second process. Best-effort, because failing to tidy a file is not a
  // reason to refuse the dismissal the user asked for.
  try {
    removeSessionTabConfig(session.id);
  } catch (error) {
    logWarn('agent-dismiss', `could not remove the tab config for session ${session.id}`, error);
  }

  // The settings file holds the launch token, and ARIADNE_AUTH_TOKEN when
  // set, in plaintext. Safe here specifically because dismissAgentSession
  // has already stamped endedAt above -- this session is never live by the
  // time this runs, so there is no risk of pulling the file out from under
  // an agent that is still reading it.
  try {
    removeHookSettings(agentSettingsDir(), session.launchToken);
  } catch (error) {
    logWarn('agent-dismiss', `could not remove the hook settings for session ${session.id}`, error);
  }

  return NextResponse.json({ session: toPublicAgentSession(session) });
}
