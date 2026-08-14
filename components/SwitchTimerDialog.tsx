'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentTitle: string;
  onJustStop: () => void;
  onSwitch: () => void;
}

export default function SwitchTimerDialog({ open, onOpenChange, currentTitle, onJustStop, onSwitch }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>A timer is already running</DialogTitle>
          <DialogDescription>
            &ldquo;{currentTitle}&rdquo; is still timing. Stop it, or switch to the new item?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onJustStop}>
            Just stop it
          </Button>
          <Button type="button" onClick={onSwitch}>
            Switch
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
