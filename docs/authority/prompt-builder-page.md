# Prompt Builder Page

**Last updated:** 9 April 2026
**Owner:** Promagen
**Authority:** This document defines the architecture and behaviour for the provider-specific prompt builder page (`/providers/[id]`).
**Cross-reference:** For unified assembly engine architecture, see `unified-prompt-brain.md`. For optimizer engine architecture, see `prompt-optimizer.md`. For colour-coded prompt anatomy, see `paid_tier.md` §5.14. For composition mode definitions, see §3-Stage Assembly Pipeline below.

---

## Purpose

When a user clicks a provider row in the Leaderboard, they navigate to a dedicated page for that provider. This page reuses the Homepage layout (exchange rails + finance ribbon) but replaces the centre leaderboard with a **full-height prompt builder workspace**.

The design philosophy: Promagen is a bridge between markets and imagination. The prompt builder page is where users craft prompts before launching into the AI provider platform.

**Authentication approach:** Anonymous users get 5 free prompts per day (resets at midnight) before sign-in required. This allows users to experience the product before committing to an account, driving higher quality sign-ups.

---

## Authentication & Access Control

### Lock States

The prompt builder has five distinct lock states with different visual treatments:

#### 1. Anonymous - Under Limit (0-4 prompts used today)

- **Visual treatment:** Normal dropdowns, fully functional
- **Usage counter:** "X/5 free prompts today" in header
- **Behaviour:** Full access to all 12 categories with standard selection limits
- **Storage:** localStorage v2 with tamper detection and daily reset tracking

#### 2. Anonymous - Limit Reached (5 prompts used today)

- **Visual treatment:** All dropdowns display **disabled styling only** (purple-tinted, reduced opacity)
- **Overlay:** Centred overlay at TOP of prompt builder section, button at top of overlay
- **Call-to-action:** "Sign in to continue" button (at top of overlay)
- **Message:** "You've used your 5 free prompts today"
- **Benefits list:** 10 prompts/day, location-based ordering, votes count
- **Behaviour:** All dropdowns disabled with purple tint, **NO overlay text on individual dropdowns**
- **Reset:** Counter resets at midnight in user's local timezone (same as authenticated users)

#### 3. Free User - Under Quota (0-9 prompts/day)

- **Visual treatment:** Normal dropdowns, fully functional
- **Usage counter:** Discrete counter showing "X/10 prompts today"
- **Behaviour:** Full access to all 12 categories with standard selection limits
- **Reset:** Counter resets at midnight in user's timezone

#### 4. Free User - Quota Reached (10/10 used)

- **Visual treatment:** All dropdowns display **disabled styling only** (purple-tinted, reduced opacity)
- **Overlay:** Centred overlay at TOP of prompt builder section, button at top of overlay
- **Call-to-action:** "Go Pro for unlimited" button (at top of overlay)
- **Message:** "Daily limit reached" + reset countdown
- **Behaviour:** All dropdowns disabled with purple tint, **NO overlay text on individual dropdowns**

#### 5. Paid User

- **Visual treatment:** Normal dropdowns, fully functional
- **No usage counter:** Unlimited daily usage
- **Platform-aware enhanced limits:** +1 bonus on stackable categories (style, lighting, colour, atmosphere, materials, fidelity, negative) — see §12-Category Dropdown System for full tier matrix
- **Behaviour:** Never locks due to usage

### Lock State Component Behaviour (v5.0.0)

When locked, the following component behaviours apply:

| Component                 | Locked Behaviour                                                                       |
| ------------------------- | -------------------------------------------------------------------------------------- |
| **Combobox dropdowns**    | Disabled styling (purple tint, `opacity-50`), NO overlay text, lock icon in label only |
| **Dropdown arrows**       | Hidden when locked                                                                     |
| **Dropdown input**        | Shows empty placeholder, cannot type                                                   |
| **Randomise button**      | Disabled (`cursor-not-allowed`, muted colors)                                          |
| **Free text input**       | Disabled, cannot type in any category                                                  |
| **Aspect ratio selector** | Disabled buttons with `opacity-50`, NO overlay text                                    |
| **Copy prompt button**    | Shows appropriate CTA based on lock reason                                             |

**Critical UX rule:** Individual dropdowns do NOT show "Sign in to continue" or other overlay text. Lock messaging appears ONLY in the central overlay at the top of the prompt builder section. This keeps the UI clean and non-repetitive.

### Usage Tracking System

**Trigger event:** "Copy prompt" button click

- This represents the moment users extract value from Promagen's curation work
- Most accurate measure of actual prompt usage
- Cleaner than tracking AI provider submissions

**Anonymous tracking (localStorage v2):**

- 5 prompts per day (resets at midnight local time)
- Key: `promagen:anonymous:usage`
- Schema version: 2 (includes daily reset tracking)
- Structure: `{ count, firstUse, lastUse, lastResetDate, version, checksum }`
- Tamper detection via checksum validation
- Daily reset: if `lastResetDate !== today`, count resets to 0

**Anonymous storage schema v2:**

```typescript
interface AnonymousUsageData {
  count: number; // Prompt copy count (resets daily)
  firstUse: string; // First use timestamp (ISO)
  lastUse: string; // Last use timestamp (ISO)
  lastResetDate: string; // Date of last reset (YYYY-MM-DD)
  version: 2; // Schema version
  checksum: string; // Tamper detection hash
}

interface AnonymousUsageState {
  count: number; // Current usage count
  limit: number; // Maximum allowed (5)
  remaining: number; // Remaining prompts
  isAtLimit: boolean; // Whether limit is reached
  resetTime: string | null; // Midnight tonight (ISO)
}
```

**Migration from v1:** Previous v1 data (without `lastResetDate`) is invalidated on read, triggering a fresh start with v2 schema.

**Authenticated tracking (Vercel KV):**

- Store daily usage in Vercel KV (consistent with voting system)
- Key format: `usage:${userId}:${date}` where date is YYYY-MM-DD in user's timezone
- Reset logic: Check if current date > stored date, reset counter if true
- Timezone detection: Use browser `Intl.DateTimeFormat().resolvedOptions().timeZone`

**Usage quota structure:**

```typescript
interface DailyUsage {
  userId: string;
  date: string; // YYYY-MM-DD in user's timezone
  promptCount: number;
  timezone: string; // For midnight reset calculation
}
```

---

## Page Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                          Finance Ribbon (FX/Crypto)                                  │
├─────────────────┬───────────────────────────────────────────────────────┬────────────┤
│                 │              PROMPT BUILDER                          │            │
│   Exchange      │  ┌───────────────────────────────────────────────┐   │    Ex-     │
│   Rail          │  │ Header: Provider · Prompt builder             │   │   change   │
│   (East)        │  │ (clean header, no badges or tags)             │   │   Rail     │
│                 │  ├───────────────────────────────────────────────┤   │   (West)   │
│   • NZX         │  │ LOCK STATE CHECK                              │   │   • Cboe   │
│   • ASX         │  │ ┌─────────────────────────────────────────┐   │   │   • B3     │
│   • TSE         │  │ │ IF ANONYMOUS & UNDER 5:                 │   │   │   • LSE    │
│   • HKEX        │  │ │   Normal dropdowns + "X/5 free today"  │   │   │   • JSE    │
│   • SET         │  │ │ IF ANONYMOUS & 5 USED TODAY:            │   │   │   • MOEX   │
│   • NSE         │  │ │   Central overlay (button at top)       │   │   │   • DFM    │
│   (synced       │  │ │   Dropdowns: disabled styling, NO text  │   │   │  (synced   │
│    scroll)      │  │ │   "Sign in to continue" + benefits      │   │   │   scroll)  │
│                 │  │ │ IF SIGNED IN & UNDER QUOTA:             │   │   │            │
│                 │  │ │   Normal dropdowns + "X/10" counter     │   │   │            │
│                 │  │ │ IF SIGNED IN & OVER QUOTA:              │   │   │            │
│                 │  │ │   Central overlay (button at top)       │   │   │            │
│                 │  │ │   Dropdowns: disabled styling, NO text  │   │   │            │
│                 │  │ │ IF PAID USER:                           │   │   │            │
│                 │  │ │   Normal dropdowns + enhanced limits    │   │   │            │
│                 │  │ └─────────────────────────────────────────┘   │   │            │
│                 │  │ ┌─────────────────────────────────────────┐   │   │            │
│                 │  │ │ Composition Mode Toggle                 │   │   │            │
│                 │  │ │ [Static|Dynamic] | Text Length Optimizer │   │   │            │
│                 │  │ └─────────────────────────────────────────┘   │   │            │
│                 │  │ 12-Category Dropdown Grid                     │   │            │
│                 │  │ Subject (1) | Action (1)    | Style (2)      │   │            │
│                 │  │ Environment(1)|Composition(1)| Camera (1)     │   │            │
│                 │  │ Lighting (2)| Colour (1)   | Atmosphere (1)  │   │            │
│                 │  │ Materials(1)| Fidelity (2) |                  │   │            │
│                 │  │ Negative (5) [full width]                     │   │            │
│                 │  ├───────────────────────────────────────────────┤   │            │
│                 │  │ Scene Starters + Explore Drawer (expandable)  │   │            │
│                 │  ├───────────────────────────────────────────────┤   │            │
│                 │  │ Platform Tips (contextual)                    │   │            │
│                 │  ├───────────────────────────────────────────────┤   │            │
│                 │  │ Stage Badge: 📋 Static | ✨ Dynamic |        │   │            │
│                 │  │              ⚡ Optimized | ✓ Optimal         │   │            │
│                 │  │ Assembled Prompt Preview         [Clear all]  │   │            │
│                 │  │ (positive only, inline copy icon float-right) │   │            │
│                 │  ├───────────────────────────────────────────────┤   │            │
│                 │  │ Optimized Prompt Preview (when optimizer ON)  │   │            │
│                 │  │ (emerald border, inline copy icon float-right)│   │            │
│                 │  │ Length Indicator + Transparency Panel          │   │            │
│                 │  ├───────────────────────────────────────────────┤   │            │
│                 │  │ Prompt Intelligence: DNA Bar, Conflict Warn,  │   │            │
│                 │  │ Smart Suggestions, Health Badge               │   │            │
│                 │  ├───────────────────────────────────────────────┤   │            │
│                 │  │ [Copy*] [🎲 Randomise**] [Save] [Done]       │   │            │
│                 │  │ [Open in Provider ↗]                          │   │            │
│                 │  │ * = Usage tracking trigger                    │   │            │
│                 │  │ ** = Disabled when locked                     │   │            │
│                 │  └───────────────────────────────────────────────┘   │            │
├─────────────────┴───────────────────────────────────────────────────────┴────────────┤
│                              Provenance Footer                                       │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

**Key visual features:**

- Prompt builder fills **full height** of centre column (aligns with exchange rails)
- Same `rounded-3xl` corners as exchange rails
- Same `bg-slate-950/70` background as exchange rails
- Same `ring-1 ring-white/10` border as exchange rails
- **Identical scrollbar styling** across all three columns
- **Disabled styling on locked dropdowns** (purple tint, no overlay text)
- **Central overlay only** for lock messaging (not per-dropdown)
- **No platform family badge** (removed — adds no value)
- **No provider tags** (removed — adds no value)
- **Clean assembled prompt output** (no "Negative prompt:" separator)
- **Inline copy icons** float-right inside both prompt preview boxes
- **Stage indicator badge** above assembled prompt preview

---

## Route Structure

**Primary route:** `/providers/[id]`

- Dynamic segment `[id]` matches provider slug from `providers.json` (e.g., `midjourney`, `leonardo`, `openai`)
- Invalid slugs render a "Provider not found" state (do not 404 — show helpful UI)

**File location:** `frontend/src/app/providers/[id]/page.tsx`

**Deprecated route:** `/providers/[id]/prompt-builder` redirects to `/providers/[id]`

---

## Layout Contract

The page MUST use `HomepageGrid` to maintain visual consistency with the homepage:

```typescript
<HomepageGrid
  mainLabel={`Prompt builder for ${provider.name}`}
  leftContent={<ExchangeList exchanges={left} ... />}
  centre={<ProviderWorkspace provider={provider} />}
  rightContent={<ExchangeList exchanges={right} ... />}
  showFinanceRibbon
/>
```

**Centre panel:** `ProviderWorkspace` wraps `PromptBuilder` in a full-height container.

---

## Component Specifications

### ProviderWorkspace

**File:** `frontend/src/components/providers/provider-workspace.tsx` (61 lines)

**Purpose:** Container that passes provider data to PromptBuilder with full-height layout and authentication checking.

```typescript
export function ProviderWorkspace({ provider }: ProviderWorkspaceProps) {
  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="provider-workspace">
      <PromptBuilder provider={toPromptBuilderProvider(provider)} />
    </div>
  );
}
```

**Note:** LaunchPanel has been removed — PromptBuilder now fills the entire centre column.

---

### PromptBuilder

**File:** `frontend/src/components/providers/prompt-builder.tsx`
**Version:** 11.0.0 (3,104 lines)

**Purpose:** Full-featured prompt crafting interface with 3-stage assembly pipeline (Static/Dynamic/Optimize), platform-specific optimization, platform-aware category limits, colour-coded prompt anatomy (Pro), lifetime prompt counter, and authentication-gated access.

**New in v11.0.0:**

- **Colour-coded prompt anatomy (Pro only):** Assembled and optimized prompt text renders terms in category colours via `parsePromptIntoSegments()` from SSOT `prompt-colours.ts`. Free users see plain monochrome text.
- **Category dropdown label colours (Pro only):** Each of the 12 category dropdown labels takes on its category colour via `labelColour` prop on Combobox v7.3.0.
- **CategoryColourLegend:** 🎨 icon in header bar (between TextLengthOptimizer and intelligence badges). Hover shows 13-colour key tooltip with emoji, label, and colour dot for each category. Restyled: solid `rgba(15, 23, 42, 0.97)` bg, `rounded-xl`, ethereal glow overlay, centred arrow.
- **Colour legend position:** Moved from "Assembled prompt" row to header bar for better visibility.
- **Lifetime prompt counter:** All 3 copy handlers (`handleCopyPrompt`, `handleCopyAssembled`, `handleCopyOptimized`) call `incrementLifetimePrompts()` from `src/lib/lifetime-counter.ts`. Feeds the Pro Gem Badge tier progression (see `paid_tier.md` §5.15).
- **Dynamic assembled prompt label:** When optimizer is ON and provider is selected, the assembled prompt box transitions: label → "Optimized prompt in [Provider] [icon]" (emerald), border → emerald, text → emerald. Condition: `isOptimizerEnabled && selectedProviderId` (no `wasOptimized` check — switches the moment optimizer is enabled).
- **Inline copy + save icons in assembled box:** Float-right clipboard SVG + SaveIcon inside the assembled prompt box (matches optimized box pattern).

**New in v10.0.0:**

- Unified Brain integration — single `assemblePrompt()` with tier-aware routing
- 3-arg signature: `assemblePrompt(platformId, selections, weatherWeightOverrides?)`
- `weatherWeightOverrides` state variable for "Try in" preload from homepage PotM
- Phase D sessionStorage preload: `promagen:preloaded-payload` + `promagen:preloaded-inspiredBy`
- Two-effect split prevents flash/re-apply bug (Effect 1: category preload, Effect 2: badge display)

**New in v8.5.0:**

- §4.5: "Try in" from homepage populates REAL DROPDOWNS (not just raw text)
- Reads `sessionStorage('promagen:preloaded-selections')` → applies to categoryState
- "Inspired by" badge shows weather context (city, venue, conditions, mood)

**New in v8.3.0:**

- Optional `providerSelector` prop for custom header (used by Playground page)
- Scene pre-load from homepage via `sessionStorage('promagen:preloaded-scene')`

**Authentication requirements:**

- Must use `usePromagenAuth({ platformId })` hook to check authentication state and get platform-aware limits
- Must check daily usage quota and user tier
- Must apply appropriate lock states based on authentication/quota status
- Must track "Copy prompt" button clicks for usage counting
- Must NOT pass `lockMessage` prop to Combobox or AspectRatioSelector (v6.4.0 change)
- Must auto-trim selections when switching platforms (v8.0.0+)

#### Props Interface

```typescript
export interface PromptBuilderProps {
  id?: string;
  provider: PromptBuilderProvider;
  onDone?: () => void;
  /** Optional: Custom element to replace the static provider title (e.g., dropdown selector) */
  providerSelector?: React.ReactNode;
}
```

#### Authentication Integration

```typescript
import { usePromagenAuth } from '@/hooks/use-promagen-auth';

export function PromptBuilder({
  id = 'prompt-builder',
  provider,
  onDone,
  providerSelector,
}: PromptBuilderProps) {
  const platformId = provider.id ?? 'default';

  const {
    isAuthenticated,
    isLoading,
    userTier,
    categoryLimits, // Platform-aware limits
    platformTier, // 1 | 2 | 3 | 4
    dailyUsage,
  } = usePromagenAuth({ platformId });

  // Lock state logic
  const isLocked =
    !isAuthenticated || (userTier === 'free' && dailyUsage.count >= dailyUsage.limit);

  // NOTE: lockMessage is NO LONGER passed to Combobox components
  // Lock messaging appears only in central overlay
}
```

#### Header Rendering (v8.3.0)

```tsx
{providerSelector ? (
  <div className="flex items-center gap-2">
    {providerSelector}
    <span className="text-sm text-slate-400">· Prompt builder</span>
  </div>
) : (
  <h2 className="text-lg font-semibold text-slate-50">{provider.name} · Prompt builder</h2>
)}
```

#### Instruction Text

```
Click Done or click away to close dropdowns. Type in any field to add custom entries.
```

#### Required Elements

1. **Header** (fixed at top): Provider name · Prompt builder, subtitle with gradient. NO badge, NO tags — clean header only.

2. **Authentication Layer** (conditional): Usage counter for free users, central lock overlay for unauthenticated or over-quota users. NO per-dropdown lock overlay text.

3. **Composition Mode Toggle + Colour Legend + Text Length Optimizer**: Static/Dynamic toggle with platform-specific tooltips. 🎨 CategoryColourLegend (Pro only) — hover shows 13-colour key. Optimizer toggle with divider. See §3-Stage Assembly Pipeline and §Colour-Coded Prompt Anatomy below.

4. **Category Dropdowns** (12 categories with platform-aware limits): Multi-select comboboxes with custom entry support. Grid: 3 columns desktop, 2 tablet, 1 mobile. Negative spans full width. ~100 options per positive category, ~1000 for negative. Platform-aware limits (see §12-Category Dropdown System). Pro Promagen bonus: +1 on stackable categories. When locked: disabled styling only, no text overlay.

5. **Scene Starters** (v9.0.0): 200 curated one-click scenes (25 free, 175 pro) across 23 worlds. Prefill 5–8 categories with tier-aware selections.

6. **Explore Drawer** (v9.0.0): Expandable vocabulary panel per category with source-grouped tabs (Core, Weather, Commodity, Shared, 🎬 Scene). Real-time search, 60-chip pagination, click-to-add, tier badges (★/◆/💬/⚡/⚠), cascade relevance ordering.

7. **Platform Tips** (contextual): Shows platform-specific guidance when relevant. Sky-blue bordered box with 💡 icon.

8. **Stage Indicator Badge**: Shows current assembly stage above the prompt preview: `📋 Static` | `✨ Dynamic` | `⚡ Optimized` | `✓ Optimal`.

9. **Assembled Prompt Preview**: Shows compiled positive prompt from `assemblePrompt(platformId, selections, weatherWeightOverrides?)`. Colour-coded by category for Pro users via `parsePromptIntoSegments()` (free users see plain `text-slate-100`). NO separator line, NO "Negative prompt:" label. Clear all button with Core Colours gradient. Inline copy icon + SaveIcon (float-right). "Inspired by" badge when pre-loaded from homepage "Try in". **Dynamic label (v11.0.0):** When `isOptimizerEnabled && selectedProviderId`, label changes to "Optimized prompt in [Provider] [icon]" (emerald), border changes to emerald, text to `text-emerald-100`.

10. **Optimized Prompt Preview** (when optimizer ON): Emerald-bordered box with optimized text, colour-coded by category for Pro users. Shows char count, removed terms, optimization transparency panel (Pro-only). Inline copy icon float-right. Length indicator below.

11. **Prompt Intelligence Section**: DNA Bar (coherence visualisation), conflict warnings (when `intelligencePrefs.conflictWarningsEnabled`), smart suggestion chips (4 compact / 6 full), health badge with coherence score.

12. **Footer** (fixed at bottom): Copy prompt button (usage tracking trigger), 🎲 Randomise (purple gradient, disabled when locked), Save to Library, Done, Open in Provider (`/go/[id]?src=prompt_builder`).

13. **Feedback System** (Phase 7.10): FeedbackInvitation widget (post-copy), FeedbackMemoryBanner (overlap hints).

---

## 3-Stage Assembly Pipeline

**Added:** 4 March 2026

The prompt builder uses a 3-stage pipeline that maps directly to the Composition Mode Toggle:

### Stage Definitions

| Stage | Mode | Function | What It Does |
| --- | --- | --- | --- |
| **1** | Static | `assembleStatic()` | Raw comma join of user selections in `CATEGORY_ORDER`. No formatting, no intelligence, no weights. |
| **2** | Dynamic | `assemblePrompt(id, sel, overrides?, { skipTrim: true })` | Platform-specific formatting: reorder by impact priority, apply CLIP weights, quality prefix/suffix, deduplication. NO length trimming. |
| **3** | Optimize | `assemblePrompt(id, sel, overrides?)` | Full Dynamic formatting WITH 5-phase trim pipeline to platform sweet spot. |

### Composition Mode Toggle

**File:** `frontend/src/components/composition-mode-toggle.tsx` (322 lines)

**Props:**

```typescript
export interface CompositionModeToggleProps {
  compositionMode: 'static' | 'dynamic';
  onModeChange: (mode: 'static' | 'dynamic') => void;
  platformId?: string;      // NEW: enables tier-specific tooltips
  disabled?: boolean;
  compact?: boolean;
}
```

**Platform-specific tooltips:** The toggle tooltip changes based on `platformId` → `getPlatformTierId()`:

- **Tier 1 (CLIP):** Explains CLIP emphasis weights `(samurai:1.2)`, quality boosters, sharpness terms
- **Tier 2 (Midjourney):** Explains `--no` block, parameter protection, steep position decay
- **Tier 3 (Natural Language):** Explains grammatical sentence building, negative-to-positive conversion
- **Tier 4 (Plain):** Explains short focused prompts, no weights
- **Static tooltip:** Always the same — raw selections, no formatting

**Tooltip body text colour:** `text-slate-300` (reverted from `text-emerald-400` for readability)

### Text Length Optimizer

**File:** `frontend/src/components/providers/text-length-optimizer.tsx` (347 lines)

- Toggle right of Static/Dynamic, separated by vertical divider
- Disabled (Core Colours at full opacity) when Static mode ON
- When enabled, shows optimized prompt preview with emerald border
- Tooltip body text colour: `text-slate-300` (reverted from `text-emerald-400`)

### Visual Diff Highlighting

When switching from Static → Dynamic, added/changed terms are highlighted with emerald background that fades after 2 seconds. Implemented via `DiffHighlightedText` inline component (prompt-builder.tsx line 352).

### Length Indicator

**File:** `frontend/src/components/providers/length-indicator.tsx` (224 lines)

Shows current prompt length relative to platform sweet spot with colour-coded status (green/amber/rose).

### Optimization Transparency Panel

**File:** `frontend/src/components/providers/optimization-transparency-panel.tsx` (419 lines)

Pro-only panel showing removed terms, phase where sweet spot was achieved, original vs optimized length.

### Inline Copy Icons

Both prompt preview boxes (assembled + optimized) have inline copy icons that float right after the last character:

- `ml-2 inline-flex float-right rounded-md p-1`
- Assembled: `bg-white/5 text-slate-400` → hover `bg-white/10 text-slate-200`
- Optimized: `bg-white/5 text-emerald-300/50` → hover `bg-white/10 text-emerald-200`
- Copied state: `bg-emerald-500/20 text-emerald-400` with checkmark SVG

### Colour-Coded Prompt Anatomy (v11.0.0 — Pro Promagen exclusive)

Pro users see colour-coded prompt text in both the assembled and optimized prompt preview boxes. Each term is coloured according to its source category, making the prompt scannable and educational. Free users see plain monochrome text (`text-slate-100` for assembled, `text-emerald-100` for optimized).

**SSOT:** `src/lib/prompt-colours.ts` (210 lines) — single source of truth for all 13 category colours, labels, emojis, `buildTermIndexFromSelections()`, and `parsePromptIntoSegments()`.

**How it works:**

1. `buildTermIndexFromSelections(selections)` builds a `Map<string, PromptCategory>` from the user's current selections (lowercased terms → category name)
2. `parsePromptIntoSegments(promptText, termIndex)` walks the prompt text and matches terms against the index, producing an array of `{ text, category }` segments
3. Each segment renders as `<span style={{ color: CATEGORY_COLOURS[category] }}>` — unmatched text gets the `structural` colour

**13 category colours:**

| Category    | Hex       | Purpose                     |
| ----------- | --------- | --------------------------- |
| Subject     | `#FCD34D` | Gold — the star of the show |
| Action      | `#A3E635` | Lime — movement / energy    |
| Style       | `#C084FC` | Purple — artistic reference |
| Environment | `#38BDF8` | Sky blue — place / setting  |
| Composition | `#34D399` | Emerald — framing           |
| Camera      | `#FB923C` | Orange — lens / angle       |
| Lighting    | `#FBBF24` | Amber — light source        |
| Colour      | `#F472B6` | Pink — colour grade         |
| Atmosphere  | `#22D3EE` | Cyan — fog / particles      |
| Materials   | `#2DD4BF` | Teal — surface / texture    |
| Fidelity    | `#93C5FD` | Soft blue — quality boosters|
| Negative    | `#F87171` | Red — constraints           |
| Structural  | `#94A3B8` | Slate — commas, glue text   |

**Category dropdown label colours:** When `isPro=true`, each of the 12 Combobox instances passes `labelColour={CATEGORY_COLOURS[category]}`. The label text renders in the category colour instead of default white.

**CategoryColourLegend:** A 🎨 icon in the header bar (between TextLengthOptimizer and intelligence badges). Hover shows tooltip with all 13 categories, each with emoji, coloured dot, and label. Restyled: solid `rgba(15, 23, 42, 0.97)` bg, `rounded-xl`, ethereal glow overlay, centred arrow, emoji `clamp(18px, 1.4vw, 22px)`, min 10px font, 400ms close delay. Width: `clamp(280px, 22vw, 340px)`.

**Human factors:** Von Restorff Effect (category isolation), Loss Aversion (free users see plain text — visible upgrade value), Colour Psychology on Dark Interfaces §17 (3× weight on dark backgrounds).

**Cross-reference:** Full tier comparison and surface list in `paid_tier.md` §5.14.

### Lifetime Prompt Counter (v11.0.0)

All 3 copy handlers in prompt-builder.tsx call `incrementLifetimePrompts()` from `src/lib/lifetime-counter.ts` on successful clipboard write. This feeds the Pro Gem Badge tier progression (see `paid_tier.md` §5.15).

**Wired handlers:**
- `handleCopyPrompt` — footer Copy button
- `handleCopyAssembled` — inline copy icon in assembled prompt box
- `handleCopyOptimized` — inline copy icon in optimized prompt box

**Storage:** `localStorage('promagen:lifetime_prompts')` — simple integer counter. Zero dependencies. SSR-safe (`typeof window === 'undefined'` guard).

---

## Usage Tracking Implementation

### Copy Prompt Button Enhancement

```typescript
// assemblePrompt now accepts optional 3rd arg: weatherWeightOverrides
const assembled = assemblePrompt(platformId, selections, weatherWeightOverrides);

const handleCopyPrompt = async () => {
  await navigator.clipboard.writeText(assembled.positive);

  // Track usage for authenticated free users
  if (isAuthenticated && userTier === 'free') {
    try {
      await trackPromptUsage(userId);
      updateDailyUsage((current) => ({
        ...current,
        count: current.count + 1,
      }));
    } catch (error) {
      console.error('Failed to track usage:', error);
    }
  }

  // Track for anonymous users (localStorage)
  if (!isAuthenticated) {
    incrementAnonymousCount();
  }

  showNotification('Prompt copied to clipboard');
};
```

### Homepage "Try in" Preload (Phase D — Unified Brain)

When a user clicks "Try in [Provider]" from the homepage PotM, the builder pre-populates via sessionStorage. See `unified-prompt-brain.md` for full architecture.

#### State Variable: `weatherWeightOverrides`

```typescript
const [weatherWeightOverrides, setWeatherWeightOverrides] = useState<
  Partial<Record<PromptCategory, number>> | undefined
>(undefined);
```

Holds per-category weight overrides from weather intelligence (e.g., `{ subject: 1.3, lighting: 1.3, environment: 1.2, composition: 1.05 }`). When defined, merges into `assemblePrompt()` as third argument. When user arrives via manual dropdown (not "Try in"), this is `undefined`.

#### SessionStorage Payload

```typescript
// Key 1: Category data + weight overrides
'promagen:preloaded-payload': {
  promptText: string;
  categoryMap?: {
    selections: Partial<Record<PromptCategory, string[]>>;
    customValues: Partial<Record<PromptCategory, string>>;
    negative: string[];
    weightOverrides?: Partial<Record<string, number>>;
    confidence?: Partial<Record<PromptCategory, number>>;
    meta: WeatherCategoryMeta;
  };
}

// Key 2: "Inspired by" badge metadata
'promagen:preloaded-inspiredBy': {
  city: string;
  venue: string;
  mood: string;
  conditions: string;
  emoji: string;
  categoryMapHash: string;
}
```

#### Two-Effect Split (Bug Fix)

**Effect 1 — Category preload (runs once on mount):** Reads `promagen:preloaded-payload`. If `categoryMap` exists, applies `selections`, `customValues`, and `weightOverrides` to builder state. Clears sessionStorage immediately.

**Effect 2 — "Inspired by" badge (runs once on mount):** Reads `promagen:preloaded-inspiredBy`. Sets display-only badge state. Does not trigger re-application of selections.

#### Weight Merge Order

**Platform wins on conflicts:**

```typescript
weightedCategories: {
  ...weatherWeightOverrides,              // weather base layer
  ...platformFormat.weightedCategories,   // platform wins
}
```

### Usage Tracking API

**Endpoint:** `POST /api/usage/track`

```typescript
// Request
{ action: 'prompt_copy' }

// Response
{ success: boolean; usage: { count: number; limit: number | null; resetTime: string } }
```

---

## 12-Category Dropdown System

### Category Order (Optimized for Prompt Construction)

Categories are ordered for optimal AI token weighting — most important terms appear first:

| #   | Category      | Label                  | Description                            |
| --- | ------------- | ---------------------- | -------------------------------------- |
| 1   | `subject`     | Subject                | Core identity — one main subject       |
| 2   | `action`      | Action / Pose          | Core identity — one primary action     |
| 3   | `style`       | Style / Rendering      | Art styles, rendering approaches       |
| 4   | `environment` | Environment            | Core identity — one setting            |
| 5   | `composition` | Composition / Framing  | One framing approach                   |
| 6   | `camera`      | Camera                 | One lens/angle                         |
| 7   | `lighting`    | Lighting               | Light sources, directions, qualities   |
| 8   | `colour`      | Colour / Grade         | Palettes, grades, tonal treatments     |
| 9   | `atmosphere`  | Atmosphere             | Environmental effects, mood            |
| 10  | `materials`   | Materials / Texture    | Textures, surfaces, materials          |
| 11  | `fidelity`    | Fidelity               | Quality boosters, resolution enhancers |
| 12  | `negative`    | Constraints / Negative | Comprehensive exclusions               |

### Platform-Aware Selection Limits (v8.2.0)

Selection limits are **platform-aware** — different AI platforms handle prompt complexity differently. Each of the 40 supported platforms is assigned to one of four tiers.

#### Platform Tier Philosophy

| Tier  | Name              | Prompt Style       | Why These Limits?                                                                   |
| ----- | ----------------- | ------------------ | ----------------------------------------------------------------------------------- |
| **1** | CLIP-Based        | Tokenized keywords | CLIP tokenizes efficiently — stacking 2-3 styles/lights produces coherent results   |
| **2** | Midjourney Family  | Parameter-rich     | Built for complex prompts — handles 3+ styles, `--no` with 8+ terms                |
| **3** | Natural Language   | Conversational     | Prefers focused prompts — too many terms cause confusion                            |
| **4** | Plain Language     | Simple prompts     | Consumer-focused — one style, one mood works best                                   |

#### Selection Limits Matrix (Standard Promagen)

| Category       | Tier 1 (CLIP) | Tier 2 (MJ) | Tier 3 (NatLang) | Tier 4 (Plain) |
| -------------- | ------------- | ----------- | ---------------- | -------------- |
| Subject        | 1             | 1           | 1                | 1              |
| Action         | 1             | 1           | 1                | 1              |
| **Style**      | 2             | 3           | 2                | 1              |
| Environment    | 1             | 1           | 1                | 1              |
| Composition    | 1             | 1           | 1                | 1              |
| Camera         | 1             | 1           | 1                | 1              |
| **Lighting**   | 2             | 3           | 2                | 1              |
| **Colour**     | 2             | 2           | 1                | 1              |
| **Atmosphere** | 2             | 2           | 1                | 1              |
| **Materials**  | 2             | 2           | 1                | 1              |
| **Fidelity**   | 2             | 3           | 2                | 1              |
| **Negative**   | 5             | 8           | 3                | 2              |

#### Pro Promagen Bonus (+1 on stackable categories)

| Category       | Tier 1 | Tier 2 | Tier 3 | Tier 4 |
| -------------- | ------ | ------ | ------ | ------ |
| Subject        | 1      | 1      | 1      | 1      |
| Action         | 1      | 1      | 1      | 1      |
| **Style**      | **3**  | **4**  | **3**  | **2**  |
| Environment    | 1      | 1      | 1      | 1      |
| Composition    | 1      | 1      | 1      | 1      |
| Camera         | 1      | 1      | 1      | 1      |
| **Lighting**   | **3**  | **4**  | **3**  | **2**  |
| **Colour**     | **3**  | **3**  | **2**  | **2**  |
| **Atmosphere** | **3**  | **3**  | **2**  | **2**  |
| **Materials**  | **3**  | **3**  | **2**  | **2**  |
| **Fidelity**   | **3**  | **4**  | **3**  | **2**  |
| **Negative**   | **6**  | **9**  | **4**  | **3**  |

**Stackable categories:** Style, Lighting, Colour, Atmosphere, Materials, Fidelity, Negative
**Non-stackable categories (always 1):** Subject, Action, Environment, Composition, Camera

#### Platform Tier Assignments (All 40 Platforms)

**Tier 1 — CLIP-Based (7 platforms):**
`stability`, `leonardo`, `clipdrop`, `nightcafe`, `dreamstudio`, `lexica`, `novelai`, `dreamlike`, `getimg`, `openart`, `playground`, `artguru`, `jasper-art`

**Tier 2 — Midjourney Family (1 platform):**
`midjourney`, `bluewillow`

**Tier 3 — Natural Language (17 platforms):**
`openai`, `adobe-firefly`, `ideogram`, `runway`, `microsoft-designer`, `bing`, `flux`, `google-imagen`, `imagine-meta`, `hotpot`

**Tier 4 — Plain Language (15 platforms):**
`canva`, `craiyon`, `deepai`, `pixlr`, `picwish`, `fotor`, `visme`, `vistacreate`, `myedit`, `simplified`, `freepik`, `picsart`, `photoleap`, `artbreeder`, `123rf`, `remove-bg`, `artistly`

#### Auto-Trim Behaviour

When a user switches platforms, selection limits may change. The system **silently trims** excess selections:

- Selections trimmed from end (keeps first N)
- No notification shown (clean UX)
- User can re-select different options if desired

#### Dynamic Tooltip Guidance

Tooltips dynamically reflect the actual limit for the current platform with proper singular/plural grammar:

- Artistly (Tier 4): "Pick 1 style. Keep it focused."
- Midjourney (Tier 2): "Pick up to 3 complementary styles. Avoid conflicting aesthetics."

### Options Per Category

| Category     | Option Count | Notes                                  |
| ------------ | ------------ | -------------------------------------- |
| Subject      | ~100         | People, creatures, objects, scenes     |
| Action       | ~100         | Poses, movements, activities           |
| Style        | ~100         | Art styles, rendering approaches       |
| Environment  | ~100         | Locations, settings, backgrounds       |
| Composition  | ~100         | Framing, perspective, layout           |
| Camera       | ~100         | Lenses, angles, technical settings     |
| Lighting     | ~100         | Light sources, directions, qualities   |
| Colour       | ~100         | Palettes, grades, tonal treatments     |
| Atmosphere   | ~100         | Environmental effects, mood            |
| Materials    | ~100         | Textures, surfaces, materials          |
| Fidelity     | ~100         | Quality boosters, resolution enhancers |
| **Negative** | **~1000**    | Comprehensive exclusions by category   |

**Total: ~2,100 curated prompt terms**

Options are stored in: `frontend/src/data/providers/prompt-options.json`

### Custom Entry Support

- Users can type custom values in any dropdown
- Pressing Enter adds the custom value as a chip
- **50 character limit** for custom entries
- Spell check enabled on input
- Pink character counter (`text-pink-500`)
- **Conditional free text for Negative category** (see below)
- **Disabled when locked** (cannot type in any category)
- **Vocab submission** (Phase 7.7): custom terms silently captured via `useVocabSubmission(platformId, platformTier)` for crowdsourced vocabulary growth

### Conditional Free Text for Negative Category

The Negative category's free text input is **platform-dependent**:

| Platform Type                              | Free Text? | Reason                        |
| ------------------------------------------ | ---------- | ----------------------------- |
| **Native negative support** (14 platforms) | ✅ Shown   | Custom terms work directly    |
| **Converted negatives** (28 platforms)     | ❌ Hidden  | Only pre-mapped terms convert |

**Platforms with native negative support:**

- Inline: Midjourney, BlueWillow, Ideogram (use `--no` or `without`)
- Separate field: Stability, Leonardo, Flux, NovelAI, Playground, NightCafe, Lexica, OpenArt, DreamStudio, Getimg, Dreamlike

**Platforms without native support (dropdown only):**

- DALL-E, Adobe Firefly, Bing, Microsoft Designer, Meta Imagine, Canva, Jasper Art, Google Imagen, and 20+ others

For these 28 platforms, custom negative text would be ignored anyway — only the pre-mapped dropdown terms work (they convert to positive equivalents).

---

## Combobox Component

**File:** `frontend/src/components/ui/combobox.tsx`
**Version:** 7.3.0 (811 lines)

### Enhanced Features for Authentication

- Multi-select with chips
- Searchable dropdown
- Custom entry on Enter (if `allowFreeText=true`)
- **Authentication-aware disabling**
- **Clean disabled styling** (no overlay text)
- **Bulletproof auto-close** when max selections reached (v6.3.0)
- **Done button** for multi-select dropdowns (limit ≥ 2)
- Tooltip on focus (shows guidance, auto-hides after 4s)
- Pink character counter for custom text
- **Double-click protection** via ref guard (v6.3.0)
- **Compact mode** for header use (v6.4.0) — hides label, tooltip, pt-8 padding
- **`labelColour` prop (v7.3.0)** — Pro Promagen feature. When set, the category label text renders in the specified colour instead of default white/slate. Used for colour-coded category headings. Example: `labelColour="#FCD34D"` makes Subject label gold.

### Auto-Close Behaviour (v6.3.0)

The dropdown **closes immediately** when the selection limit is reached:

- **Single-select (limit 1):** Closes IMMEDIATELY on click, BEFORE state update
- **Multi-select (limit 2+):** Closes when `newSelected.length >= maxSelections`
- **Done button:** Available for multi-select to close before reaching max
- **Double-click protection:** Uses ref guard to prevent race conditions

### Lock State Visual Treatment (v5.0.0)

When `isLocked=true`:

- **Disabled styling:** Purple-tinted background, reduced opacity
- **Lock icon:** Appears in label only (small, unobtrusive)
- **Dropdown arrow:** Hidden when locked
- **Input:** Shows empty placeholder, cannot type
- **NO overlay text:** The `lockMessage` prop is accepted for compatibility but NOT displayed

---

## AspectRatioSelector Component

**File:** `frontend/src/components/providers/aspect-ratio-selector.tsx` (322 lines)
**Version:** 1.2.0

When `disabled=true`: `opacity-50`, `cursor-not-allowed`, NO overlay text.

---

## File Tree

### Source Structure

```
frontend/src/
├── app/providers/[id]/
│   ├── page.tsx                    # Provider prompt builder page (auth-aware)
│   └── prompt-builder/
│       └── page.tsx                # Redirect to /providers/[id]
├── components/
│   ├── composition-mode-toggle.tsx # Static/Dynamic toggle v1.0.0 (322 lines)
│   ├── providers/
│   │   ├── prompt-builder.tsx      # Main prompt builder v11.0.0 (3,104 lines)
│   │   ├── text-length-optimizer.tsx  # Optimizer toggle v1.0.0 (392 lines)
│   │   ├── length-indicator.tsx    # Length vs sweet spot (224 lines)
│   │   ├── optimization-transparency-panel.tsx  # Pro-only detail (419 lines)
│   │   ├── aspect-ratio-selector.tsx  # AR buttons v1.2.0 (322 lines)
│   │   └── provider-workspace.tsx  # Centre column wrapper (61 lines)
│   ├── prompt-builder/
│   │   ├── four-tier-prompt-preview.tsx  # 4-tier preview with colour props (v5.0.0)
│   │   └── intelligence-panel.tsx       # Conflicts/Suggestions/Market Mood tabs
│   └── ui/
│       └── combobox.tsx            # Multi-select combobox v7.3.0 (811 lines)
├── hooks/
│   ├── use-promagen-auth.ts        # Auth, tier, limits, usage (421 lines)
│   ├── use-composition-mode.ts     # Composition mode persistence (352 lines)
│   └── use-prompt-optimization.ts  # Optimizer computation (356 lines)
├── data/
│   ├── providers/
│   │   ├── prompt-options.json     # 12 categories (~2,100 options)
│   │   └── platform-formats.json (1,624 lines))
│   └── platform-tiers.ts          # Platform → tier mapping (199 lines)
├── lib/
│   ├── prompt-builder.ts (2,190 lines))
│   │   ├── assemblePrompt(platformId, selections, weightOverrides?)  # THE ONE BRAIN
│   │   ├── assembleStatic(platformId, selections)  # Raw comma join (no intelligence)
│   │   ├── selectionsFromMap()     # Convert WeatherCategoryMap → PromptSelections
│   │   ├── getPlatformFormat()     # Looks up platform config
│   │   ├── getEffectiveOrder()     # Impact-priority category ordering
│   │   ├── assembleTierAware()     # Internal: weight merge + dedup + token estimation
│   │   ├── deduplicateWithinCategories()
│   │   ├── deduplicateAcrossCategories()
│   │   ├── estimateClipTokens()    # Token estimation for all tiers
│   │   ├── convertNegativesToPositives()
│   │   ├── supportsNativeNegative()
│   │   └── formatPromptForCopy()
│   ├── prompt-colours.ts           # SSOT: 13 category colours, labels, emojis, parser (210 lines, v1.0.0)
│   ├── lifetime-counter.ts         # incrementLifetimePrompts() + getLifetimePrompts() (33 lines, v1.0.0)
│   ├── prompt-post-process.ts      # Post-processing engine (216 lines, 6 exports)
│   ├── prompt-dna.ts              # DNA fingerprint hashing
│   ├── adaptive-weights.ts        # Weight merge: weather × platform
│   ├── category-synergy.ts        # Inter-category boost scoring
│   ├── weather/
│   │   ├── weather-category-mapper.ts  # Weather → category map (581 lines)
│   │   └── weather-prompt-generator.ts # Weather prompt engine (486 lines)
│   └── usage/
│       ├── anonymous-storage.ts    # Anonymous tracking v2.0.0 (daily reset)
│       ├── constants.ts            # Usage limits
│       └── index.ts                # Re-exports
└── types/
    └── prompt-builder.ts           # TypeScript types
        ├── PromptCategory          # 12 categories
        ├── CATEGORY_ORDER          # Optimal order for prompt construction
        ├── CATEGORY_LIMITS         # Selection limits per category
        ├── PLATFORMS_WITH_NATIVE_NEGATIVE  # 14 platforms
        ├── WeatherCategoryMap      # Structured data contract (weather → builder)
        ├── WeatherCategoryMeta     # City/venue/conditions metadata
        └── PromptDNAFingerprint    # Prompt identity hash
```

---

## Prompt Intelligence Integrations

The prompt builder integrates with the intelligence preference system via `useIntelligencePreferences()`:

| Preference | Controls |
| --- | --- |
| `liveReorderEnabled` | Cascading intelligence — downstream reorder based on upstream selections |
| `conflictWarningsEnabled` | Show conflict count badge when term conflicts detected |
| `showCoherenceScore` | Show coherence percentage in health badge |
| `suggestionsEnabled` | Show smart suggestion chips below prompt preview |
| `compactSuggestions` | 4 chips (compact) vs 6 chips (full) |
| `showDNABar` | Show prompt DNA composition bar |
| `showWhyThisTooltips` | Show explanatory tooltips on DNA bar segments |

**Market Mood toggle:** Removed from prompt builder scope (4 March 2026). The `useIntelligencePreferences` hook no longer includes `setIntelligencePref` in the prompt builder's destructuring. Market Mood removed from prompt builder scope.

---

## Scene Starters + Explore Drawer (v9.0.0)

Full documentation in `scene-starters.md` and `prompt-builder-evolution-plan-v2.md`. Summary:

### Scene Starters

- 200 curated scenes (25 free, 175 pro) across 23 worlds
- One-click prefill: 5–8 categories populated with tier-aware selections
- Pro gate: locked scenes show upgrade dialog
- Scene reset clears all prefilled categories

### Explore Drawer

- Expandable vocabulary panel per category
- Source-grouped tabs: Core, Weather, Commodity, Shared
- Active scene with `flavourPhrases` → "🎬 Scene" tab appears first
- 9,058 total terms (3,501 core + 5,557 merged)
- Tier badges: ★ (Tier 1), ◆ (Tier 2), 💬 (Tier 3), ⚡/⚠ (Tier 4)
- Cascade ordering: chips sorted by relevance score when cascade data available
- 60-chip pagination, real-time search, click-to-add
- Categories without merged data (camera, fidelity, negative) show no tabs
- Environment shows ~2,600 terms — paginated at 60 per page
- Escape key closes expanded drawer

### Analytics Events (Phase 4.2)

- `scene_selected` fires on scene activation
- `scene_reset` fires on scene clear (includes `was_modified` flag)
- `explore_drawer_opened` fires once per drawer expand
- `explore_chip_clicked` fires on chip click with category, term, platform_tier, source_tab
- `cascade_reorder_triggered` fires when cascade scoring runs

---

## Prompt Telemetry & Learning Pipeline

On every "Copy prompt" click, the builder fires telemetry via `sendPromptTelemetry()` with:

- Platform ID, tier, composition mode, optimizer state
- Health score, prompt analysis, AB test variant
- Scene ID (if from scene starter)
- User tier, account age days

This feeds the learning pipeline for weight recalibration, co-occurrence analysis, and term quality scoring.

---

## Checklist

- [x] **Full-height prompt builder** (no LaunchPanel)
- [x] **12 categories, ~100 options each** (dropdown shows ALL options)
- [x] **Anonymous 5-try feature** (localStorage tracking)
- [x] **Anonymous daily reset** (v2.0.0 - resets at midnight)
- [x] **Authentication integration** (Clerk)
- [x] **Lock state visual treatment** (disabled styling only, NO dropdown overlay text)
- [x] **Usage tracking on Copy prompt**
- [x] **Daily quota enforcement** (10/day Standard, unlimited Pro Promagen)
- [x] **Combobox v6.3.0** (bulletproof auto-close, Done button, double-click protection)
- [x] **AspectRatioSelector v1.2.0** (no lock overlay)
- [x] **Prompt builder v10.0.0** (unified brain, 3-stage pipeline, 2,746 lines)
- [x] **3-Stage Assembly Pipeline** — Static (`assembleStatic`) / Dynamic (`assemblePrompt` skipTrim) / Optimize (`assemblePrompt`)
- [x] **Composition Mode Toggle** — platform-specific tier tooltips (T1 CLIP / T2 MJ / T3 NL / T4 Plain)
- [x] **Text Length Optimizer** — with transparency panel (Pro-only)
- [x] **Visual diff highlighting** — Static → Dynamic shows emerald highlights on changed terms
- [x] **Stage indicator badge** — 📋 Static | ✨ Dynamic | ⚡ Optimized | ✓ Optimal
- [x] **Inline copy icons** — float-right in both assembled and optimized preview boxes
- [x] **Tooltip body text** — `text-slate-300` (reverted from emerald-400 for readability)
- [x] **Instruction text** — "Click Done" (not "Press Done")
- [x] **Market Mood toggle** — removed from prompt builder scope
- [x] **Vocabulary Merge** — 9,058 terms (3,501 core + 5,557 merged)
- [x] **Cascading Intelligence** — downstream dropdowns reorder based on upstream selections
- [x] **Scene Starters** — 200 curated scenes (25 free, 175 pro) with tier-aware prefills
- [x] **Explore Drawer** — expandable vocabulary panel per category with source grouping + search
- [x] **Scene flavour phrases** — 26 scenes have bonus phrases shown in Explore Drawer "🎬 Scene" tab
- [x] **All-tier chip badges** — Tier 1 ★, Tier 2 ◆, Tier 3 💬, Tier 4 ⚡/⚠
- [x] **Cascade chip ordering** — Explore chips sorted by relevance score when cascade data available
- [x] **Analytics integration** — 5 GTM events (scene_selected, scene_reset, explore_drawer_opened, explore_chip_clicked, cascade_reorder_triggered)
- [x] **Fluid typography audit** — All Phase 2–4 components use CSS clamp(). Zero fixed font sizes.
- [x] **PotM Provider Icon visibility** — `bg-white/15` background + `drop-shadow(0 0 3px rgba(255,255,255,0.4))` glow
- [x] **Vocab submission** (Phase 7.7) — custom terms silently captured
- [x] **Feedback system** (Phase 7.10) — FeedbackInvitation + FeedbackMemoryBanner
- [x] **Prompt telemetry** — fires on copy for learning pipeline
- [x] **Unified Brain** (v10.0.0) — single `assemblePrompt()` with tier-aware routing
- [x] **Phase D preload** — sessionStorage two-effect split for "Try in" from homepage
- [x] **weatherWeightOverrides** — per-category weight overrides from weather intelligence
- [x] **42-platform parity** — all platforms at architectural ceiling

---

## Test Requirements

### Authentication Tests

- Anonymous user sees usage counter (X/5 free prompts today)
- Anonymous user at limit sees central lock overlay only
- Anonymous user lock resets at midnight (daily reset)
- Free user sees usage counter (X/10 prompts today)
- Free user at quota sees central lock overlay only
- Pro Promagen user has no usage counter
- Pro Promagen user has platform-aware enhanced limits (+1 on stackable)
- **Dropdowns show disabled styling when locked, NOT overlay text**
- **Randomise button disabled when locked**
- **Free text input disabled when locked**

### Platform-Aware Limits Tests (v8.2.0)

- Artistly (Tier 4): Style limit = 1, Negative limit = 2
- Midjourney (Tier 2): Style limit = 3, Negative limit = 8
- DALL-E (Tier 3): Style limit = 2, Negative limit = 3
- Stability (Tier 1): Style limit = 2, Negative limit = 5
- **Pro Promagen on Tier 4:** Style = 2, Negative = 3
- **Pro Promagen on Tier 2:** Style = 4, Negative = 9
- **Platform switch triggers auto-trim** (excess selections removed)
- **Tooltip shows actual limit** ("Pick 1 style" vs "Pick up to 3 styles")
- **Single-select closes immediately** (no double-click possible)
- **Done button visible for multi-select** (limit ≥ 2)

### Usage Tracking Tests

- Copy prompt increments usage for free users
- Copy prompt increments anonymous localStorage
- Anonymous localStorage resets at midnight
- Usage counter updates after copy
- Lock state triggers correctly at quota boundary

### UI Consistency Tests

- Lock overlay appears at top of prompt builder only
- **NO "Sign in to continue" text on individual dropdowns**
- **Purple-pink gradient applied consistently in lock states**
- Clear all resets all selections
- Randomise populates ALL 12 categories
- Randomise fills negative with 2-3 options
- Open in Provider href matches `/go/[id]?src=prompt_builder`
- Dropdowns close when max selections reached
- Negative category free text hidden for non-native platforms

### 3-Stage Pipeline Tests (4 March 2026)

- Static mode: `assembleStatic()` returns raw comma-joined selections (no weights, no reorder)
- Dynamic mode: `assemblePrompt(skipTrim)` returns platform-formatted output (weights, reorder, quality prefix/suffix, NO trimming)
- Optimize mode: `assemblePrompt()` returns trimmed output within platform sweet spot
- Stage badge updates correctly: 📋 Static | ✨ Dynamic | ⚡ Optimized | ✓ Optimal
- Visual diff highlights appear when switching Static → Dynamic (emerald background, 2s fade)
- Inline copy icons work in both assembled and optimized preview boxes
- Dynamic config guard: all 40 platforms produce correct output per their `platform-formats.json` config
- Tooltip body text uses `text-slate-300` (NOT emerald-400)
- Composition Mode Toggle shows tier-specific Dynamic tooltip content

### Platform-Specific Tests

- Artistly outputs natural language (not SD keywords)
- Known negatives convert to positives for natural platforms
- Custom negatives use "without X" for natural platforms
- Midjourney uses `--no` syntax
- Stability uses separate negative field
- Negative free text shown for native-negative platforms
- Negative free text hidden for converted-negative platforms

### Accessibility Tests

- All interactive elements keyboard accessible
- Proper ARIA roles and labels
- Combobox announces selected items
- Lock state messages accessible via screen readers

### Scene Starters Tests (Phase 2–4)

- Scene Starters strip appears between instructions and category grid
- Collapsed by default, expands on click
- 25 free scenes accessible to all users
- 175 pro scenes visible with lock icon at 50% opacity
- Clicking free scene prefills 5–8 categories simultaneously
- Clicking pro scene (anonymous) shows "Sign in first" modal
- Clicking pro scene (free user) shows "Upgrade to Pro" dialog with link to /pro-promagen
- Active scene shows cyan tint on card + ✕ clear button in header
- Modifying scene values then resetting shows confirmation dialog
- Combobox chips from scene have cyan tint + 🎬 indicator
- Tier 4 platform shows reduced prefills (3–5 categories) with amber "⚡ reduced" label
- Affinity dots on scene cards: green (≥8), amber (6–7), red (<6)
- World pills scroll horizontally; free worlds left, pro worlds after divider

### Explore Drawer Tests (Phase 3–4)

- "Explore N more phrases ▾" trigger bar below each category dropdown
- Click to expand → search input + source tabs + chip cloud
- Categories with merged data show tabs: All, Core, Weather, Commodity, Shared
- Categories without merged data (camera, fidelity, negative) show no tabs
- Environment shows ~2,600 terms — paginated at 60 per page
- Click chip → adds to selection, chip disappears from drawer
- Fill to max → remaining chips show disabled state
- Search filters chips in real-time with highlighted matches
- Opening another drawer closes the previous (accordion behaviour)
- Active scene with flavourPhrases → "🎬 Scene" tab appears first with scene-specific phrases
- Tier 1 → ★ badges on 1–2 word chips
- Tier 2 → ◆ badges on 2–4 word chips
- Tier 3 → 💬 badges on 3+ word chips
- Tier 4 → ⚡ simple / ⚠ complex badges
- Cascade ordering: chips sorted by relevance score (not alphabetical) when cascade active
- Escape key closes expanded drawer
- Scene-flavour chips have cyan tint styling (distinct from core vocab)

### Analytics Tests (Phase 4.2)

- `scene_selected` fires on scene activation (check GTM dataLayer)
- `scene_reset` fires on scene clear (includes `was_modified` flag)
- `explore_drawer_opened` fires once per drawer expand (not on collapse)
- `explore_chip_clicked` fires on chip click with category, term, platform_tier, source_tab
- `cascade_reorder_triggered` fires when cascade scoring runs with categories_reordered count

**Test file:** `frontend/src/components/providers/__tests__/phase-4-evolution.test.ts` (63 cases)
**Test file:** `frontend/src/lib/__tests__/prompt-builder-3-stage.test.ts` (41 cases + dynamic config guard)
**Test file:** `frontend/src/components/providers/__tests__/prompt-builder.analytics.test.tsx` (1 case)

---

## Non-Regression Rule

When modifying the prompt builder page:

- Do not modify the Leaderboard page layout or behaviour
- Do not modify `HomepageGrid` unless adding new props (additive only)
- Do not modify exchange rail components
- Preserve all existing provider detail functionality
- Maintain identical scrollbar styling across all containers
- Do not change platform family mappings without updating docs
- **Preserve all existing prompt building functionality for authenticated users**
- **Do not break lock states or authentication flows**
- **Do not reintroduce lock message overlay text on dropdowns**
- **Do not modify scene-starters.json without updating scene-starters.md**
- **Do not remove scenes — only add or update existing scenes**
- **Do not modify core vocabulary files when changing merged vocabulary data**
- **Preserve Scene Starters ↔ Explore Drawer flavour phrase wiring**
- **Preserve cascade ordering in Explore Drawer chip clouds**
- **All new UI elements must use CSS clamp() for sizing — no fixed px/rem**
- **Preserve Phase D preload two-effect split — do not merge badge + selection effects**
- **Do not modify weatherWeightOverrides merge order (platform wins on conflicts)**
- **Preserve 3-stage pipeline: Static/Dynamic/Optimize must remain independent paths**
- **Do not re-add Market Mood toggle to prompt builder (removed from scope)**
- **Tooltip body text must stay text-slate-300 — do not change to emerald-400**
- **Do not duplicate CATEGORY_COLOURS — use `src/lib/prompt-colours.ts` as sole SSOT**
- **Do not hardcode category colours in components — always import from prompt-colours.ts**
- **CategoryColourLegend must stay in the header bar — do not move back to assembled prompt row**
- **Dynamic label condition is `isOptimizerEnabled && selectedProviderId` — do NOT add `wasOptimized`**
- **`incrementLifetimePrompts()` must be called in all copy handlers — do not remove from any**
- **`labelColour` prop on Combobox is Pro-only — free users must see white/slate labels**

**Existing features preserved:** Yes (required for every change)

---

## Removed Features (Historical)

These features were removed as they added no value:

| Feature                           | Removed Date | Reason                                     |
| --------------------------------- | ------------ | ------------------------------------------ |
| Platform family badge             | 1 Jan 2026   | Added visual clutter, no user value        |
| Provider tags display             | 1 Jan 2026   | Redundant with provider page               |
| "Negative prompt:" separator      | 1 Jan 2026   | Confused users, cluttered preview          |
| LaunchPanel                       | 31 Dec 2025  | Replaced by full-height prompt builder     |
| 30-item dropdown limit            | 1 Jan 2026   | Artificially hid curated options           |
| **Dropdown lock message overlay** | 4 Jan 2026   | Ugly UX, repetitive text on every dropdown |
| **Market Mood toggle**            | 4 Mar 2026   | Removed from prompt builder scope          |

---

## Changelog

- **18 Mar 2026 (v11.0.0):** **COLOUR-CODED PROMPT ANATOMY + LIFETIME COUNTER + DYNAMIC LABEL** — Pro Promagen users see colour-coded prompt text in assembled and optimized preview boxes via `parsePromptIntoSegments()` from SSOT `src/lib/prompt-colours.ts` (210 lines, 13 colours). Category dropdown labels take on their category colour via Combobox `labelColour` prop (v7.3.0, 811 lines). CategoryColourLegend moved from assembled prompt row to header bar (between TextLengthOptimizer and intelligence badges). Restyled: solid `rgba(15,23,42,0.97)` bg, `rounded-xl`, ethereal glow overlay, `clamp(280px, 22vw, 340px)` width. Dynamic assembled prompt label: when `isOptimizerEnabled && selectedProviderId`, label → "Optimized prompt in [Provider] [icon]" (emerald), border → emerald, text → emerald. Condition intentionally excludes `wasOptimized` — switches on enable, not on trimming. Inline copy + SaveIcon added to assembled prompt box (float-right, matching optimized box). `incrementLifetimePrompts()` wired into all 3 copy handlers (`handleCopyPrompt`, `handleCopyAssembled`, `handleCopyOptimized`). New file: `src/lib/lifetime-counter.ts` (33 lines). New file: `src/lib/prompt-colours.ts` (210 lines). prompt-builder.tsx grew from 2,746 to 3,104 lines. Combobox grew from ~760 to 811 lines. See `paid_tier.md` §5.14 for full colour table, §5.15 for Pro Gem Badge integration.

- **4 Mar 2026 (v10.1.0):** **3-STAGE PIPELINE + UI POLISH** — Added 3-stage assembly pipeline (Static/Dynamic/Optimize) with `assembleStatic()` for raw output. Composition Mode Toggle now accepts `platformId` prop for tier-specific Dynamic tooltips (T1 CLIP / T2 MJ / T3 NL / T4 Plain). Text Length Optimizer tooltip body text reverted from `text-emerald-400` to `text-slate-300` for readability. Instruction text changed "Press Done" → "Click Done". Stage indicator badge added (📋/✨/⚡/✓). Inline copy icons added to both assembled and optimized prompt preview boxes (float-right positioning). Visual diff highlighting on Static→Dynamic switch. Market Mood toggle removed from prompt builder scope (`setIntelligencePref` removed from destructuring). PotM ProviderIcon visibility fix: `bg-white/15` + `drop-shadow(0 0 3px rgba(255,255,255,0.4))`. All 40 platforms pushed to architectural ceiling. prompt-builder.ts (2,190 lines). New test: `prompt-builder-3-stage.test.ts` (653 lines, ~41 cases). Dynamic config guard tests cover all 40 platforms. See `unified-prompt-brain.md` for full architecture.

- **3 Mar 2026 (v10.0.0):** **UNIFIED BRAIN INTEGRATION** — `assemblePrompt()` signature updated from 2-arg `(platformId, selections)` to 3-arg `(platformId, selections, weightOverrides?)`. 7 family-specific assemblers replaced by single unified tier-aware assembler routing through `assembleKeywords()` (Tier 1+2), `assembleNaturalSentences()` (Tier 3), `assemblePlainLanguage()` (Tier 4). New internal functions: `assembleTierAware()`, `deduplicateWithinCategories()`, `deduplicateAcrossCategories()`, `estimateClipTokens()`, `getPlatformFormat()`, `getEffectiveOrder()`. New `weatherWeightOverrides` state variable for "Try in" preload. Phase D sessionStorage preload pathway with two-effect split. New types: `WeatherCategoryMap`, `WeatherCategoryMeta`, `PromptDNAFingerprint`. See `unified-prompt-brain.md` for full architecture.

- **25 Feb 2026 (v9.0.0):** **PROMPT BUILDER EVOLUTION PHASES 0–4** — Vocabulary Merge: 9,058 terms. Cascading Intelligence: downstream reorder. Scene Starters: 200 scenes. Explore Drawer: expandable per-category panels. Phase 4 polish: flavour phrases, tier badges, cascade ordering, 5 GTM events. Fluid typography: 127 clamp() calls. See `prompt-builder-evolution-plan-v2.md`.

- **8 Jan 2026 (v8.3.0):** **FREE TIER LIMIT REDUCED** — Standard Promagen 30/day → 10/day.
- **5 Jan 2026 (v8.2.0):** **PLATFORM-AWARE CATEGORY LIMITS** — Tier-based selection limits for all 40 platforms. Pro +1 bonus. Auto-trim on switch. Dynamic tooltips. Combobox v6.3.0.
- **4 Jan 2026 (v6.4.0):** **LOCK STATE UX CLEANUP** — Removed dropdown overlay text. Central overlay only.
- **4 Jan 2026 (v2.0.0 anonymous-storage):** **ANONYMOUS DAILY RESET** — 5 prompts/day resets at midnight.
- **3 Jan 2026 (v4.2):** **TERMINOLOGY UPDATE** — "paid" → "Pro Promagen", "free" → "Standard Promagen".
- **3 Jan 2026 (v4.1):** **ANONYMOUS 5-TRY UPDATE** — 5 free prompts for anonymous users. Lock states expanded to 5.
- **2 Jan 2026 (v4.0):** **MAJOR AUTHENTICATION UPDATE** — Lock states, daily quotas, usage tracking.
- **1 Jan 2026 (v3.1):** Tiered selection limits. Removed dropdown cap.
- **1 Jan 2026 (v3.0):** Added Fidelity (12 categories). ~100 options each. Removed badge/tags/separator.
- **1 Jan 2026:** Expanded to 11 categories. Randomise. Negative-to-positive conversion.
- **31 Dec 2025:** Major rewrite. Removed LaunchPanel. 9-category dropdown system.
- **28 Dec 2025:** Initial version with two-panel layout.
