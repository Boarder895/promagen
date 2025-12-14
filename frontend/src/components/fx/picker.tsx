'use client';

import * as React from 'react';

import FxPairLabel from '@/components/ribbon/fx-pair-label';
import { formatFxPairLabelWithFlags } from '@/lib/finance/flags';
import { assertFxRibbonSsotValid, getFxRibbonPairs } from '@/lib/finance/fx-pairs';

type Props = {
  onClose?: () => void;
  maxPairs?: number; // maximum favourites user can pick
};

const MAX_FALLBACK = 6;

type LabelInfo = {
  node: React.ReactNode;
  title: string;
};

export default function FxPicker({ onClose, maxPairs }: Props) {
  const limit = Math.max(1, maxPairs ?? MAX_FALLBACK);
  const [favourites, setFavourites] = React.useState<string[]>([]);

  const pairs = React.useMemo(() => {
    assertFxRibbonSsotValid();
    // Show the SSOT list (free tier defaults), count is SSOT-driven.
    return getFxRibbonPairs({ tier: 'free', order: 'ssot' });
  }, []);

  const idToLabel = React.useMemo(() => {
    const map = new Map<string, LabelInfo>();
    for (const p of pairs) {
      map.set(p.id, {
        node: (
          <FxPairLabel
            base={p.base}
            baseCountryCode={p.baseCountryCode}
            quote={p.quote}
            quoteCountryCode={p.quoteCountryCode}
          />
        ),
        title: formatFxPairLabelWithFlags(p.base, p.baseCountryCode, p.quote, p.quoteCountryCode),
      });
    }
    return map;
  }, [pairs]);

  const toggleFavourite = (id: string) => {
    setFavourites((prev) => {
      const exists = prev.includes(id);
      const next = exists ? prev.filter((x) => x !== id) : [...prev, id];
      return next.slice(0, limit);
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="FX pair picker"
      className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Choose FX Pair</h3>
        <button
          onClick={onClose}
          className="rounded-lg px-2 py-1 text-sm hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-sky-400"
        >
          Close
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        {pairs.map((p) => {
          const info = idToLabel.get(p.id);
          const labelNode = info?.node ?? p.id;
          const title = info?.title ?? p.id;
          const pressed = favourites.includes(p.id);

          return (
            <button
              key={p.id}
              onClick={() => toggleFavourite(p.id)}
              className="rounded-lg bg-white/5 px-3 py-2 text-left hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-sky-400"
              aria-pressed={pressed}
              title={title}
            >
              {labelNode}
            </button>
          );
        })}
      </div>

      {favourites.length > 0 && (
        <div className="mt-4 text-sm text-white/70">
          Favourites:{' '}
          {favourites
            .map((id) => {
              const info = idToLabel.get(id);
              return info?.title ?? id;
            })
            .join(', ')}
        </div>
      )}
    </div>
  );
}
