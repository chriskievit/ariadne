import { NextResponse } from 'next/server';
import { db } from '@/lib/db-instance';
import { getAgentSessionById } from '@/lib/agent-sessions-repo';
import { readTranscriptTail } from '@/lib/agent-transcript';

// The rail ships five turns per session because it polls every one of them.
// The pane is one session a person is reading, so it can afford a stretch
// long enough to follow what happened.
export const PANE_TAIL_LIMIT = 50;

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await params;
  const session = getAgentSessionById(db, Number(idParam));
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

  return NextResponse.json({
    entries: session.transcriptPath ? readTranscriptTail(session.transcriptPath, PANE_TAIL_LIMIT) : [],
  });
}
