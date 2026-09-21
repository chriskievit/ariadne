'use client';

import { useState } from 'react';
import SessionRosterRow from './SessionRosterRow';
import type { SessionListEntry } from '@/lib/agent-session-list';

export default function SessionRosterRail({
  live,
  ended,
  selectedId,
  onSelect,
}: {
  live: SessionListEntry[];
  ended: SessionListEntry[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  const [endedOpen, setEndedOpen] = useState(false);

  return (
    <nav aria-label="Agent sessions" className="rounded-xl border border-border">
      {live.length === 0 ? (
        <p className="px-2 py-3 text-xs text-muted-foreground">Nothing running.</p>
      ) : (
        live.map((session) => (
          <SessionRosterRow
            key={session.id}
            session={session}
            selected={session.id === selectedId}
            onSelect={onSelect}
          />
        ))
      )}

      {ended.length > 0 && (
        <>
          {/* The fourth disclosure control, and it follows the house grammar
              in full: a state, an interpunct, the count in the instrument
              register, a toggle that goes both ways, and data-row-nav so
              j/k stops on it rather than stepping over the rows it hides.
              "Ended" rather than "Show more" because it names what the
              hidden rows are.

              Note that j/k itself is not yet bound on this surface --
              GlobalKeymapProvider mounts inside Dashboard, not the layout.
              The attribute is correct now regardless, and getting it right
              once is cheaper than auditing four controls later. */}
          <button
            type="button"
            data-row-nav
            aria-expanded={endedOpen}
            aria-controls="roster-ended"
            onClick={() => setEndedOpen((prev) => !prev)}
            className="flex w-full items-center border-t border-border px-2 pb-2 pt-2 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            Ended · <span className="ml-1 font-mono tabular-nums">{ended.length}</span>
          </button>
          {endedOpen && (
            <div id="roster-ended">
              {ended.map((session) => (
                <SessionRosterRow
                  key={session.id}
                  session={session}
                  selected={session.id === selectedId}
                  onSelect={onSelect}
                />
              ))}
            </div>
          )}
        </>
      )}
    </nav>
  );
}
