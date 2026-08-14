import type { Metadata } from 'next';
import { Inter, Marcellus } from 'next/font/google';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/sonner';
import { SearchProvider } from '@/components/SearchProvider';
import { CommandPaletteProvider } from '@/components/CommandPaletteProvider';
import { DensityProvider } from '@/components/DensityProvider';
import TopBar from '@/components/TopBar';
import { db } from '@/lib/db-instance';
import { getSetting } from '@/lib/settings-repo';
import { SETTINGS_KEYS, DEFAULT_DENSITY, type Density } from '@/lib/config';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
const marcellus = Marcellus({ subsets: ['latin'], weight: '400', variable: '--font-display' });

export const metadata: Metadata = {
  title: 'Ariadne',
  description: 'Personal attention-triage dashboard',
};

// Every route below opts into force-dynamic rendering (db reads at request
// time), which already makes this layout dynamic too — declared explicitly
// so the density setting it reads here never gets baked in at build time.
export const dynamic = 'force-dynamic';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const density: Density = getSetting(db, SETTINGS_KEYS.density) === 'compact' ? 'compact' : DEFAULT_DENSITY;

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${marcellus.variable} bg-background font-sans text-foreground antialiased`}
      >
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <DensityProvider density={density}>
            <SearchProvider>
              <CommandPaletteProvider>
                <TopBar />
                {children}
              </CommandPaletteProvider>
            </SearchProvider>
          </DensityProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
