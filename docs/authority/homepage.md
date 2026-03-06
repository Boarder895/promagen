# New Homepage — Authority Document

**Last updated:** 6 March 2026  
**Version:** 4.0.0  
**Owner:** Promagen  
**Status:** Implemented (all 7 build phases complete + Scene Starters v4.1 + Community Pulse v8.0 redesign)  
**Authority:** This document defines the new Promagen homepage layout, components, data flow, and build plan. It supersedes the homepage section of `ribbon-homepage.md` for the `/` route only.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Design Principles](#2-design-principles)
3. [Page Structure](#3-page-structure)
4. [Centre Column — Prompt of the Moment](#4-centre-column--prompt-of-the-moment)
5. [Left Column — Scene Starters Preview](#5-left-column--scene-starters-preview)
6. [Right Column — Community Pulse](#6-right-column--community-pulse)
7. [Like System](#7-like-system)
8. [Online Users by Country](#8-online-users-by-country)
9. [Navigation Changes](#9-navigation-changes)
10. [World Context Page](#10-world-context-page)
11. [Data Flow & API Routes](#11-data-flow--api-routes)
12. [File Locations](#12-file-locations)
13. [Styling & Compliance](#13-styling--compliance)
14. [Acceptance Criteria](#14-acceptance-criteria)
15. [Build Order](#15-build-order)
16. [Risk Mitigation](#16-risk-mitigation)
17. [Non-Regression Rule](#17-non-regression-rule)
18. [Related Documents](#18-related-documents)
19. [Changelog](#19-changelog)

---

## 1. Overview

The new homepage replaces the current financial-data-first layout with a prompt-first experience. A first-time visitor must understand what Promagen does within 3 seconds: **it builds intelligent image prompts for 42 AI platforms.**

The current homepage (ribbon, exchange rails, flag tooltips, financial data) moves to `/world-context` — renamed "World Context." The new `/` inherits the same three-column grid, Engine Bay, Mission Control, footer, and viewport-locked layout. The leaderboard table stays on both pages.

### What changes

| Element                                         | Current Homepage (`/`) | New Homepage (`/`)                                            |
| ----------------------------------------------- | ---------------------- | ------------------------------------------------------------- |
| Finance ribbon (FX, Commodities, Crypto)        | Visible                | **Removed**                                                   |
| Orange intro text paragraph                     | Visible                | **Removed**                                                   |
| Exchange rails (left + right)                   | 16 exchange cards      | **Replaced** — Scene Starters (left, exchange-card styled), Community Pulse (right) |
| "Promagen — Intelligent Prompt Builder" heading | Visible                | **Kept**                                                      |
| "42 AI Image Generators — Elo-Ranked" heading   | Visible                | **Kept**                                                      |
| AI Providers Leaderboard table                  | Visible                | **Kept**                                                      |
| Engine Bay                                      | Visible                | **Kept**                                                      |
| Mission Control                                 | Visible                | **Kept** (+ World Context button)                             |
| Prompt of the Moment showcase                   | —                      | **New**                                                       |
| Like buttons on prompts                         | —                      | **New**                                                       |
| Online users by country                         | —                      | **New** (conditional, threshold: 50)                          |

### What does NOT change

Engine Bay, Mission Control, leaderboard glow frame, leaderboard table, provider cells, footer, viewport-locked `100dvh` layout, `overflow-hidden` on body, all scroll behaviours, all existing pages other than `/`.

---

## 2. Design Principles

All principles from `code-standard.md` and `best-working-practice.md` apply. Specific emphasis for this build:

| Principle             | Application                                                                                                                                                                                                     |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Universal clamp()** | Every new component uses inline `clamp()` for all visible dimensions. Zero fixed `px`/`rem`. Zero Tailwind size classes for scalable elements.                                                                  |
| **Card-only design**  | All new containers are rounded cards matching existing `rounded-3xl bg-slate-950/70 ring-1 ring-white/10`.                                                                                                      |
| **SSOT-first**        | Prompt rotation uses existing 102-city SSOT from `city-vibes.json`. Scene data from `scene-starters.json`. Provider data from `providers.json`.                                                                 |
| **Demo-to-live**      | Community Pulse starts with 210 demo prompts (clearly distinguished via absent score badge). Real user prompts take over automatically as they flow in. Online users show demo counts until threshold. No fabricated engagement metrics.                                      |
| **No scope creep**    | This build changes the `/` route layout. It does not modify the prompt builder, vocabulary system, scoring engine, or any existing page except adding a "World Context" button to Mission Control on all pages. |
| **Viewport-locked**   | `h-dvh overflow-hidden` on body. All scrolling inside individual containers. No page-level scrollbar.                                                                                                           |
| **Accessibility**     | All interactive elements use `<button>` or `<a>`. Full keyboard navigation. ARIA labels. `prefers-reduced-motion` respected.                                                                                    |

---

## 3. Page Structure

### 3.1 Visual Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HEADER (Control Dock + Heading)                      │
│                    "Promagen — Intelligent Prompt Builder"                   │
├──────────────┬──────────────────────────────────────────┬───────────────────┤
│              │                                          │                   │
│  ENGINE BAY  │         PROMPT OF THE MOMENT             │  MISSION CONTROL  │
│              │  ┌────────────────────────────────────┐  │                   │
│  [Platform   │  │ Tokyo • 14:32 JST • Light Rain     │  │  [Location badge] │
│   icons]     │  │ Mood: Serene                        │  │  [Weather prompt] │
│              │  │                                    │  │                   │
│  [Dropdown]  │  │ ┌─ CLIP ──────────────── 📋 ────┐ │  │  Buttons:         │
│              │  │ │ neon-lit streets...           │ │  │  [World Context]  │
│  [Launch     │  │ │ Try: [SD] [Leo] [NightCafe]  │ │  │  [Studio]         │
│   Button]    │  │ ├─ Midjourney ──────────── 📋 ──┤ │  │  [Pro Promagen]   │
│              │  │ │ Tokyo rain --ar 16:9...       │ │  │                   │
│              │  │ │ Try: [MJ] [BlueWillow]       │ │  │  [Sign in]        │
│              │  │ ├─ Natural Language ──────── 📋 ─┤ │  │                   │
│              │  │ │ A rain-soaked Tokyo street... │ │  │                   │
│              │  │ │ Try: [DALL-E] [Firefly]      │ │  │                   │
│              │  │ ├─ Plain ──────────────── 📋 ───┤ │  │                   │
│              │  │ │ Tokyo rainy street, neon...   │ │  │                   │
│              │  │ │ Try: [Canva] [Artistly]      │ │  │                   │
│              │  │ └──────────────────────────────┘ │  │                   │
│              │  │                                    │  │                   │
│              │  │ 🇬🇧 12  🇺🇸 8  🇩🇪 4  ▾ (+6)       │  │                   │
│              │  └────────────────────────────────────┘  │                   │
│              │                                          │                   │
├──────────────┼──────────────────────────────────────────┼───────────────────┤
│              │                                          │                   │
│  SCENE       │  42 AI Image Generators — Elo-Ranked     │  COMMUNITY        │
│  STARTERS    │  by the Community                        │  PULSE            │
│  (exchange-  │  Click ▼ Provider to expand              │                   │
│  card style) │                                          │                   │
│              │  ┌──────────────────────────────────────┐│  "93-score MJ     │
│  ● 🎭 Drama-│  │                                      ││   prompt built    │
│  tic Portrait│  │     AI PROVIDERS LEADERBOARD         ││   2 min ago"      │
│  ───────────-│  │                                      ││  ♡ 12             │
│  👤 Portraits│  │     (scrollable, same as current)    ││                   │
│  7 cat · vibe│  │                                      ││  "87-score DALL-E │
│              │  │                                      ││   prompt built    │
│  ● ⚔️ Fantasy│  │                                      ││   5 min ago"      │
│  Hero        │  │                                      ││  ♡ 7              │
│  ───────────-│  │                                      ││                   │
│  👤 Portraits│  │                                      ││  "91-score Flux   │
│  5 cat · vibe│  │                                      ││   prompt built    │
│              │  │                                      ││   8 min ago"      │
│  (8 cards per│  │                                      ││  ♡ 3              │
│   batch,     │  │                                      ││                   │
│   rotates    │  └──────────────────────────────────────┘│                   │
│   5 min)     │                                          │                   │
│              │                                          │                   │
├──────────────┼──────────────────────────────────────────┼───────────────────┤
│              │             FOOTER                        │                   │
└──────────────┴──────────────────────────────────────────┴───────────────────┘
```

### 3.2 Grid Structure

The three-column grid from `homepage-grid.tsx` is preserved exactly:

```
Left rail:     0.9fr  → Scene Starters preview
Centre column: 2.2fr  → Prompt of the Moment + Leaderboard heading + Providers table
Right rail:    0.9fr  → Community Pulse
```

**Tailwind class:** `md:grid-cols-[minmax(0,0.9fr)_minmax(0,2.2fr)_minmax(0,0.9fr)]`

Panel width formula (unchanged): `calc((100vw - 80px) * 0.225)` for Engine Bay and Mission Control.

Grid gap constant (unchanged): `GRID_GAP = clamp(12px, 1.25vw, 24px)`.

### 3.3 Centre Column Vertical Stack

The centre column stacks top-to-bottom:

```
1. Prompt of the Moment card          (new — replaces finance ribbon)
2. "42 AI Image Generators" heading   (existing LeaderboardIntro)
3. AI Providers Leaderboard table     (existing)
```

The finance ribbon, orange intro text paragraph, and exchange list content are **not rendered** on the new homepage. They remain on `/world-context`.

---

## 4. Centre Column — Prompt of the Moment

### 4.1 Purpose

Answers "what does Promagen do?" in under 2 seconds. Displays a live, weather-driven prompt for a real city, generated in all 4 tiers, with copy buttons and "Try in" provider shortcuts.

### 4.2 Data Source

Reuses the existing weather prompt engine (`src/lib/weather/` — 28 files, ~10,800 lines total, with `weather-prompt-generator.ts` at 486 lines as the entry point). No new API spend. The generator produces 4-tier prompts from live weather data for 102 cities × 10 venues.

**Rotation:** A new city prompt is generated every 10 minutes, cycling through all 102 cities in `city-vibes.json` SSOT order. Full rotation completes in 102 × 10 min = 17 hours, then restarts. The rotation is **deterministic** — `Math.floor(Date.now() / ROTATION_MS) % 102` — so all users see the same city at the same time without any server-side state. Server restarts have no effect.

**Inputs per cycle:**

| Input   | Source                                                      | Notes                                   |
| ------- | ----------------------------------------------------------- | --------------------------------------- |
| City    | `city-vibes.json` SSOT order, pointer advances every 10 min | 102 cities                              |
| Weather | Gateway `/weather` endpoint (existing, live)                | Temperature, humidity, wind, conditions |
| Venue   | `getCityVenue(city, seed)` from `vocabulary-loaders.ts`     | 10 venues per city, seeded rotation     |
| Time    | Server UTC → city local time via timezone offset            | Determines time-of-day mood + lighting  |
| Season  | Derived from month + hemisphere                             | Influences atmosphere vocabulary        |

**Output per cycle:**

```typescript
interface PromptOfTheMoment {
  city: string;                    // "Tokyo"
  countryCode: string;             // "JP"
  localTime: string;               // "14:32 JST"
  conditions: string;              // "Light Rain"
  mood: string;                    // "Serene"
  venue: string;                   // "Shibuya Crossing" (from categoryMap.meta.venue)
  prompts: {
    tier1: string;                 // CLIP-based
    tier2: string;                 // Midjourney
    tier3: string;                 // Natural Language
    tier4: string;                 // Plain Language
  };
  tierProviders: {
    tier1: ProviderShortcut[];     // Top providers for this tier
    tier2: ProviderShortcut[];
    tier3: ProviderShortcut[];
    tier4: ProviderShortcut[];
  };
  generatedAt: string;             // ISO timestamp
  nextRotationAt: string;          // ISO timestamp (current slot + 10 min)
  rotationIndex: number;           // 0–101
  weather: { ... };                // Full weather data for tooltip (see types/homepage.ts)
  tierSelections?: {               // Phase D: WeatherCategoryMap per tier for builder pre-fill
    tier1: { promptText: string; selections: Record<string, string[]>; categoryMap?: WeatherCategoryMap };
    tier2: { promptText: string; selections: Record<string, string[]>; categoryMap?: WeatherCategoryMap };
    tier3: { promptText: string; selections: Record<string, string[]>; categoryMap?: WeatherCategoryMap };
    tier4: { promptText: string; selections: Record<string, string[]>; categoryMap?: WeatherCategoryMap };
  };
  inspiredBy?: {                   // Phase D: Badge metadata for builder
    city: string;
    venue: string;
    conditions: string;
    emoji: string;
    tempC: number | null;
    localTime: string;
    mood: string;
    categoryMapHash?: string;      // FNV-1a hash via hashCategoryMap()
  };
}

interface ProviderShortcut {
  id: string;                      // "leonardo"
  name: string;                    // "Leonardo AI"
  iconPath: string;                // "/icons/providers/leonardo.png"
}
```

**Full type definitions:** `src/types/homepage.ts` (229 lines) — canonical source for all homepage interfaces including `PromptOfTheMoment`, `CommunityPulseEntry`, `LikeRequest`, `OnlineCountryEntry`, and `ScenePreviewCard`.

### 4.3 API Route

**Endpoint:** `GET /api/homepage/prompt-of-the-moment`

**Behaviour:**

1. Compute rotation index: `Math.floor(Date.now() / ROTATION_MS) % 102`
2. Look up city from `city-vibes.json` at that index
3. Compute venue rotation: `Math.floor(Date.now() / ROTATION_MS / 102)` (cycles venues across full city rotations)
4. Fetch weather for that city from gateway cache (no additional API call — uses existing cached data)
5. Call `generateWeatherPrompt()` for all 4 tiers
6. Extract `categoryMap` from first tier result (shared across all tiers — same weather intelligence)
7. Use `categoryMap.meta.venue` as authoritative venue name (venue desync fix)
8. Look up top providers per tier from `PLATFORM_TIERS` + `providers.json` SSOT
9. Return `PromptOfTheMoment` JSON with `tierSelections` and `inspiredBy`
10. Cache response with `revalidate: 600` (10-minute ISR aligned to rotation cadence)
11. Auto-log rotation as `prompt_showcase_entries` row for Community Pulse feed (once per rotation index, tracked in-memory)

**No server state required.** Rotation is deterministic — `floor(now / 600000) % 102` produces the same city index on any server instance at any time. Server restarts have zero effect.

**Fallback:** If weather data is unavailable for the current city, use demo weather data (`15°C, partly cloudy, 10 km/h wind`). If the generator throws, serve the last successfully generated prompt. The component must never show an error state — always show a prompt.

### 4.4 Component: `PromptShowcase`

**File:** `src/components/home/prompt-showcase.tsx`

**Visual design:**

```
┌─ PROMPT OF THE MOMENT ──────────────────────────────────────────┐
│                                                                   │
│  🇯🇵  Tokyo • Shibuya Crossing • 14:32                            │
│  Light Rain                                                       │
│  Live weather prompt · next city in 8:32                          │
│                                                                   │
│  ┌─ CLIP-Based (Tier 1) ──────────────────── 📋  ♡ 23 ┐         │
│  │ neon-lit streets, rain-slicked pavement, (cinematic   │        │
│  │ lighting:1.2), tokyo signage, reflections on wet...   │        │
│  │                                                       │        │
│  │ Try in: [SD] [Leonardo] [NightCafe]                   │        │
│  └───────────────────────────────────────────────────────┘        │
│                                                                   │
│  ┌─ Midjourney (Tier 2) ──────────────────── 📋  ♡ 41 ┐         │
│  │ Tokyo rain district, neon reflections, cinematic      │         │
│  │ --ar 16:9 --style raw --v 6.1                         │         │
│  │                                                       │         │
│  │ Try in: [MJ] [BlueWillow]                             │         │
│  └───────────────────────────────────────────────────────┘         │
│                                                                   │
│  ┌─ Natural Language (Tier 3) ────────────── 📋  ♡ 8 ┐          │
│  │ A rain-soaked Tokyo street at twilight, neon signs    │          │
│  │ casting coloured reflections across wet pavement...   │          │
│  │                                                       │          │
│  │ Try in: [DALL-E] [Firefly] [Ideogram]                 │          │
│  └───────────────────────────────────────────────────────┘          │
│                                                                   │
│  ┌─ Plain Language (Tier 4) ────────────────── 📋  ♡ 5 ┐        │
│  │ Tokyo rainy street at night, neon lights               │        │
│  │                                                       │        │
│  │ Try in: [Canva] [Artistly] [Craiyon]                  │        │
│  └───────────────────────────────────────────────────────┘        │
│                                                                   │
│  🇬🇧 12  🇺🇸 8  🇩🇪 4  ▾ (+6 countries)                          │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

**Card styling:** `rounded-3xl bg-slate-950/70 ring-1 ring-white/10` (matches all existing cards).

**Tier prompt cards (inner):** `rounded-xl bg-slate-900/60 ring-1 ring-white/5` — lighter inner cards, consistent with card-within-card pattern.

**Tier label colours:**

| Tier   | Label            | Colour             | Ring Colour           | Dot Colour |
| ------ | ---------------- | ------------------ | --------------------- | ---------- |
| Tier 1 | CLIP-Based       | `text-violet-400`  | `ring-violet-500/20`  | `#8B5CF6`  |
| Tier 2 | Midjourney       | `text-blue-400`    | `ring-blue-500/20`    | `#3B82F6`  |
| Tier 3 | Natural Language | `text-emerald-400` | `ring-emerald-500/20` | `#10B981`  |
| Tier 4 | Plain Language   | `text-amber-400`   | `ring-amber-500/20`   | `#F59E0B`  |

These colours are informational — Tier 1 uses violet (not cyan) because it matches the CLIP-weight visual language in the prompt builder.

**Copy button (📋):** Same clipboard icon and behaviour as `weather-prompt-tooltip.tsx`. On click: copies tier prompt to clipboard, shows brief "Copied!" feedback (1.5s) with `bg-emerald-500/20 text-emerald-400`, then reverts.

**Like button (♡):** Small heart icon, right of copy button. `text-slate-400` default, `text-pink-400` when liked, `hover:text-pink-300`. See §7 for full specification.

**"Try in" provider icons:** 2-4 small provider PNG icons (`/icons/providers/{id}.png`) per tier, inline below the prompt text. Each icon is clickable — navigates to that provider's prompt builder with the prompt pre-loaded (see §4.5). Icon container: `rounded-lg bg-white/15 ring-1 ring-white/10 hover:bg-white/20 hover:ring-white/20`. Image inside: `drop-shadow(0 0 3px rgba(255,255,255,0.4))` for glow visibility on dark backgrounds.

**Prompt text styling:** `font-mono leading-relaxed text-slate-300` using `clamp()` font sizing. Prompt text is selectable but not editable.

**Countdown timer:** Below the city header, an amber italic line shows `"Live weather prompt · next city in M:SS"` with a live countdown (tabular-nums for stable digit widths). The countdown auto-refreshes every second and triggers a new API fetch when it reaches zero.

**Metadata line:** City header shows: `Flag · CityName · Venue · HH:MM` (blinking colon, no timezone suffix, no mood text). Weather emoji appears with hover tooltip (same `ProviderWeatherEmojiTooltip` as leaderboard). Conditions text (e.g., "Light Rain") on a separate line below.

**Rotation transition:** When the city changes (every 10 min), the card content crossfades (`opacity 0 → 1`, 800ms ease-in-out). No layout shift — container dimensions are fixed. Respects `prefers-reduced-motion`. Previous city data held for 800ms overlay during transition (managed by `usePromptShowcase` hook).

**Table expand behaviour:** When the AI Providers Leaderboard is expanded (isTableExpanded), the PromptShowcase and LeaderboardIntro are both hidden to give the table maximum vertical space.

**Skeleton loader:** Pulse-animated placeholder with fixed min-height (`clamp(180px, 18vw, 300px)`) — prevents CLS during initial load.

### 4.5 "Try in [Provider]" Mechanic

**Flow:** User clicks a provider icon in the Prompt of the Moment → navigate to `/providers/[id]` (the prompt builder page).

**Prompt pre-loading via `sessionStorage` (Phase D — WeatherCategoryMap):**

1. On icon click, store the tier's full payload under `sessionStorage` key: `promagen:preloaded-payload`
2. Store the "Inspired by" badge metadata under: `promagen:preloaded-inspiredBy`
3. Navigate to `/providers/[id]`
4. On mount, the prompt builder reads both sessionStorage keys
5. If found: populate ALL 12 category dropdowns from the `categoryMap` data (not just the text output), show an "Inspired by [City] · [Venue]" badge
6. Clear both sessionStorage keys immediately after reading

**Payload shape (`promagen:preloaded-payload`):**

```typescript
{
  promptText: string;                           // Assembled prompt text for this tier
  selections: Record<string, string[]>;         // Legacy (empty object — superseded by categoryMap)
  categoryMap?: WeatherCategoryMap;             // Full 12-category structured data from weather intelligence
}
```

**Inspired-by shape (`promagen:preloaded-inspiredBy`):**

```typescript
{
  city: string;                 // e.g., "Tokyo"
  venue: string;                // e.g., "Shibuya Crossing" (from categoryMap.meta, not route rotation)
  conditions: string;           // e.g., "Light Rain"
  emoji: string;                // Weather emoji
  tempC: number | null;         // Temperature in Celsius
  localTime: string;            // e.g., "14:32"
  mood: string;                 // e.g., "Serene"
  categoryMapHash?: string;     // FNV-1a hash via hashCategoryMap() — for fingerprint matching
}
```

**Why sessionStorage, not URL params:** Prompts can exceed 300 characters and the WeatherCategoryMap payload is typically 2-5 KB. URL encoding creates ugly, unshareable links and risks hitting URL length limits. SessionStorage is invisible, one-time-use, and handles any length.

**Why categoryMap, not raw text:** Phase D resolved the "dead prompt" problem. Previously, clicking "Try in" would dump assembled text into the prompt builder with empty dropdowns — users couldn't edit individual categories. Now the full `WeatherCategoryMap` (with selections, customValues, and weightOverrides per category) flows through, so the builder pre-fills all 12 dropdowns with real physics-computed data. The user can then tweak individual categories (e.g., swap the camera lens) and re-assemble.

**Venue desync fix (Phase D):** The route selects a venue by index rotation, but the weather generator selects a venue by seed (they can disagree). The response now uses `categoryMap.meta.venue` as the authoritative venue name, ensuring the header label and the generated prompt describe the same location.

### 4.6 Provider Selection for Scene Starters vs Prompt of the Moment

**Prompt of the Moment "Try in" icons:** No provider selection required — the icons are shown inline per tier. User clicks one and goes directly.

**Scene Starters (left rail):** Requires a provider to navigate to the prompt builder. See §5.4 for the full flow.

---

## 5. Left Column — Scene Starters Preview

### 5.1 Purpose

Shows creative possibilities. Answers "what can I build?" and gives instant action from the homepage. Replaces the left exchange rail.

### 5.2 Data Source

Existing `scene-starters.json` SSOT: 200 scenes (25 free, 175 Pro) across 23 worlds. Only the 25 free scenes are displayed on the homepage. No new data files.

### 5.3 Component: `SceneStartersPreview` (v4.1.0)

**File:** `src/components/home/scene-starters-preview.tsx` (585 lines)

**Visual design — v4.1.0 layout (top to bottom):**

```
┌──────────────────────────────────────────────────────────┐
│               ● Scene Starters                           │  ← centred, gradient (sky→emerald→indigo)
│                                                          │
│       Click a scene to start building.                   │  ← amber italic, pulsing (2s cycle)
│     OR: Select a platform above to unlock scenes.        │  ← shown when no provider selected
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌────────────────────────────────────────────────┐      │
│  │ ● 🎭  Dramatic Portrait              → Flux   │      │  ← card 1 glows first (3s on)
│  │   👤 Portraits & People                        │      │
│  │─────────────────────────────────────────────── │      │
│  │   Chiaroscuro shadow play                      │      │
│  └────────────────────────────────────────────────┘      │
│                                                          │  ← 1s dark gap
│  ┌────────────────────────────────────────────────┐      │
│  │ ● ⚔️  Fantasy Hero                        →   │      │  ← card 2 glows next (3s on)
│  │   👤 Portraits & People                        │      │
│  │─────────────────────────────────────────────── │      │
│  │   Shafts of amber light through canopy         │      │
│  └────────────────────────────────────────────────┘      │
│                                                          │
│  ... (cards 3–8, each takes its turn in the cascade)     │
│                                                          │
├──────────────────────────────────────────────────────────┤
│  [icon] Ranked 4th for Image Quality    25 free · 175 Pro│  ← footer row
└──────────────────────────────────────────────────────────┘
```

**Cards are structurally identical to `exchange-card.tsx`:**

| Exchange Card Element | Scene Card Equivalent | Shared Code Pattern |
| --------------------- | --------------------- | ------------------- |
| Snap-fit font (12–20px via ResizeObserver × 0.042) | Same 3 constants, same ResizeObserver | `MIN_FONT=12, MAX_FONT=20, FONT_SCALE=0.042` |
| Top row padding `px-4 py-1` | Same padding class | Tailwind `px-4 py-1` |
| Exchange name `0.90em` | Scene name `0.90em` | `style={{ fontSize: '0.90em' }}` |
| City + Flag `0.75em` + `mt-1` | World emoji + label `0.75em` + `mt-1` | Same spacing and size |
| Horizontal divider `border-t border-white/5` | Same divider | Identical class |
| Index quote row `px-4 py-1` | Vibe phrase row | Same padding |
| Dual radial glow (top + bottom) | Same glow overlays | Same `radial-gradient` patterns |
| Border + boxShadow on hover | Same glow treatment (+ cascade glow) | Same shadow string format |
| Card gap `space-y-3` | Same gap | Shared from parent scroll container |

**Scene card content (v4.1.0):**

| Row | Element | Source | Styling |
| --- | ------- | ------ | ------- |
| Top | Tier dot | `getBestTier()` → tier 1–4 | Coloured dot (cyan/violet/emerald/amber) with `box-shadow` glow |
| Top | Emoji | `scene.emoji` | `0.90em` |
| Top | Scene name | `scene.name` | `0.90em`, `text-slate-100`, truncate |
| Top | Arrow | Static `→` or `→ {providerName}` on hover | `0.75em`, white at rest, cyan (`#22D3EE`) on hover. Shows provider name on hover when provider selected (e.g., "→ Flux"). Truncated at `6em`. |
| Top | World label | `WORLD_BY_SLUG.get(scene.world)` | `0.75em`, `text-slate-400`, `mt-1` |
| Divider | — | — | `border-t border-white/5` |
| Bottom | Vibe phrase | First phrase from `scene.flavourPhrases`, first letter uppercased | `0.75em`, italic, `text-white/60`, truncate. Category count removed in v3.2.0. |

**Tier dot colours:**

| Tier | Colour | Hex |
| ---- | ------ | --- |
| 1 (CLIP) | Cyan | `#22D3EE` |
| 2 (Midjourney) | Violet | `#A78BFA` |
| 3 (Natural Language) | Emerald | `#34D399` |
| 4 (Plain) | Amber | `#FBBF24` |

**Heading:** "Scene Starters" (title case, not all-caps). Uses gradient text matching the leaderboard heading in `homepage-grid.tsx`: `bg-gradient-to-r from-sky-400 via-emerald-300 to-indigo-400 bg-clip-text text-transparent`. Font size: `clamp(0.65rem, 0.9vw, 1.2rem)`, `font-semibold`. Centred.

**Subtitle:** Two states controlled by `hasProvider`:
- Provider selected: "Click a scene to start building." (6 words)
- No provider: "Select a platform above to unlock scenes."
- Styled: `italic text-amber-400/80`, pulsing animation matching mission-control (`2s cubic-bezier(0.4, 0, 0.6, 1) infinite`, opacity 1→0.5→1). Animation defined inline via `<style dangerouslySetInnerHTML>`, not in globals.css.

**Cascading glow cycle (v4.1.0):**

Each card takes its turn glowing in a continuous cascade:
1. Card 1 glows for 3 seconds (uses existing tier-coloured glow system: `glowRgba`, `glowBorder`, `glowSoft`)
2. Glow fades out over 600ms (CSS transition on `border-color` and `box-shadow`)
3. 1 second dark pause
4. Card 2 glows for 3 seconds → off → 1 second → Card 3... through all 8 cards
5. After card 8 → back to card 1, infinite loop (32-second full cycle)

Implementation: Parent owns `activeGlowIndex` (0–7) and `glowOn` (boolean). One `useEffect` with two `setTimeout` calls drives the cycle. Card receives `isGlowActive={glowOn && index === activeGlowIndex}`. Hover always wins — if the user hovers any card, it glows regardless of the cascade position. Glow resets to card 0 when the 5-minute batch rotates.

**Footer row:** Below the last card. `flex justify-between`:
- Left: Provider icon (Engine Bay size, `clamp(36px, 3vw, 48px)`) + "Ranked {ordinal} for Image Quality" (plain text, not clickable). Dynamic from `selectedProvider.imageQualityRank`. Only shown when provider selected.
- Right: "25 free · 175 Pro" in `text-emerald-400` (Tier 3 green). Clickable `<button>`. Navigates to `/providers/{id}` with no scene pre-loaded (removes `promagen:preloaded-scene` from sessionStorage, so prompt builder opens with empty dropdowns). No provider selected → nudges Engine Bay.

**Rotation:** 8 free scenes per batch. 25 free scenes ÷ 8 = 3 full batches (24 scenes shown, 25th excluded). Auto-rotates every 5 minutes with 300ms crossfade. Batches draw from free scenes in SSOT order. Cascading glow resets to card 0 on batch change.

**No Pro scenes displayed:** Only free scenes appear on the homepage. Pro scenes are accessible via the full Scene Selector inside the prompt builder.

**No provider selector UI:** Engine Bay (directly above in the left column) handles all provider selection. See §5.4.

**No opacity dimming:** Cards are always at full brightness regardless of provider selection state. Per `code-standard.md` § 6.0.3, opacity dimming is banned for state indication on dark backgrounds.

**Text colour rules:** No `text-slate-500` or `text-slate-600` anywhere. Dimmest text: `text-slate-400` for world labels, `text-white/60` for vibe phrases. Per `code-standard.md` § 6.0.2.

**Minimum font size:** 9px floor. All `clamp()` minimums ≥ `0.5625rem`. Em-based sizes never below `0.75em` at the 12px snap-fit base. Per `code-standard.md` § 6.0.1.

**Container:** `space-y-3` gap (matches exchange rail), `overflow-y: auto` with standard scrollbar styling.

### 5.4 Provider Routing on Scene Click

**Architecture:** Engine Bay owns provider selection state. The homepage parent (`new-homepage-client.tsx`) holds `selectedProvider` in React state, persists it to `localStorage('promagen:homepage-provider')`, and passes it down to both Engine Bay (controlled mode) and SceneStartersPreview.

**Click flow — scene card:**

1. **Provider selected in Engine Bay:** Scene click reads `selectedProvider.id` from prop → stores scene ID in `sessionStorage('promagen:preloaded-scene')` → navigates to `/providers/${id}` (the provider detail page with prompt builder).
2. **No provider selected:** Scene click calls `onNudgeProvider()` → parent focuses the Engine Bay dropdown input → Combobox opens automatically. User picks a provider, then clicks scene again.

**Click flow — "25 free · 175 Pro" footer button:**

1. **Provider selected:** Removes `promagen:preloaded-scene` from sessionStorage → navigates to `/providers/${id}`. Prompt builder opens with all dropdowns empty (no scene pre-loaded). User builds from scratch.
2. **No provider selected:** Same nudge behaviour — focuses Engine Bay dropdown.

**No default provider.** State starts as `null`. No "midjourney" fallback, no "flux" default. User must actively choose.

**Provider persistence:** `handleProviderChange` in `new-homepage-client.tsx` saves provider ID to `localStorage('promagen:homepage-provider')`. On mount, `useEffect` restores the saved provider. Navigating away and returning → provider still selected.

**Navigation URL:** Always `/providers/${encodeURIComponent(id)}`. **Never** `/providers/${id}/prompt-builder` — that route is deprecated and redirects incorrectly.

**Scene pre-loading via `sessionStorage`:**

1. On scene card click, store the scene ID: `sessionStorage.setItem('promagen:preloaded-scene', sceneId)`
2. Navigate to `/providers/${id}`
3. On mount, the prompt builder checks for `promagen:preloaded-scene`
4. If found: populates dropdowns via `prefills` from SSOT, sets `preloadedSceneId`
5. `preloadedSceneId` passed to SceneSelector as `initialSceneId` → SceneSelector auto-expands and navigates to the scene's world
6. sessionStorage key cleared immediately after reading

**SceneSelector auto-expand (v3.0.0):**

`scene-selector.tsx` accepts a new `initialSceneId` prop. When set:
- `isExpanded` → `true` (accordion opens)
- `activeWorldSlug` → the scene's world slug
- `activeSceneId` → the scene ID

This ensures the user sees which world and scene they came from (e.g., "Portraits & People" with "Dramatic Portrait" highlighted).

### 5.5 Test Coverage

**File:** `src/__tests__/scene-starters-homepage.test.ts` — 31 test cases across 8 groups covering batching, data quality, navigation URLs, storage keys, SceneSelector contract, exchange-card parity, no hardcoded defaults, and icon path sanitisation.

---

## 6. Right Column — Community Pulse

### 6.1 Purpose

Social proof that Promagen is alive and active. Answers "is anyone using this?" and "what are people building?" Replaces the right exchange rail. Structurally mirrors Scene Starters (left rail) for visual symmetry.

### 6.2 Data Source

**Demo prompts (pre-user-traffic):** 210 pre-generated prompts stored in `src/data/community-pulse/demo-prompts.json`. 5 prompts per platform across all 42 platforms. Each prompt is assembled and optimised for its specific platform format (T1 CLIP weights, T2 Midjourney params, T3 Natural Language sentences, T4 Plain Language). Prompts built from real vocabulary files — coherent visual scenes, not random term combinations. Every prompt fills 85-99% of its platform's `idealMax` character budget.

**Demo prompt structure per tier:**
- **Tier 1 CLIP:** `masterpiece, best quality, highly detailed, (subject:1.2), style, lighting, colour, composition, sharp focus, 8K, intricate textures`
- **Tier 2 Midjourney:** `subject, style, lighting, colour, composition, high quality, detailed --ar 16:9 --v 6 --s 500 --no blur, watermark, text`
- **Tier 3 Natural Language:** `A subject in style style. with lighting. Atmosphere. Set in environment. Rendered in colour. Composed with composition. Fidelity.`
- **Tier 4 Plain:** `subject, style, lighting, colour, atmosphere`

**Live user prompts (post-traffic):** When a user copies an optimised prompt in the prompt builder, the builder POSTs to `/api/homepage/community-pulse` fire-and-forget. The entry is stored with `source = 'user'` in `prompt_showcase_entries`. The `useCommunityPulse` hook polls every 30 seconds. User entries push demo entries out of the top 6 card slots automatically.

**Merge logic:** User entries (`source === 'user'`) fill the top card slots (up to 6). Remaining slots are filled by demo prompts from the 30-minute rotation. When all 6 slots are real users, zero demos are shown. When zero real users exist, full demo rotation (current behaviour).

**Generator script:** `scripts/generate-demo-prompts.ts` — run via `npx tsx scripts/generate-demo-prompts.ts` to regenerate prompts through the real One Brain pipeline (`assemblePrompt` + `optimizePromptGoldStandard` per platform).

### 6.3 Component: `CommunityPulse` (v8.0.0)

**File:** `src/components/home/community-pulse.tsx` (781 lines)

**Visual design — v8.0.0 layout (top to bottom):**

```
+----------------------------------------------------------+
|               * Community Pulse                           |  <- centred, gradient (sky->emerald->indigo)
|                                                          |
|         The most popular prompts                         |  <- amber italic, pulsing (2s cycle)
+----------------------------------------------------------+
|                                                          |
|  +----------------------------------------------------+  |
|  | [MJ icon] Midjourney          87/100       heart 12 |  |  <- LINE 1: icon + name + score (live only) + heart
|  | Neon samurai in rain-soaked Tokyo alley              |  |  <- LINE 2: description, italic, uppercase first
|  | Created in [flag]  at  14:32                        |  |  <- LINE 3: flag + mono clock
|  +----------------------------------------------------+  |
|                                                          |
|  +----------------------------------------------------+  |
|  | [Flux icon] Flux              heart 31              |  |  <- demo card (no score)
|  | Golden hour vineyard with morning mist              |  |
|  | Created in [flag]  at  09:17                        |  |
|  +----------------------------------------------------+  |
|                                                          |
|  ... (6 user prompt cards total)                         |
|                                                          |
|  +----------------------------------------------------+  |
|  | earth  500 Online                                   |  |  <- online users card 1 (cyan glow)
|  | [US] 87  [GB] 62  [IN] 55  [DE] 42  ...           |  |
|  +----------------------------------------------------+  |
|                                                          |
|  +----------------------------------------------------+  |
|  | flag  16 Countries                                  |  |  <- online users card 2 (cyan glow)
|  | [BR] 22  [KR] 19  [NL] 17  [SG] 15  ...           |  |
|  +----------------------------------------------------+  |
|                                                          |
+----------------------------------------------------------+
|  * Live                         500 users * 16 countries |  <- footer
+----------------------------------------------------------+
```

**Card layout — 3 equal rows, no horizontal divider:**

Each user prompt card has a fixed height of `clamp(74px, 6.2vw, 104px)` (same as scene cards). The interior uses `flex h-full flex-col justify-between` with `height: '33.333%'` on each row — guaranteeing equal vertical distribution regardless of content height.

| Row | Element | Source | Styling |
| --- | ------- | ------ | ------- |
| Line 1 | Platform icon | `/icons/providers/{id}.png` | `clamp(14px, 1.2vw, 20px)` square, `object-contain`, drop-shadow glow |
| Line 1 | Platform name | `entry.platformName` | `0.90em`, `text-slate-100`, font-medium, truncate |
| Line 1 | Score (live only) | `entry.score` | `0.85em`, `text-white`, tabular-nums. Format: `87/100`. Hidden for demo entries (`isLive === false`) |
| Line 1 | Like heart | `entry.likeCount` | `0.85em`, `text-pink-400`. `heart` filled when > 0, `heart-outline` when 0. Count in `text-emerald-400` |
| Line 2 | Description | `entry.description` (subject + style) | `0.75em`, italic, `text-slate-300`, truncate. First letter uppercased via `charAt(0).toUpperCase()` |
| Line 3 | "Created in" | Static text | `0.68em`, `text-slate-400` |
| Line 3 | Country flag | `entry.countryCode` | `clamp(18px, 1.5vw, 24px)` x `clamp(14px, 1.1vw, 18px)` — same size as online users / leaderboard. `marginLeft` + `marginRight`: `clamp(9px, 0.9vw, 15px)` (3x standard gap). Hover triggers tooltip |
| Line 3 | "at" | Static text | `0.68em`, `text-slate-400` |
| Line 3 | Time | `entry.localTime` (HH:MM) | Mono font (`SF Mono, Consolas`), `text-slate-200`, visible colon (`fontWeight: 600`, `width: 0.6ch`). Gap before time: `clamp(6px, 0.6vw, 10px)` |

**Per-card brand colour glow (same pattern as Scene Starters tier dot colour):**

Each card derives its glow colour from `PLATFORM_COLORS[platformId]`. The glow system is identical to scene-starters: `hexToRgba(brandColor, 0.3)` for `glowRgba`, `0.5` for `glowBorder`, `0.15` for `glowSoft`. Top + bottom radial gradients, 600ms transition.

| Platform | Brand Colour | Glow |
| --- | --- | --- |
| Midjourney | `#7C3AED` | Violet |
| Flux | `#F97316` | Orange |
| Leonardo | `#EC4899` | Pink |
| DALL-E (openai) | `#10B981` | Emerald |
| Stability | `#8B5CF6` | Violet |
| Ideogram | `#06B6D4` | Cyan |
| (42 platforms total — see `PLATFORM_COLORS` map in component) | | |

**Flag hover tooltip (portal-based):**

Hovering the country flag opens a portal tooltip showing the full optimised prompt for that platform. Matches the weather-prompt-tooltip.tsx pattern exactly:
- Portal to `document.body` (escapes all containers)
- 400ms close delay with `clearCloseTimeout`/`startCloseDelay` pattern
- Both trigger AND tooltip have `onMouseEnter`/`onMouseLeave` handlers
- Styled: `rounded-xl px-6 py-4`, `rgba(15, 23, 42, 0.97)` background
- Ethereal glow overlays from platform brand colour
- "Image Prompt" heading + platform name subheading + copy button
- Width: 450px, `zIndex: 99999`
- Position: opens LEFT from right rail (`rect.left - TOOLTIP_WIDTH - TOOLTIP_GAP`)

**`isLive` flag — demo vs real distinction:**

Every card carries an `isLive: boolean` field. Demo entries = `false`, API entries = `true`. The score (`87/100`) only renders when `isLive` is true. This provides instant visual confirmation of whether real user data is flowing.

**Heading:** "Community Pulse" (title case). Centred. Gradient text matching scene-starters (`sky-400 -> emerald-300 -> indigo-400`). Font size `clamp(0.65rem, 0.9vw, 1.2rem)`, `font-semibold`. Pulsing green dot to the left.

**Subtitle:** "The most popular prompts" — amber italic, pulsing animation matching scene-starters (`2s cubic-bezier`). Inline `<style>`, no globals.

**Cascading glow cycle:** Same timing as scene-starters — 3s on, 1s dark, next card, infinite loop through all 8 cards (6 user prompt + 2 online user). Parent-controlled via `activeGlowIndex` + `glowOn` state.

**30-minute demo rotation:** `Math.floor(Date.now() / ROTATION_MS)` where `ROTATION_MS = 30 * 60 * 1000`. Deterministic — same prompts shown to all users at the same time. Checked every 60 seconds via `setInterval`.

**Bottom 2 cards — Online users:**

Two cards with cyan glow (`#22D3EE`):
- Card 7: "500 Online" header + top 8 country flags with counts
- Card 8: "16 Countries" header + remaining 8 country flags with counts
- Each flag: `clamp(18px, 1.5vw, 24px)` x `clamp(14px, 1.1vw, 18px)`, with count in `tabular-nums font-medium text-slate-300`
- Currently demo data (500 users, 16 countries). Will be replaced with live heartbeat data when concurrent users reach threshold.

**Footer row:** `flex justify-between`:
- Left: Green pulsing dot + "Live" in `text-emerald-400`
- Right: "500 users . 16 countries" in `text-emerald-400`

**No props required:** `<CommunityPulse />` in `new-homepage-client.tsx` — no `selectedProvider` needed. Demo prompts are pre-optimised per platform. Live entries carry their own platform context.

**No horizontal divider:** Cards use 3 equal-height rows with no `border-t` between them. Content is separated by the row structure itself.

**No slate-500/slate-600:** Dimmest text is `text-slate-400` for "Created in" and "at" labels. Per `code-standard.md` section 6.0.2.

### 6.4 API Routes

**GET /api/homepage/community-pulse**

Returns the 20 most recent pulse entries from `prompt_showcase_entries`, plus the single "most liked today" entry. Queries include `prompt_text` for tooltip display. 30-second SWR cache.

**POST /api/homepage/community-pulse**

Logs a user-created prompt to the Community Pulse feed. Called fire-and-forget by `prompt-builder.tsx` after copy. Validates input, sanitises (platformId max 100 chars, promptText max 2000, description max 60, countryCode max 2, score 0-100). INSERTs with `source = 'user'`. Returns new entry ID.

```typescript
// POST body
interface PostBody {
  platformId: string;
  platformName: string;
  tier: string;
  promptText: string;
  description: string;  // Subject + style from selections, max 60 chars
  score: number;        // healthScore from prompt analysis
  countryCode: string;  // From locationInfo via usePromagenAuth
}
```

**CommunityPulseEntry type (v4.0.0):**

```typescript
interface CommunityPulseEntry {
  id: string;
  score: number;
  platform: string;
  platformId: string;
  description: string;
  tier: 'tier1' | 'tier2' | 'tier3' | 'tier4';
  likeCount: number;
  createdAt: string;
  countryCode: string;
  source: string;           // 'weather' | 'user'
  venue: string;
  conditions: string;
  categoryMap: WeatherCategoryMap | null;
  weather: PulseWeatherData | null;
  promptText: string;       // Full prompt for tooltip display
}
```

### 6.5 Builder Integration (Pipeline)

**File:** `src/components/providers/prompt-builder.tsx` (2,770 lines)

When a user copies an optimised prompt (`handleCopyPrompt`), the builder fires a POST to `/api/homepage/community-pulse` after telemetry. This is fire-and-forget (`void fetch().catch()`) — never blocks the copy action.

The POST body includes:
- `platformId` — the specific platform (e.g., `'flux'`, not a tier representative)
- `platformName` — display name (e.g., `'Flux (Black Forest Labs)'`)
- `tier` — derived from platform tier (`'tier3'`)
- `promptText` — the full optimised prompt text (same text copied to clipboard)
- `description` — derived from subject + style selections, max 60 chars (e.g., `"neon samurai, cinematic"`)
- `score` — `healthScore` from `usePromptAnalysis` (0-100)
- `countryCode` — from `locationInfo.countryCode` via `usePromagenAuth`

**Dependency:** `locationInfo` added to `usePromagenAuth` destructure and `handleCopyPrompt` dependency array.

### 6.6 New Data Files

| File | Purpose | Size |
| --- | --- | --- |
| `src/data/community-pulse/demo-prompts.json` | 210 pre-generated demo prompts (5 x 42 platforms) | ~130 KB |
| `src/data/community-pulse/demo-prompts.json.d.ts` | TypeScript type declaration for JSON import | 19 lines |
| `scripts/generate-demo-prompts.ts` | Build-time generator using real One Brain pipeline | ~160 lines |

---

## 7. Like System

### 7.1 Purpose

Provides a clean, intentional quality signal for prompts. Feeds into both the scoring system (term validation) and the Community Pulse feed. A direct "this prompt is good" signal is 10x more valuable than inferred proxy signals (copy rate, save rate).

### 7.2 Where Likes Appear

| Location                      | What is liked                    | Context                          |
| ----------------------------- | -------------------------------- | -------------------------------- |
| Prompt of the Moment (centre) | Each tier's prompt independently | 4 like buttons per showcase card |
| Community Pulse (right rail)  | Each pulse entry                 | 1 like button per pulse card     |

### 7.3 Database Schema

**Table:** `prompt_likes`

```sql
CREATE TABLE prompt_likes (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id     TEXT NOT NULL,            -- References the prompt entry
  session_id    TEXT NOT NULL,            -- Anonymous session identifier (cookie-based)
  user_id       TEXT,                     -- Clerk user ID (null if anonymous)
  country_code  TEXT,                     -- Derived from timezone (not PII)
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Prevent duplicate likes per session per prompt
CREATE UNIQUE INDEX idx_prompt_likes_session_prompt
  ON prompt_likes (session_id, prompt_id);

-- Fast count queries
CREATE INDEX idx_prompt_likes_prompt_id
  ON prompt_likes (prompt_id);

-- Most liked today query
CREATE INDEX idx_prompt_likes_created
  ON prompt_likes (created_at);
```

**Table:** `prompt_showcase_entries`

```sql
CREATE TABLE prompt_showcase_entries (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  city          TEXT NOT NULL,
  country_code  TEXT NOT NULL,
  venue         TEXT NOT NULL,
  mood          TEXT NOT NULL,
  tier          TEXT NOT NULL,             -- 'tier1' | 'tier2' | 'tier3' | 'tier4'
  platform_id   TEXT,                      -- Provider ID (null for weather-seeded)
  prompt_text   TEXT NOT NULL,             -- The full assembled prompt
  description   TEXT NOT NULL,             -- Short summary (max 60 chars)
  score         INTEGER NOT NULL DEFAULT 0,-- Prompt score (0–100)
  source        TEXT NOT NULL DEFAULT 'weather', -- 'weather' | 'user'
  like_count    INTEGER NOT NULL DEFAULT 0,-- Denormalised count (updated by trigger or app)
  prompts_json  TEXT,                      -- WeatherCategoryMap JSON (weather-seeded entries)
  weather_json  TEXT,                      -- Weather snapshot JSON (for emoji tooltip)
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_showcase_entries_created
  ON prompt_showcase_entries (created_at DESC);

CREATE INDEX idx_showcase_entries_likes_today
  ON prompt_showcase_entries (like_count DESC, created_at)
  WHERE created_at > NOW() - INTERVAL '24 hours';
```

### 7.4 API Routes

**POST /api/prompts/like**

```typescript
// Request body
interface LikeRequest {
  promptId: string;
}

// Response
interface LikeResponse {
  success: boolean;
  likeCount: number; // New total
  alreadyLiked: boolean; // True if this session already liked
}
```

**Behaviour:**

1. Read `session_id` from cookie (set automatically if not present — see §7.5)
2. Read `user_id` from Clerk auth (null if anonymous)
3. Derive `country_code` from `Intl.DateTimeFormat().resolvedOptions().timeZone`
4. Insert into `prompt_likes` — unique constraint prevents duplicates
5. Increment `like_count` on `prompt_showcase_entries`
6. Return new count + `alreadyLiked` flag

**Rate limiting:** Max 60 likes per session per hour. Prevents spam without blocking legitimate use.

### 7.5 Session Management

**Anonymous likes:** A random session ID is generated and stored in a `promagen-session` cookie (`httpOnly`, `sameSite: strict`, `maxAge: 30 days`). This allows one like per prompt per session without requiring sign-in.

**Authenticated likes:** If the user is signed in via Clerk, the `user_id` is also stored. Authenticated likes carry higher credibility weight in the scoring system (see §7.6).

**No sign-in required to like.** This maximises signal volume. Anonymous likes are still valuable — they just carry lower credibility weight.

### 7.6 Scoring System Integration

Likes feed into the existing credibility-weighted scoring pipeline:

| Signal                         | Credibility Weight | Rationale                                                 |
| ------------------------------ | ------------------ | --------------------------------------------------------- |
| Anonymous like                 | 1.0x (base)        | Volume signal — lots of these                             |
| Authenticated like (free user) | 2.0x               | User has committed to an account                          |
| Authenticated like (Pro user)  | 3.0x               | Highest-value user, most likely to have tested the prompt |

**Term validation:** When a prompt accumulates ≥10 likes, the terms within that prompt receive a co-occurrence confidence boost in the learning pipeline. The boost magnitude scales with like count: `boost = min(likeCount / 50, 1.0)` — capped at 1.0 to prevent runaway popularity from distorting scores.

**Leaderboard influence:** Aggregate likes per tier are tracked. If Tier 2 (Midjourney) prompts consistently receive more likes than other tiers, this signals community preference — but it is normalised by impression count to prevent popularity bias. This data is available for future leaderboard enhancements but does **not** directly modify existing Elo rankings in v1.

### 7.7 GTM Analytics Events

| Event                 | Trigger                      | Payload                                                                   |
| --------------------- | ---------------------------- | ------------------------------------------------------------------------- |
| `prompt_liked`        | User clicks like button      | `prompt_id`, `tier`, `source` (`showcase` or `pulse`), `is_authenticated` |
| `prompt_like_removed` | User un-likes (clicks again) | Same as above                                                             |

### 7.8 UI Behaviour

**Initial state:** ♡ (outline heart) + count. `text-slate-400`.

**Liked state:** ♥ (filled heart) + count. `text-pink-400`. Subtle scale animation (`transform: scale(1.2)`, 200ms, ease-out, then back to 1.0).

**Already-liked detection:** On page load, the component calls `GET /api/prompts/like/status?promptIds=id1,id2,...` with all visible prompt IDs. Returns which ones the current session has already liked. Pre-fills the filled-heart state.

**Un-like:** Clicking a filled heart removes the like (DELETE to `/api/prompts/like`). Count decrements. Heart reverts to outline.

---

## 8. Online Users by Country

### 8.1 Purpose

Social proof that real people from real countries are using Promagen right now. Creates urgency and validates the platform as alive.

### 8.2 Visibility Threshold

**The component only renders when total concurrent users ≥ 50.** Below this threshold, nothing is shown — no counter, no placeholder, no "0 users online." Strategic silence until the numbers tell a good story. This follows the "no fake data" principle.

### 8.3 Placement

Inside the Prompt of the Moment card, at the bottom — below the 4 tier prompts, above the card's bottom border. Small, understated. The country flags contextualise the prompt: "people from these countries are looking at this right now."

### 8.4 Data Source — Lightweight Heartbeat API (Recommended)

**Why this approach over alternatives:**

| Approach              | Verdict      | Reason                                                                                                                           |
| --------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| GA4 Real-Time API     | Rejected     | 10-minute reporting delay, rate limits (10 req/min), requires Google Analytics Data API credentials, adds third-party dependency |
| Clerk active sessions | Rejected     | Only counts signed-in users; most homepage visitors are anonymous, so it would report ~10% of actual traffic                     |
| **Custom heartbeat**  | **Selected** | Simple, accurate, counts all visitors (anonymous + authenticated), no external dependencies, GDPR-safe                           |

**Mechanic:**

1. Client sends `POST /api/heartbeat` every 60 seconds with body: `{ countryCode: "GB" }`
2. `countryCode` derived from `Intl.DateTimeFormat().resolvedOptions().timeZone` → timezone-to-country mapping (not PII — timezones are not personally identifiable)
3. Server stores entries in an in-memory `Map<sessionId, { countryCode, lastSeen }>` with 2-minute TTL
4. Any heartbeat older than 2 minutes is considered "offline" and pruned on next read
5. `GET /api/online-users` returns aggregated counts per country, sorted by count descending

**Serverless consideration:** Vercel serverless functions don't share memory across invocations. Two options:

- **Vercel KV (Redis):** Preferred. Each heartbeat sets a key with 120s TTL. Aggregation scans keys by prefix.
- **Edge Config (fallback):** If KV is not available, use a lightweight polling approach with an external counter service.

The build should implement the Vercel KV approach with a fallback that simply hides the component (threshold not met) if KV is unavailable.

### 8.5 Component: `OnlineUsers`

**File:** Rendered inside `prompt-showcase.tsx` (not a standalone component — it's part of the Prompt of the Moment card).

**Visual design (collapsed):**

```
🇬🇧 12  🇺🇸 8  🇩🇪 4  ▾ (+6 countries)
```

**Visual design (expanded — click ▾):**

```
🇬🇧 12  🇺🇸 8  🇩🇪 4  🇫🇷 3  🇯🇵 2  🇦🇺 2  🇨🇦 1  🇮🇳 1  🇧🇷 1
```

**Collapsed:** Top 3 countries by count + expandable indicator showing remaining count.

**Expanded:** All countries, inline, wrapping naturally. Click again to collapse.

**Flag rendering:** Uses existing `Flag` component from `src/components/ui/flag.tsx`. Country code → flag emoji or SVG (existing pattern).

**Count text:** `clamp()` small text, `text-slate-400`.

**Polling:** Client fetches `GET /api/online-users` every 30 seconds. Response is lightweight (<1KB).

---

## 9. Navigation Changes

### 9.1 World Context Button in Mission Control

**Added to:** Mission Control button row on ALL pages.

**Button spec (follows `buttons.md` canonical styling):**

| Property         | Value                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------ |
| Label            | "World Context"                                                                            |
| Icon             | 🌍 (globe emoji or globe SVG)                                                              |
| Destination      | `/world-context`                                                                           |
| Mechanism        | `<a href="/world-context">`                                                                |
| Text/icon colour | `text-purple-100` (explicit on child `<svg>` and `<span>` — mandatory per `buttons.md` §1) |
| Style            | Same purple gradient as Studio and Pro buttons                                             |
| Dimensions       | All `clamp()` — matching existing button sizing in Mission Control                         |

**Button layout updates (all pages):**

| Page                           | Current Buttons   | New Buttons                          |
| ------------------------------ | ----------------- | ------------------------------------ |
| Homepage (`/`)                 | Studio, Pro       | **World Context**, Studio, Pro       |
| Studio (`/studio`)             | Home, Pro         | Home, **World Context**, Pro         |
| Pro Promagen (`/pro-promagen`) | Studio, Home      | Studio, **World Context**, Home      |
| Studio sub-pages               | Home, Studio, Pro | Home, **World Context**, Studio, Pro |
| Provider pages                 | Home, Studio, Pro | Home, **World Context**, Studio, Pro |

**Grid column adjustment:** Mission Control button grid goes from 2-col (homepage) to 3-col (homepage) and from 3-col (provider pages) to 4-col (provider pages). The existing `clamp()` button sizing ensures all buttons fit at any viewport width.

**File changes:** `src/components/home/mission-control.tsx` — add `renderWorldContextButton()` function following the exact same pattern as `renderStudioButton()` and `renderProButton()`. Explicit `text-purple-100` on `<svg>` and `<span>` children per `buttons.md` §1.2.

**`buttons.md` update required:** Add "World Context" row to the Quick Reference table, with destination `/world-context`, mechanism `<a href>`, text/icon colour `text-purple-100`.

### 9.2 Fallback Navigation

No separate `fallback-nav.tsx` exists. All navigation is handled via Mission Control buttons on every page. The top nav (`src/components/nav/top-nav.tsx`) provides tab-based navigation for providers and does not include World Context — it is intentionally only reachable via Mission Control.

---

## 10. World Context Page

### 10.1 Route

`/world-context`

### 10.2 Content

**Exactly the current homepage layout** — unchanged except:

- Mission Control gains the "World Context" button (like all pages — §9.1), but on this page it is visually indicated as the current page (e.g., slightly brighter border or underline)
- The heading still reads "Promagen — Intelligent Prompt Builder" (consistent branding)

**Everything else stays:**

- Finance ribbon (FX, Commodities) — visible
- Exchange rails (left + right) — 16 exchange cards with flags, times, weather, indices
- Leaderboard table — present and functional
- Engine Bay — present
- Flag tooltips with weather-driven prompts — present
- All live data feeds — active

### 10.3 Implementation

**Actual approach (implemented):** `/world-context/page.tsx` (67 lines) is a server component that imports the existing `homepage-client.tsx` directly — no copy, no separate client file. This is the "lower risk" approach from v1.0.0 planning.

```
src/app/world-context/page.tsx → imports src/components/home/homepage-client.tsx (unchanged)
src/app/page.tsx               → imports src/components/home/new-homepage-client.tsx (new layout)
```

The original `homepage-client.tsx` (527 lines) is completely untouched — it renders exchange rails, finance ribbon, and the full three-column financial layout exactly as before. The new homepage layout lives entirely in `new-homepage-client.tsx` (243 lines).

---

## 11. Data Flow & API Routes

### 11.1 New API Routes Summary

| Route                                | Method | Purpose                                    | Cache               |
| ------------------------------------ | ------ | ------------------------------------------ | ------------------- |
| `/api/homepage/prompt-of-the-moment` | GET    | Current showcase prompt (all 4 tiers)      | `revalidate: 600`   |
| `/api/homepage/community-pulse`      | GET    | Recent 20 pulse entries + most liked today | 30 sec TTL          |
| `/api/homepage/community-pulse`      | POST   | Log user-created prompt (fire-and-forget)  | None                |
| `/api/prompts/like`                  | POST   | Like a prompt                              | None                |
| `/api/prompts/like`                  | DELETE | Unlike a prompt                            | None                |
| `/api/prompts/like/status`           | GET    | Check which prompts the session has liked  | None                |
| `/api/heartbeat`                     | POST   | Client heartbeat with country code         | None (writes to KV) |
| `/api/online-users`                  | GET    | Aggregated online user counts by country   | 30 sec TTL          |

### 11.2 Existing Routes Used (No Changes)

| Route            | Purpose                                                        |
| ---------------- | -------------------------------------------------------------- |
| `/api/weather`   | Live weather data (consumed by Prompt of the Moment generator) |
| `/api/providers` | Provider list (consumed by "Try in" icons and leaderboard)     |

### 11.3 Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        NEW HOMEPAGE DATA FLOW                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Existing (no changes):                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐              │
│  │ Gateway      │    │ city-vibes   │    │ scene-        │              │
│  │ /weather     │    │ .json (102)  │    │ starters.json │              │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘              │
│         │                   │                   │                       │
│  New:   ▼                   ▼                   │                       │
│  ┌──────────────────────────────┐               │                       │
│  │ /api/homepage/               │               │                       │
│  │   prompt-of-the-moment      │               │                       │
│  │                              │               │                       │
│  │ 1. Read rotation pointer     │               │                       │
│  │ 2. Get city from SSOT        │               │                       │
│  │ 3. Fetch cached weather      │               │                       │
│  │ 4. generateWeatherPrompt()   │               │                       │
│  │ 5. Map tier → top providers  │               │                       │
│  │ 6. Return PromptOfTheMoment  │               │                       │
│  └──────────────┬───────────────┘               │                       │
│                 │                                │                       │
│                 ▼                                ▼                       │
│  ┌──────────────────┐    ┌──────────────────────────┐                  │
│  │ PromptShowcase   │    │ SceneStartersPreview     │                  │
│  │ (centre column)  │    │ (left rail)              │                  │
│  │                  │    │                          │                  │
│  │ - 4 tier prompts │    │ - 25 free cards          │                  │
│  │ - Copy buttons   │    │ - Pro locked cards       │                  │
│  │ - Like buttons   │    │ - Click → prompt builder │                  │
│  │ - Try in icons   │    │   (sessionStorage scene) │                  │
│  │ - Online users   │    │                          │                  │
│  └──────────────────┘    └──────────────────────────┘                  │
│                 │                                                       │
│                 ▼                                                       │
│  ┌──────────────────┐    ┌──────────────────────────┐                  │
│  │ /api/prompts/    │    │ CommunityPulse           │                  │
│  │   like           │    │ (right rail)             │                  │
│  │                  │◄───│                          │                  │
│  │ - POST (like)    │    │ - Recent entries feed    │                  │
│  │ - DELETE (unlike)│    │ - Like buttons per entry │                  │
│  │ - GET (status)   │    │ - Most liked today       │                  │
│  └──────────────────┘    └──────────────────────────┘                  │
│                                                                         │
│  ┌──────────────────┐    ┌──────────────────────────┐                  │
│  │ /api/heartbeat   │    │ /api/online-users        │                  │
│  │ (POST every 60s) │───▶│ (GET every 30s)          │                  │
│  │                  │    │ Threshold: 50 users      │                  │
│  │ Vercel KV store  │    │ Returns: country counts  │                  │
│  └──────────────────┘    └──────────────────────────┘                  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 12. File Locations

### 12.1 New Files

| File                                                 | Purpose                                  | Lines |
| ---------------------------------------------------- | ---------------------------------------- | ----- |
| `src/components/home/new-homepage-client.tsx`        | New homepage client wrapper (+ Engine Bay state owner) | 281   |
| `src/components/home/prompt-showcase.tsx`            | Prompt of the Moment card + online users | 858   |
| `src/components/home/scene-starters-preview.tsx`     | Left rail scene cards (v4.1.0, cascading glow)        | 585   |
| `src/components/home/community-pulse.tsx`            | Right rail user prompt cards + online users (v8.0.0) | 781   |
| `src/app/api/homepage/prompt-of-the-moment/route.ts` | Showcase prompt API                      | 639   |
| `src/app/api/homepage/community-pulse/route.ts`      | Pulse feed API (GET + POST)              | 262   |
| `src/app/api/prompts/like/route.ts`                  | Like/unlike API (POST + DELETE)          | 187   |
| `src/app/api/prompts/like/status/route.ts`           | Like status check API                    | 99    |
| `src/app/api/heartbeat/route.ts`                     | Client heartbeat API                     | 107   |
| `src/app/api/online-users/route.ts`                  | Aggregated online counts API             | 67    |
| `src/app/world-context/page.tsx`                     | World Context server component           | 67    |
| `src/hooks/use-prompt-showcase.ts`                   | Fetch hook for Prompt of the Moment      | 151   |
| `src/hooks/use-community-pulse.ts`                   | Fetch hook for pulse feed                | 132   |
| `src/hooks/use-online-users.ts`                      | Heartbeat + online users hook            | 200   |
| `src/hooks/use-like.ts`                              | Like/unlike hook with optimistic UI      | 203   |
| `src/types/homepage.ts`                              | TypeScript types for all new interfaces  | 263   |
| `src/lib/likes/database.ts`                          | DB table creation + like CRUD + schema migrations | 223   |
| `src/lib/likes/session.ts`                           | Cookie-based session management          | 69    |
| `src/data/community-pulse/demo-prompts.json`         | 210 pre-generated demo prompts (5 x 42)  | —     |
| `src/data/community-pulse/demo-prompts.json.d.ts`   | TypeScript type declaration for JSON      | 19    |
| `scripts/generate-demo-prompts.ts`                   | Demo prompt generator (One Brain pipeline)| ~160  |
| `docs/authority/homepage.md`                         | This document                            | —     |

**Note:** `world-context-client.tsx` was not created. The `/world-context` route reuses the existing `homepage-client.tsx` directly (no modifications needed).

### 12.2 Modified Files

| File                                          | Changes                                                                                                  | Lines |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ----- |
| `src/app/page.tsx`                            | Imports `NewHomepageClient`, passes providers/exchanges/weatherIndex                                     | 70    |
| `src/components/home/mission-control.tsx`     | Added `renderWorldContextButton()`, World Context button on all page variants                            | 723   |
| `src/components/layout/homepage-grid.tsx`     | `leftContent`/`rightContent` props, `showFinanceRibbon` toggle, table expand support, `selectedProvider`/`onProviderChange` piped to Engine Bay (v5.0.0) | 721   |
| `src/components/providers/prompt-builder.tsx` | sessionStorage pre-load reader (Phase D), `preloadedSceneId` → SceneSelector, Community Pulse POST on copy (`locationInfo` from auth, `pulseDesc` from selections, fire-and-forget) | 2,770 |
| `src/components/home/engine-bay.tsx`          | `selectedProvider`/`onProviderChange` optional props for controlled mode (v5.0.0)                        | 499   |
| `src/components/providers/scene-selector.tsx` | `initialSceneId` prop for auto-expand on homepage scene pre-load                                         | 1,250 |

**Not modified (design decision):** `homepage-client.tsx` (527 lines) is unchanged — reused as-is by `/world-context`. No `fallback-nav.tsx` exists; navigation is handled entirely by Mission Control buttons.

### 12.3 Test Files

| File                                            | Lines | Cases | Coverage                                               |
| ----------------------------------------------- | ----- | ----- | ------------------------------------------------------ |
| `src/__tests__/parity-homepage-builder.test.ts` | 638   | 10    | PotM → prompt builder pre-load parity across all tiers |
| `src/__tests__/scene-starters-homepage.test.ts` | 310   | 31    | Batching, nav URLs, storage keys, exchange-card parity, SceneSelector contract, no hardcoded defaults, icon path safety |

---

## 13. Styling & Compliance

### 13.1 Universal clamp() (Mandatory)

Every new component must use inline `clamp()` for all visible dimensions. Reference scales from `code-standard.md` §6.0 and `best-working-practice.md` §4:

| Element                | clamp() value                                               |
| ---------------------- | ----------------------------------------------------------- |
| Card heading text      | `clamp(0.75rem, 1.1vw, 1.5rem)`                             |
| Body text              | `clamp(0.7rem, 0.9vw, 1rem)`                                |
| Small/muted text       | `clamp(0.6875rem, 0.9vw, 0.875rem)`                         |
| Tiny text (timestamps) | `clamp(8px, 0.6vw, 11px)`                                   |
| Prompt monospace text  | `clamp(0.65rem, 0.8vw, 0.875rem)`                           |
| Copy/like icon         | `clamp(12px, 0.9vw, 14px)`                                  |
| Provider shortcut icon | `clamp(18px, 1.5vw, 24px)`                                  |
| Flag wrapper           | `clamp(18px, 1.5vw, 24px)` w / `clamp(14px, 1.1vw, 18px)` h |
| Card padding           | `clamp(10px, 1vw, 16px)`                                    |
| Inner card padding     | `clamp(8px, 0.8vw, 12px)`                                   |
| Gap between cards      | `clamp(8px, 0.8vw, 12px)`                                   |
| Section gap            | `clamp(12px, 1.25vw, 24px)` (matches `GRID_GAP`)            |

### 13.2 Card Design Tokens

| Token       | Value                                              | Usage                                                        |
| ----------- | -------------------------------------------------- | ------------------------------------------------------------ |
| Outer card  | `rounded-3xl bg-slate-950/70 ring-1 ring-white/10` | Prompt Showcase, Scene Starters panel, Community Pulse panel |
| Inner card  | `rounded-xl bg-slate-900/60 ring-1 ring-white/5`   | Tier prompt cards, pulse cards                       |
| Scene card  | Exchange-card style: `rgba(255,255,255,0.05)` bg, `1px solid` border, dual radial glow on hover + cascading glow cycle | Scene Starters left rail (matches `exchange-card.tsx`) |
| Hover state | `hover:ring-white/15 hover:bg-slate-900/80`        | Clickable inner cards                                |

### 13.3 Animation Rules

- All animations in component files via `<style dangerouslySetInnerHTML>` — not in `globals.css` (per `best-working-practice.md` animation placement rule)
- Crossfade transitions: `opacity`, `transform` only — never `transition-all` (CLS prevention per `best-working-practice.md` §Performance Guardrails)
- Like heart scale animation: co-located in `prompt-showcase.tsx`
- Scene Starters subtitle pulse: `scene-subtitle-pulse` keyframes co-located in `scene-starters-preview.tsx` (2s cubic-bezier, opacity 1→0.5→1, matches mission-control `animate-pulse`)
- Scene Starters cascading glow: no CSS animation — driven by React state (`activeGlowIndex` + `glowOn`), 600ms CSS transition on `border-color` and `box-shadow` provides smooth fade in/out
- Community Pulse subtitle pulse: `pulse-subtitle-pulse` keyframes co-located in `community-pulse.tsx` (2s cubic-bezier, opacity 1->0.5->1, matches scene-starters)
- Community Pulse cascading glow: same React state pattern as scene-starters (shared constants: `GLOW_ON_MS = 3000`, `GLOW_OFF_MS = 1000`)
- All animations respect `prefers-reduced-motion`

### 13.4 Scrollbar Consistency

All scrollable containers use the standard scrollbar classes:

```tsx
className =
  'overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/20 hover:scrollbar-thumb-white/30';
```

### 13.5 Text/Icon Colour Inheritance

All `<a>` tag buttons **must** have explicit text colour on child `<svg>` and `<span>` elements per `buttons.md` §1. This applies to the World Context button, "Try in" provider links, and "View all scenes" link.

---

## 14. Acceptance Criteria

### 14.1 First Impression (3-Second Test)

- [ ] A first-time visitor sees "Promagen — Intelligent Prompt Builder" heading
- [ ] Below the heading: a live prompt showcase with a real city, real weather, 4 tier prompts
- [ ] Visitor immediately understands: "this builds AI image prompts"
- [ ] No financial data (FX, commodities, indices) visible on new homepage
- [ ] No "orange intro text" paragraph visible

### 14.2 Prompt of the Moment

- [ ] City rotates every 10 minutes across all 102 cities
- [ ] All 4 tier prompts generated correctly (no financial terms, no physics contradictions)
- [ ] Copy button works for each tier (clipboard + "Copied!" feedback)
- [ ] Like button works (toggle, count updates, persists across refresh)
- [ ] "Try in" provider icons navigate to correct prompt builder with pre-loaded prompt
- [ ] Pre-loaded prompt appears in output preview (not dropdowns)
- [ ] Crossfade transition on city change (no layout shift)
- [ ] Fallback works: if weather unavailable, demo data used; if generator throws, last-good prompt shown

### 14.3 Scene Starters Preview

- [ ] 8 free scenes visible per rotation batch (no pro scenes shown)
- [ ] Scene cards match exchange card structure (snap-fit font, same padding, same divider)
- [ ] Tier dot colour matches tier (cyan/violet/emerald/amber)
- [ ] Vibe phrase shown in italic on bottom row (first letter uppercase, no category count)
- [ ] Batches rotate every 5 minutes with crossfade
- [ ] Cascading glow: cards light up one at a time (3s on → 1s dark → next), looping endlessly through all 8
- [ ] Cascading glow resets to card 1 on batch rotation
- [ ] Hover overrides cascading glow (user hover always wins)
- [ ] Arrow shows "→" at rest, "→ {provider name}" on hover when provider selected
- [ ] Clicking scene with provider selected: navigates to `/providers/{id}` with scene pre-loaded
- [ ] Scene pre-load: prompt builder opens with dropdowns populated + SceneSelector expanded to correct world
- [ ] Clicking scene with no provider: Engine Bay dropdown auto-opens
- [ ] "Scene Starters" heading: title case, centred, gradient text (sky→emerald→indigo)
- [ ] Subtitle: amber italic pulsing text, changes copy based on provider state
- [ ] Footer row: provider icon + rank text (left), "25 free · 175 Pro" emerald green (right)
- [ ] "25 free · 175 Pro" click: navigates to prompt builder with empty dropdowns (no scene pre-loaded)
- [ ] Image Quality rank is dynamic from `provider.imageQualityRank` — changes when data changes
- [ ] Provider icon in footer matches Engine Bay icon size (`clamp(36px, 3vw, 48px)`)
- [ ] Provider persists across page navigation (localStorage)
- [ ] Navigation URL is `/providers/{id}` (never `/providers/{id}/prompt-builder`)
- [ ] No opacity dimming — cards always at full brightness regardless of provider state
- [ ] No `text-slate-500` or `text-slate-600` anywhere (banned colours)
- [ ] All text ≥ 9px at every viewport width (minimum font-size floor)

### 14.4 Community Pulse

- [x] 210 demo prompts displayed in 6-card rotation (5 per platform x 42 platforms)
- [x] Demo prompts are coherent visual scenes from real vocabulary files (not word salad)
- [x] Each demo prompt optimised for its specific platform format (T1/T2/T3/T4)
- [x] Demo prompts fill 85-99% of each platform's idealMax character budget
- [x] Card layout: 3 equal rows (33.333% each), no horizontal divider
- [x] Line 1: Platform icon + platform name + score/100 (live only) + heart + like count
- [x] Line 2: Description (subject + style, italic, uppercase first letter)
- [x] Line 3: "Created in" + flag (3x gap margins) + "at" + mono clock (visible colon, fontWeight 600)
- [x] Per-card brand colour glow from PLATFORM_COLORS map (42 unique colours)
- [x] Flag hover: portal tooltip with full optimised prompt + copy button (400ms close delay)
- [x] Like heart: filled when count > 0, outline when 0. Count in emerald-400
- [x] Score (`87/100`) only shown for live user entries (`isLive === true`). Demo cards show no score
- [x] 30-minute rotation of top 6 demo prompts (deterministic, all users see same)
- [x] `useCommunityPulse` hook connected — polls API every 30 seconds
- [x] Real user entries (source === 'user') push demo entries out of top slots automatically
- [x] Builder POSTs to `/api/homepage/community-pulse` on copy (fire-and-forget)
- [x] POST includes: platformId, promptText, description, score, countryCode
- [x] Bottom 2 cards: Online users (cyan glow, 16 countries, demo 500 users)
- [x] Cascading glow cycle matches scene-starters (3s on, 1s dark, 8-card loop)
- [x] Footer: green pulsing dot + "Live" (left), user/country count (right)
- [x] No `text-slate-500`/`text-slate-600` anywhere (banned colours)
- [x] `<CommunityPulse />` has no props — self-contained with hook + demo fallback

### 14.5 Online Users

- [ ] Component hidden when concurrent users < 50
- [ ] Component visible when concurrent users ≥ 50
- [ ] Collapsed: top 3 countries + expandable indicator
- [ ] Expanded: all countries shown inline
- [ ] Heartbeat fires every 60 seconds
- [ ] Stale heartbeats (>2 min) pruned from count

### 14.6 Navigation

- [ ] World Context button appears in Mission Control on ALL pages
- [ ] World Context button navigates to `/world-context`
- [ ] World Context button follows `buttons.md` styling (explicit `text-purple-100` on children)
- [ ] `/world-context` renders the complete current homepage layout (ribbon, exchanges, leaderboard)
- [ ] Fallback nav includes World Context link

### 14.7 Performance

- [ ] CLS ≤ 0.10 (target ≤ 0.05)
- [ ] No visible layout shift on page load
- [ ] Prompt showcase loads within 500ms (cached API response)
- [ ] Heartbeat POST < 50ms server-side
- [ ] Like POST < 100ms server-side
- [ ] All animations 60fps

### 14.8 Accessibility

- [ ] All interactive elements keyboard accessible
- [ ] Copy buttons have `aria-label="Copy [tier] prompt"`
- [ ] Like buttons have `aria-label="Like this prompt"` / `aria-label="Unlike this prompt"`
- [ ] Expand/collapse interactions use `aria-expanded`
- [ ] Screen reader announces prompt content
- [ ] `prefers-reduced-motion` disables crossfade and heart animation

---

## 15. Build Order

### Phase 1: Foundation ✅ Complete

| Step | Task                                                                            | Dependencies      |
| ---- | ------------------------------------------------------------------------------- | ----------------- |
| 1.1  | Create TypeScript types (`src/types/homepage.ts`)                               | None              |
| 1.2  | Create `/world-context` route (copy current homepage)                           | None              |
| 1.3  | Refactor `/` route to new homepage layout (or create `new-homepage-client.tsx`) | 1.2               |
| 1.4  | Add World Context button to Mission Control (all pages)                         | Read `buttons.md` |
| 1.5  | Update fallback nav with World Context link                                     | None              |

**Verification:**

```powershell
# At repo root:
pnpm run typecheck
pnpm run lint
```

Good looks like: `/` shows new layout (no ribbon, no exchanges). `/world-context` shows exact current homepage. World Context button visible on all pages.

### Phase 2: Prompt of the Moment ✅ Complete

| Step | Task                                                                               | Dependencies                      |
| ---- | ---------------------------------------------------------------------------------- | --------------------------------- |
| 2.1  | Create `/api/homepage/prompt-of-the-moment` route with rotation engine             | Existing weather-prompt-generator |
| 2.2  | Create `use-prompt-showcase.ts` hook                                               | 2.1                               |
| 2.3  | Build `prompt-showcase.tsx` component (4 tier cards, copy buttons, provider icons) | 2.2                               |
| 2.4  | Implement "Try in" sessionStorage mechanic                                         | 2.3                               |
| 2.5  | Add sessionStorage reader in `prompt-builder.tsx` (pre-loaded prompt support)      | 2.4                               |
| 2.6  | Crossfade transition on city rotation                                              | 2.3                               |

### Phase 3: Scene Starters Preview ✅ Complete

| Step | Task                                                                      | Dependencies                 |
| ---- | ------------------------------------------------------------------------- | ---------------------------- |
| 3.1  | Build `scene-starters-preview.tsx` component                              | Existing scene-starters.json |
| 3.2  | Implement provider routing (localStorage last-used + Engine Bay fallback) | 3.1                          |
| 3.3  | Add sessionStorage scene pre-load in `prompt-builder.tsx`                 | 3.2                          |
| 3.4  | Pro gate (sign-in modal for anon, upgrade dialog for free)                | 3.1, existing Clerk patterns |

### Phase 4: Like System ✅ Complete

| Step | Task                                                               | Dependencies                   |
| ---- | ------------------------------------------------------------------ | ------------------------------ |
| 4.1  | Create database tables (`prompt_showcase_entries`, `prompt_likes`) | Database access                |
| 4.2  | Create `/api/prompts/like` routes (POST, DELETE, GET status)       | 4.1                            |
| 4.3  | Create `use-like.ts` hook with optimistic UI                       | 4.2                            |
| 4.4  | Wire like buttons into `prompt-showcase.tsx`                       | 4.3, Phase 2                   |
| 4.5  | Add session cookie management                                      | 4.2                            |
| 4.6  | Scoring system integration (co-occurrence boost)                   | 4.1, existing scoring pipeline |
| 4.7  | GTM analytics events (`prompt_liked`, `prompt_like_removed`)       | 4.3                            |

### Phase 5: Community Pulse ✅ Complete

| Step | Task                                                                      | Dependencies              |
| ---- | ------------------------------------------------------------------------- | ------------------------- |
| 5.1  | Create `/api/homepage/community-pulse` route                              | Phase 4 (database tables) |
| 5.2  | Create `use-community-pulse.ts` hook                                      | 5.1                       |
| 5.3  | Build `community-pulse.tsx` component                                     | 5.2, Phase 4 (like hook)  |
| 5.4  | Wire weather-seeded entries (auto-log from Prompt of the Moment rotation) | 5.1, Phase 2              |
| 5.5  | "Most liked today" card                                                   | 5.3, Phase 4              |

### Phase 6: Online Users ✅ Complete

| Step | Task                                                    | Dependencies     |
| ---- | ------------------------------------------------------- | ---------------- |
| 6.1  | Create `/api/heartbeat` route with Vercel KV storage    | Vercel KV access |
| 6.2  | Create `/api/online-users` route with aggregation       | 6.1              |
| 6.3  | Create `use-online-users.ts` hook with heartbeat sender | 6.2              |
| 6.4  | Add online users display to `prompt-showcase.tsx`       | 6.3, Phase 2     |
| 6.5  | Threshold gate (render only at ≥ 50)                    | 6.4              |

### Phase 7: Polish & Documentation ✅ Complete

| Step | Task                                                               | Dependencies |
| ---- | ------------------------------------------------------------------ | ------------ |
| 7.1  | CLS audit (all new components)                                     | All phases   |
| 7.2  | Accessibility audit (keyboard nav, ARIA, screen reader)            | All phases   |
| 7.3  | `clamp()` compliance check (no fixed px/rem)                       | All phases   |
| 7.4  | Update `buttons.md` (World Context button)                         | Phase 1      |
| 7.5  | Update `mission-control.md` (new button layout)                    | Phase 1      |
| 7.6  | Update `ribbon-homepage.md` (cross-reference)                      | Phase 1      |
| 7.7  | Update `paid_tier.md` (like system + online users = free features) | Phase 4, 6   |
| 7.8  | Full E2E manual test pass (see §14)                                | All phases   |

**All 7 phases complete + Scene Starters v4.1 redesign.** Total new code: ~4,635 lines across 18 new files + 6 modified files.

---

## 16. Risk Mitigation

| Risk                                             | Mitigation                                                                                                                                                         |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Rotation engine server restart**               | No effect — rotation is deterministic (`floor(now / 600000) % 102`), not stored in memory. All instances produce the same city at the same time.                   |
| **Weather data unavailable**                     | Generator uses demo fallback (15°C, partly cloudy). Component never shows error state.                                                                             |
| **Vercel KV unavailable**                        | Online users component hidden (threshold not met). No visible error.                                                                                               |
| **Low initial like counts**                      | Expected. Honest zero counts per "no fake data" principle. Community Pulse is seeded with weather prompts to avoid empty feed.                                     |
| **sessionStorage not available**                 | "Try in" and scene pre-load gracefully degrade — user arrives at prompt builder in default state (no error, no pre-load, they build from scratch).                 |
| **Too many concurrent API requests on homepage** | Prompt of the Moment cached for 10 min, Community Pulse cached for 30 sec, online users cached for 30 sec. Homepage generates max 3 lightweight API calls on load. |
| **CLS from prompt showcase loading**             | Container has fixed min-height. Content opacity-gated until data loads.                                                                                            |
| **Pro gate confusion**                           | Same patterns as existing Scene Selector — tested and proven.                                                                                                      |

---

## 17. Non-Regression Rule

When building on the new homepage:

- Do not modify the prompt builder (except the sessionStorage pre-load reader)
- Do not modify the vocabulary system, scoring engine, or learning pipeline
- Do not modify the leaderboard table or provider cells
- Do not modify the weather-prompt-generator (consume it, don't change it)
- Do not modify Engine Bay or Mission Control (except the controlled mode props which are already added)
- Do not modify scene-starters.json (read-only consumption)
- Do not modify any existing page layout except `/` and adding the World Context button
- Do not remove or modify any existing API routes
- All new UI elements must use CSS `clamp()` for sizing — no fixed px/rem
- Preserve all existing features on the World Context page
- **Do not modify sessionStorage key names** (`promagen:preloaded-payload`, `promagen:preloaded-inspiredBy`, `promagen:preloaded-scene`) — the prompt builder reads these on mount
- **Do not modify the `promagen-session` cookie name or maxAge** — the like system depends on session continuity
- **Preserve the venue desync fix** — always use `categoryMap.meta.venue` as the authoritative venue, not the route's index rotation
- **Preserve the categoryMapHash** in `inspiredBy` — the prompt builder uses this for fingerprint matching
- **Preserve the table-expand hide** — PromptShowcase + LeaderboardIntro must both hide when `isTableExpanded` is true
- **Navigation URL is `/providers/{id}`** — never `/providers/{id}/prompt-builder` (deprecated redirect route, causes `/providers/undefined` bug)
- **Engine Bay controlled mode is homepage-only** — only `new-homepage-client.tsx` passes `selectedProvider`/`onProviderChange`. All other pages leave them `undefined`.
- **Provider persistence key is `promagen:homepage-provider`** — not `lastProvider` (old key had stale values)
- **Scene cards must match exchange card structure** — same snap-fit constants (12, 20, 0.042), same `px-4 py-1` padding, same `space-y-3` gap, same divider class
- **No `text-slate-500` or `text-slate-600`** — banned on dark backgrounds. Dimmest permitted: `text-slate-400`. For de-emphasised text: `text-white/60`. Per `code-standard.md` § 6.0.2.
- **No opacity dimming for state indication** — never dim cards/containers to show inactive state. Use text changes or colour changes instead. Per `code-standard.md` § 6.0.3.
- **All text ≥ 9px** — every `clamp()` min for `fontSize` must be ≥ `0.5625rem`. Em-based sizes never below `0.75em` at 12px snap-fit base. Per `code-standard.md` § 6.0.1.
- **Cascading glow constants** — `GLOW_ON_MS = 3000`, `GLOW_OFF_MS = 1000`. Do not change without updating this doc.
- **Community Pulse demo rotation** — `ROTATION_MS = 30 * 60 * 1000` (30 minutes). Deterministic: `Math.floor(Date.now() / ROTATION_MS)`. Same prompts shown to all users simultaneously.
- **Community Pulse `isLive` flag** — demo entries must always have `isLive: false`. API entries must always have `isLive: true`. Score only renders when `isLive === true`.
- **Community Pulse card height locked** — `clamp(74px, 6.2vw, 104px)`. Same as scene cards. Do not change without updating both components.
- **Community Pulse 3-row layout** — each row `height: '33.333%'` (not `flex-1`). This prevents content height from pushing rows unequal.
- **Builder → Pulse POST** — fire-and-forget (`void fetch().catch()`). Must never block the copy action or throw errors to the user.
- **Demo prompts: 210 entries** — 5 per platform x 42 platforms. If platforms are added/removed, regenerate via `npx tsx scripts/generate-demo-prompts.ts`.

**Existing features preserved: Yes** (required for every change).

---

## 18. Related Documents

| Document                              | Relevance                                                     |
| ------------------------------------- | ------------------------------------------------------------- |
| `ribbon-homepage.md`                  | Current homepage spec (now `/world-context`)                  |
| `code-standard.md`                    | All code standards (clamp(), TypeScript, SSOT, viewport lock) |
| `best-working-practice.md`            | Process rules (CLS, animations, card design, security)        |
| `buttons.md`                          | All button styling, colour inheritance rules                  |
| `mission-control.md`                  | Mission Control button layouts                                |
| `ignition.md`                         | Engine Bay spec                                               |
| `scene-starters.md`                   | Scene Starters data architecture and UI spec                  |
| `prompt-builder-page.md`              | Prompt builder page architecture                              |
| `prompt-builder-evolution-plan-v2.md` | Evolution plan (Phases 0–9)                                   |
| `gallery-mode-master.md`              | Gallery Mode spec (shared rotation engine concept)            |
| `paid_tier.md`                        | Free vs paid boundaries                                       |
| `clerk-auth.md`                       | Authentication patterns                                       |
| `ai_providers.md`                     | Provider SSOT and leaderboard spec                            |

---

## 19. Changelog

- **6 March 2026 (v4.0.0):** **COMMUNITY PULSE v8.0.0 COMPLETE REDESIGN + BUILDER PIPELINE WIRING.** §6 rewritten completely:
  - **Weather/city vibe seeding removed** from Community Pulse cards. Weather-seeded entries still log to DB (from PotM auto-logger) but cards no longer display them.
  - **210 demo prompts:** 5 per platform x 42 platforms. Built from real vocabulary files. Each prompt optimised for its specific platform format (T1 CLIP weights + quality prefix, T2 MJ params, T3 NL sentences, T4 plain). All fill 85-99% of platform idealMax. Coherent visual scenes (samurai in rain, coral reef, jazz musician, etc.) not random word soup.
  - **Card layout redesign:** 3 equal rows (33.333% height each), no horizontal divider. Line 1: platform icon + name + score/100 (live only) + heart. Line 2: description italic. Line 3: "Created in" + flag + "at" + mono clock.
  - **Per-card brand colour glow:** Each card glows its platform brand colour (violet for MJ, orange for Flux, pink for Leonardo, etc.). Same glow pattern as scene-starters tier dot colour.
  - **Flag hover tooltip:** Portal-based, 400ms close delay, ethereal glow from brand colour, "Image Prompt" heading + copy button, full optimised prompt text. Same pattern as weather-prompt-tooltip.tsx.
  - **`isLive` flag:** Demo entries = false (no score shown), API entries = true (score shown as `87/100`). Instant visual distinction between demo and real data.
  - **Live data wiring:** `useCommunityPulse` hook imported, polls every 30s. `apiEntryToCard()` converts API entries to card format. User entries (`source === 'user'`) take top slots, demos fill remaining.
  - **Builder pipeline:** `prompt-builder.tsx` POSTs to `/api/homepage/community-pulse` fire-and-forget on copy. Body: platformId, platformName, tier, promptText, description (subject+style from selections), score (healthScore), countryCode (from locationInfo). `locationInfo` added to `usePromagenAuth` destructure.
  - **POST handler:** New `POST /api/homepage/community-pulse` route. Validates, sanitises, INSERTs with `source = 'user'`. Returns entry ID.
  - **DB schema:** Added `prompts_json TEXT` and `weather_json TEXT` columns to `prompt_showcase_entries` via `ALTER TABLE ADD COLUMN IF NOT EXISTS`.
  - **Types:** Added `PulseWeatherData` interface, `weather` and `promptText` fields to `CommunityPulseEntry`.
  - **Bottom 2 cards:** Online users with cyan glow (demo 500 users, 16 countries).
  - **New files:** `demo-prompts.json` (210 entries), `demo-prompts.json.d.ts`, `generate-demo-prompts.ts`.
  - Component grew from 420 to 781 lines. API route grew from 155 to 262 lines.
  - §6 rewritten (§6.1-§6.6). §7.3 schema updated. §11.1 routes table updated (POST added). §12.1/§12.2 file locations updated. §14.4 acceptance criteria rewritten (5 -> 23 checks, all passing).

- **5 March 2026 (v3.0.0):** **SCENE STARTERS v4.1.0 REDESIGN.** §5 rewritten completely for v4.1.0:
  - **Cascading glow cycle:** Cards glow one at a time in sequence — 3s on, 1s dark, next card, infinite loop through all 8 (32s full cycle). Parent-controlled via `activeGlowIndex` + `glowOn` state. Resets to card 0 on batch rotation. Hover always overrides cascade.
  - **Heading:** "Scene Starters" (title case, not ALL-CAPS). Centred. Gradient text matching leaderboard heading (`sky-400 → emerald-300 → indigo-400`). Font size `clamp(0.65rem, 0.9vw, 1.2rem)`.
  - **Subtitle:** Two states — "Click a scene to start building." (provider selected) / "Select a platform above to unlock scenes." (no provider). Amber italic, pulsing animation matching mission-control (`2s cubic-bezier`). Inline `<style>`, no globals.
  - **Arrow with provider name:** "→" at rest, "→ Flux" on hover when provider selected. Cyan on hover. Truncated at 6em.
  - **Footer row:** Provider icon + "Ranked {ordinal} for Image Quality" (left, plain text, dynamic from `provider.imageQualityRank`). "25 free · 175 Pro" (right, emerald-400 green, clickable → prompt builder with empty dropdowns).
  - **Category count removed** from bottom row — vibe phrase only, first letter uppercased.
  - **Banned colours enforced:** `text-slate-500`/`text-slate-600` replaced with `text-white/60` and `text-white/50`. Per `code-standard.md` § 6.0.2.
  - **No opacity dimming:** Cards always full brightness. Per `code-standard.md` § 6.0.3.
  - **9px font floor enforced:** All `clamp()` minimums ≥ `0.5625rem`. Vibe phrase bumped from `0.70em` to `0.75em`. Per `code-standard.md` § 6.0.1.
  - **Provider icon size:** Matches Engine Bay icons (`clamp(36px, 3vw, 48px)`), moved from header to footer.
  - Component grew from 435 to 585 lines. Version: v3.0.0 → v4.1.0.
  - §5.4 updated: "25 free · 175 Pro" explore click flow documented.
  - §12 file locations updated (585 lines).
  - §13.3 animation rules updated (subtitle pulse + cascading glow).
  - §14.3 acceptance criteria expanded (11 → 23 checks).
  - §17 non-regression rules: added banned colours, no dimming, 9px floor, glow constants.
  - New `code-standard.md` sections referenced: § 6.0.1, § 6.0.2, § 6.0.3.

- **5 March 2026 (v2.1.0):** **SCENE STARTERS v3.0.0 REDESIGN.** §5 rewritten completely:
  - Scene cards now structurally identical to exchange cards: same snap-fit font system (ResizeObserver, width × 0.042, clamped 12–20px), same `px-4 py-1` padding, same `0.90em`/`0.75em` font sizes, same horizontal divider, same dual radial glow, same `space-y-3` gap
  - Shows 8 free scenes per batch (no pro/locked scenes on homepage), rotates every 5 minutes
  - Each card shows: tier dot (coloured like market status) + emoji + name | world emoji + label + category count + italic flavour phrase
  - Provider UI removed from Scene Starters — Engine Bay handles selection via controlled mode (`selectedProvider`/`onProviderChange` props, see `ignition.md` v5.0.0)
  - No default provider. State starts null. User must choose in Engine Bay.
  - Provider persisted to `localStorage('promagen:homepage-provider')` by parent, restored on mount
  - Navigation URL changed from `/providers/{id}/prompt-builder` (deprecated redirect, caused `/providers/undefined` bug) to `/providers/${id}`
  - SceneSelector auto-expand: new `initialSceneId` prop opens accordion to correct world on arrival
  - `prompt-builder.tsx`: added `preloadedSceneId` state, passed to SceneSelector
  - `scene-selector.tsx`: added `initialSceneId` prop with `useEffect` to expand + navigate
  - Test file added: `src/__tests__/scene-starters-homepage.test.ts` (31 cases, 8 groups)
  - Updated §12 file locations (6 modified files, 2 test files)
  - Updated §14.3 acceptance criteria (11 checks)
  - Updated §17 non-regression rules (4 new rules)

- **4 March 2026 (v2.0.0):** **STATUS UPDATE — ALL PHASES IMPLEMENTED.** Document upgraded from "Specification (pre-build)" to "Implemented". 25+ discrepancies corrected against actual src.zip:
  - **Tier colours fixed:** Tier 1 `text-cyan-400` → `text-violet-400`, Tier 2 `text-violet-400` → `text-blue-400`. Tier 1 label "CLIP" → "CLIP-Based". Tier 4 label "Plain" → "Plain Language". Ring + dot colours added.
  - **Grid column:** centre `1fr` → `2.2fr` (Tailwind class documented)
  - **Rotation engine:** "stored server-side (in-memory or KV)" → deterministic math `floor(now / 600000) % 102`. No server state. `setInterval` description removed. Risk mitigation row updated accordingly.
  - **§4.2 PromptOfTheMoment interface:** Added `weather`, `tierSelections` (Phase D WeatherCategoryMap), and `inspiredBy` (with `categoryMapHash`) fields. Types reference to `src/types/homepage.ts` (229 lines) added.
  - **§4.2 weather generator:** Line count corrected from 2,519 to 486 (entry point) / ~10,800 (full engine, 28 files)
  - **§4.3 API route:** Rewritten with 11 accurate steps including categoryMap extraction, venue desync fix, ISR caching, and auto-logging to prompt_showcase_entries
  - **§4.5 sessionStorage rewritten:** Old spec (`promagen:preloaded-prompt` + `promagen:preloaded-tier`) replaced with Phase D implementation (`promagen:preloaded-payload` with WeatherCategoryMap + `promagen:preloaded-inspiredBy` with badge metadata + categoryMapHash). "Why not pre-fill dropdowns" replaced with Phase D explanation (all 12 categories now pre-filled). Venue desync fix documented.
  - **§5.4 Provider routing:** localStorage key `promagen:last-provider-id` → `lastProvider`. Engine Bay popup → default to Midjourney. Pro gate behaviour documented.
  - **§9.2 Fallback nav:** `fallback-nav.tsx` reference removed (file doesn't exist)
  - **§10.3 Implementation:** Speculative dual-file approach replaced with actual — `world-context/page.tsx` imports existing `homepage-client.tsx` directly
  - **§12 file locations:** All estimated line counts replaced with actual (18 new files totalling ~4,427 lines). `world-context-client.tsx` removed (not created). `new-homepage-client.tsx`, `likes/database.ts`, `likes/session.ts` added. §12.2 line counts added. §12.3 test files section added.
  - **§15 build order:** All 7 phases marked ✅ Complete
  - **§16 risk mitigation:** Rotation restart row updated (no effect — deterministic)
  - **Added to §4.4:** Countdown timer ("next city in M:SS"), ProviderIcon glow styling (`bg-white/15` + `drop-shadow`), table-expand hide behaviour, skeleton loader, metadata line format (no TZ suffix, no mood text), copy button feedback colours (`bg-emerald-500/20 text-emerald-400`), like button colour states (`text-pink-400`/`text-slate-400`)
  - **Non-regression rules:** 5 new rules added (sessionStorage keys, cookie, venue desync, categoryMapHash, table-expand)
  - **ASCII diagram:** Tier labels updated, countdown line added, metadata line corrected

- **2 March 2026 (v1.0.0):** Initial specification document. All 7 build phases planned.

- **2 March 2026 (v1.0.0):** Initial specification. New homepage with Prompt of the Moment showcase, Scene Starters preview, Community Pulse feed, like system, online users by country (threshold 50), World Context button on all pages. Current homepage moves to `/world-context`. 7-phase build plan, 13–18 day estimated build.
