'use client';

import { Pin, RadioTower } from 'lucide-react';
import { cn } from '@/lib/utils';
import { agentStateDisplay, sessionFidelity } from '@/lib/agent-session-display';
import { AGENT_STATE_GLYPHS, AGENT_TONE_CLASS } from '@/components/AgentStateGlyph';
import type { SessionListEntry } from '@/lib/agent-session-list';

// Nothing here is Threadline Gold: a delegated session is not the thread you
// are holding, which is the same line Ariadne draws when it refuses to start
// a timer for an agent.

export default function SessionRosterRow({
  session,
  selected,
  onSelect,
}: {
  session: SessionListEntry;
  selected: boolean;
  onSelect: (id: number) => void;
}) {
  const display = agentStateDisplay(session.state);
  const Glyph = AGENT_STATE_GLYPHS[display.glyph];
  const openOnly = sessionFidelity(session.agent) === 'opened_only';

  return (
    <button
      type="button"
      data-row-id={session.id}
      aria-current={selected ? 'true' : undefined}
      onClick={() => onSelect(session.id)}
      className={cn(
        'flex w-full items-start gap-2 border-b border-border px-2 py-2 text-left last:border-b-0',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset',
        selected ? 'bg-accent' : 'hover:bg-accent/50'
      )}
    >
      <Glyph
        className={cn(
          'mt-0.5 h-4 w-4 shrink-0',
          AGENT_TONE_CLASS[display.tone],
          // The only motion in the rail, and only for a session that is both
          // reporting 'working' and still live. Dismissal deliberately
          // leaves state alone -- see dismissAgentSession -- so a dismissed
          // session can sit in the Ended bucket still labelled "Working";
          // the endedAt check is what stops it from spinning there too.
          session.state === 'working' && session.endedAt === null && 'motion-safe:animate-spin'
        )}
        aria-hidden="true"
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm">{session.tabTitle}</span>
        <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          {/* The word, always. Colour is the third channel here, never the
              only one. */}
          <span>{display.label}</span>
          {session.onToday && (
            <>
              <span aria-hidden="true">·</span>
              {/* Same glyph Planning's pin/unpin-from-today control uses
                  (ItemRow.tsx), so this borrows Today's existing word and
                  icon rather than inventing a second signal. Left at the
                  row's own muted tone on purpose: Threadline Gold marks the
                  thread you are holding, and a delegated session -- however
                  live -- never is one (see the file header, DESIGN.md's
                  One Thread Rule). The mark says the *item* is on today's
                  plan, not that this session gets gold. */}
              <Pin className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span>Today</span>
            </>
          )}
          {openOnly && (
            <>
              <span aria-hidden="true">·</span>
              {/* An agent that cannot report is shown as a lower tier rather
                  than reported as if it were a silent healthy session. */}
              <RadioTower className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span>no reporting</span>
            </>
          )}
        </span>
      </span>
    </button>
  );
}
