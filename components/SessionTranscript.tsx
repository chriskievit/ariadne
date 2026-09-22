'use client';

import type { TranscriptEntry } from '@/lib/agent-transcript';

/**
 * The tail of one session's conversation, oldest first.
 *
 * `aria-live="off"` is load-bearing, not a default: this list is replaced
 * wholesale on every poll, and a live region wired to a log like that reads
 * the page aloud continuously. SessionPane owns the one live region this
 * pane has, and it announces state transitions only -- never this text.
 */
export default function SessionTranscript({ entries }: { entries: TranscriptEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">Nothing in the transcript yet.</p>;
  }

  return (
    <div aria-live="off" className="space-y-3">
      {entries.map((entry, index) => (
        <div key={`${entry.timestamp ?? 'unknown'}-${index}`} className="text-sm">
          <div className="flex items-baseline gap-2">
            <span className="font-medium">{entry.role === 'user' ? 'You' : 'Agent'}</span>
            {entry.timestamp && (
              <span className="font-mono text-xs tabular-nums text-muted-foreground">
                {formatTimestamp(entry.timestamp)}
              </span>
            )}
          </div>
          {/* pre-wrap so the agent's own line breaks survive; the transcript
              is prose it wrote, not a value Ariadne reflows. */}
          <p className="mt-0.5 whitespace-pre-wrap text-muted-foreground">{entry.text}</p>
        </div>
      ))}
    </div>
  );
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
