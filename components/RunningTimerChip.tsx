'use client';

import { useEffect, useState } from 'react';
import { Check, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/sonner';
import { elapsedHoursForInput } from '@/lib/elapsed';
import type { RunningTimer } from '@/lib/time-logs-repo';

interface Props {
  runningTimer: RunningTimer | null;
  onStop: () => void;
  onComplete: (itemId: number, durationHours: number, note?: string) => void;
  longRunNudgeHours: number;
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export default function RunningTimerChip({ runningTimer, onStop, onComplete, longRunNudgeHours }: Props) {
  const [now, setNow] = useState(() => Date.now());
  const [nudgedFor, setNudgedFor] = useState<number | null>(null);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [hours, setHours] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!runningTimer) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [runningTimer]);

  useEffect(() => {
    if (!runningTimer) {
      setNudgedFor(null);
      return;
    }
    const elapsedHours = (now - new Date(runningTimer.startedAt).getTime()) / 3_600_000;
    if (elapsedHours >= longRunNudgeHours && nudgedFor !== runningTimer.itemId) {
      setNudgedFor(runningTimer.itemId);
      toast(`Still on "${runningTimer.itemTitle}"?`, { duration: 10_000 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, runningTimer, longRunNudgeHours]);

  if (!runningTimer) return null;

  const elapsedMs = now - new Date(runningTimer.startedAt).getTime();
  const parsedHours = Number(hours);
  const hoursValid = hours.trim() !== '' && Number.isFinite(parsedHours) && parsedHours >= 0;

  function handleOpenComplete() {
    if (!runningTimer) return;
    setHours(elapsedHoursForInput(elapsedMs));
    setNote('');
    setCompleteOpen(true);
  }

  function handleCompleteSubmit() {
    if (!runningTimer || !hoursValid) return;
    onComplete(runningTimer.itemId, parsedHours, note || undefined);
    setCompleteOpen(false);
  }

  return (
    <>
      <div className="flex items-center gap-2 rounded-md border border-input px-2.5 py-1 text-sm">
        <span
          className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-[hsl(var(--brand-gold))]"
          aria-hidden="true"
        />
        <span className="max-w-[8rem] truncate">{runningTimer.itemTitle}</span>
        <span className="font-mono tabular-nums text-muted-foreground">{formatElapsed(elapsedMs)}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          aria-label="Complete item"
          onClick={handleOpenComplete}
        >
          <Check className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="h-6 w-6" aria-label="Pause timer" onClick={onStop}>
          <Pause className="h-3.5 w-3.5" />
        </Button>
      </div>

      <Dialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark complete</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="ticker-complete-hours">Hours spent</Label>
              <Input
                id="ticker-complete-hours"
                type="number"
                step="0.25"
                min="0"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
              />
              {hours.trim() !== '' && !hoursValid ? (
                <p className="text-sm text-destructive">Enter a number 0 or greater.</p>
              ) : null}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ticker-complete-note">Note (optional)</Label>
              <Input id="ticker-complete-note" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCompleteOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleCompleteSubmit} disabled={!hoursValid}>
              Complete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
