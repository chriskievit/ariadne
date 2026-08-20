'use client';

import { useId } from 'react';
import { Check, Minus } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { getPriorityTier, MAX_SCORE, TIER_LABEL, type PriorityTier, type ScoreBreakdownEntry } from '@/lib/scoring';
import type { SettledOutcome } from '@/lib/settled';

// Urgency bands per docs/wireframes/phase-0-foundation.html: only the top two
// bands are filled, medium is an outline, low has no border at all -- visual
// weight falls off in the same direction the score does. The two filled
// bands use dark ink, never white (see the paired *-foreground tokens).
// Indigo never appears here; that channel is interactive-only.
const TIER_CHIP_CLASS: Record<PriorityTier, string> = {
  low: 'border border-urgency-low/40 bg-transparent text-muted-foreground',
  medium: 'border-2 border-urgency-medium bg-transparent text-foreground',
  high: 'border-transparent bg-urgency-high text-urgency-high-foreground',
  critical: 'border-transparent bg-urgency-critical text-urgency-critical-foreground',
};

// A settled item's urgency band is history: the source system already closed
// it, so the chip stops reporting a live reading and reports the outcome
// instead. 'finished' is the one case the design system reserves Success Green
// for -- "done, needs no action". 'gone' left your plate unfinished, so it gets
// the neutral treatment rather than an affirmative green tick.
const SETTLED_CHIP_CLASS: Record<SettledOutcome, string> = {
  finished: 'border-transparent bg-success text-success-foreground',
  gone: 'border border-urgency-low/40 bg-transparent text-muted-foreground',
};

const SETTLED_ICON: Record<SettledOutcome, typeof Check> = {
  finished: Check,
  gone: Minus,
};

const SETTLED_CHIP_LABEL: Record<SettledOutcome, string> = {
  finished: 'Done at the source',
  gone: 'Gone from the source',
};

// Leads the popover so the number underneath reads as history rather than a
// live reading. The score stays fully inspectable either way -- a score that
// exists must be explainable (PRODUCT.md), and this one still drives the row's
// position in its group.
const SETTLED_EXPLANATION: Record<SettledOutcome, string> = {
  finished: 'Finished where it lives. Ariadne is read-only, so it still needs completing here.',
  gone: 'No longer yours where it lives. Ariadne is read-only, so it still needs clearing here.',
};

interface Props {
  score: number;
  scoreBreakdown: ScoreBreakdownEntry[];
  notFired: string[];
  keptVisible: boolean;
  settled?: SettledOutcome | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenScoringReference: () => void;
  children?: React.ReactNode;
}

export default function ScoreChip({
  score,
  scoreBreakdown,
  notFired,
  keptVisible,
  settled,
  open,
  onOpenChange,
  onOpenScoringReference,
  children,
}: Props) {
  const tier = getPriorityTier(score);
  const titleId = useId();
  const SettledIcon = settled ? SETTLED_ICON[settled] : null;

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex h-5 min-w-[1.5rem] shrink-0 items-center justify-center rounded px-1 font-mono text-[11px] font-semibold tabular-nums',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
            settled ? SETTLED_CHIP_CLASS[settled] : TIER_CHIP_CLASS[tier]
          )}
          aria-label={
            settled
              ? `${SETTLED_CHIP_LABEL[settled]}, urgency ${score} of ${MAX_SCORE}, show breakdown`
              : `Urgency ${score} of ${MAX_SCORE}, show breakdown`
          }
          onKeyDown={(e) => {
            if (e.key.toLowerCase() === 'x') {
              e.preventDefault();
              onOpenChange(true);
            }
          }}
        >
          {SettledIcon ? <SettledIcon className="h-3 w-3" aria-hidden="true" /> : score}
        </button>
      </PopoverTrigger>
      <PopoverContent role="dialog" aria-labelledby={titleId} className="w-72">
        <div className="space-y-2 text-sm">
          <h2 id={titleId} className="font-medium">
            {settled ? SETTLED_CHIP_LABEL[settled] : `Why ${score}?`}
          </h2>
          {settled && <p className="text-xs text-muted-foreground">{SETTLED_EXPLANATION[settled]}</p>}
          {settled && <p className="border-t pt-2 text-xs text-muted-foreground">It still scores {score}:</p>}
          <div className={cn('space-y-1 pt-2', !settled && 'border-t')}>
            {scoreBreakdown.map((entry, i) => (
              <div key={i} className="flex items-center justify-between gap-3">
                <span>{entry.label}</span>
                <span className="font-mono tabular-nums">+{entry.points}</span>
              </div>
            ))}
          </div>
          {notFired.length > 0 && (
            <div className="space-y-1 border-t pt-2 text-muted-foreground">
              {notFired.map((label) => (
                <div key={label} className="flex items-center justify-between gap-3">
                  <span>{label}</span>
                  <span aria-hidden="true">—</span>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between gap-3 border-t pt-2 font-medium">
            <span>Total</span>
            <span className="font-mono tabular-nums">{score}</span>
          </div>
          <p className="border-t pt-2 text-xs text-muted-foreground">
            {TIER_LABEL[tier]} band. Ties break by oldest activity first.
            {keptVisible && ' Kept visible: ad-hoc items skip the needs-attention score threshold.'}
          </p>
          <button
            type="button"
            className="text-xs text-primary underline-offset-2 hover:underline"
            onClick={() => {
              onOpenChange(false);
              onOpenScoringReference();
            }}
          >
            How urgency is scored →
          </button>
        </div>
        {children}
      </PopoverContent>
    </Popover>
  );
}
