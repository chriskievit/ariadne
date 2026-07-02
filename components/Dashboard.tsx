'use client';

import { useState } from 'react';
import { toast } from '@/components/ui/sonner';
import SprintProgressHeader from './SprintProgressHeader';
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

  async function handleComplete(id: number, durationMinutes?: number) {
    await completeItem(id, { durationMinutes });
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
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <SprintProgressHeader sprint={data.sprint} onRefresh={handleRefresh} syncing={syncing} errors={syncErrors} />
    </main>
  );
}
