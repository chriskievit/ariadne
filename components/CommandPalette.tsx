'use client';

import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';
import { parseQuery } from '@/lib/query';
import type { ScoredItem } from '@/lib/dashboard';
import type { SavedView } from '@/lib/saved-views';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: ScoredItem[];
  savedViews: SavedView[];
  search: string;
  onSearchChange: (value: string) => void;
  onSelectItem: (item: ScoredItem) => void;
  onSelectQuery: (query: string) => void;
  onGoToDashboard: () => void;
  onGoToSettings: () => void;
  onWrapUp: () => void;
}

const QUERY_PREFIXES = ['source:', 'group:', 'state:', 'score:', 'repo:', 'sprint:', 'is:', 'stale:', 'reason:'];

export default function CommandPalette({
  open,
  onOpenChange,
  items,
  savedViews,
  search,
  onSearchChange,
  onSelectItem,
  onSelectQuery,
  onGoToDashboard,
  onGoToSettings,
  onWrapUp,
}: Props) {
  const isQueryToken = QUERY_PREFIXES.some((p) => search.startsWith(p));
  const matchingItems =
    search && !isQueryToken ? items.filter((i) => i.title.toLowerCase().includes(search.toLowerCase())).slice(0, 8) : [];
  const matchingViews = search
    ? savedViews.filter((v) => v.label.toLowerCase().includes(search.toLowerCase()))
    : savedViews;

  function select(action: () => void) {
    action();
    onOpenChange(false);
    onSearchChange('');
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Search signals, jump to a view, or type a filter…"
        value={search}
        onValueChange={onSearchChange}
      />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        {matchingItems.length > 0 && (
          <CommandGroup heading="Signals">
            {matchingItems.map((item) => (
              <CommandItem key={item.id} value={`item-${item.id}`} onSelect={() => select(() => onSelectItem(item))}>
                {item.title}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {isQueryToken && parseQuery(search).errors.length === 0 && (
          <CommandGroup heading="Filter">
            <CommandItem value={search} onSelect={() => select(() => onSelectQuery(search))}>
              Apply <span className="font-mono">{search}</span>
            </CommandItem>
          </CommandGroup>
        )}
        {matchingViews.length > 0 && (
          <CommandGroup heading="Saved views">
            {matchingViews.map((view) => (
              <CommandItem key={view.id} value={`view-${view.id}`} onSelect={() => select(() => onSelectQuery(view.query))}>
                {view.label}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        <CommandGroup heading="Go to">
          <CommandItem value="go-dashboard" onSelect={() => select(onGoToDashboard)}>
            Dashboard
          </CommandItem>
          <CommandItem value="go-settings" onSelect={() => select(onGoToSettings)}>
            Settings
          </CommandItem>
        </CommandGroup>
        <CommandGroup heading="Rituals">
          <CommandItem value="wrap-up" onSelect={() => select(onWrapUp)}>
            Wrap up the day
          </CommandItem>
        </CommandGroup>
      </CommandList>
      <p className="border-t px-3 py-2 text-xs text-muted-foreground">
        {items.length} signals searched locally, no network
      </p>
    </CommandDialog>
  );
}
