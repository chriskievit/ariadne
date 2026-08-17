'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import KeymapHelpDialog from './KeymapHelpDialog';

interface KeymapHelpContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const KeymapHelpContext = createContext<KeymapHelpContextValue | undefined>(undefined);

// Lives at the layout level, alongside CommandPaletteProvider, so TopBar's
// "?" button -- rendered above every page, not just the dashboard -- can
// open the shortcuts reference without Dashboard needing to hand it a prop.
// Unlike CommandPalette, this dialog has no page-specific data to thread
// through (it just reads the static KEYMAP table), so the provider renders
// it directly instead of leaving that to whichever page happens to be
// mounted.
export function KeymapHelpProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <KeymapHelpContext.Provider value={{ open, setOpen }}>
      {children}
      <KeymapHelpDialog open={open} onOpenChange={setOpen} />
    </KeymapHelpContext.Provider>
  );
}

export function useKeymapHelp(): KeymapHelpContextValue {
  const ctx = useContext(KeymapHelpContext);
  if (!ctx) throw new Error('useKeymapHelp must be used within a KeymapHelpProvider');
  return ctx;
}
