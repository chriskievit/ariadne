'use client';

import Link from 'next/link';
import { BarChart3, Loader2, RefreshCw, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ThemeToggle } from '@/components/theme-toggle';
import type { SprintProgress } from '@/lib/sprint';

interface Props {
  sprint: SprintProgress;
  onRefresh: () => void;
  syncing: boolean;
  errors: string[];
}

export default function SprintProgressHeader({ sprint, onRefresh, syncing, errors }: Props) {
  const daysRemaining = sprint.endDate
    ? Math.max(0, Math.ceil((new Date(sprint.endDate).getTime() - Date.now()) / 86_400_000))
    : null;
  const percent = sprint.totalCount > 0 ? Math.round((sprint.completedCount / sprint.totalCount) * 100) : 0;
  const lastSyncedLabel = sprint.lastSyncedAt
    ? (() => {
        const minutesAgo = Math.round((Date.now() - new Date(sprint.lastSyncedAt as string).getTime()) / 60_000);
        return `Last synced: ${minutesAgo === 0 ? 'just now' : `${minutesAgo} min ago`}`;
      })()
    : 'Never synced';

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">{sprint.name ?? 'No active sprint'}</h1>
            <p className="text-sm text-muted-foreground">
              {sprint.completedCount}/{sprint.totalCount} done
              {daysRemaining !== null ? ` · ${daysRemaining} days remaining` : ''}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button type="button" onClick={onRefresh} disabled={syncing}>
              {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {syncing ? 'Syncing…' : 'Refresh'}
            </Button>
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
            <ThemeToggle />
          </div>
        </div>
        <Progress value={percent} />
        <p className="text-xs text-muted-foreground">{lastSyncedLabel}</p>
        {errors.length > 0 && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {errors.map((error) => (
              <p key={error}>{error}</p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
