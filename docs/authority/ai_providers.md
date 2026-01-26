# AI Providers

**Last updated:** 19 January 2026  
**Owner:** Promagen  
**Existing features preserved:** Yes

## Purpose

This document describes Promagen's **AI Providers catalogue**, how providers are displayed (Leaderboard + Detail + Prompt Builder), and how provider capabilities and prompts are mapped.

For affiliate and referral outbound linking, see: **ai providers affiliate & links.md** (`docs/authority/ai providers affiliate & links.md`).

For the prompt builder page architecture, see: **prompt-builder-page.md** (`docs/authority/prompt-builder-page.md`).

For Gallery Mode integration, see: **gallery-mode-master.md** (`docs/authority/gallery-mode-master.md`).

Monetisation scope note
This document does not define what is free vs paid in Promagen.

All paid/free boundaries are defined only in:
`C:\Users\Proma\Projects\promagen\docs\authority\paid_tier.md`

Hard rule: if it is not written in `paid_tier.md`, it is free.

## Canonical data sources (single source of truth)

### Provider catalogue

- `frontend/src/data/providers/providers.json`
- `frontend/src/data/providers/index.ts`

The catalogue is the authoritative list of providers (currently 42 providers across 16 countries).

### Provider type (TypeScript)

**Canonical entry point:** `@/types/provider`

This file re-exports from `@/types/providers.ts`. All UI and route code must import the `Provider` type from this single entry point:

```typescript
import type { Provider } from '@/types/provider';
```

**Forbidden patterns:**

- Importing from `@/types/providers` directly (use the entry point)
- Defining ad-hoc Provider types in components or routes
- Using `z.infer<typeof SomeSchema>` as the Provider type in UI code

### Provider type definition (Updated Jan 2, 2026)

```typescript
// src/types/providers.ts

export type ProviderTrend = 'up' | 'down' | 'flat';
export type ProviderGenerationSpeed = 'fast' | 'medium' | 'slow' | 'varies';

/**
 * Quality tier for providers not covered by external benchmarks.
 */
export type ProviderQualityTier =
  | 'top-tier' // Best-in-class quality
  | 'mid-tier' // Good quality, competitive
  | 'entry-tier' // Basic quality, accessible
  | 'specialized' // Niche use case (anime, editing, etc.)
  | 'utility'; // Not primarily generative

/**
 * Community ranking data for a provider.
 */
export type ProviderRanking = {
  seedElo: number | null; // From Artificial Analysis (null if not benchmarked)
  seedTier: ProviderQualityTier; // Manual tier for providers without ELO
  bayesianScore: number | null; // Calculated from community votes
  communityRank: number | null; // Derived rank 1-N
  totalVotes: number; // Total weighted votes
  signals: {
    imageUploads: number;
    imageLikes: number;
    comments: number;
    cardLikes: number;
  };
  lastCalculated: string | null; // ISO timestamp
};

export type Provider = {
  id: string;
  name: string;
  country?: string; // DEPRECATED: Use countryCode
  countryCode?: string; // ISO 3166-1 alpha-2

  score?: number; // Overall score 0-100
  trend?: ProviderTrend;
  tags?: string[];

  website: string;
  url?: string; // Legacy alias

  affiliateUrl: string | null;
  requiresDisclosure: boolean;

  tagline?: string;
  tip?: string;

  icon?: string;
  localIcon?: string;

  hqCity?: string;
  timezone?: string;
  supportHours?: string;

  imageQualityRank?: number;
  incumbentAdjustment?: boolean;

  visualStyles?: string;
  apiAvailable?: boolean;
  affiliateProgramme?: boolean;

  // Community ranking (populated when voting is enabled)
  ranking?: ProviderRanking;

  // DEPRECATED fields
  sweetSpot?: string;
  generationSpeed?: ProviderGenerationSpeed;
  affordability?: string;

  supportsPrefill?: boolean;
  group?: string;
  tier?: string;
};
```

### Provider `hqCity` Field and Market Pulse Connections (Added Jan 8, 2026)

The `hqCity` field is **critical** for the Market Pulse feature. It enables dynamic city connections between AI providers and stock exchanges.

#### How It Works

Market Pulse v2.1 dynamically connects providers to exchanges by matching:

```
provider.hqCity (normalized) === exchange.city (normalized)
```

**No hardcoded mappings** — add or update `hqCity` in `providers.json` and connections auto-update.

#### City Normalization

Some providers use suburb names or alternative city names. The system normalizes these:

| Provider `hqCity` Value | Normalized To   | Provider Example |
| ----------------------- | --------------- | ---------------- |
| `Surry Hills`           | `Sydney`        | Canva            |
| `Mountain View`         | `San Francisco` | Google (Imagen)  |
| `Menlo Park`            | `San Francisco` | Meta (Imagine)   |
| `Palo Alto`             | `San Francisco` | Hotpot           |
| `San Jose`              | `San Francisco` | Adobe            |
| `Redmond`               | `Seattle`       | Microsoft        |

**Source:** `src/data/city-connections.ts` → `CITY_ALIASES`

#### Current Provider Cities (42 providers)

| City                       | Providers                                                                 |
| -------------------------- | ------------------------------------------------------------------------- |
| **San Francisco**          | OpenAI, Anthropic, Midjourney, Replicate, Stability AI (US), xAI, Civitai |
| **London**                 | Stability AI (UK), DreamStudio, Dreamlike.art                             |
| **Sydney**                 | Leonardo AI                                                               |
| **Surry Hills** (→ Sydney) | Canva                                                                     |
| **Hong Kong**              | Fotor, Artguru, PicWish                                                   |
| **Toronto**                | Ideogram                                                                  |
| **Paris**                  | Clipdrop                                                                  |
| **Taipei**                 | MyEdit                                                                    |
| **Vienna**                 | Remove.bg                                                                 |
| **Warsaw**                 | Getimg.ai                                                                 |
| **New York**               | Runway ML, Artbreeder                                                     |
| **Mountain View** (→ SF)   | Google (Imagen)                                                           |
| **Menlo Park** (→ SF)      | Meta (Imagine)                                                            |
| **Palo Alto** (→ SF)       | Hotpot                                                                    |
| **San Jose** (→ SF)        | Adobe                                                                     |
| **Redmond** (→ Seattle)    | Microsoft (Designer, Bing)                                                |

#### Adding a New Provider with City Connection

To enable Market Pulse for a new provider:

1. Add `hqCity` to the provider entry in `providers.json`:

```json
{
  "id": "new-provider",
  "name": "New AI",
  "hqCity": "Melbourne",
  ...
}
```

2. If the city name is non-standard, add an alias to `CITY_ALIASES` in `city-connections.ts`

3. No other code changes needed — connections derive automatically

#### API for City Connections

```typescript
import {
  getProvidersInCity,
  getExchangesInCity,
  getCityConnections,
} from '@/data/city-connections';

// Get all providers headquartered in Sydney
const sydneyProviders = getProvidersInCity('Sydney');

// Get all exchanges in Sydney
const sydneyExchanges = getExchangesInCity('Sydney');

// Get full connection map
const connections = getCityConnections();
```

---

## AI Provider Selector (v2.1.0 — NEW)

### Overview

Pro Promagen users can filter the AI Providers leaderboard to show only their preferred providers. This feature:

1. Uses a **dropdown selector** (same style as rest of site)
2. Lists all 42 providers **alphabetically**, with **123rf positioned last**
3. Allows selection of **1–3 providers** in Gallery Mode
4. Allows **unlimited selection** outside Gallery Mode
5. Is **Pro-only** — Free users see full leaderboard (no dropdown)

### Sort Order Logic

**Alphabetical A-Z, with 123rf always last:**

```typescript
// src/lib/providers/sort.ts

function sortProvidersForSelector(providers: Provider[]): Provider[] {
  return [...providers].sort((a, b) => {
    // 123rf always goes last
    if (a.id === '123rf' || a.id === 'i23rf') return 1;
    if (b.id === '123rf' || b.id === 'i23rf') return -1;

    // Alphabetical by name
    return a.name.localeCompare(b.name);
  });
}
```

**Result order example:**

1. Adobe Firefly
2. Artbreeder
3. Bing Image Creator
4. Canva
5. ...
6. Stability AI
7. 123rf ← Always last

**Rationale for 123rf placement:** 123rf consistently ranks lowest in quality benchmarks. Placing it last reduces selection friction for users browsing alphabetically while maintaining full access.

### UI Specification

**Location:** Above the Providers Table, aligned left

**Component:** Uses existing `Combobox` component with these props:

- `singleColumn={true}` — Forces alphabetical scanning (no grid)
- `maxSelections` — Dynamic based on Gallery Mode state
- `compact={true}` — Fits in header area

```
┌─────────────────────────────────────────────────────────────────┐
│  [▼ Filter Providers...]    Selected: Midjourney, DALL·E (2)   │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ [Providers Table — filtered to selected providers]        │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Selection Limits

| Context            | Max Selections | Rationale                                                            |
| ------------------ | -------------- | -------------------------------------------------------------------- |
| **Gallery Mode**   | 1–3            | Gallery focuses on a few providers; prevents "all providers" clutter |
| **Providers View** | Unlimited (42) | Full flexibility when not in Gallery                                 |

**Gallery Mode enforcement:**

```typescript
const isGalleryMode = useGalleryMode(); // From context or URL
const maxProviderSelections = isGalleryMode ? 3 : 42;

<Combobox
  id="provider-filter"
  label="Filter Providers"
  options={sortedProviderNames}
  selected={selectedProviders}
  maxSelections={maxProviderSelections}
  singleColumn={true}
  compact={true}
  placeholder="Filter providers..."
  onSelectChange={handleProviderFilterChange}
/>
```

**Gallery Mode truncation behaviour:**

- If user had >3 selected when switching to Gallery Mode: truncate to first 3 alphabetically
- Show toast: "Gallery Mode limits to 3 providers"
- Display hint in dropdown: "(max 3 in Gallery)"

### Pro Gating

| User Tier | Selector Visible | Table Behaviour               |
| --------- | ---------------- | ----------------------------- |
| Free      | ❌ Hidden        | Shows full leaderboard        |
| Pro       | ✅ Visible       | Filters to selected providers |

**Conditional rendering:**

```tsx
{
  isPro && (
    <ProviderFilterSelector
      providers={providers}
      selected={selectedProviders}
      onChange={setSelectedProviders}
      isGalleryMode={isGalleryMode}
    />
  );
}

<ProvidersTable providers={providers} filterIds={isPro ? selectedProviders : undefined} />;
```

### Persistence

Selected providers persist in:

1. **Local storage** — For immediate recall
2. **Clerk user metadata** — For cross-device sync (Pro only)

**Storage key:** `promagen:provider-filter`

**Schema:**

```typescript
// src/lib/providers/filter-prefs.ts

interface ProviderFilterPrefs {
  selected: string[]; // Provider IDs
  updatedAt: string; // ISO timestamp
}

const STORAGE_KEY = 'promagen:provider-filter';

function loadProviderFilter(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: ProviderFilterPrefs = JSON.parse(raw);
    return parsed.selected;
  } catch {
    return [];
  }
}

function saveProviderFilter(selected: string[]): void {
  const prefs: ProviderFilterPrefs = {
    selected,
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}
```

### Empty State

If user selects 0 providers (clears all):

- Show full leaderboard
- Dropdown shows "All providers"

### Gallery Mode Integration

When in Gallery Mode:

1. Dropdown limit enforced to 3
2. If user had >3 selected, truncate to first 3 with toast
3. Prompt copy buttons show only for selected provider tiers
4. Selected providers influence which 4-tier prompt variants are emphasized

### Accessibility

| Requirement            | Implementation                                 |
| ---------------------- | ---------------------------------------------- |
| Keyboard navigation    | Full arrow key + Enter support (from Combobox) |
| Screen reader          | `aria-label="Filter AI providers"`             |
| Focus management       | Returns focus to trigger after selection       |
| Selection announcement | Live region announces changes                  |

### Component Files

**New files:**

| File                                                    | Purpose                           |
| ------------------------------------------------------- | --------------------------------- |
| `src/lib/providers/sort.ts`                             | Alphabetical sort with 123rf last |
| `src/lib/providers/filter-prefs.ts`                     | localStorage + Clerk persistence  |
| `src/components/providers/provider-filter-selector.tsx` | Dropdown component                |

**Modified files:**

| File                                           | Changes                          |
| ---------------------------------------------- | -------------------------------- |
| `src/components/providers/providers-table.tsx` | Add `filterIds` prop             |
| `src/app/providers/page.tsx`                   | Integrate selector for Pro users |

### Authority Cross-Reference

- **Gallery Mode master spec:** `docs/authority/gallery-mode-master.md` §16
- **Paid tier definition:** `docs/authority/paid_tier.md` §5.12

---

## 4-Tier Prompt System

The provider catalogue maps each platform to one of **four prompt tiers** based on their prompt handling capabilities:

### Tier Definitions

| Tier  | Name              | Prompt Style                                | Examples                         |
| ----- | ----------------- | ------------------------------------------- | -------------------------------- |
| **1** | CLIP-Based        | Tokenized keywords, high stacking tolerance | Stable Diffusion, Flux, Leonardo |
| **2** | Midjourney Family | Parameter-rich, very high tolerance         | Midjourney, Niji, BlueWillow     |
| **3** | Natural Language  | Conversational prompts, medium tolerance    | DALL·E, Imagen, Firefly          |
| **4** | Plain Language    | Simple prompts work best, low tolerance     | Craiyon, Canva, Artbreeder       |

### Platform Tier Assignments (All 42 Platforms)

**Tier 1 — CLIP-Based (13 platforms):**
`stability`, `leonardo`, `clipdrop`, `nightcafe`, `dreamstudio`, `lexica`, `novelai`, `dreamlike`, `getimg`, `openart`, `playground`, `artguru`, `jasper-art`

**Tier 2 — Midjourney Family (2 platforms):**
`midjourney`, `bluewillow`

**Tier 3 — Natural Language (10 platforms):**
`openai`, `adobe-firefly`, `ideogram`, `runway`, `microsoft-designer`, `bing`, `flux`, `google-imagen`, `imagine-meta`, `hotpot`

**Tier 4 — Plain Language (17 platforms):**
`canva`, `craiyon`, `deepai`, `pixlr`, `picwish`, `fotor`, `visme`, `vistacreate`, `myedit`, `simplified`, `freepik`, `picsart`, `photoleap`, `artbreeder`, `123rf`, `remove-bg`, `artistly`

### Gallery Mode Prompt Variants

Gallery Mode generates **4 prompt variants** for each image — one per tier:

```typescript
// Scene Brief → 4 deterministic prompt renderings

// Tier 1 (CLIP-Based):
'Tokyo skyline at twilight::1.3, golden hour light, serene, contemplative, peaceful, cherry blossom season, (Mount Fuji background:1.2), cinematic photography style, wide angle lens --no text logos watermarks';

// Tier 2 (Midjourney):
'Tokyo skyline at twilight, golden hour light, serene contemplative peaceful atmosphere, cherry blossom season, Mount Fuji in background, cinematic photography, wide angle --ar 16:9 --no text logos watermarks';

// Tier 3 (Natural Language):
'A serene photograph of the Tokyo skyline at twilight during cherry blossom season. The scene is bathed in golden hour light with Mount Fuji visible in the background. The atmosphere is contemplative and peaceful. Shot in a cinematic style with a wide angle lens. No text or logos.';

// Tier 4 (Plain Language):
'Tokyo skyline at sunset with cherry blossoms, golden light, Mount Fuji in background, peaceful mood, wide angle photo';
```

---

## Community Voting System (Image Quality Rank)

### How Voting Works

Users can vote for their favourite provider's image quality. Votes influence the "Image Quality" column ranking.

**Signal types and weights:**

| Signal       | Standard Weight | Pro Weight |
| ------------ | --------------- | ---------- |
| Image upload | 1               | 1.5        |
| Image like   | 2               | 3          |
| Comment      | 2               | 3          |
| Card like    | 3               | 4.5        |

### Bayesian Ranking Formula

```typescript
bayesianScore = (n * x + m * c) / (n + m)

where:
  n = total weighted votes for provider
  x = average vote score
  m = 10 (confidence threshold)
  c = 50 (prior mean / "skeptical baseline")
```

### Seed Data (Initial Rankings)

From Artificial Analysis ELO scores (Nov 2024):

| Provider         | Seed ELO |
| ---------------- | -------- |
| Midjourney       | 1093     |
| Stability AI SD3 | 1084     |
| OpenAI DALL·E 3  | 984      |

Providers without external benchmarks are assigned manual tiers:

- **Top-tier:** Adobe Firefly, Runway ML
- **Mid-tier:** Canva, Lexica, OpenArt, NightCafe, Jasper Art, Freepik
- **Entry-tier:** Craiyon, DeepAI, Hotpot
- **Specialized:** NovelAI (anime), Remove.bg (utility), Clipdrop (editing)

### Implementation Files

| File                                                     | Purpose                     |
| -------------------------------------------------------- | --------------------------- |
| `src/components/providers/image-quality-vote-button.tsx` | Animated thumbs-up button   |
| `src/components/providers/providers-table.tsx`           | Table with vote integration |
| `src/hooks/use-image-quality-vote.ts`                    | Vote state management hook  |
| `src/lib/vote-storage.ts`                                | localStorage vote tracking  |
| `src/app/api/providers/vote/route.ts`                    | Vote API endpoint           |

### Visual States

| State               | Appearance                            |
| ------------------- | ------------------------------------- |
| Not voted, can vote | Outline thumb, highlights on hover    |
| Already voted       | Filled emerald thumb                  |
| Daily limit reached | Outline thumb, dimmed, no interaction |
| Animating           | Bounce + fill transition (400ms)      |
| Not authenticated   | Outline thumb, dimmed, no interaction |

### Anti-Gaming Measures

1. **Authentication required** — Anonymous votes not accepted
2. **Paid multiplier** — Makes bot farming expensive
3. **3 votes/day limit** — Prevents spam
4. **Rolling 24h window** — Prevents midnight gaming
5. **Bayesian formula** — Skeptical of low-sample providers
6. **Time decay** — Reduces impact of old coordinated attacks
7. **Silent enforcement** — No counters or limits shown to users

### API Contract

**POST /api/providers/vote**

Request:

```json
{
  "providerId": "midjourney",
  "signalType": "card_like"
}
```

Response:

```json
{
  "success": true,
  "vote": {
    "providerId": "midjourney",
    "weight": 3
  }
}
```

**GET /api/providers/vote?providerId=midjourney**

Response:

```json
{
  "providerId": "midjourney",
  "totalVotes": 127,
  "signals": {
    "imageUploads": 12,
    "imageLikes": 45,
    "comments": 23,
    "cardLikes": 47
  }
}
```

---

## Provider catalogue fields

### Implemented fields (current)

Each entry in `providers.json` currently contains:

- `id: string` — Stable slug used in routes and lookups (e.g. `openai`, `midjourney`).
- `name: string` — Display name.
- `website: string` — Canonical official destination for the provider.
- `affiliateUrl: string | null` — Affiliate/referral destination (if applicable). If null, use `website`.
- `requiresDisclosure: boolean` — Whether the UI must show an affiliate disclosure label near the outbound link.
- `tagline: string` — Short flavour/summary for cards/tables.
- `score: number` — Promagen score, used for ranking (0–100).
- `trend: up | down | flat` — Trend indicator for the leaderboard.
- `tip: string` — Short instruction to help users take action quickly.
- `supportsPrefill: boolean` — Whether Promagen can prefill prompts.

#### Event taxonomy (authoritative)

Allowed `eventType` values (and default weights for "usage points"):

- `open` (weight 1) — outbound click/open (e.g. `/go/...`)
- `click` (weight 1) — legacy alias for `open` (avoid introducing new uses)
- `submit` (weight 3) — user submitted a prompt/form
- `success` (weight 5) — confirmed success (e.g. provider returned 200 / result created)
- `vote` (weight 3) — user voted for provider image quality (added Jan 2, 2026)

If you need a new `eventType`, update this list and the aggregator in the same change.

### Analytics-derived metrics (Promagen Users + Online Now)

**Postgres + Cron aggregation** (cheap, controlled)

We ship it live as soon as it's built, but we keep it truthful with a **freshness guard** (blank/"—" if aggregates are stale) so production never shows made-up numbers.

Freshness guard (48h) — the rule

- If `provider_country_usage_30d.updatedAt` is older than 48 hours → render blank (or "—") and `console.warn`/server-log.
- If fresh → render flags + Roman numerals.

---

## Core routes and pages

### Leaderboard

- `frontend/src/app/providers/leaderboard/page.tsx` — renders the leaderboard using `getProviders()` and `ProvidersTable`.
- `frontend/src/app/providers/page.tsx` — currently the same leaderboard surface.
- `frontend/src/app/leaderboard/page.tsx` — redirects to `/providers/leaderboard`.

### Provider detail / Prompt builder

- `frontend/src/app/providers/[id]/page.tsx` — shows prompt builder workspace (two-row layout).
- Authority for page architecture: `docs/authority/prompt-builder-page.md`

#### Leaderboard table column contract (UI, non-negotiable)

**Provider count:** 42 platforms representing 16 countries

Column order (left → right):

Provider | Promagen Users | Image Quality | Visual Styles | API/Affiliate | Overall Score

Rules:

- **Overall Score column is always the far right.**
- **Rank is not a dedicated column** (table is sorted by Overall Score DESC by default).
- **Trend is not a dedicated column** (trend renders as a small indicator inside the Overall Score cell).
- **Tags column is removed** (information density comes from Visual Styles).
- **Sweet Spot, Generation Speed, and Affordability columns removed** (streamlined for clarity).

Column definitions:

- **Provider** = Provider name + icon links + location/time (multi-line cell)
  - **Line 1:** Rank + Provider name (hyperlinked to homepage) + Provider icon (hyperlinked)
  - **Line 2:** 🏁 Country flag + City name
  - **Line 3:** HH:MM clock + 🎨 "Prompt builder" link
- **Promagen Users** = top up to 6 country flags + counts; 2×2×2 layout; blank if zero.
- **Image Quality** = Ordinal ranking (1st, 2nd, 3rd...) + Vote button
  - Top 3 show medal emoji: 🥇 🥈 🥉
  - **Vote button:** Thumbs-up icon to the right of rank
  - Sortable column: Users can click header to re-sort table by quality rank
- **Visual Styles** = what it excels at visually (max 2 lines).
- **API/Affiliate** = emoji indicators (📌 = API, 🤝 = Affiliate).
- **Overall Score** = 0–100 composite score with trend indicator (↑/↓/◆).

Score calculation (7 weighted criteria):

1. **Adoption/Ecosystem** (20%) - User base, integrations, community
2. **Image Quality** (10%) - Pure visual output quality (community-influenced)
3. **Speed/Uptime** (15%) - Generation time, reliability
4. **Cost/Free Tier** (15%) - Value for money, free tier generosity
5. **Trust/Safety** (15%) - Content policy, filtering, copyright
6. **Automation/Innovation** (15%) - API, features, iteration speed
7. **Ethical/Environmental** (10%) - Energy transparency, artist compensation

**Incumbent adjustment (-5 points):**

Platforms meeting **2 or more** of these criteria receive a -5 point adjustment:

1. **Big Tech backing:** Owned by or bundled into company with >$10B market cap OR >100M users in core product
2. **Mainstream user base:** >10M registered users OR >50% brand recognition in general population
3. **Mature product line:** <3 major features per quarter OR enterprise/stability focus over rapid innovation

### Provider Cell Structure

The Provider cell in the leaderboard displays a three-line layout:

**Line 1: Rank + Name (hyperlinked) + Provider Icon**
**Line 2: Flag + City**
**Line 3: Time + Prompt Builder Link**

**Outbound link routing:**

| Element           | Destination                                            | Opens In |
| ----------------- | ------------------------------------------------------ | -------- |
| Provider name     | `/go/{id}?src=leaderboard_homepage` → provider website | New tab  |
| Provider icon     | `/go/{id}?src=leaderboard_homepage` → provider website | New tab  |
| 🎨 Prompt builder | `/providers/{id}/prompt-builder`                       | Same tab |

---

## Provider APIs

### Providers list API

- `frontend/src/app/api/providers/route.ts`

### Provider resolve API

- `frontend/src/app/api/providers/resolve/route.ts`

### Bulk leaderboard API proxy

- `frontend/src/app/api/providers/leaderboard/bulk/route.ts`

### Provider vote API (Added Jan 2, 2026)

- `frontend/src/app/api/providers/vote/route.ts`
- POST: Record a vote
- GET: Retrieve vote statistics

---

## Testing and lock-in proofs

### Provider catalogue shape tests

- `frontend/src/data/providers/tests/providers.catalog.shape.test.ts`

Guards list length, required fields, types, and uniqueness.

### Provider schema tests

- `frontend/src/__tests__/providers.schema.test.ts`

### Provider detail tests

- `frontend/src/components/providers/__tests__/provider-detail.smoke.test.tsx`

---

## Adding a provider (process)

Adding a provider is an intentional change and must be lock‑tested.

1. Add entry to `frontend/src/data/providers/providers.json`
   - Must include: `id`, `name`, `website`, `score`, `trend`, `tagline`, `tip`, `supportsPrefill`.
   - Decide `affiliateUrl` and `requiresDisclosure` (default: null/false until approved).

2. Update `providers.capabilities.json`
   - Add overrides if needed for `supportsNegative`, `supportsPrefill`, `supportsSeed`, `supportsSteps`.

3. Update prompt builder mapping
   - Add provider id to `frontend/src/lib/providers/config.ts` `ProviderId` union.
   - Add a builder entry in `PROVIDER_BUILDERS`.

4. Update any duplicated provider id sets
   - `frontend/src/lib/affiliates.ts` currently hard-codes provider ids; keep in sync or consolidate.

5. Update tests
   - If the canonical list size changes from 42, update the shape test intentionally.

6. Ensure affiliate links do not affect scoring
   - Provider score/rank must be independent of monetisation fields.

---

## Known gaps and "missing stuff" (to fix deliberately)

### 1) Canonical URL field: `website` (legacy alias: `url`)

- Catalogue uses `website` as canonical.
- `url` is treated as a legacy alias only for backwards compatibility.

**Status:** Documented, not yet removed.

### 2) Canonical Provider type import

- Use `@/types/provider` as the single canonical import.

**Status:** RESOLVED — `@/types/provider.ts` created as canonical entry point.

### 3) Duplicated schemas for providers

**Status:** RESOLVED — Canonical schema at `frontend/src/data/providers/providers.schema.ts`.

### 4) Affiliate configuration duplication

**Status:** Documented, not yet consolidated.

### 5) Consent model inconsistency (cookie vs localStorage)

**Status:** Documented, not yet resolved.

### 6) GA4 injection appears unconditional

**Status:** Documented, not yet resolved.

---

## Changelog

- **19 Jan 2026:** Added AI Provider Selector section (§ AI Provider Selector). Documented alphabetical sort with 123rf last, Gallery Mode 1-3 limit, Pro gating, and localStorage/Clerk persistence. Added 4-Tier Prompt System documentation for Gallery Mode integration. Cross-referenced Gallery Mode master spec.
- **8 Jan 2026:** Added `hqCity` field documentation for Market Pulse v2.1 city connections. Documented city normalization (aliases), provider city mapping, and connection API functions.
- **2 Jan 2026:** Added Community Voting System section. Updated Provider type with `ProviderRanking` fields. Documented vote button in Image Quality column. Added vote API endpoint. Updated event taxonomy with `vote` type. Updated score calculation weights (Image Quality reduced from 25% to 10% to accommodate community influence cap).
- **1 Jan 2026:** Provider Cell redesign: replaced 🏠 emoji with local PNG icons, provider name now hyperlinked to homepage, three-line layout.
- **30 Dec 2025:** Leaderboard redesign: 42 providers (16 countries), new column structure.
- **28 Dec 2025:** Added schema consolidation rules, marked gaps 2 and 3 as RESOLVED.
- **22 Dec 2025:** Initial version with leaderboard column contract, event taxonomy.

---

## Non-regression rule (Promagen discipline)

When adding features to AI Providers:

- Maintain existing UI layout, colours, and current behaviour unless explicitly changing a specific feature.
- Include lock‑in proof (test or explicit before/after behaviour note).
- Always state: **Existing features preserved: Yes/No** (Yes is the default expectation).

# ai_providers.md Update

**Target file:** `docs/authority/ai_providers.md`

---

## Change 1: Update "Last updated" date

**REPLACE line 3:**

```
**Last updated:** 8 January 2026
```

**WITH:**

```
**Last updated:** 24 January 2026
```

---

## Change 2: Add cross-reference to ignition.md

**ADD after line 13** (after the prompt-builder-page.md reference):

```markdown
For the Engine Bay (Ignition) homepage CTA, see: **ignition.md** (`docs/authority/ignition.md`).
```

---

## Full context (lines 9-15 after changes):

```markdown
This document describes Promagen's **AI Providers catalogue**, how providers are displayed (Leaderboard + Detail + Prompt Builder), and how provider capabilities and prompts are mapped.

For affiliate and referral outbound linking, see: **ai providers affiliate & links.md** (`docs/authority/ai providers affiliate & links.md`).

For the prompt builder page architecture, see: **prompt-builder-page.md** (`docs/authority/prompt-builder-page.md`).

For the Engine Bay (Ignition) homepage CTA, see: **ignition.md** (`docs/authority/ignition.md`).

Monetisation scope note
```
