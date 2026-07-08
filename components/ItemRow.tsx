'use client';

import { useState } from 'react';
import { Github, ClipboardList, MessageSquare, Play, Check, Trash2, Undo2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { cn } from '@/lib/utils';
import { getPriorityTier, REASON_LABEL, type PriorityTier, type ScoreBreakdownEntry } from '@/lib/scoring';
import { getStatusPill } from '@/lib/status-pill';
import type { Item } from '@/lib/types';

type ReasonVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'warning';

const REASON_VARIANT: Record<Item['reason'], ReasonVariant> = {
  approved_unmerged: 'default',
  mention: 'warning',
  review_requested: 'secondary',
  stale_own_pr: 'destructive',
  assigned: 'outline',
  authored: 'outline',
  manual: 'outline',
};

// ADO mention detection only ever looks at items already assigned to the
// user (see fetchMentionWorkItems in lib/ado-client.ts), so a 'mention'
// reason on an ado_workitem always implies assignment too — show both pills.
function getReasonPills(item: Item): { label: string; variant: ReasonVariant }[] {
  if (item.source === 'ado_workitem' && item.reason === 'mention') {
    return [
      { label: REASON_LABEL.assigned, variant: REASON_VARIANT.assigned },
      { label: REASON_LABEL.mention, variant: REASON_VARIANT.mention },
    ];
  }
  return [{ label: REASON_LABEL[item.reason], variant: REASON_VARIANT[item.reason] }];
}

export const SOURCE_ICON = {
  github_pr: Github,
  ado_workitem: ClipboardList,
  adhoc: MessageSquare,
} as const;

const TIER_LABEL: Record<PriorityTier, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

const TIER_BORDER_CLASS: Record<PriorityTier, string> = {
  low: 'border-l-transparent',
  medium: 'border-l-primary',
  high: 'border-l-warning',
  critical: 'border-l-destructive',
};

const TIER_DOT_CLASS: Record<PriorityTier, string> = {
  low: 'bg-muted-foreground/40',
  medium: 'bg-primary',
  high: 'bg-warning',
  critical: 'bg-destructive',
};

interface Props {
  item: Item & { score: number; scoreBreakdown?: ScoreBreakdownEntry[] };
  onStart?: (id: number) => void;
  onRequeue?: (id: number) => void;
  onComplete: (id: number, durationMinutes?: number, note?: string) => void;
  onDelete?: (id: number) => void;
  showTier?: boolean;
}

export default function ItemRow({ item, onStart, onComplete, onDelete, onRequeue, showTier = false }: Props) {
  const Icon = SOURCE_ICON[item.source];
  const tier = getPriorityTier(item.score);
  const statusPill = getStatusPill(item);
  const [open, setOpen] = useState(false);
  const [duration, setDuration] = useState('');
  const [note, setNote] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const canDelete = item.source === 'adhoc' && onDelete;

  function handleCompleteSubmit() {
    onComplete(item.id, duration ? Number(duration) : undefined, note || undefined);
    setOpen(false);
    setDuration('');
    setNote('');
  }

  const completeDialog = (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark complete</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor={`duration-${item.id}`}>Minutes spent (optional)</Label>
            <Input
              id={`duration-${item.id}`}
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`note-${item.id}`}>Note (optional)</Label>
            <Input id={`note-${item.id}`} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleCompleteSubmit}>
            Complete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  const deleteDialog = (
    <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete ad-hoc item?</DialogTitle>
          <DialogDescription>
            &ldquo;{item.title}&rdquo; will be permanently removed. This can&apos;t be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setDeleteOpen(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              onDelete?.(item.id);
              setDeleteOpen(false);
            }}
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  if (showTier) {
    return (
      <div className={cn('border-b py-3 last:border-b-0 border-l-4 pl-3', TIER_BORDER_CLASS[tier])}>
        <div className="flex items-start justify-between gap-2">
          {item.url ? (
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="line-clamp-2 break-words font-medium hover:underline"
            >
              {item.title}
            </a>
          ) : (
            <span className="line-clamp-2 break-words font-medium">{item.title}</span>
          )}
          {item.scoreBreakdown ? (
            <HoverCard openDelay={150}>
              <HoverCardTrigger asChild>
                <span
                  className={cn('mt-1.5 h-2.5 w-2.5 shrink-0 cursor-default rounded-full', TIER_DOT_CLASS[tier])}
                  aria-label={`Priority: ${TIER_LABEL[tier]}`}
                />
              </HoverCardTrigger>
              <HoverCardContent className="w-56">
                <div className="space-y-1 text-sm">
                  <div className="font-medium">{TIER_LABEL[tier]} priority</div>
                  {item.scoreBreakdown.map((entry, i) => (
                    <div key={i} className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">{entry.label}</span>
                      <span className="font-medium tabular-nums">+{entry.points}</span>
                    </div>
                  ))}
                </div>
              </HoverCardContent>
            </HoverCard>
          ) : (
            <span
              className={cn('mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full', TIER_DOT_CLASS[tier])}
              aria-label={`Priority: ${TIER_LABEL[tier]}`}
            />
          )}
        </div>
        {item.repo && (
          <span className="block truncate text-xs text-muted-foreground">{item.repo}</span>
        )}
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {statusPill && <Badge variant={statusPill.variant}>{statusPill.label}</Badge>}
            {getReasonPills(item).map((pill) => (
              <Badge key={pill.label} variant={pill.variant}>
                {pill.label}
              </Badge>
            ))}
            {item.hasUnresolvedConversations && (
              <Badge variant="destructive">Unresolved conversations</Badge>
            )}
          </div>
          <div className="flex shrink-0 gap-1.5">
            {item.status !== 'in_progress' && onStart && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Start"
                title="Start"
                onClick={() => onStart(item.id)}
              >
                <Play aria-hidden="true" />
              </Button>
            )}
            <Button type="button" size="icon" aria-label="Mark complete" title="Mark complete" onClick={() => setOpen(true)}>
              <Check aria-hidden="true" />
            </Button>
            {canDelete && (
              <Button
                type="button"
                variant="destructive"
                size="icon"
                aria-label="Delete"
                title="Delete"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            )}
          </div>
        </div>
        {completeDialog}
        {deleteDialog}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 border-b py-3 last:border-0">
      <div className="flex min-w-0 items-center gap-3">
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="min-w-0">
          {item.url ? (
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="block truncate font-medium hover:underline"
            >
              {item.title}
            </a>
          ) : (
            <span className="block truncate font-medium">{item.title}</span>
          )}
          {item.repo && (
            <span className="block truncate text-xs text-muted-foreground">{item.repo}</span>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {statusPill && <Badge variant={statusPill.variant}>{statusPill.label}</Badge>}
            {getReasonPills(item).map((pill) => (
              <Badge key={pill.label} variant={pill.variant}>
                {pill.label}
              </Badge>
            ))}
            {item.hasUnresolvedConversations && (
              <Badge variant="destructive">Unresolved conversations</Badge>
            )}
          </div>
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        {item.status !== 'in_progress' && onStart && (
          <Button type="button" variant="outline" size="sm" onClick={() => onStart(item.id)}>
            Start
          </Button>
        )}
        {item.status === 'in_progress' && onRequeue && (
          <Button type="button" variant="outline" size="sm" onClick={() => onRequeue(item.id)}>
            <Undo2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Back to queue
          </Button>
        )}
        <Button type="button" size="sm" onClick={() => setOpen(true)}>
          Mark complete
        </Button>
        {canDelete && (
          <Button type="button" variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
            Delete
          </Button>
        )}
      </div>
      {completeDialog}
      {deleteDialog}
    </div>
  );
}
