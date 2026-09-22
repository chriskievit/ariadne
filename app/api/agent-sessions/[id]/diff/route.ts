import { NextResponse } from 'next/server';
import { db } from '@/lib/db-instance';
import { getAgentSessionById } from '@/lib/agent-sessions-repo';
import { readSessionDiff } from '@/lib/agent-worktree';

// A session that cannot show a diff is not an error. Every reason the pane
// might have nothing to render comes back as a 200 carrying the sentence to
// display, so the client has one shape to handle instead of a status matrix.
// The one real error is a session id that does not exist.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await params;
  const session = getAgentSessionById(db, Number(idParam));
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

  if (!session.cwd) {
    return NextResponse.json({
      available: false,
      reason: 'This session has not reported a working directory yet.',
    });
  }

  return NextResponse.json(await readSessionDiff(session.cwd));
}
