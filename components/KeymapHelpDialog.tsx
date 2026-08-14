'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { KEYMAP } from '@/lib/keymap';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function KeymapHelpDialog({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
        </DialogHeader>
        <div className="space-y-1 text-sm">
          {KEYMAP.map((binding) => (
            <div key={binding.keys} className="flex items-center justify-between gap-3">
              <span>{binding.description}</span>
              <kbd className="font-mono text-xs text-muted-foreground">{binding.keys}</kbd>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
