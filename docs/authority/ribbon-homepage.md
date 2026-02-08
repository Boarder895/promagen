# Homepage – Main Promagen Hub

> **Authority Document** — Promagen Homepage Layout & Market Belt  
> **Last Updated**: 2026-02-04  
> **Status**: Production

---

## Table of Contents

1. [Overview](#overview)
2. [Overall Structure & Responsiveness](#11-overall-structure--responsiveness)
3. [Hero Section Layout](#hero-section-layout)
4. [Market Belt](#market-belt)
   - [FX Row](#21-fx-row--single-source-of-truth-ssot-driven)
   - [Commodities Row](#22-commodities-row)
   - [Crypto Row](#23-crypto-row)
   - [API Timing Stagger](#24-api-timing-stagger)
5. [AI Providers Leaderboard](#ai-providers-leaderboard)
6. [Support Column](#4-support-column)
7. [Visual Design](#6-visual-design)
8. [Motion & Animation](#63-motion)
9. [Tests](#75-tests)
10. [FX Picker Configuration](#fx-picker--configuration)

---

## Overview

The homepage is the user's command centre. It is built around:

- A **three-column market layout** (left rail, centre column, right rail)
- A **market belt** in the centre column with three stacked rows:
  - **FX row** (4 chips default)
  - **Commodities Movers Grid** (2×2 winners + 2×2 losers)
  - **Crypto row** (4 chips default)
- A central **AI Providers Leaderboard** panel directly under the ribbons

Everything is centred, balanced, and responsive. On larger screens the layout keeps three columns with generous breathing room around the rails; on smaller screens the layout gracefully collapses.

---

## 1.1 Overall Structure & Responsiveness

### Page Canvas (viewport-locked layout — Dec 31, 2025)

- **Background:** Deep, subtle dark gradient
- **Height:** Exactly `100dvh` — page fills viewport precisely
- **Overflow:** Hidden on html/body — NO page-level scrollbar ever appears

All scrolling happens inside individual containers:

- Providers table: scrolls vertically when content exceeds available space
- Exchange rails: scroll vertically and are synchronized (scroll one, both move)
- Each container uses `overflow-y: auto` so scrollbars only appear when needed

### Layout Structure (flex-based)

```html
<body class="h-dvh overflow-hidden">
  <div class="flex h-dvh flex-col overflow-hidden">
    <main class="flex min-h-0 flex-1 flex-col">
      <!-- Hero section: shrink-0 (fixed height) -->
      <!-- Three-column grid: flex-1 min-h-0 (fills remaining space) -->
    </main>
    <footer class="shrink-0">
      <!-- Footer: fixed height at bottom -->
    </footer>
  </div>
</body>
```

### Critical CSS Classes

| Class             | Purpose                                                              |
| ----------------- | -------------------------------------------------------------------- |
| `h-dvh`           | Exactly 100dvh (dynamic viewport height, accounts for mobile chrome) |
| `overflow-hidden` | Prevents page scroll                                                 |
| `flex-1`          | Fills available space                                                |
| `min-h-0`         | Allows flex children to shrink below content size                    |
| `shrink-0`        | Prevents shrinking (for fixed-height sections)                       |

### Three-Column Grid

The main content area is a three-column CSS grid:

- Left rail: `0.9fr`
- Centre column: `1fr`
- Right rail: `0.9fr`

---

## Hero Section Layout (Engine Bay + Mission Control)

The hero section contains two symmetrical CTA panels positioned above the exchange rails:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              HERO SECTION                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────┐                              ┌──────────────────┐  │
│  │   ENGINE BAY     │        PROMAGEN              │ MISSION CONTROL  │  │
│  │   (Left CTA)     │   Intelligent Prompt         │   (Right CTA)    │  │
│  │                  │        Builder               │                  │  │
│  │  Platform icons  │                              │  Location badge  │  │
│  │  Launch button   │   Context-driven prompts     │  Prompt preview  │  │
│  │                  │   built from live data       │  Action buttons  │  │
│  └──────────────────┘                              └──────────────────┘  │
│                                                                          │
│         width: calc((100vw - 80px) * 0.225)        (same formula)        │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Engine Bay (Left)

- Primary CTA for launching the Prompt Builder
- Shows top 10 AI provider icons (responsive grid)
- Dropdown platform selector
- Gradient "Launch Platform Builder" button
- **Authority:** `docs/authority/ignition.md`

### Mission Control (Right)

- User location reference with flag + city
- Dynamic weather-driven prompt preview (London default)
- Interactive SVG flags with weather tooltips
- Action buttons: Sign in, Studio, Pro Promagen
- **Authority:** `docs/authority/mission-control.md`

### Width Synchronization

Both panels use identical CSS calc formula to match exchange rail width:

```css
width: calc((100vw - 80px) * 0.225);
```

**File:** `src/components/layout/homepage-grid.tsx` — Lines 255 (Engine Bay), 278 (Mission Control)

### Responsive Behaviour (Updated 26 Jan 2026)

| Breakpoint | Viewport    | Engine Bay | Mission Control |
| ---------- | ----------- | ---------- | --------------- |
| Desktop XL | ≥1280px     | Visible    | Visible         |
| Desktop    | 1024-1279px | Hidden     | Hidden          |
| Tablet     | 768-1023px  | Hidden     | Hidden          |
| Mobile     | <768px      | Hidden     | Hidden          |

**Note:** Panels use `xl:block` breakpoint (≥1280px) to prevent overlap with the leaderboard at narrower viewport widths. Changed from `md:block` on 26 Jan 2026.

---

## Market Belt

The market belt is part of the centre column, not a full-width band at the absolute top of the page.

### Final Design Stack (Centre Column)

```
┌─────────────────────────────────────────┐
│  FX Row (top) – 4 chips (SSOT-driven)   │
├─────────────────────────────────────────┤
│  Commodities Movers Grid (middle)       │
│  2×2 winners (green) + 2×2 losers (red) │
├─────────────────────────────────────────┤
│  Crypto Row (bottom) – 4 chips          │
├─────────────────────────────────────────┤
│  AI Providers Leaderboard card          │
└─────────────────────────────────────────┘
```

All ribbon rows are live and share the same snap-fit architecture.
**Centre column layout:** The finance ribbon is wrapped in a shrinkable `overflow-hidden` container (`flex min-h-0 shrink flex-col gap-3 overflow-hidden`). This allows the ribbon to compress vertically when space is tight, giving the providers table room. The commodities grid auto-detects whether its bottom row fits and hides it if not.

---

## 2.1 FX Row – Single Source of Truth (SSOT) Driven

The FX row is the first strip of the market belt, sitting inside the centre column.

### Core Rule (Hard Rule)

The homepage FX row is entirely driven by:

```
frontend/src/data/fx/fx.selected.json
```

This means:

- The ribbon does not hard-code any count
- The number of FX chips shown equals the entries in the selected JSON
- To change the homepage FX set (count, order), edit that single file only

### Current Configuration

| Aspect        | Value                                          |
| ------------- | ---------------------------------------------- |
| Default pairs | 4 (`eur-usd`, `usd-jpy`, `gbp-zar`, `gbp-eur`) |
| SSOT file     | `frontend/src/data/fx/fx.selected.json`        |
| Catalog file  | `frontend/src/data/fx/fx-pairs.json`           |
| Full catalog  | 3,192 pairs                                    |

### Chip Contents

Each FX chip shows:

- **Pair label** in `BASE / QUOTE` format with flag emojis (24px flags)
- **Mid price** with tick coloring (green up, red down, neutral)
- Soft pill style: rounded corners, subtle border, dark background (`bg-slate-900`)

### Pair Label Formatting (Test-Locked)

The FX pair separator standard is **non-negotiable**.

**Rules:**

- Use the **ASCII forward slash** `/` (**U+002F**) between ISO-4217 currency codes
- **Canonical machine form:** `BASE/QUOTE` → `EUR/USD`
- **Canonical display form:** `BASE / QUOTE` (spaces around slash)

This UI spacing is protected by tests: `frontend/src/__tests__/fx-pairs.test.ts`

**Hard rules:**

- Always use plain ASCII `/` (U+002F)
- Never output a backslash `\`
- Never use look-alike characters (`⁄` fraction slash, `∕` division slash)
- Keep codes uppercase (ISO 4217)
- Spaces are required exactly as shown

**Normalisation at the borders:**

Accept common inbound variants and normalise immediately:
`EURUSD`, `EUR-USD`, `EUR_USD`, `EUR:USD`, `EUR\USD`, `EUR/USD` → `EUR/USD`

Store `base` and `quote` separately as SSOT; strings are renderings only.

### Snap-Fit Rules

| Rule           | Value                                             |
| -------------- | ------------------------------------------------- |
| Minimum font   | 10px (hard rule, never smaller)                   |
| Maximum font   | 18px                                              |
| Step size      | 0.5px increments                                  |
| Prefer         | 1 row if chips fit at >= 10px                     |
| Fallback       | 2 rows (grid layout) if 1 row cannot fit          |
| Extreme narrow | Horizontal scroll rather than reducing below 10px |

### Layout Behaviour

| Screen Size | Behaviour                              |
| ----------- | -------------------------------------- |
| Desktop     | Chips spread evenly (`justify-evenly`) |
| Medium      | Chips compress but keep alignment      |
| Small       | Falls back to 2-row grid if needed     |

### FX Files Reference

| File                                                 | Purpose                    |
| ---------------------------------------------------- | -------------------------- |
| `src/data/fx/fx.selected.json`                       | Selected pairs (SSOT)      |
| `src/data/fx/fx-pairs.json`                          | Full catalog (3,192 pairs) |
| `src/components/ribbon/finance-ribbon.tsx`           | Presentational component   |
| `src/components/ribbon/finance-ribbon.container.tsx` | Data container             |
| `src/components/ribbon/fx-pair-label.tsx`            | Pair label with flags      |
| `src/hooks/use-fx-quotes.ts`                         | Polling hook               |

### Paid Tier Behaviour

For paid users, the layout stays identical; the difference is the chosen FX set. The paid selection is still expressed through SSOT-driven configuration.

---

## 2.2 Commodities Row

The Commodities row displays a **Movers Grid** showing the top 2–4 winners and top 2–4 losers from ALL 78 tracked commodities. The grid auto-detects available height: on large screens it shows 4 cards per panel (2×2), on smaller screens the bottom row auto-hides to show 2 cards per panel (2×1).

> **⚠️ Full Documentation:** See **`docs/authority/commodities.md`** for complete technical details including:
>
> - 78-commodity catalog structure and schema
> - Gateway rolling scheduler (cold-start burst mode)
> - Marketstack API integration
> - Per-commodity cache (2h TTL) and budget management
> - SSOT flow from frontend to gateway
> - Tier differences (Free vs Pro)

### Display Format

```
┌─────────────────────────────────────┐
│ 🔥 BIGGEST MOVERS                   │
├─────────────────┬───────────────────┤
│  ☕ Coffee      │  🥇 Gold          │  ← Winners (green, +%)
│  +2.45%         │  +1.82%           │
├─────────────────┼───────────────────┤
│  🌽 Corn        │  🛢️ Brent         │  ← Losers (red, -%)
│  -3.12%         │  -1.95%           │
└─────────────────┴───────────────────┘
```

### Key Facts

| Aspect           | Value                                                      |
| ---------------- | ---------------------------------------------------------- |
| Data source      | All 78 active commodities from gateway                     |
| Display          | 2×2 or 2×1 per panel (auto-detected from available height) |
| Re-sort interval | Every 10 minutes from cached data                          |
| API timing       | :10, :40 (10-min offset from FX)                           |
| Authority doc    | `docs/authority/commodities.md`                            |

### Files Reference

| File                                                          | Purpose           |
| ------------------------------------------------------------- | ----------------- |
| `src/data/commodities/commodities.catalog.json`               | SSOT catalog (78) |
| `src/components/ribbon/commodities-movers-grid.tsx`           | UI component      |
| `src/components/ribbon/commodities-movers-grid.container.tsx` | Data container    |
| `src/components/ribbon/commodity-mover-card.tsx`              | Individual card   |
| `src/lib/commodities/sort-movers.ts`                          | Sorting algorithm |
| `src/hooks/use-commodities-quotes.ts`                         | Polling hook      |

---

## 2.3 Crypto Row

The Crypto row sits beneath Commodities in the market belt.

### Current Configuration

| Aspect        | Value                                           |
| ------------- | ----------------------------------------------- |
| Default items | 4 (`btc`, `eth`, `usdt`, `bnb`)                 |
| SSOT file     | `frontend/src/data/crypto/crypto.selected.json` |
| Catalog file  | `frontend/src/data/crypto/assets.catalog.json`  |

### Chip Contents

Each Crypto chip shows:

- **Emoji icon** (20px font in 24×24px container)
- **Name** (e.g., "Bitcoin", "Ethereum")
- **Price** in USD (e.g., "$76,128.78")
- Tick coloring (green up, red down)

### Brand Colors (Crypto)

Optimized for visibility on dark backgrounds:

| Crypto   | Color  | Hex     | Rationale                     |
| -------- | ------ | ------- | ----------------------------- |
| Bitcoin  | Orange | #F7931A | Official Bitcoin brand color  |
| Ethereum | Purple | #627EEA | Official Ethereum brand color |
| Tether   | Teal   | #26A17B | Official Tether brand color   |
| BNB      | Yellow | #F3BA2F | Official Binance brand color  |

### Price Formatting

```typescript
// Examples:
'$76,128.78'; // Bitcoin
'$2,252.97'; // Ethereum
'$0.9985'; // Tether
'$757.08'; // BNB
```

Format: `${currencySymbol}${formattedPrice}`

### Snap-Fit Rules (Same as FX)

| Rule         | Value                   |
| ------------ | ----------------------- |
| Minimum font | 10px (hard rule)        |
| Maximum font | 18px                    |
| Step size    | 0.5px increments        |
| Row gap      | 8px (`gap-2`)           |
| Layout       | `justify-evenly` spread |

### Crypto Files Reference

| File                                                | Purpose        |
| --------------------------------------------------- | -------------- |
| `src/data/crypto/crypto.selected.json`              | Selected items |
| `src/data/crypto/assets.catalog.json`               | Full catalog   |
| `src/data/crypto/crypto.schema.ts`                  | Zod validation |
| `src/components/ribbon/crypto-ribbon.tsx`           | Presentational |
| `src/components/ribbon/crypto-ribbon.container.tsx` | Data container |
| `src/hooks/use-crypto-quotes.ts`                    | Polling hook   |

---

## 2.4 API Timing Stagger

To prevent API request collisions, each ribbon type refreshes at staggered times:

| Ribbon      | Refresh Times | Offset   |
| ----------- | ------------- | -------- |
| FX          | :00, :30      | Base     |
| Commodities | :10, :40      | +10 mins |
| Crypto      | :20, :50      | +20 mins |

### Benefits

- Prevents simultaneous API calls from different ribbons
- Distributes gateway load evenly
- Reduces risk of rate limiting
- Each ribbon refreshes twice per hour (every 30 minutes)

---

## AI Providers Leaderboard

Directly under the market belt sits the AI Providers Leaderboard card.

### Table Structure (Updated 22 Jan 2026)

Header: "AI Providers Leaderboard"

**Columns (left → right) — 5 columns:**

| Column         | Width | Sortable | Notes                                                             |
| -------------- | ----- | -------- | ----------------------------------------------------------------- |
| Provider       | 30%   | No       | Icon + name + rank prefix + flag/city/clock + API/Affiliate emoji |
| Promagen Users | 18%   | No       | Top 6 country flags + Roman numerals (see cron_jobs.md)           |
| Image Quality  | 18%   | ✅ Yes   | Ordinal rank + medal + vote button, **centered**                  |
| Support        | 18%   | No       | Social media icons, **max 4 per row, centered**                   |
| Overall Score  | 16%   | ✅ Yes   | Score + trend indicator                                           |

### Column Layout Changes (22 Jan 2026)

- API/Affiliate column REMOVED — emojis (🔌/🤝) moved inline to Provider cell
- Table now has **5 columns** instead of 6
- Column widths use **proportional percentages** for fluid auto-scaling
- **Vertical grid lines** between columns (`border-r border-white/5`)
- **All headers centered** (`text-center`)
- **Mobile card view** for small screens

### Column Definitions

#### 1. Provider

Three-line layout per cell:

**Line 1:** Rank prefix + Provider name (hyperlinked) + Provider icon (PNG) + API/Affiliate emoji

- Rank: muted prefix ("1.", "2.", etc.)
- Name: hyperlinked to `/go/{id}?src=leaderboard_homepage`
- Icon: local PNG from `/icons/providers/{id}.png` (18×18px)
- API/Affiliate: 🔌 (API) / 🤝 (Affiliate) / 🔌🤝 (Both)

**Line 2:** Flag + City (from `countryCode` and `hqCity`)

**Line 3:** Clock + Prompt builder link (🎨 + "Prompt builder")

#### 2. Promagen Users

Top up to 6 countries by Promagen usage per provider.

**Hard truth rules:**

- Show only what is true (analytics-derived)
- Empty cell if zero users or stale data (>48 hours)
- Display up to 6 countries in 2×2×2 grid layout
- Format: Flag + space + Roman numeral (e.g., 🇺🇸 XLII)

> **Implementation:** See `cron_jobs.md` for database schema, cron route, and library helpers.

#### 3. Image Quality (Sortable)

- Ordinal rank (1st, 2nd, 3rd, etc.)
- Top 3 show medal: 🥇 🥈 🥉
- Vote button
- **Content centered horizontally**
- Default sort: Ascending (lower rank = better)

#### 4. Support

See §4 Support Column below.

#### 5. Overall Score (Sortable)

- 0–100 score
- Trend indicator inline (↑/↓/●)
- Default sort: Descending (higher score = better)

---

## 3. Leaderboard Visual Design

### 3.1 Leaderboard Glow Frame (22 Jan 2026)

The AI Providers Leaderboard table has a glowing border frame that wraps all 4 sides.

**Important:** The glow frame wraps ONLY the AI Providers table, NOT the Finance Ribbon above it.

**Gradient colors (matches "Intelligent Prompt Builder" heading):**

```css
sky-400:     rgb(56, 189, 248)
emerald-300: rgb(110, 231, 183)
indigo-400:  rgb(129, 140, 248)
```

**Animation:**

- Solid frame: 3-second pulse cycle, 7px thickness
- Blur glow: 5-second pulse cycle, 14px blur (offset by 0.5s)
- Opacity range: 0.2 → 1.0 → 0.2
- Respects `prefers-reduced-motion`

**CSS implementation:** Uses `mask-composite: exclude` technique to create a hollow frame.

### 3.2 Sortable Headers — Bloomberg-Style

**Visual states:**

```
INACTIVE:                    HOVER:                       ACTIVE (sorted):
┌──────────────────┐         ┌──────────────────┐         ┌──────────────────┐
│ Image Quality ⇅  │         │ Image Quality ⇅  │         │ Image Quality ▼  │
│                  │         │ ───────────────  │         │ ═══════════════  │
└──────────────────┘         └──────────────────┘         └──────────────────┘
     (dim arrows)               (underline)                   (cyan glow)
```

**Features:**

- Always-visible sort arrows: ⇅ when inactive, ▼/▲ when active
- Underline on hover: Cyan gradient, grows from center
- Glow on active: Cyan drop-shadow on arrow and text
- Toggle direction: Click same column to flip asc/desc
- Accessible: `aria-label`, `focus-visible` ring

---

## 4. Support Column (Updated 22 Jan 2026)

The Support column displays clickable social media icons for each AI provider.

### Platform Support (9 platforms)

| Platform  | Icon Color | Brand Hex | Notes                       |
| --------- | ---------- | --------- | --------------------------- |
| LinkedIn  | Blue       | #0A66C2   |                             |
| Instagram | Pink/Red   | #E4405F   |                             |
| Facebook  | Blue       | #1877F2   |                             |
| YouTube   | Red        | #FF0000   |                             |
| Discord   | Purple     | #5865F2   |                             |
| Reddit    | Orange     | #FF4500   |                             |
| TikTok    | Cyan       | #00F2EA   |                             |
| Pinterest | Red        | #E60023   |                             |
| X         | White      | #FFFFFF   | Dark outline for visibility |

**Platform order:** LinkedIn → Instagram → Facebook → YouTube → Discord → Reddit → TikTok → Pinterest → X

### Icon Specifications

- Size: 18×18px
- Color: Always full brand color (never greyscale)
- Default opacity: 70%
- Hover: 100% opacity + scale(1.15) + glow
- Click: Opens official page in new tab (`target="_blank"`)

### Layout

- **Max 4 icons per row** (ICONS_PER_ROW constant)
- **Centered horizontally** within the cell
- If 5+ icons: splits into 2 rows
  - Row 1: First 4 icons, tooltips open ABOVE
  - Row 2: Remaining icons, tooltips open BELOW

### Tooltip

- Format: `{Provider} on {Platform}` (e.g., "Midjourney on Discord")
- Glow color: Uses platform's brand color

### Empty State

- Providers without any social links show "—" (em-dash)

### Data Source

`socials` field in `providers.json`:

```json
{
  "id": "midjourney",
  "socials": {
    "instagram": "https://www.instagram.com/midjourney/",
    "discord": "https://discord.gg/midjourney",
    "x": "https://x.com/midjourney"
  }
}
```

### Coverage (as of Jan 18, 2026)

- 37 providers have X URLs
- 28 providers have at least one social link
- 14 providers have no social links (shows "—")

---

## 6. Visual Design

### 6.1 Typography

| Element                    | Size/Rule                |
| -------------------------- | ------------------------ |
| Primary font               | Inter (variable)         |
| Belt chip labels           | ≥ 10px (hard rule)       |
| Leaderboard provider name  | Normal body size         |
| Leaderboard secondary text | Small but legible        |
| Case style (belt)          | Uppercase ISO 4217 codes |
| Case style (leaderboard)   | Sentence case            |

### 6.2 Colour

| Element          | Value                              |
| ---------------- | ---------------------------------- |
| Base page        | Near-black to dark grey gradient   |
| Chips            | `bg-slate-900`, subtle border      |
| Text             | Primarily off-white                |
| Up/positive      | Green (`text-emerald-400`)         |
| Down/negative    | Red (`text-red-400`)               |
| Leaderboard glow | sky-400 → emerald-300 → indigo-400 |

### 6.3 Motion

Motion is subtle and purposeful:

- Small pulsing on live indicators
- Smooth transitions when belt content updates
- Hover states on chips and rows

Motion respects `prefers-reduced-motion` automatically.

### Leaderboard Glow Pulse

- Solid frame: 3-second cycle
- Blur glow: 5-second cycle (offset by 0.5s)
- Opacity range: 0.2 → 1.0 → 0.2

---

## 7.5 Tests (High Level)

### Ribbon Tests

- FX row renders N chips where N = `fx.selected.json` length (no hard-coded counts)
- Crypto row renders chips driven by `crypto.selected.json`
- Commodities movers grid shows 2–4 winners + 2–4 losers (auto-hides bottom row on small screens)
- SSOT order is preserved end-to-end
- Snap-fit algorithm respects 10px minimum font size
- Motion animations respect `prefers-reduced-motion`

### Leaderboard Tests

- Sortable headers show always-visible arrows (⇅ inactive, ▼/▲ active)
- Sortable headers show underline on hover
- Clicking sortable header toggles sort direction
- Image Quality sorts ascending by default
- Overall Score sorts descending by default
- Support icons are centered horizontally in cell
- Support icons show full brand color (never greyscale)
- Support column shows "—" for providers with no social links
- 2-row layout triggers when provider has 5+ social icons
- Leaderboard glow frame renders on all 4 sides of providers table
- Leaderboard glow frame does NOT wrap Finance Ribbon
- Leaderboard glow respects `prefers-reduced-motion`

---

## FX Picker & Configuration (Paid Only)

The paid experience introduces a configuration UI to adjust the homepage FX set, but the homepage still remains SSOT-driven.

### FX Picker Limits (Authority: paid_tier.md §5.5)

| Aspect             | Value                    |
| ------------------ | ------------------------ |
| **Minimum pairs**  | 6                        |
| **Maximum pairs**  | 16                       |
| **Allowed counts** | Any integer from 6 to 16 |
| **Full catalog**   | 3,192 pairs              |

---

## Related Authority Documents

| Document                            | Scope                                                                    |
| ----------------------------------- | ------------------------------------------------------------------------ |
| `docs/authority/commodities.md`     | **Full commodities system** (catalog, gateway, movers grid, rate limits) |
| `docs/authority/ignition.md`        | Engine Bay panel                                                         |
| `docs/authority/mission-control.md` | Mission Control panel                                                    |
| `docs/authority/cron_jobs.md`       | Promagen Users aggregation                                               |
| `docs/authority/paid_tier.md`       | Pro tier features and picker limits                                      |

---

## Changelog

| Date           | Change                                                                       |
| -------------- | ---------------------------------------------------------------------------- |
| **4 Feb 2026** | **Major refactor:** Removed inline commodities documentation                 |
|                | → Now references `docs/authority/commodities.md` for all commodities details |
|                | Updated FX row: 4 pairs default (was 8)                                      |
|                | Updated Crypto row: 4 items default (was 8), removed tooltips                |
|                | Updated snap-fit minimum: 10px (was 11.5px)                                  |
|                | Added Related Authority Documents section                                    |
|                | Cleaned up duplicate/outdated sections                                       |
| 26 Jan 2026    | Updated responsive breakpoints (`xl:block` instead of `md:block`)            |
| 22 Jan 2026    | Major leaderboard visual update (glow frame, sortable headers)               |
|                | Table reduced to 5 columns (API/Affiliate merged into Provider)              |
| 18 Jan 2026    | Support column: Added Pinterest and X platforms, 2-row layout                |
| 12 Jan 2026    | Commodities and Crypto ribbons went LIVE                                     |
|                | Added RibbonLabel field, brand colors, rich tooltips                         |
|                | Added API timing stagger (FX :00/:30, Commodities :10/:40, Crypto :20/:50)   |
| 10 Jan 2026    | FX SSOT consolidated into single `fx-pairs.json`                             |
| 2 Jan 2026     | Added vote button to Image Quality column                                    |
| 31 Dec 2025    | Viewport-locked layout implemented (`100dvh`)                                |

---

**Last updated:** February 4, 2026
