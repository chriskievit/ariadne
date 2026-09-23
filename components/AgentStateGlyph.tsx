import { AlertTriangle, CircleDashed, CircleSlash, FileDiff, Hand, Loader, type LucideIcon } from 'lucide-react';
import type { AgentGlyph, AgentTone } from '@/lib/agent-session-display';

// The one glyph table for an agent session's state, shared by the rail
// (SessionRosterRow) and Planning (ItemRow) so the two surfaces can never
// draw a different icon for the same state -- see lib/agent-session-display
// for the word each glyph pairs with. Lives here rather than in lib/ because
// agent-session-display.ts is imported from a node-environment Vitest test
// and lucide's components are not importable there.
export const AGENT_STATE_GLYPHS: Record<AgentGlyph, LucideIcon> = {
  hand: Hand,
  'alert-triangle': AlertTriangle,
  'file-diff': FileDiff,
  loader: Loader,
  'circle-dashed': CircleDashed,
  'circle-slash': CircleSlash,
};

// Only the two states that demand something of you are filled -- the Two-
// Band Rule applied to the rail, and to every other surface that shows this
// vocabulary. The other four take the neutral treatment.
export const AGENT_TONE_CLASS: Record<AgentTone, string> = {
  warning: 'text-warning',
  destructive: 'text-destructive',
  neutral: 'text-muted-foreground',
};
