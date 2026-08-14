'use client';

import { useState } from 'react';
import { AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import ItemRow from './ItemRow';
import type { ScoredItem } from '@/lib/dashboard';
import type { Source } from '@/lib/types';

interface Props {
  value: string;
  title: string;
  items: ScoredItem[];
  parkedItems?: ScoredItem[];
  emptyMessage: string;
  onStart?: (id: number) => void;
  onComplete: (id: number, durationHours: number, note?: string) => void;
  onOpenClaude: (id: number, workingDir?: string) => void;
  onDelete?: (id: number) => void;
  onRequeue?: (id: number) => void;
  onPark?: (id: number) => void;
  onUnpark?: (id: number) => void;
  onPinToday?: (id: number) => void;
  onUnpinToday?: (id: number) => void;
  failingSources?: Set<Source>;
  onOpenScoringReference: () => void;
}

export default function ItemSection({
  value,
  title,
  items,
  parkedItems,
  emptyMessage,
  onStart,
  onComplete,
  onOpenClaude,
  onDelete,
  onRequeue,
  onPark,
  onUnpark,
  onPinToday,
  onUnpinToday,
  failingSources,
  onOpenScoringReference,
}: Props) {
  const isEmpty = items.length === 0 && (!parkedItems || parkedItems.length === 0);
  const [parkedOpen, setParkedOpen] = useState(false);
  return (
    <AccordionItem value={value}>
      <AccordionTrigger>
        <span className="flex items-center gap-2">
          {title}
          <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-xs tabular-nums text-muted-foreground">
            {items.length}
          </span>
        </span>
      </AccordionTrigger>
      <AccordionContent>
        {isEmpty ? (
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
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
                onRequeue={onRequeue}
                onPark={onPark}
                onUnpark={onUnpark}
                onPinToday={onPinToday}
                onUnpinToday={onUnpinToday}
                sourceIsStale={failingSources?.has(item.source)}
                onOpenScoringReference={onOpenScoringReference}
              />
            ))}
            {parkedItems && parkedItems.length > 0 && (
              <>
                <button
                  type="button"
                  aria-expanded={parkedOpen}
                  aria-controls={`${value}-paused`}
                  onClick={() => setParkedOpen((prev) => !prev)}
                  className="flex w-full items-center pb-1 pt-3 text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  Paused · <span className="ml-1 font-mono tabular-nums">{parkedItems.length}</span>
                </button>
                {parkedOpen && (
                  <div id={`${value}-paused`}>
                    {parkedItems.map((item) => (
                      <ItemRow
                        key={item.id}
                        item={item}
                        onComplete={onComplete}
                        onOpenClaude={onOpenClaude}
                        onDelete={onDelete}
                        onRequeue={onRequeue}
                        onUnpark={onUnpark}
                        onOpenScoringReference={onOpenScoringReference}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}
