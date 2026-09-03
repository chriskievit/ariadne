export interface KeyBinding {
  keys: string;
  description: string;
  scope: 'row' | 'global';
}

// The single place a binding may be declared -- the `?` cheat sheet
// (KeymapHelpDialog) and the command palette's shortcut hints both render
// straight from this array, so neither can drift from what's actually wired
// up. `scope: 'row'` bindings act on whichever row currently has focus.
// Most of them (enter/o, x, c, s, e, d, t) fire from that row's own bubbled
// onKeyDown; j/k are the exception -- they navigate *between* rows, so they
// fire from GlobalKeymapProvider's document-level listener instead, which
// scans every `[data-row-id]` and `[data-row-nav]` on the page (Today,
// In-progress, and Signals alike) rather than one section's own container.
// `[data-row-nav]` is how Signals' group-disclosure controls join that
// walk: they gate whether rows are in the DOM at all, so j/k must be able
// to stop on one instead of stepping over the rows it is hiding.
// `scope: 'global'`
// bindings are page-level and always fire from GlobalKeymapProvider, which
// checks isTypingTarget before acting on any binding (naturally inert while
// typing, since focus never reaches a row while an input has it).
//
// A row binding must not reuse a letter the global switch also matches:
// GlobalKeymapProvider does not bail when a row has focus, so both handlers
// would fire. That switch currently matches `/ ? r w p g i` case-insensitively
// even though `P`/`R`/`W` are declared uppercase here, which is why the
// priority cycle is `f` (for the flag icon it carries) and not `p`, and why
// Suggest a day is `i` and not the `S` it wants to be -- `s` is Star.
//
// Deliberately NOT included yet: `space` (start/stop timer) -- it triggers a
// Phase 3 feature that doesn't exist in this codebase yet. Declaring a
// binding for a nonexistent action would ship a dead shortcut; it gets added
// here once Phase 3 builds what it calls.
export const KEYMAP: KeyBinding[] = [
  { keys: 'j', description: 'Move focus to the next item', scope: 'row' },
  { keys: 'k', description: 'Move focus to the previous item', scope: 'row' },
  { keys: '↵ / o', description: 'Open upstream in a new tab', scope: 'row' },
  { keys: '↵', description: "Expand a group's lower-scoring rows, when focused", scope: 'row' },
  { keys: 'x', description: 'Show the score breakdown', scope: 'row' },
  { keys: 'c', description: 'Complete the focused item', scope: 'row' },
  { keys: 's', description: 'Star (local only)', scope: 'row' },
  { keys: 'f', description: 'Cycle priority (ad-hoc only)', scope: 'row' },
  { keys: 'e', description: 'Snooze (local only)', scope: 'row' },
  { keys: 'd', description: 'Mark done (local only)', scope: 'row' },
  { keys: 't', description: 'Pin to Today', scope: 'row' },
  { keys: 'a', description: 'Add an ad-hoc item', scope: 'global' },
  { keys: '/', description: 'Focus the query bar', scope: 'global' },
  { keys: 'P', description: 'Plan the day', scope: 'global' },
  { keys: 'i', description: 'Suggest a day', scope: 'global' },
  { keys: '⌘K / Ctrl+K', description: 'Search or jump to', scope: 'global' },
  { keys: '⌘Z', description: 'Undo the last triage action', scope: 'global' },
  { keys: 'g d', description: 'Go to the dashboard', scope: 'global' },
  { keys: 'g s', description: 'Go to Settings', scope: 'global' },
  { keys: 'R', description: 'Refresh', scope: 'global' },
  { keys: 'W', description: 'Wrap up the day', scope: 'global' },
  { keys: '?', description: 'Show this cheat sheet', scope: 'global' },
  { keys: 'Esc', description: 'Dismiss the open overlay', scope: 'global' },
];

interface TypingTargetLike {
  tagName?: string;
  isContentEditable?: boolean;
}

// Accepts `unknown` (not `EventTarget | null`) so it stays a pure function
// testable with a plain object, no DOM/jsdom required.
export function isTypingTarget(target: unknown): boolean {
  if (!target || typeof target !== 'object') return false;
  const el = target as TypingTargetLike;
  if (el.isContentEditable) return true;
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA';
}
