'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { fetchTodaySummary, carryToTomorrow, type TodaySummaryResponse } from '@/lib/api-client';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCarried: () => void;
}

export default function ShutdownDialog({ open, onOpenChange, onCarried }: Props) {
  const [summary, setSummary] = useState<TodaySummaryResponse | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetchTodaySummary().then((data) => {
      if (!cancelled) setSummary(data);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  async function handleCarry(id: number) {
    await carryToTomorrow(id);
    onCarried();
    const fresh = await fetchTodaySummary();
    setSummary(fresh);
  }

  const total = summary ? summary.planned.length + summary.doneToday.length : 0;
  const doneCount = summary?.doneToday.length ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Review my day</DialogTitle>
        </DialogHeader>
        {summary && (
          <div className="space-y-4">
            <p className="text-sm font-medium">
              <span className="font-mono tabular-nums">
                {doneCount} of {total}
              </span>{' '}
              planned item{total === 1 ? '' : 's'} done
            </p>
            <div>
              <h3 className="mb-1.5 text-sm font-semibold text-muted-foreground">Done</h3>
              {summary.doneToday.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing finished yet today.</p>
              ) : (
                <ul className="space-y-1.5">
                  {summary.doneToday.map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="min-w-0 truncate">{item.title}</span>
                      <span className="shrink-0 font-mono tabular-nums text-muted-foreground">
                        {item.hoursLoggedToday.toFixed(2)}h
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h3 className="mb-1.5 text-sm font-semibold text-muted-foreground">Still open</h3>
              {summary.planned.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing left to carry.</p>
              ) : (
                <ul className="space-y-1.5">
                  {summary.planned.map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="min-w-0 truncate">{item.title}</span>
                      <Button type="button" variant="outline" size="sm" onClick={() => handleCarry(item.id)}>
                        Carry to tomorrow
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
        <DialogFooter className="sm:justify-between">
          <span className="text-sm text-muted-foreground">
            Total hours logged today:{' '}
            <span className="font-mono tabular-nums">
              {summary ? summary.hoursLoggedToday.toFixed(2) : '0.00'}h
            </span>
          </span>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
