# Scene Starters

**Last updated:** 9 April 2026  
**Version:** 2.0.0  
**Owner:** Promagen  
**Authority:** This document defines the architecture and behaviour for the Scene Starters system (prompt-builder-evolution-plan-v2.md Phase 2).

---

## Purpose

Scene Starters are curated one-click prompt templates that pre-populate multiple categories simultaneously. They solve the blank-canvas problem: instead of filling 12 dropdowns from scratch, users select a scene like "Cyberpunk Character" and get 5–7 categories instantly populated with coherent, themed values.

Scenes sit between the instruction bar and the category grid in every provider's prompt builder page. Collapsed by default — one click expands a horizontal scrollable strip of scene cards grouped by "world" (thematic heading).

---

## Data Architecture

### Scene Count

| Tier | Count | Access |
|------|-------|--------|
| **Free (Standard Promagen)** | 25 scenes | All users |
| **Pro Promagen** | 175 scenes | Paid users only |
| **Total** | 200 scenes | — |

### World Grouping

Scenes are grouped into 23 thematic worlds. 5 worlds contain free scenes (5 scenes each = 25 free total). 18 worlds are pro-only.

**Free worlds (25 scenes total):**

| World | Slug | Scenes |
|-------|------|--------|
| Portraits & People | portraits-and-people | 5 free |
| Landscapes & Worlds | landscapes-and-worlds | 5 free |
| Mood & Atmosphere | mood-and-atmosphere | 5 free |
| Style Forward | style-forward | 5 free |
| Trending & Seasonal | trending-seasonal | 5 free |

**Pro worlds (175 scenes total):**

| World | Slug | Scenes |
|-------|------|--------|
| Cinematic | cinematic | 12 |
| Fantasy & Mythology | fantasy-and-mythology | 12 |
| Sci-Fi & Future | sci-fi-and-future | 12 |
| Historical Eras | historical-eras | 12 |
| Urban & Street | urban-and-street | 12 |
| Portraiture & Character | portraiture-and-character | 12 |
| Nature & Elements | nature-and-elements | 10 |
| Architecture & Interiors | architecture-and-interiors | 10 |
| Whimsical & Surreal | whimsical-and-surreal | 10 |
| Cultural & Ceremonial | cultural-and-ceremonial | 10 |
| Commodity Inspired | commodity-inspired | 10 |
| Abstract & Experimental | abstract-and-experimental | 8 |
| Dark & Horror | dark-and-horror | 8 |
| Food & Still Life | food-and-still-life | 8 |
| Animals & Creatures | animals-and-creatures | 8 |
| Weather Driven | weather-driven | 8 |
| Seasonal | seasonal | 8 |
| Micro & Macro | micro-and-macro | 5 |

### Schema

Each scene entry in `scene-starters.json`:

```typescript
interface SceneEntry {
  id: string;              // Unique kebab-case ID (e.g. 'cyberpunk-character')
  name: string;            // Display name
  world: WorldSlug;        // Parent world
  emoji: string;           // Card icon
  description: string;     // Short tagline (max 120 chars)
  tier: 'free' | 'pro';   // Access tier
  prefills: ScenePrefills; // Category → string[] (5–7 categories)
  tierGuidance: TierGuidance; // Per-tier metadata (affinity, notes, reducedPrefills)
  flavourPhrases?: FlavourPhrases; // Optional bonus phrases for Explore Drawer
  tags: string[];          // Searchable tags (3–12 per scene)
}
```

### Prefill Statistics

- Minimum categories prefilled per scene: 5
- Maximum categories prefilled per scene: 7
- Average categories prefilled per scene: 5.9

### Tier Guidance

Every scene has per-tier metadata for all 4 optimizer tiers:

```typescript
interface TierGuidanceEntry {
  affinity: number;           // 1–10 how well this scene works on this tier
  notes: string;              // Human-readable tier-specific guidance
  reducedPrefills?: string[]; // Tier 4 only: subset of categories to prefill (3–5)
}
```

Tier 4 (Plain Language) platforms receive reduced prefills — only the 3–5 most impactful categories — because these platforms cannot handle complex multi-category prompts effectively.

### Flavour Phrases

Optional scene-specific bonus vocabulary that appears in the Explore Drawer:

```typescript
type FlavourPhrases = Partial<Record<PrefillableCategory, string[]>>;
```

| Stat | Value |
|------|-------|
| Scenes with flavour phrases | 26 of 200 |
| Total flavour phrases | 90 |
| Lighting phrases | 36 |
| Atmosphere phrases | 25 |
| Environment phrases | 23 |
| Materials phrases | 6 |

These are NOT from core vocabulary — they are unique evocative phrases crafted for each scene. Example: "Dramatic Portrait" scene has lighting flavour phrases "chiaroscuro shadow play" and "single key light cutting through darkness".

---

## File Locations

| File | Purpose |
|------|---------|
| `src/data/scenes/scene-starters.json` | 200 scene entries (single source of truth) |
| `src/data/scenes/scene-starters.schema.json` | JSON Schema for validation |
| `src/data/scenes/scene-starters.json.d.ts` | TypeScript declarations for JSON import |
| `src/data/scenes/worlds.ts` | World metadata (23 worlds with emoji, label, description) |
| `src/data/scenes/index.ts` | Exports: allScenes, freeScenes, proScenes, getSceneById, getScenesByWorld, ALL_WORLDS, WORLD_BY_SLUG |
| `src/types/scene-starters.ts` | TypeScript types: SceneEntry, WorldMeta, TierGuidance, FlavourPhrases, PrefillableCategory |
| `src/components/providers/scene-selector.tsx` | UI component (v1.3.0, 1,110 lines) |

---

## UI Component: SceneSelector

### Layout

```
┌─ Collapsed (default) ────────────────────────────────────────────┐
│  🎬 Scene Starters ▾                                    25 free │
└──────────────────────────────────────────────────────────────────┘

┌─ Expanded ───────────────────────────────────────────────────────┐
│  🎬 Scene Starters ▴                           ✕ Clear scene    │
│                                                                  │
│  [🎭 Portraits] [🌍 Landscapes] [🎨 Style] | [🎬 Cinematic] ...│
│                                                                  │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                  │
│  │ 🎬   │ │ ⚔️   │ │ 🌙   │ │ 🔒   │ │ 🔒   │  ← cards       │
│  │Drama │ │Hero  │ │Night │ │ Pro  │ │ Pro  │                  │
│  │5 cat │ │6 cat │ │7 cat │ │8 cat │ │5 cat │                  │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘                  │
└──────────────────────────────────────────────────────────────────┘
```

### Behaviour

1. **Collapsed by default** — trigger bar shows "🎬 Scene Starters" with count badge
2. **World pills** — horizontal scrollable row; free worlds on left, pro worlds after divider
3. **Scene cards** — grid of cards per world; clicking applies prefills to category dropdowns
4. **Active scene badge** — cyan tint on active card; "✕ Clear" button in header
5. **Modification tracking** — if user changes scene values, confirmation dialog on reset
6. **Scene-origin chips** — combobox chips from scenes get cyan tint + 🎬 indicator
7. **Tier 4 reduction** — Tier 4 platforms get reduced prefills with amber "⚡ reduced" label
8. **Affinity dots** — colour-coded dots on cards (🟢 ≥8, 🟡 6–7, 🔴 <6)

### Pro Gate

- 25 free scenes: fully accessible to all users
- 175 pro scenes: visible with 🔒 icon + 50% opacity
- Clicking a locked scene shows upgrade prompt dialog:
  - Anonymous → "Sign in first" (Clerk modal)
  - Free signed-in → "Upgrade to Pro" (link to `/pro-promagen`)
- Pro scenes never dead-end — always show a path forward

---

## Explore Drawer Integration (Phase 4.1)

When a scene is active and has `flavourPhrases` for a category, the Explore Drawer shows a **"🎬 Scene"** tab as the first tab. This tab contains only the scene's bonus phrases for that category.

Flavour chips have:
- Cyan border + background tint (distinct from core/merged chips)
- 🎬 emoji indicator prefix
- Click-to-add works identically to other chips

The trigger bar also shows a hint: "Explore 854 more phrases + 2 scene".

Example: Activating "Dramatic Portrait" scene while viewing the **Lighting** Explore Drawer adds a "🎬 Scene (2)" tab with chips: "chiaroscuro shadow play", "single key light cutting through darkness".

---

## Cascading Intelligence Integration (Phase 4.4)

The Explore Drawer sorts chips by cascade relevance score when available. This means chips related to current selections appear first, pushing less relevant options down. Alphabetical sort is the fallback when no cascade data exists. Scene tab always sorts alphabetically (curated order preserved).

---

## Tier Badge System (Phase 4.3)

All Explore Drawer chips show tier-appropriate badges:

| Tier | Badge | Criteria | Meaning |
|------|-------|----------|---------|
| Tier 1 (CLIP) | ★ | 1–2 words | Token-efficient for weighted prompts |
| Tier 2 (MJ) | ◆ | 2–4 words | Midjourney keyword sweet-spot |
| Tier 3 (NL) | 💬 | 3+ words | Natural language descriptive phrase |
| Tier 4 (Plain) | ⚡/⚠ | <3 / ≥3 words | Simple safe / complex may truncate |

---

## Analytics Events (Phase 4.2)

| Event | Trigger | Key Payload Fields |
|-------|---------|-------------------|
| `scene_selected` | User applies a scene | scene_id, scene_name, world, tier, platform_tier, categories_prefilled |
| `scene_reset` | User clears active scene | scene_id, was_modified |
| `explore_drawer_opened` | User expands Explore Drawer | category, platform_tier |
| `explore_chip_clicked` | User clicks a chip in Explore | category, term, platform_tier, source_tab |
| `cascade_reorder_triggered` | Cascade scoring runs | categories_reordered, elapsed_ms |

All events go to GTM dataLayer via `trackEvent()` from `src/lib/analytics/events.ts`.

---

## Fluid Typography

All Scene Selector and Explore Drawer UI uses CSS `clamp()` for fluid sizing. Zero fixed `px` or `rem` font sizes, padding, or gap values.

| Component | clamp() count | Fixed px exceptions |
|-----------|---------------|---------------------|
| scene-selector.tsx | 92 | 1px (vertical divider), 2px (gradient accent line) — both decorative |
| explore-drawer.tsx | 35 | None |

---

## Non-Regression Rule

When modifying Scene Starters or Explore Drawer:

- Do not modify core vocabulary files (`data/vocabulary/prompt-builder/*.json`)
- Do not modify the 4-tier assembler logic (`lib/prompt-builder/generators.ts`)
- Preserve all 12-category dropdown functionality
- Preserve all lock state and authentication flows
- Preserve all platform-aware selection limits
- Scene data is additive — never remove scenes, only add or update
- Do not modify scene-starters.json without updating this document

---

## Changelog


---

## Learning Pipeline Integration (Phase 5 — Layer 3)

The nightly learning aggregation cron (`/api/learning/aggregate`) includes a scene candidate generation layer. When enough user-created prompts share similar category selections and all score 90%+, the system proposes new Scene Starters.

**Process:**

1. Nightly cron clusters user prompt selection sets using Jaccard similarity
2. Large clusters with high-scoring prompts generate scene candidates
3. Candidates appear in admin review queue (`/admin/scene-candidates`)
4. Admin can approve, reject, or reset each candidate
5. Approved candidates are added to `scene-starters.json`

**Key files:**

| File | Purpose |
|------|---------|
| `src/lib/learning/scene-candidates.ts` | Pure computation — Jaccard clustering + consensus extraction |
| `src/app/api/learning/scene-candidates/route.ts` | Public GET endpoint (5-min cache) |
| `src/app/admin/scene-candidates/page.tsx` | Admin review queue UI |

Candidates are never auto-added. Admin review is mandatory.

---

## Changelog

- **9 Apr 2026 (v2.0.0):** Added Learning Pipeline Integration (Phase 5 Layer 3 — scene candidates from collective intelligence). Updated date.
- **25 Feb 2026 (v1.0.0):** Initial release. Phase 0–4 complete. 200 scenes across 23 worlds.
