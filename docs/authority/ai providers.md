# AI Providers

**Last updated:** 8 January 2026  
**Owner:** Promagen  
**Existing features preserved:** Yes

## Purpose

This document describes Promagen's **AI Providers catalogue**, how providers are displayed (Leaderboard + Detail + Prompt Builder), and how provider capabilities and prompts are mapped.

For affiliate and referral outbound linking, see: **ai providers affiliate & links.md** (`docs/authority/ai providers affiliate & links.md`).

For the prompt builder page architecture, see: **prompt-builder-page.md** (`docs/authority/prompt-builder-page.md`).

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
  | 'top-tier'      // Best-in-class quality
  | 'mid-tier'      // Good quality, competitive
  | 'entry-tier'    // Basic quality, accessible
  | 'specialized'   // Niche use case (anime, editing, etc.)
  | 'utility';      // Not primarily generative

/**
 * Community ranking data for a provider.
 */
export type ProviderRanking = {
  seedElo: number | null;           // From Artificial Analysis (null if not benchmarked)
  seedTier: ProviderQualityTier;    // Manual tier for providers without ELO
  bayesianScore: number | null;     // Calculated from community votes
  communityRank: number | null;     // Derived rank 1-N
  totalVotes: number;               // Total weighted votes
  signals: {
    imageUploads: number;
    imageLikes: number;
    comments: number;
    cardLikes: number;
  };
  lastCalculated: string | null;    // ISO timestamp
};

export type Provider = {
  id: string;
  name: string;
  country?: string;      // DEPRECATED: Use countryCode
  countryCode?: string;  // ISO 3166-1 alpha-2
  
  score?: number;        // Overall score 0-100
  trend?: ProviderTrend;
  tags?: string[];
  
  website: string;
  url?: string;          // Legacy alias
  
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

| Provider `hqCity` Value | Normalized To | Provider Example |
|-------------------------|---------------|------------------|
| `Surry Hills` | `Sydney` | Canva |
| `Mountain View` | `San Francisco` | Google (Imagen) |
| `Menlo Park` | `San Francisco` | Meta (Imagine) |
| `Palo Alto` | `San Francisco` | Hotpot |
| `San Jose` | `San Francisco` | Adobe |
| `Redmond` | `Seattle` | Microsoft |

**Source:** `src/data/city-connections.ts` → `CITY_ALIASES`

#### Current Provider Cities (42 providers)

| City | Providers |
|------|-----------|
| **San Francisco** | OpenAI, Anthropic, Midjourney, Replicate, Stability AI (US), xAI, Civitai |
| **London** | Stability AI (UK), DreamStudio, Dreamlike.art |
| **Sydney** | Leonardo AI |
| **Surry Hills** (→ Sydney) | Canva |
| **Hong Kong** | Fotor, Artguru, PicWish |
| **Toronto** | Ideogram |
| **Paris** | Clipdrop |
| **Taipei** | MyEdit |
| **Vienna** | Remove.bg |
| **Warsaw** | Getimg.ai |
| **New York** | Runway ML, Artbreeder |
| **Mountain View** (→ SF) | Google (Imagen) |
| **Menlo Park** (→ SF) | Meta (Imagine) |
| **Palo Alto** (→ SF) | Hotpot |
| **San Jose** (→ SF) | Adobe |
| **Redmond** (→ Seattle) | Microsoft (Designer, Bing) |

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
  getConnectionsForProvider,
  getProviderConnectionInfo,
  isProviderConnected 
} from '@/data/city-connections';

// Check if provider connects to any exchange
const connected = isProviderConnected('leonardo'); // true (Sydney)

// Get connection details for UI
const info = getProviderConnectionInfo('leonardo');
// { city: 'Sydney', continent: 'oceania', color: '#22d3ee' }

// Get all exchange connections
const connections = getConnectionsForProvider('leonardo');
// [{ exchangeId: 'asx-sydney', providerId: 'leonardo', city: 'Sydney', continent: 'oceania' }]
```

See **ribbon-homepage.md** → "Market Pulse v2.1" for full architecture documentation.

### Provider schema (Zod validation)

**Canonical schema location:** `frontend/src/data/providers/providers.schema.ts`

This is the ONE authoritative Zod schema for validating `providers.json`. It must match the TypeScript type exactly.

**Schema rules:**

1. **Strict validation at the source** — The schema validates all fields when loading `providers.json`
2. **Other code trusts the data** — Once validated at load time, downstream code does not re-validate
3. **No `.strict()` on local schemas** — Route-specific schemas may define subsets but must use `.passthrough()` or default mode (not `.strict()`) to allow extra fields

**Files to remove after consolidation:**

These duplicate schemas should be removed or converted to imports:

| File | Action |
|------|--------|
| `frontend/src/data/schemas.ts` (ProviderSchema) | REMOVE provider schema, keep other schemas |
| `frontend/src/lib/schemas.ts` (ProviderSchema) | REMOVE entire file or remove provider schema |
| `frontend/src/lib/schemas/providers.ts` | REMOVE — superseded by `data/providers/providers.schema.ts` |
| `frontend/src/types/schemas.ts` (ProviderSchema) | REMOVE provider schema, keep other schemas |
| `frontend/src/lib/providers/api.ts` (local schema) | REPLACE with import from canonical schema |
| `frontend/src/app/go/[providerId]/route.ts` (local schema) | Keep subset schema, ensure no `.strict()` |

### Capability flags

`frontend/src/data/providers/index.ts` loads `providers.capabilities.json` and exposes resolved capability flags per provider:

- `supportsNegative`
- `supportsPrefill`
- `supportsSeed`
- `supportsSteps`

These flags inform the prompt builder UX and any future integrations.

### Prompt builder data sources

The prompt builder system uses two additional SSOT JSON files:

**Prompt options:**
- Location: `frontend/src/data/providers/prompt-options.json`
- Schema: `frontend/src/types/prompt-builder.ts` (PromptOptions interface)
- Content: 11 categories × 30 curated options = 330 total options

**Platform formats:**
- Location: `frontend/src/data/providers/platform-formats.json`
- Schema: `frontend/src/types/prompt-builder.ts` (PlatformFormats interface)
- Content: Assembly rules for 42 platforms across 7 families

**Assembly logic:**
- Location: `frontend/src/lib/prompt-builder.ts`
- Exports: `assemblePrompt()`, `formatPromptForCopy()`, `getCategoryConfig()`

**Type definitions:**
- Location: `frontend/src/types/prompt-builder.ts`
- Key types: `PromptCategory`, `PlatformFormat`, `AssembledPrompt`

For full prompt builder architecture, see: **prompt-builder-page.md**

## Community Voting System (Added Jan 2, 2026)

### Overview

The community voting system allows users to influence the Image Quality ranking through thumbs-up votes. This creates a community-driven signal that blends with editorial rankings over time.

### Core Mechanics

| Feature | Implementation |
|---------|----------------|
| Vote button location | Image Quality column, right of rank display |
| Daily limit | 3 providers max per user |
| Per-provider limit | 1 vote per provider per 24 hours |
| Reset timing | Rolling 24h from vote timestamp |
| Animation | Thumb bounce (400ms) on successful vote |
| Voted state | Filled thumb icon |
| Authentication | Required to vote |
| Session persistence | Yes, via localStorage |

### Vote Weighting

| Signal Type | Base Weight | Paid Weight (1.5×) |
|-------------|-------------|-------------------|
| Image upload tagged to platform | 1 | 1.5 |
| Like on image | 2 | 3 |
| Favorable comment | 2 | 3 |
| Direct provider card like | 3 | 4.5 |

**Note:** Paid users receive a 1.5× multiplier on all vote weights. This is applied server-side and not disclosed in the UI.

### Ranking Algorithm

**Bayesian Average with Time Decay**

Prevents gaming through:
- Low sample size (new provider with 2 votes won't beat one with 500)
- Recency bias (old votes decay ~50% after 70 days)

Formula:
```
score = (v / (v + m)) × R + (m / (v + m)) × C

Where:
  v = total votes for provider
  m = minimum votes threshold (25)
  R = provider's raw average
  C = global average across all providers
```

### Image Quality Score Blending

Community votes gradually influence the Image Quality criterion as vote volume increases:

| Vote Count | Seed Weight | Community Weight |
|------------|-------------|------------------|
| 0-24 votes | 100% | 0% |
| 25-49 votes | 75% | 25% |
| 50-99 votes | 50% | 50% |
| 100+ votes | 30% | 70% |

**Important:** Community votes affect ONLY the Image Quality criterion (10% of overall 0-100 score). The other 6 criteria (Adoption, Speed, Cost, Trust, Automation, Ethics) remain 90% of the total score. Maximum community influence: ±10 points on the 100-point scale.

### Seed Data (Initial Rankings)

Providers are seeded using Artificial Analysis ELO scores where available:

| Provider | Seed ELO |
|----------|----------|
| Flux (Black Forest Labs) | 1143 |
| Ideogram v2 | 1102 |
| Midjourney | 1093 |
| Stability AI SD3 | 1084 |
| OpenAI DALL·E 3 | 984 |

Providers without external benchmarks are assigned manual tiers:
- **Top-tier:** Adobe Firefly, Runway ML
- **Mid-tier:** Canva, Lexica, OpenArt, NightCafe, Jasper Art, Freepik
- **Entry-tier:** Craiyon, DeepAI, Hotpot
- **Specialized:** NovelAI (anime), Remove.bg (utility), Clipdrop (editing)

### Implementation Files

| File | Purpose |
|------|---------|
| `src/components/providers/image-quality-vote-button.tsx` | Animated thumbs-up button |
| `src/components/providers/providers-table.tsx` | Table with vote integration |
| `src/hooks/use-image-quality-vote.ts` | Vote state management hook |
| `src/lib/vote-storage.ts` | localStorage vote tracking |
| `src/app/api/providers/vote/route.ts` | Vote API endpoint |

### Visual States

| State | Appearance |
|-------|------------|
| Not voted, can vote | Outline thumb, highlights on hover |
| Already voted | Filled emerald thumb |
| Daily limit reached | Outline thumb, dimmed, no interaction |
| Animating | Bounce + fill transition (400ms) |
| Not authenticated | Outline thumb, dimmed, no interaction |

### Anti-Gaming Measures

1. **Authentication required** — Anonymous votes not accepted
2. **Paid multiplier** — Makes bot farming expensive
3. **3 votes/day limit** — Prevents spam
4. **Rolling 24h window** — Prevents midnight gaming
5. **Bayesian formula** — Skeptical of low-sample providers
6. **Time decay** — Reduces impact of old coordinated attacks
7. **Silent enforcement** — No counters or limits shown to users

### CSS Classes

```css
/* Base vote thumb button */
.vote-thumb { ... }
.vote-thumb--voted { color: emerald-400 }
.vote-thumb--disabled { opacity: 0.4, no interaction }
.vote-thumb--animating { bounce animation 400ms }

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .vote-thumb--animating { animation: none }
}
```

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
- **API/Affiliate** = emoji indicators (🔌 = API, 🤝 = Affiliate).
- **Overall Score** = 0–100 composite score with trend indicator (↑/↓/●).

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

| Element | Destination | Opens In |
|---------|-------------|----------|
| Provider name | `/go/{id}?src=leaderboard_homepage` → provider website | New tab |
| Provider icon | `/go/{id}?src=leaderboard_homepage` → provider website | New tab |
| 🎨 Prompt builder | `/providers/{id}/prompt-builder` | Same tab |

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

## Testing and lock-in proofs

### Provider catalogue shape tests

- `frontend/src/data/providers/tests/providers.catalog.shape.test.ts`

Guards list length, required fields, types, and uniqueness.

### Provider schema tests

- `frontend/src/__tests__/providers.schema.test.ts`

### Provider detail tests

- `frontend/src/components/providers/__tests__/provider-detail.smoke.test.tsx`

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

## Changelog

- **8 Jan 2026:** Added `hqCity` field documentation for Market Pulse v2.1 city connections. Documented city normalization (aliases), provider city mapping, and connection API functions.
- **2 Jan 2026:** Added Community Voting System section. Updated Provider type with `ProviderRanking` fields. Documented vote button in Image Quality column. Added vote API endpoint. Updated event taxonomy with `vote` type. Updated score calculation weights (Image Quality reduced from 25% to 10% to accommodate community influence cap).
- **1 Jan 2026:** Provider Cell redesign: replaced 🏠 emoji with local PNG icons, provider name now hyperlinked to homepage, three-line layout.
- **30 Dec 2025:** Leaderboard redesign: 42 providers (16 countries), new column structure.
- **28 Dec 2025:** Added schema consolidation rules, marked gaps 2 and 3 as RESOLVED.
- **22 Dec 2025:** Initial version with leaderboard column contract, event taxonomy.

## Non-regression rule (Promagen discipline)

When adding features to AI Providers:

- Maintain existing UI layout, colours, and current behaviour unless explicitly changing a specific feature.
- Include lock‑in proof (test or explicit before/after behaviour note).
- Always state: **Existing features preserved: Yes/No** (Yes is the default expectation).
