# Promagen Test Strategy — Analysis & Gold-Standard Reorganisation Plan

**Date:** 27 February 2026  
**Status:** Planning — No code yet  
**Scope:** Frontend workspace (`frontend/`) Jest test suite only

---

## 1. Current State Analysis

### 1.1 What Exists Today

| Metric                            | Value                                                  |
| --------------------------------- | ------------------------------------------------------ |
| Total test files                  | **105**                                                |
| Total test cases (it/test blocks) | **~1,413**                                             |
| Test runner                       | Jest via `pnpm run test:ci`                            |
| Current grouping                  | **None** — all 105 files run as one flat batch         |
| Jest config                       | `jest.config.cjs` (single project, single `testMatch`) |
| CI command                        | `pnpm run test:ci` → runs everything sequentially      |

### 1.2 The Problem

Running `pnpm run test:ci` fires all 1,413 tests in one go. This means:

- **No isolation** — a broken React mock can fail pure-TS data integrity tests
- **No parallelism** — a 77-case compression test blocks a 2-case FX test
- **No selective re-runs** — fix one learning engine test, re-run all 105 files
- **No clear ownership** — impossible to tell at a glance which domain failed
- **Slow feedback** — entire suite must complete before you get a red/green signal
- **CI is fragile** — one flaky DOM test can gate-keep an unrelated data-only deploy

### 1.3 Test Inventory by Domain

| Domain                                                            | Files   | Cases      | Environment Needed          | Speed     |
| ----------------------------------------------------------------- | ------- | ---------- | --------------------------- | --------- |
| **Learning Engine** (lib/learning)                                | 24      | ~545       | Node only (pure TS)         | Medium    |
| **Prompt Intelligence Engines** (lib/prompt-intelligence)         | 6       | ~177       | Node only (pure TS)         | Medium    |
| **Prompt Intelligence Hooks** (hooks/prompt-intelligence)         | 5       | ~72        | jsdom (React hooks)         | Fast      |
| **Data Integrity / Schema** (data/\*, \_\_tests\_\_/\*.integrity) | 20      | ~140       | Node only (JSON validation) | Very Fast |
| **App-Scoped Tests** (\_\_tests\_\_/\* non-integrity)             | 14      | ~162       | Mixed (some DOM)            | Fast      |
| **Component Tests** (components/\*)                               | 12      | ~136       | jsdom (React DOM)           | Medium    |
| **Hook Tests** (hooks/\_\_tests\_\_)                              | 3       | ~29        | jsdom (React hooks)         | Fast      |
| **API Route Tests** (app/api/tests)                               | 4       | ~5         | Node (mock NextRequest)     | Very Fast |
| **Lib/Utility Tests** (lib/\* except learning/pi)                 | 8       | ~30        | Node only                   | Very Fast |
| **FX/Finance Tests** (lib/fx, \_\_tests\_\_/fx.\*)                | 5       | ~17        | Node only                   | Very Fast |
| **TOTAL**                                                         | **105** | **~1,413** |                             |           |

### 1.4 Critical Coverage Gaps

These are production-critical systems with **ZERO test coverage**:

| System                                         | Files                     | Risk Level  | Why It Matters                                                                                                     |
| ---------------------------------------------- | ------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------ |
| **Weather Engine** (lib/weather/\*)            | 19 source files, 0 tests  | 🔴 CRITICAL | Generates ALL 4-tier prompts. 5 bugs already found manually. Every provider card tooltip relies on this.           |
| **Prompt Optimizer** (lib/prompt-optimizer.ts) | 1,343 lines, 0 tests      | 🔴 CRITICAL | 218 redundancy pairs, token counting, 5-phase pipeline. One regression = broken prompts for every provider.        |
| **Vocabulary System** (lib/vocabulary/\*)      | 4 files, 0 tests          | 🟡 HIGH     | Category suggester, auto-filter, vocabulary loader. Powers the dropdown suggestions in the prompt builder.         |
| **Telemetry Client** (lib/telemetry/\*)        | 2 files, 0 tests          | 🟡 HIGH     | Quality gates, session tracking, return-within-60s detection. Silent failures = no learning data.                  |
| **36 Hooks without tests**                     | 36 files, 0 tests         | 🟡 HIGH     | Includes use-prompt-builder, use-weather, use-learned-weights, use-prompt-optimization — all business-critical.    |
| **65+ API Routes**                             | 65+ routes, only 4 tested | 🟠 MEDIUM   | Most are CRUD/simple, but learning/\* and admin/\* routes handle scoring weights, aggregation cron, and user data. |

---

## 2. Proposed Test Groups (Gold Standard)

The gold standard approach: **Jest Projects** (one `jest.config.cjs`, multiple named projects). Each project defines its own `testMatch`, `testEnvironment`, and `setupFiles`. You run them individually or together.

### 2.1 The 8 Groups

| Group # | Name                | Script                                         | What It Covers                                                                                         | Env   | Est. Files | Est. Cases |
| ------- | ------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ----- | ---------- | ---------- |
| **1**   | `test:data`         | Data integrity, schema shapes, JSON validation | All `data/*/tests/`, `__tests__/*.integrity.*`, `__tests__/schemas*`, `__tests__/providers.schema*`    | node  | 27         | ~200       |
| **2**   | `test:learning`     | ML/scoring learning engine                     | All `lib/learning/__tests__/`                                                                          | node  | 24         | ~545       |
| **3**   | `test:intelligence` | Prompt intelligence engines                    | All `lib/prompt-intelligence/engines/**`                                                               | node  | 6          | ~177       |
| **4**   | `test:hooks`        | All React hooks (PI hooks + general hooks)     | `hooks/**/__tests__/`                                                                                  | jsdom | 8          | ~101       |
| **5**   | `test:components`   | React component tests                          | `components/**/__tests__/`                                                                             | jsdom | 12         | ~136       |
| **6**   | `test:api`          | API route contract tests                       | `app/api/**/tests/`, `__tests__/api.*`, `__tests__/go.*`                                               | node  | 6          | ~14        |
| **7**   | `test:util`         | Pure utility/lib functions                     | `lib/__tests__/`, `lib/fx/`, `lib/ribbon/`, `lib/tests/`, `__tests__/fx.*`, `__tests__/format.*`, etc. | node  | 12         | ~60        |
| **8**   | `test:app`          | App-scoped tests that don't fit elsewhere      | Remaining `__tests__/` files (compression, plans, users, finance-ribbon, a11y, holiday)                | mixed | 10         | ~180       |

### 2.2 How They Run

```powershell
# Individual group (fast feedback):
pnpm run test:data              # ~3s  — JSON shapes only, instant
pnpm run test:learning          # ~12s — heavy computation
pnpm run test:intelligence      # ~8s  — engine scoring
pnpm run test:hooks             # ~6s  — React hooks with jsdom
pnpm run test:components        # ~8s  — React DOM rendering
pnpm run test:api               # ~3s  — route contracts
pnpm run test:util              # ~2s  — pure functions
pnpm run test:app               # ~5s  — mixed app-level

# All groups (CI):
pnpm run test:ci                # Runs all 8 sequentially with summary

# Parallel CI (GitHub Actions / Vercel):
pnpm run test:ci:parallel       # Runs groups in parallel (future)
```

### 2.3 Group Details

#### Group 1: `test:data` — Data Integrity (the Safety Net)

**Purpose:** Ensures all JSON SSOT files are valid, all schemas pass, all vocabulary is correctly structured. These run first because if your data is broken, nothing else matters.

**Files included:**

```
data/commodities/tests/*.test.ts
data/emoji/__tests__/*.test.ts
data/emoji/tests/*.test.ts
data/exchanges/tests/*.test.ts
data/fx/tests/*.test.ts
data/prompt-intelligence/tests/*.test.ts
data/providers/__tests__/*.test.ts
data/providers/tests/*.test.ts
data/tests/*.test.ts
__tests__/cascading-intelligence.integrity.test.ts
__tests__/country-currency.integrity.test.ts
__tests__/currency.integrity.test.ts
__tests__/roman-numerals.integrity.test.ts
__tests__/scene-starters.integrity.test.ts
__tests__/schemas*.test.ts
__tests__/providers.schema.test.ts
__tests__/vocab-submission.integrity.test.ts
__tests__/vocabulary-merge.integrity.test.ts
__tests__/fx-pairs.test.ts
```

**testMatch pattern:** Files matching `*.integrity.test.*`, `*.schema.test.*`, `*.shape.test.*`, or in `data/**/tests/`
**Environment:** `node` (no DOM needed)
**Expected speed:** < 5 seconds

#### Group 2: `test:learning` — ML/Scoring Engine

**Purpose:** Validates all machine learning algorithms — weight recalibration, A/B testing, term quality scoring, redundancy detection, combo mining, confidence multipliers, etc.

**Files included:**

```
lib/learning/__tests__/ab-assignment.test.ts
lib/learning/__tests__/ab-testing.test.ts
lib/learning/__tests__/aggregate-phase6.test.ts
lib/learning/__tests__/anti-pattern-detection.test.ts
lib/learning/__tests__/category-value-discovery.test.ts
lib/learning/__tests__/collision-matrix.test.ts
lib/learning/__tests__/combo-integration.test.ts
lib/learning/__tests__/combo-lookup.test.ts
lib/learning/__tests__/confidence-multiplier.test.ts
lib/learning/__tests__/iteration-integration.test.ts
lib/learning/__tests__/iteration-tracking.test.ts
lib/learning/__tests__/magic-combo-mining.test.ts
lib/learning/__tests__/negative-pattern-integration.test.ts
lib/learning/__tests__/outcome-score.test.ts
lib/learning/__tests__/platform-co-occurrence-lookup.test.ts
lib/learning/__tests__/platform-co-occurrence.test.ts
lib/learning/__tests__/platform-term-quality-lookup.test.ts
lib/learning/__tests__/platform-term-quality.test.ts
lib/learning/__tests__/redundancy-detection.test.ts
lib/learning/__tests__/redundancy-integration.test.ts
lib/learning/__tests__/scorer-health.test.ts
lib/learning/__tests__/term-quality-scoring.test.ts
lib/learning/__tests__/threshold-discovery.test.ts
lib/learning/__tests__/weight-recalibration.test.ts
```

**testMatch pattern:** `**/lib/learning/__tests__/**`
**Environment:** `node`
**Expected speed:** ~12 seconds (heavy computation)

#### Group 3: `test:intelligence` — Prompt Intelligence Engines

**Purpose:** Validates suggestion engine, conflict detection, market mood engine, platform optimization, and scoring integration.

**Files included:**

```
lib/prompt-intelligence/engines/__tests__/integration-scoring.test.ts
lib/prompt-intelligence/engines/tests/conflict-detection.test.ts
lib/prompt-intelligence/engines/tests/integration.test.ts
lib/prompt-intelligence/engines/tests/market-mood-engine.test.ts
lib/prompt-intelligence/engines/tests/platform-optimization.test.ts
lib/prompt-intelligence/engines/tests/suggestion-engine.test.ts
```

**testMatch pattern:** `**/lib/prompt-intelligence/**`
**Environment:** `node`
**Expected speed:** ~8 seconds

#### Group 4: `test:hooks` — React Hooks

**Purpose:** Tests all React hooks — prompt intelligence hooks, learning hooks, and general hooks. All require jsdom + React testing library.

**Files included:**

```
hooks/__tests__/use-ab-test.test.ts
hooks/__tests__/use-learning-data.test.ts
hooks/__tests__/use-platform-learning.test.ts
hooks/prompt-intelligence/__tests__/use-conflict-detection.test.ts
hooks/prompt-intelligence/__tests__/use-market-mood.test.ts
hooks/prompt-intelligence/__tests__/use-prompt-analysis.test.ts
hooks/prompt-intelligence/__tests__/use-smart-reorder.test.ts
hooks/prompt-intelligence/__tests__/use-smart-suggestions.test.ts
```

**testMatch pattern:** `**/hooks/**/__tests__/**`
**Environment:** `jsdom`
**Expected speed:** ~6 seconds

#### Group 5: `test:components` — React Components

**Purpose:** Tests rendered React components — exchange cards, tabs, navigation, prompt builder phases, provider details, etc.

**Files included:**

```
components/exchanges/__tests__/exchange-card.test.tsx
components/exchanges/__tests__/exchange-clock.test.tsx
components/nav/__tests__/tab-list.active.test.tsx
components/nav/__tests__/tab-list.order.test.tsx
components/pro-promagen/__tests__/exchange-picker.test.tsx
components/providers/__tests__/launch-panel.smoke.test.tsx
components/providers/__tests__/phase-4-evolution.test.ts
components/providers/__tests__/prompt-builder.analytics.test.tsx
components/providers/__tests__/provider-detail.smoke.test.tsx
components/ui/__tests__/tabs.keyboard.test.tsx
components/ui/__tests__/tabs.live.test.tsx
components/ux/__tests__/return-to-last.smoke.test.tsx
```

**testMatch pattern:** `**/components/**/__tests__/**`
**Environment:** `jsdom`
**Expected speed:** ~8 seconds

#### Group 6: `test:api` — API Route Contracts

**Purpose:** Validates API route handlers — auth, exchanges, FX, providers, weather, and outbound redirects.

**Files included:**

```
app/api/auth/tests/auth.api.test.ts
app/api/tests/exchanges.api.test.ts
app/api/tests/fx.api.test.ts
app/api/tests/providers.api.test.ts
__tests__/api.weather.route.test.ts
__tests__/go.outbound.route.test.ts
```

**testMatch pattern:** `**/app/api/**/tests/**` + specific `__tests__/api.*` + `__tests__/go.*`
**Environment:** `node`
**Expected speed:** ~3 seconds

#### Group 7: `test:util` — Utilities & Libraries

**Purpose:** Pure function tests — clock, FX normalisation, number formatting, ribbon selection, flags, time.

**Files included:**

```
lib/__tests__/clock.test.ts
lib/fx/__tests__/providers.normalisesymbol.test.ts
lib/fx/__tests__/providers.summary.test.ts
lib/fx/__tests__/providers.test.ts
lib/ribbon/__tests__/selection.test.ts
lib/tests/flags.test.ts
lib/tests/time.test.ts
__tests__/format.number.test.ts
__tests__/fx.compute-daily-arrow.test.ts
__tests__/fx.eligibility-order.test.ts
__tests__/fx.normalise-symbol.test.ts
__tests__/exchange-order.test.ts
```

**testMatch pattern:** `**/lib/__tests__/**`, `**/lib/fx/**`, `**/lib/ribbon/**`, `**/lib/tests/**`, specific FX/format files
**Environment:** `node`
**Expected speed:** ~2 seconds

#### Group 8: `test:app` — App-Scoped / Integration

**Purpose:** Everything that doesn't fit neatly into the above — compression, plans matrix, user aggregation, finance ribbon, a11y, holiday detection.

**Files included:**

```
__tests__/a11y.live-region.test.tsx
__tests__/compression.test.ts
__tests__/finance-ribbon.contracts.test.tsx
__tests__/holiday-detector.test.ts
__tests__/plans.matrix.test.ts
__tests__/promagen-users.aggregation.test.ts
```

**testMatch pattern:** Catch-all for remaining `__tests__/` files not claimed by other groups
**Environment:** Mixed (`jsdom` for .tsx, `node` for .ts — use per-file docblock)
**Expected speed:** ~5 seconds

---

## 3. Implementation Plan

### 3.1 Deliverables

| Part       | What                                                                                                       | Effort    |
| ---------- | ---------------------------------------------------------------------------------------------------------- | --------- |
| **Part A** | New `jest.config.cjs` with 8 named projects                                                                | 0.25d     |
| **Part B** | Updated `frontend/package.json` scripts (8 individual + `test:ci` orchestrator)                            | 0.15d     |
| **Part C** | Per-group `jest.setup.*.ts` files where needed (jsdom groups need ResizeObserver/scrollIntoView polyfills) | 0.15d     |
| **Part D** | Updated `best-working-practice.md` + `code-standard.md` with new test commands                             | 0.1d      |
| **Part E** | Verification — run all 8 groups individually, confirm identical pass/fail vs current `test:ci`             | 0.15d     |
| **Total**  |                                                                                                            | **~0.8d** |

### 3.2 jest.config.cjs Architecture

The key: Jest's **`projects`** array. Each project is a self-contained configuration with its own name, testMatch, environment, and setup files. When you run `--selectProjects data`, only that project runs.

```javascript
// jest.config.cjs (conceptual structure)
module.exports = {
  projects: [
    {
      displayName: 'data',
      testEnvironment: 'node',
      testMatch: [
        '<rootDir>/src/data/**/tests/**/*.test.ts',
        '<rootDir>/src/data/**/__tests__/**/*.test.ts',
        '<rootDir>/src/__tests__/*.integrity.test.ts',
        '<rootDir>/src/__tests__/schemas*.test.ts',
        '<rootDir>/src/__tests__/providers.schema.test.ts',
        '<rootDir>/src/__tests__/fx-pairs.test.ts',
      ],
    },
    {
      displayName: 'learning',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/src/lib/learning/__tests__/**/*.test.ts'],
    },
    {
      displayName: 'intelligence',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/src/lib/prompt-intelligence/**/*.test.ts'],
    },
    {
      displayName: 'hooks',
      testEnvironment: 'jsdom',
      setupFilesAfterSetup: ['<rootDir>/src/jest.setup.dom.ts'],
      testMatch: ['<rootDir>/src/hooks/**/__tests__/**/*.test.{ts,tsx}'],
    },
    {
      displayName: 'components',
      testEnvironment: 'jsdom',
      setupFilesAfterSetup: ['<rootDir>/src/jest.setup.dom.ts'],
      testMatch: ['<rootDir>/src/components/**/__tests__/**/*.test.{ts,tsx}'],
    },
    {
      displayName: 'api',
      testEnvironment: 'node',
      testMatch: [
        '<rootDir>/src/app/api/**/tests/**/*.test.ts',
        '<rootDir>/src/__tests__/api.*.test.ts',
        '<rootDir>/src/__tests__/go.*.test.ts',
      ],
    },
    {
      displayName: 'util',
      testEnvironment: 'node',
      testMatch: [
        '<rootDir>/src/lib/__tests__/**/*.test.ts',
        '<rootDir>/src/lib/fx/**/*.test.ts',
        '<rootDir>/src/lib/ribbon/**/*.test.ts',
        '<rootDir>/src/lib/tests/**/*.test.ts',
        '<rootDir>/src/__tests__/format.*.test.ts',
        '<rootDir>/src/__tests__/fx.*.test.ts',
        '<rootDir>/src/__tests__/exchange-order.test.ts',
      ],
    },
    {
      displayName: 'app',
      testEnvironment: 'jsdom',
      setupFilesAfterSetup: ['<rootDir>/src/jest.setup.dom.ts'],
      testMatch: [
        '<rootDir>/src/__tests__/a11y.*.test.tsx',
        '<rootDir>/src/__tests__/compression.test.ts',
        '<rootDir>/src/__tests__/finance-ribbon.*.test.tsx',
        '<rootDir>/src/__tests__/holiday-detector.test.ts',
        '<rootDir>/src/__tests__/plans.matrix.test.ts',
        '<rootDir>/src/__tests__/promagen-users.*.test.ts',
      ],
    },
  ],
};
```

### 3.3 package.json Scripts

```json
{
  "scripts": {
    "test": "jest",
    "test:data": "jest --selectProjects data --verbose",
    "test:learning": "jest --selectProjects learning --verbose",
    "test:intelligence": "jest --selectProjects intelligence --verbose",
    "test:hooks": "jest --selectProjects hooks --verbose",
    "test:components": "jest --selectProjects components --verbose",
    "test:api": "jest --selectProjects api --verbose",
    "test:util": "jest --selectProjects util --verbose",
    "test:app": "jest --selectProjects app --verbose",
    "test:ci": "jest --verbose --forceExit",
    "test:ci:fast": "jest --selectProjects data,util,api --verbose",
    "test:ci:ml": "jest --selectProjects learning,intelligence --verbose"
  }
}
```

### 3.4 CI Pipeline Order (recommended)

```
Step 1: pnpm run typecheck           (compile check, ~15s)
Step 2: pnpm run lint                (code quality, ~10s)
Step 3: pnpm run test:data           (if data is broken, stop here)
Step 4: pnpm run test:util           (core utils)
Step 5: pnpm run test:api            (route contracts)
Step 6: pnpm run test:learning       (ML engine)
Step 7: pnpm run test:intelligence   (prompt scoring)
Step 8: pnpm run test:hooks          (React hooks)
Step 9: pnpm run test:components     (UI rendering)
Step 10: pnpm run test:app           (integration)
```

Data first, pure logic next, DOM last. If data fails, you know immediately without waiting for component tests to render.

---

## 4. Critical Tests to Write (Coverage Gap Plan)

Ranked by risk. Each entry describes what to test and roughly how many cases.

### Priority 1: Weather Engine (~80 tests, ~2 days)

The weather engine generates every prompt the user sees. 19 source files, 0 tests. Bugs have already been found manually (the 5 bugs fixed in previous chats). This is the single biggest risk in the codebase.

**New test files to create:**

| Test File                                                | What It Tests                                                                                     | Est. Cases |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ---------- |
| `lib/weather/__tests__/prng.test.ts`                     | PRNG determinism, seed stability, distribution uniformity                                         | 8          |
| `lib/weather/__tests__/day-night.test.ts`                | Day/night classification across timezones and edge cases                                          | 10         |
| `lib/weather/__tests__/sun-calculator.test.ts`           | Solar angle calculation, golden hour, blue hour boundaries                                        | 8          |
| `lib/weather/__tests__/wind-system.test.ts`              | Beaufort classification, gust-aware interaction, venue phrases, cultural neutrality               | 12         |
| `lib/weather/__tests__/lighting-engine.test.ts`          | Daylight base selection, shadow-lighting coherence (the Bug 2 regression lock), cloud-aware pools | 12         |
| `lib/weather/__tests__/visual-truth.test.ts`             | Contrast shadow phrases, air clarity phrases, getContrastShadowPhrase function                    | 6          |
| `lib/weather/__tests__/tier-generators.test.ts`          | computeSeed export, all 4 tier outputs for same weather state, no physics contradictions          | 10         |
| `lib/weather/__tests__/camera-lens.test.ts`              | Lens selection consistency, style-setting combinations                                            | 6          |
| `lib/weather/__tests__/weather-prompt-generator.test.ts` | End-to-end: weather state → prompt string (golden-path regression tests per tier)                 | 8          |

**Group assignment:** Create new group `test:weather` (Group 9) or fold into `test:util`  
**Recommendation:** New group `test:weather` — this system is large enough to justify its own isolation

### Priority 2: Prompt Optimizer (~40 tests, ~1 day)

1,343 lines, 218 redundancy pairs, 5-phase pipeline, token counting. Zero tests.

**New test files to create:**

| Test File                                | What It Tests                                                                                                                                                            | Est. Cases |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| `lib/__tests__/prompt-optimizer.test.ts` | Redundancy pair detection, keyword optimization, per-strategy weights, Midjourney/CLIP specific logic, token counting, injected term discovery, full pipeline round-trip | 40         |

**Group assignment:** `test:intelligence` (it's prompt scoring logic)

### Priority 3: Vocabulary System (~20 tests, ~0.5 day)

The vocabulary loader, category suggester, and auto-filter power every dropdown in the prompt builder.

**New test files to create:**

| Test File                                             | What It Tests                                                    | Est. Cases |
| ----------------------------------------------------- | ---------------------------------------------------------------- | ---------- |
| `lib/vocabulary/__tests__/vocabulary-loader.test.ts`  | All 11 categories load, term counts match, no duplicates         | 8          |
| `lib/vocabulary/__tests__/category-suggester.test.ts` | Suggestion relevance, tier-aware filtering, empty state handling | 8          |
| `lib/vocabulary/__tests__/vocab-auto-filter.test.ts`  | Filter accuracy, performance with full vocabulary set            | 4          |

**Group assignment:** `test:data` (vocabulary is data-adjacent)

### Priority 4: Telemetry (~15 tests, ~0.5 day)

Silent failures = no learning data collection = the ML engine has nothing to learn from.

**New test files to create:**

| Test File                                                 | What It Tests                                                                | Est. Cases |
| --------------------------------------------------------- | ---------------------------------------------------------------------------- | ---------- |
| `lib/telemetry/__tests__/ab-hash.test.ts`                 | FNV-1a hash determinism, bucket distribution uniformity, edge cases          | 8          |
| `lib/telemetry/__tests__/prompt-telemetry-client.test.ts` | Quality gate enforcement, session ID generation, return-within-60s detection | 7          |

**Group assignment:** `test:util`

### Priority 5: Critical Hooks (~30 tests, ~1 day)

Of the 36 untested hooks, these 6 are the most dangerous to leave untested:

| Hook                         | Risk                                         | Est. Cases |
| ---------------------------- | -------------------------------------------- | ---------- |
| `use-prompt-builder.ts`      | Core prompt builder state management         | 8          |
| `use-weather.ts`             | Weather data fetching and caching            | 5          |
| `use-learned-weights.ts`     | Fetches ML weights, builds weak term lookups | 6          |
| `use-prompt-optimization.ts` | Hooks into the 1,343-line optimizer          | 5          |
| `use-saved-prompts.ts`       | Persistence layer for user prompts           | 3          |
| `use-daily-usage.ts`         | Usage tracking (gates Pro Promagen features) | 3          |

**Group assignment:** `test:hooks`

### Priority 6: Critical API Routes (~25 tests, ~1 day)

Focus on routes that handle money, data mutations, or scoring:

| Route                           | Risk                                     | Est. Cases |
| ------------------------------- | ---------------------------------------- | ---------- |
| `/api/learning/aggregate`       | Cron that recalibrates ML weights        | 5          |
| `/api/learning/scoring-weights` | Serves learned weights to all clients    | 4          |
| `/api/prompt-telemetry`         | Ingests telemetry events                 | 4          |
| `/api/usage/track`              | Daily usage tracking (Pro Promagen gate) | 4          |
| `/api/providers/vote`           | Elo voting system                        | 4          |
| `/api/fx/route`                 | Spend-bearing FX endpoint                | 4          |

**Group assignment:** `test:api`

---

## 5. Summary: Full Test Group Architecture (After Implementation)

| Group             | Script              | Files Now | Files After | Cases Now  | Cases After |
| ----------------- | ------------------- | --------- | ----------- | ---------- | ----------- |
| data              | `test:data`         | 27        | 30          | ~200       | ~220        |
| learning          | `test:learning`     | 24        | 24          | ~545       | ~545        |
| intelligence      | `test:intelligence` | 6         | 7           | ~177       | ~217        |
| hooks             | `test:hooks`        | 8         | 14          | ~101       | ~131        |
| components        | `test:components`   | 12        | 12          | ~136       | ~136        |
| api               | `test:api`          | 6         | 12          | ~14        | ~39         |
| util              | `test:util`         | 12        | 14          | ~60        | ~75         |
| app               | `test:app`          | 6         | 6           | ~180       | ~180        |
| **weather** (new) | `test:weather`      | 0         | 9           | 0          | ~80         |
| **TOTAL**         | `test:ci`           | **105**   | **~128**    | **~1,413** | **~1,623**  |

---

## 6. Recommended Execution Order

| Phase       | What                                                                     | Effort | Dependencies                          |
| ----------- | ------------------------------------------------------------------------ | ------ | ------------------------------------- |
| **Phase A** | Reorganise jest.config.cjs into 8 projects + update package.json scripts | 0.8d   | None — zero test changes, just config |
| **Phase B** | Write weather engine tests (Priority 1)                                  | 2d     | Phase A complete                      |
| **Phase C** | Write prompt optimizer tests (Priority 2)                                | 1d     | Phase A complete                      |
| **Phase D** | Write vocabulary + telemetry tests (Priority 3+4)                        | 1d     | Phase A complete                      |
| **Phase E** | Write critical hook tests (Priority 5)                                   | 1d     | Phase A complete                      |
| **Phase F** | Write critical API route tests (Priority 6)                              | 1d     | Phase A complete                      |

**Phase A is standalone** — it changes zero test files, only reorganises configuration. This means you get immediate value (8 independent groups) without touching any test code.

Phases B–F can be done in any order. I'd recommend B first (weather engine) because it's the highest risk system with the most bugs already found.

---

## 7. What "Good" Looks Like

After Phase A, you should be able to run:

```powershell
# Run at repo root: C:\Users\Proma\Projects\promagen

# Quick data sanity check (< 5 seconds):
pnpm run test:data

# Just the ML engine (after fixing a scoring bug):
pnpm run test:learning

# Full CI (same as before, but with clear group labels in output):
pnpm run test:ci

# Output will show:
# PASS [data] src/__tests__/schemas.test.ts
# PASS [data] src/data/exchanges/tests/exchanges.catalog.shape.test.ts
# ...
# PASS [learning] src/lib/learning/__tests__/ab-testing.test.ts
# ...
# Test Suites: 105 passed, 105 total
# Tests:       1413 passed, 1413 total
```

Each group runs in its own section with its own displayName, so you can instantly see which domain failed.

---

## 8. Two Improvement Ideas (Not Implementing Until Approved)

1. **Coverage Thresholds per Group** — Add Jest `coverageThreshold` per project. For example: `learning` must maintain 85%+ branch coverage, `data` must maintain 95%+ line coverage. This prevents coverage from silently eroding as new code is added. The thresholds would be set based on current coverage levels so they never regress.

2. **GitHub Actions Matrix Strategy** — Once the 8 groups exist, CI can run them as a matrix (8 parallel jobs). A data integrity failure gives you a red X in ~5 seconds instead of waiting 45+ seconds for the full suite. This cuts CI feedback time by 80% and makes failed deploys immediately obvious per-domain.
