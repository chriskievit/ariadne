import { NextResponse } from 'next/server';
import { db } from '@/lib/db-instance';
import { getAgentSessionByToken, applyAgentSessionPatch } from '@/lib/agent-sessions-repo';
import { applyHookEvent, type HookEvent, type HookEventName } from '@/lib/agent-session-state';

const HANDLED_EVENTS = new Set<HookEventName>([
  'SessionStart',
  'PreToolUse',
  'PostToolUse',
  'Notification',
  'Stop',
  'SessionEnd',
]);

// Always 200, always an empty JSON object. Claude Code runs these hooks
// inline: a non-2xx, a hang, or a thrown error here surfaces in the user's
// session, and Ariadne having a bad day must never be the reason an agent
// stalls. Every failure path below is deliberately silent.
function ok(): NextResponse {
  return NextResponse.json({});
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const session = getAgentSessionByToken(db, token);
  if (!session) return ok();

  let event: HookEvent;
  try {
    event = (await request.json()) as HookEvent;
  } catch {
    return ok();
  }

  if (!event || !HANDLED_EVENTS.has(event.hook_event_name)) return ok();

  try {
    applyAgentSessionPatch(db, session.id, applyHookEvent(session, event, new Date()));
  } catch {
    return ok();
  }

  return ok();
}
