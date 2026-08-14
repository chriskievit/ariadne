'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@/components/ui/sonner';
import { Accordion } from '@/components/ui/accordion';
import { Card, CardContent } from '@/components/ui/card';
import { useSearch } from './SearchProvider';
import { useCommandPalette } from './CommandPaletteProvider';
import { matchesQuery } from '@/lib/search';
import SprintProgressHeader from './SprintProgressHeader';
import ItemSection from './ItemSection';
import SignalsBoard from './SignalsBoard';
import QuickAddForm from './QuickAddForm';
import TodaySection from './TodaySection';
import ShutdownDialog from './ShutdownDialog';
import PlanDayDialog from './PlanDayDialog';
import SwitchTimerDialog from './SwitchTimerDialog';
import GlobalKeymapProvider from './GlobalKeymapProvider';
import KeymapHelpDialog from './KeymapHelpDialog';
import CommandPalette from './CommandPalette';
import {
  fetchDashboardData,
  triggerSync,
  startItem,
  completeItem,
  undoItem,
  requeueItem,
  parkItem,
  unparkItem,
  createAdhocItemRequest,
  deleteAdhocItem,
  openInClaude,
  pinToday,
  unpinToday,
  starItem,
  snoozeItem,
  unsnoozeItem,
  setItemDone,
  fetchSavedViews,
  fetchSourceStatuses,
  fetchRunningTimer,
  stopTimerRequest,
  fetchPlan,
  updatePlan,
  reorderPlan,
  setEstimate,
  fetchTodaySummaryFor,
  fetchCalibration,
} from '@/lib/api-client';
import { SNOOZE_LABEL, type SnoozeOption } from '@/lib/snooze';
import { groupOf } from '@/lib/grouping';
import { localDateString, addDays } from '@/lib/date';
import { DEFAULT_CAPACITY_MINUTES } from '@/lib/config';
import type { RunningTimer } from '@/lib/time-logs-repo';
import type { CalibrationEntry } from '@/lib/calibration';
import type { ScoredItem } from '@/lib/dashboard';
import type { SprintProgress } from '@/lib/sprint';
import type { SavedView } from '@/lib/saved-views';
import type { SourceStatus } from '@/lib/sync-status';
import type { Item, Plan, PlanItem } from '@/lib/types';

const AUTO_SYNC_INTERVAL_MS = 5 * 60 * 1000;

interface DashboardData {
  today: ScoredItem[];
  signals: ScoredItem[];
  inProgress: ScoredItem[];
  parked: ScoredItem[];
  sprint: SprintProgress;
}

export default function Dashboard({ initialData }: { initialData: DashboardData }) {
  const [data, setData] = useState<DashboardData>(initialData);
  const [syncing, setSyncing] = useState(false);
  const [reviewDayOpen, setReviewDayOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [inProgressAccordion, setInProgressAccordion] = useState<string[]>(['in-progress']);
  const [helpOpen, setHelpOpen] = useState(false);
  const [signalsQuery, setSignalsQuery] = useState('');
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [sourceStatuses, setSourceStatuses] = useState<SourceStatus[]>([]);
  const [planDayOpen, setPlanDayOpen] = useState(false);
  const [runningTimer, setRunningTimer] = useState<RunningTimer | null>(null);
  const [switchTimerOpen, setSwitchTimerOpen] = useState(false);
  const [pendingStartId, setPendingStartId] = useState<number | null>(null);
  const [yesterdayItems, setYesterdayItems] = useState<Item[]>([]);
  const [plan, setPlan] = useState<Plan>({
    date: localDateString(new Date()),
    capacityMinutes: DEFAULT_CAPACITY_MINUTES,
    note: null,
  });
  const [planItems, setPlanItems] = useState<PlanItem[]>([]);
  const [calibration, setCalibration] = useState<CalibrationEntry[]>([]);

  const autoSyncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);
  const prevQueryRef = useRef('');
  const preSearchAccordionRef = useRef<{ inProgress: string[] } | null>(null);
  const lastUndoRef = useRef<(() => void) | null>(null);

  const { query, setQuery } = useSearch();
  const { open: paletteOpen, setOpen: setPaletteOpen } = useCommandPalette();
  const router = useRouter();

  useEffect(() => {
    fetchSavedViews().then(setSavedViews);
    const today = localDateString(new Date());
    const yesterday = addDays(today, -1);
    fetchSourceStatuses().then(setSourceStatuses);
    fetchRunningTimer().then(setRunningTimer);
    fetchPlan(today).then((planResponse) => {
      setPlan(planResponse.plan);
      setPlanItems(planResponse.items);
    });
    fetchTodaySummaryFor(yesterday).then((summary) => setYesterdayItems(summary.planned));
    fetchCalibration(today, today).then(setCalibration);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function scheduleAutoSync() {
    if (!isMountedRef.current) return;
    if (autoSyncTimeoutRef.current) clearTimeout(autoSyncTimeoutRef.current);
    autoSyncTimeoutRef.current = setTimeout(() => {
      handleRefresh();
    }, AUTO_SYNC_INTERVAL_MS);
  }

  async function refresh() {
    const today = localDateString(new Date());
    const yesterday = addDays(today, -1);
    const [fresh, statuses, timer, planResponse, yesterdaySummary, calibrationSummary] = await Promise.all([
      fetchDashboardData(),
      fetchSourceStatuses(),
      fetchRunningTimer(),
      fetchPlan(today),
      fetchTodaySummaryFor(yesterday),
      fetchCalibration(today, today),
    ]);
    setData(fresh);
    setSourceStatuses(statuses);
    setRunningTimer(timer);
    setPlan(planResponse.plan);
    setPlanItems(planResponse.items);
    setYesterdayItems(yesterdaySummary.planned);
    setCalibration(calibrationSummary);
  }

  async function handleRefresh() {
    setSyncing(true);
    try {
      await triggerSync();
      await refresh();
    } finally {
      setSyncing(false);
      scheduleAutoSync();
    }
  }

  async function handleStart(id: number) {
    if (runningTimer && runningTimer.itemId !== id) {
      setPendingStartId(id);
      setSwitchTimerOpen(true);
      return;
    }
    await startItem(id);
    await refresh();
  }

  async function handleJustStopTimer() {
    if (runningTimer) await stopTimerRequest(runningTimer.itemId);
    setSwitchTimerOpen(false);
    setPendingStartId(null);
    await refresh();
  }

  async function handleSwitchTimer() {
    if (runningTimer) await stopTimerRequest(runningTimer.itemId);
    if (pendingStartId !== null) await startItem(pendingStartId);
    setSwitchTimerOpen(false);
    setPendingStartId(null);
    await refresh();
  }

  async function handleReorderToday(orderedItemIds: number[]) {
    const today = localDateString(new Date());
    await reorderPlan(today, orderedItemIds);
    await refresh();
  }

  async function handleSetEstimate(id: number, minutes: number | null) {
    await setEstimate(localDateString(new Date()), id, minutes);
    await refresh();
  }

  async function handleSetCapacity(minutes: number) {
    await updatePlan(localDateString(new Date()), { capacityMinutes: minutes });
    await refresh();
  }

  async function handleRequeue(id: number) {
    await requeueItem(id);
    await refresh();
  }

  async function handlePark(id: number) {
    await parkItem(id);
    await refresh();
  }

  async function handleUnpark(id: number) {
    await unparkItem(id);
    await refresh();
  }

  async function handlePinToday(id: number) {
    await pinToday(id);
    await refresh();
  }

  async function handleUnpinToday(id: number) {
    await unpinToday(id);
    await refresh();
  }

  async function handleOpenClaude(id: number, workingDir?: string) {
    const result = await openInClaude(id, workingDir);
    if (result.warpUrl) {
      window.location.href = result.warpUrl;
    } else {
      toast(result.error ?? 'Could not open Claude session.');
    }
  }

  async function handleComplete(id: number, durationHours: number, note?: string) {
    await completeItem(id, { durationHours, note });
    await refresh();
    toast('Marked complete.', {
      duration: 5000,
      action: {
        label: 'Undo',
        onClick: async () => {
          await undoItem(id);
          await refresh();
        },
      },
    });
  }

  async function handleStar(id: number, starred: boolean) {
    await starItem(id, starred);
    await refresh();
  }

  async function handleSnooze(id: number, option: SnoozeOption) {
    await snoozeItem(id, option);
    await refresh();
    const undo = async () => {
      await unsnoozeItem(id);
      await refresh();
    };
    lastUndoRef.current = () => {
      undo();
    };
    toast(`Snoozed — ${SNOOZE_LABEL[option]}`, {
      duration: 10_000,
      action: { label: 'Undo', onClick: undo },
    });
  }

  async function handleUnsnooze(id: number) {
    await unsnoozeItem(id);
    await refresh();
  }

  async function handleDone(id: number, done: boolean) {
    await setItemDone(id, done);
    await refresh();
    if (done) {
      const undo = async () => {
        await setItemDone(id, false);
        await refresh();
      };
      lastUndoRef.current = () => {
        undo();
      };
      toast('Marked done locally.', {
        duration: 10_000,
        action: { label: 'Undo', onClick: undo },
      });
    }
  }

  async function handleQuickAdd(input: { title: string; category?: string; dueDate?: string }) {
    await createAdhocItemRequest(input);
    await refresh();
  }

  async function handleDelete(id: number) {
    await deleteAdhocItem(id);
    await refresh();
  }

  useEffect(() => {
    isMountedRef.current = true;
    scheduleAutoSync();
    return () => {
      isMountedRef.current = false;
      if (autoSyncTimeoutRef.current) clearTimeout(autoSyncTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-expand a collapsed section as soon as it contains a search match,
  // but never auto-collapse one — closing sections mid-type would be
  // disorienting. Whatever was expanded before the search started is
  // restored once the query is cleared.
  useEffect(() => {
    const trimmed = query.trim();
    const isSearching = trimmed !== '';
    const wasSearching = prevQueryRef.current.trim() !== '';

    if (isSearching && !wasSearching) {
      preSearchAccordionRef.current = { inProgress: inProgressAccordion };
    }

    if (isSearching) {
      const inProgressHasMatch =
        data.inProgress.some((i) => matchesQuery(i.title, trimmed)) ||
        data.parked.some((i) => matchesQuery(i.title, trimmed));
      if (inProgressHasMatch) {
        setInProgressAccordion((prev) => (prev.includes('in-progress') ? prev : [...prev, 'in-progress']));
      }
    } else if (wasSearching && preSearchAccordionRef.current) {
      setInProgressAccordion(preSearchAccordionRef.current.inProgress);
      preSearchAccordionRef.current = null;
    }

    prevQueryRef.current = query;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, data]);

  const needsYouCount = data.signals.filter((i) => groupOf(i) === 'blocked' || groupOf(i) === 'waiting_on_you').length;
  const SOURCE_STATUS_TO_ITEM_SOURCE: Record<SourceStatus['source'], Item['source']> = {
    github: 'github_pr',
    ado: 'ado_workitem',
  };
  const failingSources = new Set(
    sourceStatuses
      .filter((s) => s.state === 'error' || s.state === 'partial')
      .map((s) => SOURCE_STATUS_TO_ITEM_SOURCE[s.source])
  );

  const trimmedQuery = query.trim();
  const hasAnyMatch =
    trimmedQuery === '' ||
    [...data.today, ...data.signals, ...data.inProgress, ...data.parked].some((i) => matchesQuery(i.title, trimmedQuery));

  return (
    <GlobalKeymapProvider
      onOpenPalette={() => setPaletteOpen(true)}
      onFocusQueryBar={() => document.getElementById('query-bar-input')?.focus()}
      onUndo={() => lastUndoRef.current?.()}
      onRefresh={handleRefresh}
      onWrapUp={() => setReviewDayOpen(true)}
      onOpenHelp={() => setHelpOpen(true)}
      onGoToDashboard={() => router.push('/')}
      onGoToSettings={() => router.push('/settings')}
      onPlanDay={() => setPlanDayOpen(true)}
    >
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <SprintProgressHeader
        sprint={data.sprint}
        sourceStatuses={sourceStatuses}
        needsYouCount={needsYouCount}
        onRefresh={handleRefresh}
        syncing={syncing}
        onAddClick={() => setQuickAddOpen(true)}
      />
      <QuickAddForm open={quickAddOpen} onOpenChange={setQuickAddOpen} onSubmit={handleQuickAdd} />
      {!hasAnyMatch && <p className="text-sm text-muted-foreground">No matches for &ldquo;{trimmedQuery}&rdquo;.</p>}
      <TodaySection
        items={data.today}
        capacityMinutes={plan.capacityMinutes}
        onStart={handleStart}
        onComplete={handleComplete}
        onOpenClaude={handleOpenClaude}
        onDelete={handleDelete}
        onUnpinToday={handleUnpinToday}
        onPlanDay={() => setPlanDayOpen(true)}
        onReorder={handleReorderToday}
        failingSources={failingSources}
      />
      <Card>
        <CardContent className="pt-6">
          <Accordion type="multiple" value={inProgressAccordion} onValueChange={setInProgressAccordion}>
            <ItemSection
              value="in-progress"
              title="In progress"
              items={data.inProgress}
              parkedItems={data.parked}
              emptyMessage="Nothing in progress — start something above."
              onComplete={handleComplete}
              onOpenClaude={handleOpenClaude}
              onDelete={handleDelete}
              onRequeue={handleRequeue}
              onPark={handlePark}
              onUnpark={handleUnpark}
              failingSources={failingSources}
            />
          </Accordion>
        </CardContent>
      </Card>
      <SignalsBoard
        items={data.signals}
        onStart={handleStart}
        onComplete={handleComplete}
        onOpenClaude={handleOpenClaude}
        onDelete={handleDelete}
        onPinToday={handlePinToday}
        failingSources={failingSources}
        onStar={handleStar}
        onSnooze={handleSnooze}
        onUnsnooze={handleUnsnooze}
        onDone={handleDone}
        currentSprintIteration={data.sprint.name}
        queryText={signalsQuery}
        onQueryTextChange={setSignalsQuery}
        savedViews={savedViews}
        onSavedViewsChange={setSavedViews}
      />
      <ShutdownDialog
        open={reviewDayOpen}
        onOpenChange={setReviewDayOpen}
        onCarried={refresh}
        onSnooze={handleSnooze}
        onDrop={handleUnpinToday}
        calibration={calibration}
      />
      <PlanDayDialog
        open={planDayOpen}
        onOpenChange={setPlanDayOpen}
        today={data.today}
        signals={data.signals}
        yesterday={yesterdayItems}
        plan={plan}
        planItems={planItems}
        onKeep={handlePinToday}
        onSnooze={handleSnooze}
        onDone={handleDone}
        onDrop={handleUnpinToday}
        onAdd={handlePinToday}
        onSetEstimate={handleSetEstimate}
        onReorder={handleReorderToday}
        onSetCapacity={handleSetCapacity}
        calibration={calibration}
      />
      <SwitchTimerDialog
        open={switchTimerOpen}
        onOpenChange={setSwitchTimerOpen}
        currentTitle={runningTimer?.itemTitle ?? ''}
        onJustStop={handleJustStopTimer}
        onSwitch={handleSwitchTimer}
      />
      <KeymapHelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        items={data.signals}
        savedViews={savedViews}
        search={query}
        onSearchChange={setQuery}
        onSelectItem={(item) => {
          if (item.url) window.open(item.url, '_blank', 'noopener,noreferrer');
        }}
        onSelectQuery={setSignalsQuery}
        onGoToDashboard={() => router.push('/')}
        onGoToSettings={() => router.push('/settings')}
        onWrapUp={() => setReviewDayOpen(true)}
      />
    </main>
    </GlobalKeymapProvider>
  );
}
