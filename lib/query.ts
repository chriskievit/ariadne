import { REASON_LABEL } from './scoring';
import { DEFAULT_STALE_DAYS } from './config';
import { isSnoozed } from './snooze';
import { groupOf, type ObligationGroup } from './grouping';
import type { Item, Reason, Source } from './types';
import type { ScoredItem } from './dashboard';

export type QueryState = 'blocked' | 'review' | 'progress' | 'draft' | 'todo';

const PREFIXES = ['source', 'group', 'state', 'score', 'repo', 'sprint', 'is', 'stale', 'reason'] as const;
type Prefix = (typeof PREFIXES)[number];

export interface ParsedFilter {
  prefix: Prefix;
  values: string[];
  negate: boolean;
}

export interface ParsedQuery {
  filters: ParsedFilter[];
  bareWords: string[];
  errors: string[];
}

const SOURCE_VALUES = new Set(['github', 'ado', 'adhoc']);
const GROUP_VALUES = new Set(['waiting', 'blocked', 'moving', 'lower']);
const STATE_VALUES = new Set(['blocked', 'review', 'todo', 'progress', 'draft']);
const IS_VALUES = new Set(['starred', 'snoozed', 'done', 'stale']);
const REASON_KEYS = new Set(Object.keys(REASON_LABEL));

function isValidScoreExpr(expr: string | undefined): boolean {
  if (!expr) return false;
  if (/^[<>]\d+$/.test(expr)) return true;
  if (/^\d+\.\.\d+$/.test(expr)) return true;
  return false;
}

function validateValues(prefix: Prefix, values: string[]): string | null {
  switch (prefix) {
    case 'source':
      return values.every((v) => SOURCE_VALUES.has(v)) ? null : `source: expects github, ado, or adhoc`;
    case 'group':
      return values.every((v) => GROUP_VALUES.has(v)) ? null : `group: expects waiting, blocked, moving, or lower`;
    case 'state':
      return values.every((v) => STATE_VALUES.has(v)) ? null : `state: expects blocked, review, todo, progress, or draft`;
    case 'is':
      return values.every((v) => IS_VALUES.has(v)) ? null : `is: expects starred, snoozed, done, or stale`;
    case 'reason':
      return values.every((v) => REASON_KEYS.has(v)) ? null : `reason: unknown reason key`;
    case 'score':
      return isValidScoreExpr(values[0]) ? null : `score: expected >n, <n, or n..n`;
    case 'stale':
      return /^>\d+d$/.test(values[0]) ? null : `stale: expected >Nd`;
    case 'repo':
    case 'sprint':
      return values.length > 0 ? null : `${prefix}: expects a value`;
  }
}

// Pure and total: never throws on malformed input. Anything that doesn't
// parse is reported in `errors` and simply excluded from `filters`/
// `bareWords` -- callers decide whether to apply a partially-valid query or
// keep showing the last fully-valid one (SignalsBoard does the latter).
export function parseQuery(raw: string): ParsedQuery {
  const filters: ParsedFilter[] = [];
  const bareWords: string[] = [];
  const errors: string[] = [];

  const tokens = raw.trim().split(/\s+/).filter(Boolean);
  for (const token of tokens) {
    const negate = token.startsWith('-');
    const body = negate ? token.slice(1) : token;
    const colonIndex = body.indexOf(':');

    if (colonIndex === -1) {
      if (negate) {
        errors.push(`"${token}": negation only applies to a prefix filter`);
      } else {
        bareWords.push(body);
      }
      continue;
    }

    const prefix = body.slice(0, colonIndex);
    const valuePart = body.slice(colonIndex + 1);
    if (!(PREFIXES as readonly string[]).includes(prefix)) {
      errors.push(`"${prefix}:" is not a recognized filter`);
      continue;
    }

    const typedPrefix = prefix as Prefix;
    const values = ['score', 'stale'].includes(typedPrefix) ? [valuePart] : valuePart.split(',').filter(Boolean);
    const error = validateValues(typedPrefix, values);
    if (error) {
      errors.push(`"${token}": ${error}`);
      continue;
    }

    filters.push({ prefix: typedPrefix, values, negate });
  }

  return { filters, bareWords, errors };
}

export interface QueryContext {
  now: Date;
  currentSprintIteration: string | null;
}

function matchesScore(expr: string, score: number): boolean {
  if (expr.startsWith('>')) return score > Number(expr.slice(1));
  if (expr.startsWith('<')) return score < Number(expr.slice(1));
  const [lo, hi] = expr.split('..').map(Number);
  return score >= lo && score <= hi;
}

function ageDays(rawUpdatedAt: string | null, now: Date): number | null {
  if (!rawUpdatedAt) return null;
  return (now.getTime() - new Date(rawUpdatedAt).getTime()) / 86_400_000;
}

const GROUP_KEY: Record<string, ObligationGroup> = {
  waiting: 'waiting_on_you',
  blocked: 'blocked',
  moving: 'moving_without_you',
  lower: 'lower_priority',
};

const SOURCE_KEY: Record<string, Source> = { github: 'github_pr', ado: 'ado_workitem', adhoc: 'adhoc' };

function matchesFilter(item: ScoredItem, filter: ParsedFilter, context: QueryContext): boolean {
  const { prefix, values } = filter;
  switch (prefix) {
    case 'source':
      return values.some((v) => item.source === SOURCE_KEY[v]);
    case 'group':
      return values.some((v) => groupOf(item) === GROUP_KEY[v]);
    case 'state':
      return values.some((v) => stateOf(item) === v);
    case 'score':
      return matchesScore(values[0], item.score);
    case 'repo':
      return values.some((v) => (item.repo ?? '').toLowerCase().includes(v.toLowerCase()));
    case 'sprint':
      return values.some((v) =>
        v === 'current' ? item.sprintIteration === context.currentSprintIteration : item.sprintIteration === v
      );
    case 'is':
      return values.some((v) => {
        if (v === 'starred') return item.starred;
        if (v === 'snoozed') return isSnoozed(item.snoozedUntil, context.now);
        if (v === 'done') return item.triageState === 'done';
        if (v === 'stale') {
          const days = ageDays(item.rawUpdatedAt, context.now);
          return days !== null && days > DEFAULT_STALE_DAYS;
        }
        return false;
      });
    case 'stale': {
      const threshold = Number(values[0].slice(1, -1));
      const days = ageDays(item.rawUpdatedAt, context.now);
      return days !== null && days > threshold;
    }
    case 'reason':
      return values.some((v) => item.reason === (v as Reason));
  }
}

export function applyQuery(items: ScoredItem[], parsed: ParsedQuery, context: QueryContext): ScoredItem[] {
  return items.filter((item) => {
    for (const filter of parsed.filters) {
      const matched = matchesFilter(item, filter, context);
      if (filter.negate ? matched : !matched) return false;
    }
    return parsed.bareWords.every((word) => item.title.toLowerCase().includes(word.toLowerCase()));
  });
}

export function stateOf(item: Pick<Item, 'source' | 'adoStatus' | 'prStatus'>): QueryState | null {
  if (item.source === 'ado_workitem' && item.adoStatus) {
    const s = item.adoStatus.toLowerCase();
    if (/block/.test(s)) return 'blocked';
    if (/review/.test(s)) return 'review';
    if (/active|committ|doing|progress/.test(s)) return 'progress';
    if (/to ?do|new/.test(s)) return 'todo';
    return null;
  }
  if (item.source === 'github_pr' && item.prStatus) {
    if (item.prStatus === 'draft') return 'draft';
    if (item.prStatus === 'ready_for_review' || item.prStatus === 'changes_requested') return 'review';
    return null;
  }
  return null;
}

// Round-trips a parsed query back to editable text -- used when a filter
// chip is clicked, so the query bar and the chips stay one bidirectional
// state rather than two representations that can drift.
export function queryToString(parsed: ParsedQuery): string {
  const filterTokens = parsed.filters.map((f) => `${f.negate ? '-' : ''}${f.prefix}:${f.values.join(',')}`);
  return [...filterTokens, ...parsed.bareWords].join(' ');
}
