'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { fetchRunningTimer } from '@/lib/api-client';
import type { RunningTimer } from '@/lib/time-logs-repo';

const RUNNING_TIMER_POLL_MS = 5000;

interface RunningTimerContextValue {
  runningTimer: RunningTimer | null;
  refreshRunningTimer: () => Promise<RunningTimer | null>;
}

const RunningTimerContext = createContext<RunningTimerContextValue | null>(null);

// A single poller + a single piece of state shared by every consumer (the
// header's live chip, the dashboard's start/switch-timer logic, ...) so that
// an action taken in one place (e.g. parking an item from its row menu)
// updates everyone else immediately via refreshRunningTimer(), instead of
// each consumer keeping its own copy that only catches up on its own next
// poll tick.
export function RunningTimerProvider({ children }: { children: React.ReactNode }) {
  const [runningTimer, setRunningTimer] = useState<RunningTimer | null>(null);

  const refreshRunningTimer = useCallback(async () => {
    const timer = await fetchRunningTimer();
    setRunningTimer(timer);
    return timer;
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

  return (
    <RunningTimerContext.Provider value={{ runningTimer, refreshRunningTimer }}>
      {children}
    </RunningTimerContext.Provider>
  );
}

export function useRunningTimer(): RunningTimerContextValue {
  const ctx = useContext(RunningTimerContext);
  if (!ctx) throw new Error('useRunningTimer must be used within a RunningTimerProvider');
  return ctx;
}
