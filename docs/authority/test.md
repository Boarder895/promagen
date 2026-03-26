# Promagen — Master Test Document

**Version:** 1.0.0  
**Created:** 25 March 2026  
**Updated:** 25 March 2026  
**Owner:** Promagen  
**Status:** Authoritative — replaces `test-in-place.md`, `test-strategy-plan.md`, `test-groups.md`, `test-gap-analysis.md`  
**Source of truth:** `src.zip` (25 Mar 2026) + `jest.config.cjs` + Martin's test run output  
**Runner:** Jest 29.7.0 via `jest.config.cjs` (8 named projects)

> **Cross-references:**
>
> - `ai-disguise.md` v4.0.0 — §7 post-processing pipeline, §8 harmony engineering (115-test lockdown suite)
> - `harmonizing-claude-openai.md` v2.0.0 — §11 non-regression rules (rule 8: 115-test lockdown)
> - `code-standard.md` v4.0 — All code standards
> - `jest.config.cjs` — Group pattern SSoT (8 projects)

---

## Table of Contents

1. [Summary Dashboard](#1-summary-dashboard)
2. [Jest Project Overview](#2-jest-project-overview)
3. [Orphaned Test Files — CRITICAL](#3-orphaned-test-files--critical)
4. [Full File Inventory by Project](#4-full-file-inventory-by-project)
5. [Harmony Lockdown Suite (v4.0.0)](#5-harmony-lockdown-suite-v400)
6. [Coverage Gaps](#6-coverage-gaps)
7. [Gap Closure Build Order](#7-gap-closure-build-order)
8. [CI Commands Reference](#8-ci-commands-reference)
9. [Console Noise Audit](#9-console-noise-audit)
10. [Non-Regression Rules](#10-non-regression-rules)
11. [Version History](#11-version-history)

---

## 1. Summary Dashboard

| Metric               | Value                                                                               |
| -------------------- | ----------------------------------------------------------------------------------- |
| Test files (on disk) | **161**                                                                             |
| Test files (running) | **136** (25 orphaned — see §3)                                                      |
| Test cases (runtime) | **2,452** (from actual test run — includes `it.each` parametric expansion)          |
| Skipped tests        | 3                                                                                   |
| Failed tests         | **0** (5 harmony failures fixed 25 Mar — P3 `fixT4SelfCorrection` + fixture fix)    |
| Jest projects        | 8 (`data`, `learning`, `intelligence`, `hooks`, `components`, `api`, `util`, `app`) |
| Lint errors          | 0                                                                                   |
| TypeScript errors    | 0                                                                                   |
| Snapshot files       | 8                                                                                   |
| CI wall-clock time   | ~40 s                                                                               |

### Growth Journey

| Date        | Files | Cases  | Key Change                                                       |
| ----------- | ----- | ------ | ---------------------------------------------------------------- |
| 27 Feb 2026 | 105   | ~1,413 | Phase A — Jest config reorganised into 8 projects                |
| 28 Feb 2026 | 108   | ~1,427 | Rounds 1–14 fixes                                                |
| 1 Mar 2026  | 131   | ~2,034 | Phases 7.8–7.11: Temporal, Compression, Feedback, Admin suites   |
| 4 Mar 2026  | 149   | ~2,439 | Unified Brain + 3-Stage Pipeline + 42-Platform Parity + upgrades |
| 25 Mar 2026 | 161   | ~2,452 | Harmony lockdown (115 tests), conversion tests, Stripe webhook   |

---

## 2. Jest Project Overview

| #   | Project        | Env   | Files (running) | Script                       |
| --- | -------------- | ----- | --------------- | ---------------------------- |
| 1   | `data`         | node  | ~30             | `pnpm run test:data`         |
| 2   | `learning`     | node  | 30              | `pnpm run test:learning`     |
| 3   | `intelligence` | node  | 6               | `pnpm run test:intelligence` |
| 4   | `hooks`        | jsdom | 11              | `pnpm run test:hooks`        |
| 5   | `components`   | jsdom | 13              | `pnpm run test:components`   |
| 6   | `api`          | node  | 10              | `pnpm run test:api`          |
| 7   | `util`         | node  | 15              | `pnpm run test:util`         |
| 8   | `app`          | jsdom | ~21             | `pnpm run test:app`          |
|     | **Running**    |       | **~136**        | `pnpm run test:ci`           |
|     | **Orphaned**   |       | **25**          | See §3                       |
|     | **On disk**    |       | **161**         |                              |

### Group → Environment Mapping

Node-only groups skip jsdom loading (~200ms saved per file).

| Group        | Environment | Why                              |
| ------------ | ----------- | -------------------------------- |
| data         | `node`      | Pure JSON/Zod validation, no DOM |
| learning     | `node`      | Pure TS computation              |
| intelligence | `node`      | Pure TS scoring engines          |
| hooks        | `jsdom`     | `renderHook()` needs React DOM   |
| components   | `jsdom`     | `render()` / `screen` needs DOM  |
| api          | `node`      | Mock NextRequest/NextResponse    |
| util         | `node`      | Pure functions                   |
| app          | `jsdom`     | Mixed .tsx files need DOM        |

---

## 3. Orphaned Test Files — CRITICAL

**25 test files exist on disk but are NOT matched by any Jest project pattern.** They never run in CI. This was discovered during the 25 Mar codebase audit by cross-referencing `jest.config.cjs` patterns against the actual file tree.

### 12 orphaned `__tests__/` files (not matched by `app` group patterns)

The `app` group only matches: `a11y.*`, `compression.*`, `conversion-*`, `finance-ribbon.*`, `holiday-detector.*`, `plans.matrix.*`, `promagen-users.*`. These files don't match any pattern:

| File                                                  | Cases | What It Tests                     |
| ----------------------------------------------------- | ----- | --------------------------------- |
| `src/__tests__/extra-5-6-composition-synergy.test.ts` | ~25   | Composition + synergy scoring     |
| `src/__tests__/improvements-1-5.test.ts`              | ~19   | Improvements batch 1–5 regression |
| `src/__tests__/parity-all-42-platforms.test.ts`       | ~31   | 42-platform parity                |
| `src/__tests__/parity-homepage-builder.test.ts`       | ~10   | Homepage→builder consistency      |
| `src/__tests__/phase-c-unified-brain.test.ts`         | ~10   | Unified Brain Phase C contract    |
| `src/__tests__/phase-d-try-in-integration.test.ts`    | ~20   | Phase D try-in integration        |
| `src/__tests__/quality-95-fixes.test.ts`              | ~17   | 95% quality ceiling fixes         |
| `src/__tests__/scene-starters-homepage.test.ts`       | NEW   | Scene starters homepage           |
| `src/__tests__/upgrade-2-clip-sanitiser.test.ts`      | ~16   | CLIP weight sanitisation          |
| `src/__tests__/upgrade-3-canonical-assembly.test.ts`  | ~12   | Canonical assembly                |
| `src/__tests__/upgrade-4-venue-singularity.test.ts`   | ~8    | Venue singularity                 |
| `src/__tests__/upgrade-5-prompt-fingerprint.test.ts`  | ~18   | Prompt DNA fingerprint            |

### 11 orphaned `__tests__/admin/` files (no group matches this path)

The `data` group pattern `src/__tests__/*.integrity.test.*` uses a single `*` glob which only matches files directly in `__tests__/`, not in subdirectories. The `admin/` subfolder is invisible to all 8 groups:

| File                                                   | Cases | What It Tests              |
| ------------------------------------------------------ | ----- | -------------------------- |
| `src/__tests__/admin/anomaly-thresholds.test.ts`       | ~30   | Anomaly detection          |
| `src/__tests__/admin/code-evolution-radar.test.ts`     | ~52   | Code evolution radar       |
| `src/__tests__/admin/pipeline-dependencies.test.ts`    | ~25   | Pipeline dependency graph  |
| `src/__tests__/admin/scoring-health-7-11d.test.ts`     | ~24   | Undo stack, scoring health |
| `src/__tests__/admin/scoring-health-7-11e.test.ts`     | ~20   | Temporal/feedback panel    |
| `src/__tests__/admin/scoring-health-overview.test.ts`  | ~19   | Sparkline, trend helpers   |
| `src/__tests__/admin/scoring-profiles.test.ts`         | ~29   | Scoring profile creation   |
| `src/__tests__/admin/skill-distribution.test.ts`       | ~14   | Skill distribution         |
| `src/__tests__/admin/term-quality-leaderboard.test.ts` | ~27   | Sort, filter, summary      |
| `src/__tests__/admin/weight-drift-chart.test.ts`       | ~16   | Drift/heatmap helpers      |
| `src/__tests__/admin/weight-simulator.test.ts`         | ~22   | Weight simulation engine   |

### 2 orphaned by deletion

| File                                 | Status                                                                               |
| ------------------------------------ | ------------------------------------------------------------------------------------ |
| `src/__tests__/plans.matrix.test.ts` | **Deleted** from codebase (was in app group pattern). Pattern still matches nothing. |

### Fix required

Add patterns to `jest.config.cjs` to capture all 23 orphaned files. Recommended approach — add to `app` group:

```js
// In app group testMatch, ADD:
'<rootDir>/src/__tests__/improvements-*.test.{ts,tsx}',
'<rootDir>/src/__tests__/parity-*.test.{ts,tsx}',
'<rootDir>/src/__tests__/phase-*.test.{ts,tsx}',
'<rootDir>/src/__tests__/quality-*.test.{ts,tsx}',
'<rootDir>/src/__tests__/upgrade-*.test.{ts,tsx}',
'<rootDir>/src/__tests__/extra-*.test.{ts,tsx}',
'<rootDir>/src/__tests__/scene-starters-homepage.test.{ts,tsx}',
'<rootDir>/src/__tests__/admin/**/*.test.{ts,tsx}',
```

After fix: 161 files running, ~2,700+ cases. **Do not implement until Martin approves.**

---

## 4. Full File Inventory by Project

### 4.1 — `data` (~30 files)

Data integrity, schema validation, JSON shape checks. All node environment, zero DOM.

**Matched by:** `src/data/**/*.test.*` + specific `__tests__/*.integrity.test.*` + `schemas.*` + `providers.schema.*` + `fx-pairs.*` + `phase-4-evolution.*`

Includes: commodity catalog schemas (4 files), emoji integrity (3), exchange catalog shapes (3), FX SSOT (1), prompt intelligence data (2), provider helpers/shapes (4), data contracts (4), integrity tests (~8 from `__tests__/`), phase-4-evolution (1).

### 4.2 — `learning` (30 files, ~808 cases)

ML pipeline: scoring, A/B testing, co-occurrence, compression, feedback loops. All node environment.

**Matched by:** `src/lib/learning/**/*.test.*`

All 30 files: ab-assignment, ab-testing, aggregate-phase6, anti-pattern-detection, category-value-discovery, collision-matrix, combo-integration, combo-lookup, compression-intelligence, compression-lookup, compression-overrides, confidence-multiplier, feedback-credibility, feedback-streaks, iteration-integration, iteration-tracking, magic-combo-mining, negative-pattern-integration, outcome-score, platform-co-occurrence (2), platform-term-quality (2), redundancy-detection, redundancy-integration, scorer-health, temporal-intelligence, term-quality-scoring, threshold-discovery, weight-recalibration.

### 4.3 — `intelligence` (6 files, ~176 cases)

Prompt intelligence engines. Node environment.

**Matched by:** `src/lib/prompt-intelligence/**/*.test.*`

All 6 files: conflict-detection, integration, market-mood-engine, platform-optimization, suggestion-engine, integration-scoring.

### 4.4 — `hooks` (11 files, ~140 cases)

React hooks with jsdom. Includes sentence conversion hook added post-4-Mar.

**Matched by:** `src/hooks/**/*.test.*`

All 11 files: use-ab-test, use-feedback-memory, use-learning-data, use-platform-learning, use-sentence-conversion (NEW), use-sync-computation, use-conflict-detection, use-market-mood, use-prompt-analysis, use-smart-reorder, use-smart-suggestions.

### 4.5 — `components` (13 files)

React component rendering. jsdom environment. `phase-4-evolution.test.ts` excluded (runs in `data` group).

**Matched by:** `src/components/**/*.test.*` (excluding `phase-4-evolution`)

All 13 files: exchange-card, exchange-clock, tab-list.active, tab-list.order, exchange-picker, launch-panel.smoke, prompt-builder.analytics, provider-detail.smoke, tabs.keyboard, tabs.live, feedback-invitation, feedback-memory-banner, return-to-last.smoke.

### 4.6 — `api` (10 files)

API route contracts. Node environment. Includes parse-sentence and Stripe webhook tests added post-4-Mar.

**Matched by:** `src/app/api/**/*.test.*` + `src/__tests__/api.*` + `src/__tests__/go.*`

All 10 files: api.weather.route, go.outbound.route, auth.api, feedback-route, parse-sentence (NEW), webhook (NEW), api-contracts.snapshot, exchanges.api, fx.api, providers.api.

### 4.7 — `util` (15 files)

Pure library/utility functions. Node environment. **Includes the 115-test harmony lockdown suite.**

**Matched by:** `src/lib/__tests__/**/*.test.*` + `src/lib/fx/**/*.test.*` + `src/lib/ribbon/**/*.test.*` + `src/lib/tests/**/*.test.*` + specific `__tests__/format.*` + `fx.*` + `exchange-order.*`

All 15 files: adaptive-weights, category-synergy, clock, **harmony-compliance (NEW, 43 tests)**, **harmony-post-processing (NEW, 72 tests)**, prompt-builder-3-stage, prompt-builder-rich-phrases, prompt-dna, weather-category-mapper, providers.normalisesymbol, providers.summary, providers.test, selection, flags, time.

### 4.8 — `app` (~21 running files, 12 orphaned)

App-scoped integration. jsdom environment. **12 files orphaned — see §3.**

**Matched by:** `src/__tests__/a11y.*` + `compression.*` + `conversion-*` + `finance-ribbon.*` + `holiday-detector.*` + `plans.matrix.*` + `promagen-users.*`

Running (21): a11y.live-region, compression, conversion-affinities (NEW), conversion-assembly-integration (NEW), conversion-budget (NEW), conversion-costs (NEW), conversion-learning (NEW), conversion-scorer (NEW), conversion-telemetry (NEW), finance-ribbon.contracts, holiday-detector, promagen-users.aggregation, and ~9 others matching existing patterns.

Orphaned (12): See §3 for full list.

---

## 5. Harmony Lockdown Suite (v4.0.0)

**Added 25 March 2026.** Two test files in the `util` group form the harmony lockdown suite — 115 tests that must pass before shipping any changes to the AI tier generation post-processing pipeline.

| File                                                | Tests | What it covers                                                                                                                                                                                                     |
| --------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/lib/__tests__/harmony-post-processing.test.ts` | 72    | All P1–P12 functions: deduplicateMjParams, stripTrailingPunctuation, fixT4SelfCorrection, fixT4MetaOpeners, mergeT4ShortSentences, fixT3MetaOpeners, stripClipQualitativeAdjectives, postProcessTiers orchestrator |
| `src/lib/__tests__/harmony-compliance.test.ts`      | 43    | enforceT1Syntax, enforceMjParameters, detectT4MetaLanguage, detectT4ShortSentences, rule ceiling assertion (RULE_CEILING=30)                                                                                       |

### Drift detection tests

The lockdown suite includes drift detection assertions that verify lookup set sizes:

| Lookup set                  | Expected size | Test assertion        |
| --------------------------- | ------------- | --------------------- |
| T4 abstract nouns           | 23            | Exact count enforced  |
| T4 meta verbs               | 21            | Exact count enforced  |
| T3 abstract nouns           | 20            | Exact count enforced  |
| T3 perception verbs         | 18            | Exact count enforced  |
| CLIP qualitative adjectives | 10            | Exact count enforced  |
| Rule ceiling                | 30            | `RULE_CEILING === 30` |

### Test fixtures

Real GPT outputs from all 6 harmony rounds + 3 stress tests (lighthouse, cellist, deep-sea diver) are used as fixtures. This means the tests validate against actual production data, not synthetic inputs.

### Non-regression rule

Any red test in the harmony lockdown suite = post-processing drift. **Fix the code, not the test.** The only exception is adding new lookup set entries (which requires updating both the code and the drift detection count).

---

## 6. Coverage Gaps

Cross-referenced from `test-gap-analysis.md` (28 Feb) against current codebase state (25 Mar). Updated status:

| Gap                        | Source Lines | Tests (28 Feb)  | Tests (25 Mar)                                   | Status                              |
| -------------------------- | ------------ | --------------- | ------------------------------------------------ | ----------------------------------- |
| **Weather Engine**         | 7,859        | 0               | 0                                                | 🔴 STILL OPEN                       |
| **Prompt Optimizer**       | 1,789        | 0               | 0                                                | 🔴 STILL OPEN                       |
| **Vocabulary System**      | 1,778        | 0               | 0                                                | 🟡 STILL OPEN                       |
| **Telemetry Client**       | 407          | 0               | 0                                                | 🟡 STILL OPEN                       |
| **Untested Hooks**         | 9,281        | 0 (35 hooks)    | +1 (use-sentence-conversion)                     | 🟡 STILL OPEN (34 hooks)            |
| **API Routes**             | ~8,000+      | 6 routes tested | 10 routes tested (+parse-sentence, +webhook, +2) | 🟠 PARTIAL                          |
| **Untested Components**    | 17,633       | 12 dirs         | 13 dirs (+1)                                     | 🟠 STILL OPEN                       |
| **Orphaned tests (NEW)**   | —            | Not known       | 25 files not running                             | 🔴 NEW — jest.config.cjs fix needed |
| **Harmony pipeline (NEW)** | 828 lines    | 0               | **115 tests**                                    | ✅ CLOSED                           |

### What was closed since 28 Feb

The **harmony post-processing pipeline** (828 lines across `harmony-post-processing.ts` + `harmony-compliance.ts`) went from 0 to 115 tests. This is the most tested subsystem in the codebase relative to its line count.

### What remains open

The weather engine (7,859 lines, 0 tests) is still the single biggest risk. The prompt optimizer (1,789 lines, 0 tests) is second. Both handle every user interaction — a regression in either breaks the entire product.

---

## 7. Gap Closure Build Order

Carried forward from `test-gap-analysis.md`, updated with current status. Phases are ordered by risk-to-effort ratio.

| Phase   | Priority             | Target                   | New Files | New Cases              | Effort | Status      |
| ------- | -------------------- | ------------------------ | --------- | ---------------------- | ------ | ----------- |
| **FIX** | 🔴 Orphans           | jest.config.cjs patterns | 0         | ~290 (already written) | 30 min | NOT STARTED |
| B       | 🔴 Weather Engine    | 9 new test files         | 9         | ~90                    | 2d     | NOT STARTED |
| C       | 🔴 Prompt Optimizer  | 4 new test files         | 4         | ~43                    | 1d     | NOT STARTED |
| D       | 🟡 Vocab + Telemetry | 5 new test files         | 5         | ~42                    | 1d     | NOT STARTED |
| E       | 🟡 Critical Hooks    | 8 new test files         | 8         | ~56                    | 1.5d   | NOT STARTED |
| F       | 🟠 API Routes        | 8 new test files         | 8         | ~37                    | 1.5d   | NOT STARTED |
| G       | 🟠 Components        | 6 new test files         | 6         | ~42                    | 2d     | NOT STARTED |

**After all phases: ~161 running files, ~3,000+ cases.** The orphan fix alone adds ~290 existing test cases to CI at zero writing cost.

---

## 8. CI Commands Reference

```powershell
# From: C:\Users\Proma\Projects\promagen\frontend

# Individual groups
pnpm run test:data              # Data integrity only
pnpm run test:learning          # ML engine only
pnpm run test:intelligence      # Prompt scoring only
pnpm run test:hooks             # React hooks only
pnpm run test:components        # Components only
pnpm run test:api               # API routes only
pnpm run test:util              # Utilities only (includes harmony lockdown)
pnpm run test:app               # App integration only

# Composite
pnpm run test:ci                # All 8 projects, verbose, runInBand
pnpm run test:ci:fast           # data + util + api only (~5s)
pnpm run test:ci:ml             # learning + intelligence only (~8s)
pnpm run test:ci:ui             # hooks + components + app only (~7s)

# Harmony lockdown (quick check)
npx jest --testPathPattern="harmony" --verbose

# Verification
pnpm run typecheck              # TypeScript compilation
pnpm run lint                   # ESLint
pnpm run check:all              # lint + typecheck + test:ci
pnpm run verify:groups          # Confirms all files in exactly one group
```

---

## 9. Console Noise Audit

| Project        | Status | Notes                                                |
| -------------- | ------ | ---------------------------------------------------- |
| `data`         | Clean  | No console output                                    |
| `learning`     | Clean  | aggregate-phase6 debug output silenced               |
| `intelligence` | Clean  | No console output                                    |
| `hooks`        | Clean  | All fetch hooks are mocked                           |
| `components`   | Clean  | useLearningData mocked in prompt-builder.analytics   |
| `api`          | Clean  | api-test-setup.ts silences console.debug/error       |
| `util`         | Clean  | No console output (harmony tests are pure functions) |
| `app`          | Clean  | No console output                                    |

---

## 10. Non-Regression Rules

1. **All 8 Jest projects must pass before shipping** — `pnpm run test:ci` is the gate.
2. **115-test harmony lockdown suite must pass before shipping post-processing changes** — any red test = drift. Fix the code, not the test.
3. **Rule ceiling test is enforced** — `RULE_CEILING === 30` in `harmony-compliance.test.ts`. Raising requires Martin approval.
4. **Drift detection tests are enforced** — lookup set size assertions prevent silent modification of post-processing patterns.
5. **No test quarantine** — orphaned tests must be fixed by updating jest.config.cjs patterns, not by deleting or skipping tests.
6. **New source files get tests** — every new `lib/` module must have a co-located test file before merge. Minimum: 1 golden-path + 1 error-path test per exported function.
7. **Post-processing test fixtures use real GPT output** — never synthetic. This validates against actual production artefacts.
8. **Martin approves test deletions** — "Put it forward but don't implement it until I say so" applies to test removal.

---

## 11. Version History

### Consolidated from 4 predecessor documents

| Document                | Date        | What it covered                                                             | Status                     |
| ----------------------- | ----------- | --------------------------------------------------------------------------- | -------------------------- |
| `test-strategy-plan.md` | 27 Feb 2026 | Original analysis (105 files), 8-group reorganisation plan, 6 coverage gaps | **SUPERSEDED** by this doc |
| `test-groups.md`        | 27 Feb 2026 | Jest config reorganisation (Phase A), new scripts, verification             | **SUPERSEDED** by this doc |
| `test-gap-analysis.md`  | 28 Feb 2026 | Prioritised gap closure plan (Phases B–G), build schedule                   | **SUPERSEDED** by this doc |
| `test-in-place.md`      | 4 Mar 2026  | Full inventory at 149 files / ~2,439 cases, per-file case counts            | **SUPERSEDED** by this doc |

### Key milestones

| Date         | Change                                                                                                                              | Files             | Cases  |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ------ |
| 27 Feb 2026  | Phase A — Jest config reorganised into 8 projects. Fixed 28 orphaned files (testMatch blind spots).                                 | 105               | ~1,413 |
| 28 Feb 2026  | Rounds 1–14 — 13 rounds of fixes and improvements.                                                                                  | 108               | ~1,427 |
| 28 Feb–1 Mar | Phases 7.8–7.11 — Temporal, Compression, Feedback, Admin test suites.                                                               | 131               | ~2,034 |
| 4 Mar 2026   | Unified Brain + 3-Stage + 42-Platform Parity + upgrades.                                                                            | 149               | ~2,439 |
| 25 Mar 2026  | Harmony lockdown (115 tests), conversion tests (7), Stripe webhook, parse-sentence, use-sentence-conversion. 23 orphans discovered. | 161 (136 running) | ~2,452 |

---

## Changelog

- **25 Mar 2026 (v1.0.0):** Consolidated 4 docs into master test.md. Updated all counts to match 161-file codebase. Added §3 (23 orphaned files — critical finding), §5 (harmony lockdown suite), updated §6 gaps (harmony pipeline closed, orphans added), updated §7 build order (orphan fix as Priority 0). File inventory updated with 13 new files since 4 Mar.

---

_This document is the single authority for Promagen's test suite. The 4 predecessor documents (`test-in-place.md`, `test-strategy-plan.md`, `test-groups.md`, `test-gap-analysis.md`) are superseded and should be archived._

_**Key principle:** 161 test files exist. Only 136 run. Fix the orphans first — it's free test coverage._
