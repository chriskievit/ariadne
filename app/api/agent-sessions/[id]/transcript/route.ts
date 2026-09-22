import { NextResponse } from 'next/server';
import { db } from '@/lib/db-instance';
import { getAgentSessionById } from '@/lib/agent-sessions-repo';
import { readTranscriptTail, PANE_TAIL_LIMIT } from '@/lib/agent-transcript';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await params;
  const session = getAgentSessionById(db, Number(idParam));
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

  return NextResponse.json({
    entries: session.transcriptPath ? readTranscriptTail(session.transcriptPath, PANE_TAIL_LIMIT) : [],
  });
}
