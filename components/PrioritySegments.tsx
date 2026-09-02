'use client';

import { useRef } from 'react';
import { cn } from '@/lib/utils';
import { PRIORITY_LABEL, PRIORITY_ORDER, priorityPoints } from '@/lib/scoring';
import type { Priority } from '@/lib/types';

// Ordered low -> high for the control, the opposite of PRIORITY_ORDER (which
// is high-first because the reference dialog lists the biggest number at the
// top). Reading left-to-right as increasing weight is what a person expects
// from a scale.
const SEGMENTS: Priority[] = [...PRIORITY_ORDER].reverse();

interface Props {
  value: Priority | null;
  onChange: (value: Priority | null) => void;
  labelledBy?: string;
  disabled?: boolean;
}

/**
 * A three-value scale rendered as an instrument, not a colour code.
 *
 * Deliberately monochrome: the score chip owns the urgency colour channel,
 * and a red/amber/grey control here would read as a fifth urgency band and
 * break the Two-Band Rule in DESIGN.md. The weight of each option is carried
 * by its point contribution in the mono/tabular register instead, which also
 * means the control teaches the formula the first time you use it rather
 * than asking you to remember what "high" is worth.
 *
 * One tab stop, arrow keys to move, per the radiogroup pattern -- three
 * separate tab stops in the middle of a capture form is the kind of thing
 * that makes a keyboard user stop using the form.
 */
export default function PrioritySegments({ value, onChange, labelledBy, disabled }: Props) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  // With nothing selected the first segment holds the tab stop, so the group
  // is always reachable in exactly one Tab press.
  const focusIndex = value ? SEGMENTS.indexOf(value) : 0;

  function move(delta: number) {
    const next = (focusIndex + delta + SEGMENTS.length) % SEGMENTS.length;
    onChange(SEGMENTS[next]);
    refs.current[next]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      className={cn(
        'inline-flex h-9 overflow-hidden rounded-md border border-input',
        disabled && 'pointer-events-none opacity-50'
      )}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          e.preventDefault();
          move(1);
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          e.preventDefault();
          move(-1);
        }
      }}
    >
      {SEGMENTS.map((priority, i) => {
        const selected = value === priority;
        return (
          <button
            key={priority}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={i === focusIndex ? 0 : -1}
            disabled={disabled}
            // Clicking the selected segment clears it. Without this there is
            // no way back to "I haven't decided", which is a real state and
            // the one every item starts in.
            onClick={() => onChange(selected ? null : priority)}
            className={cn(
              'flex items-baseline gap-1.5 px-3 text-sm transition-colors',
              'border-r border-input last:border-r-0',
              'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset',
              // The selected state has to be readable at a glance without
              // reaching for a new colour: the urgency channel belongs to the
              // score chip. So the gap is widened with weight and dimming
              // instead -- Surface Raised fill, Ink text at semibold, against
              // deliberately quieter unselected segments.
              selected
                ? 'bg-accent font-semibold text-accent-foreground'
                : 'text-muted-foreground/80 hover:text-foreground'
            )}
          >
            <span>{PRIORITY_LABEL[priority]}</span>
            <span className={cn('font-mono text-[11px] tabular-nums', selected ? 'opacity-100' : 'opacity-60')}>
              +{priorityPoints(priority)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
