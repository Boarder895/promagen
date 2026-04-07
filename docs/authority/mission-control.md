# Mission Control Authority Document

**Last updated:** 6 April 2026
**Version:** 3.0.0
**Owner:** Promagen
**Authority:** This document defines the Mission Control component behaviour, design, and edit locations.
**Source of truth:** `src/components/home/mission-control.tsx` (714 lines, v6.0.0)

---

## Purpose

Mission Control is the right-side CTA panel that appears on every page with `showMissionControl={true}` in `HomepageGrid`. It mirrors Engine Bay on the left for visual symmetry. It provides:

1. **Weather-driven prompt preview** — live weather data for the nearest exchange (London default) generates an AI image prompt via `generateWeatherPrompt()`. Users can copy it.
2. **Navigation buttons** — 3 or 4 context-sensitive buttons linking to other sections of Promagen (Home, World Context, Pro, My Prompts).

**File:** `src/components/home/mission-control.tsx`
**Rendered in:** `src/components/layout/homepage-grid.tsx` (line 891)
**Visibility:** Hidden below `xl` breakpoint (`hidden xl:block`)

---

## Where It Appears

Mission Control renders on every page that passes `showMissionControl` to `HomepageGrid`:

| Page                               | File                         | `showMissionControl` |
| ---------------------------------- | ---------------------------- | -------------------- |
| Homepage (`/`)                     | `new-homepage-client.tsx`    | `true`               |
| Prompt Lab (`/studio/playground`)  | `playground-page-client.tsx` | `true`               |
| Provider pages (`/providers/[id]`) | `provider-page-client.tsx`   | `true`               |
| World Context (`/world-context`)   | `homepage-client.tsx`        | `true`               |
| Pro Promagen (`/pro-promagen`)     | `pro-promagen-client.tsx`    | `true`               |
| My Prompts (`/studio/library`)     | `library-client.tsx`         | `true`               |

---

## Three Sections

### 1. Header

- Green pulsing dot (`#10B981`, `clamp(8px, 0.4vw, 14px)`)
- "MISSION CONTROL" label (monospace, uppercase, tracking-wider, `text-slate-400`)
- "Smart Dynamic Automated Prompts" (gradient text: sky-400 → emerald-300 → indigo-400)

### 2. Content Zone

Height-locked to match Engine Bay icon grid: `height: 'clamp(12px, 3.5vw, 64px)'`

Contains:

- **Flag image** — country flag for the preview exchange, with `WeatherPromptTooltip` wrapper (hover to see full weather prompt with tier selector)
- **City label** — "{cityName} Real Time Text Prompt" via `FitText` component (auto-scales 9–16px using ResizeObserver + binary search)
- **Copy button** — copies the generated weather prompt to clipboard. Shows green checkmark for 1.5s after copy.
- **Instruction text** — "Hover over a countries flag for an image prompt." (amber, italic, pulsing)

### 3. Action Zone — Navigation Buttons

3 or 4 buttons in a CSS grid. Button set varies by current page:

| Current Page     | Buttons (left → right)                     | Grid Cols        |
| ---------------- | ------------------------------------------ | ---------------- |
| Homepage (`/`)   | World Context \| Pro \| My Prompts         | 3                |
| World Context    | Home \| Pro \| My Prompts                  | 3                |
| Pro Promagen     | World Context \| Home \| My Prompts        | 3                |
| Provider pages   | Home \| World Context \| Pro \| My Prompts | 4                |
| Studio sub-pages | Home \| World Context \| Pro \| My Prompts | 4                |
| My Prompts       | Home \| World Context \| Pro               | 3 (no self-link) |

**Rule:** The button for the current page is never shown (no self-link).

---

## Props

```typescript
export interface MissionControlProps {
  providers?: unknown[];
  exchanges?: readonly Exchange[];
  weatherIndex?: Map<string, ExchangeWeatherData>;
  nearestExchangeId?: string;
  isStudioPage?: boolean; // /studio hub
  isProPromagenPage?: boolean; // /pro-promagen
  isStudioSubPage?: boolean; // /studio/* sub-pages (Prompt Lab, Library)
  isWorldContextPage?: boolean; // /world-context
  isMyPromptsPage?: boolean; // /studio/library
}
```

---

## Weather Logic

Uses `generateWeatherPrompt()` from `src/lib/weather/weather-prompt-generator.ts`.

**Exchange selection priority:**

1. `nearestExchangeId` (if provided and has weather data)
2. LSE London — tries IDs: `lse-london`, `lse`, `london`, then city match `london`
3. Any exchange with weather data
4. First exchange in list (fallback, no weather)

**Weather data source:** `weatherIndex` Map, same data as exchange cards. Handles compound keys (e.g. `lse-london::ftse_100` → `lse-london`).

**Prompt tier:** Uses `useGlobalPromptTier('mission-control')` for tier selection. Tier selector accessible via the `WeatherPromptTooltip` on flag hover.

---

## Button Styles

All buttons use the same base + active style:

```typescript
// Base: rounded-xl, border, gradient background, shadow
const actionButtonBase =
  "inline-flex w-full flex-col items-center justify-center overflow-hidden rounded-xl border text-center font-semibold shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/80";

// Active state: purple/pink gradient
const actionButtonActive =
  "border-purple-500/70 bg-gradient-to-r from-purple-600/20 to-pink-600/20 text-purple-100 hover:from-purple-600/30 hover:to-pink-600/30 hover:border-purple-400 cursor-pointer";
```

**Icon paths:** All buttons use SVG paths from Heroicons, rendered inline. Each button has an icon + label (icon above, text below). Gap between buttons: `clamp(8px, 0.8vw, 12px)`.

| Button        | Icon                               | Links To          |
| ------------- | ---------------------------------- | ----------------- |
| Home          | House (Heroicons `home`)           | `/`               |
| World Context | Globe (Heroicons `globe-americas`) | `/world-context`  |
| Pro           | Stars (Heroicons `sparkles`)       | `/pro-promagen`   |
| My Prompts    | Bookmark (Heroicons `bookmark`)    | `/studio/library` |

---

## FitText Sub-Component

Auto-scales text to fit container width. Used for the city label to prevent overflow on narrow viewports.

**Algorithm:** Binary search between `min` and `max` font size. Renders text in a hidden measurement span, checks `scrollWidth` vs `containerWidth`, adjusts. Re-measures on container resize via `ResizeObserver`.

```typescript
interface FitTextProps {
  children: React.ReactNode;
  min?: number; // default 10
  max?: number; // default 24
  className?: string;
}
```

---

## File Locations

| File                                                          | Purpose                                                    |
| ------------------------------------------------------------- | ---------------------------------------------------------- |
| `src/components/home/mission-control.tsx`                     | Main component (714 lines, v6.0.0)                         |
| `src/components/layout/homepage-grid.tsx`                     | Renders MC when `showMissionControl` is true               |
| `src/lib/weather/weather-prompt-generator.ts`                 | `generateWeatherPrompt()` — creates weather-driven prompts |
| `src/hooks/use-global-prompt-tier.ts`                         | Tier selection hook (shared across MC instances)           |
| `src/components/exchanges/weather/weather-prompt-tooltip.tsx` | Tooltip with tier selector on flag hover                   |
| `docs/authority/buttons.md`                                   | Button styling authority (cross-reference)                 |

---

## Known Issues

1. **Grey text:** `text-slate-400` appears on the "MISSION CONTROL" label (line 520) and the FitText city label (line 605). Violates `code-standard.md` v5.0 §6.0.2 (no grey text). Should be replaced with `text-slate-200` or `text-white/70`.
2. **Instruction text typo:** "Hover over a countries flag" should be "Hover over a country's flag" (line 671).

---

## Changelog

- **6 Apr 2026 (v3.0.0):** Complete rewrite from src.zip SSoT. Component is v6.0.0 (715 lines). Previous doc (v2.0.0, Jan 28) focused on button colour inheritance bug from v2.0.0 — that's long fixed. New doc documents: all 6 page contexts with button layouts, full props interface, weather logic with exchange selection priority, FitText sub-component, action zone grid layout, content zone height-lock. Known grey text violations flagged. File locations updated.
- **28 Jan 2026 (v2.0.0):** Text/icon colour inheritance fix. Documented MANDATORY `text-purple-100` on child SVG/span elements.
- **24 Jan 2026 (v1.0.0):** Initial implementation.

---

_This document is the authority for the Mission Control component. `src.zip` is the Single Source of Truth — every prop, button layout, and style verified by code inspection._
