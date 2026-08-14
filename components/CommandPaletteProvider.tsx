'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';

interface CommandPaletteContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const CommandPaletteContext = createContext<CommandPaletteContextValue | undefined>(undefined);

// Lives at the layout level (mounted once, alongside SearchProvider) so
// TopBar's ⌘K button -- rendered above every page, not just the dashboard --
// can open the palette without Dashboard needing to hand it a prop.
export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <CommandPaletteContext.Provider value={{ open, setOpen }}>{children}</CommandPaletteContext.Provider>;
}

export function useCommandPalette(): CommandPaletteContextValue {
  const ctx = useContext(CommandPaletteContext);
  if (!ctx) throw new Error('useCommandPalette must be used within a CommandPaletteProvider');
  return ctx;
}
