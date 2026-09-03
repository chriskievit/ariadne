'use client';

import { useRef } from 'react';
import { cn } from '@/lib/utils';

export interface SegmentedOption<T extends string | number> {
  value: T;
  label: string;
  readout?: string;
  // Spoken name, when the visible label is a compact form a screen reader
  // would read as noise ("80/20").
  ariaLabel?: string;
}

interface Props<T extends string | number> {
  options: SegmentedOption<T>[];
  value: T | null;
  onChange: (value: T | null) => void;
  clearable?: boolean;
  // Segments share the container's width equally instead of being sized by
  // their content. Opt-in, so an existing content-sized control keeps its
  // exact proportions when this primitive is reused.
  fill?: boolean;
  labelledBy?: string;
  ariaLabel?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * The house control for a value the user sets, as opposed to one a source
 * reported.
 *
 * Deliberately monochrome: the score chip owns the urgency colour channel,
 * and a coloured control here would read as another urgency band and break
 * the Two-Band Rule in DESIGN.md. Weight and dimming carry the selected
 * state instead, and an optional mono readout carries the option's magnitude
 * so the control teaches its own scale the first time you use it.
 *
 * One tab stop, arrow keys to move, per the radiogroup pattern. Several tab
 * stops in a row is the kind of thing that makes a keyboard user stop using
 * a form.
 */
export default function SegmentedChoice<T extends string | number>({
  options,
  value,
  onChange,
  clearable = false,
  fill = false,
  labelledBy,
  ariaLabel,
  disabled,
  className,
}: Props<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  // With nothing selected the first segment holds the tab stop, so the group
  // is always reachable in exactly one Tab press.
  const selectedIndex = options.findIndex((option) => option.value === value);
  const focusIndex = selectedIndex === -1 ? 0 : selectedIndex;

  function move(delta: number) {
    const next = (focusIndex + delta + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-labelledby={labelledBy}
      aria-label={ariaLabel}
      className={cn(
        'inline-flex h-9 overflow-hidden rounded-md border border-input',
        disabled && 'pointer-events-none opacity-50',
        className
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
      {options.map((option, i) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={option.ariaLabel}
            tabIndex={i === focusIndex ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(selected && clearable ? null : option.value)}
            className={cn(
              'flex items-baseline gap-1.5 px-3 text-sm transition-colors',
              fill && 'flex-1 justify-center',
              'border-r border-input last:border-r-0',
              'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset',
              selected
                ? 'bg-accent font-semibold text-accent-foreground'
                : 'text-muted-foreground/80 hover:text-foreground'
            )}
          >
            <span>{option.label}</span>
            {option.readout && (
              <span className={cn('font-mono text-[11px] tabular-nums', selected ? 'opacity-100' : 'opacity-60')}>
                {option.readout}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
