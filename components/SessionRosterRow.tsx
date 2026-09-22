'use client';

import { AlertTriangle, CircleDashed, CircleSlash, FileDiff, Hand, Loader, RadioTower } from 'lucide-react';
import { cn } from '@/lib/utils';
import { agentStateDisplay, sessionFidelity, type AgentGlyph } from '@/lib/agent-session-display';
import type { SessionListEntry } from '@/lib/agent-session-list';

// The glyph table lives here rather than in lib/ so the vocabulary module
// stays importable from a node-environment test. Every state has its own
// glyph, which is what makes the rail legible with the colour taken away.
const GLYPHS: Record<AgentGlyph, typeof Hand> = {
  hand: Hand,
  'alert-triangle': AlertTriangle,
  'file-diff': FileDiff,
  loader: Loader,
  'circle-dashed': CircleDashed,
  'circle-slash': CircleSlash,
};

// Only the two states that demand something of you are filled. The other
// four take the neutral treatment, exactly as the urgency bands do -- see
// the Two-Band Rule in DESIGN.md. Nothing here is Threadline Gold: a
// delegated session is not the thread you are holding, which is the same
// line Ariadne draws when it refuses to start a timer for an agent.
const TONE_CLASS = {
  warning: 'text-warning',
  destructive: 'text-destructive',
  neutral: 'text-muted-foreground',
} as const;

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
  const Glyph = GLYPHS[display.glyph];
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
          TONE_CLASS[display.tone],
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
