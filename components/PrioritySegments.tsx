'use client';

import SegmentedChoice, { type SegmentedOption } from './SegmentedChoice';
import { PRIORITY_LABEL, PRIORITY_ORDER, priorityPoints } from '@/lib/scoring';
import type { Priority } from '@/lib/types';

// Ordered low -> high for the control, the opposite of PRIORITY_ORDER (which
// is high-first because the reference dialog lists the biggest number at the
// top). Reading left-to-right as increasing weight is what a person expects
// from a scale.
const OPTIONS: SegmentedOption<Priority>[] = [...PRIORITY_ORDER].reverse().map((priority) => ({
  value: priority,
  label: PRIORITY_LABEL[priority],
  readout: `+${priorityPoints(priority)}`,
}));

interface Props {
  value: Priority | null;
  onChange: (value: Priority | null) => void;
  labelledBy?: string;
  disabled?: boolean;
}

/**
 * The picker for an ad-hoc item's hand-set priority.
 *
 * Clearable, because "I haven't decided" is a real state and the one every
 * item starts in. Each option states its point contribution, so the control
 * teaches the formula rather than asking you to remember what "high" is
 * worth.
 */
export default function PrioritySegments({ value, onChange, labelledBy, disabled }: Props) {
  return (
    <SegmentedChoice
      options={OPTIONS}
      value={value}
      onChange={onChange}
      clearable
      labelledBy={labelledBy}
      disabled={disabled}
    />
  );
}
