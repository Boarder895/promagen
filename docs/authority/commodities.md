# Commodities System Architecture

> **Authority Document** — Promagen Commodities Feed  
> **Last Updated**: 2026-02-05  
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
8. [API Endpoints](#api-endpoints)
9. [Rate Limits & Budget](#rate-limits--budget)
10. [SSOT Flow](#ssot-flow)
11. [Tier Differences](#tier-differences)
12. [File Reference](#file-reference)
13. [Customization Guide](#customization-guide)

---

## Overview

The Commodities system provides real-time pricing data for **78 commodities** across three groups:

- **Energy** (crude oil, natural gas, coal, etc.)
- **Agriculture** (grains, softs, livestock)
- **Metals** (precious, base, battery metals)

### Key Differentiators from Other Feeds

| Aspect            | Indices/FX/Crypto       | Commodities                       |
| ----------------- | ----------------------- | --------------------------------- |
| **Batch Support** | Yes (multiple per call) | No (1 commodity per call)         |
| **Scheduler**     | Clock-aligned slots     | Rolling timer                     |
| **Cache**         | Per-request             | Per-commodity (2h TTL)            |
| **Rate Limit**    | 5/min (Marketstack)     | 1/min (hard endpoint limit)       |
| **Cold Start**    | Instant                 | 78 min (burst) / 156 min (normal) |

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
│  │  │  init   │  │ Cache (2h)   │  │ • Cold-start: 1-min ticks   │ │   │
│  │  │         │  │              │  │ • Normal: 2-min ticks       │ │   │
│  │  └────┬────┘  └──────┬───────┘  │ • Priority queue for        │ │   │
│  │       │              │          │   defaults                   │ │   │
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
│  Rate Limit: 1 call/minute (hard endpoint limit)                         │
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

Unlike other feeds that use clock-aligned batch fetches, commodities use a **rolling scheduler** due to the 1-call/minute API constraint.

#### Cold-Start Burst Mode

```typescript
// Cold-start: 1-minute intervals (at API rate limit)
const COLD_START_INTERVAL_MS = 60_000; // 1 minute

// Normal operation: 2-minute intervals (comfortable margin)
const DEFAULT_INTERVAL_MS = 120_000; // 2 minutes

// Transition: After first cycle completes (cycleCount > 1)
// coldStartMode switches from true → false
```

**Timing Math:**

| Mode                     | Interval  | Time to Fill 78 Commodities |
| ------------------------ | --------- | --------------------------- |
| Cold-start (first cycle) | 1 minute  | ~78 minutes (~1.3 hours)    |
| Normal (subsequent)      | 2 minutes | ~156 minutes (~2.6 hours)   |

#### Priority Queue

Each cycle, commodities are fetched in priority order:

1. **Default/selected commodities first** (ensures frequently-viewed items are freshest)
2. **Remaining commodities** in catalog order

```typescript
function buildQueue(): string[] {
  const prioritySet = new Set(priorityIds);
  const remaining = allIds.filter((id) => !prioritySet.has(id));
  return [...priorityIds, ...remaining]; // Defaults first
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

**Polling interval:** 30 minutes (coordinated with FX and Crypto)

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
┌─────────────────────────────────────────────────────────────────────────┐
│                          COMMODITIES MOVERS                              │
├─────────────────────────────────┬───────────────────────────────────────┤
│       BIGGEST WINNERS           │        BIGGEST LOSERS                 │
│       Largest gains today       │        Largest declines today         │
├────────────────┬────────────────┼────────────────┬──────────────────────┤
│   ┌──────────┐ │ ┌──────────┐   │  ┌──────────┐  │  ┌──────────┐       │
│   │ 🥛 Milk  │ │ │⚪Platinum│   │  │ 🫘 Cocoa │  │  │ ☕ Coffee │       │
│   │🇺🇸$15.37  │ │ │🇺🇸$2,258  │   │  │🇺🇸$4,041  │  │  │🇺🇸$309.05 │       │
│   │ ▲ +5.35% │ │ │ ▲ +3.73% │   │  │ ▼ −6.02% │  │  │ ▼ −2.29% │       │
│   │🇪🇺 €14.12 │ │ │🇪🇺 €2,075 │   │  │🇪🇺 €3,714 │  │  │🇪🇺 €284.05│       │
│   │🇬🇧 £11.88 │ │ │🇬🇧 £1,745 │   │  │🇬🇧 £3,124 │  │  │🇬🇧 £238.89│       │
│   └──────────┘ │ └──────────┘   │  └──────────┘  │  └──────────┘       │
├────────────────┼────────────────┼────────────────┼──────────────────────┤
│   ┌──────────┐ │ ┌──────────┐   │  ┌──────────┐  │  ┌──────────┐       │
│   │ 🥚 Eggs  │ │ │⚪Palladium│   │  │🥫Aluminium│  │  │ �ite Coal │       │
│   │🇺🇸$638.50 │ │ │🇺🇸$1,778  │   │  │🇺🇸$3,053  │  │  │🇺🇸$116.00 │       │
│   │ ▲ +3.55% │ │ │ ▲ +2.77% │   │  │ ▼ −1.71% │  │  │ ▼ −1.28% │       │
│   │🇪🇺 €586.82│ │ │🇪🇺 €1,633 │   │  │🇪🇺 €2,805 │  │  │🇪🇺 €106.62│       │
│   │🇬🇧 £493.62│ │ │🇬🇧 £1,374 │   │  │🇬🇧 £2,360 │  │  │🇬🇧 £89.68 │       │
│   └──────────┘ │ └──────────┘   │  └──────────┘  │  └──────────┘       │
└────────────────┴────────────────┴────────────────┴──────────────────────┘
```

### Window Card Layout (v2.4)

Each commodity card displays in **5-6 rows** with flags for all currency displays:

```
Row 1: 🥈 Silver           ← Emoji + Name (horizontal, centered)
Row 2: 🇺🇸 $89.77/oz       ← Flag + Base price with unit
Row 3: ▲ +5.50%            ← Delta with arrow (colored green/red)
Row 4: 🇪🇺 €82.43           ← First conversion (Flag component)
Row 5: 🇬🇧 £69.33           ← Second conversion (Flag component)
Row 6: 🇺🇸 $89.77           ← Third conversion (only for non-USD/EUR/GBP)
```

### Smart Currency Logic (v2.4)

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

Panels use **aspect-ratio** for responsive sizing:

```typescript
// commodities-movers-grid.tsx
const PANEL_ASPECT_RATIO = 1.3; // Width is 1.3× height

const panelStyle: React.CSSProperties = {
  aspectRatio: `${PANEL_ASPECT_RATIO}`,
  minHeight: 'fit-content', // Can grow if content needs it
};
```

### Snap-Fit Font Scaling

Content automatically scales to fit available space:

```typescript
// commodities-movers-grid.tsx
const MIN_FONT_PX = 18; // Floor - readable on small screens
const MAX_FONT_PX = 32; // Ceiling - big on large screens
const STEP_PX = 1; // Step increments

// Algorithm:
// 1. Measure cell dimensions from 2×2 grid
// 2. Try largest font (32px), step down by 1px
// 3. First font where content fits → use it
// 4. Windows have overflow-hidden as safety net
```

### Key Behaviors

| Behavior                 | Implementation                                                 |
| ------------------------ | -------------------------------------------------------------- |
| **Responsive**           | `aspect-ratio` + ResizeObserver triggers re-measurement        |
| **No overflow**          | Snap-fit scales font down; windows clip any edge cases         |
| **Content stays inside** | Cards use `whitespace-nowrap`; font scales instead of wrapping |
| **Grows with content**   | `minHeight: fit-content` allows panels to expand if needed     |

### Component Hierarchy

```
CommoditiesMoversGridContainer (data fetching + conversion rates)
└── CommoditiesMoversGrid (layout + snap-fit)
    ├── Winners Panel
    │   ├── Header ("Biggest Winners")
    │   └── 2×2 Grid
    │       ├── Window 1 → CommodityMoverCard
    │       ├── Window 2 → CommodityMoverCard
    │       ├── Window 3 → CommodityMoverCard
    │       └── Window 4 → CommodityMoverCard
    └── Losers Panel
        ├── Header ("Biggest Losers")
        └── 2×2 Grid
            ├── Window 1 → CommodityMoverCard
            ├── Window 2 → CommodityMoverCard
            ├── Window 3 → CommodityMoverCard
            └── Window 4 → CommodityMoverCard
```

---

## Currency Conversion System

### Overview

The conversion system transforms commodity prices from their native currency to EUR, GBP, and USD using live FX rates from the gateway.

### Conversion Paths

```
USD commodities:  USD → EUR (direct)
                  USD → GBP (direct)

EUR commodities:  EUR → USD (direct)
                  EUR → GBP (via USD)

GBP commodities:  GBP → USD (direct)
                  GBP → EUR (via USD)

Other currencies: Native → USD → EUR
(INR, BRL, etc.)  Native → USD → GBP
                  Native → USD (direct)
```

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
```

### SmartConversionLines Interface (v2.4)

```typescript
// src/lib/commodities/convert.ts

/** Single conversion line with country code and formatted price */
export interface ConversionLineData {
  /** ISO country code for Flag component (e.g., "EU", "GB", "US") */
  countryCode: string;
  /** Formatted price string (e.g., "€58.12", "£48.90", "$63.34") */
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

### CommodityMoverData Interface (v2.4)

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

  // Currency conversion fields (v2.4)
  priceEur: number | null;
  priceGbp: number | null;
  priceUsd: number | null;
  quoteCurrency: string;

  /** First conversion line: { countryCode, priceText } */
  conversionLine1: { countryCode: string; priceText: string };
  /** Second conversion line: { countryCode, priceText } */
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

| Limit Type      | Value       | Notes                               |
| --------------- | ----------- | ----------------------------------- |
| **Per-minute**  | 1 call      | Hard endpoint limit for commodities |
| **Daily total** | 3,333 calls | Shared across all Marketstack feeds |

### Budget Allocation

| Feed                  | Estimated Daily Calls | % of 3,333 Budget           |
| --------------------- | --------------------- | --------------------------- |
| Commodities           | ~720                  | 21.6%                       |
| Indices               | ~96                   | 2.9%                        |
| **Total Marketstack** | ~816                  | **24.5%**                   |
| **Headroom**          | ~2,517                | 75.5% (future FX migration) |

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

| File                                       | Purpose                                 |
| ------------------------------------------ | --------------------------------------- |
| `src/marketstack/commodities.ts`           | FeedHandler implementation              |
| `src/marketstack/commodities-scheduler.ts` | Rolling scheduler with cold-start burst |
| `src/marketstack/commodities-adapter.ts`   | Marketstack v2 API adapter              |
| `src/marketstack/commodities-budget.ts`    | Separate budget tracker                 |
| `src/server.ts`                            | Feed initialization and startup         |

### Frontend Files (Vercel)

| File                                                          | Purpose                                  |
| ------------------------------------------------------------- | ---------------------------------------- |
| `src/data/commodities/commodities.catalog.json`               | SSOT catalog (78 commodities)            |
| `src/data/commodities/commodities.schema.ts`                  | Zod validation schema                    |
| `src/data/commodities/index.ts`                               | Catalog helpers and routing              |
| `src/lib/commodities/catalog.ts`                              | Typed helper layer                       |
| `src/lib/commodities/convert.ts`                              | Currency conversion + smart lines (v2.4) |
| `src/lib/commodities/sort-movers.ts`                          | Winner/loser sorting algorithm           |
| `src/hooks/use-commodities-quotes.ts`                         | Centralized polling hook                 |
| `src/components/ribbon/commodities-movers-grid.tsx`           | Presentational grid (snap-fit + windows) |
| `src/components/ribbon/commodities-movers-grid.container.tsx` | Data container (sorting logic)           |
| `src/components/ribbon/commodity-mover-card.tsx`              | Individual card component (v2.4)         |
| `src/components/ui/flag.tsx`                                  | Flag component (SVG + emoji fallback)    |
| `src/app/api/commodities/config/route.ts`                     | SSOT config endpoint                     |
| `src/app/api/commodities/route.ts`                            | Gateway proxy                            |
| `src/types/commodities-movers.ts`                             | TypeScript interfaces (v2.4)             |
| `src/types/commodities-ribbon.ts`                             | Quote types                              |

---

## Customization Guide

### Font Size (Snap-Fit Range)

**File:** `src/components/ribbon/commodities-movers-grid.tsx`

| Line | Constant      | Default | Description                       |
| ---- | ------------- | ------- | --------------------------------- |
| 37   | `MIN_FONT_PX` | `18`    | Minimum font size (small screens) |
| 38   | `MAX_FONT_PX` | `32`    | Maximum font size (large screens) |
| 39   | `STEP_PX`     | `1`     | Step down increment               |

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

### Panel Aspect Ratio

**File:** `src/components/ribbon/commodities-movers-grid.tsx`

| Line | Constant             | Default | Description                         |
| ---- | -------------------- | ------- | ----------------------------------- |
| 32   | `PANEL_ASPECT_RATIO` | `1.3`   | Width:height ratio (lower = taller) |

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
      "coldStartMode": false,
      "intervalMs": 120000,
      "queueLength": 78,
      "queuePosition": 45,
      "cycleCount": 3,
      "currentCommodity": "coffee",
      "lastFetchAt": "2026-02-03T14:32:00Z",
      "nextFetchAt": "2026-02-03T14:34:00Z"
    }
  }
}
```

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

| Date       | Change                                                                                |
| ---------- | ------------------------------------------------------------------------------------- |
| 2026-02-05 | **v2.4**: Flag component for ALL flag displays (base + conversions)                   |
| 2026-02-05 | **v2.4**: ConversionLineData interface with countryCode + priceText structure         |
| 2026-02-05 | **v2.4**: Windows compatibility via SVG flags instead of emoji text                   |
| 2026-02-05 | **v2.3**: Flag emoji on base price + 3-line conversion for non-major currencies       |
| 2026-02-05 | **v2.3**: Currency → country code mapping (48 currencies)                             |
| 2026-02-05 | **v2.2**: Smart conversion lines avoiding redundant EUR→EUR or GBP→GBP displays       |
| 2026-02-05 | **v2.2**: Stacked vertical conversion layout below percentage change                  |
| 2026-02-04 | **Movers grid redesign**: Two side-by-side panels with 4 windows each                 |
| 2026-02-04 | **Snap-fit fix**: Measurer no longer uses overflow-hidden (proper overflow detection) |
| 2026-02-04 | **Card layout**: Emoji + name now side by side (3-row layout → 5-6 row layout)        |
| 2026-02-04 | **Responsive panels**: aspect-ratio based sizing with minHeight: fit-content          |
| 2026-02-04 | **Font range**: MIN_FONT_PX=18, MAX_FONT_PX=32 for better visibility                  |
| 2026-02-04 | **Added customization guide**: Line numbers for font, gaps, spacing adjustments       |
| 2026-02-03 | Added cold-start burst mode (1-min → 2-min transition)                                |
| 2026-02-03 | Removed `commodities.selected.json` dependency                                        |
| 2026-02-03 | Frontend config now returns ALL 78 active commodities                                 |
| 2026-02-03 | Added movers grid placeholder handling for cold-start gaps                            |
| 2026-02-02 | Migrated from fallback provider to Marketstack v2                                     |
| 2026-01-15 | Initial commodities feed implementation                                               |
