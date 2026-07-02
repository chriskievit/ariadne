'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { SETTINGS_KEYS, DEFAULT_STALE_DAYS } from '@/lib/config';

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
  staleDays: z.string().optional(),
});

type SettingsValues = z.infer<typeof settingsSchema>;

interface Props {
  initialSettings: Record<string, string>;
}

export default function SettingsForm({ initialSettings }: Props) {
  const [saved, setSaved] = useState(false);
  const form = useForm<SettingsValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      githubPat: initialSettings[SETTINGS_KEYS.githubPat] ?? '',
      adoPat: initialSettings[SETTINGS_KEYS.adoPat] ?? '',
      adoOrg: initialSettings[SETTINGS_KEYS.adoOrg] ?? '',
      adoProject: initialSettings[SETTINGS_KEYS.adoProject] ?? '',
      staleDays: initialSettings[SETTINGS_KEYS.staleDays] ?? String(DEFAULT_STALE_DAYS),
    },
  });

  async function handleSubmit(values: SettingsValues) {
    await fetch('/api/settings', {
      method: 'POST',
      body: JSON.stringify({
        [SETTINGS_KEYS.githubPat]: values.githubPat ?? '',
        [SETTINGS_KEYS.adoPat]: values.adoPat ?? '',
        [SETTINGS_KEYS.adoOrg]: values.adoOrg ?? '',
        [SETTINGS_KEYS.adoProject]: values.adoProject ?? '',
        [SETTINGS_KEYS.staleDays]: values.staleDays ?? String(DEFAULT_STALE_DAYS),
      }),
    });
    setSaved(true);
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="githubPat"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>GitHub personal access token</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="adoPat"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Azure DevOps personal access token</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} />
                  </FormControl>
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
            <div className="flex items-center gap-3">
              <Button type="submit">Save</Button>
              {saved && <span className="text-sm text-muted-foreground">Saved.</span>}
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
