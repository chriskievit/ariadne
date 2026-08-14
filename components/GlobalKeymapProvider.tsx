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

      if (pendingG) {
        pendingG = false;
        if (pendingGTimeout) clearTimeout(pendingGTimeout);
        if (e.key.toLowerCase() === 'd') onGoToDashboard();
        if (e.key.toLowerCase() === 's') onGoToSettings();
        return;
      }

      switch (e.key.toLowerCase()) {
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
  ]);

  return <>{children}</>;
}
