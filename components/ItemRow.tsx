'use client';

import { Github, ClipboardList, MessageSquare } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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

const SOURCE_ICON = {
  github_pr: Github,
  ado_workitem: ClipboardList,
  adhoc: MessageSquare,
} as const;

interface Props {
  item: Item & { score: number };
  onStart?: (id: number) => void;
  onComplete: (id: number, durationMinutes?: number) => void;
}

export default function ItemRow({ item, onStart, onComplete }: Props) {
  const Icon = SOURCE_ICON[item.source];

  return (
    <div className="flex items-center justify-between gap-3 border-b py-3 last:border-0">
      <div className="flex min-w-0 items-center gap-3">
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="min-w-0">
          {item.url ? (
            <a href={item.url} target="_blank" rel="noreferrer" className="truncate font-medium hover:underline">
              {item.title}
            </a>
          ) : (
            <span className="truncate font-medium">{item.title}</span>
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
        <Button type="button" size="sm" onClick={() => onComplete(item.id)}>
          Mark complete
        </Button>
      </div>
    </div>
  );
}
