'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { getScoringReference } from '@/lib/scoring';
import { getSuggestionReference } from '@/lib/suggest';
import { WORK_TYPE_LABEL, type WorkType } from '@/lib/calibration';
import { formatMinutes } from '@/lib/format-duration';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ScoringReferenceDialog({ open, onOpenChange }: Props) {
  const ref = getScoringReference();
  // Two generated halves, composed here rather than in either lib, so
  // lib/scoring.ts keeps no dependency on the suggestion feature.
  const suggest = getSuggestionReference();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>How urgency is scored, and how a day is suggested</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <p className="text-muted-foreground">
            This is the whole formula. There is no model, no learned weight, and nothing hidden. Every number below
            is the number the code adds.
          </p>

          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">
              Why the signal exists · exactly one applies
            </p>
            <div className="space-y-1">
              {ref.primaryReasons.map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-3">
                  <span>{row.label}</span>
                  <span className="font-mono tabular-nums">+{row.points}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">
              Then these stack on top · any number · reported by the sources
            </p>
            <div className="space-y-1">
              {ref.stackingRules.map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-3">
                  <span>{row.label}</span>
                  <span className="font-mono tabular-nums">+{row.points}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">
              And this one you set yourself · ad-hoc items only
            </p>
            <div className="space-y-1">
              {ref.selfSetRules.map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-3">
                  <span>{row.label}</span>
                  <span className="font-mono tabular-nums">+{row.points}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-1 border-t pt-2">
            <div className="flex items-center justify-between gap-3 font-medium">
              <span>Highest score possible</span>
              <span className="font-mono tabular-nums">{ref.maxScore}</span>
            </div>
            {/* Ad-hoc items are created without review activity or an
                activity timestamp, and nothing ever gives them one, so two
                of the stacking rules can never fire on them. Reporting the
                same ceiling for both would overstate their headroom. */}
            <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <span>For an ad-hoc item, where staleness and reviews never apply</span>
              <span className="font-mono tabular-nums">{ref.maxScoreAdhoc}</span>
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Bands, and what they colour</p>
            <div className="space-y-1">
              {ref.bands.map((band) => (
                <div key={band.tier} className="flex items-center justify-between gap-3">
                  <span>{band.label}</span>
                  <span className="font-mono tabular-nums text-muted-foreground">{band.range}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2 border-t pt-2">
            {/* Deliberately uncounted. This heading used to hardcode "two"
                and was wrong the moment a third rule was disclosed. */}
            <p className="text-xs font-medium text-muted-foreground">The rules that aren&apos;t points</p>
            {ref.nonPointRules.map((rule) => (
              <p key={rule} className="text-xs text-muted-foreground">
                {rule}
              </p>
            ))}
          </div>

          <div className="space-y-4 border-t pt-3">
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                Suggesting a day · you pick one of three
              </p>
              <div className="space-y-1.5">
                {suggest.algorithms.map((algorithm) => (
                  <div key={algorithm.key}>
                    <p>{algorithm.label}</p>
                    <p className="text-xs text-muted-foreground">{algorithm.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                How long it thinks something takes · first of these that applies
              </p>
              <ol className="space-y-1">
                {suggest.durationOrder.map((step, i) => (
                  <li key={step} className="flex gap-2 text-xs text-muted-foreground">
                    <span className="font-mono tabular-nums">{i + 1}.</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                The fixed defaults, used until there are enough logs
              </p>
              <div className="space-y-1">
                {(Object.keys(suggest.fallbackMinutes) as WorkType[]).map((workType) => (
                  <div key={workType} className="flex items-center justify-between gap-3">
                    <span>{WORK_TYPE_LABEL[workType]}</span>
                    <span className="font-mono tabular-nums text-muted-foreground">
                      {formatMinutes(suggest.fallbackMinutes[workType])}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                The lean · share of the day work items may take
              </p>
              <p className="font-mono text-xs tabular-nums text-muted-foreground">
                {suggest.leanShares.map((share) => `${Math.round(share * 100)}%`).join(' · ')}
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">What a suggestion will never do</p>
              {suggest.nonPointRules.map((rule) => (
                <p key={rule} className="text-xs text-muted-foreground">
                  {rule}
                </p>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter className="sm:justify-between">
          <span className="text-xs text-muted-foreground">generated from lib/scoring.ts and lib/suggest.ts</span>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
