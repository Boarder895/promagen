# Prompt Builder Evolution Plan v2.0

**Version:** 2.0.0  
**Created:** 2026-02-24  
**Status:** Planning — No code yet  
**Authority:** This document is the single source of truth for the prompt builder evolution.  
**Admin Route:** `/admin/scoring-health` (separate standalone page)

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
12. [Admin Command Centre (Phase 7.10)](#12-admin-command-centre-phase-710)
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
- **Advanced Learning** detects anti-patterns, tracks iterations, finds magic combinations, learns per-platform, A/B tests improvements, adapts to user skill level, responds to temporal trends, compresses prompts intelligently, and incorporates direct user feedback

All features work across all 4 optimizer tiers (CLIP, Midjourney, Natural Language, Plain Language) and all 42 platforms.

---

## 2. Feature Overview

| #   | Feature                            | What it does                                                                 | Tier                  | Phase | Depends on |
| --- | ---------------------------------- | ---------------------------------------------------------------------------- | --------------------- | ----- | ---------- |
| D   | **Vocabulary Merge**               | Curate + map weather/commodity/shared phrases into prompt builder categories | Free (data layer)     | 0     | Nothing    |
| B   | **Cascading Intelligence**         | Reorder downstream dropdowns based on upstream selections                    | Free                  | 1     | Phase 0    |
| A   | **Scene Starters**                 | Pre-populate categories from curated scene templates (hierarchical dropdown) | Free (25) / Pro (200) | 2     | Phase 1    |
| C   | **Explore Drawer**                 | Expandable panel showing full vocabulary per category, contextually filtered | Free                  | 3     | Phase 0, 1 |
| —   | **Polish & Integration**           | Cross-feature wiring, analytics, fluid typography, docs                      | —                     | 4     | Phases 0–3 |
| —   | **Collective Intelligence Engine** | Telemetry + co-occurrence learning + auto-scene generation                   | —                     | 5     | Phase 4    |
| —   | **Self-Improving Scorer**          | Weight recalibration + per-tier models + threshold auto-adjustment           | —                     | 6     | Phase 5    |
| —   | **Advanced Learning Systems**      | 10 additional learning dimensions + Admin Command Centre                     | —                     | 7     | Phase 6    |

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

### 4.1 What Gets Merged

**MERGE — universally useful for image prompts:**

| Source                                          | Category Target        | Count                 | Why                                            |
| ----------------------------------------------- | ---------------------- | --------------------- | ---------------------------------------------- |
| weather/urban-light.json                        | Lighting               | 254                   | "Sodium-vapour haze", "neon on wet asphalt"    |
| weather/city-vibes.json → venues                | Environment            | ~1,032                | "Tsukiji Fish Market", "Corniche waterfront"   |
| weather/conditions.json                         | Atmosphere             | 280                   | "Rain-slicked", "fog-shrouded"                 |
| weather/temperature.json                        | Atmosphere             | ~40 (subset)          | "Blistering heat", "bone-chilling cold"        |
| weather/wind.json                               | Atmosphere             | ~60 (subset)          | "Howling gale", "gentle breeze"                |
| commodities/sensory-visual.json                 | Materials, Colour      | 150                   | Metallic colours, organic textures             |
| commodities/night-operations.json → lighting    | Lighting               | ~47                   | "Refinery flare glow", "dock crane spotlights" |
| commodities/night-operations.json → atmosphere  | Atmosphere             | ~60                   | "Shift-change quiet", "24/7 hum"               |
| commodities/transformation-states.json          | Action                 | ~200                  | "Smelting", "forging", "distilling"            |
| commodities/extraction-methods.json             | Action                 | ~100                  | "Deep mining", "offshore drilling"             |
| commodities/rituals.json → daily + professional | Action                 | ~80                   | "Morning inspection", "quality testing"        |
| commodities/human-stories-workers.json          | Subject                | ~126                  | "Oil rig roughneck", "tea plantation picker"   |
| commodities/human-stories-traders.json          | Subject                | ~60 (subset)          | "Floor trader", "commodity broker"             |
| commodities/price-states.json                   | Atmosphere             | ~60 (subset)          | "Euphoric ascent", "creeping dread"            |
| commodities/containers.json                     | Environment, Materials | ~100                  | "Cargo containers", "grain silos"              |
| commodities/production-countries.json           | Environment            | ~200                  | "Brazilian highlands", "Arabian desert"        |
| shared/adjectives.json                          | Atmosphere, Colour     | ~200 (curated subset) | Universal descriptors                          |

**DO NOT MERGE — too domain-specific:**

| Source                                   | Why                                           |
| ---------------------------------------- | --------------------------------------------- |
| commodities/geopolitical.json            | "Sanctions regime" — not visual               |
| commodities/trading-culture.json (most)  | "Open outcry", "margin call" — finance jargon |
| commodities/historical-moments.json      | "Tulip mania" — too narrative                 |
| commodities/weather-commodity-links.json | Too specific                                  |
| commodities/absence-states.json (most)   | Niche                                         |
| shared/connectors.json                   | Assembler glue, not user choices              |
| shared/intensifiers.json                 | Assembler modifiers                           |

### 4.2 Merge Architecture

```
vocabulary/
  prompt-builder/     ← UNTOUCHED (3,955 core phrases)
  weather/            ← UNTOUCHED (still used by weather-prompt-generator)
  commodities/        ← UNTOUCHED (still used by commodity-prompt-generator)
  shared/             ← UNTOUCHED (still used by assembler)
  merged/             ← NEW: curated subset mapped to prompt builder categories
    lighting.json     ← urban-light + commodity night-ops lighting
    atmosphere.json   ← weather conditions + price-states moods + wind + temp
    environment.json  ← city venues + production regions + containers
    subject.json      ← worker archetypes + trader archetypes
    action.json       ← transformations + extractions + rituals
    materials.json    ← sensory-visual textures + commodity appearances
    colour.json       ← sensory-visual colours + adjective colours
    merge-manifest.json ← tracks source, count, version for each merged file
```

### 4.3 Build Steps

| Step | Task                                  | Details                                                                                       |
| ---- | ------------------------------------- | --------------------------------------------------------------------------------------------- |
| 0.1  | Audit and curate weather phrases      | Extract ~1,566 phrases. Hand-review. Remove duplicates. Map to target categories.             |
| 0.2  | Audit and curate commodity phrases    | Extract ~1,770 phrases. Remove finance jargon. Map to target categories.                      |
| 0.3  | Audit and curate shared phrases       | Select ~350 universal adjectives. Map to Atmosphere and Colour.                               |
| 0.4  | Create `vocabulary/merged/` directory | 7 JSON files + merge-manifest.json.                                                           |
| 0.5  | Verify phrase counts                  | Automated test: manifest counts match actual JSON counts. No duplicates across core + merged. |

**Effort:** 2–3 days  
**Verification:** `npm run test -- merge-manifest` passes. Total merged ≈ 3,686 new phrases.

---

## 5. Feature B — Cascading Intelligence (Phase 1)

### 5.1 Concept

Every time the user selects or changes a value in ANY category, the system re-evaluates and reorders every other category's dropdown. Most contextually relevant options float to the top. Nothing is removed — only reordered.

### 5.2 The Relationship Graph — Three Layers

**Layer 1 — Semantic Clusters (broad strokes, 40–60 clusters)**

A cluster maps terms across multiple categories that naturally go together:

```
CLUSTER: "cyberpunk"
  subject:     [cyberpunk hacker, android humanoid, bounty hunter, mech pilot]
  action:      [running dynamically, fighting fiercely, casting spell]
  style:       [digital painting, concept art, cyberpunk aesthetic, synthwave]
  environment: [cyberpunk city, neon alleyway, futuristic metropolis]
  lighting:    [neon glow, holographic, LED strips, blacklight UV]
  atmosphere:  [ominous, dramatic, energetic, mysterious]
  colour:      [neon colors, teal and orange, high contrast]
  materials:   [chrome reflection, iridescent metal, brushed steel]
  camera:      [anamorphic lens, dutch angle]
  composition: [rule of thirds, leading lines, diagonal composition]
  fidelity:    [8k resolution, ray tracing, unreal engine]
```

**Layer 2 — Direct Affinities (fine-grained, 200–400 pairs)**

```
"golden hour"  → boosts: [warm palette, serene, earth tones, film photography]
               → penalises: [neon glow, blacklight UV]
"85mm portrait lens" → boosts: [shallow depth of field, bokeh background]
"anime style"  → boosts: [vibrant colors, dynamic actions, --niji 6]
```

**Layer 3 — Existing Infrastructure (already built)**

`families.json` defines style families with `bestWith` and `avoidWith`. The vocabulary-loader already scores by family.

### 5.3 Scoring Algorithm

On every selection change:

1. **Cluster detection** — which clusters does the selected term belong to?
2. **Compound scoring** — for each candidate in every other category:
   - `clusterBoost = (number of active cluster members) × clusterWeight`
   - `directBoost = sum of direct affinity scores from all selected terms`
   - `familyBoost = existing vocabulary-loader family scoring`
   - `penaltyScore = avoidWith penalties + conflict detection`
   - `finalScore = clusterBoost + directBoost + familyBoost - penaltyScore`
3. **Reorder** — sort each category's options by finalScore descending
4. **Preserve** — user's existing selections stay locked, only unselected options reorder

### 5.4 Tier-Aware Cascade

| Tier               | Cascade Behaviour                                                                        |
| ------------------ | ---------------------------------------------------------------------------------------- |
| **Tier 1 (CLIP)**  | Extra weight to terms with `tier1Boost`. CLIP benefits from keyword coherence.           |
| **Tier 2 (MJ)**    | MJ-specific affinities. "Anime style" boosts `--niji 6`. "Cinematic" boosts `--ar 21:9`. |
| **Tier 3 (NL)**    | Favours terms with `tier3Phrase` variants (richer natural language forms).               |
| **Tier 4 (Plain)** | Dampened weights (0.5×). "Keep it simple" bias.                                          |

### 5.5 Build Steps

| Step | Task                                | Details                                                                     |
| ---- | ----------------------------------- | --------------------------------------------------------------------------- |
| 1.1  | Design semantic clusters JSON       | `data/intelligence/semantic-clusters.json` — 40–60 clusters                 |
| 1.2  | Design direct affinities JSON       | `data/intelligence/direct-affinities.json` — 200–400 pairs                  |
| 1.3  | Extend vocabulary-loader.ts scoring | Add cluster + affinity scoring alongside family scoring                     |
| 1.4  | Connect full cross-category context | `loadCategoryVocabulary()` accepts all selected terms across all categories |
| 1.5  | Wire into prompt-builder.tsx        | On any selection change, rebuild context and re-score. Debounce 100ms.      |
| 1.6  | Tier-aware scoring weights          | Per-tier weight multipliers                                                 |
| 1.7  | Load merged vocab                   | `loadCategoryVocabulary()` loads core + merged, core has base priority      |
| 1.8  | Performance test                    | Target: < 16ms (one frame). Web Worker fallback if needed.                  |

**Effort:** 3–5 days  
**Verification:** Select "cyberpunk hacker" → Action shows "fighting fiercely" in top 5. Lighting shows "neon glow" in top 5.

---

## 6. Feature A — Scene Starters (Phase 2)

### 6.1 Concept

A dropdown positioned above Subject labelled "Scene Blueprint". Hierarchical accordion layout — headings first, then scenes within each heading. Pre-populates 4–8 categories with coherent values. Every pre-filled value individually clearable.

### 6.2 Hierarchical Dropdown UX

```
Step 1 — User clicks "Scene Blueprint" dropdown. Sees HEADINGS only:
┌──────────────────────────────────────────────────────┐
│  ▸ Portraits & People              (5 scenes)       │
│  ▸ Landscapes & Worlds             (5 scenes)       │
│  ▸ Mood & Atmosphere               (5 scenes)       │
│  ▸ Style-Forward                   (5 scenes)       │
│  ▸ Trending / Seasonal             (5 scenes)       │
│                                                      │
│  ── Pro Worlds ──────────────────── 🔒 ──────────── │
│  ▸ Cinematic                       (12 scenes)      │
│  ▸ Fantasy & Mythology             (12 scenes)      │
│  ▸ Sci-Fi & Future                 (12 scenes)      │
│  ...14 more worlds                                   │
└──────────────────────────────────────────────────────┘

Step 2 — User clicks "Portraits & People". Heading EXPANDS (others collapse):
┌──────────────────────────────────────────────────────┐
│  ▾ Portraits & People              (5 scenes)       │
│    ┌──────────────────────────────────────────────┐  │
│    │ 🎬 Dramatic Portrait                        │  │
│    │    Moody studio portrait with dramatic       │  │
│    │    lighting and cinematic feel               │  │
│    │──────────────────────────────────────────────│  │
│    │ ⚔️ Fantasy Hero                              │  │
│    │    Warrior in an enchanted forest            │  │
│    │    at golden hour                            │  │
│    │──────────────────────────────────────────────│  │
│    │ 📸 Street Photographer                      │  │
│    │    Night-time Tokyo street scene             │  │
│    │    with neon reflections                     │  │
│    │──────────────────────────────────────────────│  │
│    │ 🕰️ Vintage Glamour                          │  │
│    │    Classic Hollywood elegance in             │  │
│    │    candlelit ballroom                        │  │
│    │──────────────────────────────────────────────│  │
│    │ 🤖 Cyberpunk Character                      │  │
│    │    Neon-lit hacker in a dystopian city       │  │
│    └──────────────────────────────────────────────┘  │
│  ▸ Landscapes & Worlds             (5 scenes)       │
│  ▸ Mood & Atmosphere               (5 scenes)       │
│  ...                                                 │
└──────────────────────────────────────────────────────┘

Step 3 — User clicks "Cyberpunk Character":
  → Dropdown closes
  → Categories pre-fill with scene values
  → Scene name appears in Scene Blueprint bar with ✕ to clear
  → Cascade Intelligence triggers on all pre-filled values
```

**Rules:**

- Only one heading expanded at a time (accordion behaviour)
- Pro world headings expand to show scene names + descriptions, but clicking a scene triggers upgrade prompt
- Each pre-filled value has ✕ to clear individually
- "Reset Scene" button clears all pre-fills (confirmation dialog if user modified values)

### 6.3 The 25 Free Scenes

**Portraits & People (5)**

| #   | Scene Name          | Subject             | Action               | Style            | Environment      | Lighting          | Atmosphere |
| --- | ------------------- | ------------------- | -------------------- | ---------------- | ---------------- | ----------------- | ---------- |
| 1   | Dramatic Portrait   | portrait of a woman | looking away         | cinematic        | studio backdrop  | dramatic lighting | mysterious |
| 2   | Fantasy Hero        | fantasy warrior     | standing confidently | concept art      | enchanted forest | golden hour       | ethereal   |
| 3   | Street Photographer | street photographer | walking dynamically  | film photography | tokyo at night   | neon glow         | energetic  |
| 4   | Vintage Glamour     | fashion model       | leaning casually     | daguerreotype    | grand ballroom   | candlelight       | romantic   |
| 5   | Cyberpunk Character | cyberpunk hacker    | casting spell        | digital painting | cyberpunk city   | neon glow         | ominous    |

**Landscapes & Worlds (5)**

| #   | Scene Name         | Subject            | Style            | Environment        | Lighting         | Atmosphere | Colour         |
| --- | ------------------ | ------------------ | ---------------- | ------------------ | ---------------- | ---------- | -------------- |
| 6   | Enchanted Forest   | tree of life       | oil painting     | enchanted forest   | dappled sunlight | ethereal   | warm palette   |
| 7   | Desert Ruins       | ancient ruins      | matte painting   | desert oasis       | midday sun       | mysterious | earth tones    |
| 8   | Underwater Kingdom | mermaid            | digital painting | underwater palace  | bioluminescent   | mystical   | cool tones     |
| 9   | Space Vista        | spaceship          | concept art      | floating islands   | starlight        | serene     | monochromatic  |
| 10  | Volcanic Fury      | volcanic landscape | hyperrealistic   | volcanic landscape | fire light       | dramatic   | vibrant colors |

**Mood & Atmosphere (5)**

| #   | Scene Name       | Subject             | Style            | Environment           | Lighting       | Atmosphere | Colour          |
| --- | ---------------- | ------------------- | ---------------- | --------------------- | -------------- | ---------- | --------------- |
| 11  | Film Noir        | Victorian detective | cinematic        | victorian street      | split lighting | ominous    | black and white |
| 12  | Dreamscape       | ethereal fairy      | surrealist       | floating islands      | moonlight      | whimsical  | pastel colors   |
| 13  | Horror Scene     | demon creature      | digital painting | crystal cave          | blacklight UV  | ominous    | desaturated     |
| 14  | Golden Romance   | couple in love      | film photography | rooftop garden        | golden hour    | romantic   | warm palette    |
| 15  | Psychedelic Trip | abstract            | glitch art       | bioluminescent forest | holographic    | energetic  | neon colors     |

**Style-Forward (5)**

| #   | Scene Name              | Subject           | Style        | Environment           | Lighting          | Atmosphere | Materials         |
| --- | ----------------------- | ----------------- | ------------ | --------------------- | ----------------- | ---------- | ----------------- |
| 16  | Anime Action            | samurai warrior   | anime style  | japanese temple       | volumetric rays   | dramatic   | —                 |
| 17  | Oil Painting Still Life | flower bouquet    | oil painting | —                     | overcast soft     | serene     | velvet fabric     |
| 18  | Concept Art Creature    | mythical dragon   | concept art  | mountain peak         | dramatic lighting | ominous    | —                 |
| 19  | Pixel Art Retro         | robot android     | pixel art    | futuristic metropolis | LED strips        | energetic  | chrome reflection |
| 20  | Art Deco Poster         | ballerina dancing | art deco     | grand ballroom        | spotlight         | elegant    | gold ornate       |

**Trending / Seasonal (5 — rotate quarterly)**

| #   | Scene Name          | Notes                    |
| --- | ------------------- | ------------------------ |
| 21  | Solarpunk Utopia    | Trending aesthetic       |
| 22  | Dark Academia       | Trending aesthetic       |
| 23  | Cottagecore Morning | Seasonal — spring/summer |
| 24  | Cozy Winter Night   | Seasonal — autumn/winter |
| 25  | Synthwave Sunset    | Perennial favourite      |

### 6.4 The 175 Pro Scenes — World Categories

| World                        | Count   | Example Scenes                                                                                                                                                                                                               |
| ---------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Cinematic**                | 12      | Blade Runner Rain, Wes Anderson Palette, Kubrick Symmetry, Ghibli Dreamscape, Tarantino Standoff, Spielberg Wonder, Lynch Surreal, Kurosawa Duel, Nolan Inception, Tarkovsky Solitude, Villeneuve Vast, Scott Industrial     |
| **Fantasy & Mythology**      | 12      | Dragon's Lair, Elven Court, Necromancer Tower, Norse Ragnarok, Japanese Yokai, Greek Pantheon, Fairy Ring, Dwarven Forge, Merlin's Study, Kraken Depths, Phoenix Rebirth, Shadow Realm                                       |
| **Sci-Fi & Future**          | 12      | Space Station Life, Alien Marketplace, Mech Battle, Solarpunk City, Post-Apocalyptic, AI Consciousness, Colony Ship, Quantum Lab, Cybernetic Surgery, Terraform Dawn, Dyson Sphere, Digital Afterlife                        |
| **Historical Eras**          | 12      | Ancient Egypt, Roman Arena, Viking Raid, Renaissance Workshop, Victorian London, 1920s Jazz, Samurai Duel, Medieval Siege, Byzantine Court, Aztec Temple, Silk Road, Industrial Revolution                                   |
| **Urban & Street**           | 12      | Tokyo Neon, Havana Vintage, Mumbai Monsoon, NY Rooftop, Marrakech Souk, London Fog, Paris Rain, Shanghai Skyline, Rio Carnival, Istanbul Bazaar, Bangkok Night Market, Berlin Underground                                    |
| **Nature & Elements**        | 10      | Volcanic Eruption, Aurora Borealis, Bioluminescent Bay, Supercell Storm, Cherry Blossom, Monsoon Deluge, Coral Reef, Frozen Waterfall, Desert Mirage, Ancient Redwoods                                                       |
| **Architecture & Interiors** | 10      | Gothic Cathedral, Abandoned Factory, Luxury Penthouse, Infinite Library, Art Gallery, Japanese Ryokan, Brutalist Monument, Greenhouse Garden, Observatory Dome, Underground Cistern                                          |
| **Portraiture & Character**  | 12      | High Fashion Editorial, Battle-Worn Warrior, Elderly Wisdom, Child's Wonder, Couple at Sunset, Masked Ball, Steampunk Inventor, Witch's Apprentice, Street Musician, Royal Coronation, Astronaut Reflection, Monk Meditation |
| **Dark & Horror**            | 8       | Lovecraftian Deep, Haunted Manor, Gothic Vampire, Psychological Dread, Plague Doctor, Cursed Forest, Eldritch Ritual, Abandoned Asylum                                                                                       |
| **Whimsical & Surreal**      | 10      | Dalí Dreamscape, Tiny World Macro, Impossible Architecture, Cloud Kingdom, Time-Frozen, Living Painting, Toy Soldier War, Mushroom Forest, Upside Down City, Paper Cut World                                                 |
| **Cultural & Ceremonial**    | 10      | Tea Ceremony, Day of the Dead, Carnival Masquerade, Temple Prayer, Harvest Festival, Wedding Feast, Fire Dance, Lantern Release, Incense Meditation, Tribal Gathering                                                        |
| **Abstract & Experimental**  | 8       | Geometric Explosion, Colour Field, Fractal Nature, Data Sculpture, Sound Visualised, Ink in Water, Light Painting, Deconstructed Portrait                                                                                    |
| **Food & Still Life**        | 8       | Dutch Master Still Life, Street Food Steam, Cocktail Art, Ingredient Explosion, Market Produce, Baker's Dawn, Spice Palette, Wine Cellar                                                                                     |
| **Animals & Creatures**      | 8       | Wildlife Documentary, Mythical Beast, Mechanical Creature, Spirit Animal, Deep Sea Creature, Pack Hunt, Bird Migration, Insect Macro                                                                                         |
| **Commodity-Inspired**       | 10      | Gold Rush, Coffee Harvest, Oil Rig Storm, Silk Loom, Copper Mine, Wheat Field Harvest, Diamond Cutting, Spice Trade, Steel Foundry, Tea Plantation                                                                           |
| **Weather-Driven**           | 8       | Monsoon Mumbai, Saharan Heatwave, Arctic Whiteout, London Pea-Souper, Tropical Cyclone, Cherry Blossom Rain, Desert Lightning, Nordic Midnight Sun                                                                           |
| **Seasonal**                 | 8       | Spring Awakening, Summer Solstice, Autumn Harvest, Winter Solstice, Lunar New Year, Midsummer Night, Harvest Moon, First Snow                                                                                                |
| **Micro & Macro**            | 5       | Dewdrop Universe, Satellite View, Cellular Cosmos, Ant's Perspective, Galaxy Collision                                                                                                                                       |
| **TOTAL**                    | **175** |                                                                                                                                                                                                                              |

### 6.5 Scene Starters × The 4 Optimizer Tiers

Each scene stores ONE set of human-readable values. The assembler handles tier-specific formatting. But scenes include `tierGuidance` metadata:

| Tier               | What happens                                                     | Scene awareness                                                                                                  |
| ------------------ | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Tier 1 (CLIP)**  | Adds weights: `(cyberpunk hacker:1.3)`. Stacks quality boosters. | Scenes flag if they need fidelity terms. Show CLIP affinity score. Full 8-category pre-fill.                     |
| **Tier 2 (MJ)**    | Appends `--ar`, `--v`, `--s`, `--no` parameters.                 | Scenes include recommended MJ params. Some need `--niji` (anime) or `--weird` (surreal). Full pre-fill.          |
| **Tier 3 (NL)**    | Converts to flowing sentences.                                   | Scenes have a "narrative seed" — one-sentence NL description. Show NL affinity score. Full pre-fill.             |
| **Tier 4 (Plain)** | Simplifies to 5–15 words.                                        | Scenes have a "simplified core" — 3–5 essential terms. Reduced pre-fill (3–5 categories only). Warns if complex. |

### 6.6 Build Steps

| Step | Task                             | Details                                                                                                            |
| ---- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 2.1  | Design scene data JSON structure | Schema with id, name, world, description, prefills, tierGuidance, flavourPhrases, free/pro flag                    |
| 2.2  | Write 25 free scenes             | Complete data entries. Test each on 2+ platforms (1 per tier).                                                     |
| 2.3  | Write 175 Pro scenes             | Batch by world — complete one world at a time.                                                                     |
| 2.4  | Scene schema + validation test   | All prefill values exist in vocabulary. All platforms exist. No orphans.                                           |
| 2.5  | SceneSelector component          | Hierarchical accordion dropdown. Free scenes in 5 world headings. Pro scenes in 17 world headings, greyed with 🔒. |
| 2.6  | Pre-fill logic                   | Populate categories, trigger cascade, ✕ clear buttons, "Reset Scene" button, confirmation dialog.                  |
| 2.7  | Tier-aware pre-fill              | Adjust depth per tier. Show affinity indicator.                                                                    |
| 2.8  | Pro gate integration             | Wire to `usePromagenAuth()`. 25 accessible, 175 visible but locked.                                                |

**Effort:** 5–8 days

---

## 7. Feature C — Explore Drawer (Phase 3)

### 7.1 Concept

Below each category dropdown, a collapsible section reads "Explore 847 more phrases ▾". When expanded, shows full vocabulary as browseable, searchable chip clouds grouped by source (Core, Weather, Commodity, Shared).

### 7.2 Tier-Aware Badges

| Tier               | Badge                                                   |
| ------------------ | ------------------------------------------------------- |
| **Tier 1 (CLIP)**  | CLIP weight indicator: `[golden hour ★1.3]`             |
| **Tier 2 (MJ)**    | Parameter hints: `[cinematic → --ar 21:9]`              |
| **Tier 3 (NL)**    | NL form tooltip on hover: "bathed in golden hour light" |
| **Tier 4 (Plain)** | "⚡ simple" badge on safe terms. "⚠ complex" on others. |

### 7.3 Chip Count Estimates (After Merge)

| Category    | Core      | Weather    | Commodity  | Shared   | Total      |
| ----------- | --------- | ---------- | ---------- | -------- | ---------- |
| Subject     | 324       | —          | ~180       | —        | ~504       |
| Action      | 314       | —          | ~220       | —        | ~534       |
| Style       | 332       | —          | —          | —        | 332        |
| Environment | 313       | ~1,032     | ~350       | —        | ~1,695     |
| Composition | 311       | —          | —          | —        | 311        |
| Camera      | 339       | —          | —          | —        | 339        |
| Lighting    | 341       | 254        | ~130       | —        | ~725       |
| Atmosphere  | 346       | 280        | ~400       | ~200     | ~1,226     |
| Colour      | 333       | —          | ~150       | ~150     | ~633       |
| Materials   | 325       | —          | ~340       | —        | ~665       |
| Fidelity    | 317       | —          | —          | —        | 317        |
| Negative    | 960       | —          | —          | —        | 960        |
| **TOTAL**   | **3,955** | **~1,566** | **~1,770** | **~350** | **~7,641** |

### 7.4 Build Steps

| Step | Task                    | Details                                                                  |
| ---- | ----------------------- | ------------------------------------------------------------------------ |
| 3.1  | ExploreDrawer component | Collapsible section. Phrase count in header. Accordion by source.        |
| 3.2  | Chip cloud rendering    | Click-to-add. Pagination/virtual scroll for 500+ chips.                  |
| 3.3  | Search within Explore   | Text input. Real-time filter. Highlight substring.                       |
| 3.4  | Contextual ordering     | Chips ordered by cascade score.                                          |
| 3.5  | Tier-aware badges       | Per-tier badge rendering.                                                |
| 3.6  | Performance guard       | Lazy-load on drawer open. Virtualise if > 500 chips. Memo source groups. |
| 3.7  | Accessibility           | Keyboard nav. ARIA labels. Screen reader. Focus management.              |

**Effort:** 3–4 days

---

## 8. Polish & Integration (Phase 4)

| Step | Task                            | Details                                                                                                        |
| ---- | ------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 4.1  | Scene Starters × Explore Drawer | Scene's `flavourPhrases` appear as "Scene suggestions" group at top of Explore.                                |
| 4.2  | Analytics integration           | Track: scene_selected, scene_reset, explore_drawer_opened, explore_chip_clicked, cascade_reorder_triggered     |
| 4.3  | Fluid typography                | All new components use CSS clamp(). No fixed font sizes.                                                       |
| 4.4  | Documentation update            | Update prompt-builder-page.md, paid_tier.md, best-working-practice.md. Create scene-starters.md.               |
| 4.5  | End-to-end test                 | Build prompt via Scene Starter → modify → use Explore Drawer → copy. Repeat per tier. Verify optimizer output. |

**Effort:** 2–3 days

---

## 9. Collective Intelligence Engine (Phase 5)

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

### 9.4 Data Storage

- **Telemetry endpoint:** `POST /api/prompt-telemetry`
- **Database table:** prompt_id, selections (JSON), platform, tier, score, created_at
- **Per event:** ~500 bytes. 80,000 events = ~40MB raw.
- **Nightly cron crunches to:** ~100KB of weights/matrices.

### 9.5 Cold Start

Hand-curated clusters from Phase 1 carry system until ~1,000 prompts. After ~10,000, learned data starts dominating. After ~80,000, system knows per-tier optimal combinations.

### 9.6 Build Steps

| Step | Task                                                                        | Effort   |
| ---- | --------------------------------------------------------------------------- | -------- |
| 5.1  | Telemetry endpoint `POST /api/prompt-telemetry`                             | 0.5 days |
| 5.2  | Database schema (prompt_events table)                                       | 0.5 days |
| 5.3  | Nightly aggregation cron (co-occurrence + sequences + scene candidates)     | 2 days   |
| 5.4  | Co-occurrence weights JSON output                                           | 0.5 days |
| 5.5  | Vocabulary-loader integration (blend learned + curated, configurable ratio) | 1 day    |
| 5.6  | Auto-scene candidate pipeline + review queue                                | 1 day    |
| 5.7  | Decay + diversity tuning                                                    | 0.5 days |

**Total effort:** 4–6 days

---

## 10. Self-Improving Scorer (Phase 6)

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

### 10.3 Five Self-Improvement Mechanisms

**Mechanism 1 — Weight Recalibration ("What Actually Matters?")**

Measure correlation between each scoring factor and outcomes. Recalibrate monthly via Pearson correlation → normalise to weights summing to 1.0. No ML required, just arithmetic.

```
Example: Day 1 → Day 30 weight shift:
  categoryCount:  0.25 → 0.08  (less important than assumed)
  coherence:      0.05 → 0.35  (massively more important)
  promptLength:   0.20 → 0.18  (stable)
  negativePresent: 0.15 → 0.05 (barely matters on Tier 3/4)
```

**Mechanism 2 — Threshold Discovery ("What Does 90% Actually Mean?")**

Plot score vs copy rate. Find the "knee" where quality plateaus. Auto-adjust learning threshold to sit at quality plateau point.

**Mechanism 3 — Per-Tier Scoring Models ("Midjourney Isn't Canva")**

Four separate scoring models:

| Tier           | High-Weight Factors                                                          | Low-Weight Factors                              |
| -------------- | ---------------------------------------------------------------------------- | ----------------------------------------------- |
| Tier 1 (CLIP)  | keywordDensity, fidelityTerms, negativePresent                               | coherence (medium)                              |
| Tier 2 (MJ)    | coherence, tierFormatting                                                    | fidelityTerms (MJ ignores "8k masterpiece")     |
| Tier 3 (NL)    | coherence (highest)                                                          | categoryCount (3–4 well-described > 8 keywords) |
| Tier 4 (Plain) | promptLength (INVERTED — shorter better), categoryCount (INVERTED — 2–3 max) | fidelityTerms (ZERO)                            |

**Mechanism 4 — Category Value Discovery ("Which Categories Actually Matter?")**

Learn which categories are high-value vs low-value per tier. A prompt with 4 high-value categories scores higher than 6 low-value ones. Feeds back into Cascading Intelligence.

**Mechanism 5 — Term-Level Quality Scores ("Which Words Actually Work?")**

Each term gets per-tier quality score. High-quality terms boosted in dropdown ordering. Low-quality terms demoted (not removed).

### 10.4 The Meta-Loop — Scoring Scores Itself

Step 8 in nightly cron: measure score-outcome correlation. If correlation improves month-over-month, system genuinely learning. If plateaus, weights stable. If drops, flag for manual review.

### 10.5 Build Steps

| Step | Task                                                            | Effort   |
| ---- | --------------------------------------------------------------- | -------- |
| 6.1  | Extend telemetry (copy, save, return-time, reuse signals)       | 1 day    |
| 6.2  | Store per-prompt score factor breakdown alongside total         | 0.5 days |
| 6.3  | Nightly cron: weight recalibration (factor-outcome correlation) | 1 day    |
| 6.4  | Nightly cron: per-tier scoring model generation                 | 1 day    |
| 6.5  | Nightly cron: category value discovery                          | 0.5 days |
| 6.6  | Nightly cron: term quality scores per tier                      | 1 day    |
| 6.7  | Threshold auto-adjustment (knee detection)                      | 0.5 days |
| 6.8  | Meta-check: score-outcome correlation trend monitoring          | 0.5 days |

**Total effort:** ~6 days (admin dashboard moved to Phase 7.10)

---

## 11. Advanced Learning Systems (Phase 7)

Ten additional learning dimensions that take the system from "good" to "nobody can compete with this."

### 7.1 — Negative Pattern Learning ("What Kills a Prompt?")

Learn what DOESN'T work from abandoned/low-scoring prompts.

**Anti-pattern detection:** Count term pairs that appear frequently in low-scoring prompts but rarely in high-scoring ones. Example: "oil painting" + "8k resolution" + "ray tracing" — contradictory aesthetic (traditional medium vs photorealistic tech). When user selects "oil painting", actively DEMOTE "8k resolution" and "ray tracing" with a subtle conflict indicator.

**Term collision maps:** Pairs that occupy the same "space" and compete. "golden hour" + "moonlight" → 23% copy rate (terrible). Each alone → 80%+. Both are lighting sources — using both confuses the model.

**Output files:** `anti-patterns.json`, `collision-matrix.json`

**Effort:** 1.5 days

### 7.2 — Iteration Tracking ("How Do People Fix Prompts?")

Track sequential prompt attempts within a session (user builds, copies, returns, changes, copies again).

**What this teaches:**

- Which category users add FIRST when fixing a prompt → highest-value category
- Which changes produce biggest score jumps → recalibrates category value weights
- Which terms get REPLACED most often → weak terms, demote in dropdown
- Final attempt in sequence (user doesn't return) → highest-confidence quality signal, weight 3× higher
- Average iterations needed → if decreasing over time, system is improving

**Data structure:** `iteration_sessions` table linking sequential prompt_events by session_id + attempt_number.

**Effort:** 1.5 days

### 7.3 — Semantic Redundancy Detection ("Which Words Say the Same Thing?")

Detect terms that users pick interchangeably (never both) with similar outcomes.

**Example:** "cinematic lighting" (78%), "dramatic lighting" (15%), "film lighting" (7%) — all produce similar copy rates. Functionally identical for AI generation.

**What this enables:**

- Redundancy warnings: "These terms overlap. One is usually enough."
- Smart substitution suggestions
- Token efficiency on Tier 4
- Dropdown deduplication in Explore Drawer ("similar to your selection" label)

**Output file:** `redundancy-groups.json`

**Effort:** 1 day

### 7.4 — Higher-Order Combinations ("The Magic Trios")

Co-occurrence matrices capture PAIRS. Some magic only happens with 3+ terms together.

**Example:** "oil painting" + "golden hour" + "impasto texture" → 93% (excellent). No pair alone predicts this.

**Implementation:** Frequent itemset mining (Apriori/FP-Growth algorithm) on telemetry data. Store top 500–1,000 magic combos (trios and quads). When 2 terms from a magic combo are selected, the third gets a massive boost — "you're two-thirds of the way to something that works really well."

**Output file:** `magic-combos.json`

**Effort:** 1.5 days

### 7.5 — Per-Platform Learning (Not Just Per-Tier)

Within Tier 1, Leonardo might handle "neon glow" brilliantly while NightCafe struggles. With 500+ prompts per platform, learn platform-specific term quality scores and co-occurrence patterns.

**Cold start:** Use tier-level weights as fallback, blend in platform-specific data as it accumulates:

`finalWeight = (platformData × platformConfidence) + (tierData × (1 - platformConfidence))`

where `platformConfidence` scales 0→1 as sample count grows.

**Output:** Per-platform entries in `term-quality-scores.json`

**Effort:** 1 day

### 7.6 — A/B Testing the Scoring Model

Split-test scoring model changes before committing them.

**Mechanism:** Serve 50% of users current model (control), 50% new model (variant). Measure which group produces higher copy/save/reuse rates over 7 days. If variant wins with p < 0.05, auto-promote. If loses, auto-rollback.

**Automated pipeline:** Nightly cron proposes weight changes → creates A/B test → test runs 7 days → auto-promotes or rollbacks → weekly email summary: "3 tests ran, 2 promoted, 1 rolled back. Net improvement: +2.3% copy rate."

**Data structure:** `ab_test_assignments` table (user_hash → variant_id per test).

**Effort:** 2 days

### 7.7 — User Skill Segmentation ("Beginners Need Different Help Than Experts")

Automatic skill detection from behaviour:

| Signal              | Beginner | Intermediate | Expert       |
| ------------------- | -------- | ------------ | ------------ |
| Sessions            | First 5  | 6–20         | 20+          |
| Categories filled   | ≤ 3      | 4–6          | 6+           |
| Uses free text      | Never    | Occasionally | Frequently   |
| Uses Explore Drawer | Never    | Sometimes    | Default open |
| Session length      | < 2 min  | 2–5 min      | 5+ min       |
| Saved prompts       | None     | Some         | Library user |

**Adaptive behaviour:**

- **Beginner:** Scene Starters prominent. Cascade aggressive (fewer, obviously "right" options). Scoring lenient. Tooltips visible.
- **Expert:** Explore Drawer open by default. Cascade subtle (reorder, don't hide). Scoring precise. Term quality badges visible.
- **Scoring adapts:** Beginner scoring rewards using Scene Starters (+15 points). Expert scoring rewards sophistication.

**Output file:** `skill-thresholds.json`

**Effort:** 1 day

### 7.8 — Temporal Intelligence ("When Matters")

Track seasonal trends, weekly patterns, and platform update impacts.

**Patterns detected:**

- Seasonal: "snow" terms → 340% more popular Nov–Feb. "cherry blossom" → 800% spike March–April.
- Weekly: Weekend prompts 40% more experimental than weekday.
- Platform updates: MJ v7 released → historical weights invalid → correlation drops → system enters "learning period" with heavy recent-data weighting → recalibrated within 2–3 weeks.

**What this enables:**

- Data-driven seasonal Scene Starter rotation
- "Trending Now" section in Explore Drawer
- Automatic platform update detection and recalibration

**Output files:** `temporal-boosts.json`, `trending-terms.json`

**Effort:** 1 day

### 7.9 — Prompt Compression Intelligence ("What Can Be Removed?")

Learn what can be REMOVED without affecting quality.

**Example:** "highly detailed, intricate, 8k resolution, best quality, masterpiece" → 78% copy rate. Just "highly detailed" → 77% copy rate. The extra 4 terms add 1% at the cost of 5 tokens.

**Per-tier compression profiles:**

- Tier 1: Gentle compression. Keep 15+ terms.
- Tier 2: Sweet spot 8–12 terms + params. Remove quality junk MJ ignores.
- Tier 3: Sweet spot 2–3 natural sentences. Remove keyword-style terms.
- Tier 4: Maximum 5–8 words. Brutal compression.

**Output file:** `compression-profiles.json`

**Effort:** 1 day

### 7.10 — User Feedback Invitation ("Did This Actually Work?")

The biggest gap: we never ask. We infer quality from proxies. A direct signal is 10× more valuable.

**Simple post-generation feedback (60s after copy, or next visit):**

```
┌──────────────────────────────────────────────┐
│  How did your last prompt turn out?          │
│                                              │
│  👍 Great    👌 Okay    👎 Not good          │
│                                              │
│  [Skip]                                      │
└──────────────────────────────────────────────┘
```

Three buttons. One click. Even 20% response rate = thousands of ground-truth data points per month.

**What this enables:**

- Ground truth calibration (score vs actual image quality)
- Per-platform quality mapping
- Term effectiveness with direct evidence
- The scoring system calibrates against ACTUAL outcomes, not just proxy signals

**Data structure:** `feedback_events` table (prompt_event_id, rating, timestamp)

**Effort:** 1 day

---

## 12. Admin Command Centre (Phase 7.10)

**Route:** `/admin/scoring-health` — separate standalone page within the Promagen app.

### 12.1 Dashboard Sections

**Section 1 — Scorer Health Overview**

| Metric                              | Display                                         |
| ----------------------------------- | ----------------------------------------------- |
| Score-outcome correlation (current) | Large number + trend arrow + sparkline (30-day) |
| Correlation change vs last month    | +/- percentage with colour (green = improving)  |
| Total prompts logged                | Counter                                         |
| Active A/B tests                    | Count + status badges                           |
| Last cron run                       | Timestamp + duration + success/fail             |

**Section 2 — Weight Drift Visualisation**

Line chart showing how each scoring factor's weight has changed over time:

```
Weight Evolution (90 days)
  coherence:      ████████████████████████████████▓▓▓▓  0.05 → 0.35
  categoryCount:  ████████████▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  0.25 → 0.08
  tierFormat:     ████████████████████████████████████  0.15 → 0.17
  promptLength:   ████████████████████████████████████  0.20 → 0.18
  ...
```

**Section 3 — Per-Tier Scoring Models**

Table showing current weights for each tier side-by-side. Heatmap colouring (green = high weight, grey = low).

**Section 4 — Term Quality Leaderboard**

Top 20 and bottom 20 terms per category per tier. Sortable by quality score, usage count, trend direction.

**Section 5 — Anti-Pattern Alerts**

Detected collision pairs and anti-patterns with sample counts and severity scores. Ability to manually override (force-keep or force-suppress a pattern).

**Section 6 — A/B Test Results**

Current and historical A/B tests. Control vs variant metrics. Statistical significance indicator. Promote/rollback buttons.

**Section 7 — Auto-Scene Candidates**

Proposed scenes from collective intelligence. Preview with prefills. Approve/reject buttons. Confidence score and sample count.

**Section 8 — Temporal Trends**

Trending terms (last 7 days vs previous 7 days). Seasonal patterns. Platform update detection alerts.

**Section 9 — User Skill Distribution**

Pie chart: beginner / intermediate / expert. Average journey length (sessions to graduate). Conversion funnel: beginner → Scene Starter user → Pro subscriber.

**Section 10 — Feedback Summary**

👍/👌/👎 distribution. Per-platform satisfaction rates. Terms with highest 👎 rate (candidates for demotion). Correlation between assigned score and user rating.

Design Constraint for Phase 7.10 (Feedback Widget)
Hard requirement: The three-point feedback scale (great / okay / poor) must include explanatory text or tooltips so users understand the middle option means "mediocre, not impressive" — not a second positive. If users misread 👌 as approval rather than "meh," the outcome data feeding Phase 6's weight recalibration is corrupted and the scorer learns from noise.
Options to evaluate when building Phase 7.10:

Tooltip on each button explaining what it means
Short label text beneath each icon (e.g. "Nailed it" / "Just okay" / "Missed")
Use words as the primary UI with 👍👌👎 icons secondary

The data schema ('great' | 'okay' | 'poor') is unaffected — this is purely a presentation concern, but it directly impacts data quality for the entire self-improving scorer pipeline.
### 12.2 Access Control

Admin-only route protected by Clerk role check. Not visible to regular users. No link in main navigation — accessed directly via URL.

### 12.3 Build Steps

| Step    | Task                                     | Effort   |
| ------- | ---------------------------------------- | -------- |
| 7.10.1  | Page scaffolding + route + auth guard    | 0.5 days |
| 7.10.2  | Scorer health overview (metrics cards)   | 0.5 days |
| 7.10.3  | Weight drift chart (Recharts line chart) | 0.5 days |
| 7.10.4  | Per-tier model comparison table          | 0.5 days |
| 7.10.5  | Term quality leaderboard                 | 0.5 days |
| 7.10.6  | Anti-pattern alerts panel                | 0.5 days |
| 7.10.7  | A/B test results + controls              | 0.5 days |
| 7.10.8  | Auto-scene candidate review queue        | 0.5 days |
| 7.10.9  | Temporal trends + feedback summary       | 0.5 days |
| 7.10.10 | User skill distribution                  | 0.5 days |

**Total effort for admin dashboard:** ~5 days

---

## 13. The 4 Optimizer Tiers — Cross-Feature Matrix

| Feature                    | Tier 1 (CLIP, 13 platforms)                                            | Tier 2 (MJ, 2 platforms)                                | Tier 3 (NL, 10 platforms)                         | Tier 4 (Plain, 17 platforms)                                     |
| -------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------- |
| **Scene Starters**         | Full 8-category pre-fill. Auto-adds fidelity. CLIP affinity score.     | Full pre-fill. Suggests MJ params. MJ affinity score.   | Full pre-fill. Narrative seed. NL affinity score. | Reduced 3–5 categories. Simplified core. Complexity warning.     |
| **Cascading Intelligence** | Full cascade. Extra tier1Boost weight. Quality terms always suggested. | Full cascade. MJ affinities (--niji, --weird).          | Full cascade. Favours tier3Phrase variants.       | Dampened cascade (0.5×). Fewer options. "Keep simple" bias.      |
| **Explore Drawer**         | CLIP weight badges (★1.3). Full depth.                                 | Parameter hints (→ --ar 21:9). Full depth.              | NL tooltips on hover. Full depth.                 | "⚡ simple" badges. Complex term warnings. Collapsed by default. |
| **Vocabulary Merge**       | All merged. CLIP-friendly boosted.                                     | All merged. MJ-compatible highlighted.                  | All merged. NL-friendly prioritised.              | Reduced set. Only tier4Simple terms.                             |
| **Co-occurrence Learning** | Per Tier 1 model. Keyword coherence patterns.                          | Per Tier 2 model. MJ-specific combos.                   | Per Tier 3 model. Narrative flow patterns.        | Per Tier 4 model. Simplicity patterns.                           |
| **Scoring Model**          | keywordDensity HIGH, fidelityTerms HIGH, negativePresent HIGH.         | coherence HIGH, tierFormatting HIGH, fidelityTerms LOW. | coherence HIGHEST, categoryCount LOW.             | promptLength HIGH INVERTED, fidelityTerms ZERO.                  |
| **Term Quality**           | Per Tier 1 scores.                                                     | Per Tier 2 scores.                                      | Per Tier 3 scores.                                | Per Tier 4 scores.                                               |
| **Compression**            | Gentle. 15+ terms OK.                                                  | Medium. 8–12 + params.                                  | 2–3 sentences.                                    | Brutal. 5–8 words max.                                           |

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
  },
  "tags": ["rain", "night", "cyberpunk", "cinematic", "urban", "moody"]
}
```

### 14.2 Semantic Cluster Entry

```json
{
  "id": "cyberpunk",
  "name": "Cyberpunk",
  "weight": 8,
  "members": {
    "subject": ["cyberpunk hacker", "android humanoid", "bounty hunter", "mech pilot"],
    "action": ["running dynamically", "fighting fiercely", "casting spell"],
    "style": ["digital painting", "concept art", "cyberpunk aesthetic", "synthwave"],
    "environment": ["cyberpunk city", "neon alleyway", "futuristic metropolis"],
    "lighting": ["neon glow", "holographic", "LED strips", "blacklight UV"],
    "atmosphere": ["ominous", "dramatic", "energetic", "mysterious"],
    "colour": ["neon colors", "teal and orange", "high contrast"],
    "materials": ["chrome reflection", "iridescent metal", "brushed steel"],
    "camera": ["anamorphic lens", "dutch angle"],
    "fidelity": ["8k resolution", "ray tracing", "unreal engine"]
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

| File                        | Phase | Size Est. | Contents                                         |
| --------------------------- | ----- | --------- | ------------------------------------------------ |
| `scoring-weights.json`      | 6     | < 1KB     | Per-tier factor weights                          |
| `co-occurrence-matrix.json` | 5     | ~50–100KB | Term pair co-occurrence counts by tier           |
| `anti-patterns.json`        | 7.1   | ~10KB     | Term pairs that sabotage each other              |
| `collision-matrix.json`     | 7.1   | ~5KB      | Terms that compete for same "space"              |
| `magic-combos.json`         | 7.4   | ~20KB     | Top 500–1,000 trios/quads                        |
| `term-quality-scores.json`  | 6     | ~30KB     | Per-term per-tier quality scores                 |
| `redundancy-groups.json`    | 7.3   | ~10KB     | Synonym groups with interchangeability data      |
| `compression-profiles.json` | 7.9   | ~5KB      | Optimal prompt length + removable terms per tier |
| `scene-candidates.json`     | 5     | ~15KB     | Auto-proposed scenes for review                  |
| `trending-terms.json`       | 7.8   | ~5KB      | Terms trending up/down in last 7 days            |
| `temporal-boosts.json`      | 7.8   | ~5KB      | Seasonal and time-of-week modifiers              |
| `skill-thresholds.json`     | 7.7   | ~2KB      | Beginner/intermediate/expert boundaries          |
| `scorer-health-report.json` | 6     | ~3KB      | Correlation trends, drift alerts                 |

**Total nightly output:** ~160–200KB. Trivial.

---

## 16. File Impact Map

### New Files

| File                                            | Phase | Purpose                            |
| ----------------------------------------------- | ----- | ---------------------------------- |
| `data/vocabulary/merged/*.json` (7 files)       | 0     | Curated vocab mapped to categories |
| `data/vocabulary/merged/merge-manifest.json`    | 0     | Source tracking                    |
| `data/intelligence/semantic-clusters.json`      | 1     | 40–60 cluster definitions          |
| `data/intelligence/direct-affinities.json`      | 1     | 200–400 term relationships         |
| `data/scenes/scene-starters.json`               | 2     | 200 scene definitions              |
| `data/scenes/scene-starters.schema.json`        | 2     | Validation schema                  |
| `components/providers/scene-selector.tsx`       | 2     | Hierarchical accordion dropdown    |
| `components/providers/explore-drawer.tsx`       | 3     | Expandable vocabulary panel        |
| `data/learned/*.json` (13 files)                | 5–7   | Cron-generated weight files        |
| `api/prompt-telemetry/route.ts`                 | 5     | Telemetry endpoint                 |
| `lib/learning/aggregation-cron.ts`              | 5–7   | Nightly cron logic                 |
| `app/admin/scoring-health/page.tsx`             | 7.10  | Admin Command Centre               |
| `components/admin/*.tsx` (10 panels)            | 7.10  | Dashboard section components       |
| `components/prompt-builder/feedback-widget.tsx` | 7.10  | 👍👌👎 post-copy widget            |

### Modified Files

| File                                      | Phase   | Changes                                                               |
| ----------------------------------------- | ------- | --------------------------------------------------------------------- |
| `lib/vocabulary/vocabulary-loader.ts`     | 0+1+5   | Load merged vocab. Cluster + affinity scoring. Blend learned weights. |
| `lib/prompt-builder.ts`                   | 1       | Full cross-category context passing                                   |
| `components/providers/prompt-builder.tsx` | 1+2+3+5 | SceneSelector. ExploreDrawer. Telemetry logging. Feedback widget.     |
| `types/prompt-builder.ts`                 | 1       | Extended VocabularyContext type                                       |
| `lib/prompt-optimizer.ts`                 | 6       | Read learned scoring weights instead of static ones                   |

### Untouched Files

| File                                    | Reason                                              |
| --------------------------------------- | --------------------------------------------------- |
| `data/vocabulary/prompt-builder/*.json` | Core vocab stays pure                               |
| `data/vocabulary/weather/*.json`        | Still consumed by weather-prompt-generator          |
| `data/vocabulary/commodities/*.json`    | Still consumed by commodity-prompt-generator        |
| `data/vocabulary/shared/*.json`         | Still consumed by assembler                         |
| `data/platform-tiers.ts`                | Tier definitions unchanged                          |
| `lib/prompt-builder/generators.ts`      | Assembler formats whatever user selects — unchanged |

---

## 17. Build Phase Summary

| Phase       | Feature                                                                  | Effort         | Dependencies |
| ----------- | ------------------------------------------------------------------------ | -------------- | ------------ |
| **Phase 0** | Vocabulary Merge (curate + map phrases)                                  | 2–3 days       | None         |
| **Phase 1** | Cascading Intelligence (clusters + affinities + scoring)                 | 3–5 days       | Phase 0      |
| **Phase 2** | Scene Starters (200 scenes + hierarchical dropdown)                      | 5–8 days       | Phase 1      |
| **Phase 3** | Explore Drawer (expandable vocab panel)                                  | 3–4 days       | Phase 0, 1   |
| **Phase 4** | Polish & Integration                                                     | 2–3 days       | Phases 0–3   |
| **Phase 5** | Collective Intelligence Engine (telemetry + co-occurrence + auto-scenes) | 4–6 days       | Phase 4      |
| **Phase 6** | Self-Improving Scorer (weight recalibration + per-tier models)           | ~6 days        | Phase 5      |
| **Phase 7** | Advanced Learning Systems:                                               |                | Phase 6      |
|             | 7.1 Negative Pattern Learning (anti-patterns + collisions)               | 1.5 days       |              |
|             | 7.2 Iteration Tracking (session sequences)                               | 1.5 days       |              |
|             | 7.3 Semantic Redundancy Detection                                        | 1 day          |              |
|             | 7.4 Higher-Order Combinations (magic trios)                              | 1.5 days       |              |
|             | 7.5 Per-Platform Learning (42 individual models)                         | 1 day          |              |
|             | 7.6 A/B Testing Pipeline                                                 | 2 days         |              |
|             | 7.7 User Skill Segmentation                                              | 1 day          |              |
|             | 7.8 Temporal Intelligence (seasonal + platform updates)                  | 1 day          |              |
|             | 7.9 Prompt Compression Intelligence                                      | 1 day          |              |
|             | 7.10 User Feedback Invitation (👍👌👎)                                   | 1 day          |              |
|             | 7.11 Admin Command Centre (`/admin/scoring-health`)                      | 5 days         |              |
| **TOTAL**   |                                                                          | **42–57 days** |              |

### Parallel Work Opportunities

- Phase 7.1–7.10 are independent of each other — can be built in any order
- Phase 7.11 (Admin Command Centre) can start once Phase 6 is deployed (it visualises Phase 5–7 data)
- Scene data authoring (Phase 2.2, 2.3) can run in parallel with Phase 1 engineering
- Phase 5 telemetry collection starts immediately after Phase 4 deployment; Phases 6–7 engineering can begin while data accumulates

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

_End of document. Version 2.0.0. 2026-02-24._
