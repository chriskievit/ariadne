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

const settingsSchema = z.object({
  [SETTINGS_KEYS.githubPat]: z.string().optional(),
  [SETTINGS_KEYS.adoPat]: z.string().optional(),
  [SETTINGS_KEYS.adoOrg]: z.string().optional(),
  [SETTINGS_KEYS.adoProject]: z.string().optional(),
  [SETTINGS_KEYS.staleDays]: z.string().optional(),
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
      [SETTINGS_KEYS.githubPat]: initialSettings[SETTINGS_KEYS.githubPat] ?? '',
      [SETTINGS_KEYS.adoPat]: initialSettings[SETTINGS_KEYS.adoPat] ?? '',
      [SETTINGS_KEYS.adoOrg]: initialSettings[SETTINGS_KEYS.adoOrg] ?? '',
      [SETTINGS_KEYS.adoProject]: initialSettings[SETTINGS_KEYS.adoProject] ?? '',
      [SETTINGS_KEYS.staleDays]: initialSettings[SETTINGS_KEYS.staleDays] ?? String(DEFAULT_STALE_DAYS),
    },
  });

  async function handleSubmit(values: SettingsValues) {
    await fetch('/api/settings', { method: 'POST', body: JSON.stringify(values) });
    setSaved(true);
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name={SETTINGS_KEYS.githubPat}
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
              name={SETTINGS_KEYS.adoPat}
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
              name={SETTINGS_KEYS.adoOrg}
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
              name={SETTINGS_KEYS.adoProject}
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
              name={SETTINGS_KEYS.staleDays}
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
