'use client';

import { useState } from 'react';
import { Github, ClipboardList, MessageSquare, Bot, Trash2, Undo2, Link2, Pause, MoreHorizontal } from 'lucide-react';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { getPriorityTier, REASON_LABEL, type PriorityTier, type ScoreBreakdownEntry } from '@/lib/scoring';
import { getStatusPill, type BadgeVariant } from '@/lib/status-pill';
import type { Item, Status } from '@/lib/types';
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

// Inline badge precedence: exactly one badge shows on the row — the status
// pill if there is one, else the item's primary reason pill, else none.
// Everything not chosen here still shows up in the hover-card (see
// HoverExtras below) rather than being dropped.
function getInlineBadge(item: Item): { label: string; variant: BadgeVariant | ReasonVariant } | null {
  const statusPill = getStatusPill(item);
  if (statusPill) return statusPill;
  return getReasonPills(item)[0] ?? null;
}

function getOverflowPills(item: Item): { label: string; variant: ReasonVariant }[] {
  const statusPill = getStatusPill(item);
  const reasonPills = getReasonPills(item);
  return statusPill ? reasonPills : reasonPills.slice(1);
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
  onPark?: (id: number) => void;
  onUnpark?: (id: number) => void;
}

function actionableLinks(links: LinkedRef[] | undefined, targetStatus: Status): LinkedRef[] {
  return (links ?? []).filter((link) => link.itemId !== null && link.status !== targetStatus);
}

// The second, lower-priority section of the row's hover-card: everything
// that didn't make the one-badge inline cut — remaining reason pills, the
// unresolved-conversations flag, and linked ADO work item / GitHub PR chips.
function HoverExtras({ item }: { item: Item & { links?: LinkedRef[] } }) {
  const overflowPills = getOverflowPills(item);
  const hasExtras = overflowPills.length > 0 || item.hasUnresolvedConversations || (item.links?.length ?? 0) > 0;
  if (!hasExtras) return null;
  return (
    <div className="mt-2 space-y-1.5 border-t pt-2">
      {(overflowPills.length > 0 || item.hasUnresolvedConversations) && (
        <div className="flex flex-wrap gap-1">
          {overflowPills.map((pill) => (
            <Badge key={pill.label} variant={pill.variant} title={pill.label} className="max-w-[9rem]">
              <span className="min-w-0 truncate">{pill.label}</span>
            </Badge>
          ))}
          {item.hasUnresolvedConversations && (
            <Badge variant="destructive" title="Unresolved conversations" className="max-w-[12rem]">
              <span className="min-w-0 truncate">Unresolved conversations</span>
            </Badge>
          )}
        </div>
      )}
      {item.links && item.links.length > 0 && (
        <div className="space-y-1 text-xs">
          {item.links.map((link) => (
            <a
              key={`${link.source}-${link.shortLabel}`}
              href={link.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-muted-foreground hover:text-foreground hover:underline"
            >
              <Link2 className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span className="truncate">
                {link.shortLabel} — {link.title}
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

// The quiet `⋯` overflow menu — contents depend on status, matching what
// used to be always-visible buttons. Only ever mounted for non-parked rows;
// parked rows get their own minimal "Resume" treatment instead (see the
// `item.parked` branch in ItemRow), so this never needs an
// in-progress-and-parked case.
function OverflowMenu({
  item,
  onRequeue,
  onPark,
  onOpenClaude,
  onDelete,
}: {
  item: Item;
  onRequeue?: (id: number) => void;
  onPark?: (id: number) => void;
  onOpenClaude: () => void;
  onDelete?: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="icon" aria-label="More actions" title="More actions">
          <MoreHorizontal aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {item.status === 'in_progress' && onRequeue && (
          <DropdownMenuItem onSelect={() => onRequeue(item.id)}>
            <Undo2 aria-hidden="true" /> Back to queue
          </DropdownMenuItem>
        )}
        {item.status === 'in_progress' && onPark && (
          <DropdownMenuItem onSelect={() => onPark(item.id)}>
            <Pause aria-hidden="true" /> Park
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={onOpenClaude}>
          <Bot aria-hidden="true" /> Open in Claude
        </DropdownMenuItem>
        {onDelete && (
          <DropdownMenuItem onSelect={onDelete} className="text-destructive focus:text-destructive">
            <Trash2 aria-hidden="true" /> Delete
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function ItemRow({
  item,
  onStart,
  onComplete,
  onOpenClaude,
  onDelete,
  onRequeue,
  onPark,
  onUnpark,
}: Props) {
  const Icon = SOURCE_ICON[item.source];
  const tier = getPriorityTier(item.score);
  const [open, setOpen] = useState(false);
  const [hours, setHours] = useState('');
  const [note, setNote] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [claudeDialogOpen, setClaudeDialogOpen] = useState(false);
  const [localRepos, setLocalRepos] = useState<LocalRepo[]>([]);
  const [selectedRepoPath, setSelectedRepoPath] = useState('');
  const [startCascadeOpen, setStartCascadeOpen] = useState(false);
  const [completeCascadeOpen, setCompleteCascadeOpen] = useState(false);
  const [pendingComplete, setPendingComplete] = useState<{ hours: number; note?: string } | null>(null);
  const canDelete = item.source === 'adhoc' && Boolean(onDelete);

  const parsedHours = Number(hours);
  const hoursValid = hours.trim() !== '' && Number.isFinite(parsedHours) && parsedHours >= 0;
  const pendingStartLinks = (item.links ?? []).filter((link) => link.itemId !== null && link.status === 'inbox');
  const pendingCompleteLinks = actionableLinks(item.links, 'done');

  function handleStartClick() {
    if (pendingStartLinks.length > 0) {
      setStartCascadeOpen(true);
    } else {
      onStart?.(item.id);
    }
  }

  function handleCompleteSubmit() {
    if (!hoursValid) return;
    setOpen(false);
    if (pendingCompleteLinks.length > 0) {
      setPendingComplete({ hours: parsedHours, note: note || undefined });
      setCompleteCascadeOpen(true);
    } else {
      onComplete(item.id, parsedHours, note || undefined);
      setHours('');
      setNote('');
    }
  }

  function closeCompleteCascade(cascadeToLinked: boolean) {
    if (pendingComplete) {
      onComplete(item.id, pendingComplete.hours, pendingComplete.note);
      if (cascadeToLinked) {
        pendingCompleteLinks.forEach((link) => {
          if (link.itemId !== null) onComplete(link.itemId, 0);
        });
      }
    }
    setPendingComplete(null);
    setHours('');
    setNote('');
    setCompleteCascadeOpen(false);
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

  const startCascadeDialog = (
    <Dialog open={startCascadeOpen} onOpenChange={setStartCascadeOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start linked item{pendingStartLinks.length > 1 ? 's' : ''} too?</DialogTitle>
          <DialogDescription>
            {pendingStartLinks.length === 1
              ? `"${pendingStartLinks[0].title}" is linked to this item.`
              : `${pendingStartLinks.length} linked items aren't in progress yet.`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onStart?.(item.id);
              setStartCascadeOpen(false);
            }}
          >
            Just this one
          </Button>
          <Button
            type="button"
            onClick={() => {
              onStart?.(item.id);
              pendingStartLinks.forEach((link) => {
                if (link.itemId !== null) onStart?.(link.itemId);
              });
              setStartCascadeOpen(false);
            }}
          >
            Start {pendingStartLinks.length > 1 ? 'all' : 'both'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  const completeCascadeDialog = (
    <Dialog
      open={completeCascadeOpen}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) closeCompleteCascade(false);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Complete linked item{pendingCompleteLinks.length > 1 ? 's' : ''} too?</DialogTitle>
          <DialogDescription>
            {pendingCompleteLinks.length === 1
              ? `"${pendingCompleteLinks[0].title}" is linked to this item.`
              : `${pendingCompleteLinks.length} linked items aren't done yet.`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => closeCompleteCascade(false)}>
            Not now
          </Button>
          <Button type="button" onClick={() => closeCompleteCascade(true)}>
            Complete {pendingCompleteLinks.length > 1 ? 'all' : 'it'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  // Parked rows deliberately cost as little visual attention as possible: no
  // icon, no badge, no priority dot, no primary action, no overflow menu —
  // just the title and a one-click way back in.
  if (item.parked) {
    return (
      <div className="flex items-center justify-between gap-3 border-b py-3 opacity-55 last:border-0">
        {item.url ? (
          <a href={item.url} target="_blank" rel="noreferrer" className="min-w-0 truncate text-sm hover:underline">
            {item.title}
          </a>
        ) : (
          <span className="min-w-0 truncate text-sm">{item.title}</span>
        )}
        <button
          type="button"
          onClick={() => onUnpark?.(item.id)}
          className="shrink-0 text-sm font-medium text-primary hover:underline"
        >
          Resume
        </button>
      </div>
    );
  }

  const inlineBadge = getInlineBadge(item);

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
                className="min-w-0 truncate font-medium hover:underline"
              >
                {item.title}
              </a>
            ) : (
              <span className="min-w-0 truncate font-medium">{item.title}</span>
            )}
            {inlineBadge && (
              <Badge variant={inlineBadge.variant} title={inlineBadge.label} className="max-w-[9rem] shrink-0">
                <span className="min-w-0 truncate">{inlineBadge.label}</span>
              </Badge>
            )}
          </div>
          {item.repo && <span className="block truncate text-xs text-muted-foreground">{item.repo}</span>}
        </div>
        <HoverCard openDelay={150}>
          <HoverCardTrigger asChild>
            <span
              className={cn('h-2.5 w-2.5 shrink-0 cursor-default rounded-full', TIER_DOT_CLASS[tier])}
              aria-label={`Priority: ${TIER_LABEL[tier]}`}
            />
          </HoverCardTrigger>
          <HoverCardContent className="w-64">
            <div className="space-y-1 text-sm">
              <div className="font-medium">{TIER_LABEL[tier]} priority</div>
              {item.scoreBreakdown?.map((entry, i) => (
                <div key={i} className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">{entry.label}</span>
                  <span className="font-medium tabular-nums">+{entry.points}</span>
                </div>
              ))}
            </div>
            <HoverExtras item={item} />
          </HoverCardContent>
        </HoverCard>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {item.status === 'inbox' && onStart && (
          <Button type="button" variant="outline" size="sm" onClick={handleStartClick}>
            Start
          </Button>
        )}
        {item.status === 'in_progress' && (
          <Button type="button" size="sm" onClick={() => setOpen(true)}>
            Complete
          </Button>
        )}
        <OverflowMenu
          item={item}
          onRequeue={onRequeue}
          onPark={onPark}
          onOpenClaude={handleOpenClaudeClick}
          onDelete={canDelete ? () => setDeleteOpen(true) : undefined}
        />
      </div>
      {completeDialog}
      {deleteDialog}
      {claudeDialog}
      {startCascadeDialog}
      {completeCascadeDialog}
    </div>
  );
}
