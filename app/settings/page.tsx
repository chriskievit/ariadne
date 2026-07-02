import SettingsForm from '@/components/SettingsForm';
import { db } from '@/lib/db-instance';
import { getAllSettings } from '@/lib/settings-repo';

// GET has no dynamic API usage, so Next.js would statically bake this at
// build time otherwise — same class of bug already fixed for `/` and
// `/api/sprint` (see docs/superpowers/plans/2026-07-02-activitydash-implementation.md).
export const dynamic = 'force-dynamic';

export default function SettingsPage() {
  const settings = getAllSettings(db);
  return (
    <main className="mx-auto max-w-lg space-y-6 p-6">
      <h1 className="text-lg font-semibold">Settings</h1>
      <SettingsForm initialSettings={settings} />
    </main>
  );
}
