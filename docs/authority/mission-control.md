# Mission Control Authority Document

**Last updated:** 26 January 2026  
**Version:** 1.1.0  
**Owner:** Promagen  
**Authority:** This document defines the Mission Control component behaviour, design, and edit locations.

---

## Purpose

Mission Control is the right-side CTA panel on the homepage and Studio page, mirroring Engine Bay on the left for visual symmetry. It provides:

- User location reference with interactive tooltip
- Live weather-driven prompt preview (London default)
- Quick access to authentication, Studio/Home, and Pro Promagen
- Context-aware navigation (Studio↔Home button swap)

---

## Version History

| Version | Date        | Changes                                                                 |
| ------- | ----------- | ----------------------------------------------------------------------- |
| 1.1.0   | 26 Jan 2026 | Added `isStudioPage` prop for context-aware Studio↔Home button swap     |
| 1.0.0   | 24 Jan 2026 | Initial implementation with weather tooltips, SVG flags, dynamic prompts |

---

## File Locations

| File                                                        | Purpose                    | Lines of Interest |
| ----------------------------------------------------------- | -------------------------- | ----------------- |
| `src/components/home/mission-control.tsx`                   | Main component             | Full file         |
| `src/components/layout/homepage-grid.tsx`                   | Layout integration         | Lines 285-305     |
| `src/components/exchanges/weather/weather-prompt-tooltip.tsx` | Shared tooltip component   | Full file         |
| `docs/authority/mission-control.md`                         | This document              | —                 |

---

## Visual Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  ● Mission Control                        [🇬🇧 London]      │  ← Header row
├─────────────────────────────────────────────────────────────────┤
│  Context-driven prompts built from live stock exchanges,    │
│  FX, commodities & weather. Hover over the 🇬🇧 on exchange  │  ← Description
│  cards for dynamic, ever-changing prompts.                  │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  🇬🇧 London • Image Prompt                    [📋]  │    │  ← Preview header
│  │  "A misty London morning with golden hour light..." │    │  ← Dynamic prompt
│  └─────────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────────┤
│  [👤 Sign in]    [✨ Studio/🏠 Home]    [⭐ Pro]            │  ← Action buttons
└─────────────────────────────────────────────────────────────────┘
```

---

## Component Props

```typescript
export interface MissionControlProps {
  /** User's detected location info */
  locationInfo: {
    isLoading: boolean;
    cityName?: string;
    countryCode?: string;
  };
  /** Whether user is authenticated */
  isAuthenticated: boolean;
  /** Whether user has paid tier */
  isPaidUser: boolean;
  /** All exchanges (to find nearest for preview) */
  exchanges?: ReadonlyArray<Exchange>;
  /** Weather data indexed by exchange ID */
  weatherIndex?: Map<string, ExchangeWeatherData>;
  /** User's detected nearest exchange ID (optional) */
  nearestExchangeId?: string;
  /** Whether component is rendered on Studio page (swaps Studio↔Home button) */
  isStudioPage?: boolean;
}
```

### isStudioPage Prop (v1.1.0)

**Purpose:** Enables context-aware navigation button that changes based on current page.

| Value   | Button Label | Icon        | Destination | Use Case              |
| ------- | ------------ | ----------- | ----------- | --------------------- |
| `false` | Studio       | ✨ (Wand)   | `/studio`   | Shown on homepage     |
| `true`  | Home         | 🏠 (House)  | `/`         | Shown on Studio page  |

**Passed from:** `HomepageGrid` component

**File:** `src/components/layout/homepage-grid.tsx`  
**Lines:** 285-305

```tsx
<MissionControl
  locationInfo={locationInfo}
  isAuthenticated={isAuthenticated}
  isPaidUser={isPaidUser}
  exchanges={exchanges}
  weatherIndex={weatherIndex}
  nearestExchangeId={nearestExchangeId}
  isStudioPage={isStudioPage}  // ← NEW v1.1.0
/>
```

---

## Data Flow

### Exchange Selection Priority

The component selects a "preview exchange" for the prompt preview box:

1. **First:** User's nearest exchange (if `nearestExchangeId` provided and has weather data)
2. **Second:** London (LSE) — ID: `lse-london`
3. **Third:** Any exchange with weather data
4. **Fourth:** First exchange in array

**File:** `src/components/home/mission-control.tsx`  
**Lines:** 221-246

```typescript
// Priority order for preview exchange selection
if (nearestExchangeId) { /* try nearest first */ }
const london = exchanges.find((e) => e.id === 'lse-london' || e.city?.toLowerCase() === 'london');
const withWeather = exchanges.find((e) => weatherIndex?.has(e.id));
```

### Prompt Generation

Uses `generateWeatherPrompt()` from weather-prompt-generator with:
- City name from preview exchange
- Weather data from `weatherIndex`
- Local hour derived from exchange timezone
- Default prompt tier (Tier 4 for free users)

**File:** `src/components/home/mission-control.tsx`  
**Lines:** 249-284

---

## Interactive Elements

### 1. Location Badge (Top Right)

**Behaviour:**
- Shows "📍 Detecting..." while `locationInfo.isLoading === true`
- Shows flag emoji + city name when location detected
- Hover reveals tooltip explaining east→west exchange ordering

**File:** `src/components/home/mission-control.tsx`  
**Lines:** 341-370

### 2. Prompt Preview Box

**Components:**
- Flag emoji (hoverable) — shows full weather tooltip
- City name
- "Image Prompt" label
- Dynamic prompt text (from weather generator)
- Copy button (top right)

**Tooltip behaviour:**
- Opens LEFT + DOWN from flag (uses `horizontalPosition="left"` and `verticalPosition="below"`)
- Shows full weather context (temperature, humidity, conditions)

**File:** `src/components/home/mission-control.tsx`  
**Lines:** 471-566

### 3. Copy Button

**States:**
- Default: Clipboard icon
- Success: Checkmark icon (1.5 second timeout)

**Handler:**

```typescript
const handleCopy = useCallback(async () => {
  if (!promptPreview?.prompt) return;
  try {
    await navigator.clipboard.writeText(promptPreview.prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  } catch (err) {
    console.error('Failed to copy prompt:', err);
  }
}, [promptPreview?.prompt]);
```

**File:** `src/components/home/mission-control.tsx`  
**Lines:** 398-406

---

## Action Buttons Row (v1.1.0)

**Layout:**

```tsx
<div className="grid grid-cols-3 gap-2">
  {/* Sign In / Signed In */}
  {/* Studio or Home (context-dependent) */}
  {/* Pro / Pro Badge */}
</div>
```

**File:** `src/components/home/mission-control.tsx`  
**Lines:** 575-637

### Sign In Button

| State           | Visual        | Behaviour            |
| --------------- | ------------- | -------------------- |
| Unauthenticated | `👤 Sign in`  | Opens Clerk modal    |
| Authenticated   | `✓ Signed in` | Disabled, greyed out |

**File:** `src/components/home/mission-control.tsx`  
**Lines:** 579-597

### Studio / Home Button (Context-Dependent)

**NEW in v1.1.0:** Button changes based on `isStudioPage` prop.

| Context              | Prop Value         | Button  | Destination |
| -------------------- | ------------------ | ------- | ----------- |
| Homepage (`/`)       | `isStudioPage=false` | Studio  | `/studio`   |
| Studio page (`/studio`) | `isStudioPage=true` | Home   | `/`         |

**Implementation:**

```tsx
<Link
  href={isStudioPage ? '/' : '/studio'}
  className={actionButtonStyles}
  prefetch={false}
  aria-label={isStudioPage ? 'Return to homepage' : 'Open Prompt Studio'}
>
  {isStudioPage ? <HomeIcon /> : <WandIcon />}
  <span>{isStudioPage ? 'Home' : 'Studio'}</span>
</Link>
```

**File:** `src/components/home/mission-control.tsx`  
**Lines:** 600-609

### Pro Button

| State     | Visual                   | Behaviour                |
| --------- | ------------------------ | ------------------------ |
| Free user | `⭐ Pro` (purple border) | Links to `/pro-promagen` |
| Paid user | `⭐ Pro` (golden badge)  | Disabled, shows badge    |

**File:** `src/components/home/mission-control.tsx`  
**Lines:** 613-635

---

## Styling

### Container

```tsx
className="flex flex-col rounded-3xl bg-slate-950/70 p-4 shadow-sm ring-1 ring-white/10"
```

**File:** `src/components/home/mission-control.tsx`  
**Line:** 413

### Width Calculation

Uses same CSS calc formula as Engine Bay:

```tsx
style={{
  width: 'calc((100vw - 80px) * 0.225)',
}}
```

**File:** `src/components/layout/homepage-grid.tsx`  
**Lines:** 278-280

**Formula Breakdown:**

| Component | Value | Explanation |
|-----------|-------|-------------|
| Viewport | `100vw` | Full viewport width |
| Container padding | `32px` | `px-4` = 16px × 2 sides |
| Grid gaps | `48px` | `gap-6` = 24px × 2 gaps |
| **Subtracted** | `80px` | 32px + 48px |
| Rail fraction | `0.225` | 0.9fr ÷ 4.0fr total |

### Action Button Style

From `code-standard.md` §6.1:

```typescript
const actionButtonStyles =
  'inline-flex items-center justify-center gap-2 rounded-full border border-purple-500/70 bg-gradient-to-r from-purple-600/20 to-pink-600/20 px-4 py-2 min-h-[40px] text-sm font-medium text-purple-100 shadow-sm transition-all cursor-pointer hover:from-purple-600/30 hover:to-pink-600/30 hover:border-purple-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/80 active:scale-95';
```

**File:** `src/components/home/mission-control.tsx`  
**Lines:** 408-411

---

## Layout Symmetry with Engine Bay (v1.1.0)

Mission Control mirrors Engine Bay for perfect visual alignment:

### Vertical Spacing Pattern

| Element | Engine Bay | Mission Control | Class | Status |
|---------|------------|-----------------|-------|--------|
| Container padding | 16px | 16px | `p-4` | ✅ Match |
| Header margin-bottom | 16px | 16px | `mb-4` | ✅ Match |
| Middle section margin-bottom | 16px | 16px | `mb-4` | ✅ Match |
| Middle section height | 84px | 84px | `h-[84px]` | ✅ Match |
| Button row gap | 12px | 12px | `gap-3` | ✅ Match |
| Button padding | 12px 16px | 12px 16px | `px-4 py-3` | ✅ Match |

### Height Calculation (84px)

Engine Bay's icon grid: `ICON_CELL_SIZE` (64px) + label space (20px) = **84px**

Mission Control's content zone uses `h-[84px]` to match exactly.

---

## Responsive Behaviour (v1.1.0)

| Screen Size | Viewport   | Visibility | Notes                              |
| ----------- | ---------- | ---------- | ---------------------------------- |
| Desktop XL  | ≥1280px    | Visible    | Full panel in right header area    |
| Desktop     | 1024-1279px| Hidden     | Panel hidden to prevent overlap    |
| Tablet      | 768-1023px | Hidden     | Panel hidden                       |
| Mobile      | <768px     | Hidden     | Fallback nav shown instead         |

**File:** `src/components/layout/homepage-grid.tsx`  
**Line:** 278

**Note (v1.1.0):** Breakpoint changed from `md:block` (≥768px) to `xl:block` (≥1280px) to prevent panel overlap with the leaderboard at narrower viewport widths.

---

## SVG Flag Implementation

Uses inline SVG flags (not emoji) for consistent rendering across platforms.

**File:** `src/components/home/mission-control.tsx`  
**Lines:** 293-340

**Flag files:** `public/flags/{countryCode}.svg`

**Fallback:** Unknown country codes render as 🌐 (globe)

---

## Testing Checklist

### Visual

- [ ] Mission Control aligns with Engine Bay (symmetric positioning)
- [ ] Width matches exchange rail width exactly
- [ ] Green status dot pulses continuously
- [ ] SVG flags render correctly (not emoji)

### Location Badge

- [ ] Shows "Detecting..." while loading
- [ ] Shows correct flag + city when detected
- [ ] Tooltip appears on hover with location explanation

### Prompt Preview

- [ ] Shows London weather prompt by default
- [ ] Prompt updates when weather data changes
- [ ] Flag hover shows full weather tooltip (opens LEFT + DOWN)
- [ ] Copy button copies prompt to clipboard
- [ ] Checkmark animation shows after copy

### Action Buttons

- [ ] Sign in opens Clerk modal (unauthenticated)
- [ ] Sign in shows "✓ Signed in" (authenticated)
- [ ] **Studio links to `/studio` (from homepage, `isStudioPage=false`)**
- [ ] **Home links to `/` (from Studio page, `isStudioPage=true`)**
- [ ] Pro links to `/pro-promagen` (free user)
- [ ] Pro shows golden badge (paid user)

### Responsive

- [ ] Hidden below xl breakpoint (< 1280px)
- [ ] Fallback nav buttons appear when hidden

---

## Related Documents

| Topic                      | Document                          |
| -------------------------- | --------------------------------- |
| Engine Bay (left panel)    | `ignition.md`                     |
| Homepage layout            | `ribbon-homepage.md`              |
| Weather prompt system      | `worldprompt-creative-engine.md`  |
| Prompt tiers               | `ai_providers.md` §4              |
| Button styling             | `code-standard.md` §6.1           |
| Auth patterns              | `clerk-auth.md`                   |
| **All buttons reference**  | `buttons.md`                      |

---

## Changelog

- **26 Jan 2026 (v1.1.0):** Context-aware navigation
  - Added `isStudioPage` prop to swap Studio↔Home button based on current page
  - Homepage shows "Studio" button → `/studio`
  - Studio page shows "Home" button → `/`
  - Updated visual layout diagram to reflect context-dependent button
  - Updated testing checklist with context-aware scenarios
  - Added `buttons.md` to related documents

- **24 Jan 2026 (v1.0.0):** Initial implementation
  - Mirrors Engine Bay on right side for symmetry
  - Dynamic weather prompt preview (London default)
  - Interactive SVG flags with WeatherPromptTooltip
  - Location badge with east→west explanation tooltip
  - Action buttons: Sign in, Studio, Pro Promagen
  - Added `verticalPosition` prop to WeatherPromptTooltip for correct positioning

---

_This document is the authority for Mission Control. For Engine Bay, see `ignition.md`._

_**Key principle:** Always update docs FIRST before writing any code. Docs are the single source of truth._
