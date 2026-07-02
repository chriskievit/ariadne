'use client';

import { useState } from 'react';
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
  createAdhocItemRequest,
} from '@/lib/api-client';
import type { Item } from '@/lib/types';
import type { SprintProgress } from '@/lib/sprint';

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
    } finally {
      setSyncing(false);
    }
  }

  async function handleStart(id: number) {
    await startItem(id);
    await refresh();
  }

  async function handleComplete(id: number, durationMinutes?: number, note?: string) {
    await completeItem(id, { durationMinutes, note });
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

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <SprintProgressHeader sprint={data.sprint} onRefresh={handleRefresh} syncing={syncing} errors={syncErrors} />
      <NeedsAttentionBoard items={data.needsAttention} onStart={handleStart} onComplete={handleComplete} />
      <Card>
        <CardContent className="pt-6">
          <Accordion type="multiple" defaultValue={['in-progress']}>
            <ItemSection
              value="in-progress"
              title="In progress"
              items={data.inProgress}
              emptyMessage="Nothing in progress — start something above."
              onComplete={handleComplete}
            />
            <ItemSection
              value="everything-else"
              title="Everything else"
              items={data.everythingElse}
              emptyMessage="Nothing else queued."
              onStart={handleStart}
              onComplete={handleComplete}
            />
          </Accordion>
        </CardContent>
      </Card>
      <QuickAddForm onSubmit={handleQuickAdd} />
    </main>
  );
}
