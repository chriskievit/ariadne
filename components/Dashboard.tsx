'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from '@/components/ui/sonner';
import { Accordion } from '@/components/ui/accordion';
import { Card, CardContent } from '@/components/ui/card';
import SprintProgressHeader from './SprintProgressHeader';
import ItemSection from './ItemSection';
import NeedsAttentionBoard from './NeedsAttentionBoard';
import QuickAddForm from './QuickAddForm';
import {
  fetchDashboardData,
  triggerSync,
  startItem,
  completeItem,
  undoItem,
  requeueItem,
  createAdhocItemRequest,
  deleteAdhocItem,
  openInClaude,
} from '@/lib/api-client';
import type { Item } from '@/lib/types';
import type { SprintProgress } from '@/lib/sprint';

const AUTO_SYNC_INTERVAL_MS = 5 * 60 * 1000;

type ScoredItem = Item & { score: number };

interface DashboardData {
  needsAttention: ScoredItem[];
  inProgress: ScoredItem[];
  everythingElse: ScoredItem[];
  sprint: SprintProgress;
}

export default function Dashboard({ initialData }: { initialData: DashboardData }) {
  const [data, setData] = useState<DashboardData>(initialData);
  const [syncing, setSyncing] = useState(false);
  const [syncErrors, setSyncErrors] = useState<string[]>([]);

  const autoSyncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

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

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <QuickAddForm onSubmit={handleQuickAdd} />
      <SprintProgressHeader sprint={data.sprint} onRefresh={handleRefresh} syncing={syncing} errors={syncErrors} />
      <Card>
        <CardContent className="pt-6">
          <Accordion type="multiple" defaultValue={['in-progress']}>
            <ItemSection
              value="in-progress"
              title="In progress"
              items={data.inProgress}
              emptyMessage="Nothing in progress — start something above."
              onComplete={handleComplete}
              onOpenClaude={handleOpenClaude}
              onDelete={handleDelete}
              onRequeue={handleRequeue}
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
      />
      <Card>
        <CardContent className="pt-6">
          <Accordion type="multiple" defaultValue={['everything-else']}>
            <ItemSection
              value="everything-else"
              title="Everything else"
              items={data.everythingElse}
              emptyMessage="Nothing else queued."
              onStart={handleStart}
              onComplete={handleComplete}
              onOpenClaude={handleOpenClaude}
              onDelete={handleDelete}
            />
          </Accordion>
        </CardContent>
      </Card>
    </main>
  );
}
