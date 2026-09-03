'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@/components/ui/sonner';
import { Accordion } from '@/components/ui/accordion';
import { Card, CardContent } from '@/components/ui/card';
import { useSearch } from './SearchProvider';
import { useCommandPalette } from './CommandPaletteProvider';
import { useKeymapHelp } from './KeymapHelpProvider';
import { useRunningTimer } from './RunningTimerProvider';
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
import CommandPalette from './CommandPalette';
import ScoringReferenceDialog from './ScoringReferenceDialog';
import FirstRunCard from './FirstRunCard';
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
  setItemPriority,
  snoozeItem,
  unsnoozeItem,
  setItemDone,
  fetchSavedViews,
  fetchSourceStatuses,
  stopTimerRequest,
  fetchPlan,
  updatePlan,
  reorderPlan,
  setEstimate,
  fetchTodaySummaryFor,
  fetchCalibration,
} from '@/lib/api-client';
import { isSnoozed, SNOOZE_LABEL, type SnoozeOption } from '@/lib/snooze';
import { needsYou } from '@/lib/grouping';
import { localDateString, addDays } from '@/lib/date';
import { DEFAULT_CAPACITY_MINUTES, DEFAULT_SUGGEST_ALGORITHM, SETTINGS_KEYS } from '@/lib/config';
import { DEFAULT_LEAN, type LeanNotch, type SuggestAlgorithm, type Suggestion, type SuggestionItem } from '@/lib/suggest';
import type { CalibrationEntry } from '@/lib/calibration';
import type { ScoredItem } from '@/lib/dashboard';
import type { SprintProgress } from '@/lib/sprint';
import type { SavedView } from '@/lib/saved-views';
import type { SourceStatus } from '@/lib/sync-status';
import type { Item, Plan, PlanItem, Priority } from '@/lib/types';

const AUTO_SYNC_INTERVAL_MS = 5 * 60 * 1000;

interface DashboardData {
  today: ScoredItem[];
  signals: ScoredItem[];
  inProgress: ScoredItem[];
  parked: ScoredItem[];
  todayPlannedMinutes: number;
  todayLoggedMinutes: number;
  sprint: SprintProgress;
}

export default function Dashboard({ initialData, hasTokens }: { initialData: DashboardData; hasTokens: boolean }) {
  const [data, setData] = useState<DashboardData>(initialData);
  const [syncing, setSyncing] = useState(false);
  const [reviewDayOpen, setReviewDayOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [inProgressAccordion, setInProgressAccordion] = useState<string[]>(['in-progress']);
  const [signalsQuery, setSignalsQuery] = useState('');
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [sourceStatuses, setSourceStatuses] = useState<SourceStatus[]>([]);
  const [planDayOpen, setPlanDayOpen] = useState(false);
  // Which step and mode the wizard opens on. The two entry points differ:
  // Plan the day starts at the carry-over step in All signals, Suggest a day
  // jumps straight to the choose step with the proposal showing.
  const [planInitial, setPlanInitial] = useState<{ step: 1 | 2; mode: 'suggested' | 'all' }>({
    step: 1,
    mode: 'all',
  });
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [suggestItems, setSuggestItems] = useState<Map<number, SuggestionItem>>(new Map());
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestError, setSuggestError] = useState(false);
  const [suggestAlgorithm, setSuggestAlgorithm] = useState<SuggestAlgorithm>(
    DEFAULT_SUGGEST_ALGORITHM as SuggestAlgorithm
  );
  const [suggestLean, setSuggestLean] = useState<LeanNotch>(DEFAULT_LEAN);
  const { runningTimer, refreshRunningTimer } = useRunningTimer();
  const [switchTimerOpen, setSwitchTimerOpen] = useState(false);
  const [pendingStartId, setPendingStartId] = useState<number | null>(null);
  const [pendingStartAlsoIds, setPendingStartAlsoIds] = useState<number[]>([]);
  const [yesterdayItems, setYesterdayItems] = useState<Item[]>([]);
  const [plan, setPlan] = useState<Plan>({
    date: localDateString(new Date()),
    capacityMinutes: DEFAULT_CAPACITY_MINUTES,
    note: null,
  });
  const [planItems, setPlanItems] = useState<PlanItem[]>([]);
  const [calibration, setCalibration] = useState<CalibrationEntry[]>([]);
  const [scoringReferenceOpen, setScoringReferenceOpen] = useState(false);

  const autoSyncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);
  const prevQueryRef = useRef('');
  const prevRunningItemIdRef = useRef<number | null | undefined>(undefined);
  const preSearchAccordionRef = useRef<{ inProgress: string[] } | null>(null);
  const lastUndoRef = useRef<(() => void) | null>(null);

  const { query, setQuery } = useSearch();
  const { open: paletteOpen, setOpen: setPaletteOpen } = useCommandPalette();
  const { setOpen: setHelpOpen } = useKeymapHelp();
  const router = useRouter();

  useEffect(() => {
    fetchSavedViews().then(setSavedViews);
    const today = localDateString(new Date());
    const yesterday = addDays(today, -1);
    fetchSourceStatuses().then(setSourceStatuses);
    fetchPlan(today).then((planResponse) => {
      setPlan(planResponse.plan);
      setPlanItems(planResponse.items);
    });
    fetchTodaySummaryFor(yesterday).then((summary) => setYesterdayItems(summary.planned));
    fetchCalibration(today, today).then(setCalibration);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The running timer can be stopped from outside this component's own
  // handlers (e.g. completing the item straight from the header's ticker),
  // so watch the shared runningTimer for a transition away from an item it
  // was previously tracking and pull the dashboard lists back in sync.
  useEffect(() => {
    const currentItemId = runningTimer?.itemId ?? null;
    const prevItemId = prevRunningItemIdRef.current;
    if (prevItemId !== undefined && prevItemId !== null && prevItemId !== currentItemId) {
      refresh();
    }
    prevRunningItemIdRef.current = currentItemId;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runningTimer]);

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
    const [fresh, statuses, , planResponse, yesterdaySummary, calibrationSummary] = await Promise.all([
      fetchDashboardData(),
      fetchSourceStatuses(),
      refreshRunningTimer(),
      fetchPlan(today),
      fetchTodaySummaryFor(yesterday),
      fetchCalibration(today, today),
    ]);
    setData(fresh);
    setSourceStatuses(statuses);
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

  async function handleStart(id: number, alsoStartIds: number[] = []) {
    if (runningTimer && runningTimer.itemId !== id) {
      setPendingStartId(id);
      setPendingStartAlsoIds(alsoStartIds);
      setSwitchTimerOpen(true);
      return;
    }
    await startItem(id);
    // Linked items only advance to in_progress -- the timer stays on the
    // item the user actually clicked Start on, not the last one in this
    // loop (see the withTimer contract in lib/api-client.ts).
    for (const linkId of alsoStartIds) {
      await startItem(linkId, { withTimer: false });
    }
    await refresh();
  }

  async function handleJustStopTimer() {
    if (runningTimer) await stopTimerRequest(runningTimer.itemId);
    setSwitchTimerOpen(false);
    setPendingStartId(null);
    setPendingStartAlsoIds([]);
    await refresh();
  }

  async function handleSwitchTimer() {
    if (runningTimer) await stopTimerRequest(runningTimer.itemId);
    if (pendingStartId !== null) {
      await startItem(pendingStartId);
      for (const linkId of pendingStartAlsoIds) {
        await startItem(linkId, { withTimer: false });
      }
    }
    setSwitchTimerOpen(false);
    setPendingStartId(null);
    setPendingStartAlsoIds([]);
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

  const loadSuggestion = useCallback(async (algorithm: SuggestAlgorithm, lean: LeanNotch) => {
    setSuggestLoading(true);
    setSuggestError(false);
    try {
      const res = await fetch(`/api/suggest?algorithm=${algorithm}&lean=${lean}`);
      if (!res.ok) throw new Error('suggest failed');
      const payload = (await res.json()) as { suggestion: Suggestion; items: SuggestionItem[] };
      setSuggestion(payload.suggestion);
      setSuggestItems(new Map(payload.items.map((item) => [item.id, item])));
    } catch {
      setSuggestError(true);
    } finally {
      setSuggestLoading(false);
    }
  }, []);

  // The panel is where these are chosen, so the panel is where they persist.
  // No duplicate control in Settings to keep in sync.
  const persistSuggestSettings = useCallback((next: { algorithm?: SuggestAlgorithm; lean?: LeanNotch }) => {
    const body: Record<string, string> = {};
    if (next.algorithm) body[SETTINGS_KEYS.suggestAlgorithm] = next.algorithm;
    if (next.lean !== undefined) body[SETTINGS_KEYS.suggestLean] = String(next.lean);
    void fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }, []);

  function openPlanDay() {
    setPlanInitial({ step: 1, mode: 'all' });
    setPlanDayOpen(true);
  }

  function openSuggestDay() {
    setPlanInitial({ step: 2, mode: 'suggested' });
    setPlanDayOpen(true);
    void loadSuggestion(suggestAlgorithm, suggestLean);
  }

  function handleSuggestAlgorithmChange(algorithm: SuggestAlgorithm) {
    setSuggestAlgorithm(algorithm);
    persistSuggestSettings({ algorithm });
    void loadSuggestion(algorithm, suggestLean);
  }

  function handleSuggestLeanChange(lean: LeanNotch) {
    setSuggestLean(lean);
    persistSuggestSettings({ lean });
    void loadSuggestion(suggestAlgorithm, lean);
  }

  // Sequential, not parallel: addPlanItem derives sort_order from the current
  // maximum, so concurrent calls would race the suggested order into an
  // arbitrary one.
  async function handlePinSuggested(itemIds: number[]) {
    for (const id of itemIds) {
      await pinToday(id);
    }
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
    toast('Completed.', {
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

  async function handleSetPriority(id: number, priority: Priority | null) {
    try {
      await setItemPriority(id, priority);
    } catch (error) {
      // The refusal on a synced row carries its own wording, so show that
      // rather than a generic failure.
      toast(error instanceof Error ? error.message : 'Could not set the priority.');
      return;
    }
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

  async function handleQuickAdd(input: { title: string; dueDate?: string; priority?: Priority | null }) {
    await createAdhocItemRequest(input);
    await refresh();
  }

  async function handleDelete(id: number) {
    const result = await deleteAdhocItem(id);
    await refresh();
    if (result.error) toast(result.error);
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

  // Filtered the same way SignalsBoard filters before it counts: a snoozed or
  // triaged-done signal is not on the plate, so counting it here would make
  // the header disagree with the Signals sub-heading and list rows you cannot
  // find below.
  const needsYouItems = data.signals.filter(
    (i) => i.triageState !== 'done' && !isSnoozed(i.snoozedUntil, new Date()) && needsYou(i)
  );
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
  const isEmptyEverywhere =
    data.today.length === 0 && data.signals.length === 0 && data.inProgress.length === 0 && data.parked.length === 0;
  const isFirstRun = !hasTokens && isEmptyEverywhere;

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
      onPlanDay={openPlanDay}
      onSuggestDay={openSuggestDay}
      onQuickAdd={() => setQuickAddOpen(true)}
    >
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <SprintProgressHeader
        sprint={data.sprint}
        sourceStatuses={sourceStatuses}
        needsYouItems={needsYouItems}
        onShowNeedsYouInSignals={() => setSignalsQuery('group:waiting,blocked')}
        onRefresh={handleRefresh}
        syncing={syncing}
        onAddClick={() => setQuickAddOpen(true)}
      />
      <QuickAddForm open={quickAddOpen} onOpenChange={setQuickAddOpen} onSubmit={handleQuickAdd} />
      {isFirstRun ? (
        <FirstRunCard onAddClick={() => setQuickAddOpen(true)} />
      ) : (
        <>
          {!hasAnyMatch && <p className="text-sm text-muted-foreground">No matches for &ldquo;{trimmedQuery}&rdquo;.</p>}
          <TodaySection
            items={data.today}
            plannedMinutes={data.todayPlannedMinutes}
            loggedMinutes={data.todayLoggedMinutes}
            capacityMinutes={plan.capacityMinutes}
            onStart={handleStart}
            onComplete={handleComplete}
            onOpenClaude={handleOpenClaude}
            onDelete={handleDelete}
            onPark={handlePark}
            onUnpark={handleUnpark}
            onUnpinToday={handleUnpinToday}
            onSetPriority={handleSetPriority}
            onPlanDay={openPlanDay}
            onSuggestDay={openSuggestDay}
            onReorder={handleReorderToday}
            failingSources={failingSources}
            onOpenScoringReference={() => setScoringReferenceOpen(true)}
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
                  onSetPriority={handleSetPriority}
                  failingSources={failingSources}
                  onOpenScoringReference={() => setScoringReferenceOpen(true)}
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
            onSetPriority={handleSetPriority}
            onSnooze={handleSnooze}
            onUnsnooze={handleUnsnooze}
            onDone={handleDone}
            currentSprintIteration={data.sprint.name}
            queryText={signalsQuery}
            onQueryTextChange={setSignalsQuery}
            savedViews={savedViews}
            onSavedViewsChange={setSavedViews}
            onOpenScoringReference={() => setScoringReferenceOpen(true)}
          />
        </>
      )}
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
        initialStep={planInitial.step}
        initialStep2Mode={planInitial.mode}
        suggest={{
          suggestion,
          itemsById: suggestItems,
          loading: suggestLoading,
          error: suggestError,
          algorithm: suggestAlgorithm,
          lean: suggestLean,
          onAlgorithmChange: handleSuggestAlgorithmChange,
          onLeanChange: handleSuggestLeanChange,
          onRetry: () => void loadSuggestion(suggestAlgorithm, suggestLean),
          onPin: handlePinSuggested,
        }}
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
        onOpenScoringReference={() => setScoringReferenceOpen(true)}
      />
      <SwitchTimerDialog
        open={switchTimerOpen}
        onOpenChange={setSwitchTimerOpen}
        currentTitle={runningTimer?.itemTitle ?? ''}
        onJustStop={handleJustStopTimer}
        onSwitch={handleSwitchTimer}
      />
      <ScoringReferenceDialog open={scoringReferenceOpen} onOpenChange={setScoringReferenceOpen} />
      <CommandPalette
        open={paletteOpen}
        onOpenChange={(next) => {
          setPaletteOpen(next);
          if (!next) setQuery('');
        }}
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
        onOpenScoringReference={() => setScoringReferenceOpen(true)}
        onOpenHelp={() => setHelpOpen(true)}
        onQuickAdd={() => setQuickAddOpen(true)}
      />
    </main>
    </GlobalKeymapProvider>
  );
}
