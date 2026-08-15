'use client';

import { useEffect, useMemo, useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import ItemRow from './ItemRow';
import QueryBar from './QueryBar';
import { groupOf, isKeptVisible, GROUP_ORDER, GROUP_LABEL, type ObligationGroup } from '@/lib/grouping';
import { parseQuery, applyQuery, withoutFilter } from '@/lib/query';
import { isSnoozed, type SnoozeOption } from '@/lib/snooze';
import { isTypingTarget } from '@/lib/keymap';
import { createSavedView, deleteSavedView } from '@/lib/api-client';
import type { SavedView } from '@/lib/saved-views';
import type { Source } from '@/lib/types';
import type { ScoredItem } from '@/lib/dashboard';

const VISIBLE_PER_GROUP = 5;

const STATUS_KEY: { label: string; description: string }[] = [
  { label: 'Blocked', description: 'Needs a nudge, not work.' },
  { label: 'Ready for review', description: 'Waiting on someone else to look.' },
  { label: 'In Progress', description: 'Already moving.' },
  { label: 'To Do / Draft / Code Review', description: 'Informational — no action implied yet.' },
  { label: 'Kept visible', description: 'A local rule is holding this row here.' },
];

function StatusKeyPopover() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-5 w-5"
          aria-label="What do these status badges mean?"
        >
          <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72">
        <div className="space-y-2 text-sm">
          <p className="font-medium">Status key</p>
          {STATUS_KEY.map((entry) => (
            <div key={entry.label}>
              <p className="font-medium">{entry.label}</p>
              <p className="text-xs text-muted-foreground">{entry.description}</p>
            </div>
          ))}
          <p className="border-t pt-2 text-xs text-muted-foreground">
            Every state has a label. Nothing on this dashboard is colour alone.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface Props {
  items: ScoredItem[];
  onStart: (id: number, alsoStartIds?: number[]) => void;
  onComplete: (id: number, durationHours: number, note?: string) => void;
  onOpenClaude: (id: number, workingDir?: string) => void;
  onDelete: (id: number) => void;
  onPinToday?: (id: number) => void;
  onStar?: (id: number, starred: boolean) => void;
  onSnooze?: (id: number, option: SnoozeOption) => void;
  onUnsnooze?: (id: number) => void;
  onDone?: (id: number, done: boolean) => void;
  currentSprintIteration: string | null;
  queryText: string;
  onQueryTextChange: (raw: string) => void;
  savedViews: SavedView[];
  onSavedViewsChange: (views: SavedView[]) => void;
  failingSources?: Set<Source>;
  onOpenScoringReference: () => void;
}

export default function SignalsBoard({
  items,
  onStart,
  onComplete,
  onOpenClaude,
  onDelete,
  onPinToday,
  onStar,
  onSnooze,
  onUnsnooze,
  onDone,
  currentSprintIteration,
  queryText,
  onQueryTextChange,
  savedViews,
  onSavedViewsChange,
  failingSources,
  onOpenScoringReference,
}: Props) {
  const [expanded, setExpanded] = useState<Record<ObligationGroup, boolean>>({
    waiting_on_you: false,
    blocked: false,
    moving_without_you: false,
    lower_priority: false,
  });
  const [lastValidParsed, setLastValidParsed] = useState(parseQuery(''));

  const parsed = parseQuery(queryText);
  const activeParsed = parsed.errors.length === 0 ? parsed : lastValidParsed;

  useEffect(() => {
    if (parsed.errors.length === 0) setLastValidParsed(parsed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryText]);

  const context = { now: new Date(), currentSprintIteration };
  const withoutHiddenTriage = items.filter(
    (item) =>
      (activeParsed.filters.some((f) => f.prefix === 'is' && f.values.includes('snoozed')) ||
        !isSnoozed(item.snoozedUntil, context.now)) &&
      (activeParsed.filters.some((f) => f.prefix === 'is' && f.values.includes('done')) || item.triageState !== 'done')
  );
  const filtered = applyQuery(withoutHiddenTriage, activeParsed, context);

  const needsYouCount = useMemo(
    () => withoutHiddenTriage.filter((item) => groupOf(item) === 'blocked' || groupOf(item) === 'waiting_on_you').length,
    [withoutHiddenTriage]
  );

  const sourceCounts: Record<Source | 'all', number> = {
    all: withoutHiddenTriage.length,
    github_pr: withoutHiddenTriage.filter((i) => i.source === 'github_pr').length,
    ado_workitem: withoutHiddenTriage.filter((i) => i.source === 'ado_workitem').length,
    adhoc: withoutHiddenTriage.filter((i) => i.source === 'adhoc').length,
  };

  async function handleSaveCurrentView(label: string) {
    const updated = await createSavedView({ label, query: queryText, shortcut: null });
    onSavedViewsChange(updated);
  }

  async function handleDeleteSavedView(id: string) {
    onSavedViewsChange(await deleteSavedView(id));
  }

  const grouped = useMemo(() => {
    const buckets: Record<ObligationGroup, ScoredItem[]> = {
      waiting_on_you: [],
      blocked: [],
      moving_without_you: [],
      lower_priority: [],
    };
    for (const item of filtered) buckets[groupOf(item)].push(item);
    for (const key of Object.keys(buckets) as ObligationGroup[]) {
      buckets[key].sort((a, b) => Number(b.starred) - Number(a.starred));
    }
    return buckets;
  }, [filtered]);

  return (
    <div
      aria-labelledby="signals-heading"
      onKeyDown={(e) => {
        if (isTypingTarget(document.activeElement)) return;
        if (e.key !== 'j' && e.key !== 'k') return;
        e.preventDefault();
        const rows = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[data-row-id]'));
        const currentIndex = rows.findIndex((el) => el === document.activeElement);
        const nextIndex = e.key === 'j' ? Math.min(rows.length - 1, currentIndex + 1) : Math.max(0, currentIndex - 1);
        rows[nextIndex === -1 ? 0 : nextIndex]?.focus();
      }}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 id="signals-heading" className="flex items-center gap-2 text-base font-semibold">
          Signals
          <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-xs tabular-nums text-muted-foreground">
            {withoutHiddenTriage.length}
          </span>
        </h2>
        <p className="text-sm text-muted-foreground">
          {needsYouCount === 0 && withoutHiddenTriage.length > 0 ? (
            'nothing needs you right now'
          ) : (
            <>
              <span className="font-mono tabular-nums">{needsYouCount}</span> need something from you
            </>
          )}
        </p>
      </div>
      <QueryBar
        value={queryText}
        onChange={onQueryTextChange}
        errors={parsed.errors}
        savedViews={savedViews}
        sourceCounts={sourceCounts}
        onSaveCurrentView={handleSaveCurrentView}
        onSelectSavedView={onQueryTextChange}
        onDeleteSavedView={handleDeleteSavedView}
      />
      {withoutHiddenTriage.length === 0 && (
        <p className="text-sm text-muted-foreground">Nothing needs your attention right now.</p>
      )}
      {withoutHiddenTriage.length > 0 && filtered.length === 0 && (
        <div className="space-y-1 text-sm text-muted-foreground">
          <p>
            No signals match. There {withoutHiddenTriage.length === 1 ? 'is' : 'are'}{' '}
            <span className="font-medium text-foreground">
              {withoutHiddenTriage.length} signal{withoutHiddenTriage.length === 1 ? '' : 's'}
            </span>{' '}
            without this filter.
          </p>
          <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
            {activeParsed.filters.map((filter) => (
              <button
                key={`${filter.negate ? '-' : ''}${filter.prefix}:${filter.values.join(',')}`}
                type="button"
                className="text-primary underline-offset-2 hover:underline"
                onClick={() => onQueryTextChange(withoutFilter(queryText, filter))}
              >
                Drop {filter.negate ? '-' : ''}
                {filter.prefix}:{filter.values.join(',')}
              </button>
            ))}
            <button
              type="button"
              className="text-primary underline-offset-2 hover:underline"
              onClick={() => onQueryTextChange('')}
            >
              Clear the query
            </button>
          </p>
        </div>
      )}
      {GROUP_ORDER.map((group) => {
        const groupItems = grouped[group];
        if (groupItems.length === 0) return null;
        const exempt = groupItems.filter((i) => isKeptVisible(i, i.score));
        const rest = groupItems.filter((i) => !isKeptVisible(i, i.score));
        const isExpanded = expanded[group];
        const visibleRest = isExpanded ? rest : rest.slice(0, VISIBLE_PER_GROUP);
        const hiddenCount = rest.length - visibleRest.length;
        const visible = [...visibleRest, ...exempt];
        return (
          <section key={group} className="mb-4">
            <div className="mb-1 flex items-center gap-1.5">
              <h3 className="text-sm font-medium">{GROUP_LABEL[group]}</h3>
              <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-xs tabular-nums text-muted-foreground">
                {groupItems.length}
              </span>
              {group === GROUP_ORDER[0] && <StatusKeyPopover />}
            </div>
            <div>
              {visible.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  onStart={onStart}
                  onComplete={onComplete}
                  onOpenClaude={onOpenClaude}
                  onDelete={onDelete}
                  onPinToday={onPinToday}
                  onStar={onStar}
                  onSnooze={onSnooze}
                  onUnsnooze={onUnsnooze}
                  onDone={onDone}
                  sourceIsStale={failingSources?.has(item.source)}
                  onOpenScoringReference={onOpenScoringReference}
                />
              ))}
            </div>
            {hiddenCount > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setExpanded((prev) => ({ ...prev, [group]: true }))}
              >
                Show {hiddenCount} more
              </Button>
            )}
          </section>
        );
      })}
    </div>
  );
}
