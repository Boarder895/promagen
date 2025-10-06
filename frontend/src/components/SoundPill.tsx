'use client';

import { useSound } from '@/hooks/useSound';

export function SoundPill() {
  const { enabled, toggle } = useSound();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={enabled}
      className={`px-3 py-1 rounded-full border text-xs font-medium transition
        ${enabled ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-gray-50 border-gray-300 text-gray-700'}`}
      title={`Sound ${enabled ? 'on' : 'off'}`}
    >
      Ã°Å¸â€Ë† Sound {enabled ? 'on' : 'off'}
    </button>
  );
}

