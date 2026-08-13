'use client';

import { Loader2, Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { formatRelativeTime } from '@/lib/utils';
import type { SprintProgress } from '@/lib/sprint';

interface Props {
  sprint: SprintProgress;
  onRefresh: () => void;
  syncing: boolean;
  errors: string[];
  onAddClick: () => void;
}

export default function SprintProgressHeader({ sprint, onRefresh, syncing, errors, onAddClick }: Props) {
  const daysRemaining = sprint.endDate
    ? Math.max(0, Math.ceil((new Date(sprint.endDate).getTime() - Date.now()) / 86_400_000))
    : null;
  const percent = sprint.totalCount > 0 ? Math.round((sprint.completedCount / sprint.totalCount) * 100) : 0;
  const lastSyncedLabel = sprint.lastSyncedAt
    ? `Last synced: ${formatRelativeTime(new Date(sprint.lastSyncedAt).getTime())}`
    : 'Never synced';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{sprint.name ?? 'No active sprint'}</span>
          {' · '}
          {sprint.completedCount}/{sprint.totalCount} done
          {daysRemaining !== null ? ` · ${daysRemaining} days left` : ''}
          {' · '}
          {lastSyncedLabel}
        </p>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Add ad-hoc item"
            title="Add ad-hoc item"
            onClick={onAddClick}
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button type="button" onClick={onRefresh} disabled={syncing}>
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {syncing ? 'Syncing…' : 'Refresh'}
          </Button>
        </div>
      </div>
      <Progress value={percent} className="h-[2px]" />
      {errors.length > 0 && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {errors.map((error) => (
            <p key={error}>{error}</p>
          ))}
        </div>
      )}
    </div>
  );
}
