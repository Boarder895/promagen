# Learn Page — Complete Design Specification

**Last updated:** 16 January 2026  
**Owner:** Promagen  
**Authority:** This document defines the complete design specification for the Learn Prompt Engineering page (`/studio/learn`).  
**Existing features preserved:** Yes

---

## 1. Purpose

The Learn page is Promagen's education hub, teaching users how to craft effective AI image prompts. It provides tier-adaptive content that changes based on the selected AI platform.

---

## 2. Core Colours Reference

**Gradient:** `from-sky-400 via-emerald-300 to-indigo-400`

**Used for:**

- "Explore Styles" button
- "Build with [Platform]" button

---

## 3. Page Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ Learn Prompt Engineering                                        │
│ Master the art of crafting effective AI image prompts.          │
├─────────────────────────────────────────────────────────────────┤
│ 🔍 Search guides...                                             │
│                                                                 │
│ [▼ Select AI Platform...]              [✨ Explore Styles]      │
│                                        [🎨 Build with X →]      │
│                                        (conditional)            │
│                                                                 │
│ 💚 Select a platform for tier-specific tips, or browse          │
│    universal guidance that works across all 42 platforms.       │
├─────────────────────────────────────────────────────────────────┤
│ QUICK TIPS                                                      │
│ • Front-load Keywords  • Be Specific  • Use Artist References   │
├─────────────────────────────────────────────────────────────────┤
│ GUIDES                                                          │
│ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐          │
│ │ 1. Prompt Eng │ │ 2. Crafting   │ │ 3. Action &   │          │
│ │ Fundamentals  │ │ Your Subject  │ │ Pose          │          │
│ └───────────────┘ └───────────────┘ └───────────────┘          │
│ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐          │
│ │ 4. Mastering  │ │ 5. Environ-   │ │ 6. Composition│          │
│ │ Style         │ │ ments         │ │ & Framing     │          │
│ └───────────────┘ └───────────────┘ └───────────────┘          │
│ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐          │
│ │ 7. Camera &   │ │ 8. Lighting & │ │ 9. Colour in  │          │
│ │ Lens          │ │ Atmosphere    │ │ AI Prompts    │          │
│ └───────────────┘ └───────────────┘ └───────────────┘          │
│ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐          │
│ │ 10. Materials │ │ 11. Fidelity  │ │ 12. Negative  │          │
│ │ & Textures    │ │ & Quality     │ │ Prompts       │          │
│ └───────────────┘ └───────────────┘ └───────────────┘          │
├─────────────────────────────────────────────────────────────────┤
│ PLATFORM TIERS                                                  │
│ (All 4 shown if no platform selected)                          │
│ (Only relevant tier shown if platform selected)                │
│                                                                 │
│ [Tier 1 Box] [Tier 2 Box] [Tier 3 Box] [Tier 4 Box]            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Header Section

### 4.1 Elements

| Element                        | Style                                      | Behaviour                                                                |
| ------------------------------ | ------------------------------------------ | ------------------------------------------------------------------------ |
| Search bar                     | Existing style                             | Filters guides by text                                                   |
| AI Platform dropdown           | Combobox (same as rest of site)            | 42 platforms alphabetically, 123rf last                                  |
| "Explore Styles" button        | Core Colours gradient, pill shape          | Links to `/studio/explore`                                               |
| "Build with [Platform]" button | Core Colours gradient, pill shape          | Only visible when platform selected; links to `/providers/[platform-id]` |
| Green explainer text           | Same style as Prompt Builder platform tips | Short, helpful context                                                   |

### 4.2 Visual Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ Learn Prompt Engineering                                        │
│ Master the art of crafting effective AI image prompts.          │
├─────────────────────────────────────────────────────────────────┤
│ 🔍 Search guides...                                             │
│                                                                 │
│ [▼ Select AI Platform...]        [✨ Explore Styles]            │
│                                  [🎨 Build with Leonardo →]     │
│                                  ↑ only shows when platform     │
│                                    selected                     │
├─────────────────────────────────────────────────────────────────┤
│ 💚 "Select a platform for tier-specific tips, or browse         │
│    universal guidance that works across all 42 platforms."      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. Quick Tips Section

**No change from current implementation.** Keeps existing 3 quick tips:

- Front-load Keywords
- Be Specific
- Use Artist References

---

## 6. Guides Section (12 Guides)

### 6.1 Guide Order (1:1 with Prompt Builder Categories)

| #   | Guide Title                     | Prompt Builder Category |
| --- | ------------------------------- | ----------------------- |
| 1   | Prompt Engineering Fundamentals | Overview                |
| 2   | Crafting Your Subject           | Subject                 |
| 3   | Action, Pose & Movement         | Action / Pose           |
| 4   | Mastering Style Modifiers       | Style / Rendering       |
| 5   | Environments & Settings         | Environment             |
| 6   | Composition & Framing           | Composition / Framing   |
| 7   | Camera & Lens Techniques        | Camera                  |
| 8   | Lighting & Atmosphere           | Lighting + Atmosphere   |
| 9   | Colour in AI Prompts            | Colour / Grade          |
| 10  | Materials, Textures & Surfaces  | Materials / Texture     |
| 11  | Fidelity & Quality Boosters     | Fidelity                |
| 12  | Using Negative Prompts          | Constraints / Negative  |

### 6.2 Content Behaviour

| State                | What Shows                                                   |
| -------------------- | ------------------------------------------------------------ |
| No platform selected | Universal content (works for all platforms)                  |
| Platform selected    | Guide content adapts to show tier-specific tips and examples |

### 6.3 Guide Card Display (v1.1.0)

Each guide card includes:

| Element            | Description                                          |
| ------------------ | ---------------------------------------------------- |
| Title              | Guide title                                          |
| Description        | Short summary (2-line clamp)                         |
| Tags               | Up to 4 topic tags                                   |
| Category label     | Guide category                                       |
| Platform tier tip  | Shows when platform selected                         |
| "Read Guide →" CTA | Links to guide detail with relevant category context |

**Removed from guide cards (16 Jan 2026):**

| Element              | Reason Removed                        |
| -------------------- | ------------------------------------- |
| ~~Difficulty badge~~ | Unnecessary metadata, visual clutter  |
| ~~Read time~~        | Unnecessary metadata                  |
| ~~Section count~~    | Unnecessary metadata, internal detail |

---

## 7. Platform Tiers Section

### 7.1 Behaviour Based on Platform Selection

| State                | What Shows                                                     |
| -------------------- | -------------------------------------------------------------- |
| No platform selected | All 4 tier info boxes visible (information only, no dropdowns) |
| Platform selected    | Only the relevant tier box shows, other 3 disappear            |

### 7.2 Tier Info Boxes (All Platforms View)

```
┌─────────────────────────────────────────────────────────────────┐
│ PLATFORM TIERS                                                  │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐│
│ │ Tier 1: CLIP-Based                                          ││
│ │ Weighted syntax, keyword stacking                           ││
│ │ 13 platforms: Artguru, ClipDrop, Dreamlike, DreamStudio,   ││
│ │ Getimg, Jasper Art, Leonardo, Lexica, NightCafe, NovelAI,  ││
│ │ OpenArt, Playground, Stability                              ││
│ └─────────────────────────────────────────────────────────────┘│
│ ┌─────────────────────────────────────────────────────────────┐│
│ │ Tier 2: Midjourney Family                                   ││
│ │ Parameters, --no negatives                                  ││
│ │ 2 platforms: BlueWillow, Midjourney                        ││
│ └─────────────────────────────────────────────────────────────┘│
│ ┌─────────────────────────────────────────────────────────────┐│
│ │ Tier 3: Natural Language                                    ││
│ │ Conversational sentences                                    ││
│ │ 10 platforms: Adobe Firefly, Bing, Flux, Google Imagen,    ││
│ │ Hotpot, Ideogram, Meta Imagine, Microsoft Designer,        ││
│ │ OpenAI, Runway                                              ││
│ └─────────────────────────────────────────────────────────────┘│
│ ┌─────────────────────────────────────────────────────────────┐│
│ │ Tier 4: Plain Language                                      ││
│ │ Simple, focused prompts                                     ││
│ │ 17 platforms: Artbreeder, Artistly, Canva, Craiyon,        ││
│ │ DeepAI, Fotor, Freepik, MyEdit, PhotoLeap, PicsArt,        ││
│ │ PicWish, Pixlr, Remove.bg, Simplified, Visme,              ││
│ │ VistaCreate, 123rf                                          ││
│ └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### 7.3 Platform Selected View (Example: Leonardo)

```
┌─────────────────────────────────────────────────────────────────┐
│ YOUR PLATFORM'S TIER                                            │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐│
│ │ Tier 1: CLIP-Based                                          ││
│ │ Leonardo uses weighted syntax and keyword stacking.         ││
│ │ Use (keyword:1.5) to increase weight, parentheses for       ││
│ │ emphasis, and stack multiple style terms effectively.       ││
│ │                                                             ││
│ │ Also in this tier: Artguru, ClipDrop, Dreamlike...         ││
│ └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│ (Tier 2, 3, 4 boxes are HIDDEN)                                │
└─────────────────────────────────────────────────────────────────┘
```

### 7.4 Platform Tier Definitions

| Tier | Name              | Syntax Style                      | Platform Count | Platforms                                                                                                                                                  |
| ---- | ----------------- | --------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | CLIP-Based        | Weighted syntax, keyword stacking | 13             | Artguru, ClipDrop, Dreamlike, DreamStudio, Getimg, Jasper Art, Leonardo, Lexica, NightCafe, NovelAI, OpenArt, Playground, Stability                        |
| 2    | Midjourney Family | Parameters, `--no` negatives      | 2              | BlueWillow, Midjourney                                                                                                                                     |
| 3    | Natural Language  | Conversational sentences          | 10             | Adobe Firefly, Bing, Flux, Google Imagen, Hotpot, Ideogram, Meta Imagine, Microsoft Designer, OpenAI, Runway                                               |
| 4    | Plain Language    | Simple, focused prompts           | 17             | Artbreeder, Artistly, Canva, Craiyon, DeepAI, Fotor, Freepik, MyEdit, PhotoLeap, PicsArt, PicWish, Pixlr, Remove.bg, Simplified, Visme, VistaCreate, 123rf |

---

## 8. Component Specifications

### 8.1 GuideCard Component (v1.1.0)

**File:** `src/components/prompts/learn/guide-card.tsx`

**Category Colour Mapping:**

```typescript
const CATEGORY_COLOURS = {
  fundamentals: {
    gradient: 'from-sky-500 via-blue-500 to-indigo-500',
    glow: 'rgba(56, 189, 248, 0.15)',
    accent: 'text-sky-400',
  },
  advanced: {
    gradient: 'from-violet-500 via-purple-500 to-fuchsia-500',
    glow: 'rgba(139, 92, 246, 0.15)',
    accent: 'text-violet-400',
  },
  'platform-specific': {
    gradient: 'from-amber-500 via-orange-500 to-red-500',
    glow: 'rgba(245, 158, 11, 0.15)',
    accent: 'text-amber-400',
  },
  tips: {
    gradient: 'from-emerald-500 via-green-500 to-teal-500',
    glow: 'rgba(16, 185, 129, 0.15)',
    accent: 'text-emerald-400',
  },
};
```

### 8.2 LearnFilters Component (v1.1.0)

**File:** `src/components/prompts/learn/learn-filters.tsx`

**TypeScript Implementation:**

```typescript
const handlePlatformSelect = useCallback(
  (selected: string[]) => {
    if (selected.length === 0) {
      onPlatformChange(null);
    } else {
      const platformName = selected[0];
      // Explicit type handling: Map.get() returns string | undefined
      // Convert to string | null for onPlatformChange
      const foundId = platformNameToId.get(platformName);
      const platformId: string | null = foundId !== undefined ? foundId : null;
      onPlatformChange(platformId);
    }
  },
  [onPlatformChange, platformNameToId],
);
```

**Navigation Links:**

```tsx
{
  /* Always visible */
}
<Link href="/studio/explore" prefetch={false} className="...">
  ✨ Explore Styles
</Link>;

{
  /* Conditional: only when platform selected */
}
{
  selectedPlatformId && (
    <Link href={`/providers/${selectedPlatformId}`} prefetch={false} className="...">
      🎨 Build with {selectedPlatformDisplayName} →
    </Link>
  );
}
```

## The buttons are using <button onClick> with router.push() instead of proper <Link> components. The buttons are ✨ Explore Styles and 🎨 Build with {selectedPlatformDisplayName}.

## 9. Summary of Changes from Previous Version

| Previous                               | New                                                                            |
| -------------------------------------- | ------------------------------------------------------------------------------ |
| "All Categories" dropdown              | AI Providers dropdown (42 platforms, 123rf last)                               |
| "All Levels" dropdown                  | "Explore Styles" button (Core Colours gradient) → `/studio/explore`            |
| No platform-specific action            | "Build with [Platform]" button (conditional, Core Colours) → `/providers/[id]` |
| Generic content only                   | Tier-adaptive content when platform selected                                   |
| 6 guides                               | 12 guides (1:1 with Prompt Builder categories)                                 |
| 2 platform tip sections with dropdowns | 4 tier info boxes (no dropdowns, information only)                             |
| All tier sections always visible       | Single relevant tier when platform selected                                    |
| Difficulty badges on guide cards       | Removed (16 Jan 2026)                                                          |
| Read time on guide cards               | Removed (16 Jan 2026)                                                          |
| Section count on guide cards           | Removed (16 Jan 2026)                                                          |

---

## 10. Test Requirements

### 10.1 Functional Tests

| Test                                      | Expected Result                                     |
| ----------------------------------------- | --------------------------------------------------- |
| Guide card renders                        | Shows title, description, tags, category, CTA       |
| Guide card does NOT show                  | No difficulty badge, no read time, no section count |
| "Explore Styles" button click             | Navigates to `/studio/explore`                      |
| "Build with [Platform]" button visibility | Only visible when platform selected                 |
| "Build with [Platform]" button click      | Navigates to `/providers/[platform-id]`             |
| Platform dropdown selection               | Updates guide content with tier-specific tips       |
| Platform dropdown clear                   | Shows universal content                             |
| Tier boxes (no platform)                  | All 4 tier info boxes visible                       |
| Tier boxes (platform selected)            | Only relevant tier box visible                      |

### 10.2 TypeScript/Lint Tests

| Test                 | Expected Result                |
| -------------------- | ------------------------------ |
| `pnpm run typecheck` | No errors in learn-filters.tsx |
| `pnpm run lint`      | No unused import warnings      |

---

## 11. Non-Regression Rule

When modifying the Learn page:

- Do NOT remove the 12 guide structure
- Do NOT change navigation button destinations
- Do NOT re-add difficulty/readTime/sectionCount metadata to guide cards
- Do NOT modify tier platform assignments without updating all related docs
- Preserve search functionality
- Preserve platform dropdown behaviour

**Existing features preserved:** Yes (required for every change)

---

## Changelog

- **16 Jan 2026 (v1.1.0):** **GUIDE CARD CLEANUP** — Removed difficulty badges, read time, and section count from guide cards and detail panels. Fixed TypeScript Map.get() type handling in learn-filters.tsx. Added prefetch={false} to Link components. Created standalone Learn page specification document.

- **8 Jan 2026 (v1.0.0):** Initial Learn page specification as part of Prompt Intelligence document.
