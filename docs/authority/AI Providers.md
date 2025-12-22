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

## Provider catalogue fields (current)

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

## Core routes and pages

### Leaderboard

- `frontend/src/app/providers/leaderboard/page.tsx` — renders the leaderboard using `getProviders()` and `ProvidersTable`.
- `frontend/src/app/providers/page.tsx` — currently the same leaderboard surface.
- `frontend/src/app/leaderboard/page.tsx` — redirects to `/providers/leaderboard`.

### Provider detail

- `frontend/src/app/providers/[id]/page.tsx` — shows provider detail and links to the prompt builder.

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
