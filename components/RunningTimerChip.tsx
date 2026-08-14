'use client';

import { useEffect, useState } from 'react';
import { Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/sonner';
import type { RunningTimer } from '@/lib/time-logs-repo';

interface Props {
  runningTimer: RunningTimer | null;
  onStop: () => void;
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

export default function RunningTimerChip({ runningTimer, onStop, longRunNudgeHours }: Props) {
  const [now, setNow] = useState(() => Date.now());
  const [nudgedFor, setNudgedFor] = useState<number | null>(null);

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

  return (
    <div className="flex items-center gap-2 rounded-md border border-input px-2.5 py-1 text-sm">
      <span
        className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-[hsl(var(--brand-gold))]"
        aria-hidden="true"
      />
      <span className="max-w-[10rem] truncate">{runningTimer.itemTitle}</span>
      <span className="font-mono tabular-nums text-muted-foreground">{formatElapsed(elapsedMs)}</span>
      <Button type="button" variant="ghost" size="icon" className="h-6 w-6" aria-label="Pause timer" onClick={onStop}>
        <Pause className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
