'use client';

import React from 'react';

export default function PauseButton({
  paused,
  onToggle,
}: {
  paused: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={[
        'mr-4 mt-2 inline-flex h-8 w-8 items-center justify-center rounded-full',
        'bg-white/5 ring-1 ring-white/10 hover:bg-white/10',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400',
        paused ? 'opacity-80' : 'opacity-100',
      ].join(' ')}
      aria-label={paused ? 'Resume live ribbon' : 'Pause live ribbon'}
      title={paused ? 'Resume live ribbon' : 'Pause live ribbon'}
    >
      <span aria-hidden="true" className="text-neutral-200">
        {paused ? '▶' : '⏸'}
      </span>
    </button>
  );
}
