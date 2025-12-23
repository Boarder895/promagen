# AI Providers

**Last updated:** 22 December 2025  
**Owner:** Promagen  
**Existing features preserved:** Yes

## Purpose

This document describes Promagen’s **AI Providers catalogue**, how providers are displayed (Leaderboard + Detail + Prompt Builder), and how provider capabilities and prompts are mapped.

For affiliate/referral outbound linking, see: **AI Providers Affiliate & Links.md**.

## Canonical data sources (single source of truth)

### Provider catalogue

- `frontend/src/data/providers/providers.json`
- `frontend/src/data/providers/index.ts`

The catalogue is the authoritative list of providers (currently guarded as the “canonical 20”).

### Capability flags

`frontend/src/data/providers/index.ts` loads `providers.capabilities.json` and exposes resolved capability flags per provider:

- `supportsNegative`
- `supportsPrefill`
- `supportsSeed`
- `supportsSteps`

These flags inform the prompt builder UX and any future integrations.

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
- `supportsPrefill: boolean` — Whether Promagen can prefill prompts (deep-link or structured transfer).

### Leaderboard enrichment fields (to add)

These exist to make the leaderboard table **high-signal and not boring**. Keep all existing fields; add these:

- `icon: string` — Path to the provider’s **official icon** (favicon/brand mark), stored locally (do not hot-link). Designed to be readable on a dark UI.
- `sweetSpot: string` — Up to 2 short lines: what the platform is best at (human-readable; UI clamps to 2 lines).
- `visualStyles: string` — Up to 2 short lines: what it excels at visually (no tag soup; UI clamps to 2 lines).
- `generationSpeed: fast | medium | slow | varies` — Canonical 4-step scale (varies = busy hours).
- `affordability: string` — 1 line: free tier + rough image allowance + price band (e.g. “Free tier: yes (~25/day); ££”).
- `apiAvailable: boolean` — Whether the provider offers an official API.
- `affiliateProgramme: boolean` — Whether the provider runs an affiliate programme (this is **not** the same as Promagen having an `affiliateUrl` configured).

Notes:

- `Promagen Users` (country flags + counts) is **analytics-derived**, not stored in `providers.json`.
- Outbound routing rules remain unchanged: UI never links directly to external URLs (all outbound goes via `/go/{id}`).

## Core routes and pages

### Leaderboard

- `frontend/src/app/providers/leaderboard/page.tsx` — renders the leaderboard using `getProviders()` and `ProvidersTable`.
- `frontend/src/app/providers/page.tsx` — currently the same leaderboard surface.
- `frontend/src/app/leaderboard/page.tsx` — redirects to `/providers/leaderboard`.

### Provider detail

- `frontend/src/app/providers/[id]/page.tsx` — shows provider detail and links to the prompt builder.

#### Leaderboard table column contract (UI, non-negotiable)

Column order (left → right):

Provider | Promagen Users | Sweet Spot | Visual Styles | API & Affiliate Programme | Generation Speed | Affordability | Score

Rules:

- **Score column is always the far right.**
- **Rank is not a dedicated column** (if shown at all, render it as a muted prefix inside the Provider cell, e.g. “1.”).
- **Trend is not a dedicated column** (trend renders as a small indicator inside the Score cell).
- **Tags column is removed** (information density comes from Sweet Spot + Visual Styles instead).

Column definitions:

- **Provider** = Provider name with an optional **tiny official icon** (the same icon you see online), aligned left.
  - Icon guidance: small (e.g. ~16–18px), square, crisp on dark backgrounds, and stored locally (avoid hot-linking for reliability/privacy).
- **Promagen Users** = top up to 6 country flags + counts for Promagen usage on that provider; rendered in a 2·2·2 layout; show nothing if zero; overflow becomes “... +n”.
- **Sweet Spot** = what the platform is good at (max 2 lines; UI clamps to 2 lines).
- **Visual Styles** = what it excels at visually (max 2 lines; UI clamps to 2 lines).
- **API & Affiliate Programme** = emoji indicators:
  - 🔌 = API available
  - 🤝 = Affiliate programme available
  - 🔌🤝 = Both
  - blank = Unknown / not set
- **Generation Speed** = Fast / Medium / Slow / Varies (busy hours).
- **Affordability** = free tier + rough “how many images” + price band (keep it short and scannable).
- **Score** = 0–100 (ranked highest first). Include a small trend indicator inline:
  - up / down / flat (presentation may be an arrow, sparkline, or subtle glyph, but it must not become its own column).

Score rubric (7 criteria, so the number is defendable):

1. Output quality (overall look)
2. Prompt obedience (follows instructions)
3. Text-in-image (posters/logos/labels)
4. Editing power (inpaint/outpaint/img2img)
5. Control (seed/negative/guidance options)
6. Speed reliability (consistent under load)
7. Value (free tier + price vs results)

### Prompt builder per provider

- `frontend/src/app/providers/[id]/prompt-builder/page.tsx` — creates an “ideal text-to-image prompt”.

## Core UI components

### Providers table

- `frontend/src/components/providers/providers-table.tsx`

**Current behaviour:** outbound provider links are routed through `/go/{id}?src=leaderboard` (no direct external URLs in the UI). The catalogue uses `website` as the canonical field; the data layer normalises `url := website` for backwards compatibility.

Recommended behaviour (documented):

- Leaderboard outbound clicks go through `/go/{id}` (see affiliate doc).
- Provider Detail outbound CTAs go through `/go/{id}?src=provider_detail`.

### Provider detail card

- `frontend/src/components/providers/provider-detail.tsx`

**Current behaviour:** it resolves the “Official site” URL from `provider.website` (treating `provider.url` as a legacy alias only) and routes outbound CTAs through `/go/{id}?src=provider_detail` (no direct external URLs in the UI).

### Outbound button component

- `frontend/src/components/providers/copy-open-button.tsx`

Recommended behaviour:

- Outbound opens should use `/go/{id}` not a direct third-party URL.
- AffiliateBadge should be conditional on `requiresDisclosure`.

### Affiliate badge

- `frontend/src/components/common/affiliate-badge.tsx`

## Provider APIs

### Providers list API

- `frontend/src/app/api/providers/route.ts`

Returns providers by loading `@/data/providers` with a runtime-safe import helper.

### Provider resolve API

- `frontend/src/app/api/providers/resolve/route.ts`

### Bulk leaderboard API proxy

- `frontend/src/app/api/providers/leaderboard/bulk/route.ts`

## Prompt building architecture

Promagen includes a provider-specific prompt mapping layer:

- `frontend/src/lib/providers/config.ts` — defines `ProviderId` union and `PROVIDER_BUILDERS` mapping `PromptInputs` → `BuiltPrompt`.
- `frontend/src/lib/providers/deeplinks.ts` — deep-link builder; default passthrough, special mappings can be added per provider id.

These layers allow Promagen to produce prompts that fit each platform’s UX (e.g. Midjourney flags, Stability positive/negative formats) while keeping the UI consistent.

## Testing and lock-in proofs

### Provider catalogue shape tests

- `frontend/src/data/providers/tests/providers.catalog.shape.test.ts`

Guards list length, required fields, types, and uniqueness.

### Provider schema tests

- `frontend/src/__tests__/providers.schema.test.ts`

**Current gap:** the Zod schema used by `frontend/src/data/schemas.ts` is permissive and does not include the real provider fields (`website`, `affiliateUrl`, etc.). Shape tests catch this, but schema tests are not truly “exact”.

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

   - If the canonical list size changes from 20, update the shape test intentionally.
   - Update any UI expectations (rows, titles, etc.).

6. Ensure affiliate links do not affect scoring
   - Provider score/rank must be independent of monetisation fields.

## Known gaps and “missing stuff” (to fix deliberately)

### 1) Canonical URL field: `website` (legacy alias: `url`)

- Catalogue uses `website` as canonical.
- `url` is treated as a legacy alias only for backwards compatibility (do not add it to new provider records).
- UI components should resolve `officialUrl := provider.website ?? provider.url` (fallback only) and route outbound via `/go/{id}?src=...`.

Resolution strategy:

- Keep `website` as the single source of truth in `providers.json`.
- Optionally remove `url` later via an intentional breaking change + lock-in tests.

### 2) Canonical Provider type import

- Use `@/types/provider` as the single canonical import for the `Provider` type across UI and routes.

Resolution strategy:

- Keep a single entry-point type file (it may re-export from `providers.ts` if needed).
- Avoid parallel type files that drift.

### 3) Duplicated schemas for providers

Provider schemas exist in multiple places with different shapes:

- `frontend/src/data/schemas.ts` (minimal/permissive)
- `frontend/src/lib/schemas/providers.ts` (strict, matches providers.json fields)
- `frontend/src/lib/providers/schema.ts` (another provider schema shape)

Resolution strategy:

- Pick one schema as authority for validating `providers.json` and import it consistently.

### 4) Affiliate configuration duplication

Affiliate-related data exists in both:

- `providers.json` (`affiliateUrl`, `requiresDisclosure`)
- `frontend/src/lib/affiliates.ts` (parallel map)

Resolution strategy:

- Make `providers.json` the single source of truth.
- Remove or auto-generate the `AFFILIATES` map, or replace it with selectors that read the catalogue.

### 5) Consent model inconsistency (cookie vs localStorage)

- `frontend/src/hooks/use-consent.ts` reads localStorage key `promagen.consent.v1`
- `frontend/src/app/api/consent/route.ts` reads cookie `promagen_consent`

Resolution strategy:

- Choose one consent source of truth and apply it consistently.
- Gate analytics injection behind consent, if used.

### 6) GA4 injection appears unconditional

`frontend/src/components/analytics/google-analytics.tsx` injects GA script without checking consent and includes a default measurement ID fallback.

Resolution strategy:

- Remove default measurement ID fallback.
- Only load GA when consent is granted.

## Non-regression rule (Promagen discipline)

When adding features to AI Providers:

- Maintain existing UI layout, colours, and current behaviour unless explicitly changing a specific feature.
- Include lock‑in proof (test or explicit before/after behaviour note).
- Always state: **Existing features preserved: Yes/No** (Yes is the default expectation).
