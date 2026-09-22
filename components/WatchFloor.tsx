'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchAgentSessions } from '@/lib/api-client';
import { sortRoster, sortEndedRoster, rosterBandCounts, ROSTER_BAND_REASON, AGENT_POLL_INTERVAL_MS } from '@/lib/agent-roster';
import { agentStateDisplay } from '@/lib/agent-session-display';
import type { SessionListEntry } from '@/lib/agent-session-list';
import SessionRosterRail from './SessionRosterRail';
import SessionPane from './SessionPane';
import WorkFirstRunCard from './WorkFirstRunCard';

export default function WatchFloor({ initialSessions }: { initialSessions: SessionListEntry[] }) {
  const [sessions, setSessions] = useState<SessionListEntry[]>(initialSessions);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  // When the current run of failed polls began, or null while polling is
  // healthy. A timestamp rather than a boolean so a second and third failure
  // in a row do not each restart the clock on how long the view has been
  // stale -- not that anything reads the value yet beyond "is it set".
  const [staleSince, setStaleSince] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchAgentSessions();
      setSessions(data.sessions);
      setStaleSince(null);
    } catch {
      // The dev server restarting is the everyday cause of this, and polling
      // must keep going so the rail recovers on its own the moment it is
      // back -- a failed poll is exactly the situation that must not stop
      // future polls. Silent otherwise: the marker below is the whole
      // surface for this, per the phase's scope (no toast, no retry button).
      setStaleSince((since) => since ?? Date.now());
    }
  }, []);

  // Dismissal ends the session's record and takes its Warp tab config with
  // it, so its subject in the pane is now history. The row moves itself into
  // the Ended bucket on the next refresh; the selection is cleared in the
  // same breath so the pane does not keep showing a session that just left
  // the list it was selected from.
  const handleDismissed = useCallback(async () => {
    await refresh();
    setSelectedId(null);
  }, [refresh]);

  useEffect(() => {
    // A background tab polling every five seconds is a laptop fan for no
    // reason, and the state it would collect is thrown away unseen. Catch
    // up on the way back instead.
    function onVisible() {
      if (!document.hidden) void refresh();
    }
    const timer = setInterval(() => {
      if (!document.hidden) void refresh();
    }, AGENT_POLL_INTERVAL_MS);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  // The rail shows every session Ariadne knows is live, with no filter of
  // any kind. Parked, snoozed and triage-done are Planning's vocabulary; a
  // process that is actually running and hidden from the one view built to
  // show running processes is the worst thing a transparency tool can do.
  //
  // "Live" is endedAt, not state: a session marked failed because it never
  // registered deliberately keeps a null endedAt so a late SessionStart can
  // still revive it, and it has to stay on screen while that is possible.
  const live = sortRoster(sessions.filter((session) => session.endedAt === null));
  // Most-recently-ended first, not sortRoster's longest-waiting-first: see
  // compareEndedRoster for why the two lists sort in opposite directions.
  const ended = sortEndedRoster(sessions.filter((session) => session.endedAt !== null));
  const selected = sessions.find((session) => session.id === selectedId) ?? null;

  if (sessions.length === 0) {
    return (
      <main className="mx-auto max-w-6xl p-6">
        <WorkFirstRunCard />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl p-6">
      {staleSince !== null && (
        <p role="status" className="mb-4 text-xs text-warning">
          This isn&apos;t updating right now. Ariadne will catch up on its own once it can reach the server again.
        </p>
      )}
      <div className="flex flex-col gap-6 sm:grid sm:grid-cols-[18rem_minmax(0,1fr)] sm:items-start">
        <SessionRosterRail live={live} ended={ended} selectedId={selectedId} onSelect={setSelectedId} />

        <section role="region" aria-label="Session">
          {selected ? (
            // Keyed on the session id so switching the selection mounts a
            // fresh pane rather than rehydrating one across two different
            // subjects -- transcript, diff and in-flight dismiss/resume
            // state all start clean for whatever is now selected.
            <SessionPane key={selected.id} session={selected} onDismissed={handleDismissed} />
          ) : (
            <GlanceState live={live} />
          )}
        </section>
      </div>
    </main>
  );
}

/**
 * What the pane says when you have not picked a session.
 *
 * The counts, not a chart: the question this view answers on a glance is
 * "is anything waiting on me", and a band with a count of zero is not part
 * of the answer, so it is not shown.
 */
function GlanceState({ live }: { live: SessionListEntry[] }) {
  const bands = rosterBandCounts(live);

  if (bands.length === 0) {
    return (
      <div className="rounded-xl border border-border p-6">
        <h2 className="text-base font-semibold">Nothing running</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Every session Ariadne knows about has closed. The recent ones are still in the rail.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border p-6">
      <h2 className="text-base font-semibold">
        {live.length} session{live.length === 1 ? '' : 's'}
      </h2>
      <dl className="mt-4 space-y-2">
        {bands.map((band) => (
          <div key={band.state} className="flex items-baseline gap-3">
            <dt className="w-24 shrink-0 text-sm font-medium">{agentStateDisplay(band.state).label}</dt>
            <dd className="font-mono text-sm tabular-nums">{band.count}</dd>
            <dd className="text-xs text-muted-foreground">{ROSTER_BAND_REASON[band.state]}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-xs text-muted-foreground">Pick a session to see what it is doing.</p>
    </div>
  );
}
