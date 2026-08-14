'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface Props {
  onAddClick: () => void;
}

export default function FirstRunCard({ onAddClick }: Props) {
  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <h2 className="text-base font-semibold">Nothing synced yet</h2>
        <p className="text-sm text-muted-foreground">
          Ariadne reads GitHub and Azure DevOps with read-only tokens you provide. It never writes to either.
        </p>
        <p className="text-xs text-muted-foreground">
          Tokens are stored in plaintext in your local database — the same trust model as a{' '}
          <code className="font-mono">.env</code> file.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild size="lg">
            <Link href="/settings">Add tokens in Settings</Link>
          </Button>
          <Button type="button" variant="outline" size="lg" onClick={onAddClick}>
            Add an ad-hoc request instead
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
