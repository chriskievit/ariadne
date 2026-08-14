'use client';

import { useId } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { getPriorityTier, MAX_SCORE, type PriorityTier, type ScoreBreakdownEntry } from '@/lib/scoring';

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

const TIER_LABEL: Record<PriorityTier, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

interface Props {
  score: number;
  scoreBreakdown: ScoreBreakdownEntry[];
  notFired: string[];
  keptVisible: boolean;
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
  open,
  onOpenChange,
  onOpenScoringReference,
  children,
}: Props) {
  const tier = getPriorityTier(score);
  const titleId = useId();

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex h-5 min-w-[1.5rem] shrink-0 items-center justify-center rounded px-1 font-mono text-[11px] font-semibold tabular-nums',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
            TIER_CHIP_CLASS[tier]
          )}
          aria-label={`Urgency ${score} of ${MAX_SCORE}, show breakdown`}
          onKeyDown={(e) => {
            if (e.key.toLowerCase() === 'x') {
              e.preventDefault();
              onOpenChange(true);
            }
          }}
        >
          {score}
        </button>
      </PopoverTrigger>
      <PopoverContent role="dialog" aria-labelledby={titleId} className="w-72">
        <div className="space-y-2 text-sm">
          <h2 id={titleId} className="font-medium">
            Why {score}?
          </h2>
          <div className="space-y-1 border-t pt-2">
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
