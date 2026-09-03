'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import ItemRow from './ItemRow';
import SortableRows from './SortableRows';
import type { ScoredItem } from '@/lib/dashboard';
import type { Item, Priority } from '@/lib/types';
import { formatMinutes } from '@/lib/format-duration';

interface Props {
  items: ScoredItem[];
  plannedMinutes: number;
  loggedMinutes: number;
  capacityMinutes: number;
  onStart?: (id: number, alsoStartIds?: number[]) => void;
  onComplete: (id: number, durationHours: number, note?: string) => void;
  onOpenClaude: (id: number, workingDir?: string) => void;
  onDelete?: (id: number) => void;
  onSetPriority?: (id: number, priority: Priority | null) => void;
  onPark?: (id: number) => void;
  onUnpark?: (id: number) => void;
  onUnpinToday?: (id: number) => void;
  onPlanDay: () => void;
  onSuggestDay: () => void;
  onReorder: (orderedItemIds: number[]) => void | Promise<void>;
  failingSources?: Set<Item['source']>;
  onOpenScoringReference: () => void;
}

export default function TodaySection({
  items,
  plannedMinutes,
  loggedMinutes,
  capacityMinutes,
  onStart,
  onComplete,
  onOpenClaude,
  onDelete,
  onSetPriority,
  onPark,
  onUnpark,
  onUnpinToday,
  onPlanDay,
  onSuggestDay,
  onReorder,
  failingSources,
  onOpenScoringReference,
}: Props) {
  return (
    <Card className="border-l-2 border-l-[hsl(var(--brand-gold))]">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold">Today</h2>
          <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-xs tabular-nums text-muted-foreground">
            {items.length}
          </span>
        </div>
        <p className="font-mono text-xs tabular-nums text-muted-foreground">
          {formatMinutes(loggedMinutes)} logged{plannedMinutes > 0 ? ` of ${formatMinutes(plannedMinutes)} planned` : ''} ·{' '}
          <span className="text-[hsl(var(--brand-gold))]">{formatMinutes(capacityMinutes)} capacity</span>
        </p>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {items.length === 0 ? (
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">Nothing chosen yet.</p>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" size="lg" className="h-11" onClick={onPlanDay}>
                Plan the day <kbd className="ml-2 font-mono text-xs opacity-70">P</kbd>
              </Button>
              {/* Outline, not primary: one clearly-primary action per
                  context, and planning by hand is still the default path. */}
              <Button type="button" size="lg" variant="outline" className="h-11" onClick={onSuggestDay}>
                Suggest a day <kbd className="ml-2 font-mono text-xs opacity-70">i</kbd>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              or pin anything below with <kbd className="font-mono">t</kbd>
            </p>
          </div>
        ) : (
          <SortableRows
            items={items}
            labelOf={(item) => item.title}
            onReorder={onReorder}
            rowClassName="flex items-center gap-1"
          >
            {(item) => (
              <>
                <div className="min-w-0 flex-1">
                  <ItemRow
                    item={item}
                    onStart={onStart}
                    onComplete={onComplete}
                    onOpenClaude={onOpenClaude}
                    onDelete={onDelete}
                    onSetPriority={onSetPriority}
                    onPark={onPark}
                    onUnpark={onUnpark}
                    onUnpinToday={onUnpinToday}
                    sourceIsStale={failingSources?.has(item.source)}
                    onOpenScoringReference={onOpenScoringReference}
                    fullDetailWhenParked
                  />
                </div>
                {item.estimateMinutes !== null && (
                  <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                    {item.loggedMinutesToday > 0
                      ? `${formatMinutes(item.loggedMinutesToday)} / ${formatMinutes(item.estimateMinutes)}`
                      : formatMinutes(item.estimateMinutes)}
                  </span>
                )}
              </>
            )}
          </SortableRows>
        )}
      </CardContent>
    </Card>
  );
}
