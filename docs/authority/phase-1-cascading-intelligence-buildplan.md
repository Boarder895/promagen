# Phase 1 — Cascading Intelligence Build Plan

**Version:** 1.0.0  
**Created:** 2026-02-24  
**Depends on:** Phase 0 (Vocabulary Merge) ✅ Complete  
**Authority:** prompt-builder-evolution-plan-v2.md §5  
**Estimated effort:** 3–5 days (8 parts)

---

## Critical Discovery: The Engine Is Built But Has No Fuel

Audit of the current codebase revealed something important:

| Component                               | Status                            | Detail                                                           |
| --------------------------------------- | --------------------------------- | ---------------------------------------------------------------- |
| `scoreOption()` in suggestion-engine.ts | ✅ Built                          | Scores by family, mood, era, conflict, complement, market boost  |
| `buildContext()`                        | ✅ Built                          | Extracts activeFamily, dominantMood, era from selections         |
| `reorderByRelevance()`                  | ✅ Built                          | Wired into prompt-builder.tsx via `reorderedOptionsMap`          |
| `SCORE_WEIGHTS`                         | ✅ Built                          | 10 weight constants (base=40, familyMatch=30, etc.)              |
| `semantic-tags.json` → `options` dict   | ❌ **EMPTY**                      | 0 entries. `getSemanticTag()` returns `undefined` for every term |
| `semantic-tags.json` → `termMappings`   | ⚠️ 20 entries                     | Exist but **not used** by `getSemanticTag()` — dead data         |
| `families.json` → members               | ✅ 363 members across 41 families | But the lookup path goes through `getSemanticTag()` → dead       |
| `conflicts.json`                        | ✅ 80 groups                      | Works independently of semantic tags                             |
| Semantic clusters                       | ❌ **Does not exist**             | No file, no code                                                 |
| Direct affinities                       | ❌ **Does not exist**             | No file, no code                                                 |
| Tier-aware scoring                      | ❌ **Does not exist**             | All tiers score identically                                      |

**Translation:** The scoring engine is structurally complete but data-empty. Every option scores `40` (base) because `getSemanticTag()` always returns `undefined`. The family matching, mood matching, era matching, complement detection — all dead code paths. The `reorderedOptionsMap` in prompt-builder.tsx computes reordered lists that are identical to the original order.

**Phase 1 Strategy:** Fill the engine with fuel (semantic tags + clusters + affinities), then upgrade it (cluster scoring + affinity scoring + tier awareness).

---

## Architecture Overview

```
BEFORE Phase 1:
  User selects "cyberpunk hacker" in Subject
    → getSemanticTag("cyberpunk hacker") → undefined
    → activeFamily: null, dominantMood: null, era: null
    → Every option in Lighting scores 40 (base)
    → Dropdown order: alphabetical (no reordering)

AFTER Phase 1:
  User selects "cyberpunk hacker" in Subject
    → getSemanticTag("cyberpunk hacker") → { families: ["cyberpunk-aesthetic", "sci-fi"], mood: "intense", era: "near-future" }
    → activeFamily: "cyberpunk-aesthetic"
    → Cluster lookup: "cyberpunk" cluster → lighting: ["neon glow", "holographic", "LED strips", "blacklight UV"]
    → Affinity lookup: "cyberpunk hacker" → boosts: ["neon glow", "chrome reflection"], penalises: ["watercolor wash"]
    → "neon glow" scores: 40(base) + 30(family) + 15(mood) + 12(era) + 25(cluster) + 20(affinity) = 142 → clamped 100
    → "watercolor wash" scores: 40(base) - 15(affinity penalty) = 25
    → Dropdown reorders: neon glow at top, watercolor wash near bottom
```

### Three Scoring Layers (Additive)

```
Layer 1 — Semantic Tags (EXISTING code, needs DATA)
  ├── Family matching     → +30 primary, +18 related
  ├── Mood matching       → +15
  ├── Era matching        → +12
  ├── Complement bonus    → +22
  ├── Suggestion bonus    → +28
  └── Conflict penalty    → -35

Layer 2 — Semantic Clusters (NEW data + NEW code)
  └── Cluster membership  → +25 per shared cluster member (capped)

Layer 3 — Direct Affinities (NEW data + NEW code)
  ├── Boost pairs         → +20 per boost
  └── Penalise pairs      → -15 per penalise
```

---

## Data Files — What Gets Created

### File 1: `semantic-tags.json` → POPULATE the `options` dict

**Path:** `src/data/vocabulary/intelligence/semantic-tags.json`  
**Status:** File exists, `options` dict is empty, `termMappings` has 20 entries  
**Action:** Populate `options` with 400–600 high-value terms from core vocabulary

Each entry maps a prompt-builder option to its semantic properties:

```jsonc
{
  "options": {
    "cyberpunk hacker": {
      "category": "subject",
      "families": ["cyberpunk-aesthetic", "sci-fi"],
      "mood": "intense",
      "era": "near-future",
      "complements": ["neon glow", "chrome reflection", "holographic"],
      "suggests": {
        "lighting": ["neon glow", "LED strips"],
        "environment": ["cyberpunk city", "neon alleyway"],
        "atmosphere": ["ominous", "energetic"],
      },
    },
    "golden hour": {
      "category": "lighting",
      "families": ["photography-fine-art", "romantic"],
      "mood": "calm",
      "era": "timeless",
      "complements": ["warm palette", "film photography", "serene"],
      "conflicts": ["neon glow", "blacklight UV", "moonlight"],
      "suggests": {
        "colour": ["warm palette", "earth tones"],
        "atmosphere": ["serene", "romantic"],
      },
    },
    // ... 400–600 entries
  },
}
```

**Coverage target:** Tag every option that appears in the 25 free scenes (§6.3 of evolution plan) + the top ~50 most-used options per category + all 363 family members. Estimated 400–600 entries covers the "head" of the vocabulary — the terms users actually pick most often.

**Why not tag all 9,058?** Diminishing returns. Tagging "Saripolou Square, Limassol" adds zero cascade value. The 400–600 head terms cover 80%+ of real usage. Phase 5 (Collective Intelligence) will learn the long tail.

---

### File 2: `semantic-clusters.json` (NEW)

**Path:** `src/data/vocabulary/intelligence/semantic-clusters.json`  
**What it does:** Groups terms across multiple categories that naturally go together. Unlike families (which group terms within one aesthetic), clusters map coherent cross-category sets.

```jsonc
{
  "$schema": "./schemas/intelligence.schema.json",
  "version": "1.0.0",
  "meta": {
    "domain": "intelligence",
    "category": "semantic-clusters",
    "label": "Semantic Clusters",
    "description": "Cross-category term groupings for cascade scoring",
  },
  "clusters": {
    "cyberpunk": {
      "label": "Cyberpunk",
      "description": "Neon-lit dystopian technology",
      "terms": {
        "subject": ["cyberpunk hacker", "android humanoid", "bounty hunter", "mech pilot"],
        "action": ["running dynamically", "fighting fiercely", "casting spell"],
        "style": ["digital painting", "concept art", "cyberpunk aesthetic", "synthwave"],
        "environment": ["cyberpunk city", "neon alleyway", "futuristic metropolis"],
        "lighting": ["neon glow", "holographic", "LED strips", "blacklight UV"],
        "atmosphere": ["ominous", "dramatic", "energetic", "mysterious"],
        "colour": ["neon colors", "teal and orange", "high contrast"],
        "materials": ["chrome reflection", "iridescent metal", "brushed steel"],
        "camera": ["anamorphic lens", "dutch angle"],
        "composition": ["rule of thirds", "leading lines", "diagonal composition"],
        "fidelity": ["8k resolution", "ray tracing", "unreal engine"],
      },
    },
    "golden-hour-portrait": {
      "label": "Golden Hour Portrait",
      "description": "Warm natural light portrait photography",
      "terms": {
        "subject": ["portrait of a woman", "portrait of a man", "fashion model"],
        "style": ["film photography", "cinematic", "natural photography"],
        "lighting": ["golden hour", "dappled sunlight", "warm lighting"],
        "atmosphere": ["serene", "romantic", "ethereal"],
        "colour": ["warm palette", "earth tones"],
        "camera": ["85mm portrait lens", "50mm lens", "shallow depth of field"],
        "materials": ["linen fabric", "natural wood"],
      },
    },
    // ... 40–60 clusters total
  },
}
```

**Target: 50 clusters** across these thematic groupings:

| Group            | Count  | Examples                                                                                                                            |
| ---------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Aesthetic/Style  | 12     | cyberpunk, steampunk, vaporwave, cottagecore, dark-academia, art-deco, gothic, noir, solarpunk, brutalist, art-nouveau, psychedelic |
| Genre/Narrative  | 8      | fantasy-epic, horror, sci-fi-space, underwater, western, noir-detective, fairy-tale, post-apocalyptic                               |
| Photography      | 6      | golden-hour-portrait, studio-portrait, street-photography, macro-nature, aerial-landscape, long-exposure                            |
| Mood/Atmosphere  | 6      | serene-nature, dark-moody, vibrant-energetic, misty-mysterious, warm-nostalgic, cold-desolate                                       |
| Historical       | 6      | ancient-civilization, medieval-fantasy, renaissance-classical, victorian-era, 1920s-art-deco, 1980s-retro                           |
| Medium/Technique | 6      | oil-painting, watercolor, digital-3d, pixel-art, anime-style, sketch-ink                                                            |
| Subject-Driven   | 6      | food-still-life, architecture-interior, wildlife-animal, mech-robot, mythical-creature, urban-street                                |
| **TOTAL**        | **50** |                                                                                                                                     |

---

### File 3: `direct-affinities.json` (NEW)

**Path:** `src/data/vocabulary/intelligence/direct-affinities.json`  
**What it does:** Fine-grained term-to-term boost/penalise relationships that clusters are too broad to capture.

```jsonc
{
  "$schema": "./schemas/intelligence.schema.json",
  "version": "1.0.0",
  "meta": {
    "domain": "intelligence",
    "category": "direct-affinities",
    "label": "Direct Affinities",
    "description": "Fine-grained term-to-term boost and penalise pairs",
  },
  "affinities": [
    {
      "term": "golden hour",
      "boosts": [
        "warm palette",
        "serene",
        "earth tones",
        "film photography",
        "shallow depth of field",
        "natural wood",
      ],
      "penalises": ["neon glow", "blacklight UV", "neon colors", "cyberpunk city"],
    },
    {
      "term": "85mm portrait lens",
      "boosts": [
        "shallow depth of field",
        "bokeh background",
        "portrait of a woman",
        "portrait of a man",
      ],
      "penalises": ["wide angle distortion", "fisheye"],
    },
    {
      "term": "anime style",
      "boosts": ["vibrant colors", "dynamic pose", "cel shaded", "manga style"],
      "penalises": ["photorealistic", "hyperrealistic", "film grain"],
    },
    // ... 200–300 entries
  ],
}
```

**Target: 250 affinities.** Priority order:

1. All 25 free scene terms (highest impact — these are the first things users interact with)
2. All terms referenced in the 50 clusters
3. High-frequency terms from style, lighting, camera categories (strongest cross-category influence)

---

## Code Changes — What Gets Modified

### Change 1: Populate `getSemanticTag()` lookup (Part 1.1)

**File:** `src/data/vocabulary/intelligence/semantic-tags.json`  
**Action:** Populate the empty `options` dict with 400–600 entries  
**Risk:** Zero — additive data, existing code reads this dict already  
**Effect:** `getSemanticTag()` starts returning real tags → all existing scoring paths activate

### Change 2: Add cluster + affinity data loaders (Part 1.3)

**File:** `src/lib/prompt-intelligence/index.ts`  
**Action:** Import new JSON files, add getter functions:

- `getSemanticClusters()` → returns all clusters
- `getClustersForTerm(term)` → returns cluster IDs containing this term
- `getClusterTerms(clusterId, category)` → returns terms in a cluster for a category
- `getDirectAffinities(term)` → returns `{ boosts: string[], penalises: string[] }`

**Risk:** Low — additive exports only

### Change 3: Extend `scoreOption()` with cluster + affinity scoring (Part 1.4)

**File:** `src/lib/prompt-intelligence/engines/suggestion-engine.ts`  
**Action:** Add two new scoring dimensions to `scoreOption()`:

```typescript
// After existing mood/era/family scoring:

// === CLUSTER SCORING (Phase 1) ===
// How many of the user's active clusters does this option belong to?
const optionClusters = getClustersForTerm(option);
const activeClusters = getActiveClusters(context.selectedTerms); // new helper
let clusterScore = 0;
for (const clusterId of optionClusters) {
  if (activeClusters.has(clusterId)) {
    // Count how many selected terms share this cluster
    const sharedCount = countSharedClusterMembers(clusterId, context.selectedTerms);
    clusterScore += Math.min(
      sharedCount * SCORE_WEIGHTS.clusterPerMember,
      SCORE_WEIGHTS.clusterMax,
    );
  }
}
breakdown.clusterBoost = clusterScore;
score += clusterScore;

// === DIRECT AFFINITY SCORING (Phase 1) ===
// Do any of the user's selections explicitly boost or penalise this option?
let affinityScore = 0;
for (const selectedTerm of context.selectedTerms) {
  const affinities = getDirectAffinities(selectedTerm);
  if (affinities) {
    if (affinities.boosts.includes(lowerOption)) {
      affinityScore += SCORE_WEIGHTS.affinityBoost;
    }
    if (affinities.penalises.includes(lowerOption)) {
      affinityScore += SCORE_WEIGHTS.affinityPenalty; // negative number
    }
  }
}
breakdown.affinityBoost = affinityScore;
score += affinityScore;
```

**New SCORE_WEIGHTS additions:**

```typescript
clusterPerMember: 8,     // Per shared cluster member
clusterMax: 25,           // Cap cluster boost
affinityBoost: 20,        // Direct boost from another term
affinityPenalty: -15,     // Direct penalise from another term
```

**Updated ScoredOption breakdown:**

```typescript
breakdown?: {
  familyMatch: number;
  moodMatch: number;
  eraMatch: number;
  conflictPenalty: number;
  complementBonus: number;
  marketBoost: number;
  multiFamilyBonus?: number;
  subjectKeywordMatch?: number;
  clusterBoost?: number;        // NEW
  affinityBoost?: number;       // NEW
  tierMultiplier?: number;      // NEW
};
```

### Change 4: Extend `buildContext()` with active clusters (Part 1.4)

**File:** `src/lib/prompt-intelligence/engines/suggestion-engine.ts`  
**Action:** Add `activeClusters: Set<string>` to `PromptContext`. Computed in `buildContext()` by scanning all selected terms against cluster membership.

**File:** `src/lib/prompt-intelligence/types.ts`  
**Action:** Add to `PromptContext`:

```typescript
/** Active cluster IDs (clusters where ≥1 selected term is a member) */
activeClusters: Set<string>;
```

### Change 5: Tier-aware scoring multipliers (Part 1.6)

**File:** `src/lib/prompt-intelligence/engines/suggestion-engine.ts`  
**Action:** Apply per-tier weight multipliers to the final score.

```typescript
const TIER_MULTIPLIERS: Record<string, Record<string, number>> = {
  'tier1-clip': {
    clusterBoost: 1.2, // CLIP benefits from keyword coherence
    affinityBoost: 1.0,
    familyMatch: 1.0,
    moodMatch: 0.8,
  },
  'tier2-mj': {
    clusterBoost: 1.0,
    affinityBoost: 1.2, // MJ-specific affinities matter most
    familyMatch: 1.0,
    moodMatch: 1.0,
  },
  'tier3-nl': {
    clusterBoost: 0.8,
    affinityBoost: 1.0,
    familyMatch: 1.2, // NL benefits from family coherence
    moodMatch: 1.3, // Mood matters more in natural language
  },
  'tier4-plain': {
    clusterBoost: 0.5, // Dampened — keep it simple
    affinityBoost: 0.5,
    familyMatch: 0.5,
    moodMatch: 0.5,
  },
};
```

**Requires:** `tier` added to `PromptContext` (currently not passed). The `reorderByRelevance()` function and `prompt-builder.tsx` need to pass the active tier.

### Change 6: Wire tier into prompt-builder.tsx (Part 1.5)

**File:** `src/components/providers/prompt-builder.tsx`  
**Action:** Pass the current optimizer tier into `reorderByRelevance()` calls.

Currently:

```typescript
const scoredOptions = reorderByRelevance(
  config.options,
  category,
  selections,
  isMarketMoodEnabled,
  marketState,
);
```

After:

```typescript
const scoredOptions = reorderByRelevance(
  config.options,
  category,
  selections,
  isMarketMoodEnabled,
  marketState,
  currentTier,
);
```

Where `currentTier` comes from the existing tier selection state in the component.

**Risk:** Low — additive parameter with backward-compatible default.

### Change 7: Performance safeguard (Part 1.8)

**Action:** Wrap the `reorderedOptionsMap` computation with a performance measurement. If it exceeds 16ms, log a warning and consider memoisation or Web Worker fallback.

```typescript
const reorderedOptionsMap = useMemo(
  () => {
    const start = performance.now();
    // ... existing logic ...
    const elapsed = performance.now() - start;
    if (elapsed > 16 && process.env.NODE_ENV === 'development') {
      console.warn(`[Cascade] Reorder took ${elapsed.toFixed(1)}ms (target: <16ms)`);
    }
    return map;
  },
  [
    /* deps */
  ],
);
```

**Optimisation strategies if needed:**

1. **Pre-index clusters and affinities** at import time (Map lookups instead of array scans)
2. **Skip unchanged categories** — only re-score categories where a new selection could change results
3. **Debounce** is already handled in prompt-builder.tsx (100ms)

---

## Build Parts — Execution Order

| Part    | Task                                       | What it produces                                                                       | Effort  | Depends on    |
| ------- | ------------------------------------------ | -------------------------------------------------------------------------------------- | ------- | ------------- |
| **1.1** | Populate `semantic-tags.json` options dict | 400–600 term→tag entries in existing file                                              | 4–6 hrs | Phase 0 ✅    |
| **1.2** | Author `semantic-clusters.json`            | 50 clusters, ~500 cross-category term mappings                                         | 4–6 hrs | Phase 0 ✅    |
| **1.3** | Author `direct-affinities.json`            | 250 term affinity entries (boosts + penalises)                                         | 3–4 hrs | 1.1, 1.2      |
| **1.4** | Extend scoring engine                      | cluster + affinity scoring in `scoreOption()`, updated `buildContext()`, updated types | 2–3 hrs | 1.1, 1.2, 1.3 |
| **1.5** | Wire tier into prompt-builder.tsx          | Tier parameter passed to `reorderByRelevance()`                                        | 1 hr    | 1.4           |
| **1.6** | Add tier-aware multipliers                 | Per-tier weight modifiers in suggestion-engine.ts                                      | 1 hr    | 1.4           |
| **1.7** | Performance measurement + guard            | Timing logs, pre-indexed lookups if needed                                             | 1–2 hrs | 1.4, 1.5      |
| **1.8** | Verify everything                          | 12 automated tests + manual cascade verification                                       | 2 hrs   | 1.1–1.7       |

**Total: 18–25 hours (3–5 days)**

---

## Part Details

### Part 1.1 — Populate Semantic Tags (4–6 hrs)

**Goal:** Fill the empty `options` dict in `semantic-tags.json` with 400–600 entries.

**Strategy:** Build a Python script that:

1. Reads all 41 families from `families.json` → maps every member to its family IDs
2. Reads the 25 free scene prefills from the evolution plan → ensures every scene term is tagged
3. Reads the 80 conflict groups → maps to conflict arrays
4. Scans the 12 core category JSON files → picks the top ~40 most "cascade-valuable" terms per category
5. Assigns `mood`, `era`, `timeOfDay` based on keyword heuristics + manual review
6. Generates `complements` and `suggests` by cross-referencing families' `bestWith` arrays

**Term selection priority:**

1. All 363 family members (already have family data, just need mood/era)
2. All terms in the 25 free scenes (~80 unique terms)
3. Top 20 per category by "cascade value" (terms that strongly imply other categories)

**Output:** Updated `semantic-tags.json` with populated `options` dict.

**Verification:**

- `getSemanticTag("cyberpunk hacker")` returns a real tag (not undefined)
- At least 80% of family members have tags
- All 25 scene terms have tags
- No duplicate entries
- All referenced families exist in `families.json`

---

### Part 1.2 — Author Semantic Clusters (4–6 hrs)

**Goal:** Create `semantic-clusters.json` with 50 cross-category clusters.

**Strategy:** Hand-curate 50 clusters using the thematic groupings table above. Each cluster maps terms across 6–11 categories. Terms must exist in core or merged vocabulary (validated by script).

**Validation rules:**

- Every term in a cluster must exist in `getOptions(category)` or `getMergedOptions(category)`
- Every cluster must span at least 4 categories
- No cluster should have more than 15 terms in any single category (too broad = useless)
- No term should appear in more than 4 clusters (too diluted = useless)

**Output:** `src/data/vocabulary/intelligence/semantic-clusters.json`

---

### Part 1.3 — Author Direct Affinities (3–4 hrs)

**Goal:** Create `direct-affinities.json` with 250 term→boosts/penalises entries.

**Strategy:** Extract affinities from three sources:

1. `families.json` → `bestWith` / `avoidWith` (already curated by you)
2. `conflicts.json` → conflict group members become mutual penalises
3. Hand-curated affinities for high-value terms (lighting↔colour, camera↔composition, etc.)

**Validation rules:**

- Every term referenced must exist in vocabulary (core or merged)
- Boost and penalise lists should be 2–8 items (not too broad)
- No self-references
- No circular penalises (if A penalises B, B should penalise A)

**Output:** `src/data/vocabulary/intelligence/direct-affinities.json`

---

### Part 1.4 — Extend Scoring Engine (2–3 hrs)

**Files changed:**

- `src/lib/prompt-intelligence/types.ts` — add `activeClusters`, `tier` to `PromptContext`; add `clusterBoost`, `affinityBoost`, `tierMultiplier` to breakdown
- `src/lib/prompt-intelligence/index.ts` — import new JSONs, add getter functions
- `src/lib/prompt-intelligence/engines/suggestion-engine.ts` — add cluster + affinity scoring to `scoreOption()`, update `buildContext()`
- `src/lib/prompt-intelligence/engines/index.ts` — export new types/functions

**Existing features preserved: Yes** — all existing scoring factors remain. New factors are additive. Default tier is `undefined` → multiplier of 1.0 → backward compatible.

---

### Part 1.5 — Wire Tier into Prompt Builder (1 hr)

**File changed:** `src/components/providers/prompt-builder.tsx`  
**Action:** Pass `currentTier` from existing tier state into `reorderByRelevance()`.

**Find the current tier state:** Should be available from the optimizer tier selector already in the component.

---

### Part 1.6 — Tier-Aware Multipliers (1 hr)

**File changed:** `src/lib/prompt-intelligence/engines/suggestion-engine.ts`  
**Action:** Add `TIER_MULTIPLIERS` object and apply in `scoreOption()` before final clamp.

---

### Part 1.7 — Performance Measurement (1–2 hrs)

**File changed:** `src/components/providers/prompt-builder.tsx`  
**Action:** Add timing around `reorderedOptionsMap` computation.

**Pre-optimisations built into data layer:**

- Cluster lookups: pre-build `termToCluster: Map<string, Set<string>>` at import time
- Affinity lookups: pre-build `termToAffinity: Map<string, { boosts: Set<string>, penalises: Set<string> }>` at import time
- Both built once on module load, O(1) lookup during scoring

---

### Part 1.8 — Verification (2 hrs)

**12 automated tests** (in `src/__tests__/cascading-intelligence.integrity.test.ts`):

| #   | Test                               | What it checks                                                                   |
| --- | ---------------------------------- | -------------------------------------------------------------------------------- |
| T1  | Semantic tags populated            | `getSemanticTag()` returns non-undefined for ≥400 terms                          |
| T2  | All family members tagged          | Every member in `families.json` has a semantic tag                               |
| T3  | All scene terms tagged             | Every term in the 25 free scenes has a semantic tag                              |
| T4  | Cluster terms exist in vocabulary  | Every term in every cluster exists in core or merged                             |
| T5  | Clusters span ≥4 categories        | No cluster is too narrow                                                         |
| T6  | Affinity terms exist in vocabulary | Every boost/penalise target exists                                               |
| T7  | No self-referencing affinities     | No term boosts or penalises itself                                               |
| T8  | Score differentiation              | Selecting "cyberpunk hacker" → "neon glow" scores higher than "dappled sunlight" |
| T9  | Cluster boost activates            | Two terms from same cluster → third cluster member gets a boost                  |
| T10 | Affinity boost activates           | Term with explicit boost → boosted term scores higher                            |
| T11 | Conflict penalty activates         | Term in conflict group → conflicting term scores lower                           |
| T12 | Tier multiplier applies            | Same selection, Tier 4 → lower scores than Tier 1                                |

**Manual verification:**

- Select "cyberpunk hacker" → check Lighting dropdown: "neon glow" should be in top 5
- Select "golden hour" → check Colour dropdown: "warm palette" should be in top 5
- Select "anime style" → check Colour dropdown: "vibrant colors" should be in top 5
- Select "oil painting" + "impressionist" → check Lighting: "dappled sunlight" near top
- Switch to Tier 4 → scores should dampen (less aggressive reordering)

---

## Risk Register

| Risk                                 | Likelihood | Impact | Mitigation                                                                                                                                              |
| ------------------------------------ | ---------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Tag authoring takes too long**     | Medium     | Medium | Automate from families.json + heuristics. Only hand-curate mood/era.                                                                                    |
| **Too many clusters dilute scoring** | Low        | Medium | Cap at 50. Max 4 clusters per term.                                                                                                                     |
| **Performance regression**           | Low        | High   | Pre-indexed Maps. Timing guard. Web Worker fallback plan.                                                                                               |
| **Cascade feels random**             | Medium     | High   | Only reorder, never remove. "Suggested" badge on top terms. Start conservative (lower weights).                                                         |
| **Tier parameter missing**           | Low        | Low    | Default to no tier → multiplier 1.0 → backward compatible.                                                                                              |
| **Merged vocab terms untagged**      | Expected   | Low    | Phase 1 tags core terms only. Merged terms cascade via clusters (if "cyberpunk city" is in cyberpunk cluster, it benefits even without a semantic tag). |

---

## Success Criteria

| Metric                                              | Before Phase 1        | After Phase 1                            |
| --------------------------------------------------- | --------------------- | ---------------------------------------- |
| Terms with semantic tags                            | 0                     | 400–600                                  |
| Clusters                                            | 0                     | 50                                       |
| Direct affinities                                   | 0                     | 250                                      |
| Score differentiation on selection                  | All options score 40  | Top options 80–100, bottom 25–40         |
| "neon glow" rank after selecting "cyberpunk hacker" | ~150th (alphabetical) | Top 5                                    |
| Reorder computation time                            | <1ms (no-op)          | <16ms (one frame)                        |
| Existing features preserved                         | —                     | Yes (all current scoring factors remain) |

---

## File Impact Map

| File                                                       | Action                                                                 | Risk                        |
| ---------------------------------------------------------- | ---------------------------------------------------------------------- | --------------------------- |
| `src/data/vocabulary/intelligence/semantic-tags.json`      | MODIFY — populate `options` dict                                       | Low (additive data)         |
| `src/data/vocabulary/intelligence/semantic-clusters.json`  | CREATE                                                                 | Zero (new file)             |
| `src/data/vocabulary/intelligence/direct-affinities.json`  | CREATE                                                                 | Zero (new file)             |
| `src/lib/prompt-intelligence/types.ts`                     | MODIFY — extend PromptContext + breakdown                              | Low (additive fields)       |
| `src/lib/prompt-intelligence/index.ts`                     | MODIFY — add imports + getter functions                                | Low (additive exports)      |
| `src/lib/prompt-intelligence/engines/suggestion-engine.ts` | MODIFY — extend `scoreOption()` + `buildContext()` + add SCORE_WEIGHTS | Medium (core scoring logic) |
| `src/lib/prompt-intelligence/engines/index.ts`             | MODIFY — export new functions                                          | Low (additive exports)      |
| `src/components/providers/prompt-builder.tsx`              | MODIFY — pass tier to reorder                                          | Low (additive parameter)    |
| `src/__tests__/cascading-intelligence.integrity.test.ts`   | CREATE                                                                 | Zero (new test file)        |

---

## Dependency Graph

```
Phase 0 (✅ Complete)
  │
  ├─ Part 1.1 (Semantic Tags)  ──┐
  ├─ Part 1.2 (Clusters)  ───────┤
  │                               ├─ Part 1.3 (Affinities)
  │                               │     │
  │                               ├─────┘
  │                               │
  │                          Part 1.4 (Extend Scoring Engine)
  │                               │
  │                          Part 1.5 (Wire Tier) ─── Part 1.6 (Tier Multipliers)
  │                               │                        │
  │                          Part 1.7 (Performance)  ──────┘
  │                               │
  │                          Part 1.8 (Verification)
  │
  └─ Phase 2 (Scene Starters) — depends on Phase 1 complete
```

**Parts 1.1 and 1.2 can run in parallel** — they produce independent data files.  
**Part 1.3 benefits from 1.1 + 1.2** — affinities should reference terms that exist in tags and clusters.  
**Parts 1.4–1.7 are sequential** — each builds on the previous.

---

_End of document. Version 1.0.0. 2026-02-24._
