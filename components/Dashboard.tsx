'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from '@/components/ui/sonner';
import { Accordion } from '@/components/ui/accordion';
import { Card, CardContent } from '@/components/ui/card';
import { useSearch } from './SearchProvider';
import { matchesQuery } from '@/lib/search';
import SprintProgressHeader from './SprintProgressHeader';
import ItemSection from './ItemSection';
import NeedsAttentionBoard from './NeedsAttentionBoard';
import QuickAddForm from './QuickAddForm';
import TodaySection from './TodaySection';
import ShutdownDialog from './ShutdownDialog';
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
} from '@/lib/api-client';
import type { ScoredItem } from '@/lib/dashboard';
import type { SprintProgress } from '@/lib/sprint';

const AUTO_SYNC_INTERVAL_MS = 5 * 60 * 1000;

interface DashboardData {
  today: ScoredItem[];
  needsAttention: ScoredItem[];
  inProgress: ScoredItem[];
  parked: ScoredItem[];
  everythingElse: ScoredItem[];
  sprint: SprintProgress;
}

export default function Dashboard({ initialData }: { initialData: DashboardData }) {
  const [data, setData] = useState<DashboardData>(initialData);
  const [syncing, setSyncing] = useState(false);
  const [syncErrors, setSyncErrors] = useState<string[]>([]);
  const [reviewDayOpen, setReviewDayOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [inProgressAccordion, setInProgressAccordion] = useState<string[]>(['in-progress']);
  const [everythingElseAccordion, setEverythingElseAccordion] = useState<string[]>([]);

  const autoSyncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);
  const prevQueryRef = useRef('');
  const preSearchAccordionRef = useRef<{ inProgress: string[]; everythingElse: string[] } | null>(null);

  const { query } = useSearch();

  function scheduleAutoSync() {
    if (!isMountedRef.current) return;
    if (autoSyncTimeoutRef.current) clearTimeout(autoSyncTimeoutRef.current);
    autoSyncTimeoutRef.current = setTimeout(() => {
      handleRefresh();
    }, AUTO_SYNC_INTERVAL_MS);
  }

  async function refresh() {
    const fresh = await fetchDashboardData();
    setData(fresh);
  }

  async function handleRefresh() {
    setSyncing(true);
    setSyncErrors([]);
    try {
      const { outcomes } = await triggerSync();
      setSyncErrors(outcomes.filter((o: any) => o.error).map((o: any) => `${o.source}: ${o.error}`));
      await refresh();
    } catch (err) {
      setSyncErrors([`Sync failed: ${err instanceof Error ? err.message : 'unknown error'}`]);
    } finally {
      setSyncing(false);
      scheduleAutoSync();
    }
  }

  async function handleStart(id: number) {
    await startItem(id);
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
      preSearchAccordionRef.current = {
        inProgress: inProgressAccordion,
        everythingElse: everythingElseAccordion,
      };
    }

    if (isSearching) {
      const inProgressHasMatch =
        data.inProgress.some((i) => matchesQuery(i.title, trimmed)) ||
        data.parked.some((i) => matchesQuery(i.title, trimmed));
      if (inProgressHasMatch) {
        setInProgressAccordion((prev) => (prev.includes('in-progress') ? prev : [...prev, 'in-progress']));
      }
      const everythingElseHasMatch = data.everythingElse.some((i) => matchesQuery(i.title, trimmed));
      if (everythingElseHasMatch) {
        setEverythingElseAccordion((prev) => (prev.includes('everything-else') ? prev : [...prev, 'everything-else']));
      }
    } else if (wasSearching && preSearchAccordionRef.current) {
      setInProgressAccordion(preSearchAccordionRef.current.inProgress);
      setEverythingElseAccordion(preSearchAccordionRef.current.everythingElse);
      preSearchAccordionRef.current = null;
    }

    prevQueryRef.current = query;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, data]);

  const trimmedQuery = query.trim();
  const hasAnyMatch =
    trimmedQuery === '' ||
    [...data.today, ...data.needsAttention, ...data.inProgress, ...data.parked, ...data.everythingElse].some((i) =>
      matchesQuery(i.title, trimmedQuery)
    );

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <SprintProgressHeader
        sprint={data.sprint}
        onRefresh={handleRefresh}
        syncing={syncing}
        errors={syncErrors}
        onAddClick={() => setQuickAddOpen(true)}
      />
      <QuickAddForm open={quickAddOpen} onOpenChange={setQuickAddOpen} onSubmit={handleQuickAdd} />
      {!hasAnyMatch && <p className="text-sm text-muted-foreground">No matches for &ldquo;{trimmedQuery}&rdquo;.</p>}
      <TodaySection
        items={data.today}
        onStart={handleStart}
        onComplete={handleComplete}
        onOpenClaude={handleOpenClaude}
        onDelete={handleDelete}
        onUnpinToday={handleUnpinToday}
        onReviewDay={() => setReviewDayOpen(true)}
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
            />
          </Accordion>
        </CardContent>
      </Card>
      <NeedsAttentionBoard
        items={data.needsAttention}
        onStart={handleStart}
        onComplete={handleComplete}
        onOpenClaude={handleOpenClaude}
        onDelete={handleDelete}
        onPinToday={handlePinToday}
      />
      <Card>
        <CardContent className="pt-6">
          <Accordion type="multiple" value={everythingElseAccordion} onValueChange={setEverythingElseAccordion}>
            <ItemSection
              value="everything-else"
              title="Everything else"
              items={data.everythingElse}
              emptyMessage="Nothing else queued."
              onStart={handleStart}
              onComplete={handleComplete}
              onOpenClaude={handleOpenClaude}
              onDelete={handleDelete}
              onPinToday={handlePinToday}
            />
          </Accordion>
        </CardContent>
      </Card>
      <ShutdownDialog open={reviewDayOpen} onOpenChange={setReviewDayOpen} onCarried={refresh} />
    </main>
  );
}
