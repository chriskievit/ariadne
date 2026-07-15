'use client';

import { AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import ItemRow from './ItemRow';
import type { Item } from '@/lib/types';

interface Props {
  value: string;
  title: string;
  items: (Item & { score: number })[];
  emptyMessage: string;
  onStart?: (id: number) => void;
  onComplete: (id: number, durationHours: number, note?: string) => void;
  onDelete?: (id: number) => void;
  onRequeue?: (id: number) => void;
}

export default function ItemSection({ value, title, items, emptyMessage, onStart, onComplete, onDelete, onRequeue }: Props) {
  return (
    <AccordionItem value={value}>
      <AccordionTrigger>
        <span className="flex items-center gap-2">
          {title}
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{items.length}</span>
        </span>
      </AccordionTrigger>
      <AccordionContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          <div>
            {items.map((item) => (
              <ItemRow key={item.id} item={item} onStart={onStart} onComplete={onComplete} onDelete={onDelete} onRequeue={onRequeue} />
            ))}
          </div>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}
