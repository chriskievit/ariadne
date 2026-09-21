'use client';

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

  const value: Mode | null = pathname === '/' ? 'planning' : pathname.startsWith('/work') ? 'work' : null;

  return (
    <SegmentedChoice<Mode>
      options={MODES}
      value={value}
      onChange={(next) => {
        if (next) router.push(MODE_PATH[next]);
      }}
      ariaLabel="Mode"
    />
  );
}
