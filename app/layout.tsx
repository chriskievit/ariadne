import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/sonner';
import { SearchProvider } from '@/components/SearchProvider';
import { CommandPaletteProvider } from '@/components/CommandPaletteProvider';
import { KeymapHelpProvider } from '@/components/KeymapHelpProvider';
import { DensityProvider } from '@/components/DensityProvider';
import { RunningTimerProvider } from '@/components/RunningTimerProvider';
import TopBar from '@/components/TopBar';
import { db } from '@/lib/db-instance';
import { getSetting } from '@/lib/settings-repo';
import { SETTINGS_KEYS, DEFAULT_DENSITY, type Density } from '@/lib/config';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'Ariadne',
  description: 'Personal attention-triage dashboard',
  manifest: '/site.webmanifest',
  icons: {
    icon: [
      { url: '/icon-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/icon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-48.png', sizes: '48x48', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
};

export const viewport: Viewport = {
  themeColor: '#09090b',
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
        className={`${inter.variable} bg-background font-sans text-foreground antialiased`}
      >
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <DensityProvider density={density}>
            <SearchProvider>
              <CommandPaletteProvider>
                <KeymapHelpProvider>
                  <RunningTimerProvider>
                    <TopBar />
                    {children}
                  </RunningTimerProvider>
                </KeymapHelpProvider>
              </CommandPaletteProvider>
            </SearchProvider>
          </DensityProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
