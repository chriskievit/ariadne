'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CircleDashed, CircleSlash, FileDiff, Hand, Loader } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/components/ui/sonner';
import { agentStateDisplay, sessionExplanation, type AgentGlyph } from '@/lib/agent-session-display';
import { getAgentDefinition } from '@/lib/agents';
import { AGENT_POLL_INTERVAL_MS } from '@/lib/agent-roster';
import type { SessionListEntry } from '@/lib/agent-session-list';
// Type-only: both modules reach node built-ins by value elsewhere in their
// files (agent-transcript's fs reads, agent-worktree's git-cli spawns), so
// importing anything but the type would drag that into the client bundle --
// the exact trap that already bit lib/agents.ts once in phase 2.
import type { TranscriptEntry } from '@/lib/agent-transcript';
import type { SessionDiff } from '@/lib/agent-worktree';
import { fetchSessionTranscript, fetchSessionDiff, dismissSession, resumeSession } from '@/lib/api-client';
import SessionTranscript from './SessionTranscript';

// Same six states as the rail's row, duplicated rather than imported for the
// reason SessionRosterRow gives: the vocabulary module stays importable from
// a node-environment test, and each surface that draws it keeps its own
// table next to the JSX.
const GLYPHS: Record<AgentGlyph, typeof Hand> = {
  hand: Hand,
  'alert-triangle': AlertTriangle,
  'file-diff': FileDiff,
  loader: Loader,
  'circle-dashed': CircleDashed,
  'circle-slash': CircleSlash,
};

const TONE_CLASS = {
  warning: 'text-warning',
  destructive: 'text-destructive',
  neutral: 'text-muted-foreground',
} as const;

// Ariadne never picks the Warp tab colour itself -- see AGENT_TAB_COLOR in
// lib/agent-launch.ts, which is server-only (it touches node:fs) and so
// cannot be imported here. This is the same eight-name Warp palette, kept in
// sync by hand because it changes only if Warp's own palette does.
const WARP_SWATCH: Record<string, string> = {
  black: '#000000',
  red: '#e5484d',
  green: '#30a46c',
  yellow: '#f5b60a',
  blue: '#0091ff',
  magenta: '#e93d82',
  cyan: '#00a2c7',
  white: '#e6e6e6',
};

export default function SessionPane({
  session,
  onDismissed,
}: {
  session: SessionListEntry;
  onDismissed: () => void;
}) {
  const [entries, setEntries] = useState<TranscriptEntry[]>([]);
  const [diff, setDiff] = useState<SessionDiff | null>(null);
  const [staleSince, setStaleSince] = useState<number | null>(null);

  const [dismissOpen, setDismissOpen] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const [resuming, setResuming] = useState(false);

  const display = agentStateDisplay(session.state);
  const Glyph = GLYPHS[display.glyph];
  const explanation = sessionExplanation(session);
  const canResume =
    getAgentDefinition(session.agent)?.buildResumeCommand !== undefined && session.agentSessionId !== null;

  // The transcript and diff are per-session network calls, unlike the rest of
  // the pane which reads straight off the `session` prop the rail already
  // polled. Ended once, live on the rail's own 5s cadence (imported rather
  // than re-guessed, so the two halves of this screen cannot drift apart) --
  // a stopped session's output and diff cannot change, so polling one forever
  // would just be load with no new information behind it.
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [transcript, diffResult] = await Promise.all([
          fetchSessionTranscript(session.id),
          fetchSessionDiff(session.id),
        ]);
        if (cancelled) return;
        setEntries(transcript.entries);
        setDiff(diffResult);
        setStaleSince(null);
      } catch {
        // Keep whatever was last shown -- a session pane that blanks itself
        // out because one poll failed is worse than one showing output that
        // is a few seconds behind. Matches WatchFloor's own failed-poll
        // handling: stay silent beyond the marker, keep trying.
        if (!cancelled) setStaleSince((since) => since ?? Date.now());
      }
    }

    void load();
    if (session.endedAt !== null) return () => { cancelled = true; };

    function onVisible() {
      if (!document.hidden) void load();
    }
    const timer = setInterval(() => {
      if (!document.hidden) void load();
    }, AGENT_POLL_INTERVAL_MS);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [session.id, session.endedAt]);

  // The live region speaks state transitions only, never the transcript.
  // Comparing against a ref rather than putting session.state straight into
  // the region's text keeps a same-state re-render (a poll that changed
  // nothing else about the state) from re-announcing a sentence a screen
  // reader already read.
  const [announcement, setAnnouncement] = useState(() => display.label);
  const lastAnnouncedState = useRef(session.state);
  useEffect(() => {
    if (session.state !== lastAnnouncedState.current) {
      lastAnnouncedState.current = session.state;
      setAnnouncement(agentStateDisplay(session.state).label);
    }
  }, [session.state]);

  async function handleResume() {
    setResuming(true);
    try {
      const result = await resumeSession(session.id);
      if (result.warpUrl) {
        window.location.href = result.warpUrl;
      } else {
        toast(result.error ?? 'Could not resume this session.');
      }
    } catch {
      toast('Could not resume this session.');
    } finally {
      setResuming(false);
    }
  }

  async function handleDismiss() {
    setDismissing(true);
    try {
      await dismissSession(session.id);
      setDismissOpen(false);
      onDismissed();
    } catch {
      toast('Could not dismiss this session.');
    } finally {
      setDismissing(false);
    }
  }

  return (
    <div className="rounded-xl border border-border p-6">
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-base font-semibold">{session.tabTitle}</h2>
        <span className={cn('flex items-center gap-1.5 text-sm', TONE_CLASS[display.tone])}>
          <Glyph
            className={cn('h-4 w-4', session.state === 'working' && 'motion-safe:animate-spin')}
            aria-hidden="true"
          />
          {display.label}
        </span>
        {/* Only the diff response ever supplies a branch -- git_branch on the
            row is always null (see lib/agent-worktree.ts) because the hook
            payload never carries one. Rendering session.gitBranch here would
            silently show nothing forever. */}
        {diff !== null && diff.available && diff.branch && (
          <Badge variant="outline" className="font-mono text-xs font-normal">
            {diff.branch}
          </Badge>
        )}
      </header>

      {/* Fixed position: always the second thing on the pane, directly under
          a header that only ever grows once (the branch badge, when the
          first diff response lands). Everything below here -- the
          explanation sentence, the needs-you question -- can appear or
          disappear as a hook event lands mid-visit, and none of it may sit
          above this row: that is exactly the layout shift that turns a
          click aimed at Dismiss into a click on a button that appeared a
          moment before. */}
      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2">
        {canResume && (
          <Button type="button" size="sm" onClick={handleResume} disabled={resuming}>
            {resuming ? 'Resuming…' : 'Resume in a new tab'}
          </Button>
        )}
        <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: WARP_SWATCH[session.tabColor] ?? undefined }}
            aria-hidden="true"
          />
          <span className="truncate">{session.tabTitle}</span>
          <span>· switch to Warp by hand to see it</span>
        </div>
        {/* ml-auto, not row order, is what pins this to the row's trailing
            edge: the Resume button before it can appear or vanish and this
            button's own box never moves as a result. Warp has no API to
            focus an existing tab (the phase 1 spike), and dismissal deletes
            the tab config precisely so this session cannot be reopened into
            a second agent -- so there is no Reveal button here, only this. */}
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="ml-auto shrink-0"
          onClick={() => setDismissOpen(true)}
        >
          Dismiss
        </Button>
      </div>

      {explanation && <p className="mt-4 text-sm text-muted-foreground">{explanation}</p>}

      {session.state === 'needs_you' && session.needsYouMessage && (
        <div className="mt-4 rounded-lg border border-warning/40 bg-warning/10 p-4">
          <p className="text-base font-medium text-foreground">{session.needsYouMessage}</p>
        </div>
      )}

      {staleSince !== null && (
        <p role="status" className="mt-4 text-xs text-warning">
          This isn&apos;t updating right now. Ariadne will catch up on its own once it can reach the server again.
        </p>
      )}

      <section className="mt-6">
        <h3 className="mb-1.5 text-sm font-semibold text-muted-foreground">Diff</h3>
        <DiffSummary diff={diff} />
      </section>

      <section className="mt-6">
        <h3 className="mb-1.5 text-sm font-semibold text-muted-foreground">Transcript</h3>
        <SessionTranscript entries={entries} />
      </section>

      {/* The one live region this pane owns. Visually hidden, and it speaks
          only the state word -- never the transcript above, which stays
          aria-live="off" for exactly this reason. */}
      <span className="sr-only" role="status" aria-live="polite">
        {announcement}
      </span>

      <Dialog open={dismissOpen} onOpenChange={(open) => !dismissing && setDismissOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dismiss this session?</DialogTitle>
            <DialogDescription>
              Stop tracking this session. The agent keeps running until you stop it in Warp.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDismissOpen(false)} disabled={dismissing}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={handleDismiss} disabled={dismissing}>
              {dismissing ? 'Dismissing…' : 'Dismiss'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * The branch's stand-off from the default branch, summarised.
 *
 * Not Task 8's diff view -- this is the minimum the pane needs to not be
 * empty where a diff belongs, kept private to this file so a dedicated
 * component can replace it without a name collision.
 */
function DiffSummary({ diff }: { diff: SessionDiff | null }) {
  if (diff === null) {
    return <p className="text-sm text-muted-foreground">Loading the diff…</p>;
  }
  if (!diff.available) {
    return <p className="text-sm text-muted-foreground">{diff.reason}</p>;
  }
  if (diff.files.length === 0) {
    return <p className="text-sm text-muted-foreground">No changes on this branch yet.</p>;
  }

  return (
    <ul className="space-y-1">
      {diff.files.map((file) => (
        <li key={file.path} className="flex items-center justify-between gap-3 text-sm">
          <span className="min-w-0 truncate font-mono text-xs">{file.path}</span>
          <span className="shrink-0 font-mono text-xs tabular-nums">
            {file.added === null && file.removed === null ? (
              <span className="text-muted-foreground">binary</span>
            ) : (
              <>
                <span className="text-success">+{file.added}</span> <span className="text-destructive">-{file.removed}</span>
              </>
            )}
          </span>
        </li>
      ))}
      {diff.truncated && <li className="text-xs text-muted-foreground">Showing a truncated diff.</li>}
    </ul>
  );
}
