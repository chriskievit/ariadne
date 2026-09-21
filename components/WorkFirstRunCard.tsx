'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function WorkFirstRunCard() {
  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <h2 className="text-base font-semibold">No agent sessions yet</h2>
        <p className="text-sm text-muted-foreground">
          Sessions appear here once a ticket is in an agent&apos;s hands. Ariadne opens a Warp tab and then follows
          along: it never owns the process, so closing Ariadne does not stop the agent, and stopping the agent is
          something you do in Warp.
        </p>
        <p className="text-xs text-muted-foreground">
          An agent&apos;s wall clock is not your hours. Nothing here starts a timer or logs time against a ticket.
        </p>
        <p className="text-xs text-muted-foreground">
          Handing a ticket over from a row is not built yet. Until it is, a session is started through the API.
        </p>
        <Button asChild size="lg">
          <Link href="/">Go to Planning</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
