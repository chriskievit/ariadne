'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';

const quickAddSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  category: z.string().optional(),
  dueDate: z.string().optional(),
});

type QuickAddValues = z.infer<typeof quickAddSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: { title: string; category?: string; dueDate?: string }) => void;
}

// The closed-state trigger for this form lives in SprintProgressHeader's
// ambient row (an icon-only button), not here — this component only ever
// renders the open-state form itself, controlled from Dashboard.
export default function QuickAddForm({ open, onOpenChange, onSubmit }: Props) {
  const form = useForm<QuickAddValues>({
    resolver: zodResolver(quickAddSchema),
    defaultValues: { title: '', category: '', dueDate: '' },
  });

  function handleSubmit(values: QuickAddValues) {
    onSubmit({ title: values.title, category: values.category || undefined, dueDate: values.dueDate || undefined });
    form.reset();
    onOpenChange(false);
  }

  if (!open) return null;

  return (
    <Card>
      <CardContent className="pt-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex gap-3">
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>Category</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>Due date (optional)</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
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
