'use client';

import { useState } from 'react';
import {
  Github,
  ClipboardList,
  MessageSquare,
  Bot,
  Trash2,
  Undo2,
  Link2,
  Pause,
  Play,
  MoreHorizontal,
  Flag,
  Pin,
  Star,
  Clock,
  Check,
} from 'lucide-react';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn, formatRelativeTime } from '@/lib/utils';
import {
  REASON_LABEL,
  BAND_LABEL,
  canCarryPriority,
  getUrgencyBand,
  maxScoreFor,
  PRIORITY_LABEL,
  PRIORITY_ORDER,
  priorityPoints,
  type ScoreBreakdownEntry,
} from '@/lib/scoring';
import { getStatusPill, type BadgeVariant } from '@/lib/status-pill';
import { isKeptVisible } from '@/lib/grouping';
import { matchesQuery } from '@/lib/search';
import type { Item, Priority, Status } from '@/lib/types';
import type { LinkedRef } from '@/lib/links-repo';
import { useSearch } from '@/components/SearchProvider';
import { useDensity } from '@/components/DensityProvider';
import { useRunningTimer } from '@/components/RunningTimerProvider';
import type { Density } from '@/lib/config';
import ScoreChip from './ScoreChip';
import { settledOutcome } from '@/lib/settled';
import { SNOOZE_LABEL, type SnoozeOption } from '@/lib/snooze';

// The order the `p` row binding walks. Unset lands on high first, so one
// keystroke does the thing a user actually wants from a priority key.
const PRIORITY_CYCLE: (Priority | null)[] = ['high', 'medium', 'low', null];

function nextPriority(current: Priority | null): Priority | null {
  const i = PRIORITY_CYCLE.indexOf(current);
  return PRIORITY_CYCLE[(i + 1) % PRIORITY_CYCLE.length];
}

// Row height is fixed per mode so content can never reflow it — comfortable
// is 44px (11 * 4px grid), compact is 36px (9 * 4px grid). Only applied from
// the sm: breakpoint up -- below that the row wraps instead (see the main
// row's className), so a fixed height would crop wrapped content.
const ROW_HEIGHT_CLASS = { comfortable: 'h-11', compact: 'h-9' } as const;
const SM_ROW_HEIGHT_CLASS = { comfortable: 'sm:h-11', compact: 'sm:h-9' } as const;

type ReasonVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'warning';

// Indigo ('default') never appears on a badge — that channel is
// interactive-only. approved_unmerged's urgency is already carried by the
// priority dot, so its reason pill is neutral outline like the others.
const REASON_VARIANT: Record<Item['reason'], ReasonVariant> = {
  approved_unmerged: 'outline',
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

// Inline badge precedence: exactly one badge shows on the row. A row kept
// visible only by the ad-hoc score-threshold exemption says so, taking
// priority over its status/reason pill (which moves to the hover-extras
// area instead of being dropped). Otherwise: the status pill if there is
// one, else the item's primary reason pill, else none.
function getInlineBadge(
  item: Item,
  keptVisible: boolean
): { label: string; variant: BadgeVariant | ReasonVariant } | null {
  if (keptVisible) return { label: 'Kept visible', variant: 'outline' };
  const statusPill = getStatusPill(item);
  // One green per row. On a settled row the check chip already carries the
  // affirmative colour, so an ADO "Done" pill next to it would say the same
  // thing twice in the same hue. The pill keeps the state's actual wording
  // (which the check can't carry) and gives up the fill.
  if (statusPill) {
    return settledOutcome(item) ? { ...statusPill, variant: 'outline' } : statusPill;
  }
  return getReasonPills(item)[0] ?? null;
}

function getOverflowPills(item: Item, keptVisible: boolean): { label: string; variant: ReasonVariant }[] {
  const statusPill = getStatusPill(item);
  const reasonPills = getReasonPills(item);
  if (keptVisible) return reasonPills;
  return statusPill ? reasonPills : reasonPills.slice(1);
}

export const SOURCE_ICON = {
  github_pr: Github,
  ado_workitem: ClipboardList,
  adhoc: MessageSquare,
} as const;

interface Props {
  item: Item & {
    score: number;
    scoreBreakdown?: ScoreBreakdownEntry[];
    notFired?: string[];
    links?: LinkedRef[];
    estimateMinutes?: number | null;
  };
  onStart?: (id: number, alsoStartIds?: number[]) => void;
  onRequeue?: (id: number) => void;
  onComplete: (id: number, durationHours: number, note?: string) => void;
  onOpenClaude: (id: number, workingDir?: string) => void;
  onDelete?: (id: number) => void;
  onPark?: (id: number) => void;
  onUnpark?: (id: number) => void;
  onPinToday?: (id: number) => void;
  onUnpinToday?: (id: number) => void;
  onStar?: (id: number, starred: boolean) => void;
  onSnooze?: (id: number, option: SnoozeOption) => void;
  onUnsnooze?: (id: number) => void;
  onDone?: (id: number, done: boolean) => void;
  onSetPriority?: (id: number, priority: Priority | null) => void;
  sourceIsStale?: boolean;
  onOpenScoringReference: () => void;
  // Today shows a parked item at full detail (score chip, Complete button,
  // overflow menu) instead of the stripped-down title-plus-Resume treatment
  // In-progress's Paused sub-list uses -- it's the one place you're actively
  // deciding what to resume next, not an ambient list to skim past.
  fullDetailWhenParked?: boolean;
}

function actionableLinks(links: LinkedRef[] | undefined, targetStatus: Status): LinkedRef[] {
  return (links ?? []).filter((link) => link.itemId !== null && link.status !== targetStatus);
}

// The second, lower-priority section of the row's hover-card: everything
// that didn't make the one-badge inline cut — remaining reason pills, the
// unresolved-conversations flag, and linked ADO work item / GitHub PR chips.
function HoverExtras({ item, keptVisible }: { item: Item & { links?: LinkedRef[] }; keptVisible: boolean }) {
  const overflowPills = getOverflowPills(item, keptVisible);
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
              title={`${link.shortLabel} — ${link.title}`}
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
// used to be always-visible buttons. Normally only mounted for non-parked
// rows; parked rows get their own minimal "Resume" treatment instead (see
// the `item.parked` branch in ItemRow) -- except in Today, which shows the
// full row (and this menu) even while parked, so the Park/Resume pair below
// does need to branch on `item.parked`. Pin/unpin lives here too, keeping
// the row's action cluster to exactly one primary action plus this one menu.
function OverflowMenu({
  item,
  onStart,
  onRequeue,
  onPark,
  onUnpark,
  onOpenClaude,
  onDelete,
  onPinToday,
  onUnpinToday,
  onStar,
  onOpenSnooze,
  onUnsnooze,
  onDone,
  onSetPriority,
  snoozed,
  density,
}: {
  item: Item;
  onStart?: () => void;
  onRequeue?: (id: number) => void;
  onPark?: (id: number) => void;
  onUnpark?: (id: number) => void;
  onOpenClaude: () => void;
  onDelete?: () => void;
  onPinToday?: (id: number) => void;
  onUnpinToday?: (id: number) => void;
  onStar?: (id: number, starred: boolean) => void;
  onOpenSnooze?: () => void;
  onUnsnooze?: (id: number) => void;
  onDone?: (id: number, done: boolean) => void;
  onSetPriority?: (id: number, priority: Priority | null) => void;
  snoozed: boolean;
  density: Density;
}) {
  return (
    // modal={false} is load-bearing, not a preference. A modal menu sets
    // `pointer-events: none` on <body> while it is open; three items here
    // (Snooze, Delete, Open in Claude) open a dialog, and that dialog mounts
    // while the menu is still up. Radix keeps one module-level "original"
    // body value, so the dialog captures the menu's `none` as the value to
    // restore, then writes it back on close -- leaving the whole page
    // unclickable until a reload. See e2e/row-menu-dialog.spec.ts.
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={density === 'comfortable' ? 'h-11 w-11' : undefined}
          aria-label="More actions"
          title="More actions"
        >
          <MoreHorizontal aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {/* Only mounted for a settled row, whose primary button is Complete.
            Starting it is still legitimate (a merged PR can need follow-up
            work), just not the obvious thing, so it moves in here. */}
        {onStart && (
          <DropdownMenuItem onSelect={onStart}>
            <Play aria-hidden="true" /> Start anyway
          </DropdownMenuItem>
        )}
        {onStar && (
          <DropdownMenuItem onSelect={() => onStar(item.id, !item.starred)}>
            <Star aria-hidden="true" className={item.starred ? 'fill-current' : undefined} />
            <span className="flex-1">{item.starred ? 'Unstar' : 'Star'}</span>
            <kbd className="font-mono text-xs text-muted-foreground">s</kbd>
          </DropdownMenuItem>
        )}
        {snoozed && onUnsnooze ? (
          <DropdownMenuItem onSelect={() => onUnsnooze(item.id)}>
            <Clock aria-hidden="true" />
            <span className="flex-1">Unsnooze</span>
          </DropdownMenuItem>
        ) : (
          onOpenSnooze && (
            <DropdownMenuItem onSelect={onOpenSnooze}>
              <Clock aria-hidden="true" />
              <span className="flex-1">Snooze…</span>
              <kbd className="font-mono text-xs text-muted-foreground">e</kbd>
            </DropdownMenuItem>
          )
        )}
        {onDone && (
          <DropdownMenuItem onSelect={() => onDone(item.id, item.triageState !== 'done')}>
            <Check aria-hidden="true" />
            <span className="flex-1">{item.triageState === 'done' ? 'Mark not done' : 'Mark done'}</span>
            <kbd className="font-mono text-xs text-muted-foreground">d</kbd>
          </DropdownMenuItem>
        )}
        {item.status === 'inbox' && onUnpinToday && (
          <DropdownMenuItem onSelect={() => onUnpinToday(item.id)}>
            <Pin aria-hidden="true" className="fill-current" /> Unpin from today
          </DropdownMenuItem>
        )}
        {item.status === 'inbox' && !onUnpinToday && onPinToday && (
          <DropdownMenuItem onSelect={() => onPinToday(item.id)}>
            <Pin aria-hidden="true" /> Pin to today
          </DropdownMenuItem>
        )}
        {item.status === 'in_progress' && onRequeue && (
          <DropdownMenuItem onSelect={() => onRequeue(item.id)}>
            <Undo2 aria-hidden="true" /> Back to queue
          </DropdownMenuItem>
        )}
        {item.status === 'in_progress' && !item.parked && onPark && (
          <DropdownMenuItem onSelect={() => onPark(item.id)}>
            <Pause aria-hidden="true" /> Park
          </DropdownMenuItem>
        )}
        {item.status === 'in_progress' && item.parked && onUnpark && (
          <DropdownMenuItem onSelect={() => onUnpark(item.id)}>
            <Play aria-hidden="true" /> Resume
          </DropdownMenuItem>
        )}
        {/* Rendered on every row, including the ones that cannot have a
            priority. An item that is silently missing teaches nothing; a
            disabled one with its reason attached teaches the read-only
            commitment at the moment the user reaches for it. */}
        {onSetPriority && !canCarryPriority(item.source) && (
          <DropdownMenuItem disabled>
            <Flag aria-hidden="true" />
            <span className="flex-1">Priority</span>
            <span className="text-xs text-muted-foreground">ad-hoc only</span>
          </DropdownMenuItem>
        )}
        {onSetPriority && canCarryPriority(item.source) && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Flag aria-hidden="true" />
              <span className="flex-1">Priority</span>
              <kbd className="mr-1 font-mono text-xs text-muted-foreground">f</kbd>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {/* The current value is marked here rather than shown on the
                  trigger, so the trigger keeps the shortcut hint its siblings
                  all carry. */}
              {PRIORITY_ORDER.map((priority) => (
                <DropdownMenuItem key={priority} onSelect={() => onSetPriority(item.id, priority)}>
                  <Check
                    aria-hidden="true"
                    className={item.priority === priority ? undefined : 'invisible'}
                  />
                  <span className="flex-1">{PRIORITY_LABEL[priority]}</span>
                  <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                    +{priorityPoints(priority)}
                  </span>
                </DropdownMenuItem>
              ))}
              {item.priority && (
                <DropdownMenuItem onSelect={() => onSetPriority(item.id, null)}>Clear</DropdownMenuItem>
              )}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}
        <DropdownMenuItem onSelect={onOpenClaude}>
          <Bot aria-hidden="true" /> Open in Claude
        </DropdownMenuItem>
        {onDelete && (
          <DropdownMenuItem onSelect={onDelete} className="text-destructive focus:text-destructive">
            <Trash2 aria-hidden="true" /> Delete
          </DropdownMenuItem>
        )}
        {(onStar || onOpenSnooze || onDone) && (
          <div className="border-t px-2 py-1.5 text-xs text-muted-foreground">
            Starred, snoozed and done are local. Ariadne never changes anything in GitHub or Azure DevOps.
            {onSetPriority && canCarryPriority(item.source) && ' Priority is local too, but it does change the score.'}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Wraps the first case-insensitive occurrence of `query` in the title with
// <mark>, so a match is visible at a glance even when the row is surrounded
// by dimmed, non-matching rows.
function renderTitle(title: string, query: string) {
  const q = query.trim();
  if (!q) return title;
  const index = title.toLowerCase().indexOf(q.toLowerCase());
  if (index === -1) return title;
  return (
    <>
      {title.slice(0, index)}
      <mark className="rounded-sm bg-[hsl(var(--brand-gold))]/30 text-inherit">
        {title.slice(index, index + q.length)}
      </mark>
      {title.slice(index + q.length)}
    </>
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
  onPinToday,
  onUnpinToday,
  onStar,
  onSnooze,
  onUnsnooze,
  onDone,
  onSetPriority,
  sourceIsStale,
  onOpenScoringReference,
  fullDetailWhenParked = false,
}: Props) {
  const Icon = SOURCE_ICON[item.source];
  const { query } = useSearch();
  const density = useDensity();
  const { runningTimer } = useRunningTimer();
  const isMatch = matchesQuery(item.title, query);
  const isTracking = runningTimer?.itemId === item.id;
  const [open, setOpen] = useState(false);
  const [chipOpen, setChipOpen] = useState(false);
  const [snoozeDialogOpen, setSnoozeDialogOpen] = useState(false);
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

  // The source system has closed this item but Ariadne, being read-only, has
  // not. A settled row keeps its place and its full-strength text -- the chip
  // carries the state -- and swaps its primary action from Start to Complete,
  // because starting work that is already finished is never what you meant.
  const settled = settledOutcome(item);
  const canComplete = item.status === 'in_progress' || (item.status === 'inbox' && Boolean(settled));

  const parsedHours = Number(hours);
  const hoursValid = hours.trim() !== '' && Number.isFinite(parsedHours) && parsedHours >= 0;
  const pendingStartLinks = (item.links ?? []).filter((link) => link.itemId !== null && link.status === 'inbox');
  const pendingCompleteLinks = actionableLinks(item.links, 'done');
  // Starting this item will also pop Dashboard's SwitchTimerDialog right
  // after this one closes, if a different item's timer is running. Named
  // here so the cascade dialog can preview that second question instead of
  // letting it land as a surprise second modal.
  const willSwitchTimer = Boolean(runningTimer && runningTimer.itemId !== item.id);

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

  // Row-scoped shortcuts (see lib/keymap.ts). Naturally inert while typing
  // elsewhere: this handler only fires when the row div itself is the
  // keydown target, and focus never lands here while an input has it.
  function handleRowKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget) return;
    switch (e.key.toLowerCase()) {
      case 'enter':
      case 'o':
        if (item.url) window.open(item.url, '_blank', 'noopener,noreferrer');
        return;
      case 'x':
        setChipOpen(true);
        return;
      case 'c':
        if (canComplete) setOpen(true);
        return;
      case 's':
        onStar?.(item.id, !item.starred);
        return;
      case 'e':
        setSnoozeDialogOpen(true);
        return;
      case 'd':
        onDone?.(item.id, item.triageState !== 'done');
        return;
      case 'f':
        // high -> medium -> low -> unset -> high. Starts at high because the
        // reason to reach for this key is almost always to raise something;
        // stepping down and clearing are the rarer follow-ups.
        if (onSetPriority && canCarryPriority(item.source)) onSetPriority(item.id, nextPriority(item.priority));
        return;
      case 't':
        if (item.todayDate) onUnpinToday?.(item.id);
        else onPinToday?.(item.id);
        return;
    }
  }

  const completeDialog = (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark complete</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          {item.estimateMinutes != null && (
            <p className="text-sm text-muted-foreground">
              Estimated {Math.floor(item.estimateMinutes / 60)}h {item.estimateMinutes % 60}m
            </p>
          )}
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
          <DialogTitle>
            Start linked item{pendingStartLinks.length > 1 ? 's' : ''} too?
            {willSwitchTimer && <span className="text-muted-foreground"> (1 of 2)</span>}
          </DialogTitle>
          <DialogDescription>
            {pendingStartLinks.length === 1
              ? `"${pendingStartLinks[0].title}" is linked to this item.`
              : `${pendingStartLinks.length} linked items aren't in progress yet.`}
            {willSwitchTimer &&
              ` You'll also be asked whether to stop or switch the timer running on "${runningTimer?.itemTitle}".`}
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
              const linkIds = pendingStartLinks
                .map((link) => link.itemId)
                .filter((id): id is number => id !== null);
              onStart?.(item.id, linkIds);
              setStartCascadeOpen(false);
            }}
          >
            Start {pendingStartLinks.length > 1 ? 'all' : 'both'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  const snoozeDialog = (
    <Dialog open={snoozeDialogOpen} onOpenChange={setSnoozeDialogOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Snooze</DialogTitle>
          <DialogDescription>
            Starred, snoozed and done are local. Ariadne never changes anything in GitHub or Azure DevOps.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 py-2">
          {(Object.keys(SNOOZE_LABEL) as SnoozeOption[]).map((option) => (
            <Button
              key={option}
              type="button"
              variant="outline"
              className="justify-start"
              onClick={() => {
                onSnooze?.(item.id, option);
                setSnoozeDialogOpen(false);
              }}
            >
              {SNOOZE_LABEL[option]}
            </Button>
          ))}
        </div>
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
  // just the title and a one-click way back in. Today opts out via
  // fullDetailWhenParked since it's the one place you're actively deciding
  // what to resume, not an ambient list to skim past.
  if (item.parked && !fullDetailWhenParked) {
    return (
      <div
        className={cn(
          'flex items-center justify-between gap-3 overflow-hidden border-b last:border-0',
          ROW_HEIGHT_CLASS[density],
          'motion-safe:transition-opacity motion-safe:duration-200 motion-safe:ease-out',
          isMatch ? 'opacity-55' : 'opacity-30'
        )}
      >
        {item.url ? (
          <a href={item.url} target="_blank" rel="noreferrer" className="min-w-0 truncate text-sm hover:underline">
            {renderTitle(item.title, query)}
          </a>
        ) : (
          <span className="min-w-0 truncate text-sm">{renderTitle(item.title, query)}</span>
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

  const keptVisible = isKeptVisible(item, item.score);
  const inlineBadge = getInlineBadge(item, keptVisible);

  // Row-scoped shortcuts (see handleRowKeyDown) only fire while this exact
  // wrapper has focus, so both the accessible name and the discoverability
  // hint below are keyed off the same list rather than a static one -- a
  // row without, say, onStar never claims 's' works on it.
  const rowShortcuts = [
    item.url ? 'o' : null,
    canComplete ? 'c' : null,
    onStar ? 's' : null,
    onSnooze || onUnsnooze ? 'e' : null,
    onDone ? 'd' : null,
    onPinToday || onUnpinToday ? 't' : null,
    'x',
  ].filter((key): key is string => key !== null);

  const rowLabel = [
    item.title,
    isTracking ? 'currently tracking time' : null,
    item.parked ? 'paused' : null,
    item.status === 'done' ? 'done' : null,
    settled === 'finished' ? 'done at the source' : null,
    settled === 'gone' ? 'gone from the source' : null,
    `${BAND_LABEL[getUrgencyBand(item.score)]} priority`,
    `score ${item.score} of ${maxScoreFor(item.source)}`,
    inlineBadge?.label,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <div
      tabIndex={0}
      role="group"
      aria-label={rowLabel}
      aria-keyshortcuts={rowShortcuts.join(' ')}
      data-row-id={item.id}
      onKeyDown={handleRowKeyDown}
      className={cn(
        'group relative flex flex-wrap items-start justify-between gap-x-3 gap-y-2 border-b py-2 last:border-0',
        'sm:flex-nowrap sm:items-center sm:overflow-hidden sm:py-0',
        'border-l-2 border-l-transparent focus:border-l-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
        SM_ROW_HEIGHT_CLASS[density],
        'motion-safe:transition-opacity motion-safe:duration-200 motion-safe:ease-out',
        !isMatch ? 'opacity-40' : item.status === 'done' && 'opacity-60'
      )}
    >
      <div className="flex w-full min-w-0 items-center gap-3 sm:w-auto">
        <ScoreChip
          source={item.source}
          score={item.score}
          scoreBreakdown={item.scoreBreakdown ?? []}
          notFired={item.notFired ?? []}
          keptVisible={keptVisible}
          settled={settled}
          open={chipOpen}
          onOpenChange={setChipOpen}
          onOpenScoringReference={onOpenScoringReference}
        >
          <HoverExtras item={item} keptVisible={keptVisible} />
        </ScoreChip>
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            {isTracking && (
              <span
                className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-[hsl(var(--brand-gold))]"
                aria-hidden="true"
                title="Currently tracking time"
              />
            )}
            {item.parked && (
              <span title="Paused">
                <Pause className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />
              </span>
            )}
            {item.url ? (
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className={cn(
                  'min-w-0 truncate font-medium hover:underline',
                  item.status === 'done' && 'line-through'
                )}
                title={item.title}
              >
                {renderTitle(item.title, query)}
              </a>
            ) : (
              <span
                className={cn('min-w-0 truncate font-medium', item.status === 'done' && 'line-through')}
                title={item.title}
              >
                {renderTitle(item.title, query)}
              </span>
            )}
            {inlineBadge && (
              <Badge variant={inlineBadge.variant} title={inlineBadge.label} className="max-w-[9rem] shrink-0">
                <span className="min-w-0 truncate">{inlineBadge.label}</span>
              </Badge>
            )}
          </div>
          {(item.repo || item.wokeEarly || sourceIsStale) && density === 'comfortable' && (
            <span className="block truncate text-xs text-muted-foreground" title={item.repo ?? undefined}>
              {item.repo}
              {item.repo && (item.wokeEarly || sourceIsStale) && ' · '}
              {item.wokeEarly && 'woke early'}
              {item.wokeEarly && sourceIsStale && ' · '}
              {sourceIsStale && item.rawUpdatedAt && (
                <span className="text-warning">stale · read {formatRelativeTime(new Date(item.rawUpdatedAt).getTime())}</span>
              )}
            </span>
          )}
        </div>
      </div>
      <div className="flex w-full shrink-0 items-center justify-end gap-1 opacity-100 motion-safe:transition-opacity sm:w-auto sm:opacity-60 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
        {rowShortcuts.length > 0 && (
          <span
            aria-hidden="true"
            className="hidden shrink-0 items-center gap-1 rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground sm:group-focus-visible:inline-flex"
          >
            {rowShortcuts.map((key) => (
              <kbd key={key}>{key}</kbd>
            ))}
          </span>
        )}
        {item.status === 'inbox' && !settled && onStart && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={density === 'comfortable' ? 'h-11' : undefined}
            onClick={handleStartClick}
          >
            Start
          </Button>
        )}
        {canComplete && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={density === 'comfortable' ? 'h-11' : undefined}
            onClick={() => setOpen(true)}
          >
            Complete
          </Button>
        )}
        <OverflowMenu
          item={item}
          onStart={item.status === 'inbox' && settled ? handleStartClick : undefined}
          onRequeue={onRequeue}
          onPark={onPark}
          onUnpark={onUnpark}
          onOpenClaude={handleOpenClaudeClick}
          onDelete={canDelete ? () => setDeleteOpen(true) : undefined}
          onPinToday={onPinToday}
          onUnpinToday={onUnpinToday}
          onStar={onStar}
          onOpenSnooze={onSnooze ? () => setSnoozeDialogOpen(true) : undefined}
          onUnsnooze={onUnsnooze}
          onDone={onDone}
          onSetPriority={onSetPriority}
          snoozed={Boolean(item.snoozedUntil)}
          density={density}
        />
      </div>
      {completeDialog}
      {deleteDialog}
      {claudeDialog}
      {startCascadeDialog}
      {completeCascadeDialog}
      {snoozeDialog}
    </div>
  );
}
