'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import ItemRow from './ItemRow';
import SortableRows from './SortableRows';
import type { ScoredItem } from '@/lib/dashboard';
import type { Item } from '@/lib/types';

interface Props {
  items: ScoredItem[];
  plannedMinutes: number;
  loggedMinutes: number;
  capacityMinutes: number;
  onStart?: (id: number, alsoStartIds?: number[]) => void;
  onComplete: (id: number, durationHours: number, note?: string) => void;
  onOpenClaude: (id: number, workingDir?: string) => void;
  onDelete?: (id: number) => void;
  onPark?: (id: number) => void;
  onUnpark?: (id: number) => void;
  onUnpinToday?: (id: number) => void;
  onPlanDay: () => void;
  onReorder: (orderedItemIds: number[]) => void | Promise<void>;
  failingSources?: Set<Item['source']>;
  onOpenScoringReference: () => void;
}

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
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
  onPark,
  onUnpark,
  onUnpinToday,
  onPlanDay,
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
            <Button type="button" size="lg" className="h-11" onClick={onPlanDay}>
              Plan the day <kbd className="ml-2 font-mono text-xs opacity-70">P</kbd>
            </Button>
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
