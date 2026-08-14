'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { Density } from '@/lib/config';

const DensityContext = createContext<Density | undefined>(undefined);

export function DensityProvider({ density, children }: { density: Density; children: ReactNode }) {
  return <DensityContext.Provider value={density}>{children}</DensityContext.Provider>;
}

export function useDensity(): Density {
  const ctx = useContext(DensityContext);
  if (!ctx) throw new Error('useDensity must be used within a DensityProvider');
  return ctx;
}
