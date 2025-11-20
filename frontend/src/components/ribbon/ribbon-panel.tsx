// src/components/ribbon/ribbon-panel.tsx
'use client';

import React from 'react';

type RibbonPanelProps = {
  pairIds: string[];
  demo?: boolean;
};

// ───────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────

type FxRibbonItem = {
  id: string; // e.g. "EURUSD"
  label: string; // e.g. "EUR / USD"
  bid: number;
  ask: number;
  changePct: number;
};

type CommodityRibbonItem = {
  id: string;
  label: string;
  unit: string;
  price: number;
  changePct: number;
};

type CryptoRibbonItem = {
  id: string;
  symbol: string;
  name: string;
  price: number;
  changePct: number;
};

// ───────────────────────────────────────────────
// Demo data – static, Jest-safe, no APIs
// ───────────────────────────────────────────────

const DEMO_FX_ROW: FxRibbonItem[] = [
  {
    id: 'EURUSD',
    label: 'EUR / USD',
    bid: 1.0832,
    ask: 1.0836,
    changePct: 0.18,
  },
  {
    id: 'GBPUSD',
    label: 'GBP / USD',
    bid: 1.2435,
    ask: 1.2439,
    changePct: -0.12,
  },
  {
    id: 'EURGBP',
    label: 'EUR / GBP',
    bid: 0.8707,
    ask: 0.871,
    changePct: 0.05,
  },
  {
    id: 'USDJPY',
    label: 'USD / JPY',
    bid: 151.34,
    ask: 151.39,
    changePct: 0.27,
  },
  {
    id: 'USDCNY',
    label: 'USD / CNY',
    bid: 7.2431,
    ask: 7.2439,
    changePct: -0.19,
  },
];

const DEMO_COMMODITIES_ROW: CommodityRibbonItem[] = [
  {
    id: 'BRENT',
    label: 'Brent Crude',
    unit: 'bbl',
    price: 82.34,
    changePct: 0.42,
  },
  {
    id: 'WTI',
    label: 'WTI Crude',
    unit: 'bbl',
    price: 78.11,
    changePct: 0.31,
  },
  {
    id: 'NATGAS_HH',
    label: 'Natural Gas (Henry Hub)',
    unit: 'MMBtu',
    price: 2.71,
    changePct: -1.25,
  },
  {
    id: 'RBOB',
    label: 'Gasoline (RBOB)',
    unit: 'gal',
    price: 2.38,
    changePct: 0.63,
  },
  {
    id: 'ULSD',
    label: 'Gasoil / Diesel (ULSD)',
    unit: 'gal',
    price: 2.95,
    changePct: -0.44,
  },
  {
    id: 'GOLD',
    label: 'Gold',
    unit: 'oz',
    price: 1963.5,
    changePct: 0.21,
  },
  {
    id: 'SILVER',
    label: 'Silver',
    unit: 'oz',
    price: 22.84,
    changePct: -0.37,
  },
];

const DEMO_CRYPTO_ROW: CryptoRibbonItem[] = [
  {
    id: 'BTC',
    symbol: 'BTC',
    name: 'Bitcoin',
    price: 36450,
    changePct: 1.83,
  },
  {
    id: 'ETH',
    symbol: 'ETH',
    name: 'Ethereum',
    price: 2040,
    changePct: 1.12,
  },
  {
    id: 'SOL',
    symbol: 'SOL',
    name: 'Solana',
    price: 58.4,
    changePct: -2.47,
  },
  {
    id: 'XRP',
    symbol: 'XRP',
    name: 'XRP',
    price: 0.61,
    changePct: 0.74,
  },
  {
    id: 'ADA',
    symbol: 'ADA',
    name: 'Cardano',
    price: 0.38,
    changePct: -0.95,
  },
];

// Normalise things like "usd/jpy", "USD JPY", "usd-jpy" → "USDJPY"
function normalisePairId(raw: string): string {
  return raw.replace(/[^a-zA-Z]/g, '').toUpperCase();
}

// Keep FX row in sync with the pairIds coming from the page,
// but fall back to the full demo row if nothing matches.
function getDemoFxForPairIds(pairIds: string[] | undefined): FxRibbonItem[] {
  if (!pairIds || pairIds.length === 0) {
    return DEMO_FX_ROW;
  }

  const byNormId = new Map<string, FxRibbonItem>();
  for (const item of DEMO_FX_ROW) {
    byNormId.set(normalisePairId(item.id), item);
  }

  const ordered: FxRibbonItem[] = [];

  for (const raw of pairIds) {
    const norm = normalisePairId(raw);
    const found = byNormId.get(norm);
    if (found && !ordered.includes(found)) {
      ordered.push(found);
    }
  }

  return ordered.length > 0 ? ordered : DEMO_FX_ROW;
}

// ───────────────────────────────────────────────
// Formatting helpers
// ───────────────────────────────────────────────

function formatChange(changePct: number): string {
  const sign = changePct >= 0 ? '+ ' : '';
  return `${sign}${changePct.toFixed(2)}%`;
}

function changeClass(changePct: number): string {
  if (changePct > 0) return 'text-emerald-400';
  if (changePct < 0) return 'text-rose-400';
  return 'text-slate-300';
}

// ───────────────────────────────────────────────
// Presentational subcomponents
// ───────────────────────────────────────────────

type RowShellProps = {
  label: string;
  children: React.ReactNode;
};

// Row label + chips centred horizontally.
function RowShell({ label, children }: RowShellProps): JSX.Element {
  return (
    <section
      className="flex flex-col items-center gap-1"
      aria-label={label}
      data-testid={`finance-row-${label.toLowerCase()}`}
    >
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-200">
        {label}
      </div>
      <div className="flex flex-wrap justify-center gap-2">{children}</div>
    </section>
  );
}

type FxRowProps = {
  items: FxRibbonItem[];
};

function FxRow({ items }: FxRowProps): JSX.Element {
  return (
    <RowShell label="FX">
      {items.map((item) => (
        <article
          key={item.id}
          className="min-w-[140px] rounded-2xl border border-white/10 bg-slate-900/40 px-3 py-2 text-xs text-slate-50 shadow-sm backdrop-blur-sm"
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="truncate font-medium">{item.label}</h3>
            <span className="tabular-nums text-[11px] text-slate-100">{item.bid.toFixed(5)}</span>
          </div>
          <div className="mt-1 flex items-baseline justify-between gap-2 text-[11px]">
            <span className="tabular-nums text-slate-300">Ask {item.ask.toFixed(5)}</span>
            <span className={changeClass(item.changePct)}>{formatChange(item.changePct)}</span>
          </div>
        </article>
      ))}
    </RowShell>
  );
}

type CommoditiesRowProps = {
  items: CommodityRibbonItem[];
};

function CommoditiesRow({ items }: CommoditiesRowProps): JSX.Element {
  return (
    <RowShell label="COMMODITIES">
      {items.map((item) => (
        <article
          key={item.id}
          className="min-w-[150px] rounded-2xl border border-white/10 bg-slate-900/40 px-3 py-2 text-xs text-slate-50 shadow-sm backdrop-blur-sm"
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="truncate font-medium">{item.label}</h3>
            <span className="tabular-nums text-[11px] text-slate-100">{item.price.toFixed(2)}</span>
          </div>
          <div className="mt-1 flex items-baseline justify-between gap-2 text-[11px]">
            <span className="text-slate-300">{item.unit}</span>
            <span className={changeClass(item.changePct)}>{formatChange(item.changePct)}</span>
          </div>
        </article>
      ))}
    </RowShell>
  );
}

type CryptoRowProps = {
  items: CryptoRibbonItem[];
};

function CryptoRow({ items }: CryptoRowProps): JSX.Element {
  return (
    <RowShell label="CRYPTO">
      {items.map((item) => (
        <article
          key={item.id}
          className="min-w-[140px] rounded-2xl border border-white/10 bg-slate-900/40 px-3 py-2 text-xs text-slate-50 shadow-sm backdrop-blur-sm"
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="truncate font-medium">
              {item.symbol} · {item.name}
            </h3>
            <span className="tabular-nums text-[11px] text-slate-100">{item.price.toFixed(2)}</span>
          </div>
          <div className="mt-1 flex items-baseline justify-between gap-2 text-[11px]">
            <span className="text-slate-300">USD</span>
            <span className={changeClass(item.changePct)}>{formatChange(item.changePct)}</span>
          </div>
        </article>
      ))}
    </RowShell>
  );
}

// ───────────────────────────────────────────────
// Main component
// ───────────────────────────────────────────────

export default function RibbonPanel({ pairIds, demo }: RibbonPanelProps): JSX.Element {
  const [paused, setPaused] = React.useState(false);

  // Time label is cosmetic; static so Jest doesn’t care about timers.
  const now = React.useMemo(() => new Date(), []);
  const timeLabel = React.useMemo(() => {
    try {
      return now.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return now.toISOString().slice(11, 16);
    }
  }, [now]);

  const fxItems = React.useMemo(() => getDemoFxForPairIds(pairIds), [pairIds]);

  const subtitle = demo ? 'Demo data · Static snapshot' : 'Static snapshot';

  return (
    <section
      aria-label="Finance ribbon"
      className="mb-6 rounded-3xl border border-white/10 bg-slate-900/30 p-4 shadow-md backdrop-blur"
      data-testid="finance-ribbon-shell"
    >
      <header className="mb-4 flex items-baseline justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-200">
            Finance Ribbon
          </p>
          <p className="text-[11px] text-slate-300">{subtitle}</p>
        </div>

        <div className="flex items-center gap-3">
          <p className="text-[11px] text-slate-400">As of {timeLabel} (local)</p>
          <button
            type="button"
            onClick={() => setPaused((previous) => !previous)}
            className="rounded-lg px-3 py-1.5 text-xs font-medium ring-1 ring-slate-300 hover:bg-slate-50/10 active:scale-[0.99]"
            aria-pressed={paused}
          >
            {paused ? 'Resume' : 'Pause'}
          </button>
        </div>
      </header>

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        Finance ribbon loaded. Displaying FX, commodities, and crypto demo data.
      </p>

      <div className="space-y-4">
        <FxRow items={fxItems} />
        <CommoditiesRow items={DEMO_COMMODITIES_ROW} />
        <CryptoRow items={DEMO_CRYPTO_ROW} />
      </div>
    </section>
  );
}
