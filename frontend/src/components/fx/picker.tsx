'use client';

import * as React from 'react';

type Props = {
  onClose?: () => void;
  maxPairs?: number; // allow caller to limit
};

const MAX_FALLBACK = 6;

export default function FxPicker({ onClose, maxPairs }: Props) {
  const limit = Math.max(1, maxPairs ?? MAX_FALLBACK);
  const [favorites, setFavorites] = React.useState<string[]>([]);

  const add = (id: string) => {
    setFavorites(prev => {
      const next = [prev[1] ?? prev[0], id].filter(Boolean) as string[];
      return next.slice(0, limit);
    });
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="FX pair picker" className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Choose FX Pair</h3>
        <button onClick={onClose} className="rounded-lg px-2 py-1 text-sm hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-sky-400">
          Close
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        {['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD', 'USDCHF'].map(id => (
          <button
            key={id}
            onClick={() => add(id)}
            className="rounded-lg bg-white/5 px-3 py-2 text-left hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-sky-400"
            aria-pressed={favorites.includes(id)}
          >
            {id}
          </button>
        ))}
      </div>

      {favorites.length > 0 && (
        <div className="mt-4 text-sm text-white/70">
          Favourites: {favorites.join(', ')}
        </div>
      )}
    </div>
  );
}
