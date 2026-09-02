'use client';

import { useEffect } from 'react';
import { isTypingTarget } from '@/lib/keymap';

interface Props {
  children: React.ReactNode;
  onOpenPalette: () => void;
  onFocusQueryBar: () => void;
  onUndo: () => void;
  onRefresh: () => void;
  onWrapUp: () => void;
  onOpenHelp: () => void;
  onGoToDashboard: () => void;
  onGoToSettings: () => void;
  onPlanDay: () => void;
  onQuickAdd: () => void;
}

export default function GlobalKeymapProvider({
  children,
  onOpenPalette,
  onFocusQueryBar,
  onUndo,
  onRefresh,
  onWrapUp,
  onOpenHelp,
  onGoToDashboard,
  onGoToSettings,
  onPlanDay,
  onQuickAdd,
}: Props) {
  useEffect(() => {
    let pendingG = false;
    let pendingGTimeout: ReturnType<typeof setTimeout> | null = null;

    function handleKeyDown(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;

      if (meta && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpenPalette();
        return;
      }
      if (meta && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        onUndo();
        return;
      }

      if (isTypingTarget(e.target)) return;

      if (e.key === 'j' || e.key === 'k') {
        // Don't steal focus out from under an open dialog or the score-chip
        // popover -- both render with role="dialog" (see ScoreChip.tsx and
        // components/ui/dialog.tsx) -- so this only ever moves row focus on
        // the plain dashboard surface, not out of an active overlay.
        if (document.querySelector('[role="dialog"]')) return;
        e.preventDefault();
        const rows = Array.from(document.querySelectorAll<HTMLElement>('[data-row-id]'));
        const currentIndex = rows.findIndex((el) => el === document.activeElement);
        const nextIndex = e.key === 'j' ? Math.min(rows.length - 1, currentIndex + 1) : Math.max(0, currentIndex - 1);
        rows[nextIndex === -1 ? 0 : nextIndex]?.focus();
        return;
      }

      if (pendingG) {
        pendingG = false;
        if (pendingGTimeout) clearTimeout(pendingGTimeout);
        if (e.key.toLowerCase() === 'd') onGoToDashboard();
        if (e.key.toLowerCase() === 's') onGoToSettings();
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'a':
          // Capture is the one thing that has to work while someone is
          // standing at your desk, so it gets a single letter and opens a
          // form that focuses its own first field.
          e.preventDefault();
          onQuickAdd();
          return;
        case '/':
          e.preventDefault();
          onFocusQueryBar();
          return;
        case '?':
          onOpenHelp();
          return;
        case 'r':
          onRefresh();
          return;
        case 'w':
          onWrapUp();
          return;
        case 'p':
          onPlanDay();
          return;
        case 'g':
          pendingG = true;
          pendingGTimeout = setTimeout(() => {
            pendingG = false;
          }, 800);
          return;
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (pendingGTimeout) clearTimeout(pendingGTimeout);
    };
  }, [
    onOpenPalette,
    onFocusQueryBar,
    onUndo,
    onRefresh,
    onWrapUp,
    onOpenHelp,
    onGoToDashboard,
    onGoToSettings,
    onPlanDay,
    onQuickAdd,
  ]);

  return <>{children}</>;
}
