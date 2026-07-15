'use client';

import { useState } from 'react';
import { Github, ClipboardList, MessageSquare, Play, Bot, Check, Trash2, Undo2, Link2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/sonner';
import { fetchLocalRepos } from '@/lib/api-client';
import type { LocalRepo } from '@/lib/warp';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { cn } from '@/lib/utils';
import { getPriorityTier, REASON_LABEL, type PriorityTier, type ScoreBreakdownEntry } from '@/lib/scoring';
import { getStatusPill } from '@/lib/status-pill';
import type { Item } from '@/lib/types';
import type { LinkedRef } from '@/lib/links-repo';

type ReasonVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'warning';

const REASON_VARIANT: Record<Item['reason'], ReasonVariant> = {
  approved_unmerged: 'default',
  mention: 'warning',
  review_requested: 'secondary',
  stale_own_pr: 'destructive',
  assigned: 'outline',
  authored: 'outline',
  manual: 'outline',
};

// ADO mention detection only ever looks at items already assigned to the
// user (see fetchMentionWorkItems in lib/ado-client.ts), so a 'mention'
// reason on an ado_workitem always implies assignment too — show both pills.
function getReasonPills(item: Item): { label: string; variant: ReasonVariant }[] {
  if (item.source === 'ado_workitem' && item.reason === 'mention') {
    return [
      { label: REASON_LABEL.assigned, variant: REASON_VARIANT.assigned },
      { label: REASON_LABEL.mention, variant: REASON_VARIANT.mention },
    ];
  }
  return [{ label: REASON_LABEL[item.reason], variant: REASON_VARIANT[item.reason] }];
}

export const SOURCE_ICON = {
  github_pr: Github,
  ado_workitem: ClipboardList,
  adhoc: MessageSquare,
} as const;

const TIER_LABEL: Record<PriorityTier, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

const TIER_BORDER_CLASS: Record<PriorityTier, string> = {
  low: 'border-l-transparent',
  medium: 'border-l-primary',
  high: 'border-l-warning',
  critical: 'border-l-destructive',
};

const TIER_DOT_CLASS: Record<PriorityTier, string> = {
  low: 'bg-muted-foreground/40',
  medium: 'bg-primary',
  high: 'bg-warning',
  critical: 'bg-destructive',
};

interface Props {
  item: Item & { score: number; scoreBreakdown?: ScoreBreakdownEntry[]; links?: LinkedRef[] };
  onStart?: (id: number) => void;
  onRequeue?: (id: number) => void;
  onComplete: (id: number, durationHours: number, note?: string) => void;
  onOpenClaude: (id: number, workingDir?: string) => void;
  onDelete?: (id: number) => void;
  showTier?: boolean;
}

function LinkBadges({ links }: { links?: LinkedRef[] }) {
  if (!links || links.length === 0) return null;
  return (
    <>
      {links.map((link) =>
        link.itemId !== null ? (
          <HoverCard key={`${link.source}-${link.itemId}`} openDelay={150}>
            <HoverCardTrigger asChild>
              <a
                href={link.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex shrink-0 items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground hover:underline"
              >
                <Link2 className="h-3 w-3" aria-hidden="true" />
                {link.shortLabel}
              </a>
            </HoverCardTrigger>
            <HoverCardContent className="w-56">
              <div className="space-y-1 text-sm">
                <div className="font-medium">{link.title}</div>
                {link.status && <div className="text-muted-foreground">Status: {link.status}</div>}
              </div>
            </HoverCardContent>
          </HoverCard>
        ) : (
          <a
            key={`${link.source}-${link.shortLabel}`}
            href={link.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground hover:underline"
          >
            <Link2 className="h-3 w-3" aria-hidden="true" />
            {link.shortLabel}
          </a>
        )
      )}
    </>
  );
}

export default function ItemRow({ item, onStart, onComplete, onOpenClaude, onDelete, onRequeue, showTier = false }: Props) {
  const Icon = SOURCE_ICON[item.source];
  const tier = getPriorityTier(item.score);
  const statusPill = getStatusPill(item);
  const [open, setOpen] = useState(false);
  const [hours, setHours] = useState('');
  const [note, setNote] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [claudeDialogOpen, setClaudeDialogOpen] = useState(false);
  const [localRepos, setLocalRepos] = useState<LocalRepo[]>([]);
  const [selectedRepoPath, setSelectedRepoPath] = useState('');
  const canDelete = item.source === 'adhoc' && onDelete;

  const parsedHours = Number(hours);
  const hoursValid = hours.trim() !== '' && Number.isFinite(parsedHours) && parsedHours >= 0;

  function handleCompleteSubmit() {
    if (!hoursValid) return;
    onComplete(item.id, parsedHours, note || undefined);
    setOpen(false);
    setHours('');
    setNote('');
  }

  async function handleOpenClaudeClick() {
    if (item.repo) {
      onOpenClaude(item.id);
      return;
    }
    let repos: LocalRepo[];
    try {
      repos = await fetchLocalRepos();
    } catch {
      toast('Could not load local repos.');
      return;
    }
    setLocalRepos(repos);
    setSelectedRepoPath(repos[0]?.path ?? '');
    setClaudeDialogOpen(true);
  }

  function handleClaudeDialogSubmit() {
    if (!selectedRepoPath) return;
    onOpenClaude(item.id, selectedRepoPath);
    setClaudeDialogOpen(false);
  }

  const completeDialog = (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark complete</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor={`duration-${item.id}`}>Hours spent</Label>
            <Input
              id={`duration-${item.id}`}
              type="number"
              step="0.25"
              min="0"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
            />
            {hours.trim() !== '' && !hoursValid ? (
              <p className="text-sm text-destructive">Enter a number 0 or greater.</p>
            ) : null}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`note-${item.id}`}>Note (optional)</Label>
            <Input id={`note-${item.id}`} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleCompleteSubmit} disabled={!hoursValid}>
            Complete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  const deleteDialog = (
    <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete ad-hoc item?</DialogTitle>
          <DialogDescription>
            &ldquo;{item.title}&rdquo; will be permanently removed. This can&apos;t be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setDeleteOpen(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              onDelete?.(item.id);
              setDeleteOpen(false);
            }}
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  const claudeDialog = (
    <Dialog open={claudeDialogOpen} onOpenChange={setClaudeDialogOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Choose a working directory</DialogTitle>
          <DialogDescription>
            This item has no linked repo, so pick which local project Claude should start in.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5 py-2">
          <Label htmlFor={`claude-repo-${item.id}`}>Repo</Label>
          <select
            id={`claude-repo-${item.id}`}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={selectedRepoPath}
            onChange={(e) => setSelectedRepoPath(e.target.value)}
          >
            {localRepos.length === 0 && <option value="">No local repos configured</option>}
            {localRepos.map((repo) => (
              <option key={repo.path} value={repo.path}>
                {repo.name}
              </option>
            ))}
          </select>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setClaudeDialogOpen(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleClaudeDialogSubmit} disabled={!selectedRepoPath}>
            Open
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  if (showTier) {
    return (
      <div className={cn('border-b py-3 last:border-b-0 border-l-4 pl-3', TIER_BORDER_CLASS[tier])}>
        <div className="flex items-start gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            {item.url ? (
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="line-clamp-2 min-w-0 break-words font-medium hover:underline"
              >
                {item.title}
              </a>
            ) : (
              <span className="line-clamp-2 min-w-0 break-words font-medium">{item.title}</span>
            )}
            <LinkBadges links={item.links} />
          </div>
          {item.scoreBreakdown ? (
            <HoverCard openDelay={150}>
              <HoverCardTrigger asChild>
                <span
                  className={cn('mt-1.5 h-2.5 w-2.5 shrink-0 cursor-default rounded-full', TIER_DOT_CLASS[tier])}
                  aria-label={`Priority: ${TIER_LABEL[tier]}`}
                />
              </HoverCardTrigger>
              <HoverCardContent className="w-56">
                <div className="space-y-1 text-sm">
                  <div className="font-medium">{TIER_LABEL[tier]} priority</div>
                  {item.scoreBreakdown.map((entry, i) => (
                    <div key={i} className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">{entry.label}</span>
                      <span className="font-medium tabular-nums">+{entry.points}</span>
                    </div>
                  ))}
                </div>
              </HoverCardContent>
            </HoverCard>
          ) : (
            <span
              className={cn('mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full', TIER_DOT_CLASS[tier])}
              aria-label={`Priority: ${TIER_LABEL[tier]}`}
            />
          )}
        </div>
        {item.repo && (
          <span className="block truncate text-xs text-muted-foreground">{item.repo}</span>
        )}
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {statusPill && (
              <Badge variant={statusPill.variant} title={statusPill.label} className="max-w-[9rem]">
                <span className="min-w-0 truncate">{statusPill.label}</span>
              </Badge>
            )}
            {getReasonPills(item).map((pill) => (
              <Badge key={pill.label} variant={pill.variant} title={pill.label} className="max-w-[9rem]">
                <span className="min-w-0 truncate">{pill.label}</span>
              </Badge>
            ))}
            {item.hasUnresolvedConversations && (
              <Badge variant="destructive" title="Unresolved conversations" className="max-w-[9rem]">
                <span className="min-w-0 truncate">Unresolved conversations</span>
              </Badge>
            )}
          </div>
          <div className="flex shrink-0 gap-1.5">
            {item.status !== 'in_progress' && onStart && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Start"
                title="Start"
                onClick={() => onStart(item.id)}
              >
                <Play aria-hidden="true" />
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Open in Claude"
              title="Open in Claude"
              onClick={handleOpenClaudeClick}
            >
              <Bot aria-hidden="true" />
            </Button>
            <Button type="button" size="icon" aria-label="Mark complete" title="Mark complete" onClick={() => setOpen(true)}>
              <Check aria-hidden="true" />
            </Button>
            {canDelete && (
              <Button
                type="button"
                variant="destructive"
                size="icon"
                aria-label="Delete"
                title="Delete"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            )}
          </div>
        </div>
        {completeDialog}
        {deleteDialog}
        {claudeDialog}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 border-b py-3 last:border-0">
      <div className="flex min-w-0 items-center gap-3">
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            {item.url ? (
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 flex-1 truncate font-medium hover:underline"
              >
                {item.title}
              </a>
            ) : (
              <span className="min-w-0 flex-1 truncate font-medium">{item.title}</span>
            )}
            <LinkBadges links={item.links} />
          </div>
          {item.repo && (
            <span className="block truncate text-xs text-muted-foreground">{item.repo}</span>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {statusPill && (
              <Badge variant={statusPill.variant} title={statusPill.label} className="max-w-[9rem]">
                <span className="min-w-0 truncate">{statusPill.label}</span>
              </Badge>
            )}
            {getReasonPills(item).map((pill) => (
              <Badge key={pill.label} variant={pill.variant} title={pill.label} className="max-w-[9rem]">
                <span className="min-w-0 truncate">{pill.label}</span>
              </Badge>
            ))}
            {item.hasUnresolvedConversations && (
              <Badge variant="destructive" title="Unresolved conversations" className="max-w-[9rem]">
                <span className="min-w-0 truncate">Unresolved conversations</span>
              </Badge>
            )}
          </div>
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        {item.status !== 'in_progress' && onStart && (
          <Button type="button" variant="outline" size="sm" onClick={() => onStart(item.id)}>
            Start
          </Button>
        )}
        {item.status === 'in_progress' && onRequeue && (
          <Button type="button" variant="outline" size="sm" onClick={() => onRequeue(item.id)}>
            <Undo2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Back to queue
          </Button>
        )}
        <Button type="button" variant="outline" size="sm" onClick={handleOpenClaudeClick}>
          <Bot className="mr-1.5 h-4 w-4" aria-hidden="true" />
          Open in Claude
        </Button>
        <Button type="button" size="sm" onClick={() => setOpen(true)}>
          Mark complete
        </Button>
        {canDelete && (
          <Button type="button" variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
            Delete
          </Button>
        )}
      </div>
      {completeDialog}
      {deleteDialog}
      {claudeDialog}
    </div>
  );
}
