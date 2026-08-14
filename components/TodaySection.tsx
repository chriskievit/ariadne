'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import ItemRow from './ItemRow';
import type { ScoredItem } from '@/lib/dashboard';
import type { Source } from '@/lib/types';

interface Props {
  items: ScoredItem[];
  onStart: (id: number) => void;
  onComplete: (id: number, durationHours: number, note?: string) => void;
  onOpenClaude: (id: number, workingDir?: string) => void;
  onDelete: (id: number) => void;
  onUnpinToday: (id: number) => void;
  onReviewDay: () => void;
  failingSources?: Set<Source>;
}

export default function TodaySection({
  items,
  onStart,
  onComplete,
  onOpenClaude,
  onDelete,
  onUnpinToday,
  onReviewDay,
  failingSources,
}: Props) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            Today
            <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-xs tabular-nums text-muted-foreground">
              {items.length}
            </span>
          </h2>
          <Button type="button" variant="ghost" size="sm" onClick={onReviewDay}>
            Review my day
          </Button>
        </div>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing chosen for today — pin something from below.</p>
        ) : (
          <div>
            {items.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                onStart={onStart}
                onComplete={onComplete}
                onOpenClaude={onOpenClaude}
                onDelete={onDelete}
                onUnpinToday={onUnpinToday}
                sourceIsStale={failingSources?.has(item.source)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
