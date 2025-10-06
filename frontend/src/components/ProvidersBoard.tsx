// @/components/ProvidersBoard.tsx
'use client';

import * as React from 'react';
import { BestRightNowBadge } from '@/components/BestRightNowBadge';

export const ProvidersBoard: React.FC = () => {
  // Fallback â€œbest right now ends in â€¦â€ timer (2h from now).
  const fallbackCloseIso = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

  return (
    <div className="rounded-xl border bg-white/60 dark:bg-neutral-900/40 p-3 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold tracking-wide text-neutral-600">
          Top 20 AI Image Platforms
        </h3>

        {/* ? Use the standard `until` prop (no `regionCloseIso`) */}
        <BestRightNowBadge until={fallbackCloseIso} />
      </div>

      {/* Simple placeholder grid (safe to replace with real data later) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <article
            key={i}
            className="rounded-lg border border-neutral-200/70 dark:border-neutral-800 p-3 bg-white/70 dark:bg-neutral-900/50"
          >
            <header className="flex items-center justify-between">
              <div className="text-sm font-medium">Provider #{i + 1}</div>
              <span className="text-[10px] text-neutral-500">MIG</span>
            </header>
            <p className="mt-2 text-xs text-neutral-600 dark:text-neutral-400">
              Placeholder card â€” wire this up to live MIG data when ready.
            </p>
          </article>
        ))}
      </div>
    </div>
  );
};




