# Homepage & Financial Layout — Authority Document

> **Authority Document** — Promagen Page Routing & Market Belt  
> **Last Updated:** 9 April 2026  
> **Version:** 8.0.0  
> **Status:** Production

---

## Table of Contents

1. [Overview — Page Routing](#overview--page-routing)
2. [Homepage (Prompt Lab)](#homepage--prompt-lab)
3. [World Context (Financial Layout)](#world-context--financial-layout)
4. [Inspire (Scene Starters & Discovery)](#inspire--scene-starters--discovery)
5. [Three-Column Grid (Shared Shell)](#three-column-grid-shared-shell)
6. [Market Belt](#market-belt)
7. [AI Providers Leaderboard](#ai-providers-leaderboard)
8. [Support Column](#support-column)
9. [Visual Design](#visual-design)
10. [Related Documents](#related-documents)

---

## Overview — Page Routing

The original homepage (FX ribbons, exchange rails, market belt, leaderboard) has been split across three routes:

| Route | Component | Content | Rendering |
|-------|-----------|---------|-----------|
| `/` (Homepage) | `PlaygroundPageClient` | **Prompt Lab** — the product. 40-platform AI prompt builder with Bletchley Machine | `force-dynamic` |
| `/world-context` | `HomepageClient` | **Original financial layout** — FX ribbon, exchange rails, weather, leaderboard | `force-dynamic` |
| `/inspire` | `NewHomepageClient` | **Scene Starters, Prompt of the Moment, Community Pulse** + leaderboard | ISR 60s |

All three routes use `HomepageGrid` as the layout shell (three-column grid with Engine Bay and Mission Control). The centre column content differs per route.

---

## Homepage — Prompt Lab

**Route:** `/`  
**File:** `src/app/page.tsx` → `src/app/studio/playground/playground-page-client.tsx`  
**Rendering:** `force-dynamic`

The homepage IS the Prompt Lab. When users hit `promagen.com` they see the AI prompt builder: 40 platforms, the Bletchley Machine (Decoder, Switchboard, Alignment), human sentence conversion, tier generation.

### Centre Column Contents

| Section | Component | Purpose |
|---------|-----------|---------|
| Platform Match Rail | `platform-match-rail.tsx` (left intelligence rail) | 40-platform tier-grouped navigator |
| Playground Workspace | `PlaygroundWorkspace` | Prompt assembly, categories, selection |
| Pipeline XRay | `pipeline-xray.tsx` (right intelligence rail) | Glass Case — shows prompt pipeline |

### Exchange Rails

Left and right rails show exchange cards with live clocks and weather data, same as the original homepage.

### Key Props

```typescript
<PlaygroundPageClient
  providers={providers}
  initialRatings={initialRatings}
  exchanges={exchanges}
  weatherIndex={weatherIndex}
/>
```

---

## World Context — Financial Layout

**Route:** `/world-context`  
**File:** `src/app/world-context/page.tsx` → `src/components/home/homepage-client.tsx`  
**Rendering:** `force-dynamic`

This is the **original homepage layout** relocated to `/world-context`. It preserves the full financial-data experience.

### Centre Column Contents

| Section | Description |
|---------|-------------|
| Finance Ribbon | FX row (4 chips SSOT-driven) + Commodities Movers Grid + Crypto row |
| AI Providers Leaderboard | 40-provider table with Index Rating, Promagen Users, voting |

### Market Belt (FX + Commodities + Crypto)

The market belt sits inside the centre column:

```
┌─────────────────────────────────────────┐
│  FX Row (top) — 4 chips (SSOT-driven)   │
├─────────────────────────────────────────┤
│  Commodities Movers Grid (middle)       │
│  2×2 winners (green) + 2×2 losers (red) │
├─────────────────────────────────────────┤
│  Crypto Row (bottom) — 4 chips          │
├─────────────────────────────────────────┤
│  AI Providers Leaderboard               │
└─────────────────────────────────────────┘
```

### FX Row — SSOT Driven

The homepage FX row is entirely driven by `src/data/fx/fx.selected.json`. The ribbon does not hard-code any count.

| Aspect | Value |
|--------|-------|
| Default pairs | 4 (`eur-usd`, `usd-jpy`, `gbp-zar`, `gbp-eur`) |
| SSOT file | `src/data/fx/fx.selected.json` |
| Catalog file | `src/data/fx/fx-pairs.json` |

---

## Inspire — Scene Starters & Discovery

**Route:** `/inspire`  
**File:** `src/app/inspire/page.tsx` → `src/components/home/new-homepage-client.tsx`  
**Rendering:** ISR 60s

The prompt-showcase/discovery page. Users browse creative scenes, see live AI prompts, and discover what the community is building — before jumping into the Prompt Lab.

### Centre Column Contents

| Section | Description |
|---------|-------------|
| Scene Starters | One-click AI prompt scenes across 23 worlds |
| Prompt of the Moment | Live weather-driven prompt rotating every 3 minutes |
| Community Pulse | Social engagement metrics |
| AI Providers Leaderboard | Same 40-provider table |

---

## Three-Column Grid (Shared Shell)

All three routes use `HomepageGrid` (`src/components/layout/homepage-grid.tsx`):

### Page Canvas

- **Background:** Deep dark gradient
- **Height:** `100dvh` — fills viewport precisely
- **Overflow:** Hidden on html/body — NO page-level scrollbar
- **Desktop-only:** No mobile layouts or breakpoints. Shrink/scale via `clamp()`.

### Grid Proportions

```css
grid-template-columns: minmax(0, 0.9fr) minmax(0, 2.2fr) minmax(0, 0.9fr);
```

| Column | Width | Content |
|--------|-------|---------|
| Left rail | 0.9fr | Exchange cards (eastern exchanges) |
| Centre | 2.2fr | Route-specific content |
| Right rail | 0.9fr | Exchange cards (western exchanges) |

### Hero Section (Engine Bay + Mission Control)

```
┌──────────────────┐                              ┌──────────────────┐
│   ENGINE BAY     │        PROMAGEN              │ MISSION CONTROL  │
│   Platform icons │   Intelligent Prompt         │  Location badge  │
│   Launch button  │        Builder               │  Prompt preview  │
└──────────────────┘                              └──────────────────┘
```

Both panels visible at ≥1280px (`xl:block`). Hidden below that width.

**Width formula:** `calc((100vw - 80px) * 0.225)`

**Authority:** `docs/authority/ignition.md` (Engine Bay), mission-control section in homepage.md (Mission Control).

---

## AI Providers Leaderboard

Present on all three routes. 40 AI image generation providers displayed in a sortable table.

### Columns

| Column | Content | Default Sort |
|--------|---------|-------------|
| Provider | Icon + name + tier badge | — |
| Promagen Users | Total count + flag grid (max 6 flags) | — |
| Index Rating | Rating + change arrow + percentage | DESC (highest first) |
| Image Quality | Vote button + rank | ASC (best first) |
| Support | Social media icons (max 9 platforms) | — |

### Leaderboard Glow

- Solid frame: 3-second cycle
- Blur glow: 5-second cycle (offset by 0.5s)
- Opacity range: 0.2 → 1.0 → 0.2

### Sortable Headers

- Always-visible sort arrows: ⇅ when inactive, ▼/▲ when active
- Underline on hover: Cyan gradient, grows from center
- Glow on active: Cyan drop-shadow on arrow and text
- Toggle direction: Click same column to flip asc/desc

---

## Support Column

9 social media platforms displayed as clickable icons per provider.

| Platform | Brand Hex |
|----------|-----------|
| LinkedIn | #0A66C2 |
| Instagram | #E4405F |
| Facebook | #1877F2 |
| YouTube | #FF0000 |
| Discord | #5865F2 |
| Reddit | #FF4500 |
| TikTok | #00F2EA |
| Pinterest | #E60023 |
| X | #FFFFFF |

**Layout:** Max 4 icons per row. 5+ splits into 2 rows. Always full brand color (never greyscale). Default opacity 70%, hover 100% + scale(1.15) + glow. Providers without social links show "—".

**Data source:** `socials` field in `providers.json`.

---

## Visual Design

### Typography

All text uses `clamp()` for fluid sizing. Minimum 10px (code standard §6.0.1). No fixed px/rem font sizes.

### Colour

| Element | Value |
|---------|-------|
| Base page | Near-black to dark grey gradient |
| Up/positive | Green (`#22c55e` / `text-emerald-400`) |
| Down/negative | Red (`#ef4444` / `text-red-400`) |
| No grey text | Minimum brightness `#E2E8F0` (slate-200) |

### Motion

Motion is subtle and purposeful. All animations respect `prefers-reduced-motion`.

---

## Related Documents

| Document | Scope |
|----------|-------|
| `prompt-lab.md` | Prompt Lab (now the homepage) |
| `commodities.md` | Full commodities system |
| `ignition.md` | Engine Bay panel |
| `cron_jobs.md` | Promagen Users aggregation |
| `index-rating.md` | Index Rating system |
| `paid_tier.md` | Pro tier features and picker limits |
| `code-standard.md` | UI standards (no grey text, clamp(), desktop-only) |

---

## Changelog

| Date | Change |
|------|--------|
| **9 Apr 2026** | v8.0.0: Major rewrite. Homepage is now Prompt Lab (`/`). Old financial layout at `/world-context`. Scene Starters at `/inspire`. Updated provider count to 40. Removed mobile sections (desktop-only). Updated grid proportions to 0.9/2.2/0.9. Added page routing overview. Consolidated leaderboard columns (Promagen Users, Index Rating). |
| 4 Feb 2026 | v7.0.0: Removed inline commodities docs. Updated FX row to 4 pairs. |
| 26 Jan 2026 | Updated responsive breakpoints. |
| 22 Jan 2026 | Major leaderboard visual update (glow frame, sortable headers). |

---

_This document is the authority for Promagen page routing and the financial/market layout. `src.zip` is the Single Source of Truth — if code and doc conflict, code wins._
