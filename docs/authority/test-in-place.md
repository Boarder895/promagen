# Promagen — Test Inventory (In Place)

**Generated:** 4 March 2026
**Previous version:** 1 March 2026 (131 files / 2,034 cases)
**Source of truth:** `src.zip` (4 Mar 2026) + conversation history cross-reference
**Status:** 149 suites, ~2,439 it/test blocks (static count; runtime higher due to `it.each` parametric expansion), 3 skipped, 0 failing
**Runner:** Jest 29.7.0 via `jest.config.cjs` (8 named projects)

---

## 1. Summary Dashboard

| Metric               | Value                                                                               |
| -------------------- | ----------------------------------------------------------------------------------- |
| Test files           | 149                                                                                 |
| Test cases (static)  | ~2,439                                                                              |
| Skipped tests        | 3                                                                                   |
| Failed tests         | 0                                                                                   |
| Jest projects        | 8 (`data`, `learning`, `intelligence`, `hooks`, `components`, `api`, `util`, `app`) |
| Lint errors          | 0                                                                                   |
| TypeScript errors    | 0                                                                                   |
| Snapshot files       | 8                                                                                   |
| CI wall-clock time   | ~28 s                                                                               |

### Delta from v2 → v3

| Metric        | v2 (1 Mar)  | v3 (4 Mar)  | Change      |
| ------------- | ----------- | ----------- | ----------- |
| Test files    | 131         | 149         | **+18**     |
| Test cases    | 2,034       | ~2,439      | **+~405**   |
| Jest projects | 8           | 8           | (unchanged) |
| Skipped       | 3           | 3           | (unchanged) |

### New coverage by session (4 March 2026)

| Session | Feature | New test files | New cases (approx) |
| --- | --- | --- | --- |
| 3-Stage Pipeline | Static/Dynamic/Optimize assembly + dynamic config guard | 1 (prompt-builder-3-stage expanded) | ~41 |
| Unified Brain Upgrades | CLIP sanitiser, canonical assembly, venue singularity, fingerprinting | 4 | ~54 |
| 42-Platform Parity | Parity scoring, homepage-builder parity, quality-95 fixes | 3 | ~58 |
| Phase C+D Integration | Unified brain contract, try-in integration | 2 | ~30 |
| Vocabulary Expansion | Weather expansion integrity, composition synergy | 2 | ~31 |
| Rich Phrases + DNA | Rich phrase assembly, prompt DNA fingerprinting | 2 | ~60 |
| Adaptive Weights + Synergy | Adaptive weight merge, category synergy scoring | 2 | ~46 |
| Weather Category Mapper | Full mapper test suite | 1 | ~61 |
| Integration Scoring | Prompt intelligence integration scoring | 1 | ~17 |
| Analytics | Prompt builder analytics smoke test | 1 | ~1 |
| **All** | | **18** (+ 1 expanded) | **~405** |

---

## 2. Jest Project Overview

| #   | Project        | Env   | Files  | Cases    | Est. Time | Script                       |
| --- | -------------- | ----- | ------ | -------- | --------- | ---------------------------- |
| 1   | `data`         | node  | 62     | ~801     | ~8 s      | `pnpm run test:data`         |
| 2   | `learning`     | node  | 30     | ~808     | ~7 s      | `pnpm run test:learning`     |
| 3   | `intelligence` | node  | 6      | ~176     | ~3 s      | `pnpm run test:intelligence` |
| 4   | `hooks`        | jsdom | 10     | ~126     | ~3 s      | `pnpm run test:hooks`        |
| 5   | `components`   | jsdom | 14     | ~161     | ~2 s      | `pnpm run test:components`   |
| 6   | `api`          | node  | 8      | ~40      | ~1 s      | `pnpm run test:api`          |
| 7   | `util`         | node  | 15     | ~289     | ~2 s      | `pnpm run test:util`         |
| 8   | `app`          | jsdom | 4      | ~38      | ~2 s      | `pnpm run test:app`          |
|     | **TOTAL**      |       | **149**| **~2,439** | **~28 s** | `pnpm run test:ci`         |

---

## 3. Full File Inventory by Project

### 3.1 — `data` (62 files, ~801 cases)

Data integrity, schema validation, JSON shape checks, admin lib functions. All node environment, zero DOM.

#### 3.1a — Data layer (21 files, ~119 cases)

| File | Cases | What It Validates |
| --- | --- | --- |
| `src/data/commodities/tests/commodities.catalog.schema.test.ts` | 1 | Commodity catalog matches Zod schema, unique IDs |
| `src/data/commodities/tests/country-commodities.ids-coverage.test.ts` | 3 | Energy/agriculture/metals columns reference valid commodity IDs |
| `src/data/commodities/tests/exchange-commodities.map.schema.test.ts` | 3 | Commodity-exchange map schema, row count, known exchange IDs |
| `src/data/commodities/tests/exchanges-country-coverage.test.ts` | 1 | Every exchange country has a matching country-commodities row |
| `src/data/emoji/__tests__/budget-indicator.integrity.test.ts` | 1 | Budget guard emoji mapping returns SSOT emoji for ok/warning/blocked |
| `src/data/emoji/__tests__/emoji.helpers.test.ts` | 8 | getEmoji, getTrendEmoji, getProviderEmoji — known IDs, nulls, fallbacks |
| `src/data/emoji/tests/emoji-bank.shape.test.ts` | 1 | emoji-bank.json matches schema, no duplicate IDs |
| `src/data/exchanges/tests/exchanges.catalog.shape.test.ts` | 12 | Catalog field types, kebab-case IDs, IANA timezones, geo bounds, unique IDs |
| `src/data/exchanges/tests/exchanges.index.test.ts` | 5 | Homepage east-west ordering, rail split logic, splitIds helper |
| `src/data/exchanges/tests/exchanges.selected.shape.test.ts` | 4 | Selected IDs array, no duplicates, all exist in catalog |
| `src/data/fx/tests/fx-ssot.test.ts` | 2 | fx-pairs.json unique IDs, fx.selected references valid ones |
| `src/data/prompt-intelligence/tests/data-integrity.test.ts` | 16 | Semantic tags coverage, families, conflicts, market moods, platform hints, categories, versions |
| `src/data/prompt-intelligence/tests/prompt-intelligence.shape.test.ts` | 25 | Shape of families.json, conflicts.json, market-moods.json, platform-hints.json, semantic-tags.json, cross-file references |
| `src/data/providers/__tests__/providers.helpers.test.ts` | 6 | getProviderById, PROVIDERS_BY_ID, getProviderCapabilities, DEFAULT_CAPABILITIES |
| `src/data/providers/tests/providers.capabilities.shape.test.ts` | 8 (1 skip) | _defaults shape, override flags, catalog match, DEFAULT_CAPABILITIES, PROVIDER_CAPABILITIES |
| `src/data/providers/tests/providers.catalog.shape.test.ts` | 6 (1 skip) | 42 providers, required fields, unique IDs, sensible scores |
| `src/data/providers/tests/providers.hints-presets.shape.test.ts` | 4 | Hints/presets data shape, platform ID references |
| `src/data/tests/catalogs.shape.test.ts` | 3 | catalogs.ts exports valid objects |
| `src/data/tests/commodities.display-country-codes.contract.test.ts` | 1 | Country code display contract for commodity cards |
| `src/data/tests/cosmic.shape.test.ts` | 1 | cosmic.json shape validation |
| `src/data/tests/data-contracts.snapshot.test.ts` | 8 | Snapshot tests for data export contracts |

#### 3.1b — Admin command centre (11 files, ~278 cases)

| File | Cases | What It Validates |
| --- | --- | --- |
| `src/__tests__/admin/anomaly-thresholds.test.ts` | 30 | Anomaly detection thresholds, z-score calculations |
| `src/__tests__/admin/code-evolution-radar.test.ts` | 52 | Code evolution radar chart data generation |
| `src/__tests__/admin/pipeline-dependencies.test.ts` | 25 | Pipeline dependency graph, topological sort |
| `src/__tests__/admin/scoring-health-7-11d.test.ts` | 24 | Undo stack, scoring health types |
| `src/__tests__/admin/scoring-health-7-11e.test.ts` | 20 | Temporal/feedback panel helpers |
| `src/__tests__/admin/scoring-health-overview.test.ts` | 19 | Sparkline, trend, time helpers |
| `src/__tests__/admin/scoring-profiles.test.ts` | 29 | Scoring profile creation, comparison |
| `src/__tests__/admin/skill-distribution.test.ts` | 14 | Skill distribution helpers |
| `src/__tests__/admin/term-quality-leaderboard.test.ts` | 27 | Sort, filter, summary for leaderboard |
| `src/__tests__/admin/weight-drift-chart.test.ts` | 16 | Drift/heatmap helpers |
| `src/__tests__/admin/weight-simulator.test.ts` | 22 | Weight simulation engine |

#### 3.1c — App-scoped data integrity (30 files, ~404 cases)

| File | Cases | What It Validates |
| --- | --- | --- |
| `src/__tests__/cascading-intelligence.integrity.test.ts` | 20 | Cascading intelligence: cluster affinity, co-occurrence scoring, downstream reorder |
| `src/__tests__/compression.test.ts` | 78 | Quality/weak/redundancy compression indexes |
| `src/__tests__/country-currency.integrity.test.ts` | 2 | Country→currency mapping integrity |
| `src/__tests__/currency.integrity.test.ts` | 2 | Currency code validation |
| `src/__tests__/exchange-order.test.ts` | 4 | Exchange homepage ordering rules |
| `src/__tests__/extra-5-6-composition-synergy.test.ts` | 25 | **NEW** Composition + synergy scoring across categories |
| `src/__tests__/format.number.test.ts` | 4 | Number formatting helpers |
| `src/__tests__/fx-pairs.test.ts` | 2 | FX pair data integrity |
| `src/__tests__/fx.compute-daily-arrow.test.ts` | 3 | Daily arrow computation |
| `src/__tests__/fx.eligibility-order.test.ts` | 1 | FX eligibility ordering |
| `src/__tests__/fx.normalise-symbol.test.ts` | 3 | Symbol normalisation |
| `src/__tests__/holiday-detector.test.ts` | 2 | Exchange holiday detection |
| `src/__tests__/improvements-1-5.test.ts` | 19 | Improvements batch 1-5 regression |
| `src/__tests__/parity-all-42-platforms.test.ts` | 31 | **NEW** 42-platform parity: homepage vs builder output matching |
| `src/__tests__/parity-homepage-builder.test.ts` | 10 | **NEW** Homepage→builder prompt consistency |
| `src/__tests__/phase-c-unified-brain.test.ts` | 10 | **NEW** Unified Brain Phase C contract: WeatherCategoryMap output |
| `src/__tests__/phase-d-try-in-integration.test.ts` | 20 | **NEW** Phase D: sessionStorage preload, two-effect split, badge |
| `src/__tests__/providers.schema.test.ts` | 3 | Provider catalog schema validation |
| `src/__tests__/quality-95-fixes.test.ts` | 17 | **NEW** 95% quality ceiling fixes: inline negative, CLIP weights |
| `src/__tests__/roman-numerals.integrity.test.ts` | 3 | Roman numeral rendering |
| `src/__tests__/scene-starters.integrity.test.ts` | 15 | 200 scenes: valid IDs, world refs, prefill coverage |
| `src/__tests__/schemas.catalogs.test.ts` | 3 | Catalog schema exports |
| `src/__tests__/schemas.test.ts` | 3 | Core schema validation |
| `src/__tests__/upgrade-2-clip-sanitiser.test.ts` | 16 | **NEW** CLIP weight sanitisation across all T1 platforms |
| `src/__tests__/upgrade-3-canonical-assembly.test.ts` | 12 | **NEW** Canonical assembly: unified assembler matches expected output |
| `src/__tests__/upgrade-4-venue-singularity.test.ts` | 8 | **NEW** Venue singularity: one venue per prompt, no mixing |
| `src/__tests__/upgrade-5-prompt-fingerprint.test.ts` | 18 | **NEW** Prompt DNA fingerprint: hash stability, category coverage |
| `src/__tests__/vocab-submission.integrity.test.ts` | 54 | Vocabulary submission validation, dedup, rate limiting |
| `src/__tests__/vocabulary-merge.integrity.test.ts` | 10 | 9,058 merged vocabulary integrity: no dupes, valid categories |
| `src/__tests__/vocabulary-weather-expansion.integrity.test.ts` | 6 | **NEW** Weather vocabulary expansion: new terms map to valid categories |

---

### 3.2 — `learning` (30 files, ~808 cases)

ML pipeline: scoring, A/B testing, co-occurrence, compression, feedback loops. All node environment.

| File | Cases | What It Validates |
| --- | --- | --- |
| `src/lib/learning/__tests__/ab-assignment.test.ts` | 12 | AB variant assignment, hash distribution |
| `src/lib/learning/__tests__/ab-testing.test.ts` | 74 | AB test lifecycle, significance, confidence |
| `src/lib/learning/__tests__/aggregate-phase6.test.ts` | 20 | Phase 6 daily aggregation cron |
| `src/lib/learning/__tests__/anti-pattern-detection.test.ts` | 16 | Negative pattern detection and scoring |
| `src/lib/learning/__tests__/category-value-discovery.test.ts` | 18 | New category value discovery from telemetry |
| `src/lib/learning/__tests__/collision-matrix.test.ts` | 14 | Term collision detection matrix |
| `src/lib/learning/__tests__/combo-integration.test.ts` | 16 | Magic combo integration end-to-end |
| `src/lib/learning/__tests__/combo-lookup.test.ts` | 28 | Combo lookup by platform, category, tier |
| `src/lib/learning/__tests__/compression-intelligence.test.ts` | 28 | Quality/weak/redundancy index computation |
| `src/lib/learning/__tests__/compression-lookup.test.ts` | 39 | Compression lookup by platform and category |
| `src/lib/learning/__tests__/compression-overrides.test.ts` | 13 | Per-platform compression overrides |
| `src/lib/learning/__tests__/confidence-multiplier.test.ts` | 49 | Confidence multiplier calculation |
| `src/lib/learning/__tests__/feedback-credibility.test.ts` | 43 | Feedback credibility scoring (account age, consistency) |
| `src/lib/learning/__tests__/feedback-streaks.test.ts` | 30 | Feedback streak tracking and bonus |
| `src/lib/learning/__tests__/iteration-integration.test.ts` | 16 | Iteration tracking integration |
| `src/lib/learning/__tests__/iteration-tracking.test.ts` | 25 | Iteration count, convergence detection |
| `src/lib/learning/__tests__/magic-combo-mining.test.ts` | 20 | Magic combo discovery from telemetry |
| `src/lib/learning/__tests__/negative-pattern-integration.test.ts` | 16 | Negative pattern integration end-to-end |
| `src/lib/learning/__tests__/outcome-score.test.ts` | 45 | Outcome scoring model |
| `src/lib/learning/__tests__/platform-co-occurrence-lookup.test.ts` | 17 | Platform co-occurrence lookup |
| `src/lib/learning/__tests__/platform-co-occurrence.test.ts` | 22 | Co-occurrence computation |
| `src/lib/learning/__tests__/platform-term-quality-lookup.test.ts` | 17 | Platform-specific term quality lookup |
| `src/lib/learning/__tests__/platform-term-quality.test.ts` | 27 | Term quality scoring by platform |
| `src/lib/learning/__tests__/redundancy-detection.test.ts` | 20 | Redundant term detection |
| `src/lib/learning/__tests__/redundancy-integration.test.ts` | 16 | Redundancy integration end-to-end |
| `src/lib/learning/__tests__/scorer-health.test.ts` | 25 | Scorer health monitoring |
| `src/lib/learning/__tests__/temporal-intelligence.test.ts` | 58 | Seasonal boosts, weekly patterns, platform update detection |
| `src/lib/learning/__tests__/term-quality-scoring.test.ts` | 22 | Base term quality scoring |
| `src/lib/learning/__tests__/threshold-discovery.test.ts` | 22 | Threshold discovery from data |
| `src/lib/learning/__tests__/weight-recalibration.test.ts` | 40 | Weight recalibration pipeline |

---

### 3.3 — `intelligence` (6 files, ~176 cases)

Prompt intelligence engines: conflict detection, market mood, suggestions, platform optimisation, integration scoring. Node environment.

| File | Cases | What It Validates |
| --- | --- | --- |
| `src/lib/prompt-intelligence/engines/tests/conflict-detection.test.ts` | 23 | Conflict detection between term families |
| `src/lib/prompt-intelligence/engines/tests/integration.test.ts` | 34 | End-to-end intelligence pipeline |
| `src/lib/prompt-intelligence/engines/tests/market-mood-engine.test.ts` | 31 | Market mood scoring and category weighting |
| `src/lib/prompt-intelligence/engines/tests/platform-optimization.test.ts` | 37 | Platform-specific optimisation rules |
| `src/lib/prompt-intelligence/engines/tests/suggestion-engine.test.ts` | 34 | Smart suggestion generation |
| `src/lib/prompt-intelligence/engines/__tests__/integration-scoring.test.ts` | 17 | **NEW** Integration scoring: coherence, conflict penalty, DNA alignment |

---

### 3.4 — `hooks` (10 files, ~126 cases)

React hooks with jsdom environment: AB testing, feedback memory, learning data, platform learning, sync computation, prompt intelligence UI hooks.

| File | Cases | What It Validates |
| --- | --- | --- |
| `src/hooks/__tests__/use-ab-test.test.ts` | 9 | AB test hook: variant selection, persistence |
| `src/hooks/__tests__/use-feedback-memory.test.ts` | 19 | Feedback memory hook: overlap detection, term hints |
| `src/hooks/__tests__/use-learning-data.test.ts` | 10 | Learning data hook: fetch, cache, error states |
| `src/hooks/__tests__/use-platform-learning.test.ts` | 10 | Platform learning hook: weight lookup, tier data |
| `src/hooks/__tests__/use-sync-computation.test.ts` | 6 | Sync computation hook: debounce, memo |
| `src/hooks/prompt-intelligence/__tests__/use-conflict-detection.test.ts` | 16 | Conflict detection UI hook |
| `src/hooks/prompt-intelligence/__tests__/use-market-mood.test.ts` | 17 | Market mood UI hook |
| `src/hooks/prompt-intelligence/__tests__/use-prompt-analysis.test.ts` | 11 | Prompt analysis UI hook |
| `src/hooks/prompt-intelligence/__tests__/use-smart-reorder.test.ts` | 15 | Smart reorder UI hook |
| `src/hooks/prompt-intelligence/__tests__/use-smart-suggestions.test.ts` | 13 | Smart suggestions UI hook |

---

### 3.5 — `components` (14 files, ~161 cases)

Component smoke tests and UI logic with jsdom environment.

| File | Cases | What It Validates |
| --- | --- | --- |
| `src/components/exchanges/__tests__/exchange-card.test.tsx` | 15 | Exchange card rendering, weather tooltip, status display |
| `src/components/exchanges/__tests__/exchange-clock.test.tsx` | 9 | Exchange clock: timezone, DST, market hours |
| `src/components/nav/__tests__/tab-list.active.test.tsx` | 1 | Tab list active state |
| `src/components/nav/__tests__/tab-list.order.test.tsx` | 1 | Tab list ordering |
| `src/components/pro-promagen/__tests__/exchange-picker.test.tsx` | 35 | Exchange picker: selection, search, favourites |
| `src/components/providers/__tests__/launch-panel.smoke.test.tsx` | 7 | Launch panel smoke (legacy, kept for regression) |
| `src/components/providers/__tests__/phase-4-evolution.test.ts` | 63 | Phase 4 evolution: scenes, explore drawer, cascade, badges |
| `src/components/providers/__tests__/prompt-builder.analytics.test.tsx` | 1 | **NEW** Analytics fire on prompt copy |
| `src/components/providers/__tests__/provider-detail.smoke.test.tsx` | 2 | Provider detail page smoke |
| `src/components/ui/__tests__/tabs.keyboard.test.tsx` | 1 | Tab keyboard navigation (arrow keys, home/end) |
| `src/components/ui/__tests__/tabs.live.test.tsx` | 2 | Tab live region announcement |
| `src/components/ux/__tests__/feedback-invitation.test.tsx` | 12 | Feedback invitation widget rendering and interaction |
| `src/components/ux/__tests__/feedback-memory-banner.test.tsx` | 10 | Feedback memory banner rendering |
| `src/components/ux/__tests__/return-to-last.smoke.test.tsx` | 2 | Return-to-last provider banner smoke |

---

### 3.6 — `api` (8 files, ~40 cases)

API route tests. Node environment with mocked request/response.

| File | Cases | What It Validates |
| --- | --- | --- |
| `src/app/api/auth/tests/auth.api.test.ts` | 1 | Auth API route |
| `src/app/api/feedback/__tests__/feedback-route.test.ts` | 21 | Feedback API: create, rate limit, validation |
| `src/app/api/tests/api-contracts.snapshot.test.ts` | 4 | API contract snapshot stability |
| `src/app/api/tests/exchanges.api.test.ts` | 1 | Exchanges API route |
| `src/app/api/tests/fx.api.test.ts` | 2 | FX API route |
| `src/app/api/tests/providers.api.test.ts` | 1 | Providers API route |
| `src/__tests__/api.weather.route.test.ts` | 3 | Weather API route (OpenWeather integration) |
| `src/__tests__/go.outbound.route.test.ts` | 7 | Outbound redirect route (/go/[id]) |

---

### 3.7 — `util` (15 files, ~289 cases)

Utility functions, assembly engine, feedback client, FX helpers. Node environment.

| File | Cases | What It Validates |
| --- | --- | --- |
| `src/lib/__tests__/clock.test.ts` | 11 | Clock utility: timezone, market hours |
| `src/lib/__tests__/prompt-builder-3-stage.test.ts` | 41 | **EXPANDED** 3-stage pipeline: Static/Dynamic/Optimize + dynamic config guard for all 42 platforms |
| `src/lib/__tests__/prompt-builder-rich-phrases.test.ts` | 28 | **NEW** Rich phrase assembly: weather phrases flow through assembler correctly |
| `src/lib/__tests__/prompt-dna.test.ts` | 32 | **NEW** Prompt DNA fingerprint: hash stability, category weighting, comparison |
| `src/lib/__tests__/adaptive-weights.test.ts` | 26 | **NEW** Adaptive weight merge: weather overrides × platform defaults |
| `src/lib/__tests__/category-synergy.test.ts` | 20 | **NEW** Category synergy: inter-category boost scoring |
| `src/lib/__tests__/weather-category-mapper.test.ts` | 61 | **NEW** Weather→category mapping: all 12 categories, camera vocab matching, custom values |
| `src/lib/feedback/__tests__/feedback-client.test.ts` | 18 | Feedback client: store, read, pending, dismiss |
| `src/lib/feedback/__tests__/feedback-scene-enhancer.test.ts` | 33 | Scene enhancer: feedback-driven scene improvement |
| `src/lib/fx/__tests__/providers.normalisesymbol.test.ts` | 3 | FX symbol normalisation |
| `src/lib/fx/__tests__/providers.summary.test.ts` | 5 | FX provider summary |
| `src/lib/fx/__tests__/providers.test.ts` | 3 | FX providers base tests |
| `src/lib/ribbon/__tests__/selection.test.ts` | 3 | Finance ribbon selection logic |
| `src/lib/tests/flags.test.ts` | 2 | Feature flag helpers |
| `src/lib/tests/time.test.ts` | 3 | Time utility functions |

#### Notable: prompt-builder-3-stage.test.ts (653 lines)

This file was significantly expanded on 4 March 2026. Key structure:

**Test constants:**
- `TIER_1_WEIGHTED`: 8 platforms (`stability`, `dreamstudio`, `lexica`, `playground`, `nightcafe`, `getimg`, `openart`, `clipdrop`) — all have CLIP weights
- `TIER_1_SS80`: 7 platforms (same minus `stability` which has sweetSpot=150) — for sweet-spot trim tests
- `TIER_2_PLATFORMS`: 2 platforms (`midjourney`, `bluewillow`)
- `ALL_10_PLATFORMS`: combined 10 keyword-based platforms
- **TIER_1_UNWEIGHTED removed**: all 6 formerly unweighted platforms upgraded to weighted tier

**Describe blocks:**
1. Stage 1: `assembleStatic()` — empty, raw comma join, negative handling (T1 separate, T2 inline)
2. Stage 2: `assemblePrompt` with `skipTrim` — empty, platform formatting, impact priority reorder, no trimming
3. Stage 3: `assemblePrompt` default — sweet-spot trim verification
4. **Dynamic config guard** (lines 512–653): Auto-generates assertions for all 42 platforms from `platform-formats.json`

**Dynamic config guard tests:**
- `buildWeightRegex(syntax)` — derives weight-detection regex from platform's `weightingSyntax` pattern
- `isNotTier4(id)` — filter excludes Tier 4 (assemblePlainLanguage ignores weights/prefix/suffix)
- Weighted platforms: config has `weightingSyntax` → assembly MUST produce weighted terms
- Unweighted keyword platforms: config has NO `weightingSyntax` → assembly must NOT produce weighted terms
- Quality prefix: config has `qualityPrefix` → assembly MUST contain first prefix term
- Quality suffix: config has `qualitySuffix` → assembly MUST contain suffix terms
- Sweet spot trim: default assembly word count ≤ sweetSpot + 15
- Sanity: every platform produces non-empty output containing user's subject term

---

### 3.8 — `app` (4 files, ~38 cases)

Application-level integration tests. jsdom environment.

| File | Cases | What It Validates |
| --- | --- | --- |
| `src/__tests__/a11y.live-region.test.tsx` | 1 | ARIA live region announcements |
| `src/__tests__/finance-ribbon.contracts.test.tsx` | 1 | Finance ribbon contract stability |
| `src/__tests__/plans.matrix.test.ts` | 11 | Pricing plan matrix: free/standard/pro features |
| `src/__tests__/promagen-users.aggregation.test.ts` | 25 | User aggregation: daily/weekly/monthly rollups |

---

## 4. New Test Files (v2 → v3)

18 new test files added on 4 March 2026, plus 1 significantly expanded:

| File | Lines | Cases | Project | What It Tests |
| --- | --- | --- | --- | --- |
| `extra-5-6-composition-synergy.test.ts` | 394 | 25 | data | Composition + synergy scoring |
| `parity-all-42-platforms.test.ts` | 660 | 31 | data | Homepage vs builder parity for all 42 platforms |
| `parity-homepage-builder.test.ts` | 638 | 10 | data | Homepage→builder prompt consistency |
| `phase-c-unified-brain.test.ts` | 173 | 10 | data | Unified Brain Phase C: WeatherCategoryMap contract |
| `phase-d-try-in-integration.test.ts` | 413 | 20 | data | Phase D: sessionStorage preload, two-effect split |
| `quality-95-fixes.test.ts` | 265 | 17 | data | 95% quality ceiling: inline negative, CLIP weights |
| `upgrade-2-clip-sanitiser.test.ts` | 134 | 16 | data | CLIP weight sanitisation across T1 platforms |
| `upgrade-3-canonical-assembly.test.ts` | 160 | 12 | data | Canonical assembly output matching |
| `upgrade-4-venue-singularity.test.ts` | 199 | 8 | data | One venue per prompt enforcement |
| `upgrade-5-prompt-fingerprint.test.ts` | 255 | 18 | data | Prompt DNA fingerprint hash stability |
| `vocabulary-weather-expansion.integrity.test.ts` | 164 | 6 | data | Weather expansion terms → valid categories |
| `adaptive-weights.test.ts` | 311 | 26 | util | Adaptive weight merge: weather × platform |
| `category-synergy.test.ts` | 239 | 20 | util | Inter-category synergy boost scoring |
| `prompt-builder-rich-phrases.test.ts` | 318 | 28 | util | Rich phrase assembly through assembler |
| `prompt-dna.test.ts` | 330 | 32 | util | DNA fingerprint: hash, compare, coverage |
| `weather-category-mapper.test.ts` | 736 | 61 | util | Full mapper: 12 categories, camera matching |
| `integration-scoring.test.ts` | 394 | 17 | intelligence | Integration scoring: coherence, penalty, DNA |
| `prompt-builder.analytics.test.tsx` | 102 | 1 | components | Analytics fire on copy |
| **prompt-builder-3-stage.test.ts** (expanded) | 653 | 41 | util | Was ~300 lines → 653. Added dynamic config guard |

---

## 5. Cross-Reference: Test ↔ Build Phase ↔ Source Module

### Unified Brain (Phases A–D)

| Test File | Build Phase | Source Module Under Test | Lines in Source |
| --- | --- | --- | --- |
| `prompt-builder-3-stage.test.ts` | 3-Stage Pipeline | `lib/prompt-builder.ts` | 1,738 |
| `prompt-builder-rich-phrases.test.ts` | Phase A | `lib/prompt-builder.ts` | 1,738 |
| `weather-category-mapper.test.ts` | Phase B | `lib/weather/weather-category-mapper.ts` | 581 |
| `phase-c-unified-brain.test.ts` | Phase C | `lib/weather/weather-prompt-generator.ts` | 486 |
| `phase-d-try-in-integration.test.ts` | Phase D | `components/providers/prompt-builder.tsx` | 2,746 |
| `prompt-dna.test.ts` | Phase A | `lib/prompt-dna.ts` | ~330 |
| `adaptive-weights.test.ts` | Phase A | `lib/adaptive-weights.ts` | ~310 |
| `category-synergy.test.ts` | Phase A | `lib/category-synergy.ts` | ~240 |

### Platform Upgrades

| Test File | Build Phase | Source Module Under Test | Lines in Source |
| --- | --- | --- | --- |
| `parity-all-42-platforms.test.ts` | 42-Platform Parity | `lib/prompt-builder.ts` | 1,738 |
| `parity-homepage-builder.test.ts` | Parity | `lib/prompt-builder.ts` + homepage route | 1,738 |
| `quality-95-fixes.test.ts` | 95% Ceiling | `lib/prompt-builder.ts` | 1,738 |
| `upgrade-2-clip-sanitiser.test.ts` | CLIP Upgrade | `lib/prompt-builder.ts` | 1,738 |
| `upgrade-3-canonical-assembly.test.ts` | Canonical | `lib/prompt-builder.ts` | 1,738 |
| `upgrade-4-venue-singularity.test.ts` | Venue | `lib/weather/weather-category-mapper.ts` | 581 |
| `upgrade-5-prompt-fingerprint.test.ts` | Fingerprint | `lib/prompt-dna.ts` | ~330 |

### Learning Pipeline (Phases 7.8–7.11)

| Test File | Build Phase | Source Module Under Test | Lines in Source |
| --- | --- | --- | --- |
| `temporal-intelligence.test.ts` | 7.8 | `lib/learning/temporal-intelligence.ts` | 652 |
| `compression-intelligence.test.ts` | 7.9 | `lib/learning/compression-intelligence.ts` | 732 |
| `compression-lookup.test.ts` | 7.9 | `lib/learning/compression-lookup.ts` | 349 |
| `compression-overrides.test.ts` | 7.9 | `lib/learning/compression-overrides.ts` | 151 |
| `feedback-credibility.test.ts` | 7.10 | `lib/learning/feedback-credibility.ts` | 328 |
| `feedback-streaks.test.ts` | 7.10 | `lib/learning/feedback-streaks.ts` | 335 |
| `feedback-client.test.ts` | 7.10 | `lib/feedback/feedback-client.ts` | 225 |
| `feedback-scene-enhancer.test.ts` | 7.10 | `lib/feedback/feedback-scene-enhancer.ts` | 295 |
| `feedback-route.test.ts` | 7.10 | `app/api/feedback/route.ts` | ~120 |
| `feedback-invitation.test.tsx` | 7.10 | `components/ux/feedback-invitation.tsx` | ~200 |
| `feedback-memory-banner.test.tsx` | 7.10 | `components/ux/feedback-memory-banner.tsx` | ~150 |
| `use-feedback-memory.test.ts` | 7.10 | `hooks/use-feedback-memory.ts` | 355 |
| `anomaly-thresholds.test.ts` | 7.11 | `lib/admin/anomaly-thresholds.ts` | ~280 |
| `code-evolution-radar.test.ts` | 7.11 | `lib/admin/code-evolution-radar.ts` | ~400 |
| `pipeline-dependencies.test.ts` | 7.11 | `lib/admin/pipeline-dependencies.ts` | ~200 |
| `scoring-health-7-11d.test.ts` | 7.11 | `lib/admin/undo-stack.ts` | ~490 |
| `scoring-health-7-11e.test.ts` | 7.11 | `lib/admin/scoring-health-types.ts` | ~300 |
| `scoring-health-overview.test.ts` | 7.11 | `lib/admin/scoring-health-types.ts` | ~300 |
| `scoring-profiles.test.ts` | 7.11 | `lib/admin/scoring-profiles.ts` | ~400 |
| `skill-distribution.test.ts` | 7.11 | `lib/admin/scoring-health-types.ts` | ~300 |
| `term-quality-leaderboard.test.ts` | 7.11 | `lib/admin/scoring-health-types.ts` | ~300 |
| `weight-drift-chart.test.ts` | 7.11 | `lib/admin/scoring-health-types.ts` | ~300 |
| `weight-simulator.test.ts` | 7.11 | `lib/admin/weight-simulator.ts` | ~200 |

---

## 6. Console Noise Audit

| Project        | Status      | Notes                                                                                                                                                 |
| -------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `data`         | Clean       | No console output                                                                                                                                     |
| `learning`     | Clean       | aggregate-phase6 debug output silenced                                                                                                                |
| `intelligence` | Clean       | No console output                                                                                                                                     |
| `hooks`        | Clean       | All fetch hooks are mocked                                                                                                                            |
| `components`   | Clean       | useLearningData mocked in prompt-builder.analytics                                                                                                    |
| `api`          | Clean       | api-test-setup.ts silences console.debug/error                                                                                                        |
| `util`         | Clean       | No console output                                                                                                                                     |
| `app`          | Clean       | No console output                                                                                                                                     |

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

| Date           | Change                                                               | Tests Before            | Tests After              |
| -------------- | -------------------------------------------------------------------- | ----------------------- | ------------------------ |
| 27 Feb 2026    | Phase A — Jest config reorganised into 8 projects                    | 105 files / 1,413 cases | 105 files / 1,413 cases  |
| 27-28 Feb 2026 | Rounds 1-13 — 13 rounds of fixes and improvements                    | 105 files / 1,413 cases | 108 files / 1,427 cases  |
| 28 Feb 2026    | Round 14 — Lint fix (onKeyDown + tabIndex on exchange-picker)        | 108 files / 1,427 cases | 108 files / 1,427 cases  |
| 28 Feb–1 Mar   | Phases 7.8-7.11 — Temporal, Compression, Feedback, Admin test suites | 108 files / 1,427 cases | 131 files / 2,034 cases  |
| 4 Mar 2026     | Unified Brain + 3-Stage Pipeline + 42-Platform Parity + upgrades     | 131 files / 2,034 cases | 149 files / ~2,439 cases |

### 4 March 2026 — Test Build Log

| Category | Files Added | Cases Added | What Was Tested |
| --- | --- | --- | --- |
| 3-Stage Pipeline | 0 (expanded 1) | ~41 (expanded) | Static/Dynamic/Optimize pipeline + dynamic config guard for all 42 platforms |
| Unified Brain | 2 | ~30 | Phase C WeatherCategoryMap contract, Phase D try-in integration |
| Platform Upgrades | 4 | ~54 | CLIP sanitiser, canonical assembly, venue singularity, prompt fingerprint |
| 42-Platform Parity | 3 | ~58 | All 42 platforms parity, homepage-builder consistency, 95% quality fixes |
| Vocabulary | 2 | ~31 | Weather expansion integrity, composition synergy |
| Assembly Engine | 4 | ~147 | Rich phrases, DNA fingerprint, adaptive weights, category synergy |
| Weather Mapper | 1 | ~61 | Full mapper: 12 categories, camera vocab, custom values |
| Intelligence | 1 | ~17 | Integration scoring: coherence, penalty, DNA |
| Analytics | 1 | ~1 | Copy event fires analytics |
| **All** | **18** (+1 expanded) | **~405** | |

### Phase 7.8-7.11 Test Build Log (28 Feb – 1 Mar)

| Phase | Files Added | Cases Added | What Was Tested |
| ----- | ----------- | ----------- | ----- |
| 7.8 | 1 | 58 | Temporal intelligence: seasonal boosts, weekly patterns, platform update detection |
| 7.9 | 3 | 80 | Compression intelligence: quality/weak/redundancy indexes, lookup, overrides |
| 7.10 | 8 | 146 | Feedback system: credibility scoring, streaks, client, scene enhancer, API route, components, hook |
| 7.11 | 11 | 278 | Admin command centre: all 11 lib modules |
