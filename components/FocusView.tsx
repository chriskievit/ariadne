'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ExternalLink, Hand } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/sonner';
import { Button } from '@/components/ui/button';
import { useRunningTimer } from './RunningTimerProvider';
import { useKeymapHelp } from './KeymapHelpProvider';
import { SOURCE_ICON } from './ItemRow';
import {
  fetchDashboardData,
  fetchPlan,
  fetchAgentSessions,
  startItem,
  stopTimerRequest,
  triggerSync,
} from '@/lib/api-client';
import { selectFocus, waitingOnYou } from '@/lib/focus';
import { formatMinutes } from '@/lib/format-duration';
import { isTypingTarget } from '@/lib/keymap';
import { localDateString } from '@/lib/date';
import { getAgentDefinition } from '@/lib/agents';
import type { ScoredItem } from '@/lib/dashboard';
import type { SessionListEntry } from '@/lib/agent-session-list';

// Planning's own sync cadence (AUTO_SYNC_INTERVAL_MS in Dashboard.tsx), so
// Focus left open on its own keeps the same freshness Planning would.
const AUTO_SYNC_INTERVAL_MS = 5 * 60 * 1000;
// Local reads only, no source traffic: picks up a plan changed in Planning
// on the other screen without waiting for the next sync.
const LOCAL_REFRESH_MS = 60_000;
// Planning's rate for the same endpoint (SESSION_POLL_INTERVAL_MS). The
// agent line is one line at the foot of the screen, not a rail.
const SESSION_POLL_MS = 15_000;
// A row focused by j/k gives the selection back after this long, so a
// highlight never sits on the second screen all afternoon.
const IDLE_BLUR_MS = 8_000;

interface FocusData {
  today: ScoredItem[];
  inProgress: ScoredItem[];
  plannedMinutes: number;
  loggedMinutes: number;
  capacityMinutes: number;
}

const SOURCE_NAME: Record<ScoredItem['source'], string> = {
  github_pr: 'GitHub',
  ado_workitem: 'Azure DevOps',
  adhoc: 'Ad-hoc',
};

/**
 * The third face: what you are on, for how long, and what is left today.
 *
 * Built to be read from across a desk on a second screen, and to stay
 * quiet there. It shows nothing it cannot also show in Planning, ranks
 * nothing, and refreshes in place without spinners. It has one action,
 * moving the timer to another item on today's plan, because that is the
 * one thing worth not walking back to Planning for.
 */
export default function FocusView({
  initialData,
  initialSessions,
}: {
  initialData: FocusData;
  initialSessions: SessionListEntry[];
}) {
  const [data, setData] = useState<FocusData>(initialData);
  const [sessions, setSessions] = useState<SessionListEntry[]>(initialSessions);
  const [switchingId, setSwitchingId] = useState<number | null>(null);
  const [clock, setClock] = useState(() => Date.now());
  const { runningTimer, refreshRunningTimer } = useRunningTimer();
  const { setOpen: setHelpOpen } = useKeymapHelp();
  const router = useRouter();

  const refresh = useCallback(async () => {
    try {
      const [fresh, planResponse] = await Promise.all([
        fetchDashboardData(),
        fetchPlan(localDateString(new Date())),
      ]);
      setData({
        today: fresh.today,
        inProgress: fresh.inProgress,
        plannedMinutes: fresh.todayPlannedMinutes,
        loggedMinutes: fresh.todayLoggedMinutes,
        capacityMinutes: planResponse.plan.capacityMinutes,
      });
    } catch {
      // Keep the last good screen. This surface is read at a glance, and an
      // error banner on it would be the loudest thing in the room for a
      // failure the next tick most likely fixes on its own.
    }
  }, []);

  const refreshSessions = useCallback(async () => {
    try {
      setSessions((await fetchAgentSessions()).sessions);
    } catch {
      // Same house rule as Planning's poll of this endpoint: keep what was
      // last good and let the next tick recover.
    }
  }, []);

  // Local refresh, silent sync, and the session poll, all paused while the
  // tab is hidden and caught up the moment it is shown again.
  useEffect(() => {
    let lastSync = Date.now();
    async function tick() {
      if (document.hidden) return;
      if (Date.now() - lastSync >= AUTO_SYNC_INTERVAL_MS) {
        lastSync = Date.now();
        try {
          await triggerSync();
        } catch {
          // A failed sync leaves the local data as it was; Planning owns
          // the language for a failing source, and Focus does not repeat it.
        }
      }
      await refresh();
    }
    function onVisible() {
      if (!document.hidden) {
        void tick();
        void refreshSessions();
      }
    }
    const dataTimer = setInterval(tick, LOCAL_REFRESH_MS);
    const sessionTimer = setInterval(() => {
      if (!document.hidden) void refreshSessions();
    }, SESSION_POLL_MS);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(dataTimer);
      clearInterval(sessionTimer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh, refreshSessions]);

  // The timer can move from elsewhere (the other screen's Planning, the MCP
  // tools), so a change in what it runs on pulls the lists back in line.
  const runningItemId = runningTimer?.itemId ?? null;
  const prevRunningRef = useRef<number | null | undefined>(undefined);
  useEffect(() => {
    if (prevRunningRef.current !== undefined && prevRunningRef.current !== runningItemId) void refresh();
    prevRunningRef.current = runningItemId;
  }, [runningItemId, refresh]);

  useEffect(() => {
    if (!runningTimer) return;
    const interval = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [runningTimer]);

  const { now, upNext, alsoInProgress } = selectFocus(data.today, data.inProgress, runningItemId);
  const timed = runningTimer && now && runningTimer.itemId === now.id ? runningTimer : null;
  const waiting = waitingOnYou(sessions);

  async function handleSwitch(item: ScoredItem) {
    if (switchingId !== null) return;
    setSwitchingId(item.id);
    try {
      // The same two calls as Planning's own Switch (handleSwitchTimer in
      // Dashboard.tsx): stop what runs, then start the chosen item with its
      // timer. Choosing a row here is already the answer that dialog asks
      // for, so it is not asked again.
      if (runningTimer) await stopTimerRequest(runningTimer.itemId);
      await startItem(item.id);
    } catch {
      toast(`Could not start "${item.title}".`);
    } finally {
      await Promise.all([refreshRunningTimer(), refresh()]);
      setSwitchingId(null);
    }
  }

  // j/k and the arrow keys walk Up next; Enter or Space switches, natively,
  // because each row is a button. g d and g w leave for the other faces.
  useEffect(() => {
    let pendingG = false;
    let pendingGTimeout: ReturnType<typeof setTimeout> | null = null;
    let idleTimeout: ReturnType<typeof setTimeout> | null = null;

    function armIdleBlur() {
      if (idleTimeout) clearTimeout(idleTimeout);
      idleTimeout = setTimeout(() => {
        const active = document.activeElement;
        if (active instanceof HTMLElement && active.hasAttribute('data-focus-row')) active.blur();
      }, IDLE_BLUR_MS);
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;
      if (document.querySelector('[role="dialog"]')) return;

      if (pendingG) {
        pendingG = false;
        if (pendingGTimeout) clearTimeout(pendingGTimeout);
        const key = e.key.toLowerCase();
        if (key === 'd') router.push('/');
        if (key === 'w') router.push('/work');
        if (key === 's') router.push('/settings');
        return;
      }

      const rows = Array.from(document.querySelectorAll<HTMLElement>('[data-focus-row]'));
      const index = rows.findIndex((el) => el === document.activeElement);

      if (e.key === 'j' || e.key === 'ArrowDown' || e.key === 'k' || e.key === 'ArrowUp') {
        if (rows.length === 0) return;
        e.preventDefault();
        const down = e.key === 'j' || e.key === 'ArrowDown';
        const next = index === -1 ? 0 : down ? Math.min(rows.length - 1, index + 1) : Math.max(0, index - 1);
        rows[next].focus();
        armIdleBlur();
        return;
      }
      if (e.key === 'Escape' && index !== -1) {
        rows[index].blur();
        return;
      }
      if (e.key === '?') {
        setHelpOpen(true);
        return;
      }
      if (e.key.toLowerCase() === 'g') {
        pendingG = true;
        pendingGTimeout = setTimeout(() => {
          pendingG = false;
        }, 800);
        return;
      }
      if (index !== -1) armIdleBlur();
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (pendingGTimeout) clearTimeout(pendingGTimeout);
      if (idleTimeout) clearTimeout(idleTimeout);
    };
  }, [router, setHelpOpen]);

  const remaining = upNext.length + (now && data.today.some((i) => i.id === now.id) ? 1 : 0);

  return (
    <main
      className={cn(
        'focus-surface mx-auto flex h-[calc(100dvh-4rem)] w-full max-w-[100rem] flex-col overflow-hidden',
        'px-6 pb-6 pt-5 sm:px-10 sm:pb-8 sm:pt-7'
      )}
    >
      <h1 className="sr-only">Focus</h1>

      <DayLine
        remaining={remaining}
        loggedMinutes={data.loggedMinutes}
        plannedMinutes={data.plannedMinutes}
        capacityMinutes={data.capacityMinutes}
      />

      <div
        className={cn(
          'grid min-h-0 flex-1 grid-rows-[minmax(min-content,2fr)_minmax(0,3fr)]',
          '[@media(min-aspect-ratio:5/4)]:grid-cols-[minmax(0,11fr)_minmax(0,9fr)] [@media(min-aspect-ratio:5/4)]:grid-rows-1'
        )}
      >
        <NowPane
          item={now}
          startedAt={timed?.startedAt ?? null}
          clock={clock}
          alsoInProgress={alsoInProgress}
        />
        <UpNext
          items={upNext}
          hasTimer={runningTimer !== null}
          switchingId={switchingId}
          onSwitch={handleSwitch}
          planIsEmpty={data.today.length === 0}
        />
      </div>

      {waiting.length > 0 && <AgentLine sessions={waiting} />}
    </main>
  );
}

function DayLine({
  remaining,
  loggedMinutes,
  plannedMinutes,
  capacityMinutes,
}: {
  remaining: number;
  loggedMinutes: number;
  plannedMinutes: number;
  capacityMinutes: number;
}) {
  const scale = Math.max(capacityMinutes, plannedMinutes, loggedMinutes, 1);
  const loggedShare = Math.min(1, loggedMinutes / scale);
  const plannedShare = Math.min(1, plannedMinutes / scale);

  return (
    <div className="shrink-0 pb-5 sm:pb-7">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 font-mono text-[clamp(0.8125rem,0.7rem+0.3vw,1rem)] tabular-nums text-muted-foreground">
        <p>
          <span className="text-foreground">{remaining}</span> left today
        </p>
        <p>
          <span className="text-foreground">{formatMinutes(loggedMinutes)}</span> logged
          {plannedMinutes > 0 ? ` of ${formatMinutes(plannedMinutes)} planned` : ''} ·{' '}
          <span className="text-[hsl(var(--brand-gold))]">{formatMinutes(capacityMinutes)} capacity</span>
        </p>
      </div>
      {/* Logged against the day's capacity, with a tick where the plan
          ends. A reading, not a goal: it never changes colour as it fills. */}
      <div
        className="relative mt-3 h-0.5 w-full bg-border"
        role="img"
        aria-label={`${formatMinutes(loggedMinutes)} logged of ${formatMinutes(capacityMinutes)} capacity`}
      >
        <div
          className="absolute inset-y-0 left-0 bg-[hsl(var(--brand-gold))] transition-[width] duration-700 ease-out"
          style={{ width: `${loggedShare * 100}%` }}
        />
        {plannedMinutes > 0 && plannedShare < 0.995 && (
          <div
            className="absolute -top-1 h-2.5 w-px bg-muted-foreground"
            style={{ left: `calc(${plannedShare * 100}% - 0.5px)` }}
            aria-hidden="true"
          />
        )}
      </div>
    </div>
  );
}

function NowPane({
  item,
  startedAt,
  clock,
  alsoInProgress,
}: {
  item: ScoredItem | null;
  startedAt: string | null;
  clock: number;
  alsoInProgress: number;
}) {
  // Keyed on the item, so the arrival motion runs when the thread moves to
  // another item and never on the first paint or on a background refresh.
  const firstItemRef = useRef<number | null | undefined>(undefined);
  if (firstItemRef.current === undefined) firstItemRef.current = item?.id ?? null;
  const animate = item !== null && item.id !== firstItemRef.current;

  const elapsedMinutes = startedAt ? Math.floor((clock - new Date(startedAt).getTime()) / 60_000) : null;
  const Icon = item ? SOURCE_ICON[item.source] : null;

  return (
    <section
      aria-labelledby="focus-now-heading"
      className={cn(
        'relative flex flex-col pb-8 pl-6 [justify-content:safe_center] sm:pl-10',
        '[@media(min-aspect-ratio:5/4)]:pb-0 [@media(min-aspect-ratio:5/4)]:pr-12'
      )}
    >
      <h2 id="focus-now-heading" className="sr-only">
        Now
      </h2>
      {/* The thread. Gold only while something is started, because gold is
          the thread you are holding and an empty Now holds nothing. */}
      <div
        className={cn(
          'absolute bottom-8 left-0 top-0 w-0.5 [@media(min-aspect-ratio:5/4)]:bottom-0',
          item ? 'bg-[hsl(var(--brand-gold))]' : 'bg-border'
        )}
        aria-hidden="true"
      />

      {item ? (
        <div key={item.id} className={cn('min-w-0', animate && 'focus-arrive')}>
          <p className="line-clamp-3 text-balance text-[clamp(1.75rem,1rem+2.4vw,3.5rem)] font-semibold leading-[1.1] tracking-[-0.025em]">
            {item.title}
          </p>
          <div className="mt-4 flex min-w-0 items-center gap-2 text-[clamp(0.875rem,0.75rem+0.35vw,1.125rem)] text-muted-foreground">
            {Icon && <Icon className="h-[1.1em] w-[1.1em] shrink-0" aria-hidden="true" />}
            <span className="min-w-0 truncate">{item.repo ?? SOURCE_NAME[item.source]}</span>
            {item.url && (
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="ml-1 inline-flex shrink-0 items-center gap-1 rounded-sm text-link underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                Open
                <ExternalLink className="h-[0.9em] w-[0.9em]" aria-hidden="true" />
              </a>
            )}
          </div>

          <div className="relative mt-[clamp(1rem,2.5vh,1.75rem)]">
            {/* The knot: where the thread is tied to the running clock. Still,
                unlike the timer chip's pulse: on a screen watched from the
                corner of the eye for hours, the ticking minute is signal
                enough, and a blinking dot would be the distraction this face
                exists to remove. */}
            <span
              className={cn(
                'absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full',
                '-left-6 -translate-x-[calc(50%-1px)] sm:-left-10',
                elapsedMinutes !== null
                  ? 'bg-[hsl(var(--brand-gold))] ring-4 ring-background'
                  : 'hidden'
              )}
              aria-hidden="true"
            />
            {elapsedMinutes !== null ? (
              <p className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
                <span className="font-mono text-[clamp(1.375rem,min(2.4vw,4vh),2.5rem)] font-medium leading-none tracking-[-0.02em] tabular-nums text-foreground/90">
                  {formatMinutes(Math.max(0, elapsedMinutes))}
                </span>
                <span className="font-mono text-[clamp(0.8125rem,0.7rem+0.3vw,1rem)] tabular-nums text-muted-foreground">
                  since {formatClock(startedAt!)}
                  {item.estimateMinutes ? ` · ${formatMinutes(item.estimateMinutes)} estimated` : ''}
                </span>
              </p>
            ) : (
              <p className="font-mono text-[clamp(0.8125rem,0.7rem+0.3vw,1rem)] tabular-nums text-muted-foreground">
                No timer running
                {item.estimateMinutes ? ` · ${formatMinutes(item.estimateMinutes)} estimated` : ''}
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="min-w-0">
          <p className="text-[clamp(1.75rem,1rem+2.4vw,3.5rem)] font-semibold leading-[1.1] tracking-[-0.025em] text-muted-foreground">
            Nothing started
          </p>
        </div>
      )}

      {alsoInProgress > 0 && (
        <p className="mt-[clamp(1.25rem,3vh,2.25rem)] font-mono text-[clamp(0.75rem,0.68rem+0.2vw,0.875rem)] tabular-nums text-muted-foreground">
          Also in progress · {alsoInProgress}
        </p>
      )}
    </section>
  );
}

function UpNext({
  items,
  hasTimer,
  switchingId,
  onSwitch,
  planIsEmpty,
}: {
  items: ScoredItem[];
  hasTimer: boolean;
  switchingId: number | null;
  onSwitch: (item: ScoredItem) => void;
  planIsEmpty: boolean;
}) {
  // No scrolling on an ambient screen: every row renders, the section clips,
  // and rows that fall past its bottom are hidden from view and from the
  // keyboard, with a count of them pinned to the foot. Hiding never changes
  // layout, so the measurement cannot feed back into itself; rows wrap to
  // two lines, so each row is measured rather than assumed.
  const sectionRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const [fit, setFit] = useState(items.length);

  useLayoutEffect(() => {
    const section = sectionRef.current;
    const list = listRef.current;
    if (!section || !list) return;
    function measure() {
      if (!section || !list) return;
      const bottom = section.getBoundingClientRect().bottom;
      const rows = Array.from(list.children).map((li) => li.getBoundingClientRect().bottom);
      if (rows.every((b) => b <= bottom)) {
        setFit(rows.length);
        return;
      }
      // Room for the "Later today" line under the last row that stays.
      const limit = bottom - 40;
      setFit(Math.max(1, rows.filter((b) => b <= limit).length));
    }
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(section);
    return () => observer.disconnect();
  }, [items]);

  const hidden = Math.max(0, items.length - fit);
  const action = hasTimer ? 'Switch' : 'Start';

  return (
    <section
      ref={sectionRef}
      aria-labelledby="focus-next-heading"
      className={cn(
        'relative flex min-h-0 flex-col overflow-hidden border-t border-border pt-6',
        '[@media(min-aspect-ratio:5/4)]:border-l [@media(min-aspect-ratio:5/4)]:border-t-0 [@media(min-aspect-ratio:5/4)]:pl-12 [@media(min-aspect-ratio:5/4)]:pt-1'
      )}
    >
      <h2
        id="focus-next-heading"
        className="flex items-baseline gap-2 text-[clamp(0.875rem,0.75rem+0.35vw,1.125rem)] font-medium text-muted-foreground"
      >
        Up next
        <span className="font-mono text-[0.85em] tabular-nums">{items.length}</span>
      </h2>

      {items.length === 0 ? (
        <p className="mt-4 text-[clamp(1.0625rem,0.85rem+0.7vw,1.5rem)] text-muted-foreground">
          {planIsEmpty ? (
            <>
              No plan for today.{' '}
              <Link
                href="/"
                className="rounded-sm text-link underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                Plan the day in Planning
              </Link>
            </>
          ) : (
            "Nothing else on today's plan."
          )}
        </p>
      ) : (
        <ol ref={listRef} className="mt-3">
          {items.map((item, index) => {
            const busy = switchingId === item.id;
            const clipped = index >= fit;
            return (
              <li
                key={item.id}
                aria-hidden={clipped || undefined}
                className={cn(
                  // No row tint: Planning's rows never highlight, only their
                  // actions rise, and a tint here read as a half-drawn card.
                  'group grid grid-cols-[2.25ch_minmax(0,1fr)_auto] items-baseline gap-x-4 border-b border-border py-[clamp(0.75rem,1.6vh,1.125rem)] last:border-b-0 [@media(max-aspect-ratio:5/4)]:py-[clamp(0.875rem,2.6vh,2rem)]',
                  clipped && 'invisible'
                )}
              >
                <span className="pl-1 font-mono text-[clamp(0.8125rem,0.7rem+0.3vw,1rem)] tabular-nums text-muted-foreground">
                  {index + 1}
                </span>
                <span className="min-w-0">
                  <span className="line-clamp-2 text-pretty text-[clamp(1.0625rem,0.85rem+0.7vw,1.5rem)] font-medium leading-snug [@media(max-aspect-ratio:5/4)]:text-[clamp(1.0625rem,0.8rem+1.1vw,1.75rem)]">
                    {item.title}
                  </span>
                  {item.status === 'in_progress' && (
                    <span className="mt-0.5 block text-[clamp(0.75rem,0.68rem+0.2vw,0.875rem)] text-muted-foreground">
                      {item.parked ? 'Parked' : 'Started'}
                    </span>
                  )}
                </span>
                {/* The estimate at rest, Planning's own outline row button on
                    hover or focus. Both share one cell, so revealing the
                    button never moves the row. Below sm there is no hover, so
                    the button simply stays, as Planning's row actions do. */}
                <span className="grid self-center pr-1">
                  <span
                    className={cn(
                      'col-start-1 row-start-1 self-center text-right font-mono text-[clamp(0.8125rem,0.7rem+0.3vw,1rem)] tabular-nums text-muted-foreground transition-opacity',
                      'max-sm:invisible',
                      busy ? 'opacity-0' : 'group-hover:opacity-0 group-focus-within:opacity-0'
                    )}
                  >
                    {item.estimateMinutes ? formatMinutes(item.estimateMinutes) : ''}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    data-focus-row={clipped ? undefined : ''}
                    tabIndex={clipped ? -1 : undefined}
                    disabled={switchingId !== null}
                    onClick={() => onSwitch(item)}
                    aria-label={`${action}: ${item.title}`}
                    className={cn(
                      // Planning's outline button, sized for a row whose title
                      // is read from across the desk rather than at arm's
                      // length: size sm next to a 24px title read as a footnote.
                      'col-start-1 row-start-1 h-10 justify-self-end px-4 text-sm transition-opacity',
                      busy
                        ? 'opacity-100'
                        : 'opacity-0 focus-visible:opacity-100 group-hover:opacity-100 max-sm:opacity-100'
                    )}
                  >
                    {busy ? 'Switching' : action}
                  </Button>
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {hidden > 0 && (
        <p className="absolute inset-x-0 bottom-0 bg-background pt-2 font-mono text-[clamp(0.8125rem,0.7rem+0.3vw,1rem)] tabular-nums text-muted-foreground [@media(min-aspect-ratio:5/4)]:left-12">
          Later today · {hidden}
        </p>
      )}
    </section>
  );
}

function AgentLine({ sessions }: { sessions: SessionListEntry[] }) {
  const first = sessions[0];
  const agent = getAgentDefinition(first.agent)?.label ?? 'An agent';
  const others = sessions.length - 1;

  return (
    <div
      role="status"
      className="mt-5 flex shrink-0 items-center gap-3 border-t border-border pt-4 text-[clamp(0.875rem,0.75rem+0.35vw,1.125rem)] sm:mt-6"
    >
      <Hand className="h-[1.15em] w-[1.15em] shrink-0 text-warning" aria-hidden="true" />
      <p className="min-w-0 flex-1 truncate">
        <span className="font-medium text-warning">{agent} needs you</span>
        <span className="text-muted-foreground"> · {first.tabTitle}</span>
        {others > 0 && (
          <span className="font-mono tabular-nums text-muted-foreground"> · {others} more waiting</span>
        )}
      </p>
      <Link
        href="/work"
        className="shrink-0 rounded-sm text-link underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        Open Work
      </Link>
    </div>
  );
}

// "13:05", in the viewer's own clock format.
function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
