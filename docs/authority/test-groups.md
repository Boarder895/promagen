# Phase A — Test Group Reorganisation

**Date:** 27 February 2026  
**Existing features preserved:** Yes  
**Zero test files changed. Configuration only.**

---

## What Changed

| File | Action | What |
|---|---|---|
| `frontend/jest.config.cjs` | **REPLACE** | Single flat config → 8 named Jest projects |
| `frontend/package.json` | **EDIT** | 12 scripts added, 4 changed, 0 removed. Dependencies untouched. |
| `frontend/scripts/verify-test-groups.ps1` | **ADD** | Verification script for group assignment integrity |

---

## Critical Bug Fixed

The old `jest.config.cjs` had **two blind spots** — 28 of 105 test files never ran:

1. **`testMatch` only matched `__tests__/`** — but 24 test files live in `tests/` folders (data shapes, prompt intelligence engines, lib utilities)
2. **`testPathIgnorePatterns` blocked `/src/app/api/`** — all 4 API route tests were excluded

**Before:** `pnpm run test:ci` ran 77 files, silently skipped 28.  
**After:** `pnpm run test:ci` runs all 105 files.

The 28 newly-discovered tests may surface failures that were previously hidden. This is correct behaviour.

---

## New Scripts (12 added)

### Individual groups
```powershell
# Run from: C:\Users\Proma\Projects\promagen\frontend
pnpm run test:data          # 31 files — JSON SSOT, schemas, integrity
pnpm run test:learning      # 24 files — ML scoring engine
pnpm run test:intelligence  #  6 files — prompt scoring engines
pnpm run test:hooks         #  8 files — React hooks
pnpm run test:components    # 12 files — React component rendering
pnpm run test:api           #  6 files — API route contracts
pnpm run test:util          # 12 files — pure utility functions
pnpm run test:app           #  6 files — app-scoped integration
```

### Composite CI slices
```powershell
pnpm run test:ci:fast       # data + util + api (~8s)
pnpm run test:ci:ml         # learning + intelligence (~20s)
pnpm run test:ci:ui         # hooks + components + app (~19s)
```

### Verification
```powershell
pnpm run verify:groups      # Confirms all files in exactly one group
```

---

## Changed Scripts (4 updated)

| Script | Before | After | Why |
|---|---|---|---|
| `test:ci` | `--ci --runInBand` | `--ci --runInBand --verbose` | Group labels visible in output |
| `api:doctor` | `jest ... src/lib/api/tests` | `jest ... --selectProjects api --verbose` | Consistent with group system |
| `validate:data` | `jest ... src/data/commodities/tests` | `jest ... --selectProjects data --verbose` | Runs ALL data tests, not just commodities |
| `check:all` | `lint && typecheck && api:doctor && test:ci` | `lint && typecheck && test:ci` | api:doctor is now part of test:ci |

---

## Group → Environment Mapping

| Group | Environment | Why |
|---|---|---|
| data | `node` | Pure JSON/Zod validation, no DOM |
| learning | `node` | Pure TS computation |
| intelligence | `node` | Pure TS scoring engines |
| hooks | `jsdom` | `renderHook()` needs React DOM |
| components | `jsdom` | `render()` / `screen` needs DOM |
| api | `node` | Mock NextRequest/NextResponse |
| util | `node` | Pure functions |
| app | `jsdom` | Mixed .tsx files need DOM |

Node-only groups skip loading jsdom (~200ms saved per file).

---

## Verification Steps

```powershell
# Run from: C:\Users\Proma\Projects\promagen\frontend

# 1. Does each group discover the right count?
pnpm test -- --selectProjects data --listTests | Measure-Object -Line
# Expected: 31

# 2. Run the full suite
pnpm run test:ci
# Expected: 105 test suites (was 77). Look for [data], [learning] etc. labels.

# 3. Run verification script
pnpm run verify:groups
# Expected: "All 105 test files assigned to exactly one group"

# 4. Typecheck (no new TS, but confirm nothing broke)
pnpm run typecheck
```

## What "Good" Looks Like

- `pnpm run test:data` completes in < 5 seconds with `[data]` labels
- `pnpm run test:ci` runs 105 files with group labels in output
- Console shows: `PASS [data]`, `PASS [learning]`, `PASS [components]` etc.
- `pnpm run verify:groups` prints "Zero orphans. Zero duplicates."

---

## Two Improvement Ideas (not implementing until approved)

1. **CI Pipeline Ordering** — Run groups in dependency order: `data → util → api → learning → intelligence → hooks → components → app`. If data fails, skip the rest. Saves CI minutes and gives faster feedback.

2. **Per-Group Coverage Thresholds** — Add `coverageThreshold` per project. Set floors 2% below current levels so they act as a ratchet preventing silent erosion.
