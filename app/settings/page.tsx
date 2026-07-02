import SettingsForm from '@/components/SettingsForm';
import { db } from '@/lib/db-instance';
import { getAllSettings } from '@/lib/settings-repo';

export default function SettingsPage() {
  const settings = getAllSettings(db);
  return (
    <main className="mx-auto max-w-lg space-y-6 p-6">
      <h1 className="text-lg font-semibold">Settings</h1>
      <SettingsForm initialSettings={settings} />
    </main>
  );
}
