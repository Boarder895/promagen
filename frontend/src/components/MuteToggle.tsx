// @/components/MuteToggle.tsx
'use client';

import * as React from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { useChime } from '@/hooks/useChime';

export function MuteToggle() {
  const { muted, toggleMuted } = useChime();
  return (
    <button
      type="button"
      aria-pressed={muted}
      onClick={toggleMuted}
      className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-neutral-200/70 dark:border-neutral-800 bg-white/60 dark:bg-neutral-900/40 shadow-sm"
      title={muted ? 'Unmute chimes' : 'Mute chimes'}
    >
      {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
      <span>{muted ? 'Muted' : 'Sound on'}</span>
    </button>
  );
}
