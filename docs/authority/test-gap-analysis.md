# Promagen — Test Gap Analysis

**Generated:** 28 February 2026
**Cross-references:** `test-in-place.md` (current state) × `test-strategy-plan.md` (target state)
**Goal:** Prioritised build order to close all critical coverage gaps

---

## 1. Executive Summary

The test suite has grown from **105 files / 1,413 cases** (at strategy plan time) to **108 files / 1,427 cases** across 8 Jest projects. All pass, zero lint errors, zero TS errors.

However, the six critical coverage gaps identified in the strategy plan remain **fully open**:

| Gap | Source Lines | Tests Today | Risk |
| --- | --- | --- | --- |
| Weather Engine | 7,859 | 0 | 🔴 CRITICAL |
| Prompt Optimizer | 1,604 | 0 | 🔴 CRITICAL |
| Vocabulary System | 1,778 | 0 | 🟡 HIGH |
| Telemetry Client | 407 | 0 | 🟡 HIGH |
| Untested Hooks (35) | 9,281 | 0 | 🟡 HIGH |
| API Routes (63 untested) | ~8,000+ | 0 | 🟠 MEDIUM |
| Untested Components (22 dirs) | 17,633 | 0 | 🟠 MEDIUM |

**Total untested production code: ~46,500+ lines.**

---

## 2. What the Strategy Plan Proposed vs Current State

### Phase A — Jest Config Reorganisation ✅ DONE

The strategy plan proposed 8 named Jest projects with individual scripts.

**Status:** Fully implemented. 8 projects running (`data`, `learning`, `intelligence`, `hooks`, `components`, `api`, `util`, `app`). All `pnpm run test:*` scripts working. Verification script available.

### Phase B — Weather Engine Tests ❌ NOT STARTED

Strategy plan estimated: ~80 tests across 9 new test files, ~2 days effort.

**Current state:** 19 source files (7,859 lines), zero test files. This is the single biggest risk — every provider card tooltip depends on this, and 5 bugs were already found manually.

### Phase C — Prompt Optimizer Tests ❌ NOT STARTED

Strategy plan estimated: ~40 tests across 4 new test files, ~1 day effort.

**Current state:** 1 file (1,604 lines), 20 exported functions, zero tests. The 5-phase pipeline with 218 redundancy pairs is completely uncovered.

### Phase D — Vocabulary + Telemetry Tests ❌ NOT STARTED

Strategy plan estimated: ~35 tests across 5 new test files, ~1 day effort.

**Current state:** 6 source files (2,185 lines), zero tests.

### Phase E — Critical Hook Tests ❌ NOT STARTED

Strategy plan estimated: ~50 tests across 6 new test files, ~1 day effort.

**Current state:** 35 untested hooks (9,281 lines). Only 9 hooks have tests (the 4 general + 5 prompt-intelligence hooks).

### Phase F — Critical API Route Tests ❌ NOT STARTED

Strategy plan estimated: ~30 tests, ~1 day effort.

**Current state:** 69 routes, only 6 have test files. The 63 untested routes include the entire learning/* suite (16 routes), admin/* (6 routes), and event/telemetry routes.

---

## 3. Prioritised Build Order

Each phase below includes the exact files to create, estimated case counts, and the Jest project they belong to. Phases are ordered by risk-to-effort ratio.

---

### Phase B — Weather Engine (Priority 1)

**Risk:** 🔴 CRITICAL — Generates ALL 4-tier weather prompts. 5 bugs already found manually.
**Effort:** ~2 days
**Jest project:** New group `test:weather` or fold into `util`
**Recommendation:** Create new group `test:weather` — 19 source files justify isolation.

| New Test File | Source Under Test | Est. Cases | What To Test |
| --- | --- | --- | --- |
| `lib/weather/__tests__/prng.test.ts` | `prng.ts` (87 lines) | 8 | Determinism with same seed, different seeds diverge, uniform distribution, edge cases (0, negative, MAX_SAFE_INTEGER) |
| `lib/weather/__tests__/day-night.test.ts` | `day-night.ts` (98 lines) | 10 | Day/night classification across timezones, equator/poles, DST transitions, dawn/dusk boundaries |
| `lib/weather/__tests__/sun-calculator.test.ts` | `sun-calculator.ts` (562 lines) | 10 | Solar elevation at known lat/lng/time, golden hour window, blue hour, noon/midnight extremes, polar day/night |
| `lib/weather/__tests__/wind-system.test.ts` | `wind-system.ts` (534 lines) | 12 | Beaufort scale classification, gust phrases, venue interaction, cultural neutrality, calm/hurricane extremes |
| `lib/weather/__tests__/lighting-engine.test.ts` | `lighting-engine.ts` (973 lines) | 14 | Daylight base selection, shadow-lighting coherence (Bug 2 regression lock), cloud-aware pools, night mode, overcast mode, golden hour blending |
| `lib/weather/__tests__/visual-truth.test.ts` | `visual-truth.ts` (1,301 lines) | 8 | Contrast shadow phrases, air clarity, getContrastShadowPhrase, moisture-aware descriptors, no physics contradictions |
| `lib/weather/__tests__/tier-generators.test.ts` | `tier-generators.ts` (708 lines) | 10 | computeSeed export, CLIP/MJ/NL/Plain outputs for same weather state, no physics contradictions across tiers, token limits per tier |
| `lib/weather/__tests__/camera-lens.test.ts` | `camera-lens.ts` (289 lines) | 8 | Lens selection consistency, style-setting combos, wide vs telephoto for different scenes, no duplicate lens terms |
| `lib/weather/__tests__/weather-prompt-generator.test.ts` | `weather-prompt-generator.ts` (684 lines) | 10 | End-to-end: weather state → prompt string (golden-path regression per tier), empty weather state handling, extreme conditions |

**Total: 9 new test files, ~90 test cases**

**Jest config addition:**
```js
{
  displayName: 'weather',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/lib/weather/**/*.test.{ts,tsx}'],
}
```

---

### Phase C — Prompt Optimizer (Priority 2)

**Risk:** 🔴 CRITICAL — 1,604 lines, 218 redundancy pairs, 5-phase pipeline. One regression = broken prompts for every provider.
**Effort:** ~1 day
**Jest project:** `util`

| New Test File | Source Under Test | Est. Cases | What To Test |
| --- | --- | --- | --- |
| `lib/__tests__/prompt-optimizer.pipeline.test.ts` | `prompt-optimizer.ts` | 15 | 5-phase pipeline order, each phase runs independently, full pipeline regression, empty input, massive input |
| `lib/__tests__/prompt-optimizer.redundancy.test.ts` | `prompt-optimizer.ts` | 12 | All 218 pairs tested (batch), known pair elimination, order independence, no false positives on partial matches |
| `lib/__tests__/prompt-optimizer.tokens.test.ts` | `prompt-optimizer.ts` | 8 | Token counting accuracy, platform limit enforcement, trimming strategy, multi-platform comparison |
| `lib/__tests__/prompt-optimizer.edge.test.ts` | `prompt-optimizer.ts` | 8 | Unicode, emoji in prompts, nested quotes, very long strings, repeated terms, whitespace normalisation |

**Total: 4 new test files, ~43 test cases**

---

### Phase D — Vocabulary + Telemetry (Priority 3)

**Risk:** 🟡 HIGH — Powers dropdown suggestions and learning data collection.
**Effort:** ~1 day
**Jest project:** `util` (vocabulary), `util` (telemetry)

| New Test File | Source Under Test | Est. Cases | What To Test |
| --- | --- | --- | --- |
| `lib/vocabulary/__tests__/category-suggester.test.ts` | `category-suggester.ts` (255 lines) | 8 | Known term → category mapping, unknown terms → null, ambiguous terms, case insensitivity |
| `lib/vocabulary/__tests__/vocab-auto-filter.test.ts` | `vocab-auto-filter.ts` (172 lines) | 6 | Filter removes profanity, preserves clean terms, edge cases (empty, whitespace, special chars) |
| `lib/vocabulary/__tests__/vocabulary-loader.test.ts` | `vocabulary-loader.ts` (457 lines) | 8 | All 11 categories load, term counts match expected, no empty arrays, deduplication |
| `lib/vocabulary/__tests__/vocabulary-integration.test.ts` | `vocabulary-integration.ts` (894 lines) | 10 | Category merging, cross-category conflict resolution, tier-aware filtering, scene-starter integration |
| `lib/telemetry/__tests__/prompt-telemetry-client.test.ts` | `prompt-telemetry-client.ts` (322 lines) | 10 | Session ID generation, event tracking calls, quality gate detection, return-within-60s, no PII leakage, batch flushing |

**Total: 5 new test files, ~42 test cases**

---

### Phase E — Critical Hooks (Priority 4)

**Risk:** 🟡 HIGH — Business-critical hooks with zero coverage.
**Effort:** ~1.5 days
**Jest project:** `hooks`

Ranked by line count × business criticality (top 8 only — remaining 27 hooks are lower priority):

| New Test File | Source Under Test | Lines | Est. Cases | What To Test |
| --- | --- | --- | --- | --- |
| `hooks/__tests__/use-prompt-builder.test.ts` | `use-prompt-builder.ts` | 148 | 8 | Selection state, add/remove terms, category limits, tier switching, reset |
| `hooks/__tests__/use-prompt-optimization.test.ts` | `use-prompt-optimization.ts` | 356 | 8 | Optimization trigger, platform detection, result caching, error handling |
| `hooks/__tests__/use-weather.test.ts` | `use-weather.ts` | 305 | 8 | Fetch flow, cache hit/miss, error states, stale data handling |
| `hooks/__tests__/use-exchange-selection.test.ts` | `use-exchange-selection.ts` | 339 | 6 | Selection persistence, max/min limits, continent grouping, reset |
| `hooks/__tests__/use-prompt-intelligence.test.ts` | `use-prompt-intelligence.ts` | 460 | 8 | Full pipeline coordination, partial data, loading states, error propagation |
| `hooks/__tests__/use-daily-usage.test.ts` | `use-daily-usage.ts` | 407 | 6 | Usage counting, day boundary, plan limits, reset logic |
| `hooks/__tests__/use-market-mood-live.test.ts` | `use-market-mood-live.ts` | 428 | 6 | Live detection, refresh interval, mood transitions, stale data |
| `hooks/__tests__/use-saved-prompts.test.ts` | `use-saved-prompts.ts` | 401 | 6 | Save/load/delete, localStorage interaction, format migration |

**Total: 8 new test files, ~56 test cases**

**Remaining 27 hooks** (lower priority, ~1 day additional):
`use-indices-quotes`, `use-fx-quotes`, `use-market-pulse`, `use-promagen-auth`, `use-commodities-quotes`, `use-composition-mode`, `use-image-quality-vote`, `use-fx-trace`, `use-intelligence-preferences`, `use-user-location`, `use-fx-picker`, `use-market-transition`, `use-intelligent-phrases`, `use-index-ratings`, `use-index-rating-events`, `use-weather-prompt-tier`, `use-vocab-submission`, `use-commodity-tooltip-data`, `use-fetch-interval`, `use-auth`, `useplan`, `user-plan`, `use-fx-selection`, `use-analytics`, `use-ribbon-data`, `use-consent`, `use-prefers-reduced-motion`

---

### Phase F — Critical API Routes (Priority 5)

**Risk:** 🟠 MEDIUM — Most are CRUD, but learning/* and admin/* handle scoring weights and aggregation.
**Effort:** ~1.5 days
**Jest project:** `api`

Ranked by criticality (top routes only):

| New Test File | Route(s) Under Test | Est. Cases | What To Test |
| --- | --- | --- | --- |
| `app/api/learning/tests/scoring-weights.api.test.ts` | `/api/learning/scoring-weights` | 4 | GET returns weights shape, empty state, tier parameter, error envelope |
| `app/api/learning/tests/ab-tests.api.test.ts` | `/api/learning/ab-tests`, `/api/learning/ab-assignment` | 6 | Create test, get assignment, variant distribution, missing params |
| `app/api/learning/tests/co-occurrence.api.test.ts` | `/api/learning/co-occurrence`, `/api/learning/collisions`, `/api/learning/redundancy-groups` | 6 | GET shape, tier param, empty state |
| `app/api/tests/events-track.api.test.ts` | `/api/events/track` | 4 | POST valid event, missing fields, batch, rate limiting |
| `app/api/tests/prompt-telemetry.api.test.ts` | `/api/prompt-telemetry` | 4 | POST telemetry event, quality gate, session tracking |
| `app/api/admin/tests/admin.api.test.ts` | `/api/admin/catalog`, `/api/admin/ping`, `/api/admin/vocab-submissions` | 6 | Auth guard, GET catalog, POST submission |
| `app/api/tests/health.api.test.ts` | `/api/health`, `/api/ping` | 3 | 200 response, uptime shape |
| `app/api/tests/index-rating.api.test.ts` | `/api/index-rating/ratings`, `/api/index-rating/cron` | 4 | GET ratings shape, cron trigger auth |

**Total: 8 new test files, ~37 test cases**

---

### Phase G — Critical Components (Priority 6)

**Risk:** 🟠 MEDIUM — 22 untested component directories (17,633 lines).
**Effort:** ~2 days
**Jest project:** `components`

Top 6 by line count × user visibility:

| New Test File | Component Dir | Lines | Est. Cases | What To Test |
| --- | --- | --- | --- | --- |
| `components/prompts/__tests__/prompts.smoke.test.tsx` | `prompts/` (21 files, 6,131 lines) | 8 | Render smoke, prompt list display, copy action, tier badge |
| `components/ribbon/__tests__/ribbon.smoke.test.tsx` | `ribbon/` (16 files, 3,384 lines) | 8 | Ticker renders, FX/commodities/crypto sections, scroll behaviour |
| `components/home/__tests__/home.smoke.test.tsx` | `home/` (7 files, 1,903 lines) | 6 | Hero renders, exchange grid, CTA buttons, responsive |
| `components/prompt-builder/__tests__/prompt-builder.smoke.test.tsx` | `prompt-builder/` (3 files, 1,482 lines) | 8 | Category drawers, term selection, output preview, clear button |
| `components/prompt-intelligence/__tests__/pi.smoke.test.tsx` | `prompt-intelligence/` (7 files, 1,326 lines) | 6 | Health badge renders, conflict indicators, suggestion chips |
| `components/fx/__tests__/fx.smoke.test.tsx` | `fx/` (3 files, 1,113 lines) | 6 | FX pair display, rate formatting, trend arrow |

**Total: 6 new test files, ~42 test cases**

---

## 4. Build Schedule

| Phase | Priority | New Files | New Cases | Effort | Dependencies | Cumulative Total |
| --- | --- | --- | --- | --- | --- | --- |
| B | 🔴 Weather Engine | 9 | ~90 | 2d | None | 117 files / ~1,517 cases |
| C | 🔴 Prompt Optimizer | 4 | ~43 | 1d | None | 121 files / ~1,560 cases |
| D | 🟡 Vocab + Telemetry | 5 | ~42 | 1d | None | 126 files / ~1,602 cases |
| E | 🟡 Critical Hooks | 8 | ~56 | 1.5d | None | 134 files / ~1,658 cases |
| F | 🟠 API Routes | 8 | ~37 | 1.5d | None | 142 files / ~1,695 cases |
| G | 🟠 Components | 6 | ~42 | 2d | None | 148 files / ~1,737 cases |

**Total new work: 40 new test files, ~310 new test cases, ~9 days effort**
**Projected suite after all phases: 148 files / ~1,737 cases**

All phases are independent — none depend on each other. The ordering is purely by risk.

---

## 5. What "Good" Looks Like After All Phases

```
Test Suites: 148 passed, 148 total
Tests:       1,737 passed, 1,737 total

Coverage:
  Weather Engine:      85%+ branch (was 0%)
  Prompt Optimizer:    90%+ branch (was 0%)
  Vocabulary:          80%+ line  (was 0%)
  Telemetry:           80%+ line  (was 0%)
  Critical Hooks:      70%+ line  (was 0%)
  API Routes:          40%+ route coverage (was 9%)
  Components:          30%+ dir coverage  (was 21%)
```

---

## 6. Two Improvement Ideas

1. **Per-Group Coverage Thresholds** — After each phase, add `coverageThreshold` to the relevant Jest project set 2% below the achieved level. This prevents coverage from silently eroding. For example, after Phase B, set `weather` project to 83% branch minimum. This acts as a one-way ratchet.

2. **CI Matrix Strategy** — With 9+ Jest projects, GitHub Actions (or Vercel CI) could run them as a matrix of parallel jobs. A weather engine failure gives a red X in ~3 seconds instead of waiting 19+ seconds for the full suite. Combined with the proposed dependency ordering (`data → util → api → learning → intelligence → weather → hooks → components → app`), this cuts CI feedback time dramatically.
