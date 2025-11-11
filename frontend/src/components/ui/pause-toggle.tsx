"use client";

import { useState } from "react";

type Props = {
  label?: string;
  onChange?: (paused: boolean) => void;
  defaultPaused?: boolean;
};

export default function PauseToggle({ label = "Pause animations", onChange, defaultPaused = false }: Props) {
  const [paused, setPaused] = useState<boolean>(defaultPaused);

  return (
    <button
      type="button"
      aria-pressed={paused}
      aria-label={label}
      className="rounded-xl px-3 py-1 text-xs border border-gray-300 bg-white/80 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      onClick={() => {
        const next = !paused;
        setPaused(next);
        onChange?.(next);
      }}
      data-testid="pause-toggle"
    >
      {paused ? "Resume" : "Pause"}
    </button>
  );
}
