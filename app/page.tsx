import Dashboard from '@/components/Dashboard';
import { db } from '@/lib/db-instance';
import { getGroupedItems } from '@/lib/dashboard';
import { getSprintProgress } from '@/lib/sprint';

export default function Page() {
  const grouped = getGroupedItems(db, new Date());
  const sprint = getSprintProgress(db);

  return <Dashboard initialData={{ ...grouped, sprint }} />;
}
