import type { Metadata } from 'next';
import { Inter, Marcellus } from 'next/font/google';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/sonner';
import { SearchProvider } from '@/components/SearchProvider';
import TopBar from '@/components/TopBar';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
const marcellus = Marcellus({ subsets: ['latin'], weight: '400', variable: '--font-display' });

export const metadata: Metadata = {
  title: 'Ariadne',
  description: 'Personal attention-triage dashboard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${marcellus.variable} bg-background font-sans text-foreground antialiased`}
      >
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <SearchProvider>
            <TopBar />
            {children}
          </SearchProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
