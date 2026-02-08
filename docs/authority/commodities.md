# Commodities System Architecture

> **Authority Document** — Promagen Commodities Feed  
> **Last Updated**: 2026-02-08 (v2.6 — Retail Units, Currency-Branded Colours, Strict 2dp)
> **Status**: Production

---

## Table of Contents

1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Commodity Catalog](#commodity-catalog)
4. [Gateway Layer](#gateway-layer)
5. [Frontend Layer](#frontend-layer)
6. [Movers Grid UI](#movers-grid-ui)
7. [Currency Conversion System](#currency-conversion-system)
8. [Retail Unit System](#retail-unit-system)
9. [Price Formatting](#price-formatting)
10. [API Endpoints](#api-endpoints)
11. [Rate Limits & Budget](#rate-limits--budget)
12. [SSOT Flow](#ssot-flow)
13. [Tier Differences](#tier-differences)
14. [File Reference](#file-reference)
15. [Customization Guide](#customization-guide)

---

## Overview

The Commodities system provides real-time pricing data for **78 commodities** across three groups:

- **Energy** (crude oil, natural gas, coal, etc.)
- **Agriculture** (grains, softs, livestock)
- **Metals** (precious, base, battery metals)

### Key Differentiators from Other Feeds

| Aspect            | Indices/FX              | Commodities                          |
| ----------------- | ----------------------- | ------------------------------------ |
| **Batch Support** | Yes (multiple per call) | No (1 commodity per call)            |
| **Scheduler**     | Clock-aligned slots     | Rolling 5-min timer                  |
| **Cache**         | Per-request             | Per-commodity (2h TTL)               |
| **Rate Limit**    | 60/min (Professional)   | 60/min (shared; scheduler does 1/5m) |
| **Cold Start**    | Instant                 | ~390 min (~6.5 hours)                |
| **Queue Order**   | Deterministic           | Full Fisher-Yates shuffle (all 78)   |

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND (Vercel)                              │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────────┐   │
│  │ Movers Grid     │   │ useCommodities  │   │ /api/commodities    │   │
│  │ (2×2 winners    │ ← │ Quotes Hook     │ ← │ /config route       │   │
│  │  + 2×2 losers)  │   │ (30-min poll)   │   │ (returns all IDs)   │   │
│  └─────────────────┘   └─────────────────┘   └──────────┬──────────┘   │
└─────────────────────────────────────────────────────────┼───────────────┘
                                                          │
                                                          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           GATEWAY (Fly.io)                               │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    commoditiesHandler                            │   │
│  │  ┌─────────┐  ┌──────────────┐  ┌─────────────────────────────┐ │   │
│  │  │  SSOT   │  │ Per-Commodity│  │ Rolling Scheduler           │ │   │
│  │  │  init   │  │ Cache (2h)   │  │ • 5-min ticks (1 per call)  │ │   │
│  │  │         │  │              │  │ • Full Fisher-Yates shuffle  │ │   │
│  │  └────┬────┘  └──────┬───────┘  │ • All 78 randomised each    │ │   │
│  │       │              │          │   cycle — no tiers           │ │   │
│  │       ▼              ▼          └────────────┬────────────────┘ │   │
│  │  ┌─────────┐  ┌──────────────┐               │                  │   │
│  │  │ Circuit │  │ Budget       │               ▼                  │   │
│  │  │ Breaker │  │ Manager      │  ┌─────────────────────────────┐ │   │
│  │  │ (3 fail)│  │ (1000/day)   │  │ commodities-adapter.ts      │ │   │
│  │  └─────────┘  └──────────────┘  │ (Marketstack v2 API)        │ │   │
│  │                                  └─────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      MARKETSTACK API (External)                          │
├─────────────────────────────────────────────────────────────────────────┤
│  Endpoint: GET /v2/commodities?commodity_name=X                          │
│  Rate Limit: 60 calls/minute (Professional tier)                         │
│  Subscription: Professional tier (3,333 calls/day total)                 │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Commodity Catalog

### Structure

The catalog is defined in `commodities.catalog.json` and validated by Zod schema at build time.

```typescript
interface Commodity {
  id: string; // e.g., "brent_crude", "gold", "coffee"
  name: string; // e.g., "Brent Crude Oil"
  shortName: string; // e.g., "Brent"
  symbol: string; // e.g., "BRN"

  group: 'energy' | 'agriculture' | 'metals';
  subGroup: CommoditySubGroup; // e.g., 'crude_oil', 'precious', 'grains'

  emoji: string; // e.g., "🛢️", "🥇", "☕"
  quoteCurrency:
    | 'USD'
    | 'EUR'
    | 'GBP'
    | 'INR'
    | 'BRL'
    | 'CNY'
    | 'ZAR'
    | 'CAD'
    | 'NOK'
    | 'MYR'
    | 'AUD';

  isActive: boolean; // Only active commodities are fetched
  isSelectableInRibbon: boolean;
  priority: number; // Importance ranking (1 = highest)

  tags: string[]; // Searchable tags
  ribbonLabel: string; // Display label for ribbon
  ribbonSubtext: string; // Secondary text

  geoLevel: 'country' | 'region' | 'multi_country';
  displayCountryCodes: string[]; // ISO-3166-1 alpha-2 codes

  // Optional tooltip fields
  yearFirstTraded?: number;
  fact?: string; // Fun fact (max 150 chars)
}
```

### Commodity Groups (78 Total Active)

| Group           | Subgroups                                             | Count | Examples                                |
| --------------- | ----------------------------------------------------- | ----- | --------------------------------------- |
| **Energy**      | crude_oil, natural_gas, refined_products, coal, power | ~15   | Brent, WTI, TTF Gas, Henry Hub          |
| **Agriculture** | grains, softs, livestock, oilseeds, fertilisers       | ~35   | Wheat, Corn, Coffee, Sugar, Live Cattle |
| **Metals**      | precious, base, battery_metals                        | ~28   | Gold, Silver, Copper, Aluminum, Lithium |

### Catalog → Marketstack Name Mapping

Some commodities require explicit mapping due to naming differences:

```typescript
const CATALOG_TO_MARKETSTACK: Record<string, string> = {
  brent_crude: 'brent', // NOT "brent crude"
  wti_crude: 'crude oil',
  aluminium: 'aluminum', // UK → US spelling
  ttf_natural_gas: 'natural gas',
  iron_ore: 'iron ore',
  // Default: replace underscores with spaces
};
```

---

## Gateway Layer

### Rolling Scheduler (`commodities-scheduler.ts`)

Unlike other feeds that use clock-aligned batch fetches, commodities use a **rolling scheduler** because the Marketstack v2 commodities endpoint only supports 1 commodity per call (no batching).

#### Interval

```typescript
// Single fixed interval — no cold-start burst mode
const DEFAULT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const MIN_INTERVAL_MS = 2 * 60 * 1000; // 2-min safety floor

// Overridable via env: COMMODITIES_REFRESH_INTERVAL_MS
// Enforced minimum: 2 minutes (prevents accidental thrashing)
```

**Timing Math:**

| Metric                      | Value              |
| --------------------------- | ------------------ |
| Interval                    | 5 minutes          |
| Time to fill all 78         | ~390 min (~6.5 hr) |
| Cycles per day              | ~3.7               |
| API calls per day           | ~288               |
| Combined with Indices (~96) | ~384 total MS      |
| Budget (Professional tier)  | 3,333/day          |
| Usage                       | ~11.5%             |

#### Full Fisher-Yates Queue Randomisation

Each cycle rebuilds the queue from scratch. **All 78 commodities are fully shuffled** — no tiers, no priority ordering, no double-word preference. Every commodity has an equal chance of being fetched at any position.

```
┌──────────────────────────────────────────────────────────────────┐
│  ALL 78 COMMODITIES                         ← FISHER-YATES      │
│  Fully shuffled using Fisher-Yates (Durstenfeld) algorithm       │
│  O(n) in-place, Math.random() — fine for non-crypto use          │
│  With 78! permutations (~1.1 × 10^115), order never repeats     │
└──────────────────────────────────────────────────────────────────┘
```

**Why randomise?** Without it, the same commodities always refresh in the same fixed order every 6.5-hour cycle. Commodities near the end of a fixed list would consistently have staler data. Fisher-Yates ensures even distribution over time — any commodity (single-word or double-word) can appear first after a fresh deploy.

```typescript
function fisherYatesShuffle<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = array[i]!;
    array[i] = array[j]!;
    array[j] = temp;
  }
  return array;
}

function buildQueue(): string[] {
  const shuffled = [...allIds];
  fisherYatesShuffle(shuffled);
  return shuffled;
}
```

### Per-Commodity Cache (`commodities.ts`)

```typescript
const perItemCache = new GenericCache<ParsedCommodityData>(
  COMMODITY_CACHE_TTL_SECONDS * 1000, // 2 hours (7200s)
  200, // Max entries (78 commodities + headroom)
);
```

#### Cache Behavior

- **Hit**: Return cached value immediately
- **Miss**: Scheduler will fetch on next tick
- **Stale**: Return stale value, mark for priority refresh
- **TTL**: 2 hours per commodity

---

## Frontend Layer

### useCommoditiesQuotes Hook

Centralized polling hook that fetches all commodity quotes:

```typescript
const { quotes, movementById, status } = useCommoditiesQuotes({
  enabled: true,
});
```

**Returns:**

- `quotes`: Array of all commodity quote objects
- `movementById`: Map of commodity ID → movement data (deltaPct, direction)
- `status`: 'loading' | 'ready' | 'error'

**Polling interval:** 30 minutes (coordinated with FX)

### Movers Grid Container

Orchestrates data flow from hook to presentational component:

```typescript
// src/components/ribbon/commodities-movers-grid.container.tsx

const RE_SORT_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const TOP_N = 4; // Top 4 winners + top 4 losers

const movers = useMemo(() => {
  return sortCommoditiesIntoMovers(quotes, movementById, catalog, TOP_N, conversionRates);
}, [quotes, movementById, conversionRates]);
```

---

## Movers Grid UI

### Layout Structure

The movers grid displays **two side-by-side panels** with **4 windows each**:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           COMMODITIES MOVERS                                │
├──────────────────────────────────┬──────────────────────────────────────────┤
│       🏆 BIGGEST WINNERS         │        📉 BIGGEST LOSERS                 │
│       Largest gains today        │        Largest declines today            │
├────────────────┬─────────────────┼────────────────┬─────────────────────────┤
│   ┌──────────┐ │ ┌─────────────┐ │  ┌──────────┐  │  ┌─────────────┐       │
│   │ 🥛 Milk  │ │ │⚪ Platinum  │ │  │ 🫘 Cocoa │  │  │ ☕ Coffee    │       │
│   │🇺🇸$15.37  │ │ │🇺🇸$958.00/oz│ │  │🇺🇸$4,041  │  │  │🇺🇸$294.00/lb │       │
│   │ ▲ +5.35% │ │ │ ▲ +3.73%   │ │  │ ▼ −6.02% │  │  │ ▼ −2.29%    │       │
│   │ ── ── ── │ │ │ ── ── ──   │ │  │ ── ── ── │  │  │ ── ── ──    │       │
│   │🇪🇺€0.01/L │ │ │🇪🇺€28.31/g  │ │  │🇪🇺€3.71/kg│  │  │🇪🇺€274.21/500g│      │
│   │🇬🇧£0.01/pt│ │ │🇬🇧£23.81/g  │ │  │🇬🇧£3.12/kg│  │  │🇬🇧£119.03/250g│      │
│   └──────────┘ │ └─────────────┘ │  └──────────┘  │  └─────────────┘       │
├────────────────┼─────────────────┼────────────────┼─────────────────────────┤
│   ┌──────────┐ │ ┌─────────────┐ │  ┌──────────┐  │  ┌─────────────┐       │
│   │🥚 Eggs   │ │ │⚪ Palladium │ │  │🥫Aluminium│  │  │ 🌾 Rice     │       │
│   │🇺🇸$638.50 │ │ │🇺🇸$958.00/oz│ │  │🇺🇸$3,111  │  │  │🇺🇸$14.22/cwt │       │
│   │ ▲ +3.55% │ │ │ ▲ +2.77%   │ │  │ ▼ −1.71% │  │  │ ▼ −0.44%    │       │
│   │ ── ── ── │ │ │ ── ── ──   │ │  │ ── ── ── │  │  │ ── ── ──    │       │
│   │🇪🇺€4.89/dz│ │ │🇪🇺€28.31/g  │ │  │🇪🇺€2.63/kg│  │  │🇪🇺€0.21/kg   │       │
│   │🇬🇧£4.11/dz│ │ │🇬🇧£23.81/g  │ │  │🇬🇧£2.21/kg│  │  │🇬🇧£0.18/kg   │       │
│   └──────────┘ │ └─────────────┘ │  └──────────┘  │  └─────────────┘       │
└────────────────┴─────────────────┴────────────────┴─────────────────────────┘

Colour key (conversion lines only):
  🇪🇺 EUR lines → amber (text-amber-400)
  🇬🇧 GBP lines → purple (text-purple-400)
  🇺🇸 USD lines → cyan (text-cyan-400)    ← only shown for non-USD/EUR/GBP base
```

### Window Card Layout (v2.6)

Each commodity card displays in **5-6 rows** with a subtle divider separating the delta from currency-branded conversion lines:

```
Row 1: 🥈 Silver           ← Emoji + Name (horizontal, centered)
Row 2: 🇺🇸 $30.82/oz       ← Flag + Base price with unit (white)
Row 3: ▲ +5.50%            ← Delta with arrow (green/red)
       ── divider ──       ← border-t border-white/5 (subtle hairline)
Row 4: 🇪🇺 €0.91 / g        ← EUR conversion in RETAIL unit (amber text-amber-400)
Row 5: 🇬🇧 £0.77 / g        ← GBP conversion in RETAIL unit (purple text-purple-400)
Row 6: 🇺🇸 $0.99 / g        ← USD conversion (cyan text-cyan-400, non-USD/EUR/GBP only)
```

### Currency-Branded Colours (v2.5)

Conversion lines are colour-coded by currency for instant visual scanability:

| Currency  | Colour       | Tailwind Class    | Rationale                     |
| --------- | ------------ | ----------------- | ----------------------------- |
| **USD**   | Cool blue    | `text-cyan-400`   | Financial terminal aesthetic  |
| **EUR**   | Warm gold    | `text-amber-400`  | Euro banknote gold tones      |
| **GBP**   | Royal purple | `text-purple-400` | Pound sterling regal identity |
| **Other** | Neutral grey | `text-slate-400`  | Fallback for unlisted regions |

The colour is resolved by country code:

```typescript
// src/components/ribbon/commodity-mover-card.tsx
function currencyColorClass(countryCode: string): string {
  switch (countryCode) {
    case 'US':
      return 'text-cyan-400';
    case 'EU':
      return 'text-amber-400';
    case 'GB':
      return 'text-purple-400';
    default:
      return 'text-slate-400';
  }
}
```

### Smart Currency Logic (v2.6)

The card displays **2 or 3 conversion lines** based on the base currency to avoid redundancy:

| Base Currency           | Row 4 (Line 1) | Row 5 (Line 2) | Row 6 (Line 3) |
| ----------------------- | -------------- | -------------- | -------------- |
| **USD** (default)       | 🇪🇺 EUR         | 🇬🇧 GBP         | —              |
| **EUR** (e.g., TTF Gas) | 🇺🇸 USD         | 🇬🇧 GBP         | —              |
| **GBP** (e.g., UK Gas)  | 🇺🇸 USD         | 🇪🇺 EUR         | —              |
| **INR/BRL/CNY/etc.**    | 🇪🇺 EUR         | 🇬🇧 GBP         | 🇺🇸 USD         |

This avoids redundant displays like "🇪🇺 €33.60 → 🇪🇺 €33.60" when base is already EUR.

### Flag Component

All flags use the `<Flag>` component (`src/components/ui/flag.tsx`) which renders:

- **SVG flags** from `/public/flags/` (preferred, cross-platform)
- **Emoji fallback** for missing SVGs

This ensures Windows compatibility (Windows doesn't render flag emojis natively).

### Panel Sizing

Panels use **flex-1 + overflow-hidden** — no fixed aspect-ratio. Height is determined by available space in the parent layout. Row count and font size are decided together in a single content-driven pass — the offscreen measurer renders a real card at each font candidate and the system picks the largest font where content fits with breathing room. If two rows can't accommodate the measured content, the bottom row drops away and the top row gets the full height.

```typescript
// commodities-movers-grid.tsx — layout constants
const HEADER_APPROX_PX = 48; // Panel header height
const PANEL_PADDING_PX = 24; // p-3 = 12px top + 12px bottom
const GRID_GAP_PX = 12; // gap-3
const BREATHING_ROOM_PX = 8; // 4px top + 4px bottom inside each window
```

### Snap-Fit Font Scaling

Content automatically scales to fit available space:

```typescript
// commodities-movers-grid.tsx
const MIN_FONT_PX = 12; // Floor - readable on small screens
const MAX_FONT_PX = 24; // Ceiling - matches exchange-card FitText range
const STEP_PX = 1; // Step increments

// Unified content-driven algorithm (v3.0):
// For each font candidate (24px → 12px, step 1px):
//   1. Set font on offscreen measurer
//   2. Read actual contentWidth + contentHeight
//   3. Width fits? If not → skip to smaller font
//   4. Content + BREATHING_ROOM fits 2-row cell? → use 2 rows ✓
//   5. Content + BREATHING_ROOM fits 1-row cell? → drop bottom row ✓
//   6. Neither → try smaller font
// Fallback: MIN_FONT_PX, single row
```

| Behavior                 | Implementation                                                          |
| ------------------------ | ----------------------------------------------------------------------- |
| **Responsive**           | `flex-1 min-h-0` + ResizeObserver triggers re-measurement               |
| **No overflow**          | `overflow-hidden` on panel; snap-fit scales font; windows clip edges    |
| **Content stays inside** | Measured content height + BREATHING_ROOM_PX must fit cell; font scales  |
| **Auto-hide bottom row** | Unified pass: if content doesn't fit 2-row cell, drops to 1 row         |
| **Content-driven**       | No magic MIN_CARD_HEIGHT_PX — real measured height drives all decisions |

### Component Hierarchy

```
CommoditiesMoversGridContainer (data fetching + conversion rates)
└── CommoditiesMoversGrid (layout + snap-fit + row detection)
├── Winners Panel (panelRef → ResizeObserver)
│   ├── Header ("Biggest Winners")
│   └── 2×2 or 2×1 Grid (auto-detected)
│       ├── Window 1 → CommodityMoverCard
│       ├── Window 2 → CommodityMoverCard
│       ├── Window 3 → CommodityMoverCard  ← hidden if !showBottomRow
│       └── Window 4 → CommodityMoverCard  ← hidden if !showBottomRow
└── Losers Panel
├── Header ("Biggest Losers")
└── 2×2 or 2×1 Grid (mirrors winners)
├── Window 1 → CommodityMoverCard
├── Window 2 → CommodityMoverCard
├── Window 3 → CommodityMoverCard  ← hidden if !showBottomRow
└── Window 4 → CommodityMoverCard  ← hidden if !showBottomRow
---

## Currency Conversion System

### Overview

The conversion system transforms commodity prices from their native currency to EUR, GBP, and USD using live FX rates from the gateway.

### Conversion Paths

```

USD commodities: USD → EUR (direct)
USD → GBP (direct)

EUR commodities: EUR → USD (direct)
EUR → GBP (via USD)

GBP commodities: GBP → USD (direct)
GBP → EUR (via USD)

Other currencies: Native → USD → EUR
(INR, BRL, etc.) Native → USD → GBP
Native → USD (direct)

````

### ConversionRates Interface

```typescript
// src/lib/commodities/convert.ts

export interface ConversionRates {
  eurUsd: number | null; // 1 EUR = X USD
  gbpUsd: number | null; // 1 GBP = X USD
  usdInr: number | null; // 1 USD = X INR
  usdBrl: number | null; // 1 USD = X BRL
  usdCny: number | null; // 1 USD = X CNY
  usdCad: number | null; // 1 USD = X CAD
  usdNok: number | null; // 1 USD = X NOK
  usdMyr: number | null; // 1 USD = X MYR
  usdAud: number | null; // 1 USD = X AUD
  gbpZar: number | null; // 1 GBP = X ZAR (for ZAR commodities)
}
````

### SmartConversionLines Interface (v2.6)

```typescript
// src/lib/commodities/convert.ts

/** Single conversion line with country code and formatted retail price */
export interface ConversionLineData {
  /** ISO country code for Flag component (e.g., "EU", "GB", "US") */
  countryCode: string;
  /** Formatted price with retail unit (e.g., "€2.63 / kg", "£0.77 / g", "$0.01 / kWh") */
  priceText: string;
}

export interface SmartConversionLines {
  /** First conversion line */
  line1: ConversionLineData;
  /** Second conversion line */
  line2: ConversionLineData;
  /** Third conversion line - only for non-USD/EUR/GBP base */
  line3: ConversionLineData | null;
}
```

### Currency → Country Code Mapping

Used to display the appropriate flag next to prices:

```typescript
// src/lib/commodities/convert.ts

const CURRENCY_TO_COUNTRY_CODE: Record<string, string> = {
  USD: 'US',
  EUR: 'EU', // European Union flag
  GBP: 'GB',
  INR: 'IN',
  CNY: 'CN',
  BRL: 'BR',
  ZAR: 'ZA',
  CAD: 'CA',
  AUD: 'AU',
  NOK: 'NO',
  MYR: 'MY',
  JPY: 'JP',
  CHF: 'CH',
  NZD: 'NZ',
  SGD: 'SG',
  HKD: 'HK',
  SEK: 'SE',
  DKK: 'DK',
  PLN: 'PL',
  THB: 'TH',
  IDR: 'ID',
  MXN: 'MX',
  KRW: 'KR',
  TRY: 'TR',
  RUB: 'RU',
  PHP: 'PH',
  CZK: 'CZ',
  ILS: 'IL',
  CLP: 'CL',
  COP: 'CO',
  TWD: 'TW',
  ARS: 'AR',
  SAR: 'SA',
  AED: 'AE',
  EGP: 'EG',
  VND: 'VN',
  PKR: 'PK',
  NGN: 'NG',
  BDT: 'BD',
  UAH: 'UA',
  KES: 'KE',
  GHS: 'GH',
  MAD: 'MA',
  QAR: 'QA',
  KWD: 'KW',
  OMR: 'OM',
  BHD: 'BH',
  JOD: 'JO',
  LKR: 'LK',
  MMK: 'MM',
  PEN: 'PE',
};
```

### CommodityMoverData Interface (v2.6)

```typescript
// src/types/commodities-movers.ts

export interface CommodityMoverData {
  id: string;
  name: string;
  shortName: string;
  emoji: string;
  priceText: string;
  deltaPct: number;
  direction: MoverDirection;
  brandColor: string;
  tooltipTitle?: string;
  tooltipLines?: RichTooltipLine[];

  // Currency conversion fields (v2.6)
  priceEur: number | null;
  priceGbp: number | null;
  priceUsd: number | null;
  quoteCurrency: string;

  /** First conversion line: { countryCode, priceText } — priceText now includes retail unit */
  conversionLine1: { countryCode: string; priceText: string };
  /** Second conversion line: { countryCode, priceText } — priceText now includes retail unit */
  conversionLine2: { countryCode: string; priceText: string };
  /** Third conversion line - only for non-USD/EUR/GBP commodities */
  conversionLine3: { countryCode: string; priceText: string } | null;
  /** ISO country code for base currency flag (e.g., "US", "EU", "GB", "IN") */
  baseFlagCode: string | null;

  /** @deprecated Use conversionLine1/conversionLine2 instead */
  eurGbpText: string;
}
```

---

## Retail Unit System

### Overview (v2.6)

Conversion lines display prices in **consumer-friendly retail units** instead of industrial trading units. A person looking at Aluminum doesn't think in tonnes — they think in kilograms. The retail unit system converts API prices into quantities people actually buy.

```
BEFORE (v2.4):  🇪🇺 €2,632.80        ← industrial tonne price, meaningless to consumers
AFTER  (v2.6):  🇪🇺 €2.63 / kg       ← what you'd actually pay per kilo
```

### How It Works

```
retail_price = converted_currency_price × retail_factor

Example: Aluminum at $3,111.65/t
  Convert to EUR: $3,111.65 ÷ 1.09 = €2,854.82
  Apply UK retail factor: €2,854.82 × 0.001 (tonne → kg) = €2.85
  Format: "€2.85 / kg"
```

The factor is region-specific — each conversion line's `countryCode` determines which region lookup to use:

| Country Code | Region | Lookup Key                            |
| ------------ | ------ | ------------------------------------- |
| `US`         | US     | `retail.us` (Imperial: lb, gal, 12oz) |
| `GB`         | UK     | `retail.uk` (Mixed: kg, pint, 250g)   |
| `EU`         | EU     | `retail.eu` (Metric: kg, litre, 500g) |

### RetailUnitConfig Interface

```typescript
// src/lib/commodities/retail-units.ts

export interface RetailUnitConfig {
  /** Display label shown after price (e.g., "kg", "250g", "gal") */
  unit: string;
  /** Multiplier: retail_price = converted_price × factor */
  factor: number;
}

export interface CommodityRetailUnit {
  us: RetailUnitConfig;
  uk: RetailUnitConfig;
  eu: RetailUnitConfig;
}
```

### Retail Unit Categories

#### Precious Metals → per gram (global)

All precious metals use gram globally — the universal retail unit:

| Commodity | API Unit | Retail Unit | Factor    |
| --------- | -------- | ----------- | --------- |
| Gold      | troy oz  | g           | 1/31.1035 |
| Silver    | troy oz  | g           | 1/31.1035 |
| Platinum  | troy oz  | g           | 1/31.1035 |
| Palladium | troy oz  | g           | 1/31.1035 |
| Rhodium   | troy oz  | g           | 1/31.1035 |

#### Energy → per kWh (piped gas/power), per gallon/litre (liquid fuels)

| Commodity   | API Unit | US Unit | UK/EU Unit | Rationale                     |
| ----------- | -------- | ------- | ---------- | ----------------------------- |
| Natural Gas | MMBtu    | kWh     | kWh        | Piped gas billed in kWh       |
| TTF Gas     | MWh      | kWh     | kWh        | Piped gas billed in kWh       |
| UK Gas      | therm    | kWh     | kWh        | Piped gas billed in kWh       |
| Electricity | MWh      | kWh     | kWh        | Energy bills use kWh          |
| Gasoline    | gallon   | gal     | L          | Liquid fuel at the pump       |
| Heating Oil | gallon   | gal     | L          | Liquid fuel for home delivery |
| Brent/WTI   | barrel   | gal     | L          | Liquid petroleum products     |

> **Design decision:** Piped natural gas stays as kWh (not litres) because that's what appears on energy bills. Litres only apply to liquid fuels.

#### Agriculture — Softs (region-specific retail packaging)

| Commodity | API Unit | US Unit  | UK Unit | EU Unit |
| --------- | -------- | -------- | ------- | ------- |
| Coffee    | lb       | 12oz bag | 250g    | 500g    |
| Sugar     | lb       | 4lb bag  | kg      | kg      |
| Cocoa     | tonne    | lb       | kg      | kg      |
| Eggs (US) | dozen    | dozen    | 6 eggs  | 10 eggs |

#### Base/Industrial Metals → per kg (UK/EU), per lb (US)

All tonne-based metals use the same simple conversion:

- US: `factor = 1/2204.62` (tonne → lb)
- UK/EU: `factor = 1/1000` (tonne → kg)

Applies to: Aluminum, Copper, Zinc, Nickel, Lead, Tin, Steel, Iron Ore, Cobalt, Manganese, Molybdenum, Tungsten, Vanadium, Lithium, etc.

### Excluded Commodities (No Retail Unit)

Live animal futures are intentionally **excluded** — the retail unit concept doesn't apply because consumers don't buy live cattle per kg:

| Excluded        | Reason                                 | Fallback Display         |
| --------------- | -------------------------------------- | ------------------------ |
| `live_cattle`   | Live animal future, not retail product | Raw converted price only |
| `lean_hogs`     | Live animal future, not retail product | Raw converted price only |
| `feeder_cattle` | Live animal future, not retail product | Raw converted price only |

When `getRetailConfigForRegion()` returns `null`, `formatRetailPrice()` falls through to the raw converted price with no unit suffix (e.g., `€686.08` instead of `€686.08 / kg`).

### Data Flow

```
API Price (industrial unit, native currency)
   │
   ▼
convertCommodityPrice()          → EUR / GBP / USD at industrial scale
   │
   ▼
buildRetailConversionLines()     → applies retail factors per region
   ├── getRetailConfigForRegion(id, "EU") → { unit: "kg", factor: 0.001 }
   ├── getRetailConfigForRegion(id, "GB") → { unit: "kg", factor: 0.001 }
   └── getRetailConfigForRegion(id, "US") → { unit: "lb", factor: 0.000454 }
   │
   ▼
formatRetailPrice(eurPrice, "EU", id)
   → eurPrice × factor → toLocaleString(2dp) → "€2.63 / kg"
```

### Conversion Constants Reference

```typescript
// Key conversion constants used in retail-units.ts
1 tonne        = 1,000 kg = 2,204.62 lbs
1 troy oz      = 31.1035 g
1 US barrel    = 158.987 L = 42 US gal
1 US gallon    = 3.78541 L
1 UK pint      = 0.56826 L
1 US cwt       = 100 lbs = 45.3592 kg
1 bushel wheat = 60 lbs = 27.216 kg
1 bushel corn  = 56 lbs = 25.4012 kg
1 bushel oats  = 32 lbs = 14.515 kg
1 MMBtu        = 293.07 kWh
1 MWh          = 1,000 kWh
1 therm        = 29.3071 kWh
```

### Known Issue — Coffee Price Display

Coffee futures on ICE are quoted in **cents per pound**. The Marketstack API returns `294.00` which is 294 cents/lb = $2.94/lb. The movers grid currently displays this as `$294.00/lb` because the raw value isn't divided by 100. This is an **upstream data interpretation issue** — the retail unit factors themselves are correct. At the true $2.94/lb, the retail lines would show approximately `€2.74 / 500g` (EU) and `£1.19 / 250g` (UK).

---

## Price Formatting

### Strict 2 Decimal Places (v2.6)

All commodity prices across the entire system use **exactly 2 decimal places**. No exceptions for small or large values.

**Before (v2.4):**

```
$3.254      ← 3dp for values 1-10
$0.0475     ← 4dp for values < 1
£48.90      ← 2dp for values ≥ 10
€2,632.80   ← 2dp for values ≥ 1000
```

**After (v2.6):**

```
$3.25       ← always 2dp
$0.05       ← always 2dp
£48.90      ← always 2dp
€2,632.80   ← always 2dp
```

### Files Affected

| File                                                     | Function(s) Modified                                                   |
| -------------------------------------------------------- | ---------------------------------------------------------------------- |
| `src/lib/commodities/convert.ts`                         | `formatUsdPrice`, `formatEurPrice`, `formatGbpPrice`, `formatZarPrice` |
| `src/lib/commodities/sort-movers.ts`                     | `formatCommodityPrice`, `formatRetailPrice` (new)                      |
| `src/components/ribbon/commodities-ribbon.container.tsx` | `formatCommodityPrice`                                                 |

### Implementation

All formatters now use the same pattern — removed all conditional branches for small values:

```typescript
value.toLocaleString('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
// Was: maximumFractionDigits: 3 for <10, 4 for <1
// Now: always 2
```

---

## API Endpoints

### `/api/commodities/config`

Returns SSOT configuration for gateway:

```typescript
GET /api/commodities/config

Response:
{
  version: 2,
  ids: string[],        // All 78 active commodity IDs
  catalog: Commodity[], // Full catalog entries
  defaults: string[],   // Default selected IDs
}
```

### `/api/commodities`

Proxies to gateway, returns quotes:

```typescript
GET /api/commodities

Response:
{
  ok: true,
  data: CommodityQuote[],
  meta: {
    fetchedAt: string,
    source: 'gateway',
  }
}
```

---

## Rate Limits & Budget

### Marketstack Limits

| Limit Type       | Value       | Notes                                                     |
| ---------------- | ----------- | --------------------------------------------------------- |
| **Per-minute**   | 60 calls    | Marketstack Professional tier (shared across all feeds)   |
| **Daily total**  | 3,333 calls | Shared across all Marketstack feeds (Indices+Commodities) |
| **Self-imposed** | 1 call/5min | Scheduler cadence — well within platform limits           |

### Budget Allocation

| Feed                  | Estimated Daily Calls | % of 3,333 Budget           |
| --------------------- | --------------------- | --------------------------- |
| Commodities           | ~288                  | 8.6%                        |
| Indices               | ~96                   | 2.9%                        |
| **Total Marketstack** | ~384                  | **11.5%**                   |
| **Headroom**          | ~2,949                | 88.5% (future FX migration) |

> **Note:** The commodities budget manager enforces a separate 1,000/day cap to prevent runaway usage from starving indices, even though the shared pool is 3,333/day.

---

## SSOT Flow

```
┌──────────────────────────────────────────────────────────────────┐
│ FRONTEND (Source of Truth)                                        │
│                                                                    │
│  commodities.catalog.json ─────────┐                              │
│  (78 commodities, Zod-validated)   │                              │
│                                    ▼                              │
│  /api/commodities/config ──────────────────────────────────────┐  │
│  Returns: { version, ids, catalog, defaults }                  │  │
└────────────────────────────────────────────────────────────────┼──┘
                                                                 │
                                                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│ GATEWAY (Consumer)                                                │
│                                                                    │
│  init() ──► fetch(COMMODITIES_CONFIG_URL) ──► Parse catalog      │
│         │                                                         │
│         ├──► On success: ssotSource = 'frontend'                 │
│         │                                                         │
│         └──► On failure: loadSsotSnapshot() ──► 'snapshot-fallback'│
│                                                                    │
│  Scheduler uses catalog IDs to cycle through all 78 commodities   │
└──────────────────────────────────────────────────────────────────┘
```

### SSOT Refresh

The gateway refreshes SSOT from frontend periodically and after each successful cycle:

```typescript
// After saving snapshot
await saveSsotSnapshot(FEED_ID, {
  catalog,
  defaults,
  provenance: {
    ssotVersion,
    ssotHash,
    ssotFingerprint,
    snapshotAt: new Date().toISOString(),
  },
});
```

---

## Tier Differences

### Free Tier

| Feature     | Behavior                                                   |
| ----------- | ---------------------------------------------------------- |
| Movers Grid | Shows top 4 winners + top 4 losers from ALL 78 commodities |
| Data Source | Gateway fetches all active commodities                     |
| Selection   | Not customizable                                           |
| Refresh     | Re-sorts every 10 minutes from cached data                 |

### Pro Tier (Paid)

| Feature        | Behavior                                                              |
| -------------- | --------------------------------------------------------------------- |
| Ribbon Display | Shows 7 selected commodities (2-3-2 split: energy/agriculture/metals) |
| Selection      | User can customize which 7 commodities appear                         |
| Validation     | Enforces 2 energy + 3 agriculture + 2 metals rule                     |
| API            | Uses `?ids=` parameter for specific queries                           |

### Selection Validation (Pro)

```typescript
const COMMODITIES_SELECTION_LIMITS = {
  REQUIRED_COUNT: 7,
  ENERGY_COUNT: 2,
  AGRICULTURE_COUNT: 3,
  METALS_COUNT: 2,
};

function validateCommoditiesSelection(commodityIds, tier, catalogMap) {
  // 1. Must be paid tier
  // 2. Must be exactly 7 commodities
  // 3. Must match 2-3-2 group distribution
  // 4. All IDs must exist in catalog
}
```

---

## File Reference

### Gateway Files (Fly.io)

| File                                       | Purpose                                                               |
| ------------------------------------------ | --------------------------------------------------------------------- |
| `src/marketstack/commodities.ts`           | FeedHandler implementation                                            |
| `src/marketstack/commodities-scheduler.ts` | Rolling 5-min scheduler with full Fisher-Yates randomisation (all 78) |
| `src/marketstack/commodities-adapter.ts`   | Marketstack v2 API adapter                                            |
| `src/marketstack/commodities-budget.ts`    | Separate budget tracker                                               |
| `src/server.ts`                            | Feed initialization and startup                                       |

### Frontend Files (Vercel)

| File                                                          | Purpose                                              |
| ------------------------------------------------------------- | ---------------------------------------------------- |
| `src/data/commodities/commodities.catalog.json`               | SSOT catalog (78 commodities)                        |
| `src/data/commodities/commodities.schema.ts`                  | Zod validation schema                                |
| `src/data/commodities/index.ts`                               | Catalog helpers and routing                          |
| `src/lib/commodities/catalog.ts`                              | Typed helper layer                                   |
| `src/lib/commodities/convert.ts`                              | Currency conversion + smart lines (v2.6, strict 2dp) |
| `src/lib/commodities/sort-movers.ts`                          | Winner/loser sorting + retail line builder (v2.6)    |
| `src/lib/commodities/retail-units.ts`                         | **NEW** Retail unit mapping (78 × 3 regions)         |
| `src/hooks/use-commodities-quotes.ts`                         | Centralized polling hook                             |
| `src/components/ribbon/commodities-movers-grid.tsx`           | Presentational grid (snap-fit + windows)             |
| `src/components/ribbon/commodities-movers-grid.container.tsx` | Data container (sorting logic)                       |
| `src/components/ribbon/commodity-mover-card.tsx`              | Individual card (v2.5, branded colours + divider)    |
| `src/components/ribbon/commodities-ribbon.container.tsx`      | Ribbon container (2dp formatting)                    |
| `src/components/ui/flag.tsx`                                  | Flag component (SVG + emoji fallback)                |
| `src/app/api/commodities/config/route.ts`                     | SSOT config endpoint                                 |
| `src/app/api/commodities/route.ts`                            | Gateway proxy                                        |
| `src/types/commodities-movers.ts`                             | TypeScript interfaces (v2.6)                         |
| `src/types/commodities-ribbon.ts`                             | Quote types                                          |

---

## Customization Guide

### Font Size (Snap-Fit Range)

**File:** `src/components/ribbon/commodities-movers-grid.tsx`

| Line | Constant      | Default | Description                       |
| ---- | ------------- | ------- | --------------------------------- |
| 60   | `MIN_FONT_PX` | `12`    | Minimum font size (small screens) |
| 61   | `MAX_FONT_PX` | `24`    | Maximum font size (large screens) |
| 62   | `STEP_PX`     | `1`     | Step down increment               |

### Element Sizes (relative to base font)

**File:** `src/components/ribbon/commodity-mover-card.tsx`

| Element          | Default | Description                    |
| ---------------- | ------- | ------------------------------ |
| Emoji            | `1.5em` | Emoji size relative to base    |
| Name             | `1em`   | Commodity name text            |
| Base Price       | `0.9em` | Price text with flag           |
| Delta            | `0.9em` | Percentage change text         |
| Arrow            | `1.2em` | Up/down arrow icon             |
| Conversion Lines | `0.7em` | EUR/GBP/USD conversion text    |
| Base Flag        | `14px`  | Flag size for base currency    |
| Conversion Flags | `12px`  | Flag size for conversion lines |

### Gaps Between Items (horizontal)

**File:** `src/components/ribbon/commodity-mover-card.tsx`

| Gap            | Default   | Description                        |
| -------------- | --------- | ---------------------------------- |
| Emoji-to-name  | `gap-2`   | Space between emoji and name       |
| Arrow-to-delta | `gap-1.5` | Space between arrow and percentage |
| Flag-to-price  | `gap-1.5` | Space between flag and price       |
| Flag-to-conv   | `gap-1`   | Space between flag and conversion  |

### Gaps Between Rows (vertical)

**File:** `src/components/ribbon/commodity-mover-card.tsx`

| Gap             | Default       | Description                  |
| --------------- | ------------- | ---------------------------- |
| Card padding    | `p-4`         | Padding around all content   |
| Above price     | `mt-2`        | Space above base price row   |
| Above delta     | `mt-2`        | Space above delta row        |
| Above conv      | `mt-2`        | Space above conversion block |
| Conv line space | `space-y-0.5` | Space between conv lines     |

### Tailwind Gap Reference

| Class                | Pixels |
| -------------------- | ------ |
| `gap-0.5` / `mt-0.5` | 2px    |
| `gap-1` / `mt-1`     | 4px    |
| `gap-1.5` / `mt-1.5` | 6px    |
| `gap-2` / `mt-2`     | 8px    |
| `gap-3` / `mt-3`     | 12px   |
| `gap-4` / `mt-4`     | 16px   |
| `gap-5` / `mt-5`     | 20px   |

### Panel Row Detection

**File:** `src/components/ribbon/commodities-movers-grid.tsx`

| Line | Constant            | Default | Description                                            |
| ---- | ------------------- | ------- | ------------------------------------------------------ |
| 48   | `HEADER_APPROX_PX`  | `48`    | Panel header height used in available-space calc       |
| 51   | `PANEL_PADDING_PX`  | `24`    | p-3 top + bottom padding                               |
| 54   | `GRID_GAP_PX`       | `12`    | gap-3 between grid rows                                |
| 57   | `BREATHING_ROOM_PX` | `8`     | 4px top + 4px bottom breathing room inside each window |

---

## Diagnostics

### Gateway `/trace` Output (Commodities Section)

```json
{
  "commodities": {
    "feedId": "commodities",
    "ssotSource": "frontend",
    "ssotVersion": 2,
    "catalogCount": 78,
    "defaultCount": 78,
    "cachedCommodities": 45,
    "staleCommodities": 10,
    "uncachedCommodities": 23,
    "budget": {
      "dailyUsed": 234,
      "dailyLimit": 1000,
      "minuteUsed": 0,
      "minuteLimit": 1,
      "state": "ok"
    },
    "circuit": {
      "state": "closed",
      "failures": 0
    },
    "scheduler": {
      "running": true,
      "intervalMs": 300000,
      "queueLength": 78,
      "queuePosition": 45,
      "cycleCount": 3,
      "currentCommodity": "coffee",
      "lastFetchAt": "2026-02-07T14:30:00Z",
      "nextFetchAt": "2026-02-07T14:35:00Z",
      "queueFirstTen": [
        "barley",
        "crude_oil",
        "platinum",
        "coffee",
        "iron_ore",
        "sugar",
        "gold",
        "wheat",
        "ttf_gas",
        "copper"
      ],
      "randomised": true
    }
  }
}
```

> **Note on `minuteLimit: 1`**: This is the budget manager's self-imposed safety guardrail, not the Marketstack platform limit (which is 60/min on Professional tier). The scheduler's 5-minute interval means this guardrail is never hit in practice.

### Frontend Debug Snapshot

```typescript
import { getCommoditiesQuotesDebugSnapshot } from '@/hooks/use-commodities-quotes';

const debug = getCommoditiesQuotesDebugSnapshot();
// {
//   at: "2026-02-03T14:35:00Z",
//   status: "ready",
//   quoteCount: 78,
//   enabledCount: 1,
//   effectiveIntervalMs: 1800000,
//   msUntilNextSlot: 542000,
//   visibilityState: "visible",
//   initialFetchDone: true
// }
```

---

## Changelog

| Date       | Change                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-02-05 | **v2.4**: Flag component for ALL flag displays (base + conversions)                                                                                                                                                                                                                                                                                                                                                                  |
| 2026-02-05 | **v2.4**: ConversionLineData interface with countryCode + priceText structure                                                                                                                                                                                                                                                                                                                                                        |
| 2026-02-05 | **v2.4**: Windows compatibility via SVG flags instead of emoji text                                                                                                                                                                                                                                                                                                                                                                  |
| 2026-02-05 | **v2.3**: Flag emoji on base price + 3-line conversion for non-major currencies                                                                                                                                                                                                                                                                                                                                                      |
| 2026-02-05 | **v2.3**: Currency → country code mapping (48 currencies)                                                                                                                                                                                                                                                                                                                                                                            |
| 2026-02-05 | **v2.2**: Smart conversion lines avoiding redundant EUR→EUR or GBP→GBP displays                                                                                                                                                                                                                                                                                                                                                      |
| 2026-02-05 | **v2.2**: Stacked vertical conversion layout below percentage change                                                                                                                                                                                                                                                                                                                                                                 |
| 2026-02-04 | **Movers grid redesign**: Two side-by-side panels with 4 windows each                                                                                                                                                                                                                                                                                                                                                                |
| 2026-02-04 | **Snap-fit fix**: Measurer no longer uses overflow-hidden (proper overflow detection)                                                                                                                                                                                                                                                                                                                                                |
| 2026-02-04 | **Card layout**: Emoji + name now side by side (3-row layout → 5-6 row layout)                                                                                                                                                                                                                                                                                                                                                       |
| 2026-02-04 | **Added customization guide**: Line numbers for font, gaps, spacing adjustments                                                                                                                                                                                                                                                                                                                                                      |
| 2026-02-03 | Added cold-start burst mode (1-min → 2-min transition)                                                                                                                                                                                                                                                                                                                                                                               |
| 2026-02-03 | Removed `commodities.selected.json` dependency                                                                                                                                                                                                                                                                                                                                                                                       |
| 2026-02-03 | Frontend config now returns ALL 78 active commodities                                                                                                                                                                                                                                                                                                                                                                                |
| 2026-02-03 | Added movers grid placeholder handling for cold-start gaps                                                                                                                                                                                                                                                                                                                                                                           |
| 2026-02-02 | Migrated from fallback provider to Marketstack v2                                                                                                                                                                                                                                                                                                                                                                                    |
| 2026-01-15 | Initial commodities feed implementation                                                                                                                                                                                                                                                                                                                                                                                              |
| 2026-02-06 | **Removed aspect-ratio**: Panels now use flex-1 + overflow-hidden, height from parent                                                                                                                                                                                                                                                                                                                                                |
| 2026-02-06 | **Auto-hide bottom row**: ResizeObserver detects if 2 rows fit; if not → 2×1 layout                                                                                                                                                                                                                                                                                                                                                  |
| 2026-02-06 | **Shrinkable finance ribbon**: Documented wrapper spec (not implemented — superseded by v3.0 content-driven detection)                                                                                                                                                                                                                                                                                                               |
| 2026-02-06 | **Font range updated**: MIN_FONT_PX=12, MAX_FONT_PX=24 (was 18/32)                                                                                                                                                                                                                                                                                                                                                                   |
| 2026-02-07 | **Content-driven row detection (v3.0)**: Removed `MIN_CARD_HEIGHT_PX` magic number. Unified reflow pass measures actual content height from offscreen measurer and decides font + row count together. `BREATHING_ROOM_PX = 8` ensures nothing sits flush against window edges. Bottom row drops when content can't fit two rows — exactly like Engine Bay provider icons.                                                            |
| 2026-02-07 | **Gateway scheduler audit**: Interval 1-min/2-min → **5-min fixed** (no cold-start burst). Rate limit corrected from "1/min hard limit" to **60/min Professional tier**. Cold start corrected from 78/156 min to **~390 min (~6.5 hours)**. Budget allocation updated: ~288 calls/day (8.6%), not ~720 (21.6%).                                                                                                                      |
| 2026-02-08 | **Full queue randomisation**: Removed 3-tier ordering (double-word → priority → shuffled remainder). ALL 78 commodities now fully shuffled via Fisher-Yates each cycle — no tiers, no priority, no double-word preference. Removed `DOUBLE_WORD_COMMODITY_IDS` constant (22 items), `priorityIds` state, and `doubleWordIds`/`priorityIds` from /trace output. Every commodity has equal chance of being fetched first after deploy. |
| 2026-02-08 | **v2.5**: Currency-branded conversion line colours — USD cyan (`text-cyan-400`), EUR amber (`text-amber-400`), GBP purple (`text-purple-400`). Added `currencyColorClass()` helper in `commodity-mover-card.tsx`. Subtle `border-t border-white/5` divider between delta row and conversion lines.                                                                                                                                   |
| 2026-02-08 | **v2.6**: Retail unit system — new `retail-units.ts` maps all 78 commodities × 3 regions (US/UK/EU) with consumer-friendly units (kg, g, lb, gal, litre, kWh, 250g, 500g, 12oz, dozen, etc.). Conversion lines now show e.g. `€2.63 / kg` instead of `€2,632.80`. Added `formatRetailPrice()` and `buildRetailConversionLines()` to `sort-movers.ts`.                                                                                |
| 2026-02-08 | **v2.6**: Strict 2dp pricing — removed all conditional 3dp/4dp branches from `formatUsdPrice`, `formatEurPrice`, `formatGbpPrice`, `formatZarPrice`, `formatCommodityPrice`. All commodity prices now display exactly 2 decimal places globally.                                                                                                                                                                                     |
| 2026-02-08 | **v2.6**: Livestock exclusion — removed `live_cattle`, `lean_hogs`, `feeder_cattle` from retail units map. Live animal futures fall back to raw converted prices (no unit suffix).                                                                                                                                                                                                                                                   |
