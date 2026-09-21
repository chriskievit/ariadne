'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { BarChart3, HelpCircle, Search, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { useCommandPalette } from '@/components/CommandPaletteProvider';
import { useKeymapHelp } from '@/components/KeymapHelpProvider';
import ModeSwitch from '@/components/ModeSwitch';
import RunningTimerChip from '@/components/RunningTimerChip';
import { useRunningTimer } from '@/components/RunningTimerProvider';
import { toast } from '@/components/ui/sonner';
import { completeItem, undoItem, stopTimerRequest, fetchSettings } from '@/lib/api-client';
import { SETTINGS_KEYS, DEFAULT_LONG_RUN_NUDGE_HOURS } from '@/lib/config';

export default function TopBar() {
  const { setOpen } = useCommandPalette();
  const { setOpen: setHelpOpen } = useKeymapHelp();
  const { runningTimer, refreshRunningTimer } = useRunningTimer();
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

  async function handleStopTimer() {
    if (!runningTimer) return;
    await stopTimerRequest(runningTimer.itemId);
    await refreshRunningTimer();
  }

  async function handleCompleteTimer(itemId: number, durationHours: number, note?: string) {
    await completeItem(itemId, { durationHours, note });
    await refreshRunningTimer();
    toast('Completed.', {
      duration: 5000,
      action: {
        label: 'Undo',
        onClick: async () => {
          await undoItem(itemId);
          await refreshRunningTimer();
        },
      },
    });
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      {/* Five columns, not four: the mode switch joins the timer chip and
          the search field in the centre cluster rather than crowding the
          logo, because a left column carrying both the lockup and the
          switch would outgrow the action cluster opposite it and drag the
          whole cluster off centre.

          Every child below is pinned to its column with an explicit
          col-start-N. RunningTimerChip renders nothing while idle, and
          without a pinned column grid auto-placement would slide every
          item after it one track left -- putting the action cluster in the
          search field's track and leaving the last 1fr empty, so the icons
          stop sitting flush right. Pin whatever you add here too, or an
          idle timer will silently break its alignment.

          Both outer tracks are floored at 10.0625rem (161px), the intrinsic
          width of ariadne-banner.png at this bar's h-8 -- update this
          number if that artwork is ever replaced. Without the floor, a
          bare 1fr lets the logo's track shrink below the logo's own width,
          and max-width:100% on <img> then clamps the logo down to fit,
          squashing it against its fixed h-8 height instead of leaving it
          alone. The two outer tracks must stay identical to each other:
          that symmetry, not their exact size, is what keeps the centre
          cluster centred. */}
      <div className="mx-auto grid h-16 max-w-6xl grid-cols-[minmax(10.0625rem,1fr)_auto_auto_minmax(0,20rem)_minmax(10.0625rem,1fr)] items-center gap-4 px-6">
        <Link
          href="/"
          className="group col-start-1 flex w-fit items-center rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--brand-gold))] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <Image
            src="/brand/ariadne-banner.png"
            alt="Ariadne"
            width={161}
            height={32}
            priority
            className="h-8 w-auto transition-transform motion-safe:group-hover:scale-[1.03]"
          />
        </Link>

        <div className="col-start-2">
          <ModeSwitch />
        </div>

        <div className="col-start-3">
          <RunningTimerChip
            runningTimer={runningTimer}
            onStop={handleStopTimer}
            onComplete={handleCompleteTimer}
            longRunNudgeHours={longRunNudgeHours}
          />
        </div>

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="col-start-4 flex items-center gap-2 justify-self-stretch rounded-md border border-input px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--brand-gold))] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <Search className="h-4 w-4" aria-hidden="true" />
          Search or jump to
          <kbd className="ml-auto font-mono text-xs">⌘K</kbd>
        </button>

        <div className="col-start-5 flex items-center justify-end gap-1">
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
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Keyboard shortcuts"
            title="Keyboard shortcuts (?)"
            onClick={() => setHelpOpen(true)}
          >
            <HelpCircle className="h-4 w-4" />
          </Button>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
