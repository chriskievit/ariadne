'use client';

import { useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import ItemRow from './ItemRow';
import type { ScoredItem } from '@/lib/dashboard';
import type { Item } from '@/lib/types';

interface Props {
  items: ScoredItem[];
  capacityMinutes: number;
  onStart?: (id: number) => void;
  onComplete: (id: number, durationHours: number, note?: string) => void;
  onOpenClaude: (id: number, workingDir?: string) => void;
  onDelete?: (id: number) => void;
  onUnpinToday?: (id: number) => void;
  onPlanDay: () => void;
  onReorder: (orderedItemIds: number[]) => void;
  failingSources?: Set<Item['source']>;
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
  capacityMinutes,
  onStart,
  onComplete,
  onOpenClaude,
  onDelete,
  onUnpinToday,
  onPlanDay,
  onReorder,
  failingSources,
}: Props) {
  const plannedMinutes = items.reduce((sum, i) => sum + (i.estimateMinutes ?? 0), 0);
  const loggedMinutes = items.reduce((sum, i) => sum + i.loggedMinutesToday, 0);

  function move(id: number, direction: -1 | 1) {
    const order = items.map((i) => i.id);
    const index = order.indexOf(id);
    const swapWith = index + direction;
    if (swapWith < 0 || swapWith >= order.length) return;
    [order[index], order[swapWith]] = [order[swapWith], order[index]];
    onReorder(order);
  }

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
          {formatMinutes(loggedMinutes)} logged of {formatMinutes(plannedMinutes)} planned ·{' '}
          <span className="text-[hsl(var(--brand-gold))]">{formatMinutes(capacityMinutes)} capacity</span>
        </p>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {items.length === 0 ? (
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">Nothing chosen yet.</p>
            <Button type="button" size="lg" onClick={onPlanDay}>
              Plan the day <kbd className="ml-2 font-mono text-xs opacity-70">P</kbd>
            </Button>
            <p className="text-xs text-muted-foreground">
              or pin anything below with <kbd className="font-mono">t</kbd>
            </p>
          </div>
        ) : (
          <div>
            {items.map((item, index) => (
              <div key={item.id} className="flex items-center gap-1">
                <div className="flex shrink-0 flex-col">
                  <button
                    type="button"
                    aria-label={`Move ${item.title} up`}
                    disabled={index === 0}
                    onClick={() => move(item.id, -1)}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                  >
                    <ChevronUp className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${item.title} down`}
                    disabled={index === items.length - 1}
                    onClick={() => move(item.id, 1)}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                  >
                    <ChevronDown className="h-3 w-3" />
                  </button>
                </div>
                <div className="min-w-0 flex-1">
                  <ItemRow
                    item={item}
                    onStart={onStart}
                    onComplete={onComplete}
                    onOpenClaude={onOpenClaude}
                    onDelete={onDelete}
                    onUnpinToday={onUnpinToday}
                    sourceIsStale={failingSources?.has(item.source)}
                  />
                </div>
                {item.estimateMinutes !== null && (
                  <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                    {item.loggedMinutesToday > 0
                      ? `${formatMinutes(item.loggedMinutesToday)} / ${formatMinutes(item.estimateMinutes)}`
                      : formatMinutes(item.estimateMinutes)}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
