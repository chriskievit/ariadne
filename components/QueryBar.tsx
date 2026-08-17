'use client';

import { useId } from 'react';
import { Search, Star, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { parseQuery, withoutFilter, withoutBareWord, type ParsedFilter } from '@/lib/query';
import { useDensity } from '@/components/DensityProvider';
import type { SavedView } from '@/lib/saved-views';
import type { Source } from '@/lib/types';

const SOURCE_TOKENS: { source: Source | 'all'; label: string; token: string | null }[] = [
  { source: 'all', label: 'All', token: null },
  { source: 'github_pr', label: 'GitHub', token: 'source:github' },
  { source: 'ado_workitem', label: 'Azure DevOps', token: 'source:ado' },
  { source: 'adhoc', label: 'Ad-hoc', token: 'source:adhoc' },
];

interface Props {
  value: string;
  onChange: (raw: string) => void;
  errors: string[];
  savedViews: SavedView[];
  sourceCounts: Record<Source | 'all', number>;
  onSaveCurrentView: (label: string) => void;
  onSelectSavedView: (query: string) => void;
  onDeleteSavedView: (id: string) => void;
}

export default function QueryBar({
  value,
  onChange,
  errors,
  savedViews,
  sourceCounts,
  onSaveCurrentView,
  onSelectSavedView,
  onDeleteSavedView,
}: Props) {
  const errorId = useId();
  const density = useDensity();
  const activeSourceToken = SOURCE_TOKENS.find((t) => t.token && value.includes(t.token))?.source ?? 'all';
  const parsed = parseQuery(value);
  const hasActiveQuery = value.trim().length > 0;

  function filterPillLabel(filter: ParsedFilter): string {
    return `${filter.negate ? '-' : ''}${filter.prefix}:${filter.values.join(',')}`;
  }

  function toggleSourceToken(token: string | null) {
    const withoutSourceTokens = value
      .split(/\s+/)
      .filter((w) => !w.startsWith('source:'))
      .join(' ')
      .trim();
    onChange(token ? [withoutSourceTokens, token].filter(Boolean).join(' ') : withoutSourceTokens);
  }

  return (
    <div className="mb-4 space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id="query-bar-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="source:ado score:>25 -is:snoozed"
          aria-label="Filter signals"
          aria-invalid={errors.length > 0}
          aria-describedby={errors.length > 0 ? errorId : undefined}
          className="pl-9 font-mono text-sm"
        />
      </div>
      {errors.length > 0 && (
        <p id={errorId} role="status" aria-live="polite" className="text-sm text-destructive">
          {errors[0]} — showing the last valid result.{' '}
          <button type="button" className="underline" onClick={() => onChange('')}>
            Clear the query
          </button>
        </p>
      )}
      {(parsed.filters.length > 0 || parsed.bareWords.length > 0) && (
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Active filters">
          {parsed.filters.map((filter) => (
            <span
              key={filterPillLabel(filter)}
              className="flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 font-mono text-xs text-secondary-foreground"
            >
              {filterPillLabel(filter)}
              <button
                type="button"
                aria-label={`Remove filter ${filterPillLabel(filter)}`}
                className="rounded hover:bg-muted"
                onClick={() => onChange(withoutFilter(value, filter))}
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </span>
          ))}
          {parsed.bareWords.map((word, index) => (
            <span
              key={`${word}-${index}`}
              className="flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"
            >
              {word}
              <button
                type="button"
                aria-label={`Remove search word ${word}`}
                className="rounded hover:bg-muted"
                onClick={() => onChange(withoutBareWord(value, index))}
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by source and saved view">
        {SOURCE_TOKENS.map(({ source, label, token }) => (
          <Button
            key={source}
            type="button"
            variant={activeSourceToken === source ? 'secondary' : 'outline'}
            size="sm"
            className={density === 'comfortable' ? 'h-11' : undefined}
            aria-pressed={activeSourceToken === source}
            onClick={() => toggleSourceToken(token)}
          >
            {label} <span className="font-mono tabular-nums">{sourceCounts[source]}</span>
          </Button>
        ))}
        {savedViews.length > 0 && <div className="mx-1 h-4 w-px bg-border" aria-hidden="true" />}
        {savedViews.map((view) => (
          <Button
            key={view.id}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onSelectSavedView(view.query)}
            title={view.query}
          >
            <Star className="h-3 w-3" aria-hidden="true" />
            {view.label}
            {view.shortcut && <kbd className="ml-1 font-mono text-[11px] text-muted-foreground">{view.shortcut}</kbd>}
            <span
              role="button"
              tabIndex={0}
              aria-label={`Delete saved view ${view.label}`}
              className="ml-1 rounded hover:bg-muted"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteSavedView(view.id);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.stopPropagation();
                  onDeleteSavedView(view.id);
                }
              }}
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </span>
          </Button>
        ))}
        {hasActiveQuery && parsed.errors.length === 0 && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onSaveCurrentView(value.trim())}>
            Save this view
          </Button>
        )}
        {hasActiveQuery && (
          <Button type="button" variant="ghost" size="sm" className="ml-auto" onClick={() => onChange('')}>
            <X className="h-3 w-3" aria-hidden="true" />
            Clear filters
          </Button>
        )}
      </div>
    </div>
  );
}
