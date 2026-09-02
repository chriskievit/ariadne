'use client';

import { useId } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import PrioritySegments from '@/components/PrioritySegments';
import type { Priority } from '@/lib/types';

const quickAddSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  dueDate: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high']).nullable(),
});

type QuickAddValues = z.infer<typeof quickAddSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: { title: string; dueDate?: string; priority?: Priority | null }) => void;
}

// The closed-state trigger for this form lives in SprintProgressHeader's
// ambient row (an icon-only button), not here — this component only ever
// renders the open-state form itself, controlled from Dashboard. It is also
// opened by the global `a` binding (lib/keymap.ts), which is the path that
// matters: capture happens while someone is standing at your desk.
//
// Category is deliberately absent. The column and the API field still exist
// (the MCP create_item tool accepts one), but nothing in the app has ever
// read it back -- not the row, not the score, not the query grammar -- so
// asking for it at the one moment speed matters was a tax with no return.
export default function QuickAddForm({ open, onOpenChange, onSubmit }: Props) {
  const priorityLabelId = useId();
  const form = useForm<QuickAddValues>({
    resolver: zodResolver(quickAddSchema),
    defaultValues: { title: '', dueDate: '', priority: null },
  });

  function handleSubmit(values: QuickAddValues) {
    onSubmit({
      title: values.title,
      dueDate: values.dueDate || undefined,
      priority: values.priority ?? null,
    });
    form.reset();
    onOpenChange(false);
  }

  if (!open) return null;

  return (
    <Card>
      <CardContent className="pt-6">
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4"
            // Submit from anywhere in the form, including from the priority
            // segments, so the whole capture is one uninterrupted keyboard
            // gesture: a, type, arrow, cmd-enter.
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault();
                void form.handleSubmit(handleSubmit)();
              }
            }}
          >
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input autoFocus {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="dueDate"
              render={({ field }) => (
                <FormItem className="max-w-[12rem]">
                  <FormLabel>Due date (optional)</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="priority"
              render={({ field }) => (
                <FormItem>
                  <FormLabel id={priorityLabelId}>Priority (optional)</FormLabel>
                  <FormControl>
                    <div>
                      <PrioritySegments
                        value={field.value}
                        onChange={field.onChange}
                        labelledBy={priorityLabelId}
                      />
                    </div>
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    Ad-hoc items have no review activity or staleness to earn points from, so this is how they
                    earn a place in the ranking.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex gap-2">
              <Button type="submit">Add</Button>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
