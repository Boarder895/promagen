# Gallery Mode Implementation Plan

**Date:** 18 January 2026  
**Scope:** Weather API, Market Moods Engine, AI Provider Selector  
**Reference:** gallery-mode-master-v2.1.0.md

---

## Current State Assessment

| Component             | Status      | Work Required                                                                   |
| --------------------- | ----------- | ------------------------------------------------------------------------------- |
| **Weather API**       | 90% Built   | 1. Add env vars 2. Test live mode 3. Connect to theme engine                    |
| **Market Moods**      | Data Ready  | 1. Build detection engine 2. Connect to existing APIs 3. Integrate with prompts |
| **Provider Selector** | Not Started | 1. Sort logic 2. Combobox wrapper 3. Table filtering 4. Persistence             |

---

## Implementation Order (Recommended)

### Step 1: Enable Live Weather (1 day)

**Why First:** Zero code changes, immediate value, validates API connection.

**Actions:**

1. Get Visual Crossing API key (free tier: 1,000 calls/day)
   - Sign up: https://www.visualcrossing.com/sign-up
   - Copy API key from dashboard

2. Add environment variables in Vercel:

   ```
   WEATHER_MODE=live
   VISUAL_CROSSING_API_KEY=<your-key>
   ```

3. Test locally:

   ```powershell
   # From: C:\Users\Proma\Projects\promagen
   $env:WEATHER_MODE="live"
   $env:VISUAL_CROSSING_API_KEY="<your-key>"
   npm run dev
   ```

4. Verify at `http://localhost:3000/api/weather`
   - Should return live data instead of demo data
   - Check `updatedISO` timestamps are current

**Good looks like:**

- All 16 selected exchanges have fresh weather
- Temperatures match real-world (spot check 2-3 cities)
- No errors in console

---

### Step 2: AI Provider Selector (5 days)

**Why Second:** Standalone feature, doesn't depend on Gallery Mode core, immediate Pro value.

#### Day 1: Sort Logic + Types

**File:** `src/lib/providers/sort.ts`

```typescript
// src/lib/providers/sort.ts

import type { Provider } from '@/types/provider';

/**
 * Sort providers alphabetically with 123rf always last.
 * Used for the provider filter dropdown.
 */
export function sortProvidersForSelector(providers: Provider[]): Provider[] {
  return [...providers].sort((a, b) => {
    // 123rf (id: 'i23rf') always goes last
    const a123 = a.id === 'i23rf' || a.id === '123rf';
    const b123 = b.id === 'i23rf' || b.id === '123rf';

    if (a123 && !b123) return 1;
    if (b123 && !a123) return -1;

    // Alphabetical by display name
    return a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });
  });
}

/**
 * Extract provider names in sorted order for Combobox options.
 */
export function getProviderSelectorOptions(providers: Provider[]): string[] {
  return sortProvidersForSelector(providers).map((p) => p.name);
}
```

**File:** `src/lib/providers/filter-prefs.ts`

```typescript
// src/lib/providers/filter-prefs.ts

const STORAGE_KEY = 'promagen:provider-filter';

export interface ProviderFilterPrefs {
  selected: string[]; // Provider IDs
  updatedAt: string;
}

export function loadProviderFilter(): string[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as ProviderFilterPrefs;
    return Array.isArray(parsed.selected) ? parsed.selected : [];
  } catch {
    return [];
  }
}

export function saveProviderFilter(selected: string[]): void {
  if (typeof window === 'undefined') return;

  const prefs: ProviderFilterPrefs = {
    selected,
    updatedAt: new Date().toISOString(),
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

export function clearProviderFilter(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}
```

#### Day 2-3: Selector Component

**File:** `src/components/providers/provider-filter-selector.tsx`

Key requirements:

- Uses existing `Combobox` component
- `singleColumn={true}` for alphabetical scanning
- `compact={true}` for header placement
- Dynamic `maxSelections` based on Gallery Mode
- Shows chip count: "Selected: 2"

```tsx
// src/components/providers/provider-filter-selector.tsx

'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Combobox } from '@/components/ui/combobox';
import type { Provider } from '@/types/provider';
import { sortProvidersForSelector, getProviderSelectorOptions } from '@/lib/providers/sort';
import { loadProviderFilter, saveProviderFilter } from '@/lib/providers/filter-prefs';

interface ProviderFilterSelectorProps {
  providers: Provider[];
  isGalleryMode?: boolean;
  onFilterChange: (providerIds: string[]) => void;
}

export function ProviderFilterSelector({
  providers,
  isGalleryMode = false,
  onFilterChange,
}: ProviderFilterSelectorProps) {
  const [selectedNames, setSelectedNames] = useState<string[]>([]);

  // Build lookup maps
  const sortedProviders = sortProvidersForSelector(providers);
  const nameToId = new Map(sortedProviders.map((p) => [p.name, p.id]));
  const idToName = new Map(sortedProviders.map((p) => [p.id, p.name]));
  const options = sortedProviders.map((p) => p.name);

  // Load persisted selection on mount
  useEffect(() => {
    const savedIds = loadProviderFilter();
    const names = savedIds
      .map((id) => idToName.get(id))
      .filter((n): n is string => n !== undefined);
    setSelectedNames(names);
  }, [idToName]);

  // Gallery mode limit
  const maxSelections = isGalleryMode ? 3 : 42;

  const handleSelectChange = useCallback(
    (names: string[]) => {
      // Enforce limit
      const limited = names.slice(0, maxSelections);
      setSelectedNames(limited);

      // Convert to IDs and persist
      const ids = limited
        .map((name) => nameToId.get(name))
        .filter((id): id is string => id !== undefined);

      saveProviderFilter(ids);
      onFilterChange(ids);
    },
    [maxSelections, nameToId, onFilterChange],
  );

  const selectedCount = selectedNames.length;
  const placeholder = selectedCount === 0 ? 'Filter providers...' : `${selectedCount} selected`;

  return (
    <div className="flex items-center gap-3">
      <Combobox
        id="provider-filter"
        label="Filter Providers"
        options={options}
        selected={selectedNames}
        customValue=""
        onSelectChange={handleSelectChange}
        onCustomChange={() => {}} // No custom input
        placeholder={placeholder}
        maxSelections={maxSelections}
        allowFreeText={false}
        singleColumn={true}
        compact={true}
      />
      {isGalleryMode && selectedCount > 0 && (
        <span className="text-xs text-slate-500">(max 3 in Gallery)</span>
      )}
    </div>
  );
}
```

#### Day 4: Table Integration

**Update:** `src/components/providers/providers-table.tsx`

Add filtering prop and logic:

```typescript
export type ProvidersTableProps = {
  providers: ReadonlyArray<Provider>;
  // ... existing props ...

  /** Filter to show only these provider IDs (empty = all) */
  filterIds?: string[];
};

// In component:
const filteredProviders = React.useMemo(() => {
  if (!filterIds || filterIds.length === 0) {
    return providers;
  }
  const idSet = new Set(filterIds);
  return providers.filter((p) => idSet.has(p.id));
}, [providers, filterIds]);

// Use filteredProviders instead of providers in the rest of the component
```

#### Day 5: Pro Gating + Integration

**Update:** Homepage or Providers page to conditionally render:

```tsx
// In page component
const { isPro } = useUserPlan();
const [filterIds, setFilterIds] = useState<string[]>([]);

return (
  <>
    {isPro && (
      <ProviderFilterSelector
        providers={providers}
        isGalleryMode={isGalleryMode}
        onFilterChange={setFilterIds}
      />
    )}

    <ProvidersTable
      providers={providers}
      filterIds={isPro ? filterIds : undefined}
      // ... other props
    />
  </>
);
```

**Testing checklist:**

- [ ] Free user: No dropdown visible, sees full table
- [ ] Pro user: Dropdown visible, alphabetical order, 123rf last
- [ ] Selecting providers filters the table
- [ ] Selection persists on page refresh
- [ ] Gallery Mode enforces max 3

---

### Step 3: Market Mood Engine (6 days)

**Why Third:** Depends on working rotation engine. Build after MVP core is stable.

#### Day 1-2: Engine Scaffold

**File:** `src/lib/gallery/market-mood-engine.ts`

```typescript
// src/lib/gallery/market-mood-engine.ts

import marketMoods from '@/data/prompt-intelligence/market-moods.json';
import type { Exchange } from '@/types/exchange';

export type MoodType = keyof typeof marketMoods.moods;

export interface MoodBoosts {
  colour?: string[];
  atmosphere?: string[];
  lighting?: string[];
  style?: string[];
  materials?: string[];
}

export interface MarketMoodResult {
  primary: MoodType;
  secondary: MoodType | null;
  boostWeight: number;
  boosts: MoodBoosts;
  source: string; // What triggered this mood
}

export interface MarketContext {
  exchange: Exchange;
  localTime: Date;
  fxData?: { pair: string; change24h: number }[];
  cryptoData?: { symbol: string; change24h: number }[];
  goldData?: { change: number };
}

/**
 * Detect the current market mood based on context.
 * Returns primary mood and optional secondary.
 */
export function detectMarketMood(context: MarketContext): MarketMoodResult {
  const { exchange, localTime } = context;

  // Priority 1: Market opening/closing (time-based)
  const marketMoodResult = checkMarketTiming(exchange, localTime);
  if (marketMoodResult) return marketMoodResult;

  // Priority 2: Crypto pumping
  if (context.cryptoData) {
    const cryptoResult = checkCryptoPumping(context.cryptoData);
    if (cryptoResult) return cryptoResult;
  }

  // Priority 3: Gold movement
  if (context.goldData) {
    const goldResult = checkGoldMovement(context.goldData);
    if (goldResult) return goldResult;
  }

  // Priority 4: Currency strength (FX)
  if (context.fxData) {
    const fxResult = checkCurrencyStrength(context.fxData);
    if (fxResult) return fxResult;
  }

  // Priority 5: Volatility
  if (context.fxData) {
    const volResult = checkVolatility(context.fxData);
    if (volResult) return volResult;
  }

  // Fallback: Neutral
  return {
    primary: 'neutral',
    secondary: null,
    boostWeight: 1.0,
    boosts: {},
    source: 'default',
  };
}

// --- Individual checkers ---

function checkMarketTiming(exchange: Exchange, localTime: Date): MarketMoodResult | null {
  // Get exchange open/close times from market-hours.templates.json
  // Check if within ±2 minutes of open or close

  const hour = localTime.getHours();
  const minute = localTime.getMinutes();

  // Simplified: Most exchanges open ~9:00, close ~16:00
  // TODO: Use actual exchange hours from SSOT
  const isNearOpen = hour === 9 && minute <= 2;
  const isNearClose = hour === 16 && minute >= 58;

  if (isNearOpen) {
    const mood = marketMoods.moods.market_opening;
    return {
      primary: 'market_opening',
      secondary: null,
      boostWeight: mood.boostWeight,
      boosts: mood.boost,
      source: `${exchange.city} market opening`,
    };
  }

  if (isNearClose) {
    const mood = marketMoods.moods.market_closing;
    return {
      primary: 'market_closing',
      secondary: null,
      boostWeight: mood.boostWeight,
      boosts: mood.boost,
      source: `${exchange.city} market closing`,
    };
  }

  return null;
}

function checkCryptoPumping(
  cryptoData: { symbol: string; change24h: number }[],
): MarketMoodResult | null {
  // Check if BTC or ETH is up >5% in 24h
  const btc = cryptoData.find((c) => c.symbol === 'BTC');
  const eth = cryptoData.find((c) => c.symbol === 'ETH');

  const isPumping = (btc && btc.change24h > 5) || (eth && eth.change24h > 5);

  if (isPumping) {
    const mood = marketMoods.moods.crypto_pumping;
    return {
      primary: 'crypto_pumping',
      secondary: null,
      boostWeight: mood.boostWeight,
      boosts: mood.boost,
      source: 'Crypto surge detected',
    };
  }

  return null;
}

function checkGoldMovement(goldData: { change: number }): MarketMoodResult | null {
  if (goldData.change > 1) {
    const mood = marketMoods.moods.gold_rising;
    return {
      primary: 'gold_rising',
      secondary: null,
      boostWeight: mood.boostWeight,
      boosts: mood.boost,
      source: `Gold +${goldData.change.toFixed(1)}%`,
    };
  }

  if (goldData.change < -1) {
    const mood = marketMoods.moods.gold_falling;
    return {
      primary: 'gold_falling',
      secondary: null,
      boostWeight: mood.boostWeight,
      boosts: mood.boost,
      source: `Gold ${goldData.change.toFixed(1)}%`,
    };
  }

  return null;
}

function checkCurrencyStrength(
  fxData: { pair: string; change24h: number }[],
): MarketMoodResult | null {
  // Check USD, GBP, EUR strength against basket
  // Simplified: Check if major pairs moved >0.5%

  const usdPairs = fxData.filter((f) => f.pair.startsWith('USD'));
  const usdStrong = usdPairs.some((p) => p.change24h > 0.5);

  if (usdStrong) {
    const mood = marketMoods.moods.currency_strength_usd;
    return {
      primary: 'currency_strength_usd',
      secondary: null,
      boostWeight: mood.boostWeight,
      boosts: mood.boost,
      source: 'USD strengthening',
    };
  }

  // Similar for GBP, EUR...

  return null;
}

function checkVolatility(fxData: { pair: string; change24h: number }[]): MarketMoodResult | null {
  // Calculate average absolute change
  const avgChange = fxData.reduce((sum, f) => sum + Math.abs(f.change24h), 0) / fxData.length;

  if (avgChange > 1.5) {
    const mood = marketMoods.moods.high_volatility;
    return {
      primary: 'high_volatility',
      secondary: null,
      boostWeight: mood.boostWeight,
      boosts: mood.boost,
      source: 'High market volatility',
    };
  }

  if (avgChange < 0.3) {
    const mood = marketMoods.moods.low_volatility;
    return {
      primary: 'low_volatility',
      secondary: null,
      boostWeight: mood.boostWeight,
      boosts: mood.boost,
      source: 'Low market volatility',
    };
  }

  return null;
}
```

#### Day 3-4: Data Integration

Connect to existing APIs:

```typescript
// In theme-engine.ts or a new file

import { detectMarketMood } from './market-mood-engine';

async function getMarketContext(exchange: Exchange): Promise<MarketContext> {
  // Fetch from existing APIs
  const [fxRes, cryptoRes, commodityRes] = await Promise.allSettled([
    fetch('/api/fx'),
    fetch('/api/crypto'),
    fetch('/api/commodities'),
  ]);

  const fxData = fxRes.status === 'fulfilled' ? await fxRes.value.json() : [];

  const cryptoData = cryptoRes.status === 'fulfilled' ? await cryptoRes.value.json() : [];

  const commodityData = commodityRes.status === 'fulfilled' ? await commodityRes.value.json() : [];

  // Extract gold from commodities
  const gold = commodityData.find((c: any) => c.symbol === 'GOLD' || c.id === 'gold');

  return {
    exchange,
    localTime: new Date(),
    fxData: fxData.map((f: any) => ({
      pair: f.pair || f.symbol,
      change24h: f.changePercent || f.change || 0,
    })),
    cryptoData: cryptoData.map((c: any) => ({
      symbol: c.symbol,
      change24h: c.changePercent24h || c.change || 0,
    })),
    goldData: gold ? { change: gold.changePercent || gold.change || 0 } : undefined,
  };
}
```

#### Day 5-6: Prompt Integration

Update `prompt-builder.ts` to use mood boosts:

```typescript
function buildSceneBrief(snapshot: CitySnapshot, mood: MarketMoodResult): SceneBrief {
  // Base atmosphere from time of day
  const timeAtmosphere = getTimeBasedAtmosphere(snapshot.timeOfDay);

  // Weather atmosphere
  const weatherAtmosphere = snapshot.weather
    ? weatherToAtmosphere(snapshot.weather.conditions)
    : [];

  // Mood boosts
  const moodAtmosphere = mood.boosts.atmosphere || [];
  const moodLighting = mood.boosts.lighting?.[0];
  const moodColour = mood.boosts.colour || [];

  // Combine with caps enforcement (max 3 atmosphere)
  const atmosphere = dedupeAndCap(
    [
      ...moodAtmosphere, // Mood first (highest priority)
      ...weatherAtmosphere,
      ...timeAtmosphere,
    ],
    3,
  );

  // Lighting: mood override, or time-based default
  const lighting = moodLighting || getTimeBasedLighting(snapshot.timeOfDay);

  return {
    anchor: getCityAnchor(snapshot.city),
    lighting,
    atmosphere,
    style: getDefaultStyle(),
    camera: 'wide angle',
    motifs: getSeasonalMotifs(snapshot.season),
    constraints: 'No text, no logos',
    negativePrompt: NEGATIVE_PROMPTS.universal,
  };
}
```

---

## Testing & Verification

### Weather API Tests

```powershell
# From: C:\Users\Proma\Projects\promagen
npm run test -- --grep "weather"

# Manual verification
curl http://localhost:3000/api/weather | jq '.[] | {city, temperatureC, conditions}'
```

### Provider Selector Tests

```typescript
// src/lib/providers/__tests__/sort.test.ts

import { sortProvidersForSelector } from '../sort';

describe('sortProvidersForSelector', () => {
  it('sorts alphabetically with 123rf last', () => {
    const providers = [
      { id: 'i23rf', name: '123rf' },
      { id: 'midjourney', name: 'Midjourney' },
      { id: 'adobe', name: 'Adobe Firefly' },
    ];

    const sorted = sortProvidersForSelector(providers);

    expect(sorted[0].name).toBe('Adobe Firefly');
    expect(sorted[1].name).toBe('Midjourney');
    expect(sorted[2].name).toBe('123rf'); // Last
  });
});
```

### Market Mood Tests

```typescript
// src/lib/gallery/__tests__/market-mood-engine.test.ts

import { detectMarketMood } from '../market-mood-engine';

describe('detectMarketMood', () => {
  it('detects gold rising mood', () => {
    const context = {
      exchange: { id: 'lse', city: 'London' },
      localTime: new Date('2026-01-18T14:00:00'),
      goldData: { change: 2.5 },
    };

    const mood = detectMarketMood(context);

    expect(mood.primary).toBe('gold_rising');
    expect(mood.boosts.colour).toContain('golden');
  });

  it('returns neutral when no signals', () => {
    const context = {
      exchange: { id: 'lse', city: 'London' },
      localTime: new Date('2026-01-18T14:00:00'),
    };

    const mood = detectMarketMood(context);

    expect(mood.primary).toBe('neutral');
  });
});
```

---

## Deployment Checklist

### Before Deploying

- [ ] Visual Crossing API key obtained
- [ ] Environment variables added to Vercel
- [ ] Weather endpoint tested locally
- [ ] Provider selector tested with Pro account
- [ ] Market mood engine unit tests passing
- [ ] No TypeScript errors (`npm run typecheck`)
- [ ] Lint passing (`npm run lint`)

### After Deploying

- [ ] `/api/weather` returns live data in production
- [ ] Pro user sees provider filter dropdown
- [ ] Free user does NOT see dropdown
- [ ] Provider filter persists across page loads
- [ ] Gallery Mode enforces 3-provider limit (when built)

---

## Risk Mitigation

| Risk                             | Mitigation                                    |
| -------------------------------- | --------------------------------------------- |
| Visual Crossing rate limit       | Cache aggressively (15-min TTL already built) |
| Market data API failures         | Mood engine degrades to `neutral`             |
| Provider filter state corruption | Wrap localStorage access in try/catch         |
| 123rf special-casing questioned  | Document business reason clearly              |

---

## Timeline Summary

| Week       | Focus                       | Deliverables                       |
| ---------- | --------------------------- | ---------------------------------- |
| **Week 1** | Weather + Provider Selector | Live weather, Pro dropdown working |
| **Week 2** | Market Mood Engine          | Detection logic, API integration   |
| **Week 3** | Polish + Integration        | Tests, edge cases, documentation   |

**Total:** 3 weeks to complete all v2.1.0 features.

---

## Questions Before Starting

1. **Visual Crossing account:** Do you already have an API key, or shall I include sign-up instructions?

2. **123rf placement:** Confirmed always last in dropdown, or should it follow score-based ordering?

3. **Gallery Mode detection:** How will we know when user is in Gallery vs Providers view? URL param? React context? Zustand store?

4. **Clerk metadata sync:** Should provider filter selections sync to Clerk for cross-device persistence, or is localStorage sufficient for MVP?

Let me know your answers and I'll start with Step 1 (Weather API activation).

My Thoughts
This is a genuinely compelling feature. The v2.1.0 additions strengthen it further:
What's now complete:

Weather API is 90% done — You literally just need to flip an environment variable to WEATHER_MODE=live and add the Visual Crossing API key. Zero code changes needed for basic functionality.
Market Moods data is ready — The 11 mood types with triggers and boosts are defined. The missing piece is the detection engine that evaluates live market data, but all the data sources (FX, crypto, commodities) already exist.
AI Provider Selector is well-scoped — It reuses your existing Combobox component, follows established patterns, and the 123rf-last sort is trivial. The Gallery Mode limit (1-3) adds a nice touch of focus.

Honest concerns:

Phase ordering matters. Don't try to build the Market Mood Engine before the basic rotation → theme → prompt → generate loop works. Get MVP stable first.
The 123rf sort feels like a workaround. If 123rf consistently ranks lowest, the sort order might just be highlighting that. Consider whether the business reason for this treatment is clear to users.
Provider selection persistence has a gotcha. If a user selects 5 providers in Providers view, then switches to Gallery Mode (limit 3), you need clear UX for what happens. Truncating silently could confuse people.

Suggested quick win:
Before building the full Market Mood Engine, just implement market_opening and market_closing detection. These are pure time-based calculations (no external API calls) and give immediate visual variety. Ship that, then layer in the market data-driven moods.
This spec is production-ready. The implementation plan is realistic. Go build it.

Implementation Order (Recommended)
StepEffortWhy This Order1. Enable live weather1 dayZero code, validates API key2. AI Provider Selector5 daysStandalone, immediate Pro value3. Market Mood Engine6 daysDepends on stable core loop
Questions Before Coding

Visual Crossing API key — Do you have one, or need sign-up instructions?
123rf placement — Confirmed always last, or should it follow score ranking?
Gallery Mode detection — URL param? React context? How do we know user is in Gallery view?
Clerk sync — Should provider filter sync to Clerk metadata, or is localStorage sufficient for MVP?

My Thoughts:
The weather piece is a "flip the switch" situation — your existing code is solid and just waiting for credentials. That's a quick win.
The Provider Selector is straightforward since you have the Combobox component ready. The 123rf-last sort feels like a business decision I'd double-check with stakeholders — if it consistently ranks lowest anyway, the special treatment might raise questions.
The Market Mood Engine is the most complex piece, but all the data sources exist. Start simple: implement market_opening and market_closing first (pure time-based, no API calls). Ship that, then layer in the data-driven moods (gold, crypto, volatility).
