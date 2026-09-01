'use client';

import { useId, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { REASON_LABEL } from '@/lib/scoring';
import { GROUP_LABEL, groupOf } from '@/lib/grouping';
import type { ScoredItem } from '@/lib/dashboard';

// A bare count is a number you have to trust. This names what the number
// means in one line and then shows its working -- the same "a figure that
// exists must be explainable" rule the score chip follows.
const EXPLANATION = "The next move is yours on these, or they're blocked and need someone else to clear the way.";

// Blocked rows say Blocked; the reason underneath ("Assigned to you") is not
// the thing that put them in this count. Everything else is here because of
// its reason, so the reason is the useful label.
function labelFor(item: ScoredItem): string {
  return groupOf(item) === 'blocked' ? GROUP_LABEL.blocked : REASON_LABEL[item.reason];
}

interface Props {
  items: ScoredItem[];
  onShowInSignals: () => void;
}

export default function NeedsYouPopover({ items, onShowInSignals }: Props) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const count = (
    <>
      <span className="font-mono tabular-nums">{items.length}</span> waiting on you
    </>
  );

  // Nothing to explain and nothing to list at zero, so the stat stays plain
  // text rather than offering an empty popover.
  if (items.length === 0) return <span className="text-warning">{count}</span>;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="text-warning underline decoration-dotted underline-offset-2 hover:decoration-solid focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
          aria-label={`${items.length} waiting on you, show which`}
        >
          {count}
        </button>
      </PopoverTrigger>
      <PopoverContent role="dialog" aria-labelledby={titleId} align="start" className="w-80">
        <div className="space-y-2 text-sm">
          <h2 id={titleId} className="font-medium">
            {items.length} waiting on you
          </h2>
          <p className="text-xs text-muted-foreground">{EXPLANATION}</p>
          <ul className="max-h-64 space-y-2 overflow-y-auto border-t pt-2">
            {items.map((item) => (
              <li key={item.id} className="min-w-0">
                <p className="text-xs text-muted-foreground">{labelFor(item)}</p>
                <p className="truncate">{item.title}</p>
              </li>
            ))}
          </ul>
          <div className="border-t pt-2">
            <button
              type="button"
              className="text-xs text-primary underline-offset-2 hover:underline"
              onClick={() => {
                setOpen(false);
                onShowInSignals();
              }}
            >
              Show these in Signals →
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
