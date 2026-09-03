import Link from 'next/link';
import SettingsForm from '@/components/SettingsForm';
import { db } from '@/lib/db-instance';
import { getRedactedSettings } from '@/lib/settings-repo';
import { medianMinutesByWorkType } from '@/lib/time-logs-repo';
import { WORK_TYPE_LABEL, type WorkType } from '@/lib/calibration';
import { FALLBACK_MINUTES, MIN_SAMPLES_FOR_MEDIAN } from '@/lib/suggest';

// GET has no dynamic API usage, so Next.js would statically bake this at
// build time otherwise — same class of bug already fixed for `/` and
// `/api/sprint` (see docs/superpowers/plans/2026-07-02-activitydash-implementation.md).
export const dynamic = 'force-dynamic';

export default function SettingsPage() {
  const settings = getRedactedSettings(db);

  // One row per work type in WORK_TYPE_LABEL order, so a bucket with no logs
  // still appears with its fixed default rather than vanishing from the list.
  const medians = medianMinutesByWorkType(db);
  const learnedDurations = (Object.keys(WORK_TYPE_LABEL) as WorkType[]).map((workType) => {
    const median = medians[workType];
    const trusted = median !== undefined && median.sampleCount >= MIN_SAMPLES_FOR_MEDIAN;
    return {
      workType,
      label: WORK_TYPE_LABEL[workType],
      medianMinutes: trusted ? Math.round(median.medianMinutes) : null,
      sampleCount: median?.sampleCount ?? 0,
      fallbackMinutes: FALLBACK_MINUTES[workType],
    };
  });

  return (
    <main className="mx-auto max-w-lg space-y-6 p-6">
      <Link href="/" className="text-sm text-muted-foreground hover:underline">
        ← Back to dashboard
      </Link>
      <h1 className="text-lg font-semibold">Settings</h1>
      <SettingsForm initialSettings={settings} learnedDurations={learnedDurations} />
    </main>
  );
}
