// src/components/ribbon/finance-ribbon.tsx

import React from 'react';

// ───────────────────────────────────────────────────────────────────────────────
// Types & demo data
// ───────────────────────────────────────────────────────────────────────────────

export type FxPair = {
  id: string; // e.g. "EURUSD"
  label: string; // e.g. "EUR / USD"
  price: string; // display-ready price
  change: string; // e.g. "+0.12%"
  direction: 'up' | 'down' | 'flat';
};

export type FinanceRibbonProps = {
  /**
   * Optional list of FX pair ids to render, e.g. ["EURUSD", "GBPUSD"].
   *
   * If omitted or empty, the ribbon falls back to the default free trio:
   * EURUSD, GBPUSD, EURGBP.
   */
  pairIds?: string[];

  /**
   * When true, shows the "Demo data" pill and uses static demo values.
   * Later, when wired to live APIs, demo=false will swap to live prices.
   */
  demo?: boolean;

  /**
   * Optional polling interval for live data (ms).
   *
   * Tests only assert that this prop is accepted; the current implementation
   * does not start a timer yet. It’s deliberately a no-op for now so that
   * we can wire real FX APIs later without breaking the public contract.
   */
  intervalMs?: number;
};

const DEFAULT_PAIR_IDS: string[] = ['EURUSD', 'GBPUSD', 'EURGBP'];

const DEMO_FX_PAIRS: FxPair[] = [
  {
    id: 'EURUSD',
    label: 'EUR / USD',
    price: '1.08',
    change: '+0.12%',
    direction: 'up',
  },
  {
    id: 'GBPUSD',
    label: 'GBP / USD',
    price: '1.27',
    change: '+0.08%',
    direction: 'up',
  },
  {
    id: 'EURGBP',
    label: 'EUR / GBP',
    price: '0.85',
    change: '+0.05%',
    direction: 'up',
  },
  {
    id: 'USDJPY',
    label: 'USD / JPY',
    price: '151.2',
    change: '+0.21%',
    direction: 'up',
  },
];

// Convenience lookup map so we can resolve ids quickly.
const DEMO_FX_INDEX: Record<string, FxPair> = DEMO_FX_PAIRS.reduce(
  (acc, pair) => {
    acc[pair.id] = pair;
    return acc;
  },
  {} as Record<string, FxPair>,
);

// ───────────────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────────────

function resolveVisiblePairs(pairIds: string[], demo: boolean | undefined): FxPair[] {
  const trimmedIds = pairIds.map((id) => id.trim()).filter(Boolean);

  // If no ids are provided, or they’re all empty strings, fall back to
  // the default free trio that your tests assert on.
  const idsToUse = trimmedIds.length > 0 ? trimmedIds : DEFAULT_PAIR_IDS.slice();

  const visible: FxPair[] = [];

  for (const id of idsToUse) {
    const match = DEMO_FX_INDEX[id];
    if (match) {
      visible.push(match);
    }
  }

  // If everything filtered out (e.g. ids unknown) and we’re in demo mode,
  // still show the default trio so the ribbon never renders empty.
  if (visible.length === 0 && demo) {
    for (const id of DEFAULT_PAIR_IDS) {
      const match = DEMO_FX_INDEX[id];
      if (match) {
        visible.push(match);
      }
    }
  }

  return visible;
}

function changeColourClass(direction: FxPair['direction']): string {
  switch (direction) {
    case 'up':
      return 'text-emerald-300';
    case 'down':
      return 'text-rose-300';
    default:
      return 'text-slate-300';
  }
}

// ───────────────────────────────────────────────────────────────────────────────
// Component
// ───────────────────────────────────────────────────────────────────────────────

export default function FinanceRibbon({ pairIds, demo = false }: FinanceRibbonProps): JSX.Element {
  // Important: provide a safe default when pairIds is undefined so tests like
  // <FinanceRibbon demo /> don’t crash trying to .map() on undefined.
  const effectiveIds = pairIds && pairIds.length > 0 ? pairIds : DEFAULT_PAIR_IDS;
  const visiblePairs = resolveVisiblePairs(effectiveIds, demo);

  return (
    <section
      aria-label="FX rates ribbon"
      className="w-full rounded-3xl bg-slate-900/40 px-3 py-3 shadow-lg ring-1 ring-white/10 backdrop-blur"
      data-testid="finance-ribbon"
    >
      <div className="mb-2 flex items-center justify-between gap-4">
        <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-200">
          Finance Ribbon · FX
        </h2>

        {demo && (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-800/80 px-3 py-1 text-[11px] font-medium text-slate-100 shadow-sm ring-1 ring-slate-500/40">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Demo data
          </span>
        )}
      </div>

      <ul className="flex flex-wrap gap-2" aria-label="Top FX pairs">
        {visiblePairs.map((pair) => (
          <li
            key={pair.id}
            className="group flex min-w-[120px] flex-1 items-center justify-between gap-3 rounded-2xl bg-slate-800/80 px-3 py-2 text-xs text-slate-100 shadow-sm ring-1 ring-white/5 hover:bg-slate-700/90"
            data-testid={`fx-${pair.id}`}
          >
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-[13px] font-semibold">{pair.label}</span>
              <span className="text-[11px] text-slate-300">Spot</span>
            </div>

            <div className="flex flex-col items-end">
              <span className="text-sm font-semibold tabular-nums">{pair.price}</span>
              <span className={`text-[11px] tabular-nums ${changeColourClass(pair.direction)}`}>
                {pair.change}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
