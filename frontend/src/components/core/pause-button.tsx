'use client';

import { usePause } from '@/state/pause';

export default function PauseButton() {
  const { paused, toggle } = usePause();
  return (
    <button
      type="button"
      aria-pressed={paused}
      onClick={toggle}
      className="rounded-lg border border-white/10 px-2 py-1 text-xs text-white/80 hover:bg-white/10"
      title="Pause/resume live tiles"
    >
      {paused ? 'Resume' : 'Pause'}
    </button>
  );
}
