'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import ItemRow, { SOURCE_ICON } from './ItemRow';
import type { Item } from '@/lib/types';
import type { ScoredItem } from '@/lib/dashboard';

interface Props {
  items: ScoredItem[];
  onStart: (id: number) => void;
  onComplete: (id: number, durationHours: number, note?: string) => void;
  onOpenClaude: (id: number, workingDir?: string) => void;
  onDelete: (id: number) => void;
}

const SOURCE_GROUPS: { source: Item['source']; label: string; emptyMessage: string }[] = [
  { source: 'github_pr', label: 'GitHub', emptyMessage: 'Nothing from GitHub right now.' },
  { source: 'ado_workitem', label: 'Azure DevOps', emptyMessage: 'Nothing from Azure DevOps right now.' },
  { source: 'adhoc', label: 'Ad-hoc', emptyMessage: 'No ad-hoc items right now.' },
];

export default function NeedsAttentionBoard({ items, onStart, onComplete, onOpenClaude, onDelete }: Props) {
  return (
    <div>
      <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
        Needs attention
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{items.length}</span>
      </h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {SOURCE_GROUPS.map((group) => {
          const groupItems = items.filter((item) => item.source === group.source);
          const Icon = SOURCE_ICON[group.source];
          return (
            <Card key={group.source} className="min-w-0">
              <CardHeader className="flex flex-row items-center gap-2 space-y-0 p-4">
                <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <CardTitle className="text-sm">{group.label}</CardTitle>
                <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {groupItems.length}
                </span>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                {groupItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{group.emptyMessage}</p>
                ) : (
                  <div>
                    {groupItems.map((item) => (
                      <ItemRow
                        key={item.id}
                        item={item}
                        onStart={onStart}
                        onComplete={onComplete}
                        onOpenClaude={onOpenClaude}
                        onDelete={onDelete}
                        showTier
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
