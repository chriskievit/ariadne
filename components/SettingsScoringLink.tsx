'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import ScoringReferenceDialog from './ScoringReferenceDialog';

export default function SettingsScoringLink() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        How Ariadne ranks things
      </Button>
      <ScoringReferenceDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
