import FocusView from '@/components/FocusView';
import { db } from '@/lib/db-instance';
import { getGroupedItems } from '@/lib/dashboard';
import { getPlan } from '@/lib/plans-repo';
import { listSessionsForDisplay } from '@/lib/agent-session-list';
import { localDateString } from '@/lib/date';

// Same reason as the dashboard: without this Next.js would statically
// prerender the page at build time and bake in build-time data forever.
export const dynamic = 'force-dynamic';

export default function FocusPage() {
  const now = new Date();
  const { today, inProgress, todayPlannedMinutes, todayLoggedMinutes } = getGroupedItems(db, now);

  return (
    <FocusView
      initialData={{
        today,
        inProgress,
        plannedMinutes: todayPlannedMinutes,
        loggedMinutes: todayLoggedMinutes,
        capacityMinutes: getPlan(db, localDateString(now)).capacityMinutes,
      }}
      initialSessions={listSessionsForDisplay(db, now)}
    />
  );
}
