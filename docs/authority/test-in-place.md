# Promagen — Test Inventory (In Place)

**Generated:** 28 February 2026
**Source of truth:** `src.zip` + `pnpm run test:ci` output
**Status:** 108 suites, 1,427 passing, 3 skipped, 0 failing
**Runner:** Jest 29.7.0 via `jest.config.cjs` (8 named projects)

---

## 1. Summary Dashboard

| Metric               | Value                                                                               |
| -------------------- | ----------------------------------------------------------------------------------- |
| Test files           | 108                                                                                 |
| Test cases (passing) | 1,427                                                                               |
| Skipped tests        | 3                                                                                   |
| Failed tests         | 0                                                                                   |
| Jest projects        | 8 (`data`, `learning`, `intelligence`, `hooks`, `components`, `api`, `util`, `app`) |
| Lint errors          | 0 (after Round 14 fix)                                                              |
| TypeScript errors    | 0                                                                                   |
| Snapshot files       | 8                                                                                   |
| CI wall-clock time   | ~19 s                                                                               |

---

## 2. Jest Project Overview

| #   | Project        | Env   | Files   | Cases      | Est. Time | Script                       |
| --- | -------------- | ----- | ------- | ---------- | --------- | ---------------------------- |
| 1   | `data`         | node  | 31      | ~340       | ~4 s      | `pnpm run test:data`         |
| 2   | `learning`     | node  | 24      | ~530       | ~5 s      | `pnpm run test:learning`     |
| 3   | `intelligence` | node  | 6       | ~170       | ~3 s      | `pnpm run test:intelligence` |
| 4   | `hooks`        | jsdom | 9       | ~107       | ~3 s      | `pnpm run test:hooks`        |
| 5   | `components`   | jsdom | 12      | ~100       | ~2 s      | `pnpm run test:components`   |
| 6   | `api`          | node  | 6       | ~18        | ~1 s      | `pnpm run test:api`          |
| 7   | `util`         | node  | 12      | ~44        | ~1 s      | `pnpm run test:util`         |
| 8   | `app`          | jsdom | 6       | ~118       | ~2 s      | `pnpm run test:app`          |
|     | **TOTAL**      |       | **108** | **~1,427** | **~19 s** | `pnpm run test:ci`           |

---

## 3. Full File Inventory by Project

### 3.1 — `data` (31 files, ~340 cases)

Data integrity, schema validation, JSON shape checks. All node environment, zero DOM.

| File                                                                   | Cases      | What It Validates                                                                                                                                                                  |
| ---------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/data/commodities/tests/commodities.catalog.schema.test.ts`        | 1          | Commodity catalog matches Zod schema, unique IDs                                                                                                                                   |
| `src/data/commodities/tests/country-commodities.ids-coverage.test.ts`  | 3          | Energy/agriculture/metals columns reference valid commodity IDs                                                                                                                    |
| `src/data/commodities/tests/exchange-commodities.map.schema.test.ts`   | 3          | Commodity-exchange map schema, row count, known exchange IDs                                                                                                                       |
| `src/data/commodities/tests/exchanges-country-coverage.test.ts`        | 1          | Every exchange country has a matching country-commodities row                                                                                                                      |
| `src/data/emoji/__tests__/budget-indicator.integrity.test.ts`          | 1          | Budget guard emoji mapping returns SSOT emoji for ok/warning/blocked                                                                                                               |
| `src/data/emoji/__tests__/emoji.helpers.test.ts`                       | 8          | getEmoji, getTrendEmoji, getProviderEmoji — known IDs, nulls, fallbacks                                                                                                            |
| `src/data/emoji/tests/emoji-bank.shape.test.ts`                        | 1          | emoji-bank.json matches schema, no duplicate IDs                                                                                                                                   |
| `src/data/exchanges/tests/exchanges.catalog.shape.test.ts`             | 12         | Catalog field types, kebab-case IDs, IANA timezones, geo bounds, unique IDs                                                                                                        |
| `src/data/exchanges/tests/exchanges.index.test.ts`                     | 5          | Homepage east-west ordering, rail split logic, splitIds helper                                                                                                                     |
| `src/data/exchanges/tests/exchanges.selected.shape.test.ts`            | 4          | Selected IDs array, no duplicates, all exist in catalog                                                                                                                            |
| `src/data/fx/tests/fx-ssot.test.ts`                                    | 2          | fx-pairs.json unique IDs, fx.selected references valid ones                                                                                                                        |
| `src/data/prompt-intelligence/tests/data-integrity.test.ts`            | 16         | Semantic tags coverage, families, conflicts, market moods, platform hints, categories, versions                                                                                    |
| `src/data/prompt-intelligence/tests/prompt-intelligence.shape.test.ts` | 25         | Shape of families.json, conflicts.json, market-moods.json, platform-hints.json, semantic-tags.json, cross-file references                                                          |
| `src/data/providers/__tests__/providers.helpers.test.ts`               | 6          | getProviderById, PROVIDERS_BY_ID, getProviderCapabilities, DEFAULT_CAPABILITIES                                                                                                    |
| `src/data/providers/tests/providers.capabilities.shape.test.ts`        | 7 (1 skip) | \_defaults shape, override flags, catalog match, DEFAULT_CAPABILITIES, PROVIDER_CAPABILITIES                                                                                       |
| `src/data/providers/tests/providers.catalog.shape.test.ts`             | 5 (1 skip) | 42 providers, required fields, unique IDs, sensible scores                                                                                                                         |
| `src/data/providers/tests/providers.hints-presets.shape.test.ts`       | 3 (1 skip) | pasteHints shape, PRESETS array, preset provider IDs reference real providers                                                                                                      |
| `src/data/tests/catalogs.shape.test.ts`                                | 3          | Basic load check for exchanges, countries, providers arrays                                                                                                                        |
| `src/data/tests/commodities.display-country-codes.contract.test.ts`    | 1          | Display country codes reference valid ISO codes from countries.catalog.json                                                                                                        |
| `src/data/tests/cosmic.shape.test.ts`                                  | 1          | Cosmic events shape validation                                                                                                                                                     |
| `src/data/tests/data-contracts.snapshot.test.ts`                       | 8          | Snapshot contracts for fx-pairs.json, exchanges.catalog.json, providers.json, getDefaultFxPairsWithIndexForTier()                                                                  |
| `src/__tests__/cascading-intelligence.integrity.test.ts`               | 20         | Phase 1 semantic tags, clusters, affinities, score differentiation, tier multipliers, buildContext integration                                                                     |
| `src/__tests__/country-currency.integrity.test.ts`                     | 2          | ISO2→ISO3 currency map, 3-letter codes                                                                                                                                             |
| `src/__tests__/currency.integrity.test.ts`                             | 2          | Currency catalog validation                                                                                                                                                        |
| `src/__tests__/fx-pairs.test.ts`                                       | 2          | fx-pairs.json existence and well-formed pairs                                                                                                                                      |
| `src/__tests__/providers.schema.test.ts`                               | 3          | providers.json strict Zod schema match, unique IDs                                                                                                                                 |
| `src/__tests__/roman-numerals.integrity.test.ts`                       | 3          | Roman numeral rendering 1-12, edge cases                                                                                                                                           |
| `src/__tests__/scene-starters.integrity.test.ts`                       | 15         | Prefill values in vocabulary, kebab-case IDs, tier guidance, tags, description lengths, orphan checks                                                                              |
| `src/__tests__/schemas.test.ts`                                        | 3          | Providers validation, bad exchange rejection, pair demo block                                                                                                                      |
| `src/__tests__/schemas.catalogs.test.ts`                               | 3          | Catalog shape smoke: exchanges, countries, providers                                                                                                                               |
| `src/__tests__/vocab-submission.integrity.test.ts`                     | 52         | Phase 7.7 vocab pipeline: profanity filter, spam patterns, length guards, clean terms, false positive resistance, normaliseTerm, category suggester, confidence scoring, constants |
| `src/__tests__/vocabulary-merge.integrity.test.ts`                     | 10         | Phase 0.6 merge: no empty strings, no internal duplicates, no cross-category overlap, no finance jargon, core-first ordering                                                       |
| `src/components/providers/__tests__/phase-4-evolution.test.ts`         | 63         | Phase 4 scenes (200 total), worlds, tier guidance, flavour phrases, vocabulary merge, tier badges, cascade scoring, analytics events                                               |

**Skipped tests (3):**

1. `providers.capabilities.shape.test.ts` — "applies non-empty overrides on top of defaults when present"
2. `providers.catalog.shape.test.ts` — "enforces allowed values for any future group/tier fields"
3. `providers.hints-presets.shape.test.ts` — "optionally ensures coverage: most providers have at least one preset"

---

### 3.2 — `learning` (24 files, ~530 cases)

ML scoring engine — weight recalibration, A/B testing, term quality, redundancy, combo mining, confidence multipliers. All node, pure computation.

| File                                    | Cases | What It Validates                                                                                                                                                                                                                                                                   |
| --------------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ab-assignment.test.ts`                 | 12    | fnv1aHash consistency/distribution, assignVariant determinism, splitPct, chi-squared uniformity                                                                                                                                                                                     |
| `ab-testing.test.ts`                    | 74    | normalCDF, shouldCreateTest, twoProportionZTest, evaluateTest (promote/rollback/extend), createABTest, O'Brien-Fleming alpha, sample size, days remaining, beta credible interval, Bayesian probability, lift distribution, adaptive peek scheduling                                |
| `aggregate-phase6.test.ts`              | 20    | Feature flag gating, Phase 6 execution, persistence, non-fatal failure handling, response shape, storage key constants                                                                                                                                                              |
| `anti-pattern-detection.test.ts`        | 16    | Empty/high/low outcome events, toxic pair detection, enrichment thresholds, tier grouping, global aggregation, sorting, confidence multiplier, output shape                                                                                                                         |
| `category-value-discovery.test.ts`      | 18    | Cold start, high-value categories, irrelevant categories, no negative penalisation, per-tier independence, category discovery, minimum events guard, constants                                                                                                                      |
| `collision-matrix.test.ts`              | 14    | Empty events, collision detection, solo/pair events thresholds, weaker term identification, tier grouping, global, competition score, output shape                                                                                                                                  |
| `combo-integration.test.ts`             | 16    | Full pipeline trio detection, zero boost for non-combos, tier independence, null lookup backward compat, lookupComboInfo, completeness, tier fallback, buildComboLookup                                                                                                             |
| `combo-lookup.test.ts`                  | 28    | buildComboLookup (null/undefined/empty/tier/global), lookupComboBoost (null/empty/complete/partial/far/not-in-combo), lookupComboInfo, tier fallback, quads, best match, edge cases                                                                                                 |
| `confidence-multiplier.test.ts`         | 49    | Empty/null/undefined input, tier multipliers (free/paid), age brackets (new/settling/experienced/veteran), depth brackets (shallow/normal/deep), best/worst case, iteration signals (final attempt/mid-session), clamping, detailed breakdown, constants                            |
| `iteration-integration.test.ts`         | 16    | Weak term lookup, zero/null fallback, replacement suggestions, tier-first fallback, final attempt identification, multi-attempt sessions, confidence multiplier with iteration data, full round-trip                                                                                |
| `iteration-tracking.test.ts`            | 25    | Null/empty input, single-attempt sessions, category addition, fix order tracking, term replacement, retained terms, score jumps, threshold checks, tiers, global aggregation, session splitting, metadata, multiAttemptPercent, identifyFinalAttempts, identifyMultiAttemptSessions |
| `magic-combo-mining.test.ts`            | 20    | Basic trio/quad detection, Apriori pruning, synergy calculation, support counting, tier handling, sorting, categories, alphabetical terms, output metadata, edge cases                                                                                                              |
| `negative-pattern-integration.test.ts`  | 16    | Anti-pattern lookup (severity, clean pairs, null data, tier fallback), collision lookup (score, non-colliding, null), suggestion engine penalty verification, conflict detection with learned data, full round-trip                                                                 |
| `outcome-score.test.ts`                 | 28    | computeOutcomeScore (all signal combinations, clamping, raw DB shape), computeOutcomeScoreDetailed (breakdown, signal contributions), OUTCOME_SIGNAL_WEIGHTS (hierarchy verification)                                                                                               |
| `platform-co-occurrence.test.ts`        | 22    | Guard rails, single platform pairs, normalisation, alphabetical sorting, multi-platform independence, cross-tier isolation, confidence/graduation, stale decay, pair caps/filtering, metadata                                                                                       |
| `platform-co-occurrence-lookup.test.ts` | 17    | buildPlatformCoOccurrenceLookup (null/undefined/valid/multi-platform), lookupPlatformCoOccurrence (fallback/confidence blending/pair matching/multi-platform)                                                                                                                       |
| `platform-term-quality.test.ts`         | 27    | Guard rails, single platform scoring, good vs bad terms, multi-platform independence, cross-tier isolation, confidence calculation, graduation, stale decay, term filtering/caps, trend calculation, metadata                                                                       |
| `platform-term-quality-lookup.test.ts`  | 17    | buildPlatformTermQualityLookup (null/undefined/valid/multi-platform), lookupPlatformTermQuality (fallback/confidence blending/casing/multi-platform)                                                                                                                                |
| `redundancy-detection.test.ts`          | 20    | Null input, threshold checks (exclusivity, similarity, co-occurrence, category), union-find transitivity, group size caps, canonical selection, tier grouping, global, sorting/trimming, output shape                                                                               |
| `redundancy-integration.test.ts`        | 16    | Full pipeline penalty, zero for non-redundant, different categories, null lookup backward compat, lookupRedundancyInfo, tier fallback, buildRedundancyLookup, edge cases                                                                                                            |
| `scorer-health.test.ts`                 | 25    | Empty data, critical alerts, version metadata, correlation computation, per-tier correlations, trend calculation, weight drift, alert levels (critical/warning/info), history management, capping, constants                                                                        |
| `term-quality-scoring.test.ts`          | 22    | Cold start, high/low quality terms, minimum events guard, score scale 0-100, term normalisation, trend calculation, per-tier independence, max terms guard, constants                                                                                                               |
| `threshold-discovery.test.ts`           | 22    | Cold start defaults, buildBuckets, findElbow (linear/plateau/empty/sparse), smoothThreshold (first run/smoothing/clamping), per-tier with insufficient data, constants                                                                                                              |
| `weight-recalibration.test.ts`          | 40    | pearsonCorrelation (empty/zero-variance/perfect/moderate), normaliseToWeights (sum/floor/absolute values), smoothWeights (first run/formula/new factors), computeScoringWeights cold start/warm start/tier fallback/smoothing, STATIC_DEFAULTS, constants                           |

---

### 3.3 — `intelligence` (6 files, ~170 cases)

Prompt scoring engines — suggestion, conflict detection, market mood, platform optimisation. Node environment.

| File                                            | Cases | What It Validates                                                                                                                                                                                                                                                                                                  |
| ----------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `engines/__tests__/integration-scoring.test.ts` | 17    | calculateHealthScore static fallback, learned weights, per-tier scoring, negative terms, analyzePrompt backward compatibility (3 signatures)                                                                                                                                                                       |
| `engines/tests/conflict-detection.test.ts`      | 23    | Empty/single/compatible selections, era conflicts, defined conflicts, soft vs hard, categories, suggestions, custom values, deduplication, severity sorting, mood conflicts, performance                                                                                                                           |
| `engines/tests/integration.test.ts`             | 34    | analyzePrompt (health score, conflicts, DNA, dominant family, suggestions, platform formatting, summary, market suggestions), quickConflictCheck, getOrderedOptions, getTopSuggestions, formatAndTrim, getMarketMoodUI, previewTermAddition                                                                        |
| `engines/tests/market-mood-engine.test.ts`      | 31    | detectMarketState (neutral/volatility/opening/closing/USD/gold/crypto), applyMarketMoodBoosts, getMarketMoodSuggestions, shouldShowMarketMood, getMarketMoodTheme, getMarketMoodIcon, performance                                                                                                                  |
| `engines/tests/platform-optimization.test.ts`   | 37    | formatPromptForPlatform (basic/subject/negatives/limits/hints/empty/unknown), smartTrimPrompt, getCategoryOrder, getTrimPriority, getPlatformCharLimit, platformSupportsWeights, platformUsesSeparateNegative, formatWithWeight, getPlatformRecommendations, estimateTokenCount, formatCompletePrompt, performance |
| `engines/tests/suggestion-engine.test.ts`       | 28    | buildContext (empty/keywords/family/mood/era/market), scoreOptions (all/sorted/breakdown/compatible/conflicting), reorderByRelevance, getSuggestions (grouped/maxPerCategory/minScore/category filter/excludes/reasons/market-boosted), getSuggestionsForCategory, getAutoCompleteSuggestions, performance         |

---

### 3.4 — `hooks` (9 files, ~107 cases)

React hooks — all require jsdom for `renderHook()`.

| File                                                                 | Cases | What It Validates                                                                                                                                                                                          |
| -------------------------------------------------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hooks/__tests__/use-ab-test.test.ts`                                | 9     | Initial loading state, fetch assignment (variant B data), null weights for control, no test running, abHash query param, error handling, non-ok responses, caching, refetch                                |
| `hooks/__tests__/use-learning-data.test.ts`                          | 10    | Tier-level fields, platform-level fields, AB testing fields, isLoading composition, abIsLoading independence, error surfacing (tier/platform/AB priority), refetch calls all sub-hooks                     |
| `hooks/__tests__/use-platform-learning.test.ts`                      | 10    | Loading state, null lookups, valid data builds lookups, parallel fetch, refetch, error handling (total/partial failure), dataAge/lastUpdatedAt, return type contract                                       |
| `hooks/__tests__/use-sync-computation.test.ts`                       | 6     | First render computed value, recompute on dep change, refresh() forces recompute, stable deps no recompute, stable refresh reference, object/array dep serialisation                                       |
| `hooks/prompt-intelligence/__tests__/use-conflict-detection.test.ts` | 16    | Empty selections, hard conflicts, compatible selections, conflict counting, forCategory/forTerm, wouldConflict, enabled/includeSoftConflicts options, redetect, selection change reactivity                |
| `hooks/prompt-intelligence/__tests__/use-market-mood.test.ts`        | 17    | Null state, refresh function, state detection, isActive, description, theme/icon, suggestions, enabled/maxSuggestions/refreshInterval options, refresh, data change reactivity, data clearing              |
| `hooks/prompt-intelligence/__tests__/use-prompt-analysis.test.ts`    | 11    | Null initial analysis, default values, reanalyze function, debounce delay, health score, conflict detection, fill percent, enabled option, custom debounce, force reanalyze, selection change reactivity   |
| `hooks/prompt-intelligence/__tests__/use-smart-reorder.test.ts`      | 15    | Ordered options, helper functions, recommended array, scoring, getScore, isRecommended, enabled/recommendedThreshold options, reorder, selection/options change reactivity, empty options                  |
| `hooks/prompt-intelligence/__tests__/use-smart-suggestions.test.ts`  | 13    | Empty selections, helper functions, suggestion generation, category organisation, required properties, forCategory, maxPerCategory/maxTotal/minScore/enabled options, refresh, selection change reactivity |

---

### 3.5 — `components` (12 files, ~100 cases)

React component rendering — jsdom environment. Note: `phase-4-evolution.test.ts` lives under `components/` but runs in `data` project.

| File                                                    | Cases | What It Validates                                                                                                                                                                                                                                                              |
| ------------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `exchanges/__tests__/exchange-card.test.tsx`            | 15    | Renders name/city, data-testid, data-exchange-id, clock aria-label, market status, temperature (with/without weather), weather emoji, accessible group, custom className, missing city/timezone                                                                                |
| `exchanges/__tests__/exchange-clock.test.tsx`           | 9     | Initial time render, default/custom aria-label, custom className, datetime attribute, aria-live="off", interval updates, interval cleanup, timezone change reset                                                                                                               |
| `nav/__tests__/tab-list.active.test.tsx`                | 1     | Active tab reflects current route                                                                                                                                                                                                                                              |
| `nav/__tests__/tab-list.order.test.tsx`                 | 1     | Tab order follows JSON config                                                                                                                                                                                                                                                  |
| `pro-promagen/__tests__/exchange-picker.test.tsx`       | 35    | Smoke (renders/pre-selected/continent headers), defensive guards (empty/null/undefined/invalid), selection (onChange/deselect/max limit/min validation/reset), search (filter/clear), disabled state, accessibility (labels/aria-expanded/auto-expand continents/aria-pressed) |
| `providers/__tests__/launch-panel.smoke.test.tsx`       | 7     | Launch button with provider name, tagline, affiliate badge (show/hide), custom src parameter, accessible section label, workflow hint text                                                                                                                                     |
| `providers/__tests__/prompt-builder.analytics.test.tsx` | 1     | Emits prompt_builder_open event on mount                                                                                                                                                                                                                                       |
| `providers/__tests__/provider-detail.smoke.test.tsx`    | 2     | Renders provider details, outbound CTAs route via /go (no direct external hrefs)                                                                                                                                                                                               |
| `ui/__tests__/tabs.keyboard.test.tsx`                   | 1     | Arrow key focus movement, Home/End key support                                                                                                                                                                                                                                 |
| `ui/__tests__/tabs.live.test.tsx`                       | 2     | Labelled tablist with 3 tabs, polite live region without visual noise                                                                                                                                                                                                          |
| `ux/__tests__/return-to-last.smoke.test.tsx`            | 2     | Renders nothing when no key, renders link when last provider present (migrates legacy)                                                                                                                                                                                         |

---

### 3.6 — `api` (6 files, ~18 cases)

API route contracts — node environment. Uses `api-test-setup.ts` to silence console.debug/error noise.

| File                                           | Cases | What It Validates                                                                                                                                                    |
| ---------------------------------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/api/auth/tests/auth.api.test.ts`          | 1     | Auth route handlers are exported                                                                                                                                     |
| `app/api/tests/api-contracts.snapshot.test.ts` | 4     | Snapshot contracts: GET /api/exchanges, /api/providers, /api/fx, /api/weather                                                                                        |
| `app/api/tests/exchanges.api.test.ts`          | 1     | GET /api/exchanges returns array with expected shape                                                                                                                 |
| `app/api/tests/fx.api.test.ts`                 | 2     | GET /api/fx returns canonical { meta, data, error? } shape, N quotes in SSOT order                                                                                   |
| `app/api/tests/providers.api.test.ts`          | 1     | GET /api/providers returns providers array                                                                                                                           |
| `src/__tests__/go.outbound.route.test.ts`      | 7     | /go/[providerId] redirect: buildGoHref, 400 on missing src, 404 for unknown, affiliateUrl with click_id/utm, website fallback, explicit utm_medium, required headers |
| `src/__tests__/api.weather.route.test.ts`      | 3     | /api/weather proxy: gateway data shape, NextResponse.json, error envelope                                                                                            |

---

### 3.7 — `util` (12 files, ~44 cases)

Pure utility/library functions — node environment, zero DOM.

| File                                                 | Cases | What It Validates                                                                                              |
| ---------------------------------------------------- | ----- | -------------------------------------------------------------------------------------------------------------- |
| `lib/__tests__/clock.test.ts`                        | 11    | formatClock, formatClockInTZ (valid/multiple/invalid/empty/24h), nowInTZ (valid/invalid/multiple), integration |
| `lib/fx/__tests__/providers.normalisesymbol.test.ts` | 3     | normaliseSymbol: EUR/USD mapping, EURUSD insertion, hyphenated symbols                                         |
| `lib/fx/__tests__/providers.summary.test.ts`         | 5     | getFxProviderSummary: default, live/cached/fallback modes, unknown provider passthrough                        |
| `lib/fx/__tests__/providers.test.ts`                 | 3     | normaliseSymbol: case mapping, delimiter variants, concatenated pairs                                          |
| `lib/ribbon/__tests__/selection.test.ts`             | 3     | selectForRibbon: FX pairs (order/maxItems/missing), commodities (overflow/extras), crypto (valid shape)        |
| `lib/tests/flags.test.ts`                            | 2     | EU special flag, fallback behaviour                                                                            |
| `lib/tests/time.test.ts`                             | 3     | isoNow stability, localTime offset, utcOffsetLabel formatting                                                  |
| `src/__tests__/format.number.test.ts`                | 4     | formatNumber (dp/sign, compact notation, strict mode throws), formatMoney                                      |
| `src/__tests__/fx.compute-daily-arrow.test.ts`       | 3     | Arrow up when current > prevClose, none within tolerance, none when current < prevClose                        |
| `src/__tests__/fx.eligibility-order.test.ts`         | 1     | Deterministic east-west weighted ordering                                                                      |
| `src/__tests__/fx.normalise-symbol.test.ts`          | 3     | normaliseSymbol: canonical key mapping, delimiter variants, concatenated pairs                                 |
| `src/__tests__/exchange-order.test.ts`               | 4     | Selected exchange count (16), rail split, east-west ordering, splitIds mirror                                  |

---

### 3.8 — `app` (6 files, ~118 cases)

App-scoped integration / catch-all — jsdom environment (mixed .ts/.tsx).

| File                                               | Cases | What It Validates                                                                                                                                                                                                                                              |
| -------------------------------------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/__tests__/a11y.live-region.test.tsx`          | 1     | Renders a polite live region                                                                                                                                                                                                                                   |
| `src/__tests__/compression.test.ts`                | 78    | Dictionary integrity, platform support matrix (42 platforms, 4 tiers), compressPrompt function, filler/redundancy/phrase removal, tier-specific behaviour, metrics, edge cases, real-world prompts, utility functions, analyzeCompression, compression options |
| `src/__tests__/finance-ribbon.contracts.test.tsx`  | 1     | Produces valid SelectionResult for FX, Commodities, Crypto                                                                                                                                                                                                     |
| `src/__tests__/holiday-detector.test.ts`           | 2     | Probable holiday detection, out-of-hours closed detection                                                                                                                                                                                                      |
| `src/__tests__/plans.matrix.test.ts`               | 11    | Guest/free/pro configurations, plan fields, guest defaults, free limits/upgrade hints, pro user location, getPlanConfig, isPro/isGuest, canUseStudio, getPromptLimit, selectPlanId, upgrade hints                                                              |
| `src/__tests__/promagen-users.aggregation.test.ts` | 25    | isStale (null/recent/threshold/custom/future), normalizeCountryCode (null/undefined/empty/whitespace/lowercase/mixed/trim/short/long/numbers/special/placeholders/valid), data shape, edge cases (zero/large/integer counts)                                   |

---

## 4. Test Infrastructure

### 4.1 Setup Files

| File                                  | Used By                      | Purpose                                                                    |
| ------------------------------------- | ---------------------------- | -------------------------------------------------------------------------- |
| `src/jest.setup.dom.ts`               | `hooks`, `components`, `app` | jsdom setup, `@testing-library/jest-dom` matchers                          |
| `src/app/api/tests/api-test-setup.ts` | `api`                        | Module-scope console.debug/console.error silencing for route handler noise |

### 4.2 Test Helpers

| File                                    | Purpose                                               |
| --------------------------------------- | ----------------------------------------------------- |
| `src/app/api/tests/api-test-helpers.ts` | Type guards, extractKeyStructure for snapshot testing |
| `src/test-utils/clerk-mock.ts`          | Clerk auth ESM mock harness for component tests       |

### 4.3 Snapshots (8 files)

All managed by `api-contracts.snapshot.test.ts` and `data-contracts.snapshot.test.ts`:

- `/api/exchanges` response structure
- `/api/providers` response structure
- `/api/fx` response structure
- `/api/weather` response structure
- `fx-pairs.json` first entry structure
- `exchanges.catalog.json` first entry structure
- `providers.json` first entry structure
- `getDefaultFxPairsWithIndexForTier()` shape

---

## 5. Coverage Gaps — Production Systems with Zero Tests

These are the systems identified as having zero test coverage. Ranked by risk level.

### 5.1 🔴 CRITICAL — Zero Tests

| System                                           | Source Files | Lines  | Risk        | Impact                                                                                                      |
| ------------------------------------------------ | ------------ | ------ | ----------- | ----------------------------------------------------------------------------------------------------------- |
| **Weather Engine** (`lib/weather/*`)             | 19 files     | ~2,500 | 🔴 CRITICAL | Generates ALL 4-tier weather prompts. 5 bugs already found manually. Every provider tooltip relies on this. |
| **Prompt Optimizer** (`lib/prompt-optimizer.ts`) | 1 file       | 1,604  | 🔴 CRITICAL | 218 redundancy pairs, token counting, 5-phase pipeline. One regression = broken prompts for every provider. |

### 5.2 🟡 HIGH — Zero Tests

| System                                     | Source Files | Risk    | Impact                                                                                                          |
| ------------------------------------------ | ------------ | ------- | --------------------------------------------------------------------------------------------------------------- |
| **Vocabulary System** (`lib/vocabulary/*`) | 4 files      | 🟡 HIGH | Category suggester, auto-filter, vocabulary loader. Powers dropdown suggestions in prompt builder.              |
| **Telemetry Client** (`lib/telemetry/*`)   | 2 files      | 🟡 HIGH | Quality gates, session tracking, return-within-60s detection. Silent failures = no learning data.               |
| **35 Hooks without tests**                 | 35 files     | 🟡 HIGH | Includes use-prompt-builder, use-weather, use-learned-weights, use-prompt-optimization — all business-critical. |

### 5.3 🟠 MEDIUM — Undertested

| System                    | Tested/Total             | Risk      | Impact                                                                                                                                                                                                                                                            |
| ------------------------- | ------------------------ | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **API Routes**            | 6 test files / 69 routes | 🟠 MEDIUM | Most are CRUD/simple, but learning/_ and admin/_ routes handle scoring weights, aggregation cron, and user data.                                                                                                                                                  |
| **Component directories** | 6 of 28 dirs tested      | 🟠 MEDIUM | 22 component directories have zero tests (admin, analytics, auth, builders, chrome, common, core, cosmic, footer, fx, health, home, icons, layout, leaderboard, market-pulse, prompt-builder, prompt-intelligence, prompts, ribbon, settings, tooltips, weather). |

### 5.4 Untested Hooks (35 files)

```
use-analytics.ts              use-market-mood-live.ts
use-auth.ts                   use-market-pulse.ts
use-commodities-quotes.ts     use-market-transition.ts
use-commodity-tooltip-data.ts  use-prefers-reduced-motion.ts
use-composition-mode.ts       use-promagen-auth.ts
use-consent.ts                use-prompt-builder.ts
use-daily-usage.ts            use-prompt-intelligence.ts
use-exchange-selection.ts     use-prompt-optimization.ts
use-fetch-interval.ts         use-ribbon-data.ts
use-fx-picker.ts              use-saved-prompts.ts
use-fx-quotes.ts              use-user-location.ts
use-fx-selection.ts           use-vocab-submission.ts
use-fx-trace.ts               use-weather-prompt-tier.ts
use-image-quality-vote.ts     use-weather.ts
use-index-rating-events.ts    useplan.ts
use-index-ratings.ts          user-plan.ts
use-indices-quotes.ts
use-intelligence-preferences.ts
use-intelligent-phrases.ts
```

### 5.5 Untested Component Directories (22 of 28)

```
admin/          cosmic/         icons/          prompts/
analytics/      footer/         layout/         ribbon/
auth/           fx/             leaderboard/    settings/
builders/       health/         market-pulse/   tooltips/
chrome/         home/           prompt-builder/ weather/
common/         core/           prompt-intelligence/
```

---

## 6. Console Noise Status

| Project        | Noise Level | Notes                                                                                                                                                 |
| -------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `data`         | Clean       | No console output                                                                                                                                     |
| `learning`     | Noisy       | aggregate-phase6 tests produce ~100 lines of `console.debug` from `[Learning Cron]` logs. Not errors — diagnostic noise from route handler execution. |
| `intelligence` | Clean       | No console output                                                                                                                                     |
| `hooks`        | Clean       | All fetch hooks are mocked                                                                                                                            |
| `components`   | Clean       | useLearningData mocked in prompt-builder.analytics                                                                                                    |
| `api`          | Clean       | api-test-setup.ts silences console.debug/error                                                                                                        |
| `util`         | Clean       | No console output                                                                                                                                     |
| `app`          | Clean       | No console output                                                                                                                                     |

**Note:** The `learning` project console.debug noise from aggregate-phase6 is cosmetic only — all tests pass. A future improvement could silence it via a learning-specific `setupFiles` entry.

---

## 7. CI Commands Reference

```powershell
# From: C:\Users\Proma\Projects\promagen\frontend

# Individual groups
pnpm run test:data              # Data integrity only
pnpm run test:learning          # ML engine only
pnpm run test:intelligence      # Prompt scoring only
pnpm run test:hooks             # React hooks only
pnpm run test:components        # Components only
pnpm run test:api               # API routes only
pnpm run test:util              # Utilities only
pnpm run test:app               # App integration only

# Composite
pnpm run test:ci                # All 8 projects, verbose, runInBand
pnpm run test:ci:fast           # data + util + api only (~5s)
pnpm run test:ci:ml             # learning + intelligence only (~8s)
pnpm run test:ci:ui             # hooks + components + app only (~7s)

# Verification
pnpm run typecheck              # TypeScript compilation
pnpm run lint                   # ESLint
pnpm run check:all              # lint + typecheck + test:ci
```

---

## 8. Version History

| Date           | Change                                                        | Tests Before            | Tests After             |
| -------------- | ------------------------------------------------------------- | ----------------------- | ----------------------- |
| 27 Feb 2026    | Phase A — Jest config reorganised into 8 projects             | 105 files / 1,413 cases | 105 files / 1,413 cases |
| 27-28 Feb 2026 | Rounds 1-13 — 13 rounds of fixes and improvements             | 105 files / 1,413 cases | 108 files / 1,427 cases |
| 28 Feb 2026    | Round 14 — Lint fix (onKeyDown + tabIndex on exchange-picker) | 108 files / 1,427 cases | 108 files / 1,427 cases |
