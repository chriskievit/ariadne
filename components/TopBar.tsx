'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BarChart3, Search, Settings } from 'lucide-react';
import { AriadneMark } from '@/components/icons/ariadne-mark';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { useCommandPalette } from '@/components/CommandPaletteProvider';
import RunningTimerChip from '@/components/RunningTimerChip';
import { fetchRunningTimer, stopTimerRequest, fetchSettings } from '@/lib/api-client';
import { SETTINGS_KEYS, DEFAULT_LONG_RUN_NUDGE_HOURS } from '@/lib/config';
import type { RunningTimer } from '@/lib/time-logs-repo';

const RUNNING_TIMER_POLL_MS = 5000;

export default function TopBar() {
  const { setOpen } = useCommandPalette();
  const [runningTimer, setRunningTimer] = useState<RunningTimer | null>(null);
  const [longRunNudgeHours, setLongRunNudgeHours] = useState(DEFAULT_LONG_RUN_NUDGE_HOURS);

  useEffect(() => {
    let cancelled = false;
    fetchSettings().then((settings) => {
      if (cancelled) return;
      const raw = settings[SETTINGS_KEYS.longRunNudgeHours];
      if (raw) setLongRunNudgeHours(Number(raw));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      const timer = await fetchRunningTimer();
      if (!cancelled) setRunningTimer(timer);
    }
    poll();
    const interval = setInterval(poll, RUNNING_TIMER_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  async function handleStopTimer() {
    if (!runningTimer) return;
    await stopTimerRequest(runningTimer.itemId);
    setRunningTimer(await fetchRunningTimer());
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto grid h-16 max-w-6xl grid-cols-[1fr_auto_minmax(0,24rem)_1fr] items-center gap-4 px-6">
        <Link
          href="/"
          className="group flex w-fit items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--brand-gold))] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <AriadneMark className="h-7 w-7 shrink-0 text-[hsl(var(--brand-gold))] transition-transform motion-safe:group-hover:scale-105" />
          <span className="font-display text-xl leading-none tracking-wide text-foreground">Ariadne</span>
        </Link>

        <RunningTimerChip runningTimer={runningTimer} onStop={handleStopTimer} longRunNudgeHours={longRunNudgeHours} />

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 justify-self-stretch rounded-md border border-input px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--brand-gold))] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <Search className="h-4 w-4" aria-hidden="true" />
          Search or jump to
          <kbd className="ml-auto font-mono text-xs">⌘K</kbd>
        </button>

        <div className="flex items-center justify-end gap-1">
          <Button type="button" variant="ghost" size="icon" asChild aria-label="Report">
            <Link href="/report">
              <BarChart3 className="h-4 w-4" />
            </Link>
          </Button>
          <Button type="button" variant="ghost" size="icon" asChild aria-label="Settings">
            <Link href="/settings">
              <Settings className="h-4 w-4" />
            </Link>
          </Button>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
