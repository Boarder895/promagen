# Promagen — Master Test Document

**Version:** 2.0.0
**Created:** 25 March 2026
**Updated:** 6 April 2026
**Owner:** Promagen
**Status:** Authoritative — verified against `src.zip` 6 April 2026
**Runner:** Jest 29.7.0 via `jest.config.cjs` (not in src.zip — config lives in repo root)
**Command:** `pnpm run test:util`

---

## 1. Summary Dashboard

| Metric                          | Count   |
| ------------------------------- | ------- |
| Test files                      | 158     |
| Test cases (`it`/`test` blocks) | ~2,658  |
| Describe blocks                 | ~729    |
| Total test lines                | ~40,471 |

### Test files by location

| Location                                                            | Files | Coverage Focus                                            |
| ------------------------------------------------------------------- | ----- | --------------------------------------------------------- |
| `src/__tests__/` (root)                                             | 43    | Integration, parity, schemas, conversions, upgrades       |
| `src/__tests__/admin/`                                              | 11    | Admin panel components, scoring health                    |
| `src/lib/learning/__tests__/`                                       | 30    | Learning pipeline (largest single group)                  |
| `src/lib/prompt-intelligence/engines/tests/`                        | 6     | Suggestion, conflict, market mood, scoring engines        |
| `src/lib/__tests__/`                                                | 7     | Prompt builder, weather mapper, adaptive weights, synergy |
| `src/data/` (various `tests/` and `__tests__/`)                     | 21    | Data shape validation, SSOT contracts                     |
| `src/hooks/__tests__/` + `src/hooks/prompt-intelligence/__tests__/` | 11    | Hook behaviour tests                                      |
| `src/components/` (various `__tests__/`)                            | 14    | Exchange cards, providers, pro-promagen, UI, UX           |
| `src/app/api/` (various `tests/` and `__tests__/`)                  | 9     | API route contracts, snapshots                            |
| `src/lib/` (other: fx, feedback, ribbon, tests)                     | 6     | FX providers, feedback, ribbon, time/flags                |

---

## 2. What's Tested (by system)

### 2.1 Learning Pipeline — 30 files, ~808 cases

The most thoroughly tested subsystem. All in `src/lib/learning/__tests__/`:

ab-testing, ab-assignment, aggregate-phase6, anti-pattern-detection, category-value-discovery, collision-matrix, combo-integration, combo-lookup, compression-intelligence, compression-lookup, compression-overrides, confidence-multiplier, feedback-credibility, feedback-streaks, iteration-integration, iteration-tracking, magic-combo-mining, negative-pattern-integration, outcome-score, platform-co-occurrence, platform-co-occurrence-lookup, platform-term-quality, platform-term-quality-lookup, redundancy-detection, redundancy-integration, scorer-health, temporal-intelligence, term-quality-scoring, threshold-discovery, weight-recalibration.

### 2.2 Prompt Intelligence Engines — 6 files, ~176 cases

`src/lib/prompt-intelligence/engines/tests/` + `engines/__tests__/`:

suggestion-engine, integration, platform-optimization, market-mood-engine, conflict-detection, integration-scoring.

### 2.3 Data Shape Contracts — 21 files

SSOT validation ensuring JSON data files match expected shapes:

commodities (5 files), emoji (3 files), exchanges (3 files), fx (1 file), prompt-intelligence (2 files), providers (3 files), general (4 files: catalogs, cosmic, contracts snapshot, display-country-codes).

### 2.4 Hooks — 11 files

use-ab-test, use-conflict-detection, use-feedback-memory, use-learning-data, use-market-mood, use-platform-learning, use-prompt-analysis, use-sentence-conversion, use-smart-reorder, use-smart-suggestions, use-sync-computation.

### 2.5 Components — 14 files

exchange-card (1), exchange-clock (1), nav/tab-list (2), pro-promagen/exchange-picker (1), providers (4: phase-4-evolution, prompt-builder.analytics, launch-panel.smoke, provider-detail.smoke), ui/tabs (2: keyboard, live), ux (3: feedback-invitation, feedback-memory-banner, return-to-last.smoke).

### 2.6 API Routes — 9 files

auth (1), feedback (1), parse-sentence (1), stripe/webhook (1), general contracts (5: api-contracts.snapshot, exchanges.api, fx.api, providers.api).

### 2.7 Integration / Parity / Upgrade — 43 files (root `__tests__/`)

Conversions (7: costs, scorer, assembly-integration, budget, affinities, learning, telemetry), parity (2: all-42-platforms, homepage-builder), upgrades (4: clip-sanitiser, canonical-assembly, venue-singularity, prompt-fingerprint), schema validation (4), integrity (5: vocab-submission, scene-starters, roman-numerals, vocabulary-merge, vocabulary-weather-expansion, currency, country-currency), weather API (1), go outbound (1), exchange-order (1), finance-ribbon (1), and misc.

### 2.8 Admin — 11 files (root `__tests__/admin/`)

code-evolution-radar, anomaly-thresholds, scoring-profiles, scoring-health (3 files), term-quality-leaderboard, weight-simulator, pipeline-dependencies, weight-drift-chart, skill-distribution.

---

## 3. Harmony Lockdown Suite — MISSING

The architecture doc and `righthand-rail.md` reference "115 tests across `harmony-post-processing.test.ts` (72) + `harmony-compliance.test.ts` (43)". **These test files do not exist in the codebase.**

Source files exist:

- `src/lib/harmony-post-processing.ts` (272 lines)
- `src/lib/harmony-compliance.ts` (833 lines)
- `src/lib/optimise-prompts/harmony-post-processing.ts` (439 lines)

But zero test files for any of them. The 115-test lockdown suite was either never created, or was deleted. This is a **critical gap** — these files enforce post-processing and compliance rules for Call 2 output. Any regression here silently corrupts all generated prompts.

**Recommended fix:** Create `src/lib/__tests__/harmony-post-processing.test.ts` and `src/lib/__tests__/harmony-compliance.test.ts` with:

- Snapshot tests for each post-processing function (P1–P12) against known input/output pairs
- Rule count drift detection (assert exact count of rules in compliance gate)
- MJ negative deduplication test cases
- CLIP adjective stripping test cases
- Banned phrase detection test cases

---

## 4. BQI Test Infrastructure (Non-Jest)

The Builder Quality Intelligence system provides regression testing for Call 3 builders, but via CLI tools rather than Jest:

| Tool               | File                                        | Purpose                                                                             |
| ------------------ | ------------------------------------------- | ----------------------------------------------------------------------------------- |
| Validation harness | `src/lib/validation/validate-builder.ts`    | 4-gate check (anchor preservation, banned content, char count, length preservation) |
| Batch runner       | `scripts/builder-quality-run.ts`            | Full Call 3 → Score pipeline for all 40 platforms                                   |
| Claude scorer      | `src/lib/builder-quality/claude-scorer.ts`  | Dual-model scoring (Anthropic API)                                                  |
| Aggregation        | `src/lib/builder-quality/aggregation.ts`    | 3-layer result aggregation + decision logic                                         |
| Scoring prompt     | `src/lib/builder-quality/scoring-prompt.ts` | Shared rubric for GPT + Claude scorers                                              |

**These are not Jest tests.** They run as CLI scripts (`tsx scripts/builder-quality-run.ts`) and store results in Postgres. They test the production Call 3 pipeline end-to-end but provide zero CI protection — a broken build ships without these catching it.

---

## 5. Orphaned Test Files — CRITICAL

**54 files** in `src/__tests__/` (43) and `src/__tests__/admin/` (11) are in the codebase but **may not be matched by any Jest project pattern** in `jest.config.cjs`. The Jest config is not in `src.zip` so this cannot be verified from the zip alone.

**Impact if orphaned:** ~2,658 test cases providing zero CI protection. Tests pass locally only if you run them directly — `pnpm run test:util` may silently skip them.

**Fix:** Inspect `jest.config.cjs` in the repo root. Verify that every test file in `src/__tests__/` is matched by at least one project's `testMatch` pattern. If not, add patterns or move files to locations that are matched.

---

## 6. Critical Coverage Gaps

Ranked by risk — what breaks silently if these areas regress.

### 6.1 Harmony Compliance + Post-Processing (CRITICAL)

**Risk: All generated prompts silently corrupted.**

- 0 tests for `harmony-compliance.ts` (833 lines, deterministic syntax validation)
- 0 tests for `harmony-post-processing.ts` (272 lines, GPT artefact removal)
- 0 tests for `optimise-prompts/harmony-post-processing.ts` (439 lines, Call 3 specific)

**Recommended:** Unit tests with fixture inputs. Test each post-processing function independently. Drift detection asserting the exact number of rules and banned phrases.

### 6.2 Call 3 Builders (CRITICAL)

**Risk: Platform-specific optimisation silently wrong for any of 40 platforms.**

- 0 Jest tests for 50 files in `src/lib/optimise-prompts/`
- BQI batch runner provides end-to-end coverage but not CI-integrated
- `validate-builder.ts` provides 4-gate checks but is CLI-only

**Recommended:** For each builder group, a Jest test that passes a known Call 2 snapshot through `resolveGroupPrompt()` and asserts: correct system prompt selection, correct temperature, correct compliance rules applied. Does NOT require GPT calls — tests the routing and config, not the model output.

### 6.3 Platform Config SSOT (HIGH)

**Risk: Silent misrouting — wrong tier, wrong builder, wrong temperature.**

- 0 tests for `platform-config.json` (40 platforms) or `platform-config.ts` (adapter)
- Missing/wrong config entries cause silent fallbacks that look like GPT failures

**Recommended:** Shape test asserting every platform has required fields (tier, maxChars, idealMin, idealMax, negativePromptMode, call3Group). Assert 40 platforms. Assert no duplicate IDs. Assert tier values are 1–4.

### 6.4 Index Rating Calculations (HIGH)

**Risk: All provider ratings silently wrong.**

- 0 tests for `lib/index-rating/calculations.ts` (500 lines, all the Elo/MPI/decay/seeding math)
- 0 tests for `lib/index-rating/database.ts` (SQL queries including the 6/12 event type filter)

**Recommended:** Unit tests for `calculateMPI()`, `calculateEffectivePoints()`, `calculateEloGain()`, `calculateSeedRating()`, `applyDailyRegression()`, `calculateTimeDecay()`. These are pure functions — easy to test with known inputs and expected outputs.

### 6.5 Cron Routes (HIGH)

**Risk: Crons fail silently in production (already happened — auth bug).**

- 0 tests for `/api/index-rating/cron`, `/api/promagen-users/cron`, `/api/cron/rankings`
- The cron auth mismatch (custom headers vs Vercel Bearer) was only caught by manual inspection

**Recommended:** At minimum, auth validation tests: assert Bearer token accepted, assert custom headers accepted, assert missing secret returns 404, assert wrong secret returns 404. Mock the database layer.

### 6.6 Builder Quality Lib (MEDIUM)

**Risk: BQI scoring/aggregation silently wrong — bad quality data drives bad decisions.**

- 0 tests for 7 files in `lib/builder-quality/`
- `aggregation.ts` has complex decision logic (thresholds, instability detection, confidence tiers)

**Recommended:** Unit tests for aggregation decision logic. Given platform scores X, Y, Z: assert correct decision (pass/investigate/fail). Test instability detection (stddev >8). Test comparison confidence tiers.

### 6.7 Voting System (MEDIUM)

**Risk: Rankings silently wrong, vote manipulation undetected.**

- 0 tests for 8 files in `lib/voting/` (bayesian, security, storage, rate-limiter, validation)

**Recommended:** Unit tests for `calculateRankings()`, `validateCronAuth()`, rate limiter logic.

### 6.8 Prompt Lab Components (MEDIUM)

**Risk: Right rail animations/display break silently.**

- 0 tests for 13 components in `components/prompt-lab/`
- Pipeline X-Ray, Decoder, Switchboard, Alignment — all untested

**Recommended:** Smoke tests: component mounts without error. Snapshot tests for dormant state. Props contract tests (null data → dormant, valid data → active).

### 6.9 Core Hooks (MEDIUM)

**Risk: Prompt generation flow breaks silently.**

- 0 tests for `use-ai-optimisation` (Call 3 hook)
- 0 tests for `use-category-assessment` (Call 1 hook)
- 0 tests for `use-tier-generation` (Call 2 hook)
- 0 tests for `use-index-rating-events` (event tracking hook)

**Recommended:** Mock-based tests: given API success/failure, assert correct state transitions. For `use-index-rating-events`: assert `sendTrackEvent` fires correct payload.

### 6.10 Homepage Components (LOW)

**Risk: Homepage layout breaks, but quickly caught visually.**

- 0 tests for 11 components in `components/home/`

**Recommended:** Smoke tests only — components mount without crashing given valid props.

---

## 7. Gap Closure Priority

| Priority | Area                                       | Files                        | Effort   | Impact                                |
| -------- | ------------------------------------------ | ---------------------------- | -------- | ------------------------------------- |
| **P1**   | Harmony compliance + post-processing tests | 3 source files               | 2–3 days | Protects all prompt generation        |
| **P1**   | Platform config shape test                 | 1 source file                | 2 hours  | Catches silent misrouting             |
| **P2**   | Index rating calculation tests             | 1 source file                | 1 day    | Protects all provider ratings         |
| **P2**   | Call 3 builder routing tests               | 1 test file covering routing | 1 day    | Catches wrong builder/temp/compliance |
| **P2**   | Cron auth tests                            | 3 routes                     | Half day | Prevents repeat of auth bug           |
| **P3**   | BQI aggregation tests                      | 1 source file                | 1 day    | Protects quality decisions            |
| **P3**   | Voting system tests                        | 2–3 source files             | 1 day    | Protects rankings integrity           |
| **P4**   | Prompt Lab component smoke tests           | 13 components                | 1 day    | Catches mount/render errors           |
| **P4**   | Core hook mock tests                       | 4 hooks                      | 1 day    | Catches state transition bugs         |
| **P5**   | Orphaned test file audit                   | jest.config.cjs              | 2 hours  | Ensures existing tests actually run   |

---

## 8. CI Commands Reference

```powershell
# Run all tests (frontend folder)
pnpm run test:util

# Run specific project group (if jest.config.cjs has named projects)
pnpm run test:util -- --selectProjects data
pnpm run test:util -- --selectProjects learning

# Run single file
pnpm run test:util -- --testPathPattern="harmony-compliance"

# Run with coverage
pnpm run test:util -- --coverage

# Run BQI validation (CLI, not Jest)
npx tsx src/lib/validation/validate-builder.ts
```

---

## 9. Non-Regression Rules

1. Never delete a test to fix a build failure. Fix the source code or mark the test as `.skip` with a TODO.
2. Every new component, hook, or lib function should ship with at least a smoke test.
3. Data shape tests must assert exact counts (e.g., 40 platforms, 12 categories) — changes to these counts are intentional and should require test updates.
4. Harmony lockdown tests (when rebuilt) must run on every CI build — no skipping.
5. Test files must be in locations matched by `jest.config.cjs` project patterns — verify after adding new test directories.
6. BQI batch runner results supplement but do not replace Jest CI tests.
7. `pnpm run test:util` is the test command. Not `npx jest --testPathPattern`.

---

## Changelog

- **6 Apr 2026 (v2.0.0):** Complete rewrite from src.zip SSoT. 158 test files verified by file inspection. ~2,658 test cases counted via `it`/`test` block grep. CRITICAL finding: harmony compliance + post-processing tests (claimed 115 in architecture doc) do not exist — 0 test files for 1,544 lines of compliance/post-processing source code. 10 coverage gaps identified and ranked by risk. BQI non-Jest test infrastructure documented. Orphaned test file count updated from ~25 to 54. Gap closure priority table added. Full test file inventory by location.
- **25 Mar 2026 (v1.0.0):** Initial version consolidating 4 predecessor documents.

---

_This document is the authority for Promagen's test landscape. `src.zip` is the SSoT — every file count and location verified by direct inspection. Jest config (`jest.config.cjs`) is NOT in src.zip and must be checked in the repo root._
