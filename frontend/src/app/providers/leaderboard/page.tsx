// frontend/src/app/providers/leaderboard/page.tsx
'use client';

import React from 'react';

// Import the typed data array
import { TOP20_PROVIDERS, type ProviderTile } from '@/app/providers/top20';

// Minimal runtime type check to keep us safe if someone breaks the data later.
function toProviderArray(input: unknown): ProviderTile[] {
  const isTile = (v: any): v is ProviderTile =>
    v &&
    typeof v === 'object' &&
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    typeof v.url === 'string' &&
    typeof v.tagline === 'string' &&
    typeof v.score === 'number' &&
    (v.trend === 'Up' || v.trend === 'Down' || v.trend === 'Flat');

  if (Array.isArray(input)) {
    return input.filter(isTile);
  }
  return isTile(input) ? [input] : [];
}

export default function ProvidersLeaderboardPage() {
  // Coerce any shape into a valid ProviderTile[]
  const providers = toProviderArray(TOP20_PROVIDERS);

  return (
    <main className="p-6">
      <h1 className="text-xl font-semibold mb-4">AI Image-Generation Platforms — Top 20</h1>

      <ul className="grid grid-cols-1 gap-3">
        {providers.map((p) => (
          <li
            key={p.id}
            className="rounded-2xl bg-neutral-900/40 border border-neutral-800 p-4 flex items-center justify-between"
          >
            <div>
              <div className="text-base font-medium">{p.name}</div>
              <div className="text-sm text-neutral-400">{p.tagline}</div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-sm">
                <span className="font-semibold">{p.score}</span>
                <span className="ml-1 text-neutral-400">/ 100</span>
              </div>
              <div
                className={`text-xs px-2 py-1 rounded-full border ${
                  p.trend === 'Up'
                    ? 'border-emerald-600'
                    : p.trend === 'Down'
                    ? 'border-red-600'
                    : 'border-neutral-600'
                }`}
                title={`Trend: ${p.trend}`}
              >
                {p.trend}
              </div>
              <a
                className="text-sm underline underline-offset-4"
                href={p.affiliateUrl ?? p.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Visit
              </a>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}



