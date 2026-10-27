import Dashboard from '@/components/Dashboard';
import { db } from '@/lib/db-instance';
import { getGroupedItems } from '@/lib/dashboard';
import { getSprintProgress } from '@/lib/sprint';
import { getSetting } from '@/lib/settings-repo';
import { configuredSources } from '@/lib/sources/configured';

// Without this, Next.js may statically prerender this page at build time
// (it has no dynamic APIs to force server rendering otherwise), baking in
// build-time data forever under `next build && next start`.
export const dynamic = 'force-dynamic';

export default function Page() {
  const grouped = getGroupedItems(db, new Date());
  const sprint = getSprintProgress(db);
  const hasTokens = configuredSources((key) => getSetting(db, key)).length > 0;

  return <Dashboard initialData={{ ...grouped, sprint }} hasTokens={hasTokens} />;
}
