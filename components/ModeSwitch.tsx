'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import SegmentedChoice, { type SegmentedOption } from '@/components/SegmentedChoice';

type Mode = 'planning' | 'work';

const MODES: SegmentedOption<Mode>[] = [
  { value: 'planning', label: 'Planning' },
  { value: 'work', label: 'Work' },
];

const MODE_PATH: Record<Mode, string> = { planning: '/', work: '/work' };

/**
 * The two faces of the same items: Planning ranks them, Work supervises the
 * agents running against them.
 *
 * A route rather than client state, so the mode survives a reload and the
 * server can render each face's data directly. The switch is the house
 * segmented control for the same reason it is used for priority and the
 * suggestion algorithm: it is a value you set by hand, and it is deliberately
 * colourless so it cannot read as another urgency band.
 *
 * Report and Settings belong to neither mode -- reports are mode-agnostic and
 * report time only -- so the control shows nothing selected there rather than
 * claiming you are somewhere you are not.
 */
export default function ModeSwitch() {
  const pathname = usePathname();
  const router = useRouter();

  // What the user just asked for, held until the route catches up.
  //
  // Without this the control looks broken. Its selected notch is derived
  // from the pathname, and the pathname only changes once the navigation
  // has completed, so a click moved nothing at all until the new page was
  // ready. Both faces read the database at request time, which is fast but
  // not free, and in development the first visit to a route compiles it --
  // long enough that the honest conclusion from a still thumb is that the
  // click missed, so you click again.
  const [requested, setRequested] = useState<Mode | null>(null);

  const current: Mode | null = pathname === '/' ? 'planning' : pathname.startsWith('/work') ? 'work' : null;

  // The pathname is the truth again the moment it lands.
  useEffect(() => {
    setRequested(null);
  }, [pathname]);

  return (
    <SegmentedChoice<Mode>
      options={MODES}
      value={requested ?? current}
      onChange={(next) => {
        if (!next || next === current) return;
        setRequested(next);
        router.push(MODE_PATH[next]);
      }}
      ariaLabel="Mode"
    />
  );
}
