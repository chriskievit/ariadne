'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  fetchTodaySummary,
  carryToTomorrow,
  saveWrapUpNote,
  type TodaySummaryResponse,
} from '@/lib/api-client';
import { SNOOZE_LABEL, type SnoozeOption } from '@/lib/snooze';
import { formatCalibrationSentence, type CalibrationEntry } from '@/lib/calibration';
import { formatMinutes } from '@/lib/format-duration';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCarried: () => void;
  onSnooze: (id: number, option: SnoozeOption) => void;
  onDrop: (id: number) => void;
  calibration?: CalibrationEntry[];
}

function formatWrapUpDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export default function ShutdownDialog({ open, onOpenChange, onCarried, onSnooze, onDrop, calibration = [] }: Props) {
  const [summary, setSummary] = useState<TodaySummaryResponse | null>(null);
  const [note, setNote] = useState('');
  const [snoozingId, setSnoozingId] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetchTodaySummary().then((data) => {
      if (!cancelled) {
        setSummary(data);
        setNote(data.plan.note ?? '');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  async function refetch() {
    const fresh = await fetchTodaySummary();
    setSummary(fresh);
  }

  async function handleCarry(id: number) {
    await carryToTomorrow(id);
    onCarried();
    await refetch();
  }

  async function handleSnoozeOption(id: number, option: SnoozeOption) {
    onSnooze(id, option);
    setSnoozingId(null);
    await refetch();
  }

  async function handleDrop(id: number) {
    onDrop(id);
    await refetch();
  }

  function handleNoteBlur() {
    if (!summary) return;
    if (note === (summary.plan.note ?? '')) return;
    saveWrapUpNote(summary.plan.date, note);
  }

  const total = summary ? summary.planned.length + summary.doneToday.length : 0;
  const doneCount = summary?.doneToday.length ?? 0;
  const loggedMinutes = summary ? Math.round(summary.hoursLoggedToday * 60) : 0;
  const calibrationSentences = calibration.map(formatCalibrationSentence).filter((s): s is string => s !== null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Wrap up the day</DialogTitle>
          {summary && <DialogDescription>{formatWrapUpDate(summary.plan.date)}</DialogDescription>}
        </DialogHeader>
        {summary && (
          <div className="space-y-4">
            <p className="text-sm font-medium">
              <span className="font-mono tabular-nums">
                {doneCount} of {total}
              </span>{' '}
              planned item{total === 1 ? '' : 's'} done
            </p>
            <p className="text-sm text-muted-foreground">
              Logged today: <span className="font-mono tabular-nums">{formatMinutes(loggedMinutes)}</span> · Planned
              this morning: <span className="font-mono tabular-nums">{formatMinutes(summary.plannedMinutes)}</span>
            </p>
            {calibrationSentences.length > 0 && (
              <ul className="space-y-1 text-sm text-muted-foreground">
                {calibrationSentences.map((sentence) => (
                  <li key={sentence}>{sentence}</li>
                ))}
              </ul>
            )}
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
                        {item.estimateMinutes != null
                          ? `${item.hoursLoggedToday.toFixed(2)}h / ${formatMinutes(item.estimateMinutes)} est`
                          : `${item.hoursLoggedToday.toFixed(2)}h`}
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
                      {snoozingId === item.id ? (
                        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                          {(Object.keys(SNOOZE_LABEL) as SnoozeOption[]).map((option) => (
                            <Button
                              key={option}
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleSnoozeOption(item.id, option)}
                            >
                              {SNOOZE_LABEL[option]}
                            </Button>
                          ))}
                          <Button type="button" variant="ghost" size="sm" onClick={() => setSnoozingId(null)}>
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <div className="flex shrink-0 items-center gap-1">
                          <Button type="button" variant="outline" size="sm" onClick={() => handleCarry(item.id)}>
                            Tomorrow
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setSnoozingId(item.id)}
                          >
                            Snooze
                          </Button>
                          <Button type="button" variant="outline" size="sm" onClick={() => handleDrop(item.id)}>
                            Drop
                          </Button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h3 className="mb-1.5 text-sm font-semibold text-muted-foreground">Note</h3>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onBlur={handleNoteBlur}
                placeholder="Anything worth remembering about today?"
                rows={3}
              />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Close the day
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
