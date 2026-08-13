import Link from 'next/link';
import { BarChart3, Search, Settings } from 'lucide-react';
import { AriadneMark } from '@/components/icons/ariadne-mark';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ThemeToggle } from '@/components/theme-toggle';

export default function TopBar() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto grid h-16 max-w-6xl grid-cols-[1fr_minmax(0,28rem)_1fr] items-center gap-6 px-6">
        <Link
          href="/"
          className="group flex w-fit items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--brand-gold))] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <AriadneMark className="h-7 w-7 shrink-0 text-[hsl(var(--brand-gold))] transition-transform motion-safe:group-hover:scale-105" />
          <span className="font-display text-xl leading-none tracking-wide text-foreground">Ariadne</span>
        </Link>

        <div className="relative justify-self-stretch">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search work items, PRs, people…"
            aria-label="Search"
            className="pl-9 focus-visible:ring-[hsl(var(--brand-gold))]"
          />
        </div>

        <div className="flex items-center justify-end gap-1">
          <Button type="button" variant="ghost" size="icon" asChild aria-label="Report">
            <Link href="/report">
              <BarChart3 className="h-4 w-4" />
            </Link>
          </Button>
          <Button type="button" variant="ghost" size="icon" asChild aria-label="Settings">
            <Link href="/settings">
              <Settings className="h-4 w-4" />
            </Link>
          </Button>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
