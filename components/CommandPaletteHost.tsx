'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSearch } from './SearchProvider';
import { useCommandPalette } from './CommandPaletteProvider';
import { useKeymapHelp } from './KeymapHelpProvider';
import CommandPalette from './CommandPalette';
import { fetchDashboardData, fetchSavedViews } from '@/lib/api-client';
import type { ScoredItem } from '@/lib/dashboard';
import type { SavedView } from '@/lib/saved-views';

// Mounted once at the layout level -- alongside CommandPaletteProvider --
// so ⌘K and the top bar's search trigger open the same palette on every
// route, not just the dashboard where it used to live. It fetches its own
// signal/saved-view data rather than depending on Dashboard for it, since
// Dashboard isn't mounted on /work, /report or /settings.
export default function CommandPaletteHost() {
  const router = useRouter();
  const { query, setQuery } = useSearch();
  const { open, setOpen, dashboardActions } = useCommandPalette();
  const { setOpen: setHelpOpen } = useKeymapHelp();

  const [items, setItems] = useState<ScoredItem[]>([]);
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [loadError, setLoadError] = useState(false);
  // Guards against two opens in the same instant (e.g. the keydown handler
  // and a click landing together) firing overlapping requests -- it is not
  // a "fetched once" flag. The dashboard's own signals and saved views can
  // change while the palette is closed (completing an item, saving a view),
  // so every open re-fetches rather than reusing a stale snapshot.
  const isLoadingRef = useRef(false);

  const loadPaletteData = useCallback(async () => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    setLoadError(false);
    try {
      const [dashboardData, views] = await Promise.all([fetchDashboardData(), fetchSavedViews()]);
      setItems(dashboardData.signals);
      setSavedViews(views);
    } catch {
      setLoadError(true);
    } finally {
      isLoadingRef.current = false;
    }
  }, []);

  // Fires on every path that can open the palette -- the top bar's button
  // sets `open` on the shared context directly, without going through
  // onOpenChange below -- so fetching here, keyed on `open` itself, is the
  // one place guaranteed to run regardless of how it was opened.
  useEffect(() => {
    if (open) void loadPaletteData();
  }, [open, loadPaletteData]);

  // ⌘K/Ctrl+K. This is the only binding for it: GlobalKeymapProvider (which
  // only wraps Dashboard) deliberately leaves it to this host so /work,
  // /report and /settings get the shortcut too, and / doesn't end up with
  // two listeners racing each other.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(true);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [setOpen]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) setQuery('');
  }

  return (
    <CommandPalette
      open={open}
      onOpenChange={handleOpenChange}
      items={items}
      savedViews={savedViews}
      search={query}
      onSearchChange={setQuery}
      onSelectItem={(item) => {
        if (item.url) window.open(item.url, '_blank', 'noopener,noreferrer');
      }}
      onSelectQuery={dashboardActions?.onSelectQuery}
      onGoToDashboard={() => router.push('/')}
      onGoToSettings={() => router.push('/settings')}
      onWrapUp={dashboardActions?.onWrapUp}
      onOpenScoringReference={dashboardActions?.onOpenScoringReference}
      onOpenHelp={() => setHelpOpen(true)}
      onQuickAdd={dashboardActions?.onQuickAdd}
      loadError={loadError}
      onRetryLoad={() => void loadPaletteData()}
    />
  );
}
