'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ScoreChip from './ScoreChip';
import SortableRows from './SortableRows';
import { GROUP_ORDER, GROUP_LABEL, groupOf } from '@/lib/grouping';
import { formatCalibrationSentence, type CalibrationEntry } from '@/lib/calibration';
import type { ScoredItem } from '@/lib/dashboard';
import type { Item, Plan, PlanItem } from '@/lib/types';
import type { SnoozeOption } from '@/lib/snooze';
import { formatMinutes } from '@/lib/format-duration';
import SegmentedChoice, { type SegmentedOption } from './SegmentedChoice';
import SuggestPanel from './SuggestPanel';
import type { LeanNotch, SuggestAlgorithm, Suggestion, SuggestionItem } from '@/lib/suggest';

type Step = 1 | 2 | 3 | 4;

// Step 2 is already the "choose what to work on" step, and a suggestion is a
// way of choosing rather than a separate act, so it is a second mode here
// instead of a fifth step -- two lists to reconcile is what a dedicated step
// would have produced. 'all' stays the default: the suggestion is a mode you
// opt into.
type Step2Mode = 'suggested' | 'all';

const MODE_OPTIONS: SegmentedOption<Step2Mode>[] = [
  { value: 'suggested', label: 'Suggested' },
  { value: 'all', label: 'All signals' },
];

export interface SuggestBridge {
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
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  today: ScoredItem[];
  signals: ScoredItem[];
  yesterday: Item[];
  plan: Plan;
  planItems: PlanItem[];
  onKeep: (id: number) => void;
  onSnooze: (id: number, option: SnoozeOption) => void;
  onDone: (id: number, done: boolean) => void;
  onDrop: (id: number) => void;
  onAdd: (id: number) => void;
  onSetEstimate: (id: number, minutes: number | null) => void;
  onReorder: (orderedIds: number[]) => void | Promise<void>;
  onSetCapacity: (minutes: number) => void;
  calibration: CalibrationEntry[];
  onOpenScoringReference: () => void;
  initialStep?: 1 | 2;
  initialStep2Mode?: Step2Mode;
  suggest: SuggestBridge;
}

function parseDurationInput(raw: string): number | null {
  const match = raw.match(/^(?:(\d+)h)?\s*(?:(\d+)m)?$/i);
  if (!match) return null;
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  if (hours === 0 && minutes === 0) return null;
  return hours * 60 + minutes;
}

export default function PlanDayDialog({
  open,
  onOpenChange,
  today,
  signals,
  yesterday,
  plan,
  planItems,
  onKeep,
  onSnooze,
  onDone,
  onDrop,
  onAdd,
  onSetEstimate,
  onReorder,
  onSetCapacity,
  calibration,
  onOpenScoringReference,
  initialStep,
  initialStep2Mode,
  suggest,
}: Props) {
  const [step, setStep] = useState<Step>(initialStep ?? 1);
  const [mode, setMode] = useState<Step2Mode>(initialStep2Mode ?? 'all');
  const pickedIds = new Set(today.map((i) => i.id));
  const totalEstimateMinutes = today.reduce((sum, i) => sum + (i.estimateMinutes ?? 0), 0);
  const overMinutes = totalEstimateMinutes - plan.capacityMinutes;

  // Durations the engine derived, keyed by item. Deliberately placeholders and
  // not values: getCalibrationSummary() compares the user's estimate against
  // actual logged time, so seeding it with the tool's own guesses would make
  // the calibration loop measure itself and drift. A derived number becomes an
  // estimate only when the user says so.
  const roughMinutesByItemId = new Map(
    (suggest.suggestion?.picks ?? [])
      .filter((pick) => pick.durationSource === 'logged_median' || pick.durationSource === 'fallback')
      .map((pick) => [pick.itemId, pick.durationMinutes])
  );

  const acceptableRough = today.filter(
    (item) => item.estimateMinutes === null && roughMinutesByItemId.has(item.id)
  );

  // This dialog stays mounted with `open` gating visibility, so the initial
  // step and mode cannot come from useState alone: it would only ever read
  // them once, and every later open would land on whatever step the last
  // visit left behind. Resetting on each open is also what makes the two
  // entry points distinct, since they differ only in these two props.
  useEffect(() => {
    if (!open) return;
    setStep(initialStep ?? 1);
    setMode(initialStep2Mode ?? 'all');
  }, [open, initialStep, initialStep2Mode]);

  function close() {
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent className="flex max-h-[85vh] max-w-lg flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle>Plan the day — step {step} of 4</DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            <p className="shrink-0 text-sm text-muted-foreground">
              {yesterday.length === 0
                ? "Nothing left over from yesterday."
                : `${yesterday.length} of yesterday's picks are still open.`}
            </p>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
              {yesterday.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-2 border-b pb-2 text-sm">
                  <span className="min-w-0 truncate">{item.title}</span>
                  <div className="flex shrink-0 gap-1">
                    <Button type="button" size="sm" variant="outline" onClick={() => onKeep(item.id)}>
                      Keep
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => onSnooze(item.id, 'tomorrow')}>
                      Snooze
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => onDone(item.id, true)}>
                      Done
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => onDrop(item.id)}>
                      Drop
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex shrink-0 items-center justify-between pt-2">
              <span />
              <Button type="button" onClick={() => setStep(2)}>
                Next
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            <div className="flex shrink-0 items-center justify-between gap-2">
              <SegmentedChoice
                options={MODE_OPTIONS}
                value={mode}
                onChange={(next) => next && setMode(next)}
                ariaLabel="How to choose today's work"
              />
              {/* Two counts share this panel. This one is what is already in
                  today's plan, in both modes; the Pin button counts checked
                  rows, which is why it is phrased as an act. */}
              <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                {today.length} picked
              </span>
            </div>

            {mode === 'suggested' ? (
              <SuggestPanel
                suggestion={suggest.suggestion}
                itemsById={suggest.itemsById}
                loading={suggest.loading}
                error={suggest.error}
                algorithm={suggest.algorithm}
                lean={suggest.lean}
                onAlgorithmChange={suggest.onAlgorithmChange}
                onLeanChange={suggest.onLeanChange}
                onRetry={suggest.onRetry}
                onPin={async (itemIds) => {
                  await suggest.onPin(itemIds);
                  setStep(3);
                }}
                onDismiss={close}
                onOpenScoringReference={onOpenScoringReference}
              />
            ) : (
              <>
                {/* Unchanged, copy included. The claim only holds for this
                    list, so it sits with this list rather than above a toggle
                    that can show a recommendation. */}
                <p className="shrink-0 text-sm text-muted-foreground">Ordered by score. Nothing is recommended.</p>
                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
                  {GROUP_ORDER.map((group) => {
                    const groupItems = signals.filter((i) => groupOf(i) === group);
                    if (groupItems.length === 0) return null;
                    return (
                      <div key={group}>
                        <p className="mb-1 text-xs font-medium text-muted-foreground">
                          {GROUP_LABEL[group]} · {groupItems.length}
                        </p>
                        {groupItems.map((item) => (
                          <div key={item.id} className="flex items-center justify-between gap-2 py-1 text-sm">
                            <span className="flex min-w-0 items-center gap-2">
                              <ScoreChip
                                source={item.source}
                                score={item.score}
                                scoreBreakdown={item.scoreBreakdown}
                                notFired={item.notFired}
                                keptVisible={false}
                                open={false}
                                onOpenChange={() => {}}
                                onOpenScoringReference={onOpenScoringReference}
                              />
                              <span className="min-w-0 truncate">{item.title}</span>
                            </span>
                            {pickedIds.has(item.id) ? (
                              <span className="shrink-0 text-xs text-muted-foreground">Pinned ✓</span>
                            ) : (
                              <Button type="button" size="sm" variant="outline" onClick={() => onAdd(item.id)}>
                                Add <kbd className="ml-1 font-mono text-xs">t</kbd>
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
                <div className="flex shrink-0 items-center justify-between pt-2">
                  <Button type="button" variant="ghost" onClick={() => setStep(1)}>
                    Back
                  </Button>
                  <Button type="button" onClick={() => setStep(3)}>
                    Next
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            <p className="shrink-0 text-sm text-muted-foreground">Optional. Drag to reorder.</p>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
              <SortableRows
                items={today}
                labelOf={(item) => item.title}
                onReorder={onReorder}
                className="space-y-2"
                rowClassName="flex items-center gap-2 border-b pb-2 text-sm"
              >
                {(item) => (
                  <>
                    <span className="min-w-0 flex-1 truncate">{item.title}</span>
                    <Input
                      defaultValue={item.estimateMinutes ? formatMinutes(item.estimateMinutes) : ''}
                      placeholder={
                        roughMinutesByItemId.has(item.id)
                          ? `~${formatMinutes(roughMinutesByItemId.get(item.id)!)}`
                          : 'e.g. 1h 30m'
                      }
                      className="h-8 w-28 shrink-0 text-right font-mono text-sm"
                      onBlur={(e) => onSetEstimate(item.id, parseDurationInput(e.target.value))}
                    />
                  </>
                )}
              </SortableRows>
              {acceptableRough.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    for (const item of acceptableRough) {
                      onSetEstimate(item.id, roughMinutesByItemId.get(item.id)!);
                    }
                  }}
                  className="pb-1 pt-3 text-left text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  Accept all rough durations{' '}
                  <span className="font-mono tabular-nums">· {acceptableRough.length}</span>
                </button>
              )}
              {calibration.map((entry) => {
                const sentence = formatCalibrationSentence(entry);
                return sentence ? (
                  <p key={entry.workType} className="text-xs text-muted-foreground">
                    {sentence} That&apos;s from your own logs.
                  </p>
                ) : null;
              })}
            </div>
            <div className="flex shrink-0 items-center justify-between pt-2">
              <Button type="button" variant="ghost" onClick={() => setStep(2)}>
                Back
              </Button>
              <Button type="button" onClick={() => setStep(4)}>
                Next
              </Button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Planned</span>
                <span className="font-mono text-lg tabular-nums text-[hsl(var(--brand-gold))]">
                  {formatMinutes(totalEstimateMinutes)}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Capacity</span>
                <Input
                  type="number"
                  min="0"
                  step="15"
                  defaultValue={plan.capacityMinutes}
                  className="h-8 w-24 font-mono text-sm"
                  onBlur={(e) => {
                    const minutes = Number(e.target.value);
                    if (Number.isFinite(minutes) && minutes >= 0) onSetCapacity(minutes);
                  }}
                />
                <span className="text-muted-foreground">minutes</span>
              </div>
              {overMinutes > 0 && (
                <p className="text-sm">
                  That&apos;s <span className="font-medium">{formatMinutes(overMinutes)}</span> more than your day.{' '}
                  <span className="font-medium">Your call.</span>
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Nothing has been removed or reordered. Capacity is a number you set — change it above.
              </p>
            </div>
            <div className="flex shrink-0 items-center justify-between pt-2">
              <Button type="button" variant="ghost" onClick={() => setStep(3)}>
                Back and adjust
              </Button>
              <Button type="button" onClick={close}>
                Looks right
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
