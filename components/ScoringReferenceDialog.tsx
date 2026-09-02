'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { getScoringReference } from '@/lib/scoring';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ScoringReferenceDialog({ open, onOpenChange }: Props) {
  const ref = getScoringReference();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>How urgency is scored</DialogTitle>
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
        </div>
        <DialogFooter className="sm:justify-between">
          <span className="text-xs text-muted-foreground">generated from lib/scoring.ts</span>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
