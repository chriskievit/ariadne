import { NextResponse } from 'next/server';
import { db } from '@/lib/db-instance';
import { listItems } from '@/lib/items-repo';
import { getSetting } from '@/lib/settings-repo';
import { sortByUrgency } from '@/lib/scoring';
import { getPlan, getPlanItems, getLatestPriorEstimates } from '@/lib/plans-repo';
import { medianMinutesByWorkType } from '@/lib/time-logs-repo';
import { localDateString } from '@/lib/date';
import { SETTINGS_KEYS, DEFAULT_SUGGEST_ALGORITHM } from '@/lib/config';
import {
  suggestDay,
  isSuggestCandidate,
  DEFAULT_LEAN,
  type SuggestAlgorithm,
  type LeanNotch,
  type SuggestCandidate,
  type SuggestionItem,
} from '@/lib/suggest';

const ALGORITHMS: SuggestAlgorithm[] = ['urgency', 'quick_wins', 'balanced'];

function parseAlgorithm(raw: string | null, fallback: string | null): SuggestAlgorithm {
  for (const value of [raw, fallback, DEFAULT_SUGGEST_ALGORITHM]) {
    if (value && (ALGORITHMS as string[]).includes(value)) return value as SuggestAlgorithm;
  }
  return 'balanced';
}

function parseLean(raw: string | null, fallback: string | null): LeanNotch {
  for (const value of [raw, fallback]) {
    const notch = Number(value);
    if (value !== null && value !== '' && Number.isInteger(notch) && notch >= 0 && notch <= 4) {
      return notch as LeanNotch;
    }
  }
  return DEFAULT_LEAN;
}

export async function GET(request: Request) {
  const now = new Date();
  const params = new URL(request.url).searchParams;
  const today = localDateString(now);

  const algorithm = parseAlgorithm(params.get('algorithm'), getSetting(db, SETTINGS_KEYS.suggestAlgorithm));
  const lean = parseLean(params.get('lean'), getSetting(db, SETTINGS_KEYS.suggestLean));

  const sprintEnd = getSetting(db, SETTINGS_KEYS.sprintEnd);
  const items = listItems(db);
  const scored = sortByUrgency(items.map((item) => ({ ...item, sprintEnd })), now);

  const estimateByItemId = new Map(getPlanItems(db, today).map((pi) => [pi.itemId, pi.estimateMinutes]));

  // Pool membership is isSuggestCandidate's job, so the rules stay unit
  // tested rather than living in a route. pinnedTodayCount is counted
  // separately because it is the only way the engine can tell "Signals is
  // empty" apart from "you have already planned all of it".
  const pool = scored.filter((item) => isSuggestCandidate(item, today, now));
  const pinnedTodayCount = scored.filter(
    (item) => item.todayDate === today && isSuggestCandidate({ ...item, todayDate: null }, today, now)
  ).length;

  const candidates: SuggestCandidate[] = pool.map((item) => ({
    id: item.id,
    source: item.source,
    reason: item.reason,
    status: item.status,
    score: item.score,
    rawUpdatedAt: item.rawUpdatedAt,
    estimateMinutes: estimateByItemId.get(item.id) ?? null,
  }));

  const suggestion = suggestDay({
    candidates,
    capacityMinutes: getPlan(db, today).capacityMinutes,
    algorithm,
    lean,
    medians: medianMinutesByWorkType(db),
    priorEstimates: getLatestPriorEstimates(db, today),
    pinnedTodayCount,
    now,
  });

  // The rows the proposal references travel with it so the panel can render
  // titles and score chips without a second request.
  const referenced = new Set([
    ...suggestion.picks.map((p) => p.itemId),
    ...suggestion.didNotFit.map((c) => c.itemId),
    ...suggestion.deferredByLean.map((c) => c.itemId),
  ]);
  const referencedItems: SuggestionItem[] = scored.filter((item) => referenced.has(item.id));

  return NextResponse.json({ suggestion, items: referencedItems });
}
