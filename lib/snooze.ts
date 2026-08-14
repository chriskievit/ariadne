export type SnoozeOption = 'later_today' | 'tomorrow' | 'next_week' | 'until_activity';

export const SNOOZE_LABEL: Record<SnoozeOption, string> = {
  later_today: 'Later today',
  tomorrow: 'Tomorrow',
  next_week: 'Next week',
  until_activity: "Until there's activity",
};

// "Until there's activity" has no fixed end time -- it's represented as a
// far-future timestamp so `isSnoozed` treats it identically to a finite
// snooze everywhere it's checked. The ONLY way it clears is the upstream
// wake-early path in upsertSyncedItem (see items-repo.ts), never a timer.
export const INDEFINITE_SNOOZE = '9999-12-31T23:59:59.000Z';

function at(date: Date, hours: number): Date {
  const d = new Date(date);
  d.setHours(hours, 0, 0, 0);
  return d;
}

export function computeSnoozeUntil(option: SnoozeOption, now: Date): string {
  switch (option) {
    case 'later_today': {
      const today5pm = at(now, 17);
      return (today5pm > now ? today5pm : new Date(today5pm.getTime() + 86_400_000)).toISOString();
    }
    case 'tomorrow': {
      const tomorrow = at(now, 9);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return tomorrow.toISOString();
    }
    case 'next_week': {
      const nextMonday = at(now, 9);
      const daysUntilMonday = ((8 - now.getDay()) % 7) || 7;
      nextMonday.setDate(nextMonday.getDate() + daysUntilMonday);
      return nextMonday.toISOString();
    }
    case 'until_activity':
      return INDEFINITE_SNOOZE;
  }
}

export function isSnoozed(snoozedUntil: string | null, now: Date): boolean {
  if (!snoozedUntil) return false;
  return new Date(snoozedUntil).getTime() > now.getTime();
}
