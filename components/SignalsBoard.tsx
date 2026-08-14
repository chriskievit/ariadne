'use client';

import { useMemo, useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import ItemRow, { SOURCE_ICON } from './ItemRow';
import { groupOf, isKeptVisible, GROUP_ORDER, GROUP_LABEL, type ObligationGroup } from '@/lib/grouping';
import type { Source } from '@/lib/types';
import type { ScoredItem } from '@/lib/dashboard';

const VISIBLE_PER_GROUP = 5;

type SourceFilter = Source | 'all';

const SOURCE_FILTERS: { source: SourceFilter; label: string; Icon?: typeof SOURCE_ICON.github_pr }[] = [
  { source: 'all', label: 'All' },
  { source: 'github_pr', label: 'GitHub', Icon: SOURCE_ICON.github_pr },
  { source: 'ado_workitem', label: 'Azure DevOps', Icon: SOURCE_ICON.ado_workitem },
  { source: 'adhoc', label: 'Ad-hoc', Icon: SOURCE_ICON.adhoc },
];

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
  onStart: (id: number) => void;
  onComplete: (id: number, durationHours: number, note?: string) => void;
  onOpenClaude: (id: number, workingDir?: string) => void;
  onDelete: (id: number) => void;
  onPinToday?: (id: number) => void;
}

export default function SignalsBoard({ items, onStart, onComplete, onOpenClaude, onDelete, onPinToday }: Props) {
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [expanded, setExpanded] = useState<Record<ObligationGroup, boolean>>({
    waiting_on_you: false,
    blocked: false,
    moving_without_you: false,
    lower_priority: false,
  });

  const needsYouCount = useMemo(
    () => items.filter((item) => groupOf(item) === 'blocked' || groupOf(item) === 'waiting_on_you').length,
    [items]
  );

  const sourceCounts: Record<SourceFilter, number> = {
    all: items.length,
    github_pr: items.filter((i) => i.source === 'github_pr').length,
    ado_workitem: items.filter((i) => i.source === 'ado_workitem').length,
    adhoc: items.filter((i) => i.source === 'adhoc').length,
  };

  const filtered = sourceFilter === 'all' ? items : items.filter((item) => item.source === sourceFilter);

  const grouped = useMemo(() => {
    const buckets: Record<ObligationGroup, ScoredItem[]> = {
      waiting_on_you: [],
      blocked: [],
      moving_without_you: [],
      lower_priority: [],
    };
    for (const item of filtered) buckets[groupOf(item)].push(item);
    return buckets;
  }, [filtered]);

  return (
    <div aria-labelledby="signals-heading">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 id="signals-heading" className="flex items-center gap-2 text-base font-semibold">
          Signals
          <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-xs tabular-nums text-muted-foreground">
            {items.length}
          </span>
        </h2>
        <p className="text-sm text-muted-foreground">
          <span className="font-mono tabular-nums">{needsYouCount}</span> need something from you
        </p>
      </div>
      <div className="mb-4 flex flex-wrap gap-1.5" role="group" aria-label="Filter by source">
        {SOURCE_FILTERS.map(({ source, label, Icon }) => (
          <Button
            key={source}
            type="button"
            variant={sourceFilter === source ? 'secondary' : 'outline'}
            size="sm"
            aria-pressed={sourceFilter === source}
            onClick={() => setSourceFilter(source)}
          >
            {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
            {label} <span className="font-mono tabular-nums">{sourceCounts[source]}</span>
          </Button>
        ))}
      </div>
      {items.length === 0 && <p className="text-sm text-muted-foreground">Nothing needs your attention right now.</p>}
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
