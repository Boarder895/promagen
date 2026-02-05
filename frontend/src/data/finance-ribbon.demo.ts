// src/data/finance-ribbon.demo.ts
// 
// Demo data for FX and Commodities ribbons.
// Used for preview/demo modes when live data is unavailable.
//
// v2.0: Crypto removed - no longer part of the ribbon

export type FxRibbonItem = {
  id: string; // e.g. "EURUSD"
  label: string; // e.g. "EUR / USD"
  bid: number;
  ask: number;
  changePct: number;
};

export type CommodityRibbonItem = {
  id: string; // e.g. "BRENT"
  label: string; // e.g. "Brent Crude"
  unit: string; // e.g. "bbl"
  price: number;
  changePct: number;
};

// ───────────────────────────────────────────────────────────────────────────────
// Demo FX row – free tier: 5 fixed pairs
// Values are static demo numbers, not live market data.
// ───────────────────────────────────────────────────────────────────────────────

export const DEMO_FX_ROW: FxRibbonItem[] = [
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
    id: 'USDJPY',
    label: 'USD / JPY',
    bid: 151.34,
    ask: 151.39,
    changePct: 0.27,
  },
  {
    id: 'EURGBP',
    label: 'EUR / GBP',
    bid: 0.8707,
    ask: 0.871,
    changePct: 0.05,
  },
  {
    id: 'AUDUSD',
    label: 'AUD / USD',
    bid: 0.6581,
    ask: 0.6584,
    changePct: 0.09,
  },
];

// ───────────────────────────────────────────────────────────────────────────────
// Demo Commodities row – free tier: 7 fixed items (2–3–2 layout later)
// ───────────────────────────────────────────────────────────────────────────────

export const DEMO_COMMODITIES_ROW: CommodityRibbonItem[] = [
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

// ───────────────────────────────────────────────────────────────────────────────
// Helpers – keep FX row in sync with the pairIds you pass from the homepage
// ───────────────────────────────────────────────────────────────────────────────

export function getDemoFxForPairIds(pairIds: string[] | undefined): FxRibbonItem[] {
  if (!pairIds || pairIds.length === 0) {
    return DEMO_FX_ROW;
  }

  const byId = new Map<string, FxRibbonItem>(DEMO_FX_ROW.map((item) => [item.id, item]));

  const ordered: FxRibbonItem[] = [];

  for (const id of pairIds) {
    const found = byId.get(id);
    if (found) {
      ordered.push(found);
    }
  }

  // If nothing matched (e.g. typo), fall back to the default row so the UI never looks empty.
  return ordered.length > 0 ? ordered : DEMO_FX_ROW;
}
