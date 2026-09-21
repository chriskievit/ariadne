import WatchFloor from '@/components/WatchFloor';
import { db } from '@/lib/db-instance';
import { listSessionsForDisplay } from '@/lib/agent-session-list';

// Same reason as the dashboard: without this Next.js would statically
// prerender the page at build time and bake in an empty session list.
export const dynamic = 'force-dynamic';

export default function WorkPage() {
  return <WatchFloor initialSessions={listSessionsForDisplay(db, new Date())} />;
}
