# Prompt Builder Evolution Plan v2.0

**Version:** 2.1.0
**Created:** 2026-02-24
**Last Updated:** 2026-02-27
**Status:** Active Build — Phases 0–7.7 complete, Phases 7.8–7.11 remaining
**Authority:** This document is the single source of truth for the prompt builder evolution.
**Admin Route:** `/admin` (live), `/admin/scoring-health` (planned — Phase 7.11)
**Tests:** See `tests.md` for all test code. This document references test files but does not include test source.

---

## Build Status Dashboard

| Phase    | Feature                         | Status         | Key Metric                                                                                                      |
| -------- | ------------------------------- | -------------- | --------------------------------------------------------------------------------------------------------------- |
| **0**    | Vocabulary Merge                | ✅ COMPLETE    | 9,058 terms (3,501 core + 5,557 merged) across 9 merged + 3 unchanged categories                                |
| **1**    | Cascading Intelligence          | ✅ COMPLETE    | 50 semantic clusters, 250 affinities, 2,032 tagged terms, 145 conflicts, 42 platform hints                      |
| **2**    | Scene Starters                  | ✅ COMPLETE    | 200 scenes (25 free / 175 pro) across 23 worlds                                                                 |
| **3**    | Explore Drawer                  | ✅ COMPLETE    | 805-line component with tier badges, cascade ordering, search, pagination                                       |
| **4**    | Polish & Integration            | ✅ COMPLETE    | Scene flavour phrases wired, analytics events, fluid typography, Phase 4 tests                                  |
| **5**    | Collective Intelligence Engine  | ✅ COMPLETE    | Telemetry endpoint, 14-layer aggregation cron (1,354 lines), 14 learning API routes                             |
| **6**    | Self-Improving Scorer           | ✅ COMPLETE    | 11,189 LOC across 29 learning engine files, 5 recalibration mechanisms                                          |
| **7.1**  | Negative Pattern Learning       | ✅ COMPLETE    | Anti-pattern detection (370 lines) + collision matrix (346 lines) + lookups                                     |
| **7.2**  | Iteration Tracking              | ✅ COMPLETE    | Session sequence tracking (642 lines) + weak term lookup (177 lines)                                            |
| **7.3**  | Semantic Redundancy Detection   | ✅ COMPLETE    | Redundancy detection (574 lines) + lookup (246 lines)                                                           |
| **7.4**  | Higher-Order Combinations       | ✅ COMPLETE    | Magic combo mining (595 lines) + combo lookup (366 lines)                                                       |
| **7.5**  | Per-Platform Learning           | ✅ COMPLETE    | Platform term quality (520 lines) + platform co-occurrence (423 lines) + lookups                                |
| **7.6**  | A/B Testing Pipeline            | ✅ COMPLETE    | 988-line A/B engine + deterministic hash assignment + CRUD API routes                                           |
| **7.7**  | Vocabulary Crowdsourcing        | ✅ COMPLETE    | 3,535 LOC: 3-layer dedup, smart category suggestion, admin review with batch workflow                           |
| **7.8**  | Temporal Intelligence           | ❌ NOT STARTED | —                                                                                                               |
| **7.9**  | Prompt Compression Intelligence | ❌ NOT STARTED | Basic compression engine exists (`compress.ts`) but learned profiles not built                                  |
| **7.10** | User Feedback Invitation        | ❌ NOT STARTED | `feedback-bar.tsx` exists as quality indicator but not the post-copy 👍👌👎 widget                              |
| **7.11** | Admin Command Centre            | ⚠️ PARTIAL     | Admin layout + nav + dashboard + scene-candidates + vocab-submissions live. Scoring-health dashboard not built. |

**Total LOC delivered:** ~30,000+ across learning engines, prompt intelligence, telemetry, admin UI, scene system, vocab merge, and crowdsourcing pipeline.

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Feature Overview](#2-feature-overview)
3. [Architecture — Code vs Data](#3-architecture--code-vs-data)
4. [Feature D — Vocabulary Merge (Phase 0)](#4-feature-d--vocabulary-merge-phase-0)
5. [Feature B — Cascading Intelligence (Phase 1)](#5-feature-b--cascading-intelligence-phase-1)
6. [Feature A — Scene Starters (Phase 2)](#6-feature-a--scene-starters-phase-2)
7. [Feature C — Explore Drawer (Phase 3)](#7-feature-c--explore-drawer-phase-3)
8. [Polish & Integration (Phase 4)](#8-polish--integration-phase-4)
9. [Collective Intelligence Engine (Phase 5)](#9-collective-intelligence-engine-phase-5)
10. [Self-Improving Scorer (Phase 6)](#10-self-improving-scorer-phase-6)
11. [Advanced Learning Systems (Phase 7)](#11-advanced-learning-systems-phase-7)
12. [Admin Command Centre (Phase 7.11)](#12-admin-command-centre-phase-711)
13. [The 4 Optimizer Tiers — Cross-Feature Matrix](#13-the-4-optimizer-tiers--cross-feature-matrix)
14. [Data Structures](#14-data-structures)
15. [Output Files — What the Cron Produces](#15-output-files--what-the-cron-produces)
16. [File Impact Map](#16-file-impact-map)
17. [Build Phase Summary](#17-build-phase-summary)
18. [Risk Register](#18-risk-register)
19. [Success Metrics](#19-success-metrics)
20. [Timeline Projection — What Happens Over 6 Months](#20-timeline-projection--what-happens-over-6-months)

---

## 1. Problem Statement

### Current State

The prompt builder has 17,078 vocabulary phrases across 48 JSON files. Only 3,955 (23.2%) are connected to the UI. The remaining 13,123 phrases — weather venues, commodity textures, shared adjectives, atmospheric descriptions — sit in fully-built helper functions that lead nowhere.

The 12 category dropdowns operate independently. Selecting "astronaut" in Subject has zero influence on what appears in Action, Environment, or Lighting. The user must mentally maintain coherence across all 12 categories themselves.

The scoring system uses static, hand-curated weights. It cannot learn from user behaviour, cannot detect its own inaccuracies, and cannot improve without manual code changes.

### Target State

A prompt builder that thinks with the user AND gets smarter every day without code changes:

- **Scene Starters** give beginners a coherent launchpad (25 free / 200 Pro)
- **Cascading Intelligence** makes every dropdown contextually aware of all other selections
- **Explore Drawer** gives power users access to the full vocabulary depth
- **Collective Intelligence** learns from every high-quality prompt built across all users
- **Self-Improving Scorer** automatically recalibrates its own weights against real outcomes
- **Advanced Learning** detects anti-patterns, tracks iterations, finds magic combinations, learns per-platform, A/B tests improvements, crowdsources vocabulary, responds to temporal trends, compresses prompts intelligently, and incorporates direct user feedback

All features work across all 4 optimizer tiers (CLIP, Midjourney, Natural Language, Plain Language) and all 42 platforms.

---

## 2. Feature Overview

| #   | Feature                            | What it does                                                                 | Tier                  | Phase | Status           |
| --- | ---------------------------------- | ---------------------------------------------------------------------------- | --------------------- | ----- | ---------------- |
| D   | **Vocabulary Merge**               | Curate + map weather/commodity/shared phrases into prompt builder categories | Free (data layer)     | 0     | ✅ COMPLETE      |
| B   | **Cascading Intelligence**         | Reorder downstream dropdowns based on upstream selections                    | Free                  | 1     | ✅ COMPLETE      |
| A   | **Scene Starters**                 | Pre-populate categories from curated scene templates (hierarchical dropdown) | Free (25) / Pro (200) | 2     | ✅ COMPLETE      |
| C   | **Explore Drawer**                 | Expandable panel showing full vocabulary per category, contextually filtered | Free                  | 3     | ✅ COMPLETE      |
| —   | **Polish & Integration**           | Cross-feature wiring, analytics, fluid typography, docs                      | —                     | 4     | ✅ COMPLETE      |
| —   | **Collective Intelligence Engine** | Telemetry + co-occurrence learning + auto-scene generation                   | —                     | 5     | ✅ COMPLETE      |
| —   | **Self-Improving Scorer**          | Weight recalibration + per-tier models + threshold auto-adjustment           | —                     | 6     | ✅ COMPLETE      |
| —   | **Advanced Learning Systems**      | 10 additional learning dimensions + Admin Command Centre                     | —                     | 7     | ⚠️ 7/10 COMPLETE |

**Build order:** 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7

---

## 3. Architecture — Code vs Data

### Critical Distinction: Code Never Changes, Data Changes

The code is the engine (deployed once, rarely changes). The data is the fuel (updated nightly via cron). Like a sat nav: the software doesn't rewrite itself when a new road opens — it downloads an updated MAP and the same software routes you differently.

### Three-Layer Architecture

```
LAYER 1 — CODE (deployed by you)
┌─────────────────────────────────────────────────┐
│  vocabulary-loader.ts   → "Read weights file,   │
│                            multiply term score   │
│                            × weight, sort desc"  │
│  prompt-scorer.ts       → "Read scoring-weights, │
│                            apply factor × weight, │
│                            sum to total"         │
│  cascade-engine.ts      → "Read co-occurrence    │
│                            matrix, find pairs,   │
│                            boost scores"         │
│                                                 │
│  Code is GENERIC. It doesn't know what          │
│  "cyberpunk" is. It reads numbers and does maths.│
└─────────────────────────────────────────────────┘
            ↑ reads from

LAYER 2 — WEIGHT FILES (cron updates nightly)
┌─────────────────────────────────────────────────┐
│  scoring-weights.json                           │
│  co-occurrence-matrix.json                      │
│  anti-patterns.json                             │
│  magic-combos.json                              │
│  term-quality-scores.json (per platform)        │
│  redundancy-groups.json                         │
│  compression-profiles.json                      │
│  scene-candidates.json                          │
│  trending-terms.json                            │
│  skill-thresholds.json                          │
│  temporal-boosts.json                           │
│  scorer-health-report.json                      │
│  collision-matrix.json                          │
│                                                 │
│  Just JSON files with numbers. Sit on CDN.      │
│  Cron overwrites nightly. No deployment needed. │
│  Website picks them up automatically.           │
└─────────────────────────────────────────────────┘
            ↑ generated from

LAYER 3 — RAW TELEMETRY (database)
┌─────────────────────────────────────────────────┐
│  prompt_events table: 80,000+ rows              │
│    selections, score, scoreFactors, platform,   │
│    tier, outcome signals, timestamp             │
│  iteration_sessions table: links sequential     │
│    prompt attempts within a session             │
│  feedback_events table: 👍👌👎 responses        │
│  ab_test_assignments table: variant tracking    │
└─────────────────────────────────────────────────┘
```

### What DOES Require Code Changes

| Requires code change                                    | Why                                              |
| ------------------------------------------------------- | ------------------------------------------------ |
| Adding a NEW scoring factor (e.g., "emoji density")     | Calculation logic is code; weight can be learned |
| Adding a NEW signal type (e.g., "user rated 1-5 stars") | Telemetry endpoint needs new field               |
| UI changes (Explore Drawer, Scene Selector)             | Always code                                      |
| New vocabulary files                                    | Import logic is code                             |
| Bug fixes                                               | Always code                                      |

Everything else — which weights, which terms, which combinations, which thresholds — happens through data automatically.

### How Weight Files Reach the Frontend

| Option                                     | Mechanism                                                              | Freshness      | Complexity |
| ------------------------------------------ | ---------------------------------------------------------------------- | -------------- | ---------- |
| **A — Build-time bundling** (start here)   | Cron writes to `src/data/learned/`, next Vercel build picks up         | Per deployment | Zero       |
| **B — API endpoint**                       | `GET /api/learned-weights`, frontend fetches on page load (cached 1hr) | Within 1 hour  | Low        |
| **C — CDN-hosted JSON** (graduate to this) | Vercel Edge Config / S3 / R2, frontend fetches from CDN                | Within minutes | Medium     |

**Recommendation:** Start with Option A (zero infrastructure). Graduate to B/C once system is trusted.

---

## 4. Feature D — Vocabulary Merge (Phase 0)

**Status:** ✅ COMPLETE

### 4.1 What Was Merged — Actual Results

| Source                             | Category Target | Actual Count | Notes                                                             |
| ---------------------------------- | --------------- | ------------ | ----------------------------------------------------------------- |
| curated-weather-lighting.json      | Lighting        | 248          | Urban light phrases — "sodium-vapour haze", "neon on wet asphalt" |
| curated-weather-environment.json   | Environment     | 1,032        | City venue phrases — "Tsukiji Fish Market", "Corniche waterfront" |
| curated-weather-atmosphere.json    | Atmosphere      | 422          | Weather conditions — "rain-slicked", "fog-shrouded"               |
| curated-commodity-action.json      | Action          | 988          | Commodity-related actions                                         |
| curated-commodity-atmosphere.json  | Atmosphere      | 437          | Commodity atmosphere phrases                                      |
| curated-commodity-colour.json      | Colour          | 40           | Commodity colour terms                                            |
| curated-commodity-environment.json | Environment     | 1,308        | Commodity environments                                            |
| curated-commodity-lighting.json    | Lighting        | 280          | Commodity lighting phrases                                        |
| curated-commodity-materials.json   | Materials       | 354          | Commodity material textures                                       |
| curated-commodity-subject.json     | Subject         | 212          | Commodity subject terms                                           |
| curated-shared-atmosphere.json     | Atmosphere      | 71           | Shared adjectives (atmosphere)                                    |
| curated-shared-colour.json         | Colour          | 22           | Shared colour adjectives                                          |
| curated-shared-composition.json    | Composition     | 40           | Shared composition terms                                          |
| curated-shared-lighting.json       | Lighting        | 24           | Shared lighting adjectives                                        |
| curated-shared-materials.json      | Materials       | 49           | Shared material adjectives                                        |
| curated-shared-style.json          | Style           | 30           | Shared style terms                                                |

### 4.2 Merge Summary

| Metric                               | Value                                                                                         |
| ------------------------------------ | --------------------------------------------------------------------------------------------- |
| **Core vocabulary (12 categories)**  | 3,501 terms                                                                                   |
| **Merged vocabulary (9 categories)** | 5,557 terms                                                                                   |
| **Combined total**                   | 9,058 terms                                                                                   |
| **Merged categories**                | 9 (action, atmosphere, colour, composition, environment, lighting, materials, style, subject) |
| **Unchanged categories**             | 3 (camera: 298, fidelity: 282, negative: 313 — no merged data)                                |

### 4.3 Actual Chip Counts Per Category (After Merge)

| Category    | Core      | Merged    | Total     |
| ----------- | --------- | --------- | --------- |
| Action      | 277       | 988       | 1,265     |
| Atmosphere  | 305       | 930       | 1,235     |
| Colour      | 294       | 62        | 356       |
| Composition | 279       | 40        | 319       |
| Environment | 279       | 2,340     | 2,619     |
| Lighting    | 302       | 552       | 854       |
| Materials   | 285       | 403       | 688       |
| Style       | 295       | 30        | 325       |
| Subject     | 292       | 212       | 504       |
| Camera      | 298       | 0         | 298       |
| Fidelity    | 282       | 0         | 282       |
| Negative    | 313       | 0         | 313       |
| **TOTAL**   | **3,501** | **5,557** | **9,058** |

### 4.4 Installed Files

| File                                                       | Lines | Purpose                                                       |
| ---------------------------------------------------------- | ----- | ------------------------------------------------------------- |
| `src/data/vocabulary/merged/index.ts`                      | 232   | Loader module — `getMergedOptions()`, `getMergedCount()`      |
| `src/data/vocabulary/merged/merge-manifest.json`           | —     | Source tracking with version, summary, audit sources          |
| `src/data/vocabulary/merged/*-merged.json` (9 files)       | —     | Merged vocabulary per category                                |
| `src/data/vocabulary/merged/curated-*.json` (16 files)     | —     | Curated source files (weather × 3, commodity × 7, shared × 6) |
| `src/data/vocabulary/merged/*-audit-report.json` (3 files) | —     | Audit reports: commodity, shared, weather                     |
| `src/lib/vocabulary/vocabulary-loader.ts`                  | —     | Updated to load merged vocab — core first, merged appended    |

### 4.5 Tests

- `src/__tests__/vocabulary-merge.integrity.test.ts` (230 lines) — validates merge manifest, option counts, no duplicates, category mapping

---

## 5. Feature B — Cascading Intelligence (Phase 1)

**Status:** ✅ COMPLETE

### 5.1 What Was Built

The intelligence layer provides contextual awareness across all 12 categories. When a user selects "cyberpunk hacker" in Subject, the system knows which lighting, environment, atmosphere, and style terms are most coherent with that selection.

### 5.2 Intelligence Data (Actual)

| Data File                | Location                        | Key Metric                                                                                                                                                                                                           |
| ------------------------ | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `semantic-clusters.json` | `src/data/prompt-intelligence/` | 50 clusters (cyberpunk, steampunk, vaporwave, cottagecore, dark-academia, gothic, art-deco, solarpunk, brutalist, noir, fantasy-epic, horror, sci-fi-space, etc.) with 1,516 total member terms across 11 categories |
| `direct-affinities.json` | `src/data/prompt-intelligence/` | 250 term-to-term relationships                                                                                                                                                                                       |
| `semantic-tags.json`     | `src/data/prompt-intelligence/` | 2,032 options tagged out of 2,045 total (99.4% coverage) across 12 categories                                                                                                                                        |
| `conflicts.json`         | `src/data/prompt-intelligence/` | 145 conflict rules                                                                                                                                                                                                   |
| `platform-hints.json`    | `src/data/prompt-intelligence/` | Hints for all 42 platforms                                                                                                                                                                                           |
| `market-moods.json`      | `src/data/prompt-intelligence/` | 11 market mood definitions                                                                                                                                                                                           |
| `families.json`          | `src/data/prompt-intelligence/` | Family groupings for vocabulary                                                                                                                                                                                      |

All data files have TypeScript declaration files (`.json.d.ts`) for type safety.

A mirrored copy lives at `src/data/vocabulary/intelligence/` with its own `index.ts` loader and `README.md`.

### 5.3 Engine Files (Actual)

| File                                                           | Lines | Purpose                                                                                                                               |
| -------------------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/prompt-intelligence/index.ts`                         | 648   | Public API — single import point for all intelligence functionality                                                                   |
| `src/lib/prompt-intelligence/types.ts`                         | 638   | Type definitions — imports from all learning lookups (co-occurrence, anti-pattern, collision, weak-term, redundancy, combo, platform) |
| `src/lib/prompt-intelligence/coherent-randomise.ts`            | 382   | Coherent randomisation engine                                                                                                         |
| `src/lib/prompt-intelligence/combine.ts`                       | 365   | Term combination logic                                                                                                                |
| `src/lib/prompt-intelligence/phrase-filter.ts`                 | 476   | Phrase filtering with intelligence context                                                                                            |
| `src/lib/prompt-intelligence/get-families.ts`                  | 67    | Family lookup helper                                                                                                                  |
| `src/lib/prompt-intelligence/engines/index.ts`                 | 83    | Engine sub-module barrel export                                                                                                       |
| `src/lib/prompt-intelligence/engines/suggestion-engine.ts`     | 1,331 | Core suggestion engine — cascade scoring, contextual reordering                                                                       |
| `src/lib/prompt-intelligence/engines/integration.ts`           | 729   | Integration layer connecting all intelligence systems                                                                                 |
| `src/lib/prompt-intelligence/engines/platform-optimization.ts` | 589   | Platform-specific optimisation per tier                                                                                               |
| `src/lib/prompt-intelligence/engines/market-mood-engine.ts`    | 576   | Market mood influence on vocabulary                                                                                                   |
| `src/lib/prompt-intelligence/engines/conflict-detection.ts`    | 567   | Real-time conflict detection between selected terms                                                                                   |

**Total prompt intelligence LOC:** 6,451

### 5.4 Tests

- `src/__tests__/cascading-intelligence.integrity.test.ts` (299 lines) — validates cluster structure, affinity format, tag coverage, conflict rules
- `src/lib/prompt-intelligence/engines/__tests__/integration-scoring.test.ts` — scoring integration
- `src/lib/prompt-intelligence/engines/tests/` — individual engine tests (conflict-detection, integration, market-mood, platform-optimization, suggestion-engine)

---

## 6. Feature A — Scene Starters (Phase 2)

**Status:** ✅ COMPLETE

### 6.1 What Was Built

200 curated scenes (25 free, 175 Pro) across 23 worlds. Each scene pre-fills up to 8 categories with contextually coherent terms, includes tier guidance for all 4 optimizer tiers, and provides flavour phrases for the Explore Drawer.

### 6.2 Scene Data (Actual)

| Metric           | Value                                                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Total scenes** | 200                                                                                                                      |
| **Free scenes**  | 25 (across 5 worlds: landscapes-and-worlds, mood-and-atmosphere, portraits-and-people, style-forward, trending-seasonal) |
| **Pro scenes**   | 175 (across 18 worlds)                                                                                                   |
| **Total worlds** | 23                                                                                                                       |
| **Scene keys**   | id, name, world, description, emoji, tags, tier, prefills, tierGuidance, flavourPhrases                                  |

### 6.3 World Breakdown (Actual)

| World                      | Count | Tier |
| -------------------------- | ----- | ---- |
| abstract-and-experimental  | 8     | Pro  |
| animals-and-creatures      | 8     | Pro  |
| architecture-and-interiors | 10    | Pro  |
| cinematic                  | 12    | Pro  |
| commodity-inspired         | 10    | Pro  |
| cultural-and-ceremonial    | 10    | Pro  |
| dark-and-horror            | 8     | Pro  |
| fantasy-and-mythology      | 12    | Pro  |
| food-and-still-life        | 8     | Pro  |
| historical-eras            | 12    | Pro  |
| landscapes-and-worlds      | 5     | Free |
| micro-and-macro            | 5     | Pro  |
| mood-and-atmosphere        | 5     | Free |
| nature-and-elements        | 10    | Pro  |
| portraits-and-people       | 5     | Free |
| portraiture-and-character  | 12    | Pro  |
| sci-fi-and-future          | 12    | Pro  |
| seasonal                   | 8     | Pro  |
| style-forward              | 5     | Free |
| trending-seasonal          | 5     | Free |
| urban-and-street           | 12    | Pro  |
| weather-driven             | 8     | Pro  |
| whimsical-and-surreal      | 10    | Pro  |

### 6.4 Installed Files

| File                                          | Lines | Purpose                                                                      |
| --------------------------------------------- | ----- | ---------------------------------------------------------------------------- |
| `src/data/scenes/scene-starters.json`         | —     | 200 scene definitions with full prefills, tier guidance, flavour phrases     |
| `src/data/scenes/scene-starters.schema.json`  | 327   | JSON Schema validation                                                       |
| `src/data/scenes/worlds.ts`                   | 239   | World definitions and ordering                                               |
| `src/data/scenes/index.ts`                    | —     | Scene data barrel export                                                     |
| `src/types/scene-starters.ts`                 | 291   | TypeScript types mirroring schema exactly                                    |
| `src/components/providers/scene-selector.tsx` | 1,110 | Hierarchical accordion dropdown with world grouping, free/pro gating, search |

Also: `src/data/vocabulary/prompt-builder/scene-starters.json` (25 free scenes — legacy location)

### 6.5 Tests

- `src/__tests__/scene-starters.integrity.test.ts` (267 lines) — validates all prefill values exist in vocabulary, tier guidance structure, world assignments

---

## 7. Feature C — Explore Drawer (Phase 3)

**Status:** ✅ COMPLETE (including deferred items from Phase 4)

### 7.1 What Was Built

Below each category dropdown, a collapsible section showing full vocabulary as browseable, searchable chip clouds grouped by source (Core, Weather, Commodity, Shared). Includes scene flavour phrase tab, tier-aware badges on all chips, and cascade relevance ordering.

### 7.2 Tier-Aware Badges (✅ IMPLEMENTED)

All 4 tier badges are implemented via `getTierBadge()` function using word-count heuristics:

| Tier               | Badge                 | Logic                                                 |
| ------------------ | --------------------- | ----------------------------------------------------- |
| **Tier 1 (CLIP)**  | ★                     | 1–2 word terms (token-efficient for weighted prompts) |
| **Tier 2 (MJ)**    | ◆                     | 2–4 word terms (Midjourney keyword sweet-spot)        |
| **Tier 3 (NL)**    | 💬                    | 3+ word terms (natural language descriptive)          |
| **Tier 4 (Plain)** | ⚡ simple / ⚠ complex | 1–2 words simple, 3+ complex                          |

### 7.3 Cascade Relevance Ordering (✅ IMPLEMENTED)

Chips sorted by cascade score when `cascadeScores` map is provided and active tab is not 'scene'. Higher-scoring terms appear first, giving users the most contextually relevant options at the top.

### 7.4 Installed Files

| File                                          | Lines | Purpose                                                                                                                         |
| --------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/providers/explore-drawer.tsx` | 805   | Full explore drawer with tabs (All, Core, Weather, Commodity, Shared, Scene), search, pagination, tier badges, cascade ordering |

### 7.5 Integration

- Imported in `prompt-builder.tsx` at line 110: `import { ExploreDrawer, type CascadeScoreMap }`
- Rendered at line 1500 within prompt builder layout
- Receives `sceneFlavourPhrases`, `cascadeScores`, `platformTier` props

---

## 8. Polish & Integration (Phase 4)

**Status:** ✅ COMPLETE

### 8.1 What Was Built

| Step | Task                                                             | Status                                                     |
| ---- | ---------------------------------------------------------------- | ---------------------------------------------------------- |
| 4.1  | Scene Starters × Explore Drawer — flavour phrases as "Scene" tab | ✅ Wired in explore-drawer.tsx and scene-selector.tsx      |
| 4.2  | Analytics integration — cascade_reorder_triggered event          | ✅ Wired in prompt-builder.tsx                             |
| 4.3  | All 4 tier badges on Explore Drawer chips                        | ✅ Implemented (was originally deferred, now complete)     |
| 4.4  | Cascade relevance chip ordering                                  | ✅ Implemented (was originally deferred, now complete)     |
| 4.5  | Fluid typography — clamp() throughout                            | ✅ 92 uses in scene-selector.tsx, 35 in explore-drawer.tsx |

### 8.2 Tests

- `src/components/providers/__tests__/phase-4-evolution.test.ts` — Phase 4 integration tests

### 8.3 Note on Deferred Items

The original plan deferred two items for the Explore Drawer: (1) all 4 tier badges and (2) cascade relevance chip ordering. **Both have been implemented** and shipped as part of the Phase 3/4 build. The deferred item list is now empty.

---

## 9. Collective Intelligence Engine (Phase 5)

**Status:** ✅ COMPLETE

### 9.1 The Learning Loop

```
User builds prompt → copies/saves/reuses
    ↓
System scores prompt (existing optimizer)
    ↓
Score ≥ 90%? + passes quality gates?
    ↓ YES
Log telemetry anonymously (no user IDs, no IPs — GDPR safe)
    ↓
Nightly cron aggregates → computes co-occurrence matrix,
  sequence patterns, auto-scene candidates
    ↓
Outputs: co-occurrence-weights.json, scene-candidates.json
  deployed to CDN / bundled
    ↓
Frontend vocabulary-loader.ts blends learned weights
  with curated clusters
    ↓
Dropdowns reorder based on real usage data
```

### 9.2 Three Learning Layers

**Layer 1 — Co-occurrence Frequency (dropdown reordering)**

Count how often term pairs appear together in 90%+ prompts. Blend with curated clusters:

`finalScore = (learnedWeight × co-occurrence) + (curatedWeight × clusterScore)`

Early: 70/30 curated/learned. Month 6: 30/70 curated/learned. Per-tier learning: same pair may score differently on MJ vs Canva.

**Layer 2 — Sequence Patterns (what users select first/second/third)**

Track selection order across sessions. Learn which category users fill first when fixing a prompt. Guide new users subtly (next empty dropdown highlights).

**Layer 3 — Auto-generated Scene Starters**

When 237+ prompts share similar selections and score 90%+, propose new scene. Goes to review queue. "Trending/Seasonal" world populated by community-learned scenes.

### 9.3 Five Quality Gates

| Gate                             | What it prevents                                                    |
| -------------------------------- | ------------------------------------------------------------------- |
| **Score threshold (90%+)**       | Eliminates broken/incomplete prompts                                |
| **Minimum 4+ categories filled** | Eliminates trivial prompts                                          |
| **Diversity filter**             | Weights uncommon-but-high-rated combos higher than popular defaults |
| **Decay over time**              | 6-month-old data weighs less than last week's                       |
| **Platform-specific learning**   | Separate models per tier (what works on MJ ≠ Canva)                 |

### 9.4 Telemetry & Database (Actual)

| Component           | File                                           | Lines |
| ------------------- | ---------------------------------------------- | ----- |
| Telemetry endpoint  | `src/app/api/prompt-telemetry/route.ts`        | 264   |
| Telemetry client    | `src/lib/telemetry/prompt-telemetry-client.ts` | 322   |
| A/B hash util       | `src/lib/telemetry/ab-hash.ts`                 | 85    |
| Database operations | `src/lib/learning/database.ts`                 | 721   |

Telemetry wired into `prompt-builder.tsx` at two copy paths (lines 1143 and 1217) as fire-and-forget.

### 9.5 14-Layer Aggregation Cron (Actual)

The nightly aggregation cron (`src/app/api/learning/aggregate/route.ts`, 1,354 lines) runs at 03:00 UTC daily and executes 14 computation layers:

| Layer | Phase    | What it computes                       |
| ----- | -------- | -------------------------------------- |
| 1     | 5 — 5.3b | Co-occurrence matrix                   |
| 2     | 5 — 5.3c | Sequence patterns                      |
| 3     | 5 — 5.3d | Scene candidates                       |
| 4     | 6        | Weight recalibration (scoring-weights) |
| 5     | 6        | Category value discovery               |
| 6     | 6        | Term quality scores                    |
| 7     | 6        | Threshold discovery                    |
| 8     | 6        | Scorer health report                   |
| 9     | 7.1      | Anti-pattern detection                 |
| 10    | 7.1      | Collision matrix                       |
| 11    | 7.2      | Iteration tracking insights            |
| 12    | 7.3      | Redundancy detection                   |
| 13    | 7.4      | Magic combos                           |
| 14a   | 7.5      | Platform term quality                  |
| 14b   | 7.5      | Platform co-occurrence                 |

Security: Cron secret validation (PROMAGEN_CRON_SECRET), advisory lock to prevent concurrent runs, returns 404 for invalid auth.

### 9.6 Learning API Routes (Actual)

14 API routes serve learning data to the frontend:

| Route                                  | Lines | Phase |
| -------------------------------------- | ----- | ----- |
| `/api/learning/aggregate`              | 1,354 | 5–7.5 |
| `/api/learning/co-occurrence`          | 75    | 5     |
| `/api/learning/sequences`              | 75    | 5     |
| `/api/learning/scene-candidates`       | 75    | 5     |
| `/api/learning/scoring-weights`        | 78    | 6     |
| `/api/learning/anti-patterns`          | 80    | 7.1   |
| `/api/learning/collisions`             | 82    | 7.1   |
| `/api/learning/iteration-insights`     | 83    | 7.2   |
| `/api/learning/redundancy-groups`      | 82    | 7.3   |
| `/api/learning/magic-combos`           | 80    | 7.4   |
| `/api/learning/platform-term-quality`  | 88    | 7.5   |
| `/api/learning/platform-co-occurrence` | 88    | 7.5   |
| `/api/learning/ab-tests`               | 138   | 7.6   |
| `/api/learning/ab-assignment`          | 106   | 7.6   |

### 9.7 Tests

- `src/lib/learning/__tests__/aggregate-phase6.test.ts` (527 lines) — aggregation pipeline integration tests

---

## 10. Self-Improving Scorer (Phase 6)

**Status:** ✅ COMPLETE

### 10.1 The Problem

Current scorer uses static weights based on educated guesses. But what if prompts scoring 72% get copied more than prompts scoring 95%? The scorer is miscalibrated. Only way to know: compare scores against real outcomes.

### 10.2 Seven Outcome Signals

| #   | Signal                                                  | Strength       | Volume  |
| --- | ------------------------------------------------------- | -------------- | ------- |
| 1   | Prompt copied                                           | Weakest        | Highest |
| 2   | Copied + user didn't return within 60s                  | Moderate       | High    |
| 3   | Prompt saved to library                                 | Strong         | Medium  |
| 4   | Prompt loaded from library and reused                   | Highest        | Low     |
| 5   | Prompt loaded and modified slightly                     | Category-level | Low     |
| 6   | Same combinations across many users                     | Convergent     | Medium  |
| 7   | Prompt structure patterns correlating with copies/saves | Structural     | Medium  |

### 10.3 Five Self-Improvement Mechanisms (All Implemented)

**Mechanism 1 — Weight Recalibration** (`weight-recalibration.ts`, 471 lines)
Measure correlation between each scoring factor and outcomes. Recalibrate via Pearson correlation → normalise to weights summing to 1.0.

**Mechanism 2 — Threshold Discovery** (`threshold-discovery.ts`, 366 lines)
Plot score vs copy rate. Find the "knee" where quality plateaus. Auto-adjust learning threshold.

**Mechanism 3 — Per-Tier Scoring Models** (via `category-value-discovery.ts`, 380 lines)
Four separate scoring models per tier with different factor weights.

**Mechanism 4 — Category Value Discovery** (`category-value-discovery.ts`, 380 lines)
Learn which categories are high-value vs low-value per tier.

**Mechanism 5 — Term-Level Quality Scores** (`term-quality-scoring.ts`, 398 lines)
Each term gets per-tier quality score. High-quality terms boosted in dropdown ordering.

### 10.4 The Meta-Loop — Scoring Scores Itself

`scorer-health.ts` (388 lines) measures score-outcome correlation. If correlation improves month-over-month, system genuinely learning. If drops, flag for manual review.

### 10.5 Full Learning Engine File Inventory (Actual)

| File                               | Lines | Phase | Purpose                                         |
| ---------------------------------- | ----- | ----- | ----------------------------------------------- |
| `database.ts`                      | 721   | 5     | Secure parameterized database operations        |
| `constants.ts`                     | 335   | 5     | Learning pipeline configuration constants       |
| `decay.ts`                         | 190   | 5     | Time decay functions for telemetry weighting    |
| `outcome-score.ts`                 | 529   | 5–6   | Compute outcome scores from 7 signals           |
| `co-occurrence.ts`                 | 260   | 5     | Co-occurrence matrix computation                |
| `co-occurrence-lookup.ts`          | 131   | 5     | Fast co-occurrence pair lookup                  |
| `sequence-patterns.ts`             | 347   | 5     | Selection order pattern analysis                |
| `scene-candidates.ts`              | 414   | 5     | Auto-scene candidate generation                 |
| `weight-recalibration.ts`          | 471   | 6     | Factor-outcome correlation → weight adjustment  |
| `threshold-discovery.ts`           | 366   | 6     | Quality threshold knee detection                |
| `category-value-discovery.ts`      | 380   | 6     | Per-tier category importance ranking            |
| `term-quality-scoring.ts`          | 398   | 6     | Per-term per-tier quality scores                |
| `scorer-health.ts`                 | 388   | 6     | Meta-loop: score-outcome correlation monitoring |
| `anti-pattern-detection.ts`        | 370   | 7.1   | Detect term pairs that kill prompts             |
| `anti-pattern-lookup.ts`           | 144   | 7.1   | Fast anti-pattern pair lookup                   |
| `collision-matrix.ts`              | 346   | 7.1   | Terms competing for same space                  |
| `collision-lookup.ts`              | 183   | 7.1   | Fast collision pair lookup                      |
| `iteration-tracking.ts`            | 642   | 7.2   | Session sequence analysis                       |
| `weak-term-lookup.ts`              | 177   | 7.2   | Terms most often replaced                       |
| `redundancy-detection.ts`          | 574   | 7.3   | Synonym/interchangeable term detection          |
| `redundancy-lookup.ts`             | 246   | 7.3   | Redundancy group lookup                         |
| `magic-combo-mining.ts`            | 595   | 7.4   | Frequent itemset mining (trios/quads)           |
| `combo-lookup.ts`                  | 366   | 7.4   | Fast magic combo lookup                         |
| `platform-term-quality.ts`         | 520   | 7.5   | Per-platform term quality scoring               |
| `platform-term-quality-lookup.ts`  | 266   | 7.5   | Platform-specific term lookup                   |
| `platform-co-occurrence.ts`        | 423   | 7.5   | Per-platform co-occurrence patterns             |
| `platform-co-occurrence-lookup.ts` | 331   | 7.5   | Platform co-occurrence lookup                   |
| `ab-testing.ts`                    | 988   | 7.6   | A/B test lifecycle management                   |
| `ab-assignment.ts`                 | 88    | 7.6   | Deterministic hash-based user assignment        |

**Total learning engine LOC:** 11,189

### 10.6 Tests

24 test files in `src/lib/learning/__tests__/`:

- `weight-recalibration.test.ts` (499 lines)
- `threshold-discovery.test.ts` (314 lines)
- `category-value-discovery.test.ts` (436 lines)
- `term-quality-scoring.test.ts` (488 lines)
- `scorer-health.test.ts` (426 lines)
- `outcome-score.test.ts` (352 lines)
- `anti-pattern-detection.test.ts` (550 lines)
- `collision-matrix.test.ts` (548 lines)
- `negative-pattern-integration.test.ts` (394 lines)
- `iteration-tracking.test.ts` (552 lines)
- `iteration-integration.test.ts` (354 lines)
- `redundancy-detection.test.ts` (648 lines)
- `redundancy-integration.test.ts` (370 lines)
- `magic-combo-mining.test.ts` (746 lines)
- `combo-lookup.test.ts` (404 lines)
- `combo-integration.test.ts` (382 lines)
- `confidence-multiplier.test.ts` (509 lines)
- `platform-co-occurrence.test.ts` (508 lines)
- `platform-co-occurrence-lookup.test.ts` (411 lines)
- `platform-term-quality.test.ts` (666 lines)
- `platform-term-quality-lookup.test.ts` (379 lines)
- `ab-testing.test.ts` (890 lines)
- `ab-assignment.test.ts` (232 lines)
- `aggregate-phase6.test.ts` (527 lines)

---

## 11. Advanced Learning Systems (Phase 7)

Ten additional learning dimensions. Seven complete, three remaining.

### 7.1 — Negative Pattern Learning ✅ COMPLETE

Learn what DOESN'T work from abandoned/low-scoring prompts.

**Anti-pattern detection** (`anti-pattern-detection.ts`, 370 lines): Count term pairs that appear frequently in low-scoring prompts but rarely in high-scoring ones. When user selects "oil painting", actively DEMOTE "8k resolution" and "ray tracing".

**Collision matrix** (`collision-matrix.ts`, 346 lines): Pairs that occupy the same "space" and compete. "golden hour" + "moonlight" → each alone 80%+, both together 23%.

**Lookups:** `anti-pattern-lookup.ts` (144 lines), `collision-lookup.ts` (183 lines)

**API routes:** `/api/learning/anti-patterns` (80 lines), `/api/learning/collisions` (82 lines)

**Output files:** `anti-patterns.json`, `collision-matrix.json`

### 7.2 — Iteration Tracking ✅ COMPLETE

Track sequential prompt attempts within a session.

**Engine** (`iteration-tracking.ts`, 642 lines): Session sequence analysis — which category users add FIRST when fixing, which changes produce biggest score jumps, which terms get REPLACED most.

**Weak term lookup** (`weak-term-lookup.ts`, 177 lines): Terms most often replaced by users.

**Sequence patterns** (`sequence-patterns.ts`, 347 lines): Selection order analysis.

**API route:** `/api/learning/iteration-insights` (83 lines)

### 7.3 — Semantic Redundancy Detection ✅ COMPLETE

Detect terms that users pick interchangeably (never both) with similar outcomes.

**Engine** (`redundancy-detection.ts`, 574 lines): Identifies functionally identical terms.

**Lookup** (`redundancy-lookup.ts`, 246 lines): Fast redundancy group queries.

**API route:** `/api/learning/redundancy-groups` (82 lines)

**Output file:** `redundancy-groups.json`

### 7.4 — Higher-Order Combinations ✅ COMPLETE

Co-occurrence matrices capture PAIRS. Some magic only happens with 3+ terms together.

**Engine** (`magic-combo-mining.ts`, 595 lines): Frequent itemset mining (Apriori/FP-Growth) on telemetry data. Top 500–1,000 trios/quads.

**Lookup** (`combo-lookup.ts`, 366 lines): When 2 terms from a magic combo are selected, the third gets a massive boost.

**API route:** `/api/learning/magic-combos` (80 lines)

**Output file:** `magic-combos.json`

### 7.5 — Per-Platform Learning ✅ COMPLETE

Within Tier 1, Leonardo might handle "neon glow" brilliantly while NightCafe struggles.

**Platform term quality** (`platform-term-quality.ts`, 520 lines + lookup 266 lines): Per-platform term scoring with confidence-weighted tier fallback.

**Platform co-occurrence** (`platform-co-occurrence.ts`, 423 lines + lookup 331 lines): Platform-specific pair patterns.

**API routes:** `/api/learning/platform-term-quality` (88 lines), `/api/learning/platform-co-occurrence` (88 lines)

Cold start: `finalWeight = (platformData × platformConfidence) + (tierData × (1 - platformConfidence))` where `platformConfidence` scales 0→1 as sample count grows.

### 7.6 — A/B Testing Pipeline ✅ COMPLETE

Split-test scoring model changes before committing them.

**Engine** (`ab-testing.ts`, 988 lines): Full A/B test lifecycle — create, assign, measure, auto-promote/rollback. Statistical significance via p-value calculation.

**Assignment** (`ab-assignment.ts`, 88 lines): Deterministic hash-based user assignment (same user always gets same variant).

**Hashing** (`ab-hash.ts`, 85 lines): Stable hash for anonymous user bucketing.

**API routes:** `/api/learning/ab-tests` (138 lines — CRUD), `/api/learning/ab-assignment` (106 lines)

**Database:** `ab_test_assignments` table (user_hash → variant_id per test). Version 2.2.0 of `database.ts` includes A/B testing CRUD + prompt_events migration.

### 7.7 — Vocabulary Crowdsourcing ✅ COMPLETE

**Note:** The original plan listed Phase 7.7 as "User Skill Segmentation." During implementation, this was repurposed to "Vocabulary Crowdsourcing Pipeline" — a community-driven vocabulary expansion system with admin review workflow. Skill segmentation may be built as a separate future phase.

**What was built (3,535 LOC total):**

A complete pipeline for users to suggest new vocabulary terms, with intelligent auto-filtering and an admin review interface.

#### 7.7.1 Submission Pipeline

| Component          | File                                       | Lines | Purpose                                                                                                |
| ------------------ | ------------------------------------------ | ----- | ------------------------------------------------------------------------------------------------------ |
| Types              | `src/types/vocab-submission.ts`            | 420   | Full type system: VocabSubmission, SubmissionStatus, ConfidenceLevel, AdminAction types                |
| Auto-filter        | `src/lib/vocabulary/vocab-auto-filter.ts`  | 172   | 3-layer dedup: exact match, normalised match (case/whitespace/punctuation), fuzzy similarity threshold |
| Category suggester | `src/lib/vocabulary/category-suggester.ts` | 255   | Smart category suggestion using keyword pattern matching against existing vocabulary                   |
| Client hook        | `src/hooks/use-vocab-submission.ts`        | 152   | React hook for submission UI: validation, submission state, error handling                             |

#### 7.7.2 Admin Review API

| Handler                            | Purpose                                    |
| ---------------------------------- | ------------------------------------------ |
| GET                                | Fetch pending submissions with filtering   |
| POST (action: reject)              | Reject individual submission with reason   |
| POST (action: undo-reject)         | Rescue rejected submission back to pending |
| POST (action: accept-batch)        | Accept all visible pending terms           |
| POST (action: rescue)              | Rescue specific rejected term              |
| POST (action: reassign-category)   | Move term to different category            |
| POST (action: override-confidence) | Manually set confidence level              |

**File:** `src/app/api/admin/vocab-submissions/route.ts` (904 lines)

#### 7.7.3 Admin Review UI

**File:** `src/app/admin/vocab-submissions/page.tsx` (1,632 lines)

Features:

- Smart Batch Preview with accept/reject counts
- Clickable category badges for instant reassignment (cycles through all 12 categories)
- Clickable confidence badges (cycles low → medium → high → low)
- Category distribution anomaly alert (warns when >60% of batch in single category — bot/bulk detection)
- Live 30-second polling for new submissions
- Keyboard navigation (J = next, K = previous, X = reject, U = undo)
- Export-to-PR workflow for generating merge scripts

#### 7.7.4 Data Storage

**File:** `src/data/learned/vocab-submissions.json` — JSON file storage for submissions.

#### 7.7.5 Tests

- `src/__tests__/vocab-submission.integrity.test.ts` (537 lines, 69 tests passing) — validates 3-layer dedup, category suggestion, submission lifecycle, admin actions, confidence override, anomaly detection

### 7.8 — Temporal Intelligence ❌ NOT STARTED

Track seasonal trends, weekly patterns, and platform update impacts.

**Planned patterns:**

- Seasonal: "snow" terms → 340% more popular Nov–Feb
- Weekly: Weekend prompts 40% more experimental than weekday
- Platform updates: MJ v7 released → historical weights invalid → system enters "learning period"

**Output files:** `temporal-boosts.json`, `trending-terms.json`

**Note:** `trending-dock.tsx` and `trending-table.tsx` exist in the codebase but are unrelated homepage UI components, not the temporal learning engine.

**Effort:** 1 day

### 7.9 — Prompt Compression Intelligence ❌ NOT STARTED

Learn what can be REMOVED without affecting quality.

**Existing infrastructure:** A basic compression engine exists (`src/lib/compress.ts`, `src/lib/prompt-compression.ts`, `src/types/compression.ts`, `src/data/compression/compression-dictionary.json`) with synonym substitution and shorthand. This is the _static_ compression engine (abbreviations, redundant modifier removal).

**What's missing:** The _learned_ compression profiles — per-tier optimal prompt length and removable term sets based on telemetry analysis.

**Output file:** `compression-profiles.json`

**Effort:** 1 day

### 7.10 — User Feedback Invitation ❌ NOT STARTED

The biggest gap: we never ask. We infer quality from proxies. A direct signal is 10× more valuable.

**Existing infrastructure:** `feedback-bar.tsx` exists as a prompt quality indicator (poor/ok/great) but is NOT the post-copy feedback widget.

**What's missing:** The post-generation 👍👌👎 widget that appears 60s after copy or on next visit. Three buttons, one click.

**Design constraint:** The three-point scale must include explanatory text so users understand 👌 means "mediocre, not impressive" — not approval. Options: tooltips on each button, short labels beneath icons ("Nailed it" / "Just okay" / "Missed"), or words as primary UI with icons secondary.

**Data structure:** `feedback_events` table (prompt_event_id, rating, timestamp)

**Effort:** 1 day

---

## 12. Admin Command Centre (Phase 7.11)

**Status:** ⚠️ PARTIAL — Admin infrastructure live, scoring-health dashboard not built.

### 12.1 What's Built

| Component                | File                                                   | Lines | Status              |
| ------------------------ | ------------------------------------------------------ | ----- | ------------------- |
| Admin layout             | `src/app/admin/layout.tsx`                             | 55    | ✅ Live             |
| Admin navigation         | `src/app/admin/admin-nav.tsx`                          | 52    | ✅ Live             |
| Admin dashboard          | `src/app/admin/page.tsx`                               | 100   | ✅ Live             |
| Vocab submissions review | `src/app/admin/vocab-submissions/page.tsx`             | 1,632 | ✅ Live (Phase 7.7) |
| Scene candidates review  | `src/app/admin/scene-candidates/page.tsx`              | 526   | ✅ Live             |
| Exchange editor          | `src/app/admin/exchanges/page.tsx`                     | —     | ✅ Live             |
| Provider browser         | `src/app/admin/providers/page.tsx`                     | —     | ✅ Live             |
| Admin actions            | `src/app/admin/actions.ts`                             | —     | ✅ Live             |
| Scene candidates API     | `src/app/api/admin/learning/scene-candidates/route.ts` | 239   | ✅ Live             |
| Migration API            | `src/app/api/admin/learning/migrate/route.ts`          | 186   | ✅ Live             |

### 12.2 What's NOT Built — Scoring Health Dashboard

The `/admin/scoring-health` page with its 10 sections is not yet built:

| Section | Description                                                                 | Status                                |
| ------- | --------------------------------------------------------------------------- | ------------------------------------- |
| 1       | Scorer Health Overview (correlation metrics, trend arrows, sparklines)      | ❌                                    |
| 2       | Weight Drift Visualisation (line chart showing factor weight changes)       | ❌                                    |
| 3       | Per-Tier Scoring Models (side-by-side weight comparison, heatmap)           | ❌                                    |
| 4       | Term Quality Leaderboard (top/bottom 20 per category per tier)              | ❌                                    |
| 5       | Anti-Pattern Alerts (collision pairs, severity scores, manual overrides)    | ❌                                    |
| 6       | A/B Test Results (control vs variant, significance, promote/rollback)       | ❌                                    |
| 7       | Auto-Scene Candidate Review (preview, approve/reject, confidence)           | ✅ Built at `/admin/scene-candidates` |
| 8       | Temporal Trends (trending terms, seasonal patterns, platform update alerts) | ❌                                    |
| 9       | User Skill Distribution (pie chart, graduation funnel)                      | ❌                                    |
| 10      | Feedback Summary (👍👌👎 distribution, per-platform satisfaction)           | ❌                                    |

### 12.3 Access Control

Admin layout uses dark theme (bg gradient + white text). Not visible to regular users. Admin pages accessed directly via `/admin` URL.

**Estimated remaining effort:** ~4 days (Section 7 already exists)

---

## 13. The 4 Optimizer Tiers — Cross-Feature Matrix

| Feature                    | Tier 1 (CLIP, 13 platforms)                                            | Tier 2 (MJ, 2 platforms)                                | Tier 3 (NL, 10 platforms)                         | Tier 4 (Plain, 17 platforms)                                 |
| -------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------ |
| **Scene Starters**         | Full 8-category pre-fill. Auto-adds fidelity. CLIP affinity score.     | Full pre-fill. Suggests MJ params. MJ affinity score.   | Full pre-fill. Narrative seed. NL affinity score. | Reduced 3–5 categories. Simplified core. Complexity warning. |
| **Cascading Intelligence** | Full cascade. Extra tier1Boost weight. Quality terms always suggested. | Full cascade. MJ affinities (--niji, --weird).          | Full cascade. Favours tier3Phrase variants.       | Dampened cascade (0.5×). Fewer options. "Keep simple" bias.  |
| **Explore Drawer**         | CLIP weight badges (★1.3). Full depth.                                 | Parameter hints (◆ sweet-spot). Full depth.             | NL tooltips (💬 descriptive). Full depth.         | ⚡ simple / ⚠ complex badges. Collapsed by default.          |
| **Vocabulary Merge**       | All merged. CLIP-friendly boosted.                                     | All merged. MJ-compatible highlighted.                  | All merged. NL-friendly prioritised.              | Reduced set. Only tier4Simple terms.                         |
| **Co-occurrence Learning** | Per Tier 1 model. Keyword coherence patterns.                          | Per Tier 2 model. MJ-specific combos.                   | Per Tier 3 model. Narrative flow patterns.        | Per Tier 4 model. Simplicity patterns.                       |
| **Scoring Model**          | keywordDensity HIGH, fidelityTerms HIGH, negativePresent HIGH.         | coherence HIGH, tierFormatting HIGH, fidelityTerms LOW. | coherence HIGHEST, categoryCount LOW.             | promptLength HIGH INVERTED, fidelityTerms ZERO.              |
| **Term Quality**           | Per Tier 1 scores.                                                     | Per Tier 2 scores.                                      | Per Tier 3 scores.                                | Per Tier 4 scores.                                           |
| **Compression**            | Gentle. 15+ terms OK.                                                  | Medium. 8–12 + params.                                  | 2–3 sentences.                                    | Brutal. 5–8 words max.                                       |

### Tier Platform Lists

| Tier | Name              | Platforms                                                                                                                                                  |
| ---- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | CLIP-Based        | artguru, clipdrop, dreamlike, dreamstudio, getimg, jasper-art, leonardo, lexica, nightcafe, novelai, openart, playground, stability                        |
| 2    | Midjourney Family | bluewillow, midjourney                                                                                                                                     |
| 3    | Natural Language  | adobe-firefly, bing, flux, google-imagen, hotpot, ideogram, imagine-meta, microsoft-designer, openai, runway                                               |
| 4    | Plain Language    | artbreeder, artistly, canva, craiyon, deepai, fotor, freepik, myedit, photoleap, picsart, picwish, pixlr, remove-bg, simplified, visme, vistacreate, 123rf |

---

## 14. Data Structures

### 14.1 Scene Starter Entry

```json
{
  "id": "blade-runner-rain",
  "name": "Blade Runner Rain",
  "world": "cinematic",
  "description": "Neon-drenched cyberpunk street in heavy rain",
  "emoji": "🌃",
  "tags": ["cyberpunk", "rain", "neon"],
  "tier": "pro",
  "prefills": {
    "subject": ["cyberpunk hacker"],
    "action": ["walking dynamically"],
    "style": ["cinematic"],
    "environment": ["neon alleyway"],
    "lighting": ["neon glow", "rim lighting"],
    "atmosphere": ["rain", "ominous"],
    "colour": ["teal and orange"],
    "materials": ["chrome reflection"]
  },
  "tierGuidance": {
    "1": { "affinity": 9, "boostFidelity": true, "note": "Strong CLIP on cyberpunk+neon" },
    "2": {
      "affinity": 10,
      "params": "--ar 21:9 --s 750 --v 6",
      "note": "MJ excels at cinematic rain"
    },
    "3": {
      "affinity": 8,
      "narrative": "A lone figure walks through a rain-soaked neon-lit alleyway at night, reflections shimmering on wet pavement",
      "note": "Rich NL description"
    },
    "4": {
      "affinity": 5,
      "core": "cyberpunk city neon rain night",
      "note": "Too complex for plain parsers"
    }
  },
  "flavourPhrases": {
    "lighting": [
      "sodium-vapour haze",
      "neon reflected on wet asphalt",
      "holographic billboard flicker"
    ],
    "atmosphere": ["electric tension in the air", "steam rising from vents", "distant sirens"],
    "environment": ["rain-slicked concrete canyon", "towering megastructure shadows"]
  }
}
```

### 14.2 Vocabulary Submission Entry (Phase 7.7)

```json
{
  "id": "sub_abc123",
  "term": "ethereal mist",
  "suggestedCategory": "atmosphere",
  "status": "pending",
  "confidence": "high",
  "source": "user",
  "submittedAt": "2026-02-27T10:00:00Z",
  "dupCheck": {
    "exact": false,
    "normalised": false,
    "fuzzyScore": 0.42
  },
  "categorySuggestion": {
    "category": "atmosphere",
    "confidence": 0.89,
    "reasoning": "Pattern match: mist/fog/haze → atmosphere"
  }
}
```

### 14.3 Telemetry Event (~500 bytes)

```json
{
  "id": "evt_abc123",
  "sessionId": "sess_xyz789",
  "attemptNumber": 3,
  "selections": {
    "subject": ["cyberpunk hacker"],
    "action": ["running dynamically"],
    "style": ["cinematic"],
    "lighting": ["neon glow", "rim lighting"],
    "atmosphere": ["rain"]
  },
  "categoryCount": 5,
  "charLength": 127,
  "score": 87,
  "scoreFactors": {
    "categoryCount": 22,
    "promptLength": 18,
    "coherence": 19,
    "tierFormat": 15,
    "negative": 0,
    "fidelity": 8,
    "density": 5
  },
  "platform": "midjourney",
  "tier": 2,
  "sceneUsed": "blade-runner-rain",
  "outcome": {
    "copied": true,
    "saved": false,
    "returnedWithin60s": false,
    "reusedFromLibrary": false
  },
  "timestamp": "2026-03-15T14:22:00Z"
}
```

### 14.4 Feedback Event

```json
{
  "id": "fb_def456",
  "promptEventId": "evt_abc123",
  "rating": "great",
  "timestamp": "2026-03-15T14:23:15Z"
}
```

### 14.5 A/B Test Assignment

```json
{
  "testId": "ab_coherence_weight_increase",
  "userHash": "anon_sha256_abc",
  "variant": "B",
  "assignedAt": "2026-03-10T00:00:00Z",
  "controlWeights": { "coherence": 0.3, "categoryCount": 0.1 },
  "variantWeights": { "coherence": 0.4, "categoryCount": 0.05 }
}
```

---

## 15. Output Files — What the Cron Produces

Every file is JSON. Code reads them. Code never changes. Data gets smarter nightly.

| File                        | Phase | Size Est. | Contents                                         | Engine File                 |
| --------------------------- | ----- | --------- | ------------------------------------------------ | --------------------------- |
| `scoring-weights.json`      | 6     | < 1KB     | Per-tier factor weights                          | `weight-recalibration.ts`   |
| `co-occurrence-matrix.json` | 5     | ~50–100KB | Term pair co-occurrence counts by tier           | `co-occurrence.ts`          |
| `anti-patterns.json`        | 7.1   | ~10KB     | Term pairs that sabotage each other              | `anti-pattern-detection.ts` |
| `collision-matrix.json`     | 7.1   | ~5KB      | Terms that compete for same "space"              | `collision-matrix.ts`       |
| `magic-combos.json`         | 7.4   | ~20KB     | Top 500–1,000 trios/quads                        | `magic-combo-mining.ts`     |
| `term-quality-scores.json`  | 6     | ~30KB     | Per-term per-tier quality scores                 | `term-quality-scoring.ts`   |
| `redundancy-groups.json`    | 7.3   | ~10KB     | Synonym groups with interchangeability data      | `redundancy-detection.ts`   |
| `compression-profiles.json` | 7.9   | ~5KB      | Optimal prompt length + removable terms per tier | ❌ Not yet built            |
| `scene-candidates.json`     | 5     | ~15KB     | Auto-proposed scenes for review                  | `scene-candidates.ts`       |
| `trending-terms.json`       | 7.8   | ~5KB      | Terms trending up/down in last 7 days            | ❌ Not yet built            |
| `temporal-boosts.json`      | 7.8   | ~5KB      | Seasonal and time-of-week modifiers              | ❌ Not yet built            |
| `skill-thresholds.json`     | —     | ~2KB      | Beginner/intermediate/expert boundaries          | ❌ Not yet built            |
| `scorer-health-report.json` | 6     | ~3KB      | Correlation trends, drift alerts                 | `scorer-health.ts`          |
| `vocab-submissions.json`    | 7.7   | Variable  | User-submitted vocabulary pending review         | `vocab-auto-filter.ts`      |

**Total nightly output:** ~160–200KB. Trivial.

---

## 16. File Impact Map

### New Files — Actually Installed

**Phase 0 — Vocabulary Merge:**
| File | Purpose |
| ---- | ------- |
| `src/data/vocabulary/merged/index.ts` (232 lines) | Loader: `getMergedOptions()`, `getMergedCount()` |
| `src/data/vocabulary/merged/merge-manifest.json` | Source tracking |
| `src/data/vocabulary/merged/*-merged.json` (9 files) | Merged vocabulary per category |
| `src/data/vocabulary/merged/curated-*.json` (16 files) | Curated source files |
| `src/data/vocabulary/merged/*-audit-report.json` (3 files) | Audit reports |

**Phase 1 — Cascading Intelligence:**
| File | Purpose |
| ---- | ------- |
| `src/data/prompt-intelligence/*.json` (7 data files + 7 .d.ts files) | Clusters, affinities, tags, conflicts, platform hints, market moods, families |
| `src/data/vocabulary/intelligence/` (mirror + index.ts + README.md) | Vocabulary-accessible copy |
| `src/lib/prompt-intelligence/*.ts` (6 files, 2,576 lines) | Core intelligence: coherent-randomise, combine, phrase-filter, types, index, get-families |
| `src/lib/prompt-intelligence/engines/*.ts` (6 files, 3,875 lines) | Engines: suggestion, integration, platform-optimization, market-mood, conflict-detection, index |

**Phase 2 — Scene Starters:**
| File | Purpose |
| ---- | ------- |
| `src/data/scenes/scene-starters.json` | 200 scenes |
| `src/data/scenes/scene-starters.schema.json` (327 lines) | JSON Schema |
| `src/data/scenes/worlds.ts` (239 lines) | World definitions |
| `src/data/scenes/index.ts` | Barrel export |
| `src/types/scene-starters.ts` (291 lines) | TypeScript types |
| `src/components/providers/scene-selector.tsx` (1,110 lines) | UI component |

**Phase 3 — Explore Drawer:**
| File | Purpose |
| ---- | ------- |
| `src/components/providers/explore-drawer.tsx` (805 lines) | Full explore drawer with tabs, search, pagination, badges, cascade ordering |

**Phase 5–7.6 — Learning Engine:**
| File | Purpose |
| ---- | ------- |
| `src/lib/learning/*.ts` (29 files, 11,189 lines) | Complete learning engine |
| `src/app/api/learning/*/route.ts` (14 routes) | Learning API endpoints |
| `src/app/api/prompt-telemetry/route.ts` (264 lines) | Telemetry endpoint |
| `src/lib/telemetry/*.ts` (3 files, 407 lines) | Client telemetry + A/B hashing |
| `src/lib/learning/__tests__/*.ts` (24 test files) | Comprehensive test suite |

**Phase 7.7 — Vocabulary Crowdsourcing:**
| File | Purpose |
| ---- | ------- |
| `src/types/vocab-submission.ts` (420 lines) | Type system |
| `src/lib/vocabulary/vocab-auto-filter.ts` (172 lines) | 3-layer dedup |
| `src/lib/vocabulary/category-suggester.ts` (255 lines) | Smart category suggestion |
| `src/hooks/use-vocab-submission.ts` (152 lines) | React submission hook |
| `src/app/api/admin/vocab-submissions/route.ts` (904 lines) | Admin API (6 handlers) |
| `src/app/admin/vocab-submissions/page.tsx` (1,632 lines) | Admin review UI |
| `src/data/learned/vocab-submissions.json` | Submission storage |

**Admin Infrastructure:**
| File | Purpose |
| ---- | ------- |
| `src/app/admin/layout.tsx` (55 lines) | Shared admin layout with dark theme |
| `src/app/admin/admin-nav.tsx` (52 lines) | Client navigation with active-link highlighting |
| `src/app/admin/page.tsx` (100 lines) | Admin dashboard overview |
| `src/app/admin/scene-candidates/page.tsx` (526 lines) | Scene candidate review |
| `src/app/admin/exchanges/page.tsx` | Exchange editor |
| `src/app/admin/providers/page.tsx` | Provider browser |
| `src/app/admin/actions.ts` | Server actions |
| `src/app/api/admin/learning/scene-candidates/route.ts` (239 lines) | Scene candidates API |
| `src/app/api/admin/learning/migrate/route.ts` (186 lines) | Migration API |

### Modified Files

| File                                                    | Phase   | Changes                                                                          |
| ------------------------------------------------------- | ------- | -------------------------------------------------------------------------------- |
| `lib/vocabulary/vocabulary-loader.ts`                   | 0+1+5   | Load merged vocab. Family imports. Core first, merged appended.                  |
| `components/providers/prompt-builder.tsx` (1,907 lines) | 1+2+3+5 | SceneSelector (line 109), ExploreDrawer (line 110), Telemetry (lines 1143, 1217) |

### Untouched Files

| File                                    | Reason                                       |
| --------------------------------------- | -------------------------------------------- |
| `data/vocabulary/prompt-builder/*.json` | Core vocab stays pure                        |
| `data/vocabulary/weather/*.json`        | Still consumed by weather-prompt-generator   |
| `data/vocabulary/commodities/*.json`    | Still consumed by commodity-prompt-generator |
| `data/vocabulary/shared/*.json`         | Still consumed by assembler                  |
| `data/platform-tiers.ts`                | Tier definitions unchanged                   |

---

## 17. Build Phase Summary

| Phase       | Feature                         | Effort (Planned)              | Effort (Actual)           | Status        | Dependencies |
| ----------- | ------------------------------- | ----------------------------- | ------------------------- | ------------- | ------------ |
| **Phase 0** | Vocabulary Merge                | 2–3 days                      | ✅ Complete               | ✅ DONE       | None         |
| **Phase 1** | Cascading Intelligence          | 4–6 days                      | ✅ Complete               | ✅ DONE       | Phase 0      |
| **Phase 2** | Scene Starters (200 scenes)     | 5–8 days                      | ✅ Complete               | ✅ DONE       | Phase 1      |
| **Phase 3** | Explore Drawer                  | 3–4 days                      | ✅ Complete               | ✅ DONE       | Phase 0, 1   |
| **Phase 4** | Polish & Integration            | 2–3 days                      | ✅ Complete               | ✅ DONE       | Phases 0–3   |
| **Phase 5** | Collective Intelligence Engine  | 4–6 days                      | ✅ Complete               | ✅ DONE       | Phase 4      |
| **Phase 6** | Self-Improving Scorer           | ~6 days                       | ✅ Complete               | ✅ DONE       | Phase 5      |
| **7.1**     | Negative Pattern Learning       | 1.5 days                      | ✅ Complete               | ✅ DONE       | Phase 6      |
| **7.2**     | Iteration Tracking              | 1.5 days                      | ✅ Complete               | ✅ DONE       | Phase 6      |
| **7.3**     | Semantic Redundancy Detection   | 1 day                         | ✅ Complete               | ✅ DONE       | Phase 6      |
| **7.4**     | Higher-Order Combinations       | 1.5 days                      | ✅ Complete               | ✅ DONE       | Phase 6      |
| **7.5**     | Per-Platform Learning           | 1 day                         | ✅ Complete               | ✅ DONE       | Phase 6      |
| **7.6**     | A/B Testing Pipeline            | 2 days                        | ✅ Complete               | ✅ DONE       | Phase 6      |
| **7.7**     | Vocabulary Crowdsourcing        | 1 day (planned as Skill Seg.) | ✅ Complete (7 parts)     | ✅ DONE       | Phase 6      |
| **7.8**     | Temporal Intelligence           | 1 day                         | —                         | ❌ TODO       | Phase 6      |
| **7.9**     | Prompt Compression Intelligence | 1 day                         | —                         | ❌ TODO       | Phase 6      |
| **7.10**    | User Feedback Invitation        | 1 day                         | —                         | ❌ TODO       | Phase 6      |
| **7.11**    | Admin Command Centre            | 5 days                        | ⚠️ Partial (~2 days done) | ⚠️ PARTIAL    | Phase 6      |
| **TOTAL**   |                                 | **42–57 days**                | **~40 days complete**     | **~85% done** |              |

### Remaining Work

| Phase               | Feature                                               | Estimated Effort |
| ------------------- | ----------------------------------------------------- | ---------------- |
| 7.8                 | Temporal Intelligence                                 | 1 day            |
| 7.9                 | Prompt Compression Intelligence (learned profiles)    | 1 day            |
| 7.10                | User Feedback Invitation (👍👌👎 widget)              | 1 day            |
| 7.11                | Admin Scoring Health Dashboard (remaining 8 sections) | ~4 days          |
| **TOTAL REMAINING** |                                                       | **~7 days**      |

### Parallel Work Opportunities

- Phase 7.8–7.10 are independent of each other — can be built in any order
- Phase 7.11 remaining sections depend on data from Phases 7.8–7.10 for full visualisation
- Scene data authoring can run in parallel with any remaining engineering

---

## 18. Risk Register

| Risk                                                      | Likelihood | Impact | Mitigation                                                                                  |
| --------------------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------------------------- |
| **Phrase soup** — merged vocab feels disconnected         | Medium     | High   | Hand-curate every phrase. Test with real prompt generation.                                 |
| **Cascade confusion** — users don't understand reordering | Medium     | Medium | Subtle reorder (no animation). Options never disappear. "Suggested" label on top-ranked.    |
| **Scene data quality** — 200 scenes takes weeks to curate | High       | High   | Batch by world. 3 worlds/day. Validate prefills against vocab.                              |
| **Performance** — cascade on every keystroke              | Low        | High   | Debounce 100ms. Memoize lookups. Web Worker fallback.                                       |
| **Bundle size** — all new data                            | Medium     | Medium | Lazy-load merged vocab on drawer open. Lazy-load scenes on selector open.                   |
| **Tier 4 overwhelm** — too many complex options           | Low        | Medium | Tier 4 dampening. Explore Drawer collapsed by default. Reduced pre-fills.                   |
| **Garbage in** — bad prompts pollute learning             | Medium     | High   | 90% threshold. 4+ category gate. Diversity filter. Time decay. Platform-specific.           |
| **Systematic bias** — cyberpunk over-indexing             | Medium     | Medium | Diversity filter. Manual review gate for first months. Then autonomous.                     |
| **Scoring drift** — weights shift in wrong direction      | Low        | High   | A/B testing validates before committing. Meta-check monitors correlation. Rollback ability. |
| **Cold start** — not enough data for learning             | Medium     | Low    | Hand-curated clusters carry system for months. Graceful fallback.                           |
| **Platform updates** — MJ v7 invalidates learned weights  | Medium     | Medium | Temporal intelligence detects correlation drops. Auto-enters learning period.               |
| **Vocab crowdsourcing spam** — bot/bulk submissions       | Medium     | Medium | 3-layer dedup, category anomaly alert (>60% single category), confidence scoring.           |

---

## 19. Success Metrics

| Metric                           | Current              | Target                       | How to Measure                               |
| -------------------------------- | -------------------- | ---------------------------- | -------------------------------------------- |
| Vocabulary utilisation           | 23.2% (3,955/17,078) | 65%+ (11,000+ accessible)    | Phrases reachable via dropdown + Explore     |
| Avg categories filled per prompt | ~3–4 (est.)          | 6+                           | Analytics: non-empty categories on copy      |
| Scene Starter adoption           | 0%                   | 40%+ of sessions             | scene_selected events / total sessions       |
| Explore Drawer engagement        | 0%                   | 20%+ of sessions             | explore_drawer_opened events                 |
| Pro conversion from scenes       | 0%                   | Measurable lift              | A/B: locked scene viewers vs Pro conversion  |
| Score-outcome correlation        | N/A (no tracking)    | 0.78+ by month 6             | Pearson correlation: score vs copy/save rate |
| Average iterations per prompt    | Unknown              | Decreasing over time         | iteration_sessions analysis                  |
| User feedback response rate      | N/A                  | 20%+                         | feedback_events / prompt copies              |
| Scoring weight stability         | N/A                  | Month-over-month convergence | Weight drift chart in Admin                  |
| Beginner → Expert graduation     | N/A                  | Avg 8 sessions               | Skill segmentation tracking                  |
| Vocab submissions per month      | N/A                  | 50+ quality submissions      | Admin review queue volume                    |

---

## 20. Timeline Projection — What Happens Over 6 Months

| Month       | Prompts Logged | What's Different                                                                                                                                                                                                                                                                                          |
| ----------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Month 1** | 0 → 5,000      | 100% hand-curated weights and clusters. Score-outcome correlation: ~0.45. System is good but static.                                                                                                                                                                                                      |
| **Month 2** | ~5,000         | First weight recalibration. Discovery: coherence matters 6× more than assumed. Correlation improves to 0.58.                                                                                                                                                                                              |
| **Month 3** | ~15,000        | Per-tier models diverge significantly. Term quality scores stabilise for top 200 terms. First 3 auto-scene candidates approved. Correlation: 0.65.                                                                                                                                                        |
| **Month 4** | ~30,000        | Co-occurrence matrix dominates for common pairs. Anti-patterns detected (12 collision pairs flagged). Magic trios discovered (top 50). Correlation: 0.72.                                                                                                                                                 |
| **Month 5** | ~55,000        | Per-platform learning begins for top 10 platforms. Compression profiles learned per tier. A/B testing pipeline running autonomously. Seasonal patterns clear.                                                                                                                                             |
| **Month 6** | ~80,000        | System knows top 50 terms per category per tier. Optimal prompt length per tier learned. Weights shifted 30–40% from originals. "Trending" scenes entirely community-driven. Correlation: 0.78+. Beginner → Expert avg: 8 sessions. The system is genuinely smarter than any human could make it by hand. |

### The Competitive Moat

Nobody can replicate this because nobody else has platform-spanning data across 42 platforms and 4 tiers. A tool that only works with Midjourney learns Midjourney patterns. Promagen learns patterns across ALL platforms simultaneously and cross-pollinates insights.

By month 6, Promagen knows:

- "oil painting" + "impasto texture" scores 12% higher on DALL-E than "oil painting" + "canvas texture"
- Atmosphere and Environment add value on MJ; Composition and Materials don't
- Tier 4 prompts above 12 words have LOWER copy rates than 8-word prompts
- "golden hour" works brilliantly on Midjourney (94%) but poorly on Craiyon (41%)
- Weekend users want Fantasy and Surreal; weekday users want Portrait and Professional

This data is the product. The vocabulary, the scenes, the cascading intelligence — those are the visible features. But the learning system underneath is what makes Promagen impossible to copy.

---

_End of document. Version 2.1.0. Updated 2026-02-27. Previous version: 2.0.0 (2026-02-24)._
