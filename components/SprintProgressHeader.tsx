'use client';

import { Loader2, Plus, RefreshCw, CircleCheck, CircleAlert, CircleX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { formatRelativeTime } from '@/lib/utils';
import { classifyError, type SourceStatus } from '@/lib/sync-status';
import type { SprintProgress } from '@/lib/sprint';

interface Props {
  sprint: SprintProgress;
  sourceStatuses: SourceStatus[];
  needsYouCount: number;
  onRefresh: () => void;
  syncing: boolean;
  onAddClick: () => void;
}

const SOURCE_LABEL: Record<SourceStatus['source'], string> = { github: 'GitHub', ado: 'Azure DevOps' };

const STATE_ICON = { ok: CircleCheck, stale: CircleAlert, error: CircleX, partial: CircleAlert } as const;
const STATE_TEXT_CLASS = {
  ok: 'text-muted-foreground',
  stale: 'text-warning',
  error: 'text-destructive',
  partial: 'text-warning',
} as const;

function SourceChip({ status }: { status: SourceStatus }) {
  const Icon = STATE_ICON[status.state];
  const label =
    status.state === 'error' || status.state === 'partial'
      ? `${SOURCE_LABEL[status.source]} failed`
      : status.lastSyncedAt
        ? `${SOURCE_LABEL[status.source]} ${formatRelativeTime(new Date(status.lastSyncedAt).getTime())}`
        : `${SOURCE_LABEL[status.source]} never synced`;
  return (
    <span className={`flex items-center gap-1 text-xs ${STATE_TEXT_CLASS[status.state]}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </span>
  );
}

export default function SprintProgressHeader({
  sprint,
  sourceStatuses,
  needsYouCount,
  onRefresh,
  syncing,
  onAddClick,
}: Props) {
  const daysRemaining = sprint.endDate
    ? Math.max(0, Math.ceil((new Date(sprint.endDate).getTime() - Date.now()) / 86_400_000))
    : null;
  const percentDone = sprint.totalCount > 0 ? Math.round((sprint.completedCount / sprint.totalCount) * 100) : 0;
  const percentElapsed =
    sprint.startDate && sprint.endDate
      ? Math.min(
          100,
          Math.max(
            0,
            Math.round(
              ((Date.now() - new Date(sprint.startDate).getTime()) /
                (new Date(sprint.endDate).getTime() - new Date(sprint.startDate).getTime())) *
                100
            )
          )
        )
      : null;

  const failing = sourceStatuses.filter((s) => s.state === 'error' || s.state === 'partial');

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="min-w-0 truncate text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{sprint.name ?? 'No active sprint'}</span>
            {' · '}
            <span className="font-mono tabular-nums">
              {sprint.completedCount}/{sprint.totalCount}
            </span>{' '}
            sprint items done
            {daysRemaining !== null ? (
              <>
                {' · '}
                <span className="font-mono tabular-nums">{daysRemaining}</span> days left
              </>
            ) : (
              ''
            )}
            {' · '}
            <span className="text-warning">
              <span className="font-mono tabular-nums">{needsYouCount}</span> waiting on you
            </span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {sourceStatuses.map((status) => (
            <SourceChip key={status.source} status={status} />
          ))}
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
          <Button type="button" variant="ghost" onClick={onRefresh} disabled={syncing}>
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {syncing ? 'Syncing…' : 'Refresh'}
          </Button>
        </div>
      </div>
      <div className="relative">
        <Progress value={percentDone} className="h-[3px]" aria-valuenow={percentDone} role="progressbar" />
        {percentElapsed !== null && (
          <div
            className="absolute top-0 h-[3px] w-px bg-foreground"
            style={{ left: `${percentElapsed}%` }}
            aria-hidden="true"
          />
        )}
        <span className="sr-only">
          {sprint.completedCount} of {sprint.totalCount} sprint items done, {percentElapsed ?? 0}% of the sprint elapsed
        </span>
      </div>
      {failing.map((status) => {
        const { cause, remedy } = classifyError(status.lastError ?? '', SOURCE_LABEL[status.source]);
        const ageLabel = status.lastSyncedAt ? formatRelativeTime(new Date(status.lastSyncedAt).getTime()) : 'never';
        return (
          <div key={status.source} className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
            <p>
              <span className="font-medium">
                {SOURCE_LABEL[status.source]}{' '}
                {cause === 'auth'
                  ? 'rejected the token'
                  : cause === 'rate_limit'
                    ? 'rate limit was hit'
                    : cause === 'network'
                      ? 'could not be reached'
                      : 'failed to sync'}
                .
              </span>{' '}
              {status.lastSyncedAt
                ? `The items below were read ${ageLabel} and are marked stale.`
                : 'No data has been read from this source yet.'}{' '}
              {remedy}
            </p>
          </div>
        );
      })}
    </div>
  );
}
