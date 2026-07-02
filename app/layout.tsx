import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ActivityDash',
  description: 'Personal attention-triage dashboard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        {children}
      </body>
    </html>
  );
}
