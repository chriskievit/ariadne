'use client';

import { useState } from 'react';
import { AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import ItemRow from './ItemRow';
import type { ScoredItem } from '@/lib/dashboard';
import type { Source, Priority } from '@/lib/types';
import { liveSessionFor } from '@/lib/agent-session-links';
import type { SessionListEntry } from '@/lib/agent-session-list';

interface Props {
  value: string;
  title: string;
  items: ScoredItem[];
  parkedItems?: ScoredItem[];
  emptyMessage: string;
  onStart?: (id: number, alsoStartIds?: number[]) => void;
  // dismissSessionId and the Promise<boolean> return: see TodaySection's
  // Props for why both are typed here rather than left implicit.
  onComplete: (id: number, durationHours: number, note?: string, dismissSessionId?: number) => Promise<boolean>;
  onOpenClaude: (id: number, workingDir?: string) => void;
  onDelete?: (id: number) => void;
  onSetPriority?: (id: number, priority: Priority | null) => void;
  onRequeue?: (id: number) => void;
  onPark?: (id: number, dismissSessionId?: number) => void;
  onUnpark?: (id: number) => void;
  onPinToday?: (id: number) => void;
  onUnpinToday?: (id: number) => void;
  failingSources?: Set<Source>;
  onOpenScoringReference: () => void;
  // See TodaySection's Props -- same shared map, same optionality.
  liveSessions?: Map<number, SessionListEntry>;
  // See ItemRow's own prop of the same name.
  onRefreshLiveSessions?: () => void;
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
  onSetPriority,
  onRequeue,
  onPark,
  onUnpark,
  onPinToday,
  onUnpinToday,
  failingSources,
  onOpenScoringReference,
  liveSessions,
  onRefreshLiveSessions,
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
                    onSetPriority={onSetPriority}
                onRequeue={onRequeue}
                onPark={onPark}
                onUnpark={onUnpark}
                onPinToday={onPinToday}
                onUnpinToday={onUnpinToday}
                sourceIsStale={failingSources?.has(item.source)}
                onOpenScoringReference={onOpenScoringReference}
                liveSession={liveSessions && liveSessionFor(liveSessions, item.id)}
                onRefreshLiveSessions={onRefreshLiveSessions}
              />
            ))}
            {parkedItems && parkedItems.length > 0 && (
              <>
                <button
                  type="button"
                  aria-expanded={parkedOpen}
                  aria-controls={`${value}-parked`}
                  onClick={() => setParkedOpen((prev) => !prev)}
                  className="flex w-full items-center pb-1 pt-3 text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  Parked · <span className="ml-1 font-mono tabular-nums">{parkedItems.length}</span>
                </button>
                {parkedOpen && (
                  <div id={`${value}-parked`}>
                    {parkedItems.map((item) => (
                      <ItemRow
                        key={item.id}
                        item={item}
                        onComplete={onComplete}
                        onOpenClaude={onOpenClaude}
                        onDelete={onDelete}
                    onSetPriority={onSetPriority}
                        onRequeue={onRequeue}
                        onUnpark={onUnpark}
                        onOpenScoringReference={onOpenScoringReference}
                        liveSession={liveSessions && liveSessionFor(liveSessions, item.id)}
                        onRefreshLiveSessions={onRefreshLiveSessions}
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
