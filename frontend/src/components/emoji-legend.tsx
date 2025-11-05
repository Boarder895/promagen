'use client';

import { useState } from 'react';

export function EmojiLegend() {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
        className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-800"
      >
        ? Emoji legend
      </button>
      {open && (
        <div className="mt-2 grid grid-cols-2 gap-3 rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-sm">
          <Legend emoji="??" text="Prompt Designer" />
          <Legend emoji="??" text="Paste Required" />
          <Legend emoji="?" text="API Supported (Stage 3)" />
          <Legend emoji="??" text="Style Label" />
          <Legend emoji="??" text="Leaderboard Rank" />
        </div>
      )}
    </div>
  );
}
function Legend({ emoji, text }: { emoji: string; text: string }) {
  return <div className="flex items-center gap-2"><span className="text-lg">{emoji}</span><span>{text}</span></div>;
}




