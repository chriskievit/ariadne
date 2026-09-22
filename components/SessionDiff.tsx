'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
// Type-only: lib/agent-worktree reaches node:child_process through git-cli's
// value imports elsewhere in the module. A plain import of SessionDiff would
// drag that into the client bundle -- the exact trap SessionPane's own
// comment already names for lib/agent-transcript and lib/agents.
import type { SessionDiff as SessionDiffData } from '@/lib/agent-worktree';

/**
 * The body of the pane's Diff section: file list, then the patch behind a
 * disclosure. SessionPane keeps the `<section>`, the "Diff" heading and the
 * branch badge next to it -- the same split it already uses for Transcript,
 * where SessionTranscript owns its own content states (including "Nothing
 * in the transcript yet.") but never the heading above it. Diff follows
 * that precedent rather than inventing a second one: this component owns
 * every content state (loading, unavailable, empty, populated) exactly as
 * SessionTranscript owns its own, and the heading stays put so the branch
 * badge beside it keeps the fixed position that stops it moving the action
 * row above.
 */
export default function SessionDiff({ diff }: { diff: SessionDiffData | null }) {
  const [patchOpen, setPatchOpen] = useState(false);

  if (diff === null) {
    return <p className="text-sm text-muted-foreground">Loading the diff…</p>;
  }
  if (!diff.available) {
    return <p className="text-sm text-muted-foreground">{diff.reason}</p>;
  }

  const branchLabel = diff.branch ?? 'this branch';
  const baseShort = diff.base.slice(0, 7);

  if (diff.files.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        On <span className="font-mono">{branchLabel}</span>, compared with{' '}
        <span className="font-mono">{baseShort}</span>. No changes yet.
      </p>
    );
  }

  // Split once and reuse for both the count on the disclosure control and
  // the coloured render below -- a second split would just be the same
  // truncation-sized string parsed twice for no reason.
  const patchLines = diff.patch.length > 0 ? diff.patch.replace(/\n$/, '').split('\n') : [];
  const patchId = 'session-diff-patch';

  return (
    <div>
      {/* This is the fact the whole component exists to state plainly: a
          branch diff, not an attribution. Ariadne records no base commit at
          launch, so it cannot tell the agent's commits from commits you had
          already made on this branch -- "compared with <base>" is the frame
          that stays true either way, where "what the agent changed" would
          not be. */}
      <p className="mb-2 text-xs text-muted-foreground">
        On <span className="font-mono">{branchLabel}</span>, compared with{' '}
        <span className="font-mono">{baseShort}</span>
      </p>

      <ul className="space-y-1">
        {diff.files.map((file) => (
          <li key={file.path} className="flex items-center justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-mono text-xs">{file.path}</span>
            <span className="shrink-0 font-mono text-xs tabular-nums">
              {file.added === null && file.removed === null ? (
                // A binary file's counts are null, not zero -- git reports
                // "-" for it, and rendering 0/0 would claim nothing changed
                // when the truth is that git cannot say how much did.
                <span className="text-muted-foreground">binary</span>
              ) : (
                <>
                  <span className="text-success">+{file.added}</span>{' '}
                  <span className="text-destructive">-{file.removed}</span>
                </>
              )}
            </span>
          </li>
        ))}
      </ul>

      {diff.truncated && (
        <p className="mt-2 text-xs text-muted-foreground">
          This diff is larger than Ariadne reads at once, so the file list or patch above may be missing files or
          lines rather than showing all of them.
        </p>
      )}

      {/* Same disclosure grammar as the rail's Ended control and the board's
          Lower scoring / Didn't fit controls: a state label, an interpunct,
          the count in the mono/tabular register, aria-expanded that flips
          both ways, aria-controls naming the id below, and data-row-nav so
          j/k stops here. The count is patch lines, not file count -- the
          file list above already gives a per-file count, and this is what
          is actually behind the toggle. */}
      <button
        type="button"
        data-row-nav
        aria-expanded={patchOpen}
        aria-controls={patchId}
        onClick={() => setPatchOpen((prev) => !prev)}
        className="mt-3 flex w-full items-center pb-1 pt-2 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        Patch · <span className="ml-1 font-mono tabular-nums">{patchLines.length}</span>
      </button>
      {patchOpen && (
        <div id={patchId} className="mt-1 max-h-96 overflow-auto rounded-md border border-border bg-muted/30 p-3">
          <pre className="whitespace-pre font-mono text-xs">
            {patchLines.map((line, index) => (
              // Success and destructive here mark diff polarity (added vs.
              // removed), not urgency -- the one place in the app where
              // those two hues are not a Two-Band Rule attention claim.
              // "+++"/"---" (the file headers) are excluded so only real
              // content lines pick up the colour.
              <span
                key={index}
                className={cn(
                  line.startsWith('+') && !line.startsWith('+++') && 'text-success',
                  line.startsWith('-') && !line.startsWith('---') && 'text-destructive'
                )}
              >
                {line}
                {'\n'}
              </span>
            ))}
          </pre>
        </div>
      )}
    </div>
  );
}
