'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { SETTINGS_KEYS, DEFAULT_STALE_DAYS, DEFAULT_DENSITY } from '@/lib/config';
import SettingsScoringLink from './SettingsScoringLink';
import { formatMinutes } from '@/lib/format-duration';
import type { WorkType } from '@/lib/calibration';

export interface LearnedDuration {
  workType: WorkType;
  label: string;
  // The median from the logs, or null when there are too few to trust.
  medianMinutes: number | null;
  sampleCount: number;
  fallbackMinutes: number;
}

// "Token saved", not "Connected" — this only reflects that a PAT is stored,
// never that it's valid against GitHub/ADO, so the label shouldn't claim more.
function ConnectionBadge({ connected }: { connected: boolean }) {
  return <Badge variant={connected ? 'success' : 'outline'}>{connected ? 'Token saved' : 'No token saved'}</Badge>;
}

// react-hook-form treats dots in a field `name` as a nested-path separator
// (e.g. "ado.org" is stored as { ado: { org } }), so SETTINGS_KEYS' dotted
// SQL key names can't be used directly as form field names. These local,
// dot-free names are mapped to the real settings keys only when reading
// initialSettings and when building the POST body.
const settingsSchema = z.object({
  githubPat: z.string().optional(),
  adoPat: z.string().optional(),
  adoOrg: z.string().optional(),
  adoProject: z.string().optional(),
  adoTeam: z.string().optional(),
  staleDays: z.string().optional(),
  localReposBaseDir: z.string().optional(),
  repoPathOverrides: z.string().optional(),
  density: z.enum(['comfortable', 'compact']).optional(),
});

type SettingsValues = z.infer<typeof settingsSchema>;

interface Props {
  initialSettings: Record<string, string>;
  learnedDurations: LearnedDuration[];
}

export default function SettingsForm({ initialSettings, learnedDurations }: Props) {
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [githubPatIsSet, setGithubPatIsSet] = useState(
    initialSettings[`${SETTINGS_KEYS.githubPat}.isSet`] === 'true'
  );
  const [adoPatIsSet, setAdoPatIsSet] = useState(initialSettings[`${SETTINGS_KEYS.adoPat}.isSet`] === 'true');
  const form = useForm<SettingsValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      githubPat: initialSettings[SETTINGS_KEYS.githubPat] ?? '',
      adoPat: initialSettings[SETTINGS_KEYS.adoPat] ?? '',
      adoOrg: initialSettings[SETTINGS_KEYS.adoOrg] ?? '',
      adoProject: initialSettings[SETTINGS_KEYS.adoProject] ?? '',
      adoTeam: initialSettings[SETTINGS_KEYS.adoTeam] ?? '',
      staleDays: initialSettings[SETTINGS_KEYS.staleDays] ?? String(DEFAULT_STALE_DAYS),
      localReposBaseDir: initialSettings[SETTINGS_KEYS.localReposBaseDir] ?? '',
      repoPathOverrides: initialSettings[SETTINGS_KEYS.repoPathOverrides] ?? '',
      density: (initialSettings[SETTINGS_KEYS.density] as 'comfortable' | 'compact' | undefined) ?? DEFAULT_DENSITY,
    },
  });

  async function handleSubmit(values: SettingsValues) {
    const body: Record<string, string> = {
      [SETTINGS_KEYS.adoOrg]: values.adoOrg ?? '',
      [SETTINGS_KEYS.adoProject]: values.adoProject ?? '',
      [SETTINGS_KEYS.adoTeam]: values.adoTeam ?? '',
      [SETTINGS_KEYS.staleDays]: values.staleDays ?? String(DEFAULT_STALE_DAYS),
      [SETTINGS_KEYS.localReposBaseDir]: values.localReposBaseDir ?? '',
      [SETTINGS_KEYS.repoPathOverrides]: values.repoPathOverrides ?? '',
      [SETTINGS_KEYS.density]: values.density ?? DEFAULT_DENSITY,
    };
    // Tokens come back from the server redacted (empty), so an untouched
    // field must never overwrite the saved value with ''. Only send a PAT
    // when the user actually typed a new one.
    if (values.githubPat) body[SETTINGS_KEYS.githubPat] = values.githubPat;
    if (values.adoPat) body[SETTINGS_KEYS.adoPat] = values.adoPat;

    setSaved(false);
    setSaveError(false);
    try {
      const response = await fetch('/api/settings', { method: 'POST', body: JSON.stringify(body) });
      if (!response.ok) throw new Error(`Settings save failed with status ${response.status}`);
      // The response carries the same redacted `<key>.isSet` shape as
      // initialSettings, so the badges can reflect what was actually
      // persisted instead of going stale until the next page load.
      const updated = (await response.json()) as Record<string, string>;
      setGithubPatIsSet(updated[`${SETTINGS_KEYS.githubPat}.isSet`] === 'true');
      setAdoPatIsSet(updated[`${SETTINGS_KEYS.adoPat}.isSet`] === 'true');
      setSaved(true);
    } catch {
      setSaveError(true);
    }
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <div className="space-y-4 border-b pb-6">
              <h2 className="text-base font-semibold">Integrations</h2>

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium">GitHub</h3>
                  <ConnectionBadge connected={githubPatIsSet} />
                </div>
                <FormField
                  control={form.control}
                  name="githubPat"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>GitHub personal access token</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder={githubPatIsSet ? 'Saved — leave blank to keep it' : ''} {...field} />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">
                        Tokens are stored in plaintext in your local database — the same trust model as a{' '}
                        <code className="font-mono">.env</code> file. The saved token is never sent back to the
                        browser; leave this blank to keep it unchanged.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium">Azure DevOps</h3>
                  <ConnectionBadge connected={adoPatIsSet} />
                </div>
                <FormField
                  control={form.control}
                  name="adoPat"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Azure DevOps personal access token</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder={adoPatIsSet ? 'Saved — leave blank to keep it' : ''} {...field} />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">
                        Tokens are stored in plaintext in your local database — the same trust model as a{' '}
                        <code className="font-mono">.env</code> file. The saved token is never sent back to the
                        browser; leave this blank to keep it unchanged.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="adoOrg"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Azure DevOps organization</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="adoProject"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Azure DevOps project</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="adoTeam"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Azure DevOps team (optional)</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Defaults to the project name if left blank" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="space-y-4 border-b pb-6">
              <h2 className="text-base font-semibold">Sync &amp; scoring</h2>
              <FormField
                control={form.control}
                name="staleDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Stale PR threshold (days)</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <SettingsScoringLink />
            </div>

            {/* Read-only on purpose. The algorithm and the lean are set in the
                suggestion itself, so there is no second copy of them here to
                drift out of sync, and the durations are shown rather than
                tuned: an override is a later decision, not a default. */}
            <div className="space-y-4 border-b pb-6">
              <h2 className="text-base font-semibold">Suggestions</h2>
              <p className="text-sm text-muted-foreground">
                When an item has no estimate, a suggestion sizes it from the time you have actually logged on that
                kind of work. Below <span className="font-mono tabular-nums">3</span> logs it uses a fixed default
                instead.
              </p>
              <div className="space-y-1">
                {learnedDurations.map((row) => (
                  <div key={row.workType} className="flex items-baseline justify-between gap-3 text-sm">
                    <span>{row.label}</span>
                    {row.medianMinutes === null ? (
                      <span className="text-xs text-muted-foreground">
                        <span className="font-mono tabular-nums">{formatMinutes(row.fallbackMinutes)}</span> default
                        {row.sampleCount > 0 && (
                          <>
                            {' '}
                            · <span className="font-mono tabular-nums">{row.sampleCount}</span> log
                            {row.sampleCount === 1 ? '' : 's'} so far
                          </>
                        )}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        <span className="font-mono tabular-nums text-foreground">
                          {formatMinutes(row.medianMinutes)}
                        </span>{' '}
                        median · <span className="font-mono tabular-nums">{row.sampleCount}</span> logs
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                The algorithm and the lean are set in the suggestion itself, not here.
              </p>
            </div>

            <div className="space-y-4 border-b pb-6">
              <h2 className="text-base font-semibold">Local repos</h2>
              <FormField
                control={form.control}
                name="localReposBaseDir"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Local repos base directory</FormLabel>
                    <FormControl>
                      <Input placeholder="/Users/you/dev/github" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="repoPathOverrides"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Repo path overrides (optional)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="repo-name=/absolute/path (one per line)" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-4">
              <h2 className="text-base font-semibold">Appearance</h2>
              <FormField
                control={form.control}
                name="density"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Row density</FormLabel>
                    <FormControl>
                      <select
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        {...field}
                      >
                        <option value="comfortable">Comfortable — 44px rows (default)</option>
                        <option value="compact">Compact — 36px rows</option>
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex items-center gap-3">
              <Button type="submit">Save</Button>
              <span role="status" aria-live="polite" className="text-sm">
                {saved && <span className="text-muted-foreground">Saved.</span>}
                {saveError && <span className="text-destructive">Save failed. Try again.</span>}
              </span>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
