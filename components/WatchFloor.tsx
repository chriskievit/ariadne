'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchAgentSessions } from '@/lib/api-client';
import { sortRoster, rosterBandCounts, ROSTER_BAND_REASON } from '@/lib/agent-roster';
import { agentStateDisplay, sessionExplanation } from '@/lib/agent-session-display';
import type { SessionListEntry } from '@/lib/agent-session-list';
import SessionRosterRail from './SessionRosterRail';
import WorkFirstRunCard from './WorkFirstRunCard';

// Agent state moves in seconds, not minutes -- the dashboard's five-minute
// sync interval would make the rail feel broken. Cheap to poll: the endpoint
// reads one bounded table and, for open sessions only, the tail of a file.
const WORK_POLL_INTERVAL_MS = 5000;

export default function WatchFloor({ initialSessions }: { initialSessions: SessionListEntry[] }) {
  const [sessions, setSessions] = useState<SessionListEntry[]>(initialSessions);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    const data = await fetchAgentSessions();
    setSessions(data.sessions);
  }, []);

  useEffect(() => {
    // A background tab polling every five seconds is a laptop fan for no
    // reason, and the state it would collect is thrown away unseen. Catch
    // up on the way back instead.
    function onVisible() {
      if (!document.hidden) void refresh();
    }
    const timer = setInterval(() => {
      if (!document.hidden) void refresh();
    }, WORK_POLL_INTERVAL_MS);
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
  const ended = sortRoster(sessions.filter((session) => session.endedAt !== null));
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
      <div className="flex flex-col gap-6 sm:grid sm:grid-cols-[18rem_minmax(0,1fr)] sm:items-start">
        <SessionRosterRail live={live} ended={ended} selectedId={selectedId} onSelect={setSelectedId} />

        <section role="region" aria-label="Session">
          {selected ? <SelectedSession session={selected} /> : <GlanceState live={live} />}
        </section>
      </div>
    </main>
  );
}

/**
 * A placeholder for the session pane, which is the next phase's whole job.
 *
 * It carries the explanation sentence now rather than waiting, because the
 * one failure a person can actually act on -- an unanswered folder-trust
 * prompt in a Warp tab -- is unreadable from the word "Failed" alone.
 */
function SelectedSession({ session }: { session: SessionListEntry }) {
  const explanation = sessionExplanation(session);
  return (
    <div className="rounded-xl border border-border p-6">
      <h2 className="text-base font-semibold">{session.tabTitle}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{agentStateDisplay(session.state).label}</p>
      {explanation && <p className="mt-3 text-sm text-muted-foreground">{explanation}</p>}
      <p className="mt-4 text-xs text-muted-foreground">The session pane arrives in the next phase.</p>
    </div>
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
