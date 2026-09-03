'use client';

import { useEffect, useState, type KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import ScoreChip from './ScoreChip';
import SegmentedChoice, { type SegmentedOption } from './SegmentedChoice';
import { cn } from '@/lib/utils';
import { formatMinutes } from '@/lib/format-duration';
import { isTypingTarget } from '@/lib/keymap';
import {
  LEAN_WORK_ITEM_SHARE,
  type DurationSource,
  type LeanNotch,
  type PickReason,
  type SuggestAlgorithm,
  type Suggestion,
  type SuggestionItem,
} from '@/lib/suggest';

const ALGORITHM_OPTIONS: SegmentedOption<SuggestAlgorithm>[] = [
  { value: 'urgency', label: 'Urgency first' },
  { value: 'quick_wins', label: 'Quick wins' },
  { value: 'balanced', label: 'Balanced' },
];

const LEAN_NOTCHES: LeanNotch[] = [0, 1, 2, 3, 4];

const LEAN_OPTIONS: SegmentedOption<LeanNotch>[] = LEAN_NOTCHES.map((notch) => ({
  value: notch,
  label: `${Math.round(LEAN_WORK_ITEM_SHARE[notch] * 100)}`,
}));

const PICK_REASON_LABEL: Record<PickReason, string> = {
  anchor: 'anchor, top item over an hour',
  top_urgency: 'highest urgency that fits',
  best_value: 'best value per minute',
  fills_room: 'fills the remaining room',
};

// Only a number the user set is stated plainly. Everything else is marked, so
// a guess can never read as a commitment.
const DURATION_PROVENANCE: Record<DurationSource, string> = {
  plan_estimate: 'you set this',
  prior_estimate: 'you set this earlier',
  logged_median: 'typically, from your logs',
  fallback: 'rough default',
};

function isDerived(source: DurationSource): boolean {
  return source === 'logged_median' || source === 'fallback';
}

const EMPTY_NOTE_COPY = {
  signals_empty: 'Nothing to suggest. Signals is empty.',
  all_pinned: "Everything on the list is already in today's plan.",
} as const;

interface Props {
  suggestion: Suggestion | null;
  itemsById: Map<number, SuggestionItem>;
  loading: boolean;
  error: boolean;
  algorithm: SuggestAlgorithm;
  lean: LeanNotch;
  onAlgorithmChange: (value: SuggestAlgorithm) => void;
  onLeanChange: (value: LeanNotch) => void;
  onRetry: () => void;
  onPin: (itemIds: number[]) => void | Promise<void>;
  onDismiss: () => void;
  onOpenScoringReference: () => void;
}

export default function SuggestPanel({
  suggestion,
  itemsById,
  loading,
  error,
  algorithm,
  lean,
  onAlgorithmChange,
  onLeanChange,
  onRetry,
  onPin,
  onDismiss,
  onOpenScoringReference,
}: Props) {
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [openDisclosure, setOpenDisclosure] = useState<'did_not_fit' | 'deferred' | null>(null);
  const [openChipId, setOpenChipId] = useState<number | null>(null);

  // A fresh proposal arrives fully checked: the fastest path through a good
  // suggestion is one keystroke, and unchecking is cheaper than checking four
  // rows by hand. Nothing is written until Pin is pressed either way.
  useEffect(() => {
    setChecked(new Set(suggestion?.picks.map((pick) => pick.itemId) ?? []));
  }, [suggestion]);

  if (error) {
    return (
      <div className="space-y-3 py-6 text-sm">
        <p>Could not build a suggestion. Try again, or pick from All signals.</p>
        <Button type="button" size="sm" variant="outline" onClick={onRetry}>
          Try again
        </Button>
      </div>
    );
  }

  if (!suggestion) {
    return <p className="py-6 text-sm text-muted-foreground">Working out a suggestion.</p>;
  }

  if (suggestion.note === 'signals_empty' || suggestion.note === 'all_pinned') {
    return <p className="py-6 text-sm text-muted-foreground">{EMPTY_NOTE_COPY[suggestion.note]}</p>;
  }

  const checkedPicks = suggestion.picks.filter((pick) => checked.has(pick.itemId));
  const checkedMinutes = checkedPicks.reduce((sum, pick) => sum + pick.durationMinutes, 0);
  const overCapacity = checkedMinutes > suggestion.capacityMinutes;
  const fillPct = suggestion.capacityMinutes
    ? Math.min(100, Math.round((checkedMinutes / suggestion.capacityMinutes) * 100))
    : 0;
  const anyDerived = checkedPicks.some((pick) => isDerived(pick.durationSource));
  const workItemPct = Math.round(LEAN_WORK_ITEM_SHARE[lean] * 100);

  function toggle(itemId: number) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  // 1/2/3 pick an algorithm and Enter accepts, so a suggestion can be taken
  // without reaching for the mouse. Keyboard-first is a durable principle
  // here, not a roadmap item. Space on a row is the native checkbox
  // behaviour and the arrow keys belong to SegmentedChoice, so neither is
  // handled again here.
  function onPanelKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (isTypingTarget(e.target)) return;
    const index = ['1', '2', '3'].indexOf(e.key);
    if (index !== -1) {
      e.preventDefault();
      onAlgorithmChange(ALGORITHM_OPTIONS[index].value);
      return;
    }
    // Enter on a control is that control's own business; only a bare Enter
    // in the panel means accept.
    if (e.key === 'Enter' && !(e.target as HTMLElement).closest('button, input, label')) {
      e.preventDefault();
      if (checkedPicks.length > 0) void onPin(checkedPicks.map((pick) => pick.itemId));
    }
  }

  function renderExcluded(kind: 'did_not_fit' | 'deferred') {
    const rows = kind === 'did_not_fit' ? suggestion!.didNotFit : suggestion!.deferredByLean;
    if (rows.length === 0) return null;
    const label = kind === 'did_not_fit' ? "Didn't fit" : 'Deferred by your lean';
    const id = `suggest-excluded-${kind}`;
    const expanded = openDisclosure === kind;
    return (
      <div>
        <button
          type="button"
          data-row-nav
          aria-expanded={expanded}
          aria-controls={id}
          onClick={() => setOpenDisclosure(expanded ? null : kind)}
          className="w-full pb-1 pt-3 text-left text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          {label} <span className="font-mono tabular-nums">· {rows.length}</span>
        </button>
        <div id={id} hidden={!expanded} className="space-y-1">
          {rows.map((row) => {
            const item = itemsById.get(row.itemId);
            if (!item) return null;
            return (
              <div key={row.itemId} className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 truncate text-muted-foreground">{item.title}</span>
                <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                  {isDerived(row.durationSource) ? '~' : ''}
                  {formatMinutes(row.durationMinutes)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3" onKeyDown={onPanelKeyDown}>
      <div className="shrink-0 space-y-2">
        <SegmentedChoice
          options={ALGORITHM_OPTIONS}
          value={algorithm}
          onChange={(value) => value && onAlgorithmChange(value)}
          ariaLabel="Suggestion algorithm"
          fill
          className="w-full"
        />
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-xs text-muted-foreground">PRs</span>
          <SegmentedChoice
            options={LEAN_OPTIONS}
            value={lean}
            onChange={(value) => value !== null && onLeanChange(value)}
            ariaLabel="Lean toward pull requests or work items"
          />
          <span className="shrink-0 text-xs text-muted-foreground">work items</span>
          <span className="ml-auto shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
            {100 - workItemPct} / {workItemPct}
          </span>
        </div>
      </div>

      {/* A re-fetch settles rather than flashing: the rows stay in place at
          reduced opacity instead of unmounting. 120ms, and none at all for a
          viewer who asked for no motion. */}
      <div
        className={cn(
          'min-h-0 flex-1 space-y-2 overflow-y-auto transition-opacity duration-[120ms] motion-reduce:transition-none',
          loading && 'opacity-60'
        )}
      >
        {suggestion.degradedToQuickWins && (
          <p className="text-xs text-muted-foreground">
            Nothing on the list runs over an hour, so this is the quick wins order.
          </p>
        )}
        {suggestion.note === 'capacity_too_small' && (
          <p className="text-sm text-muted-foreground">
            Nothing on the list fits your{' '}
            <span className="font-mono tabular-nums">{formatMinutes(suggestion.capacityMinutes)}</span> capacity. Raise
            it in step 4, or pin something anyway from All signals.
          </p>
        )}

        {suggestion.picks.map((pick) => {
          const item = itemsById.get(pick.itemId);
          if (!item) return null;
          const derived = isDerived(pick.durationSource);
          return (
            <div key={pick.itemId} data-row-nav className="flex items-start gap-2 border-b pb-2 text-sm last:border-b-0">
              <input
                type="checkbox"
                id={`suggest-pick-${pick.itemId}`}
                checked={checked.has(pick.itemId)}
                onChange={() => toggle(pick.itemId)}
                className="mt-1.5 shrink-0 accent-[hsl(var(--primary))]"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <ScoreChip
                    source={item.source}
                    score={item.score}
                    scoreBreakdown={item.scoreBreakdown}
                    notFired={item.notFired}
                    keptVisible={false}
                    open={openChipId === pick.itemId}
                    onOpenChange={(next) => setOpenChipId(next ? pick.itemId : null)}
                    onOpenScoringReference={onOpenScoringReference}
                  />
                  <label htmlFor={`suggest-pick-${pick.itemId}`} className="min-w-0 flex-1 cursor-pointer truncate">
                    {item.title}
                  </label>
                  <span
                    className={cn(
                      'shrink-0 font-mono text-xs tabular-nums',
                      derived ? 'text-muted-foreground' : 'text-foreground'
                    )}
                  >
                    {derived ? '~' : ''}
                    {formatMinutes(pick.durationMinutes)}
                  </span>
                </div>
                <div className="mt-0.5 flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
                  <span className="min-w-0 truncate">{PICK_REASON_LABEL[pick.pickReason]}</span>
                  <span className="shrink-0">{DURATION_PROVENANCE[pick.durationSource]}</span>
                </div>
              </div>
            </div>
          );
        })}

        {renderExcluded('deferred')}
        {renderExcluded('did_not_fit')}

        {suggestion.note === 'nothing_else_fits' && (
          <p className="pt-1 text-xs text-muted-foreground">
            Nothing else fits the remaining{' '}
            <span className="font-mono tabular-nums">
              {formatMinutes(suggestion.capacityMinutes - suggestion.suggestedMinutes)}
            </span>
            .
          </p>
        )}
      </div>

      <div className="shrink-0 space-y-2 pt-2">
        <div className="flex items-baseline justify-between text-sm">
          {/* The proposal is not gold. Capacity is a number the user committed
              to; a suggestion is not one yet. Gold arrives on pinning. */}
          <span className="font-mono tabular-nums text-muted-foreground">
            {anyDerived ? '~' : ''}
            {formatMinutes(checkedMinutes)} suggested
          </span>
          <span className="text-xs text-muted-foreground">
            of{' '}
            <span className="font-mono tabular-nums text-[hsl(var(--brand-gold))]">
              {formatMinutes(suggestion.capacityMinutes)}
            </span>{' '}
            capacity
          </span>
        </div>
        <div className="h-1 w-full overflow-hidden rounded-sm bg-muted" aria-hidden>
          <div
            className={cn('h-full', overCapacity ? 'bg-[hsl(var(--warning))]' : 'bg-muted-foreground')}
            style={{ width: `${overCapacity ? 100 : fillPct}%` }}
          />
        </div>
        {suggestion.durationsAreRough && (
          <p className="text-xs text-muted-foreground">
            Durations are rough defaults until you have logged some time.
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Rough durations are marked ~.{' '}
          <button type="button" onClick={onOpenScoringReference} className="underline hover:text-foreground">
            Why these?
          </button>
        </p>
        <div className="flex items-center justify-between">
          <Button type="button" variant="ghost" onClick={onDismiss}>
            Dismiss
          </Button>
          <Button
            type="button"
            disabled={checkedPicks.length === 0}
            onClick={() => onPin(checkedPicks.map((pick) => pick.itemId))}
          >
            Pin <span className="mx-1 font-mono tabular-nums">{checkedPicks.length}</span> to today
          </Button>
        </div>
      </div>
    </div>
  );
}
