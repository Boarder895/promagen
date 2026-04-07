# Prompt Builder Evolution Plan v2.0

**Version:** 3.0.0
**Created:** 2026-02-24
**Last Updated:** 2026-04-06
**Status:** ✅ ALL PHASES COMPLETE — Phases 0–7.12 delivered. Plan is now a historical record.

> **What happened after this plan:** Three major systems were built on top of this evolution:
>
> 1. **Unified Prompt Brain** — consolidated weather assembly into `assemblePrompt()`. See `unified-prompt-brain.md`.
> 2. **AI Intelligence Engine (Prompt Lab)** — Call 1 (category assessment), Call 2 (4-tier generation with 30-rule system prompt + P1–P12 post-processing), Call 3 (platform-specific optimisation via 40 independent builder files). See `ai-disguise.md`, `prompt-optimizer.md` v6.0.0, `api-3.md`.
> 3. **Builder Quality Intelligence** — internal regression testing for Call 3 builders. 8 core + 2 holdout test scenes, batch runner, GPT + Claude dual-model scoring, admin dashboard. Replaced user-facing scoring entirely. See `builder-quality-intelligence.md` v3.0.0.
>    **Authority:** This document is a historical record of the prompt builder evolution. For current architecture, see `architecture.md` v3.0.0.
>    **Admin Route:** `/admin` (live), `/admin/scoring-health` (live — 12 dashboard sections)
>    **Tests:** 161 test files across 8 Jest projects (136 running, 25 orphaned — see `test.md` for inventory and orphan fix). This document references test files but does not include test source.

---

## Build Status Dashboard

| Phase    | Feature                         | Status      | Key Metric                                                                                                        |
| -------- | ------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------- |
| **0**    | Vocabulary Merge                | ✅ COMPLETE | 9,058 terms (3,501 core + 5,557 merged) across 9 merged + 3 unchanged categories                                  |
| **1**    | Cascading Intelligence          | ✅ COMPLETE | 50 semantic clusters, 250 affinities, 2,032 tagged terms, 145 conflicts, 42 platform hints                        |
| **2**    | Scene Starters                  | ✅ COMPLETE | 200 scenes (25 free / 175 pro) across 23 worlds                                                                   |
| **3**    | Explore Drawer                  | ✅ COMPLETE | 852-line component with tier badges, cascade ordering, search, pagination                                         |
| **4**    | Polish & Integration            | ✅ COMPLETE | Scene flavour phrases wired, analytics events, fluid typography, Phase 4 tests                                    |
| **5**    | Collective Intelligence Engine  | ✅ COMPLETE | Telemetry endpoint, 17-layer aggregation cron (1,565 lines), 17 learning API routes                               |
| **6**    | Self-Improving Scorer           | ✅ COMPLETE | 14,438 LOC across 35 learning engine files, 5 recalibration mechanisms                                            |
| **7.1**  | Negative Pattern Learning       | ✅ COMPLETE | Anti-pattern detection (371 lines) + collision matrix (346 lines) + lookups                                       |
| **7.2**  | Iteration Tracking              | ✅ COMPLETE | Session sequence tracking (642 lines) + weak term lookup (177 lines)                                              |
| **7.3**  | Semantic Redundancy Detection   | ✅ COMPLETE | Redundancy detection (574 lines) + lookup (246 lines)                                                             |
| **7.4**  | Higher-Order Combinations       | ✅ COMPLETE | Magic combo mining (596 lines) + combo lookup (366 lines)                                                         |
| **7.5**  | Per-Platform Learning           | ✅ COMPLETE | Platform term quality (520 lines) + platform co-occurrence (423 lines) + lookups                                  |
| **7.6**  | A/B Testing Pipeline            | ✅ COMPLETE | 1,028-line A/B engine + deterministic hash assignment + lift distribution + adaptive peek scheduling              |
| **7.7**  | Vocabulary Crowdsourcing        | ✅ COMPLETE | 3,659 LOC: 3-layer dedup, smart category suggestion, admin review with batch workflow                             |
| **7.8**  | Temporal Intelligence           | ✅ COMPLETE | Temporal engine (652 lines) + lookup (332 lines) + admin freshness badge (313 lines)                              |
| **7.9**  | Prompt Compression Intelligence | ✅ COMPLETE | Compression engine (732 lines) + lookup (349 lines) + overrides (151 lines) + admin dashboard (445 lines)         |
| **7.10** | User Feedback Invitation        | ✅ COMPLETE | 4-factor credibility scoring, feedback client, streaks, scene enhancer, confidence halos, feedback memory hook    |
| **7.11** | Admin Command Centre            | ✅ COMPLETE | 12 live dashboard sections, 19 components (8,154 lines), 18 API routes (5,264 lines), 8 lib modules (3,176 lines) |
| **7.12** | Budget-Aware Conversion System  | ✅ COMPLETE | 4 new engine files (2,255 lines), assembler pipeline rewrite, telemetry integration, 7 test files (~125 tests)    |

**Total LOC delivered:** ~60,900+ across learning engines, prompt intelligence, telemetry, admin UI, scene system, vocab merge, feedback, crowdsourcing, and conversion pipeline.

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
13. [Budget-Aware Conversion System (Phase 7.12)](#13-budget-aware-conversion-system-phase-712)
14. [The 4 Optimizer Tiers — Cross-Feature Matrix](#14-the-4-optimizer-tiers--cross-feature-matrix)
15. [Data Structures](#15-data-structures)
16. [Output Files — What the Cron Produces](#16-output-files--what-the-cron-produces)
17. [File Impact Map](#17-file-impact-map)
18. [Build Phase Summary](#18-build-phase-summary)
19. [Risk Register](#19-risk-register)
20. [Success Metrics](#20-success-metrics)
21. [Timeline Projection — What Happens Over 6 Months](#21-timeline-projection--what-happens-over-6-months)

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

All features work across all 4 optimizer tiers (CLIP, Midjourney, Natural Language, Plain Language) and all 40 platforms.

---

## 2. Feature Overview

| #   | Feature                            | What it does                                                                 | Tier                  | Phase | Status            |
| --- | ---------------------------------- | ---------------------------------------------------------------------------- | --------------------- | ----- | ----------------- |
| D   | **Vocabulary Merge**               | Curate + map weather/commodity/shared phrases into prompt builder categories | Free (data layer)     | 0     | ✅ COMPLETE       |
| B   | **Cascading Intelligence**         | Reorder downstream dropdowns based on upstream selections                    | Free                  | 1     | ✅ COMPLETE       |
| A   | **Scene Starters**                 | Pre-populate categories from curated scene templates (hierarchical dropdown) | Free (25) / Pro (200) | 2     | ✅ COMPLETE       |
| C   | **Explore Drawer**                 | Expandable panel showing full vocabulary per category, contextually filtered | Free                  | 3     | ✅ COMPLETE       |
| —   | **Polish & Integration**           | Cross-feature wiring, analytics, fluid typography, docs                      | —                     | 4     | ✅ COMPLETE       |
| —   | **Collective Intelligence Engine** | Telemetry + co-occurrence learning + auto-scene generation                   | —                     | 5     | ✅ COMPLETE       |
| —   | **Self-Improving Scorer**          | Weight recalibration + per-tier models + threshold auto-adjustment           | —                     | 6     | ✅ COMPLETE       |
| —   | **Advanced Learning Systems**      | 10 additional learning dimensions + Admin Command Centre                     | —                     | 7     | ✅ 11/11 COMPLETE |

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
| `src/components/providers/scene-selector.tsx` | 1,233 | Hierarchical accordion dropdown with world grouping, free/pro gating, search |

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
| `src/components/providers/explore-drawer.tsx` | 852   | Full explore drawer with tabs (All, Core, Weather, Commodity, Shared, Scene), search, pagination, tier badges, cascade ordering |

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
| Database operations | `src/lib/learning/database.ts`                 | 1,037 |

Telemetry wired into `prompt-builder.tsx` at two copy paths (lines 1143 and 1217) as fire-and-forget.

### 9.5 17-Layer Aggregation Cron (Actual)

The nightly aggregation cron (`src/app/api/learning/aggregate/route.ts`, 1,565 lines) runs at 03:00 UTC daily and executes 17 computation layers:

| Layer | Phase    | What it computes                                |
| ----- | -------- | ----------------------------------------------- |
| 1     | 5 — 5.3b | Co-occurrence matrix                            |
| 2     | 5 — 5.3c | Sequence patterns                               |
| 3     | 5 — 5.3d | Scene candidates                                |
| 4     | 6        | Weight recalibration (scoring-weights)          |
| 5     | 6        | Category value discovery                        |
| 6     | 6        | Term quality scores                             |
| 7     | 6        | Threshold discovery                             |
| 8     | 6        | Scorer health report                            |
| 9     | 7.1      | Anti-pattern detection                          |
| 10    | 7.1      | Collision matrix                                |
| 11    | 7.2      | Iteration tracking insights                     |
| 12    | 7.3      | Redundancy detection                            |
| 13    | 7.4      | Magic combos                                    |
| 14a   | 7.5      | Platform term quality                           |
| 14b   | 7.5      | Platform co-occurrence                          |
| 15    | 7.8      | Temporal intelligence (seasonal + trending)     |
| 16    | 7.9      | Compression profiles (per-tier optimal lengths) |
| 17    | 7.10     | Feedback summary aggregation                    |

Security: Cron secret validation (PROMAGEN_CRON_SECRET), advisory lock to prevent concurrent runs, returns 404 for invalid auth.

### 9.6 Learning API Routes (Actual)

17 API routes serve learning data to the frontend:

| Route                                  | Lines | Phase  |
| -------------------------------------- | ----- | ------ |
| `/api/learning/aggregate`              | 1,565 | 5–7.10 |
| `/api/learning/co-occurrence`          | 75    | 5      |
| `/api/learning/sequences`              | 75    | 5      |
| `/api/learning/scene-candidates`       | 75    | 5      |
| `/api/learning/scoring-weights`        | 78    | 6      |
| `/api/learning/anti-patterns`          | 80    | 7.1    |
| `/api/learning/collisions`             | 82    | 7.1    |
| `/api/learning/iteration-insights`     | 83    | 7.2    |
| `/api/learning/redundancy-groups`      | 82    | 7.3    |
| `/api/learning/magic-combos`           | 80    | 7.4    |
| `/api/learning/platform-term-quality`  | 88    | 7.5    |
| `/api/learning/platform-co-occurrence` | 88    | 7.5    |
| `/api/learning/ab-tests`               | 138   | 7.6    |
| `/api/learning/ab-assignment`          | 106   | 7.6    |
| `/api/learning/temporal-all`           | 89    | 7.8    |
| `/api/learning/compression-profiles`   | 82    | 7.9    |
| `/api/learning/feedback-summary`       | 186   | 7.10   |

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

**Mechanism 3 — Per-Tier Scoring Models** (via `category-value-discovery.ts`, 463 lines)
Four separate scoring models per tier with different factor weights.

**Mechanism 4 — Category Value Discovery** (`category-value-discovery.ts`, 463 lines)
Learn which categories are high-value vs low-value per tier. v2.0.0 (Gap 3): also computes per-category feedback sentiment — which categories get 👍 vs 👎.

**Mechanism 5 — Term-Level Quality Scores** (`term-quality-scoring.ts`, 400 lines)
Each term gets per-tier quality score. High-quality terms boosted in dropdown ordering.

### 10.4 The Meta-Loop — Scoring Scores Itself

`scorer-health.ts` (388 lines) measures score-outcome correlation. If correlation improves month-over-month, system genuinely learning. If drops, flag for manual review.

### 10.5 Full Learning Engine File Inventory (Actual)

| File                               | Lines | Phase | Purpose                                                                        |
| ---------------------------------- | ----- | ----- | ------------------------------------------------------------------------------ |
| `database.ts`                      | 1,037 | 5     | Secure parameterized database operations (Gap 1: +feedback columns in SELECTs) |
| `constants.ts`                     | 335   | 5     | Learning pipeline configuration constants                                      |
| `decay.ts`                         | 190   | 5     | Time decay functions for telemetry weighting                                   |
| `outcome-score.ts`                 | 653   | 5–6   | Compute outcome scores from 7 signals + `outcomeWithFeedback()` (Gap 1)        |
| `co-occurrence.ts`                 | 260   | 5     | Co-occurrence matrix computation                                               |
| `co-occurrence-lookup.ts`          | 131   | 5     | Fast co-occurrence pair lookup                                                 |
| `sequence-patterns.ts`             | 347   | 5     | Selection order pattern analysis                                               |
| `scene-candidates.ts`              | 414   | 5     | Auto-scene candidate generation                                                |
| `weight-recalibration.ts`          | 472   | 6     | Factor-outcome correlation → weight adjustment (Gap 1: outcomeWithFeedback)    |
| `threshold-discovery.ts`           | 366   | 6     | Quality threshold knee detection                                               |
| `category-value-discovery.ts`      | 463   | 6     | Per-tier category importance ranking + feedback sentiment (Gap 3, v2.0.0)      |
| `term-quality-scoring.ts`          | 400   | 6     | Per-term per-tier quality scores (Gap 1: outcomeWithFeedback)                  |
| `scorer-health.ts`                 | 388   | 6     | Meta-loop: score-outcome correlation monitoring                                |
| `anti-pattern-detection.ts`        | 371   | 7.1   | Detect term pairs that kill prompts (Gap 1: outcomeWithFeedback)               |
| `anti-pattern-lookup.ts`           | 144   | 7.1   | Fast anti-pattern pair lookup                                                  |
| `collision-matrix.ts`              | 346   | 7.1   | Terms competing for same space                                                 |
| `collision-lookup.ts`              | 183   | 7.1   | Fast collision pair lookup                                                     |
| `iteration-tracking.ts`            | 642   | 7.2   | Session sequence analysis                                                      |
| `weak-term-lookup.ts`              | 177   | 7.2   | Terms most often replaced                                                      |
| `redundancy-detection.ts`          | 574   | 7.3   | Synonym/interchangeable term detection                                         |
| `redundancy-lookup.ts`             | 246   | 7.3   | Redundancy group lookup                                                        |
| `magic-combo-mining.ts`            | 596   | 7.4   | Frequent itemset mining (trios/quads) (Gap 1: outcomeWithFeedback)             |
| `combo-lookup.ts`                  | 366   | 7.4   | Fast magic combo lookup                                                        |
| `platform-term-quality.ts`         | 520   | 7.5   | Per-platform term quality scoring                                              |
| `platform-term-quality-lookup.ts`  | 266   | 7.5   | Platform-specific term lookup                                                  |
| `platform-co-occurrence.ts`        | 423   | 7.5   | Per-platform co-occurrence patterns                                            |
| `platform-co-occurrence-lookup.ts` | 331   | 7.5   | Platform co-occurrence lookup                                                  |
| `ab-testing.ts`                    | 1,028 | 7.6   | A/B test lifecycle + lift distribution + adaptive peek                         |
| `ab-assignment.ts`                 | 88    | 7.6   | Deterministic hash-based user assignment                                       |
| `temporal-intelligence.ts`         | 652   | 7.8   | Seasonal patterns + weekly trends + platform update detection                  |
| `temporal-lookup.ts`               | 332   | 7.8   | Fast temporal boost/trending term lookup                                       |
| `compression-intelligence.ts`      | 732   | 7.9   | Per-tier optimal prompt length + removable terms                               |
| `compression-lookup.ts`            | 349   | 7.9   | Compression profile lookup                                                     |
| `compression-overrides.ts`         | 151   | 7.9   | Admin override layer for compression rules                                     |
| `feedback-streaks.ts`              | 335   | 7.10  | Hot/cold/oscillating streak detection per session                              |

**Total learning engine LOC:** 14,755 (35 files)

### 10.6 Tests

24 test files in `src/lib/learning/__tests__/` at Phase 6 completion (now 30 — 6 added in Phases 7.8–7.10: temporal-intelligence, compression-intelligence, compression-lookup, compression-overrides, feedback-credibility, feedback-streaks):

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

**Anti-pattern detection** (`anti-pattern-detection.ts`, 371 lines): Count term pairs that appear frequently in low-scoring prompts but rarely in high-scoring ones. When user selects "oil painting", actively DEMOTE "8k resolution" and "ray tracing".

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

**Engine** (`magic-combo-mining.ts`, 596 lines): Frequent itemset mining (Apriori/FP-Growth) on telemetry data. Top 500–1,000 trios/quads.

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

**Engine** (`ab-testing.ts`, 1,028 lines): Full A/B test lifecycle — create, assign, measure, auto-promote/rollback. Bayesian early-stop evaluation. Lift distribution sparkline (Monte Carlo sampling from Beta-Binomial posteriors). Adaptive peek scheduling (12h/24h/72h intervals based on event velocity).

**Assignment** (`ab-assignment.ts`, 88 lines): Deterministic hash-based user assignment (same user always gets same variant).

**Hashing** (`ab-hash.ts`, 85 lines): Stable hash for anonymous user bucketing.

**API routes:** `/api/learning/ab-tests` (138 lines — CRUD), `/api/learning/ab-assignment` (106 lines)

**Database:** `ab_test_assignments` table (user_hash → variant_id per test). Version 2.2.0 of `database.ts` includes A/B testing CRUD + prompt_events migration.

### 7.7 — Vocabulary Crowdsourcing ✅ COMPLETE

**Note:** The original plan listed Phase 7.7 as "User Skill Segmentation." During implementation, this was repurposed to "Vocabulary Crowdsourcing Pipeline" — a community-driven vocabulary expansion system with admin review workflow. Skill segmentation may be built as a separate future phase.

**What was built (3,659 LOC total):**

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

### 7.8 — Temporal Intelligence ✅ COMPLETE

Track seasonal trends, weekly patterns, and platform update impacts.

**Temporal engine** (`temporal-intelligence.ts`, 652 lines): Seasonal pattern detection with monthly multipliers, weekly trend analysis (weekend vs weekday), platform update detection via correlation drop monitoring. Half-life decay for staleness with configurable confidence ramps.

**Temporal lookup** (`temporal-lookup.ts`, 332 lines): Fast lookup for seasonal boosts and trending terms. Returns `TemporalLookup` with `seasonalBoosts` (per-term monthly multipliers) and `trendingTerms` (7-day velocity).

**Admin components:**

- `temporal-freshness-badge.tsx` (313 lines) — Color-coded staleness indicator (fresh/stale/dead) with strength bars, auto-refresh every 5 minutes
- `temporal-trends-panel.tsx` (441 lines) — Dashboard Section 8: trending terms visualization, seasonal patterns, platform update alerts

**API routes:** `/api/learning/temporal-all` (89 lines), `/api/admin/scoring-health/temporal` (249 lines)

**Output files:** `temporal-boosts.json`, `trending-terms.json` (generated by aggregation cron Layer 15)

**Tests:** `__tests__/admin/scoring-health-7-11e.test.ts` covers temporal panel rendering and data fetch

### 7.9 — Prompt Compression Intelligence ✅ COMPLETE

Learn what can be REMOVED without affecting quality.

**Compression engine** (`compression-intelligence.ts`, 732 lines): Analyses telemetry to discover per-tier optimal prompt lengths and expendable terms. Computes compression ratios based on copy/save rate correlation with term count.

**Compression lookup** (`compression-lookup.ts`, 349 lines): Fast lookup for per-tier optimal length profiles and expendable term sets.

**Compression overrides** (`compression-overrides.ts`, 151 lines): Admin override layer allowing manual keep/remove rules that survive cron recalculation.

**Admin dashboard** (`compression-dashboard.tsx`, 445 lines): Pipeline health widget showing data freshness, per-tier optimal length profiles with history sparklines, top expendable terms per tier, and platform-specific length deltas.

**API routes:** `/api/learning/compression-profiles` (82 lines)

**Output file:** `compression-profiles.json` (generated by aggregation cron Layer 16)

**Pre-existing static engine:** The static compression engine (`src/lib/prompt-optimizer.ts`, 1,604 lines) handles synonym substitution and shorthand — the learned profiles layer sits on top of this.

**Tests:** Reference `compression-intelligence` test coverage in test inventory

### 7.10 — User Feedback Invitation ✅ COMPLETE

The biggest gap is closed: we now ask directly. A direct signal is 10× more valuable than inferred signals.

**Built in 7 sub-parts:**

**7.10a — Data Layer** (`src/types/feedback.ts`, 328 lines): Four-factor credibility scoring algorithm. Weights feedback by: (1) user tier — paid users 1.25× multiplier, (2) account age — veterans weighted higher, (3) usage frequency — power users calibrate better, (4) response speed — under 2 minutes = fresh test signal. Combined formula clamped to `[CREDIBILITY_MIN, CREDIBILITY_MAX]`.

**7.10b — Feedback Confidence Halos** (`scene-selector.tsx` modifications, `feedback-scene-enhancer.ts` 295 lines): Subtle glow rings on scene cards based on historical feedback overlap. Confidence levels: "proven" (emerald glow + breathing animation, 3+ positive matches), "warm" (faint emerald outline, 1-2 positive), "risky" (amber warning ring, 2+ negative), or null (no halo, insufficient data). Users see scenes that "just work better for them" without knowing why.

**7.10c — Feedback Client** (`feedback-client.ts`, 292 lines): sessionStorage tracking + fire-and-forget POST. 24-hour dismissal cooldown. Client-side credibility computation. Never throws — UI never breaks from feedback plumbing.

**7.10d — Feedback Memory Hook** (`use-feedback-memory.ts`, 355 lines): React hook for per-user term-level feedback hints. Drives the confidence halos and scene enhancer.

**7.10e — Scene Enhancer** (`feedback-scene-enhancer.ts`, 295 lines): When a user loads a scene, this checks their feedback memory and silently enriches scene prefills with proven winners. Only adds within same category, only when signal is strong (count ≥ MIN_HINT_COUNT), never removes scene defaults.

**7.10f — Feedback Streaks** (`feedback-streaks.ts`, 335 lines): Real-time pattern detection per session per platform. Three streak types: 🔥 hot streak (3+ consecutive 👍 → boost term combo weights), ❄️ cold streak (3+ consecutive 👎 → flag for admin review), 🔄 oscillating (alternating 👍👎 → high-variance, useful for A/B decisions).

**7.10g — Admin Feedback Panel** (`feedback-summary-panel.tsx`, 451 lines): Dashboard Section 10: 👍/👌/👎 distribution, per-platform satisfaction rates, terms with highest 👎 rate, correlation between score and rating. Drill-through to anti-patterns panel.

**7.10h — Unified Feedback System** (7 March 2026): Extended the 👍👌👎 feedback pipeline from the prompt builder to ALL user-facing surfaces. The builder's `FeedbackInvitation` (post-copy overlay) remains unchanged. A new compact inline `FeedbackWidget` (`src/components/ux/feedback-widget.tsx`, 210 lines) was created for surfaces that need inline feedback without overlay UI. `sendFeedbackDirect()` added to `feedback-client.ts` (225→292 lines) for fire-and-forget POST without sessionStorage dependency. Hearts (♡/♥) replaced with 👍👌👎 on the homepage PotM showcase and Community Pulse cards. Image Quality votes in the leaderboard now dual-write to `feedback_events` alongside their existing Elo table. All signals flow through the same `/api/feedback` endpoint → `feedback_events` table → credibility scoring → streak detection → nightly cron. Authority: `docs/authority/the-like-system.md`. Old like system (`use-like.ts`, `/api/prompts/like`, `prompt_likes` table) orphaned — no longer imported.

**7.10i — Gap 1: Dead Wire Fix** (7 March 2026): `feedback_rating` and `feedback_credibility` were written to `prompt_events` but never read by the learning pipeline. Both `fetchQualifyingEvents()` and `fetchAllEventsForAntiPatterns()` SELECTs now include these columns. New `outcomeWithFeedback()` helper in `outcome-score.ts` (653 lines) merges feedback columns into `OutcomeSignals`. All 5 learning engines updated: `term-quality-scoring.ts`, `weight-recalibration.ts`, `magic-combo-mining.ts`, `anti-pattern-detection.ts`, `category-value-discovery.ts`. Each now calls `computeOutcomeScore(outcomeWithFeedback(e.outcome, e.feedback_rating, e.feedback_credibility))`. Zero-allocation fast path when no feedback (majority of events). Every existing feedback_rating immediately influences all scoring. Authority: `the-like-system.md` §8.7.

**7.10j — Gap 2: PotM Showcase Telemetry** (7 March 2026): Homepage feedback used synthetic IDs that didn't match real `prompt_events` rows. Added `sendShowcaseTelemetry()` to `prompt-telemetry-client.ts` (336→420 lines). Fires when user views a PotM prompt via `useEffect` in `prompt-showcase.tsx` (1,357→1,378 lines). Creates real `prompt_events` row with deterministic ID `potm:{rotationIndex}:tier{N}` and full 12-category selections (via `selectionsFromMap()`). Added `deterministicId` field to Zod schema (`prompt-telemetry.ts`, 272→279 lines). API route uses `ON CONFLICT (id) DO NOTHING` for idempotency (`prompt-telemetry/route.ts`, 265→267 lines). FeedbackWidget's `itemId` matches the deterministic ID exactly — learning pipeline now traces homepage 👎 → specific terms penalised.

**7.10k — Gap 3: Category Feedback Sentiment** (7 March 2026): `category-value-discovery.ts` upgraded to v2.0.0 (380→463 lines). For each category in each tier, counts 👍/👌/👎 from events where that category was filled. New fields on `CategoryValue`: `feedbackPositive`, `feedbackNeutral`, `feedbackNegative`, `feedbackSentiment` (range -1.0 to +1.0, null if < 5 feedback events). New `feedbackEventCount` on `TierCategoryValues` and `CategoryValueMap`. Computed in the existing single-pass fused loop — zero extra iteration. Reveals which vocabulary categories need diversification (negative sentiment) vs which are working (positive). No new cron layer — extends existing Layer 5. Test updated: version assertion 1.0.0→2.0.0.

**API routes:** `/api/learning/feedback-summary` (186 lines), `/api/admin/scoring-health/feedback` (170 lines)

**Data structure:** `feedback_events` table (prompt_event_id, rating, credibility_score, timestamp, tier, platform_id, response_speed_ms)

**Tests:** `__tests__/feedback-credibility.test.ts`, `__tests__/feedback-scene-enhancer.test.ts` — credibility scoring edge cases, scene enhancer integration

---

## 12. Admin Command Centre (Phase 7.11)

**Status:** ✅ COMPLETE — 12 dashboard sections live at `/admin/scoring-health`.

**Built in 10 sub-parts (7.11a–7.11j):**

### 12.1 Dashboard Architecture

**Page shell** (`scoring-health-client.tsx`, 209 lines): DrillThroughProvider wrapping all sections. Sticky sidebar nav with IntersectionObserver for active section highlighting. Anomaly Alert Banner pinned top. Undo Timeline strip above section grid.

**Sidebar nav** (`scoring-health-nav.tsx`, 145 lines): 12 section jump links with smooth-scroll, active state detection, and disabled-section handling.

**Types** (`scoring-health-types.ts`, 724 lines): All dashboard types, section definitions, API response shapes.

### 12.2 All 12 Dashboard Sections (All Live)

| #   | Section                        | Component                       | Lines | Build Part | API Route                                         |
| --- | ------------------------------ | ------------------------------- | ----- | ---------- | ------------------------------------------------- |
| —   | Anomaly Alert Banner           | `anomaly-alert-banner.tsx`      | 401   | 7.11g      | `/api/admin/scoring-health/anomalies` (201)       |
| —   | Undo Timeline                  | `undo-timeline.tsx`             | 190   | 7.11i      | In-memory (lib/admin/undo-stack.ts, 153)          |
| 1   | Scorer Health Overview         | `scorer-health-overview.tsx`    | 429   | 7.11a      | `/api/admin/scoring-health/overview` (311)        |
| 2   | Weight Drift Chart             | `weight-drift-chart.tsx`        | 438   | 7.11b      | `/api/admin/scoring-health/weight-history` (141)  |
| 3   | Per-Tier Models Heatmap        | `tier-models-heatmap.tsx`       | 437   | 7.11b      | `/api/admin/scoring-health/tier-weights` (176)    |
| 4   | Term Quality Leaderboard       | `term-quality-leaderboard.tsx`  | 607   | 7.11c      | `/api/admin/scoring-health/term-quality` (228)    |
| 4+  | Term Inspector (drill-through) | `term-inspector.tsx`            | 354   | 7.11d      | `/api/admin/scoring-health/term-inspect` (236)    |
| 5   | Anti-Pattern Alerts            | `anti-pattern-alerts.tsx`       | 425   | 7.11d      | `/api/admin/scoring-health/anti-patterns` (215)   |
| 6   | A/B Test Results               | `ab-test-section.tsx`           | 233   | 7.11d      | `/api/admin/scoring-health/ab-tests` (158)        |
| 7   | Pipeline Dependency Graph      | `pipeline-dependency-graph.tsx` | 428   | 7.11g      | `/api/admin/scoring-health/pipeline-status` (275) |
| 8   | Temporal Trends                | `temporal-trends-panel.tsx`     | 441   | 7.11e      | `/api/admin/scoring-health/temporal` (249)        |
| 9   | Skill Distribution             | `skill-distribution-panel.tsx`  | 362   | 7.11f      | `/api/admin/scoring-health/skill-dist` (255)      |
| 10  | Feedback Summary               | `feedback-summary-panel.tsx`    | 451   | 7.11e      | `/api/admin/scoring-health/feedback` (170)        |
| 11  | Configuration Profiles         | `profile-manager.tsx`           | 868   | 7.11i      | `/api/admin/scoring-health/profiles` (196)        |
| 12  | Code Evolution Radar           | `code-evolution-radar.tsx`      | 954   | 7.11j      | `/api/admin/scoring-health/code-radar` (347)      |

**Additional dashboard components:**

- `css-sparkline.tsx` (130 lines) — Pure CSS sparkline renderer (no chart library)
- `weight-editor-modal.tsx` (303 lines) — Click-to-edit weight values from heatmap (7.11c)
- `weight-tuning-sandbox.tsx` (558 lines) — Full-screen modal for simulation: adjust weights with sliders, live preview of how changes affect recent prompt scores, two-click promote to production (7.11h)

### 12.3 Cross-Section Drill-Through Flows (7.11g)

Three drill-through navigation paths implemented via `DrillThroughProvider` context:

1. **Banner → any section**: Anomaly alert click smooth-scrolls to relevant section + pulse-highlight animation
2. **Section 10 (platform click) → Section 5**: Feedback panel platform badge click navigates to anti-patterns filtered by that platform
3. **Section 5 (term click) → Section 4**: Anti-pattern term click auto-opens the term inspector with that term pre-loaded

### 12.4 Admin Library Modules

| Module                      | Lines | Purpose                                                                                                              |
| --------------------------- | ----- | -------------------------------------------------------------------------------------------------------------------- |
| `anomaly-thresholds.ts`     | 355   | Configurable alert thresholds for all pipeline health metrics                                                        |
| `code-dates.generated.ts`   | 72    | Auto-generated file modification timestamps for Code Radar                                                           |
| `code-evolution-radar.ts`   | 874   | Drift detection engine: weight ceiling, factor exhaustion, threshold staleness, vocab drift, anti-pattern saturation |
| `drill-through-context.tsx` | 297   | React context for cross-section navigation                                                                           |
| `pipeline-dependencies.ts`  | 297   | DAG definition for pipeline dependency graph                                                                         |
| `scoring-health-types.ts`   | 724   | Shared types + section definitions                                                                                   |
| `scoring-profiles.ts`       | 296   | Profile save/load/activate/rollback logic                                                                            |
| `undo-stack.ts`             | 153   | In-memory undo stack for weight edits                                                                                |
| `weight-simulator.ts`       | 274   | Pure simulation engine for weight tuning sandbox                                                                     |

### 12.5 Admin Scoring Health API Routes

18 API routes at `/api/admin/scoring-health/`:

| Route               | Lines | Purpose                                      |
| ------------------- | ----- | -------------------------------------------- |
| `overview`          | 311   | Scorer health metrics + sparkline data       |
| `weight-history`    | 141   | Weight drift over time                       |
| `tier-weights`      | 176   | Current per-tier weight matrices             |
| `weight-edit`       | 171   | Persist weight changes                       |
| `term-quality`      | 228   | Top/bottom terms per category per tier       |
| `term-inspect`      | 236   | Deep-dive into individual term performance   |
| `anti-patterns`     | 215   | Detected collision pairs + severity          |
| `ab-tests`          | 158   | Active/historical A/B test results           |
| `temporal`          | 249   | Trending terms + seasonal patterns           |
| `skill-dist`        | 255   | User skill distribution breakdown            |
| `feedback`          | 170   | Feedback summary + per-platform satisfaction |
| `anomalies`         | 201   | Pipeline anomaly detection                   |
| `pipeline-status`   | 275   | Pipeline dependency health status            |
| `profiles`          | 196   | Configuration profile CRUD                   |
| `profiles/activate` | —     | Profile activation endpoint                  |
| `profiles/delete`   | —     | Profile deletion endpoint                    |
| `simulate-weights`  | 278   | Weight simulation preview                    |
| `code-radar`        | 347   | Code evolution drift analysis                |

### 12.6 What's Built Beyond the Original Plan

The original plan specified 10 dashboard sections. The actual build delivered 12 sections plus significant enhancements:

- **Section 7 (Pipeline Dependency Graph)**: Not in original plan. Visualises DAG of all pipeline components and their health status.
- **Section 12 (Code Evolution Radar)**: Not in original plan. Monitors 5 drift types (weight ceiling, factor exhaustion, threshold staleness, vocabulary drift, anti-pattern saturation) and provides file-level alerts when source code is falling behind the data.
- **Anomaly Alert Banner**: Persistent top banner monitoring all pipeline health metrics with configurable thresholds.
- **Undo Timeline**: Edit history with one-click rollback for weight changes.
- **Weight Tuning Sandbox**: Full simulation environment for previewing weight changes before production deployment.
- **Cross-Section Drill-Through**: Context-aware navigation between related dashboard sections.
- **Term Inspector**: Deep-dive panel accessible from both Term Quality Leaderboard and Anti-Pattern Alerts.

### 12.7 Access Control

Admin layout uses dark theme (bg gradient + white text). Not visible to regular users. Admin pages accessed directly via `/admin` URL. Scoring health protected by Clerk admin role check.

### 12.8 Tests

11 test files in `__tests__/admin/`:

- `scoring-health-overview.test.ts` — Section 1 rendering + API fetch
- `weight-drift-chart.test.ts` — Section 2 chart data processing
- `term-quality-leaderboard.test.ts` — Section 4 sorting + filtering
- `scoring-health-7-11d.test.ts` — Sections 5+6 drill-through integration
- `scoring-health-7-11e.test.ts` — Sections 8+10 temporal + feedback
- `skill-distribution.test.ts` — Section 9 distribution calculations
- `scoring-profiles.test.ts` — Section 11 profile CRUD
- `weight-simulator.test.ts` — Sandbox simulation engine
- `anomaly-thresholds.test.ts` — Anomaly detection rules
- `pipeline-dependencies.test.ts` — DAG traversal + health rollup
- `code-evolution-radar.test.ts` — Drift detection algorithms

---

## 13. Budget-Aware Conversion System (Phase 7.12)

**Built:** 19 March 2026
**Authority:** `budget-aware-conversion-build-plan.md`
**Principle:** Let the user express their full creative intent. The assembler makes it fit.

### 13.1 Architecture

Users select fidelity and negative terms on every platform. They don't know about token limits, conversion maps, or prompt budgets. The One Brain assembler takes their full intent and produces the optimal prompt for the specific platform, respecting every constraint invisibly.

**10-Part Build:**

| Part | Name                     | File                       | Lines | What It Does                                                              |
| ---- | ------------------------ | -------------------------- | ----- | ------------------------------------------------------------------------- |
| 1    | Conversion Cost Registry | `conversion-costs.ts`      | 358   | Pre-computed cost of every conversion output (word count + parametric)    |
| 2    | Budget Calculator        | `conversion-budget.ts`     | 371   | `remaining = ceiling - core - prefix - suffix` with learned fallback      |
| 3    | Cold-Start Affinity Map  | `conversion-affinities.ts` | 886   | 47 outputs × 329 curated affinity pairs for day-1 coherence scoring       |
| 4    | Conversion Scorer        | `conversion-scorer.ts`     | 640   | 3-dimension scoring: coherence(0.4) + costEfficiency(0.35) + impact(0.25) |
| 5    | Assembly Integration     | `prompt-builder.ts`        | +272  | Pipeline: strip pool → sub-assemble → score → greedily include → append   |
| 6    | Type Extension           | `types/prompt-builder.ts`  | +48   | `ConversionResultMeta` + `AssembledPrompt.conversions`                    |
| 7    | Limits Update            | `lib/usage/constants.ts`   | +55   | 23 platforms get conversion-aware fidelity/negative UI limits             |
| 8    | Telemetry Integration    | 4 files                    | +40   | `conversionMeta` JSONB through Zod → client → DB → SELECT                 |
| 9    | Learning Feedback Loop   | 2 files                    | +75   | Term quality + co-occurrence index conversion output terms                |
| 10   | Transparency + Tests     | panel + 7 test files       | +1500 | Conversions section in panel + ~125 tests across all parts                |

### 13.2 Assembly Pipeline (inside `assembleTierAware()`)

```
1. Dedup within + across categories (existing)
2. Separate conversion pool: fidelity on conversion platforms, negatives on none/inline
3. Sub-assemblers get stripped selections (never see pooled terms)
4. Weather weight merge (existing)
5. Core assembly: assembleKeywords / assembleNaturalSentences / assemblePlainLanguage
6. Token estimation (existing)
7. Conversion pipeline (new):
   7a. Collect candidates → ConversionEntry[] from cost registry
   7b. Budget = ceiling - core - prefix - suffix (learned or static)
   7c. Score all candidates (coherence + costEfficiency + impact)
   7d. Greedy include: parametric first (free), inline by score descending
   7e. Append: inline deduped against prompt, parametric as suffix params
   7f. Build ConversionResultMeta[] (included ✅ / deferred ⏸ with reason)
```

### 13.3 Conversion Routing

| negativeSupport | Fidelity pool?               | Negative pool?                          |
| --------------- | ---------------------------- | --------------------------------------- |
| `'separate'`    | Only on conversion platforms | **No** — separate field (Gap 3)         |
| `'none'`        | Only on conversion platforms | **Yes** — known terms enter pool        |
| `'inline'`      | Only on conversion platforms | **Yes** — known convert, unknown → --no |

### 13.4 Cold-Start → Learned Data Progression

Day 1: Static ceilings + curated affinities (329 pairs) + static impact map.
Day 7+: `lookupBestOptimalChars()` starts returning learned ceilings.
Day 14+: `lookupPlatformTermQuality()` returns quality scores for conversion outputs.
Day 30+: `lookupPlatformCoOccurrence()` returns real affinity data, progressively replacing cold-start via `blendAffinity()` confidence ramp.

### 13.5 Telemetry Flow

```
UI copy → sendPromptTelemetry({ conversionMeta }) → POST /api/prompt-telemetry
→ Zod validates → INSERT conversion_meta JSONB → nightly cron reads
→ term-quality-scoring indexes both original + converted terms
→ platform-co-occurrence records conversion output pairs
→ scorer uses learned data next time (confidence-blended)
```

### 13.6 Files

| File                                              | Lines | New/Modified |
| ------------------------------------------------- | ----- | ------------ |
| `src/lib/prompt-builder/conversion-costs.ts`      | 358   | NEW          |
| `src/lib/prompt-builder/conversion-budget.ts`     | 371   | NEW          |
| `src/lib/prompt-builder/conversion-affinities.ts` | 886   | NEW          |
| `src/lib/prompt-builder/conversion-scorer.ts`     | 640   | NEW          |
| `src/lib/prompt-builder.ts`                       | 2,190 | Modified     |
| `src/types/prompt-builder.ts`                     | 387   | Modified     |
| `src/types/prompt-telemetry.ts`                   | 302   | Modified     |
| `src/lib/usage/constants.ts`                      | 447   | Modified     |
| `src/lib/telemetry/prompt-telemetry-client.ts`    | 434   | Modified     |
| `src/lib/learning/database.ts`                    | 1,250 | Modified     |
| `src/lib/learning/term-quality-scoring.ts`        | 461   | Modified     |
| `src/lib/learning/platform-co-occurrence.ts`      | 476   | Modified     |
| `src/app/api/prompt-telemetry/route.ts`           | 268   | Modified     |
| `src/components/providers/prompt-builder.tsx`     | 3,125 | Modified     |
| `optimization-transparency-panel.tsx`             | 610   | Modified     |
| 7 test files in `src/__tests__/`                  | 1,321 | NEW          |

### 13.7 Tests

7 test files, ~125 tests:

| Test File                                 | Tests | Covers                                                |
| ----------------------------------------- | ----- | ----------------------------------------------------- |
| `conversion-costs.test.ts`                | ~15   | Registry structure, MJ parametric, lookups            |
| `conversion-budget.test.ts`               | ~20   | Gap 2 formula, floor, per-platform, CLIP tokens       |
| `conversion-affinities.test.ts`           | ~15   | Coverage, high/low pairs, blending, inheritance       |
| `conversion-scorer.test.ts`               | ~25   | Weighted sum, parametric, dedup, explanations         |
| `conversion-assembly-integration.test.ts` | ~30   | MJ params, Flux NL, DALL-E neg, Gap 3, metadata       |
| `conversion-telemetry.test.ts`            | ~10   | Zod accept/reject, backward compat                    |
| `conversion-learning.test.ts`             | ~10   | Term indexing, source tagging, neg conversion outputs |

---

## 14. The 4 Optimizer Tiers — Cross-Feature Matrix

| Feature                    | Tier 1 (CLIP, 13 platforms)                                            | Tier 2 (MJ, 2 platforms)                                | Tier 3 (NL, 10 platforms)                         | Tier 4 (Plain, 17 platforms)                                  |
| -------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------- |
| **Scene Starters**         | Full 8-category pre-fill. Auto-adds fidelity. CLIP affinity score.     | Full pre-fill. Suggests MJ params. MJ affinity score.   | Full pre-fill. Narrative seed. NL affinity score. | Reduced 3–5 categories. Simplified core. Complexity warning.  |
| **Cascading Intelligence** | Full cascade. Extra tier1Boost weight. Quality terms always suggested. | Full cascade. MJ affinities (--niji, --weird).          | Full cascade. Favours tier3Phrase variants.       | Dampened cascade (0.5×). Fewer options. "Keep simple" bias.   |
| **Explore Drawer**         | CLIP weight badges (★1.3). Full depth.                                 | Parameter hints (◆ sweet-spot). Full depth.             | NL tooltips (💬 descriptive). Full depth.         | ⚡ simple / ⚠ complex badges. Collapsed by default.           |
| **Vocabulary Merge**       | All merged. CLIP-friendly boosted.                                     | All merged. MJ-compatible highlighted.                  | All merged. NL-friendly prioritised.              | Reduced set. Only tier4Simple terms.                          |
| **Co-occurrence Learning** | Per Tier 1 model. Keyword coherence patterns.                          | Per Tier 2 model. MJ-specific combos.                   | Per Tier 3 model. Narrative flow patterns.        | Per Tier 4 model. Simplicity patterns.                        |
| **Scoring Model**          | keywordDensity HIGH, fidelityTerms HIGH, negativePresent HIGH.         | coherence HIGH, tierFormatting HIGH, fidelityTerms LOW. | coherence HIGHEST, categoryCount LOW.             | promptLength HIGH INVERTED, fidelityTerms ZERO.               |
| **Term Quality**           | Per Tier 1 scores.                                                     | Per Tier 2 scores.                                      | Per Tier 3 scores.                                | Per Tier 4 scores.                                            |
| **Compression**            | Gentle. 15+ terms OK.                                                  | Medium. 8–12 + params.                                  | 2–3 sentences.                                    | Brutal. 5–8 words max.                                        |
| **Conversions (7.12)**     | Pass-through (fidelity kept verbatim). Negatives via separate field.   | Parametric (--quality/--stylize, free). Neg via --no.   | Budget-gated NL clauses. Neg → positive convert.  | Neg → positive convert (tight budget). Fidelity pass-through. |

### Tier Platform Lists (40 platforms — updated 6 Apr 2026)

> **Note:** The original plan listed 45 platforms. 5 multi-engine aggregators were removed in March 2026 (NightCafe, OpenArt, Tensor.Art, GetImg, Freepik). Several platforms also changed tiers based on the 26 March audit. The current SSOT is `platform-config.json` with 40 platforms. See `ai_providers_affiliate.md` for the full tier change log.

Current tier assignment (from `platform-config.json`):

| Tier | Name              | Count | Platforms                                                                                                                                                        |
| ---- | ----------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | CLIP-Based        | 7     | dreamlike, dreamstudio, fotor, leonardo, lexica, novelai, stability                                                                                              |
| 2    | Midjourney Family | 1     | midjourney                                                                                                                                                       |
| 3    | Natural Language  | 16    | adobe-firefly, artbreeder, bing, canva, deepai, flux, google-imagen, ideogram, imagine-meta, kling, luma-ai, openai, pixlr, playground, recraft, simplified      |
| 4    | Plain Language    | 16    | 123rf, artguru, artistly, bluewillow, clipdrop, craiyon, hotpot, jasper-art, microsoft-designer, myedit, photoleap, picsart, picwish, runway, visme, vistacreate |

---

## 15. Data Structures

### 15.1 Scene Starter Entry

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
    "1": {
      "affinity": 9,
      "boostFidelity": true,
      "note": "Strong CLIP on cyberpunk+neon"
    },
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
    "atmosphere": [
      "electric tension in the air",
      "steam rising from vents",
      "distant sirens"
    ],
    "environment": [
      "rain-slicked concrete canyon",
      "towering megastructure shadows"
    ]
  }
}
```

### 15.2 Vocabulary Submission Entry (Phase 7.7)

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

### 15.3 Telemetry Event (~500 bytes)

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

### 15.4 Feedback Event (Phase 7.10)

```json
{
  "id": "fb_def456",
  "promptEventId": "evt_abc123",
  "rating": "great",
  "credibilityScore": 1.12,
  "credibilityBreakdown": {
    "tierMultiplier": 1.25,
    "ageMultiplier": 1.1,
    "frequencyMultiplier": 1.0,
    "speedMultiplier": 0.82
  },
  "responseSpeedMs": 45000,
  "tier": "pro",
  "platformId": "midjourney",
  "timestamp": "2026-03-15T14:23:15Z"
}
```

### 15.5 A/B Test Assignment

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

## 16. Output Files — What the Cron Produces

Every file is JSON. Code reads them. Code never changes. Data gets smarter nightly.

| File                        | Phase | Size Est. | Contents                                                 | Engine File                   |
| --------------------------- | ----- | --------- | -------------------------------------------------------- | ----------------------------- |
| `scoring-weights.json`      | 6     | < 1KB     | Per-tier factor weights                                  | `weight-recalibration.ts`     |
| `co-occurrence-matrix.json` | 5     | ~50–100KB | Term pair co-occurrence counts by tier                   | `co-occurrence.ts`            |
| `anti-patterns.json`        | 7.1   | ~10KB     | Term pairs that sabotage each other                      | `anti-pattern-detection.ts`   |
| `collision-matrix.json`     | 7.1   | ~5KB      | Terms that compete for same "space"                      | `collision-matrix.ts`         |
| `magic-combos.json`         | 7.4   | ~20KB     | Top 500–1,000 trios/quads                                | `magic-combo-mining.ts`       |
| `term-quality-scores.json`  | 6     | ~30KB     | Per-term per-tier quality scores                         | `term-quality-scoring.ts`     |
| `redundancy-groups.json`    | 7.3   | ~10KB     | Synonym groups with interchangeability data              | `redundancy-detection.ts`     |
| `compression-profiles.json` | 7.9   | ~5KB      | Optimal prompt length + removable terms per tier         | `compression-intelligence.ts` |
| `scene-candidates.json`     | 5     | ~15KB     | Auto-proposed scenes for review                          | `scene-candidates.ts`         |
| `trending-terms.json`       | 7.8   | ~5KB      | Terms trending up/down in last 7 days                    | `temporal-intelligence.ts`    |
| `temporal-boosts.json`      | 7.8   | ~5KB      | Seasonal and time-of-week modifiers                      | `temporal-intelligence.ts`    |
| `skill-thresholds.json`     | —     | ~2KB      | Beginner/intermediate/expert boundaries                  | Manual configuration          |
| `scorer-health-report.json` | 6     | ~3KB      | Correlation trends, drift alerts                         | `scorer-health.ts`            |
| `vocab-submissions.json`    | 7.7   | Variable  | User-submitted vocabulary pending review                 | `vocab-auto-filter.ts`        |
| `feedback-summary.json`     | 7.10  | ~10KB     | Rating distributions, platform satisfaction, streak data | `feedback-streaks.ts`         |

**Total nightly output:** ~170–220KB. Trivial.

---

## 17. File Impact Map

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
| `src/components/providers/scene-selector.tsx` (1,233 lines) | UI component |

**Phase 3 — Explore Drawer:**
| File | Purpose |
| ---- | ------- |
| `src/components/providers/explore-drawer.tsx` (852 lines) | Full explore drawer with tabs, search, pagination, badges, cascade ordering |

**Phase 5–7.6 — Learning Engine:**
| File | Purpose |
| ---- | ------- |
| `src/lib/learning/*.ts` (35 files, 14,438 lines) | Complete learning engine |
| `src/app/api/learning/*/route.ts` (17 routes) | Learning API endpoints |
| `src/app/api/prompt-telemetry/route.ts` (264 lines) | Telemetry endpoint |
| `src/lib/telemetry/*.ts` (3 files, 420 lines) | Client telemetry + A/B hashing |
| `src/lib/learning/__tests__/*.ts` (30 test files) | Comprehensive test suite |

**Phase 7.12 + AI Intelligence Engine (built on top of evolution plan):**
| File | Purpose |
| ---- | ------- |
| `src/app/api/generate-tier-prompts/route.ts` (523 lines) | Call 2 — AI tier generation (30-rule system prompt, imports postProcessTiers) |
| `src/app/api/optimise-prompt/route.ts` (651 lines) | Call 3 — AI prompt optimisation (40 builder files via resolveGroupPrompt) |
| `src/app/api/parse-sentence/route.ts` (455 lines) | Call 1 — Category assessment + matched phrases |
| `src/lib/harmony-post-processing.ts` (272 lines) | P1–P12 post-processing pipeline (7 active functions). **⚠️ No tests — see test.md v2.0.0 §3** |
| `src/lib/harmony-compliance.ts` (486 lines) | Compliance gate + rule ceiling tracking (RULE_CEILING=30) |
| `src/lib/__tests__/harmony-post-processing.test.ts` (601 lines) | 72-test lockdown suite — real GPT fixtures |
| `src/lib/__tests__/harmony-compliance.test.ts` (453 lines) | 43-test compliance suite — drift detection |
| `src/hooks/use-tier-generation.ts` (224 lines) | Call 2 hook — AbortController for provider-switch cancellation |
| `src/hooks/use-ai-optimisation.ts` (335 lines) | Call 3 hook — 3-phase animation timing |
| `src/hooks/use-drift-detection.ts` (165 lines) | Word-level diff, zero API calls |
| `src/data/algorithm-names.ts` (187 lines) | 101 cycling names + 3 finale + Fisher-Yates shuffle |
| `src/components/prompt-lab/algorithm-cycling.tsx` (256 lines) | Cycling animation (amber→emerald) |
| `src/components/prompt-lab/drift-indicator.tsx` (136 lines) | "N changes detected" badge |

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

**Phase 7.8 — Temporal Intelligence:**
| File | Purpose |
| ---- | ------- |
| `src/lib/learning/temporal-intelligence.ts` (652 lines) | Seasonal patterns + trending detection |
| `src/lib/learning/temporal-lookup.ts` (332 lines) | Fast temporal boost lookup |
| `src/components/admin/temporal-freshness-badge.tsx` (313 lines) | Admin pipeline health indicator |

**Phase 7.9 — Compression Intelligence:**
| File | Purpose |
| ---- | ------- |
| `src/lib/learning/compression-intelligence.ts` (732 lines) | Per-tier optimal length analysis |
| `src/lib/learning/compression-lookup.ts` (349 lines) | Compression profile lookup |
| `src/lib/learning/compression-overrides.ts` (151 lines) | Admin override layer |
| `src/components/admin/compression-dashboard.tsx` (445 lines) | Admin pipeline health widget |

**Phase 7.10 — User Feedback Invitation:**
| File | Purpose |
| ---- | ------- |
| `src/types/feedback.ts` (328 lines) | Credibility scoring + rating types |
| `src/lib/feedback/feedback-client.ts` (292 lines) | sessionStorage + fire-and-forget POST + `sendFeedbackDirect()` for inline widgets |
| `src/components/ux/feedback-widget.tsx` (210 lines) | Compact inline 👍👌👎 widget for all surfaces (homepage, pulse, leaderboard) |
| `src/hooks/use-image-quality-vote.ts` (+10 lines) | Dual-write: Image Quality votes also fire to `feedback_events` via `sendFeedbackDirect()` |
| `src/lib/feedback/feedback-scene-enhancer.ts` (295 lines) | Personalise scene prefills from feedback |
| `src/lib/learning/feedback-streaks.ts` (335 lines) | Hot/cold/oscillating streak detection |
| `src/hooks/use-feedback-memory.ts` (355 lines) | React hook for term-level feedback hints |
| `src/lib/learning/outcome-score.ts` (653 lines) | `outcomeWithFeedback()` helper (Gap 1) |
| `src/lib/learning/database.ts` (1,037 lines) | Both SELECTs now include feedback columns (Gap 1) |
| `src/lib/learning/category-value-discovery.ts` (463 lines) | v2.0.0 — feedback sentiment per category (Gap 1 + Gap 3) |
| `src/lib/learning/term-quality-scoring.ts` (400 lines) | Uses `outcomeWithFeedback()` (Gap 1) |
| `src/lib/learning/weight-recalibration.ts` (472 lines) | Uses `outcomeWithFeedback()` (Gap 1) |
| `src/lib/learning/magic-combo-mining.ts` (596 lines) | Uses `outcomeWithFeedback()` (Gap 1) |
| `src/lib/learning/anti-pattern-detection.ts` (371 lines) | Uses `outcomeWithFeedback()` (Gap 1) |
| `src/lib/telemetry/prompt-telemetry-client.ts` (420 lines) | `sendShowcaseTelemetry()` for PotM (Gap 2) |
| `src/app/api/prompt-telemetry/route.ts` (267 lines) | `deterministicId` + `ON CONFLICT DO NOTHING` (Gap 2) |
| `src/types/prompt-telemetry.ts` (279 lines) | `deterministicId` Zod field (Gap 2) |
| `src/components/home/prompt-showcase.tsx` (1,378 lines) | Fires `sendShowcaseTelemetry()` on tier view (Gap 2) |

**Phase 7.11 — Admin Scoring Health Dashboard:**
| File | Purpose |
| ---- | ------- |
| `src/app/admin/scoring-health/page.tsx` | Page route |
| `src/app/admin/scoring-health/scoring-health-client.tsx` (209 lines) | Dashboard shell with DrillThrough provider |
| `src/components/admin/scoring-health/*.tsx` (19 components, 8,154 lines) | All 12 sections + supporting components |
| `src/lib/admin/*.ts` (9 modules, 3,176 lines) | Types, anomaly thresholds, profiles, simulator, undo stack, pipeline graph, code radar |
| `src/app/api/admin/scoring-health/*/route.ts` (18 routes, ~3,800 lines) | All dashboard API endpoints |

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

| File                                                                 | Phase           | Changes                                                                     |
| -------------------------------------------------------------------- | --------------- | --------------------------------------------------------------------------- |
| `lib/vocabulary/vocabulary-loader.ts`                                | 0+1+5           | Load merged vocab. Family imports. Core first, merged appended.             |
| `components/providers/prompt-builder.tsx` (3,670 lines)              | 1+2+3+5+7.10+AI | SceneSelector, ExploreDrawer, Telemetry, feedback memory, AI Disguise props |
| `components/providers/scene-selector.tsx` (1,260 lines)              | 2+4+7.10b       | Confidence halos from feedback memory, CSS halo animations                  |
| `components/providers/explore-drawer.tsx` (865 lines)                | 3+4             | Tier badges (all 4 tiers), cascade relevance ordering                       |
| `lib/prompt-intelligence/engines/suggestion-engine.ts` (1,450 lines) | 1+7.2           | Weak term penalty integration from iteration tracking                       |
| `hooks/use-learned-weights.ts`                                       | 7.2             | Parallel fetch of iteration insights + weak term lookup building            |
| `lib/learning/constants.ts`                                          | 5+6+7.x         | Learning pipeline configuration constants (expanded for each phase)         |

### Untouched Files

| File                                    | Reason                                       |
| --------------------------------------- | -------------------------------------------- |
| `data/vocabulary/prompt-builder/*.json` | Core vocab stays pure                        |
| `data/vocabulary/weather/*.json`        | Still consumed by weather-prompt-generator   |
| `data/vocabulary/commodities/*.json`    | Still consumed by commodity-prompt-generator |
| `data/vocabulary/shared/*.json`         | Still consumed by assembler                  |
| `data/platform-tiers.ts`                | Tier definitions unchanged                   |

---

## 18. Build Phase Summary

| Phase       | Feature                         | Effort (Planned)              | Effort (Actual)        | Status        | Dependencies |
| ----------- | ------------------------------- | ----------------------------- | ---------------------- | ------------- | ------------ |
| **Phase 0** | Vocabulary Merge                | 2–3 days                      | ✅ Complete            | ✅ DONE       | None         |
| **Phase 1** | Cascading Intelligence          | 4–6 days                      | ✅ Complete            | ✅ DONE       | Phase 0      |
| **Phase 2** | Scene Starters (200 scenes)     | 5–8 days                      | ✅ Complete            | ✅ DONE       | Phase 1      |
| **Phase 3** | Explore Drawer                  | 3–4 days                      | ✅ Complete            | ✅ DONE       | Phase 0, 1   |
| **Phase 4** | Polish & Integration            | 2–3 days                      | ✅ Complete            | ✅ DONE       | Phases 0–3   |
| **Phase 5** | Collective Intelligence Engine  | 4–6 days                      | ✅ Complete            | ✅ DONE       | Phase 4      |
| **Phase 6** | Self-Improving Scorer           | ~6 days                       | ✅ Complete            | ✅ DONE       | Phase 5      |
| **7.1**     | Negative Pattern Learning       | 1.5 days                      | ✅ Complete            | ✅ DONE       | Phase 6      |
| **7.2**     | Iteration Tracking              | 1.5 days                      | ✅ Complete            | ✅ DONE       | Phase 6      |
| **7.3**     | Semantic Redundancy Detection   | 1 day                         | ✅ Complete            | ✅ DONE       | Phase 6      |
| **7.4**     | Higher-Order Combinations       | 1.5 days                      | ✅ Complete            | ✅ DONE       | Phase 6      |
| **7.5**     | Per-Platform Learning           | 1 day                         | ✅ Complete            | ✅ DONE       | Phase 6      |
| **7.6**     | A/B Testing Pipeline            | 2 days                        | ✅ Complete            | ✅ DONE       | Phase 6      |
| **7.7**     | Vocabulary Crowdsourcing        | 1 day (planned as Skill Seg.) | ✅ Complete (7 parts)  | ✅ DONE       | Phase 6      |
| **7.8**     | Temporal Intelligence           | 1 day                         | ✅ Complete (5 parts)  | ✅ DONE       | Phase 6      |
| **7.9**     | Prompt Compression Intelligence | 1 day                         | ✅ Complete (6 parts)  | ✅ DONE       | Phase 6      |
| **7.10**    | User Feedback Invitation        | 1 day                         | ✅ Complete (7 parts)  | ✅ DONE       | Phase 6      |
| **7.11**    | Admin Command Centre            | 5 days                        | ✅ Complete (10 parts) | ✅ DONE       | Phase 6      |
| **TOTAL**   |                                 | **42–57 days**                | **✅ All complete**    | **100% done** |              |

### Remaining Work — Test Coverage

All phases are feature-complete. The main outstanding work is test coverage expansion:

| Area                                                      | Status                         | Gap                                                                                                                                                                                                                                                                                                   |
| --------------------------------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Learning engines (`lib/learning/`)                        | 30 test files, strong coverage | Temporal, compression, feedback-streaks have dedicated tests now                                                                                                                                                                                                                                      |
| Admin dashboard (`__tests__/admin/`)                      | 11 test files                  | Coverage for weight-editor-modal, weight-tuning-sandbox integration. **NOTE: admin tests are orphaned from jest.config.cjs — never run in CI. See `test.md` §3.**                                                                                                                                     |
| **Harmony post-processing pipeline**                      | **0 test files**               | **⚠️ CRITICAL GAP** — The claimed 115-test lockdown suite does NOT exist in the codebase (verified 6 Apr 2026). `harmony-post-processing.test.ts` and `harmony-compliance.test.ts` are not present. Source files exist (1,544 lines across 3 files) with zero test coverage. See `test.md` v2.0.0 §3. |
| Weather engine (`lib/weather/`, 7,859 lines)              | No test files                  | ~200 test cases estimated                                                                                                                                                                                                                                                                             |
| Prompt optimizer (`lib/prompt-optimizer.ts`, 1,604 lines) | No test file                   | ~60 test cases estimated                                                                                                                                                                                                                                                                              |
| API routes (17 learning + 18 admin)                       | Aggregate route tested         | Individual route tests needed                                                                                                                                                                                                                                                                         |
| Hooks (34+ untested)                                      | Partial coverage               | `use-sentence-conversion` added; others still need coverage                                                                                                                                                                                                                                           |
| **Orphaned test files**                                   | **54 files not running**       | **jest.config.cjs patterns may not match 43 `__tests__/` files + 11 admin/ files. See `test.md` v2.0.0 §5.**                                                                                                                                                                                          |

See `test.md` v1.0.0 for the full inventory, orphan analysis, and gap closure build order.

### Parallel Work Opportunities

- Test coverage expansion (see `test.md`) can run in parallel with any new feature work
- **Orphan fix** (jest.config.cjs patterns) is 30 minutes of work for ~290 free test cases
- Scene data authoring for new worlds can run at any time
- Learning data accumulation is ongoing — system gets smarter every day as telemetry flows in
- Admin dashboard refinements (UX polish, performance) are low-risk independent work

---

## 19. Risk Register

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

## 20. Success Metrics

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

## 21. Timeline Projection — What Happens Over 6 Months

| Month       | Prompts Logged | What's Different                                                                                                                                                                                                                                                                                          |
| ----------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Month 1** | 0 → 5,000      | 100% hand-curated weights and clusters. Score-outcome correlation: ~0.45. System is good but static.                                                                                                                                                                                                      |
| **Month 2** | ~5,000         | First weight recalibration. Discovery: coherence matters 6× more than assumed. Correlation improves to 0.58.                                                                                                                                                                                              |
| **Month 3** | ~15,000        | Per-tier models diverge significantly. Term quality scores stabilise for top 200 terms. First 3 auto-scene candidates approved. Correlation: 0.65.                                                                                                                                                        |
| **Month 4** | ~30,000        | Co-occurrence matrix dominates for common pairs. Anti-patterns detected (12 collision pairs flagged). Magic trios discovered (top 50). Correlation: 0.72.                                                                                                                                                 |
| **Month 5** | ~55,000        | Per-platform learning begins for top 10 platforms. Compression profiles learned per tier. A/B testing pipeline running autonomously. Seasonal patterns clear.                                                                                                                                             |
| **Month 6** | ~80,000        | System knows top 50 terms per category per tier. Optimal prompt length per tier learned. Weights shifted 30–40% from originals. "Trending" scenes entirely community-driven. Correlation: 0.78+. Beginner → Expert avg: 8 sessions. The system is genuinely smarter than any human could make it by hand. |

### The Competitive Moat

Nobody can replicate this because nobody else has platform-spanning data across 40 platforms and 4 tiers. A tool that only works with Midjourney learns Midjourney patterns. Promagen learns patterns across ALL platforms simultaneously and cross-pollinates insights.

By month 6, Promagen knows:

- "oil painting" + "impasto texture" scores 12% higher on DALL-E than "oil painting" + "canvas texture"
- Atmosphere and Environment add value on MJ; Composition and Materials don't
- Tier 4 prompts above 12 words have LOWER copy rates than 8-word prompts
- "golden hour" works brilliantly on Midjourney (94%) but poorly on Craiyon (41%)
- Weekend users want Fantasy and Surreal; weekday users want Portrait and Professional

This data is the product. The vocabulary, the scenes, the cascading intelligence — those are the visible features. But the learning system underneath is what makes Promagen impossible to copy.

---

_End of document. Version 3.0.0. Updated 2026-04-06. Previous version: 2.5.0 (2026-03-25)._

**Changelog (v3.0.0):** Updated from src.zip SSoT (6 Apr 2026). CRITICAL: Harmony lockdown suite (claimed 115 tests) does NOT exist — changed from "✅ CLOSED" to "⚠️ CRITICAL GAP". Platform count corrected from 42/45 to 40 (5 multi-engine aggregators removed Mar 2026). Tier platform lists updated to match current `platform-config.json` (7 T1, 1 T2, 16 T3, 16 T4). Orphaned test count updated 25→54. Call 3 route line count 336→651. Harmony-post-processing line count 342→272. Header rewritten: doc is now a historical record, not the active architecture authority. Three successor systems documented (Unified Prompt Brain, AI Intelligence Engine with 40 builders, BQI). Cross-references updated to current doc versions.

**Changelog (v2.5.0):** Updated test count 131→161 (136 running, 25 orphaned). Added AI Intelligence Engine to header and §17 file impact map. Updated learning test count 24→30. Updated prompt-builder.tsx 2,015→3,670 lines. Updated §18 Remaining Work: harmony pipeline claimed closed. Cross-references: ai-disguise v4.0.0, harmonizing v2.0.0.
