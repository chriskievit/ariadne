'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSearch } from './SearchProvider';
import { useCommandPalette } from './CommandPaletteProvider';
import { useKeymapHelp } from './KeymapHelpProvider';
import CommandPalette from './CommandPalette';
import { toast } from '@/components/ui/sonner';
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
  // Tracks whether a fetch has been kicked off, independent of whether it
  // succeeded -- a failed fetch clears it so the next open retries instead
  // of leaving the palette permanently empty.
  const hasFetchedRef = useRef(false);

  const loadPaletteData = useCallback(async () => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    try {
      const [dashboardData, views] = await Promise.all([fetchDashboardData(), fetchSavedViews()]);
      setItems(dashboardData.signals);
      setSavedViews(views);
    } catch {
      hasFetchedRef.current = false;
      toast('Could not load the command palette. Try again.');
    }
  }, []);

  // Fires on every path that can open the palette -- the top bar's button
  // sets `open` on the shared context directly, without going through
  // onOpenChange below -- so fetching here, keyed on `open` itself, is the
  // one place guaranteed to run regardless of how it was opened. The ref
  // guard in loadPaletteData keeps this to a single request per session.
  useEffect(() => {
    if (open) void loadPaletteData();
  }, [open, loadPaletteData]);

  // ⌘K/Ctrl+K, mirroring GlobalKeymapProvider's binding -- that provider only
  // wraps Dashboard, so this is what makes the shortcut work on /work,
  // /report and /settings. The two listeners overlap harmlessly on / itself,
  // both just setting the same open flag to true.
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
    />
  );
}
