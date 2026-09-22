import { NextResponse } from 'next/server';
import { db } from '@/lib/db-instance';
import { deleteItem, ItemHasLoggedTimeError } from '@/lib/items-repo';
import { getAgentSessionsForItem } from '@/lib/agent-sessions-repo';
import { removeSessionTabConfig } from '@/lib/agent-launch';
import { removeHookSettings } from '@/lib/agent-hooks-config';
import { agentSettingsDir } from '@/lib/agent-paths';
import { logWarn } from '@/lib/log';

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await params;
  const id = Number(idParam);

  // Snapshotted before the delete: deleteItem cascades every agent_sessions
  // row for this item away in the same transaction, and there is nothing
  // left to read a launch token or a state off of once that has run.
  const sessions = getAgentSessionsForItem(db, id);

  try {
    deleteItem(db, id);
  } catch (error) {
    // Logged time is history the time report is built on, so this is a
    // refusal the caller should show, not a server fault. Nothing on disk
    // is touched below this point, because the item was not actually
    // deleted.
    if (error instanceof ItemHasLoggedTimeError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  // Deleting the item ends Ariadne's tracking of any agent session it ever
  // handed to one, the same way dismissing a session does -- the tab config
  // is the file Warp would run to start that agent again, and leaving it
  // behind would let it be reopened into a second process reporting under a
  // token that (now) maps to no row. Best-effort and logged, because a file
  // that will not tidy away is not a reason to undo the delete the user
  // asked for.
  for (const session of sessions) {
    try {
      removeSessionTabConfig(session.id);
    } catch (error) {
      logWarn('items-delete', `could not remove the tab config for session ${session.id}`, error);
    }

    // The settings file holds the launch token, and ARIADNE_AUTH_TOKEN when
    // set, in plaintext. Only removed for a session that had already ended
    // before this delete -- a session still live when its item was deleted
    // may have an agent still reading this file to fire its remaining
    // hooks, and Ariadne has no process handle to know when that stops
    // being true, so it is left in place for that one case.
    if (session.endedAt !== null) {
      try {
        removeHookSettings(agentSettingsDir(), session.launchToken);
      } catch (error) {
        logWarn('items-delete', `could not remove the hook settings for session ${session.id}`, error);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
