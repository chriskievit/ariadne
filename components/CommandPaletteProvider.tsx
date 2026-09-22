'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';

// A handful of commands only make sense while Dashboard is mounted (wrap-up
// and the scoring reference dialog live in its state; the query filter only
// affects the SignalsBoard it renders). CommandPaletteHost renders on every
// route, so it cannot own these itself -- Dashboard registers them here on
// mount and clears them on unmount, and the host leaves the corresponding
// commands off the palette rather than offering one with nothing behind it.
export interface DashboardPaletteActions {
  onSelectQuery: (query: string) => void;
  onWrapUp: () => void;
  onOpenScoringReference: () => void;
  onQuickAdd: () => void;
}

interface CommandPaletteContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  dashboardActions: DashboardPaletteActions | null;
  registerDashboardActions: (actions: DashboardPaletteActions | null) => void;
}

const CommandPaletteContext = createContext<CommandPaletteContextValue | undefined>(undefined);

// Lives at the layout level (mounted once, alongside SearchProvider) so
// TopBar's ⌘K button -- rendered above every page, not just the dashboard --
// can open the palette without Dashboard needing to hand it a prop.
export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [dashboardActions, registerDashboardActions] = useState<DashboardPaletteActions | null>(null);
  return (
    <CommandPaletteContext.Provider value={{ open, setOpen, dashboardActions, registerDashboardActions }}>
      {children}
    </CommandPaletteContext.Provider>
  );
}

export function useCommandPalette(): CommandPaletteContextValue {
  const ctx = useContext(CommandPaletteContext);
  if (!ctx) throw new Error('useCommandPalette must be used within a CommandPaletteProvider');
  return ctx;
}
