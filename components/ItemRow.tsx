'use client';

import { useState } from 'react';
import { Github, ClipboardList, MessageSquare, Play, Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { getPriorityTier, type PriorityTier } from '@/lib/scoring';
import type { Item } from '@/lib/types';

const REASON_LABEL: Record<Item['reason'], string> = {
  approved_unmerged: 'Ready to merge',
  mention: 'Mentioned you',
  review_requested: 'Review requested',
  stale_own_pr: 'Stale — no reviews',
  assigned: 'Assigned to you',
  authored: 'Your PR',
  manual: 'Ad-hoc',
};

const REASON_VARIANT: Record<Item['reason'], 'default' | 'secondary' | 'destructive' | 'outline'> = {
  approved_unmerged: 'default',
  mention: 'secondary',
  review_requested: 'secondary',
  stale_own_pr: 'destructive',
  assigned: 'outline',
  authored: 'outline',
  manual: 'outline',
};

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

const TIER_BADGE_VARIANT: Record<PriorityTier, 'default' | 'warning' | 'destructive'> = {
  low: 'default',
  medium: 'default',
  high: 'warning',
  critical: 'destructive',
};

const TIER_BORDER_CLASS: Record<PriorityTier, string> = {
  low: 'border-l-transparent',
  medium: 'border-l-primary',
  high: 'border-l-warning',
  critical: 'border-l-destructive',
};

interface Props {
  item: Item & { score: number };
  onStart?: (id: number) => void;
  onComplete: (id: number, durationMinutes?: number, note?: string) => void;
  showTier?: boolean;
}

export default function ItemRow({ item, onStart, onComplete, showTier = false }: Props) {
  const Icon = SOURCE_ICON[item.source];
  const tier = getPriorityTier(item.score);
  const [open, setOpen] = useState(false);
  const [duration, setDuration] = useState('');
  const [note, setNote] = useState('');

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

  if (showTier) {
    return (
      <div className={cn('border-b py-3 last:border-0 border-l-4 pl-3', TIER_BORDER_CLASS[tier])}>
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
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant={TIER_BADGE_VARIANT[tier]}>{TIER_LABEL[tier]}</Badge>
            <Badge variant="outline">{REASON_LABEL[item.reason]}</Badge>
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
          </div>
        </div>
        {completeDialog}
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
          <Badge variant={REASON_VARIANT[item.reason]} className="ml-2">
            {REASON_LABEL[item.reason]}
          </Badge>
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        {item.status !== 'in_progress' && onStart && (
          <Button type="button" variant="outline" size="sm" onClick={() => onStart(item.id)}>
            Start
          </Button>
        )}
        <Button type="button" size="sm" onClick={() => setOpen(true)}>
          Mark complete
        </Button>
      </div>
      {completeDialog}
    </div>
  );
}
