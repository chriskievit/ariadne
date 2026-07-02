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
  onComplete: (id: number, durationMinutes?: number, note?: string) => void;
}

export default function ItemSection({ value, title, items, emptyMessage, onStart, onComplete }: Props) {
  return (
    <AccordionItem value={value}>
      <AccordionTrigger>
        {title} <span className="text-sm font-normal text-muted-foreground">({items.length})</span>
      </AccordionTrigger>
      <AccordionContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          <div>
            {items.map((item) => (
              <ItemRow key={item.id} item={item} onStart={onStart} onComplete={onComplete} />
            ))}
          </div>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}
