# Prompt Intelligence

**Last updated:** 16 January 2026  
**Owner:** Promagen  
**Authority:** This document defines the architecture, data structures, and implementation plan for the Prompt Intelligence system.

---

## 1. Purpose

Prompt Intelligence transforms Promagen's prompt builder from a simple selection tool into an **intelligent, educational system** that helps users craft better prompts while teaching them prompt literacy.

### Core Principles

1. **User intent is sacred** — User-typed text always takes priority, is never trimmed, and anchors the prompt
2. **Education through use** — Users learn what works by seeing coherence scores, conflict warnings, and contextual suggestions
3. **Market bridge** — Live market data influences suggestions, making Promagen unique
4. **Zero latency** — All intelligence runs client-side for instant feedback
5. **Existing layout unchanged** — The prompt builder UI stays exactly as-is; intelligence enhances behaviour, not appearance

### What This Enables

| Capability             | Description                                                   |
| ---------------------- | ------------------------------------------------------------- |
| **Live reordering**    | Dropdown options reorder by relevance as user builds prompt   |
| **Smart trim**         | When over character limit, trims lowest-relevance terms first |
| **Conflict detection** | Warns when selected terms clash (e.g., vintage + cyberpunk)   |
| **Suggested chips**    | Context-aware "Suggested for you" options appear              |
| **Coherent randomise** | 🎲 button generates thematically coherent prompts             |
| **Subject anchor**     | User's subject always leads the prompt                        |
| **Market mood**        | Live market state tints suggestions                           |
| **Prompt DNA**         | Visual coherence indicator educates users                     |

---

## 9. New Pages

### 9.1 Route Structure

```
src/app/studio/
├── page.tsx                # /studio → Studio hub
├── playground/
│   └── page.tsx            # Standalone prompt builder with provider selector
├── library/
│   └── page.tsx            # Saved prompts grid
├── explore/
│   └── page.tsx            # Style family browser
├── learn/
│   └── page.tsx            # Education hub
└── trending/
    └── page.tsx            # Community trends (Phase 4)
```

**Route Update (16 Jan 2026):** Routes moved from `/prompts/*` to `/studio/*` for better information architecture.

---

## 9.5 Learn Page Component Specifications (v1.1.0)

### 9.5.1 Overview

The Learn page (`/studio/learn`) is the education hub for prompt engineering. It provides guides organised by category, with optional platform-specific tips when a provider is selected.

**Core Colours Reference:**
- Gradient: `from-sky-400 via-emerald-300 to-indigo-400`
- Used for: Action buttons (Explore Styles, Build with Platform)

### 9.5.2 Header Section Layout

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

### 9.5.3 LearnFilters Component (v1.1.0)

**File:** `src/components/prompts/learn/learn-filters.tsx`

| Element | Style | Behaviour |
|---------|-------|-----------|
| Search bar | Existing style | Filters guides by text |
| AI Platform dropdown | Combobox (same as rest of site) | 42 platforms alphabetically, 123rf sorted last, single-select |
| "Explore Styles" button | Core Colours gradient, pill shape | Links to `/studio/explore` with `prefetch={false}` |
| "Build with [Platform]" button | Core Colours gradient, pill shape | Only visible when platform selected; links to `/providers/[platform-id]` with `prefetch={false}` |
| Green explainer text | Same style as Prompt Builder platform tips | Short, helpful context |

**TypeScript Implementation (16 Jan 2026 Fix):**

The platform selection handler now correctly handles `Map.get()` returning `string | undefined`:

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
  [onPlatformChange, platformNameToId]
);
```

**Navigation Implementation (16 Jan 2026 Fix):**

Both Link components use `prefetch={false}` to ensure reliable client-side navigation:

```tsx
{/* Explore Styles button - always visible */}
<Link
  href="/studio/explore"
  prefetch={false}
  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-sky-400 via-emerald-300 to-indigo-400 px-4 py-2 text-sm font-medium text-black transition-all hover:opacity-90"
>
  <Sparkles className="h-4 w-4" />
  Explore Styles
</Link>

{/* Build with Platform button - conditional */}
{selectedPlatformId && (
  <Link
    href={`/providers/${selectedPlatformId}`}
    prefetch={false}
    className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-sky-400 via-emerald-300 to-indigo-400 px-4 py-2 text-sm font-medium text-black transition-all hover:opacity-90"
  >
    <Palette className="h-4 w-4" />
    Build with {selectedPlatformDisplayName}
    <ArrowRight className="h-4 w-4" />
  </Link>
)}
```

### 9.5.4 GuideCard Component (v1.1.0)

**File:** `src/components/prompts/learn/guide-card.tsx`

**Display Elements (what shows):**

| Element | Description | Style |
|---------|-------------|-------|
| DNA Helix Bar | Visual pattern unique to each guide (12 segments) | Category-coloured gradient |
| Title | Guide title | `text-base font-semibold text-white` |
| Description | Short summary | `text-xs text-white/40`, 2-line clamp |
| Tags | Up to 4 topic tags | `text-[10px] rounded-md bg-white/5 px-1.5 py-0.5` |
| Category label | Guide category | `text-[10px] text-white/30 capitalize` |
| Platform tier tip | Shows when platform selected | `text-[10px] bg-white/5 rounded px-2 py-1` |
| "Read Guide →" CTA | Action link | Category accent colour |

**Removed Elements (16 Jan 2026):**

| Element | Reason Removed |
|---------|----------------|
| ~~Difficulty badge~~ (beginner/intermediate/advanced) | Unnecessary metadata, added visual clutter without value |
| ~~Read time~~ ("8 min read") | Unnecessary metadata, users can assess from description |
| ~~Section count~~ ("3 sections") | Unnecessary metadata, internal implementation detail |
| ~~`difficultyColour` useMemo~~ | No longer needed after badge removal |

**Category Colour Mapping:**

```typescript
const CATEGORY_COLOURS: Record<string, CategoryColour> = {
  'fundamentals': {
    gradient: 'from-sky-500 via-blue-500 to-indigo-500',
    glow: 'rgba(56, 189, 248, 0.15)',
    accent: 'text-sky-400',
  },
  'advanced': {
    gradient: 'from-violet-500 via-purple-500 to-fuchsia-500',
    glow: 'rgba(139, 92, 246, 0.15)',
    accent: 'text-violet-400',
  },
  'platform-specific': {
    gradient: 'from-amber-500 via-orange-500 to-red-500',
    glow: 'rgba(245, 158, 11, 0.15)',
    accent: 'text-amber-400',
  },
  'tips': {
    gradient: 'from-emerald-500 via-green-500 to-teal-500',
    glow: 'rgba(16, 185, 129, 0.15)',
    accent: 'text-emerald-400',
  },
};
```

**Card Layout (after cleanup):**

```
┌─────────────────────────────────────────────────┐
│ [DNA Helix Bar - 12 coloured segments]          │
├─────────────────────────────────────────────────┤
│                                                 │
│ Guide Title                                     │
│                                                 │
│ Short description text that provides context   │
│ about what this guide covers...                │
│                                                 │
│ [tag1] [tag2] [tag3] [tag4]                    │
│                                                 │
│ fundamentals                                    │
│                                                 │
│ ┌─────────────────────────────────────────────┐│
│ │ 💡 Tier tip when platform selected          ││
│ └─────────────────────────────────────────────┘│
│                                                 │
│ Read Guide →                                    │
└─────────────────────────────────────────────────┘
```

### 9.5.5 GuideDetailPanel Component (v1.1.0)

**File:** `src/components/prompts/learn/guide-detail-panel.tsx`

**Display Elements (what shows):**

| Element | Description |
|---------|-------------|
| DNA Helix Bar | Extended pattern (20 segments) with category gradient |
| Title | Large heading with glow effect |
| Description | Full description text |
| Platform tier tip box | Conditional, shows when platform selected |
| Section content | Full guide content with examples |
| Related guides | Links to related guide IDs |
| Tags | All tags as chips |
| Back button | Returns to guide list |

**Removed Elements (16 Jan 2026):**

| Element | Reason Removed |
|---------|----------------|
| ~~Difficulty badge~~ | Consistent with GuideCard removal |
| ~~Read time display~~ | Consistent with GuideCard removal |
| ~~Section count display~~ | Consistent with GuideCard removal |
| ~~`difficultyColour` useMemo~~ | No longer needed after badge removal |

### 9.5.6 Guides Section (12 Guides)

Order matches 1:1 with Prompt Builder categories:

| # | Guide Title | Prompt Builder Category |
|---|-------------|------------------------|
| 1 | Prompt Engineering Fundamentals | Overview |
| 2 | Crafting Your Subject | Subject |
| 3 | Action, Pose & Movement | Action / Pose |
| 4 | Mastering Style Modifiers | Style / Rendering |
| 5 | Environments & Settings | Environment |
| 6 | Composition & Framing | Composition / Framing |
| 7 | Camera & Lens Techniques | Camera |
| 8 | Lighting & Atmosphere | Lighting + Atmosphere |
| 9 | Colour in AI Prompts | Colour / Grade |
| 10 | Materials, Textures & Surfaces | Materials / Texture |
| 11 | Fidelity & Quality Boosters | Fidelity |
| 12 | Using Negative Prompts | Constraints / Negative |

**Content Behaviour:**
- **No platform selected:** Universal content (works for all platforms)
- **Platform selected:** Guide content adapts to show tier-specific tips and examples

### 9.5.7 Platform Tiers Section

**Behaviour based on platform selection:**

| State | What Shows |
|-------|------------|
| No platform selected | All 4 tier info boxes visible (information only, no dropdowns) |
| Platform selected | Only the relevant tier box shows, other 3 disappear |

**Tier Definitions:**

| Tier | Name | Syntax Style | Platform Count |
|------|------|--------------|----------------|
| 1 | CLIP-Based | Weighted syntax, keyword stacking | 13 |
| 2 | Midjourney Family | Parameters, --no negatives | 2 |
| 3 | Natural Language | Conversational sentences | 10 |
| 4 | Plain Language | Simple, focused prompts | 17 |

---

## 12. Files Modified (Existing)

| File                                          | Changes                                                             |
| --------------------------------------------- | ------------------------------------------------------------------- |
| `src/lib/prompt-builder.ts`                   | Import intelligence; use smart trim; Subject anchor                 |
| `src/hooks/use-prompt-optimization.ts`        | Use smart trim; protect custom text                                 |
| `src/components/providers/prompt-builder.tsx` | Add Market Mood toggle; DNA bar; suggested chips; conflict warnings |
| `src/components/ui/combobox.tsx`              | Accept reordered options; display relevance hints                   |
| `src/components/layout/homepage-grid.tsx`     | Removed unused `Link` import (16 Jan 2026)                         |
| `src/components/prompts/learn/learn-filters.tsx` | Fixed TypeScript Map.get() type handling; added prefetch={false} (16 Jan 2026) |
| `src/components/prompts/learn/guide-card.tsx` | Removed difficulty badge, read time, section count, difficultyColour useMemo (16 Jan 2026) |
| `src/components/prompts/learn/guide-detail-panel.tsx` | Removed difficulty badge, read time, section count, difficultyColour useMemo (16 Jan 2026) |

---

## 13. Testing Requirements

### Learn Page Tests (16 Jan 2026)

| Scenario                               | Expected                                     |
| -------------------------------------- | -------------------------------------------- |
| Guide card renders                     | Shows title, description, tags, category, CTA |
| Guide card does NOT show               | No difficulty badge, no read time, no section count |
| "Explore Styles" button click          | Navigates to `/studio/explore`               |
| "Build with [Platform]" button click   | Navigates to `/providers/[platform-id]`      |
| Platform dropdown selection            | Updates guide content with tier-specific tips |
| TypeScript compilation                 | No TS2345 errors on Map.get() usage          |
| ESLint check                           | No unused import warnings                    |

---

## 16. Removed Features (Historical)

These features were removed as they added no value:

| Feature | Removed Date | Reason |
|---------|--------------|--------|
| Guide card difficulty badge | 16 Jan 2026 | Unnecessary metadata, visual clutter |
| Guide card read time | 16 Jan 2026 | Unnecessary metadata |
| Guide card section count | 16 Jan 2026 | Unnecessary metadata, internal detail |
| Guide detail difficulty badge | 16 Jan 2026 | Consistent with card removal |
| Guide detail read time | 16 Jan 2026 | Consistent with card removal |
| Guide detail section count | 16 Jan 2026 | Consistent with card removal |
| `difficultyColour` useMemo (guide-card) | 16 Jan 2026 | No longer needed after badge removal |
| `difficultyColour` useMemo (guide-detail-panel) | 16 Jan 2026 | No longer needed after badge removal |
| Unused `Link` import (homepage-grid) | 16 Jan 2026 | Component uses native `<a>` tags |

---

## Changelog

- **16 Jan 2026 (v1.1.0):** **LEARN PAGE GUIDE CARD CLEANUP** — Removed difficulty badges (beginner/intermediate/advanced), read time ("8 min read"), and section count ("3 sections") from guide cards (`guide-card.tsx`) and detail panels (`guide-detail-panel.tsx`). These metadata elements added visual clutter without providing meaningful value to users. Also removed the `difficultyColour` useMemo from both components. Guide cards now show: DNA helix bar, title, description, tags (up to 4), category label, platform tier tip (conditional), and "Read Guide →" CTA. **TYPESCRIPT FIX** — Fixed TS2345 error in `learn-filters.tsx` where `Map.get()` returns `string | undefined` but code expected `string | null`. Now uses explicit type conversion: `const foundId = platformNameToId.get(platformName); const platformId: string | null = foundId !== undefined ? foundId : null;`. **NAVIGATION FIX** — Added `prefetch={false}` to both Link components in learn-filters.tsx ("Explore Styles" and "Build with Platform") to ensure reliable client-side navigation. **ESLINT FIX** — Removed unused `Link` import from `homepage-grid.tsx` (component uses native `<a>` tags). Updated documentation routes from `/prompts/*` to `/studio/*`.

- **8 Jan 2026 (v1.0.0):** Initial document. Defines Prompt Intelligence architecture, data structures, scoring algorithm, integration plan, new pages, and build phases.
