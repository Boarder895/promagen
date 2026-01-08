# Prompt Builder Page

**Last updated:** 8 January 2026  
**Owner:** Promagen  
**Authority:** This document defines the architecture and behaviour for the provider-specific prompt builder page (`/providers/[id]`).

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

#### 3. Free User - Under Quota (0-29 prompts/day)
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
- **Platform-aware enhanced limits:** +1 bonus on stackable categories (style, lighting, colour, atmosphere, materials, fidelity, negative) â€” see Â§12-Category Dropdown System for full tier matrix
- **Behaviour:** Never locks due to usage

### Lock State Component Behaviour (v5.0.0)

When locked, the following component behaviours apply:

| Component | Locked Behaviour |
|-----------|-----------------|
| **Combobox dropdowns** | Disabled styling (purple tint, `opacity-50`), NO overlay text, lock icon in label only |
| **Dropdown arrows** | Hidden when locked |
| **Dropdown input** | Shows empty placeholder, cannot type |
| **Randomise button** | Disabled (`cursor-not-allowed`, muted colors) |
| **Free text input** | Disabled, cannot type in any category |
| **Aspect ratio selector** | Disabled buttons with `opacity-50`, NO overlay text |
| **Copy prompt button** | Shows appropriate CTA based on lock reason |

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
  count: number;           // Prompt copy count (resets daily)
  firstUse: string;        // First use timestamp (ISO)
  lastUse: string;         // Last use timestamp (ISO)
  lastResetDate: string;   // Date of last reset (YYYY-MM-DD)
  version: 2;              // Schema version
  checksum: string;        // Tamper detection hash
}

interface AnonymousUsageState {
  count: number;           // Current usage count
  limit: number;           // Maximum allowed (5)
  remaining: number;       // Remaining prompts
  isAtLimit: boolean;      // Whether limit is reached
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
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                          Finance Ribbon (FX/Crypto)                          â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚                 â”‚              PROMPT BUILDER                      â”‚       â”‚
â”‚   Exchange      â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â” â”‚    Ex-â”‚
â”‚   Rail          â”‚  â”‚ Header: Provider Â· Prompt builder           â”‚ â”‚   change â”‚
â”‚   (East)        â”‚  â”‚ (clean header, no badges or tags)           â”‚ â”‚   Rail   â”‚
â”‚                 â”‚  â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤ â”‚   (West) â”‚
â”‚   â€¢ NZX         â”‚  â”‚ LOCK STATE CHECK                             â”‚ â”‚   â€¢ Cboe â”‚
â”‚   â€¢ ASX         â”‚  â”‚ â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”â”‚ â”‚   â€¢ B3   â”‚
â”‚   â€¢ TSE         â”‚  â”‚ â”‚ IF ANONYMOUS & UNDER 5:                    â”‚â”‚ â”‚   â€¢ LSE  â”‚
â”‚   â€¢ HKEX        â”‚  â”‚ â”‚   Normal dropdowns + "X/5 free today"     â”‚â”‚ â”‚   â€¢ JSE  â”‚
â”‚   â€¢ SET         â”‚  â”‚ â”‚ IF ANONYMOUS & 5 USED TODAY:               â”‚â”‚ â”‚   â€¢ MOEX â”‚
â”‚   â€¢ NSE         â”‚  â”‚ â”‚   Central overlay (button at top)         â”‚â”‚ â”‚   â€¢ DFM  â”‚
â”‚   (synced       â”‚  â”‚ â”‚   Dropdowns: disabled styling, NO text    â”‚â”‚ â”‚  (synced â”‚
â”‚    scroll)      â”‚  â”‚ â”‚   "Sign in to continue" + benefits        â”‚â”‚ â”‚   scroll)â”‚
â”‚                 â”‚  â”‚ â”‚ IF SIGNED IN & UNDER QUOTA:               â”‚â”‚ â”‚          â”‚
â”‚                 â”‚  â”‚ â”‚   Normal dropdowns + "X/10" counter       â”‚â”‚ â”‚          â”‚
â”‚                 â”‚  â”‚ â”‚ IF SIGNED IN & OVER QUOTA:                â”‚â”‚ â”‚          â”‚
â”‚                 â”‚  â”‚ â”‚   Central overlay (button at top)         â”‚â”‚ â”‚          â”‚
â”‚                 â”‚  â”‚ â”‚   Dropdowns: disabled styling, NO text    â”‚â”‚ â”‚          â”‚
â”‚                 â”‚  â”‚ â”‚ IF PAID USER:                             â”‚â”‚ â”‚          â”‚
â”‚                 â”‚  â”‚ â”‚   Normal dropdowns + enhanced limits      â”‚â”‚ â”‚          â”‚
â”‚                 â”‚  â”‚ â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜â”‚ â”‚          â”‚
â”‚                 â”‚  â”‚ 12-Category Dropdown Grid                    â”‚ â”‚          â”‚
â”‚                 â”‚  â”‚ Subject (1) | Action (1)    | Style (2)      â”‚ â”‚          â”‚
â”‚                 â”‚  â”‚ Environment(1)| Composition(1)| Camera (1)    â”‚ â”‚          â”‚
â”‚                 â”‚  â”‚ Lighting (2)| Colour (1)   | Atmosphere (1)   â”‚ â”‚          â”‚
â”‚                 â”‚  â”‚ Materials(1)| Fidelity (2) |                  â”‚ â”‚          â”‚
â”‚                 â”‚  â”‚ Negative (5) [full width]                    â”‚ â”‚          â”‚
â”‚                 â”‚  â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤ â”‚          â”‚
â”‚                 â”‚  â”‚ Platform Tips (contextual)                   â”‚ â”‚          â”‚
â”‚                 â”‚  â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤ â”‚          â”‚
â”‚                 â”‚  â”‚ Assembled Prompt Preview         [Clear all] â”‚ â”‚          â”‚
â”‚                 â”‚  â”‚ (positive prompt only, no separator)         â”‚ â”‚          â”‚
â”‚                 â”‚  â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤ â”‚          â”‚
â”‚                 â”‚  â”‚ [Copy] [ðŸŽ² Randomise] [Done] [Open in â†—]     â”‚ â”‚          â”‚
â”‚                 â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜ â”‚          â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚                              Provenance Footer                               â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

**Key visual features:**
- Prompt builder fills **full height** of centre column (aligns with exchange rails)
- Same `rounded-3xl` corners as exchange rails
- Same `bg-slate-950/70` background as exchange rails
- Same `ring-1 ring-white/10` border as exchange rails
- **Identical scrollbar styling** across all three columns
- **Disabled styling on locked dropdowns** (purple tint, no overlay text)
- **Central overlay only** for lock messaging (not per-dropdown)
- **No platform family badge** (removed â€” adds no value)
- **No provider tags** (removed â€” adds no value)
- **Clean assembled prompt output** (no "Negative prompt:" separator)

---

## Route Structure

**Primary route:** `/providers/[id]`

- Dynamic segment `[id]` matches provider slug from `providers.json` (e.g., `midjourney`, `leonardo`, `openai`)
- Invalid slugs render a "Provider not found" state (do not 404 â€” show helpful UI)

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

**File:** `frontend/src/components/providers/provider-workspace.tsx`

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

**Note:** LaunchPanel has been removed â€” PromptBuilder now fills the entire centre column.

---

### PromptBuilder

**File:** `frontend/src/components/providers/prompt-builder.tsx`
**Version:** 8.3.0

**Purpose:** Full-featured prompt crafting interface with platform-specific optimization, platform-aware category limits, and authentication-gated access.

**New in v8.3.0:**
- Optional `providerSelector` prop for custom header (used by Playground page)
- When provided, renders custom element instead of static "Provider · Prompt builder" title
- Enables builder-first flow with provider dropdown

**New authentication requirements:**
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
    categoryLimits,    // Platform-aware limits
    platformTier,      // 1 | 2 | 3 | 4
    dailyUsage 
  } = usePromagenAuth({ platformId });

  // Lock state logic
  const isLocked = !isAuthenticated || 
    (userTier === 'free' && dailyUsage.count >= dailyUsage.limit);

  // NOTE: lockMessage is NO LONGER passed to Combobox components
  // Lock messaging appears only in central overlay
  
  // categoryLimits now reflects platform capabilities
  // e.g., Midjourney (Tier 2): style=3, Artistly (Tier 4): style=1

  // Rest of component...
}
```

#### Header Rendering (v8.3.0)

```tsx
{/* Provider selector (Playground) or static title (Provider page) */}
{providerSelector ? (
  <div className="flex items-center gap-2">
    {providerSelector}
    <span className="text-sm text-slate-400">· Prompt builder</span>
  </div>
) : (
  <h2 className="text-lg font-semibold text-slate-50">
    {provider.name} · Prompt builder
  </h2>
)}
```

#### Structure

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ HEADER (shrink-0)                                               â”‚
â”‚ â€¢ Provider name Â· Prompt builder                                â”‚
â”‚ â€¢ "Build your prompt by selecting from the criteria below..."   â”‚
â”‚ â€¢ (NO badge, NO tags â€” clean header only)                       â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚ AUTHENTICATION LAYER (conditional)                             â”‚
â”‚ â€¢ Usage counter (if free user): "X/10 prompts today"           â”‚
â”‚ â€¢ Central lock overlay (if not authenticated or over quota)    â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚ SCROLLABLE CONTENT (flex-1, overflow-y-auto)                    â”‚
â”‚ â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â” â”‚
â”‚ â”‚ 12-Category Dropdown Grid (3 columns on desktop)            â”‚ â”‚
â”‚ â”‚ Row 1: Subject (1)   | Action (1)      | Style (1-4*)       â”‚ â”‚
â”‚ â”‚ Row 2: Environment(1)| Composition (1) | Camera (1)         â”‚ â”‚
â”‚ â”‚ Row 3: Lighting (1-4*)| Colour (1-3*)  | Atmosphere (1-3*)  â”‚ â”‚
â”‚ â”‚ Row 4: Materials(1-3*)| Fidelity (1-4*)| [empty]            â”‚ â”‚
â”‚ â”‚ Row 5: Constraints/Negative (2-9*) [full width]             â”‚ â”‚
â”‚ â”‚ * = Platform-aware: varies by platform tier + user tier     â”‚ â”‚
â”‚ â”‚ When locked: disabled styling only, NO overlay text         â”‚ â”‚
â”‚ â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜ â”‚
â”‚ â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â” â”‚
â”‚ â”‚ Platform Tips (contextual, sky-coloured box)                â”‚ â”‚
â”‚ â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜ â”‚
â”‚ â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â” â”‚
â”‚ â”‚ Assembled Prompt Preview                      [Clear all]   â”‚ â”‚
â”‚ â”‚ â€¢ Shows positive prompt ONLY (no separator, no neg label)   â”‚ â”‚
â”‚ â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜ â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚ FOOTER (shrink-0)                                               â”‚
â”‚ [ðŸ“‹ Copy prompt*] [ðŸŽ² Randomise**] [âœ“ Done] [â†— Open in Provider] â”‚
â”‚ * = Usage tracking trigger                                      â”‚
â”‚ ** = Disabled when locked                                       â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

#### Required Elements

1. **Header** (fixed at top)
   - Provider name + "Prompt builder" (h2)
   - Subtitle with gradient: "Build your prompt by selecting from the criteria below. Not every field is required, but the more detail you provide, the better your results will be. Custom entries accepted."
   - ~~Platform family badge~~ **REMOVED** â€” adds no value
   - ~~Provider tags~~ **REMOVED** â€” adds no value

2. **Authentication Layer** (conditional)
   - Usage counter for free users (discrete, non-intrusive)
   - Central lock overlay for unauthenticated or over-quota users
   - **NO per-dropdown lock overlay text** (v5.0.0+ change)

3. **Category Dropdowns** (12 categories with platform-aware limits)
   - Multi-select comboboxes with custom entry support
   - Grid layout: 3 columns on desktop, 2 on tablet, 1 on mobile
   - Negative prompt spans full width
   - **~100 options per positive category**
   - **~1000 options for negative category**
   - **Platform-aware limits:** Different platforms get different selection counts (see Â§12-Category Dropdown System)
   - **Pro Promagen bonus:** +1 on stackable categories
   - **When locked:** disabled styling only, no text overlay

4. **Platform Tips** (contextual)
   - Shows platform-specific guidance when relevant
   - Sky-blue bordered box with ðŸ’¡ icon

5. **Assembled Prompt Preview**
   - Shows the compiled **positive prompt only**
   - **NO separator line** (removed)
   - **NO "Negative prompt:" label** (removed)
   - Clear all button with **Core Colours gradient** (`from-sky-400 via-emerald-300 to-indigo-400`)
   - Scrollable if prompt is long

6. **Footer** (fixed at bottom)
   - **Copy prompt button** (usage tracking trigger)
   - ðŸŽ² Randomise button (purple gradient) â€” **disabled when locked**
   - Done button
   - Open in Provider button (links to `/go/[id]`)

---

## 12-Category Dropdown System

### Category Order (Optimized for Prompt Construction)

Categories are ordered for optimal AI token weighting â€” most important terms appear first:

| # | Category | Label | Description |
|---|----------|-------|-------------|
| 1 | `subject` | Subject | Core identity â€” one main subject |
| 2 | `action` | Action / Pose | Core identity â€” one primary action |
| 3 | `style` | Style / Rendering | Art styles, rendering approaches |
| 4 | `environment` | Environment | Core identity â€” one setting |
| 5 | `composition` | Composition / Framing | One framing approach |
| 6 | `camera` | Camera | One lens/angle |
| 7 | `lighting` | Lighting | Light sources, directions, qualities |
| 8 | `colour` | Colour / Grade | Palettes, grades, tonal treatments |
| 9 | `atmosphere` | Atmosphere | Environmental effects, mood |
| 10 | `materials` | Materials / Texture | Textures, surfaces, materials |
| 11 | `fidelity` | Fidelity | Quality boosters, resolution enhancers |
| 12 | `negative` | Constraints / Negative | Comprehensive exclusions |

### Platform-Aware Selection Limits (v8.2.0)

Selection limits are **platform-aware** â€” different AI platforms handle prompt complexity differently. Each of the 42 supported platforms is assigned to one of four tiers.

#### Platform Tier Philosophy

| Tier | Name | Prompt Style | Why These Limits? |
|------|------|--------------|-------------------|
| **1** | CLIP-Based | Tokenized keywords | CLIP tokenizes efficiently â€” stacking 2-3 styles/lights produces coherent results |
| **2** | Midjourney Family | Parameter-rich | Built for complex prompts â€” handles 3+ styles, `--no` with 8+ terms |
| **3** | Natural Language | Conversational | Prefers focused prompts â€” too many terms cause confusion |
| **4** | Plain Language | Simple prompts | Consumer-focused â€” one style, one mood works best |

#### Selection Limits Matrix (Standard Promagen)

| Category | Tier 1 (CLIP) | Tier 2 (MJ) | Tier 3 (NatLang) | Tier 4 (Plain) |
|----------|---------------|-------------|------------------|----------------|
| Subject | 1 | 1 | 1 | 1 |
| Action | 1 | 1 | 1 | 1 |
| **Style** | 2 | 3 | 2 | 1 |
| Environment | 1 | 1 | 1 | 1 |
| Composition | 1 | 1 | 1 | 1 |
| Camera | 1 | 1 | 1 | 1 |
| **Lighting** | 2 | 3 | 2 | 1 |
| **Colour** | 2 | 2 | 1 | 1 |
| **Atmosphere** | 2 | 2 | 1 | 1 |
| **Materials** | 2 | 2 | 1 | 1 |
| **Fidelity** | 2 | 3 | 2 | 1 |
| **Negative** | 5 | 8 | 3 | 2 |

#### Pro Promagen Bonus (+1 on stackable categories)

| Category | Tier 1 | Tier 2 | Tier 3 | Tier 4 |
|----------|--------|--------|--------|--------|
| Subject | 1 | 1 | 1 | 1 |
| Action | 1 | 1 | 1 | 1 |
| **Style** | **3** | **4** | **3** | **2** |
| Environment | 1 | 1 | 1 | 1 |
| Composition | 1 | 1 | 1 | 1 |
| Camera | 1 | 1 | 1 | 1 |
| **Lighting** | **3** | **4** | **3** | **2** |
| **Colour** | **3** | **3** | **2** | **2** |
| **Atmosphere** | **3** | **3** | **2** | **2** |
| **Materials** | **3** | **3** | **2** | **2** |
| **Fidelity** | **3** | **4** | **3** | **2** |
| **Negative** | **6** | **9** | **4** | **3** |

**Stackable categories:** Style, Lighting, Colour, Atmosphere, Materials, Fidelity, Negative  
**Non-stackable categories (always 1):** Subject, Action, Environment, Composition, Camera

#### Platform Tier Assignments (All 42 Platforms)

**Tier 1 â€” CLIP-Based (13 platforms):**
`stability`, `leonardo`, `clipdrop`, `nightcafe`, `dreamstudio`, `lexica`, `novelai`, `dreamlike`, `getimg`, `openart`, `playground`, `artguru`, `jasper-art`

**Tier 2 â€” Midjourney Family (2 platforms):**
`midjourney`, `bluewillow`

**Tier 3 â€” Natural Language (10 platforms):**
`openai`, `adobe-firefly`, `ideogram`, `runway`, `microsoft-designer`, `bing`, `flux`, `google-imagen`, `imagine-meta`, `hotpot`

**Tier 4 â€” Plain Language (17 platforms):**
`canva`, `craiyon`, `deepai`, `pixlr`, `picwish`, `fotor`, `visme`, `vistacreate`, `myedit`, `simplified`, `freepik`, `picsart`, `photoleap`, `artbreeder`, `123rf`, `remove-bg`, `artistly`

#### Auto-Trim Behaviour

When a user switches platforms, selection limits may change. The system **silently trims** excess selections:

- Selections trimmed from end (keeps first N)
- No notification shown (clean UX)
- User can re-select different options if desired

**Example:** User on Midjourney (Tier 2) with 3 styles â†’ switches to Artistly (Tier 4) â†’ 2 styles automatically removed, 1 remains.

#### Dynamic Tooltip Guidance

Tooltips dynamically reflect the actual limit for the current platform with proper singular/plural grammar:

- Artistly (Tier 4): "Pick 1 style. Keep it focused."
- Midjourney (Tier 2): "Pick up to 3 complementary styles. Avoid conflicting aesthetics."

### Implementation

```typescript
import { usePromagenAuth } from '@/hooks/use-promagen-auth';

// Platform tier is determined automatically from provider.id
const { categoryLimits, platformTier } = usePromagenAuth({ platformId: provider.id });

// categoryLimits is now platform-aware
// e.g., { style: 3, lighting: 3, negative: 8 } for Midjourney
// e.g., { style: 1, lighting: 1, negative: 2 } for Artistly

// Use in Combobox
<Combobox
  maxSelections={categoryLimits[category] ?? 1}
  tooltipGuidance={getDynamicTooltipGuidance(category, categoryLimits[category])}
  ...
/>
```

### Options Per Category

| Category | Option Count | Notes |
|----------|--------------|-------|
| Subject | ~100 | People, creatures, objects, scenes |
| Action | ~100 | Poses, movements, activities |
| Style | ~100 | Art styles, rendering approaches |
| Environment | ~100 | Locations, settings, backgrounds |
| Composition | ~100 | Framing, perspective, layout |
| Camera | ~100 | Lenses, angles, technical settings |
| Lighting | ~100 | Light sources, directions, qualities |
| Colour | ~100 | Palettes, grades, tonal treatments |
| Atmosphere | ~100 | Environmental effects, mood |
| Materials | ~100 | Textures, surfaces, materials |
| Fidelity | ~100 | Quality boosters, resolution enhancers |
| **Negative** | **~1000** | Comprehensive exclusions by category |

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

### Conditional Free Text for Negative Category

The Negative category's free text input is **platform-dependent**:

| Platform Type | Free Text? | Reason |
|---------------|------------|--------|
| **Native negative support** (14 platforms) | âœ… Shown | Custom terms work directly |
| **Converted negatives** (28 platforms) | âŒ Hidden | Only pre-mapped terms convert |

**Platforms with native negative support:**
- Inline: Midjourney, BlueWillow, Ideogram (use `--no` or `without`)
- Separate field: Stability, Leonardo, Flux, NovelAI, Playground, NightCafe, Lexica, OpenArt, DreamStudio, Getimg, Dreamlike

**Platforms without native support (dropdown only):**
- DALL-E, Adobe Firefly, Bing, Microsoft Designer, Meta Imagine, Canva, Jasper Art, Google Imagen, and 20+ others

For these 28 platforms, custom negative text would be ignored anyway â€” only the pre-mapped dropdown terms work (they convert to positive equivalents).

---

## Combobox Component

**File:** `frontend/src/components/ui/combobox.tsx`
**Version:** 6.4.0

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

### Props Interface

```typescript
interface ComboboxProps {
  id: string;
  label: string;
  description?: string;
  tooltipGuidance?: string;
  options: string[];
  selected: string[];
  customValue: string;
  onSelectChange: (selected: string[]) => void;
  onCustomChange: (value: string) => void;
  placeholder?: string;
  maxSelections?: number;
  maxCustomChars?: number;
  allowFreeText?: boolean;
  isLocked?: boolean;
  lockMessage?: string;  // NOTE: Accepted but NOT displayed in v5.0.0+
  compact?: boolean;     // v6.4.0: Hides label, tooltip, and pt-8 padding
}
```

### Auto-Close Behaviour (v6.3.0)

The dropdown **closes immediately** when the selection limit is reached:

- **Single-select (limit 1):** Closes IMMEDIATELY on click, BEFORE state update
- **Multi-select (limit 2+):** Closes when `newSelected.length >= maxSelections`
- **Done button:** Available for multi-select to close before reaching max
- **Double-click protection:** Uses ref guard to prevent race conditions

```typescript
// CRITICAL: Close FIRST for single-select or when limit reached
if (maxSelections === 1 || newCount >= maxSelections) {
  setIsOpen(false);  // Happens IMMEDIATELY
}
onSelectChange(newSelected);  // State update happens AFTER close
```

### Lock State Visual Treatment (v5.0.0)

When `isLocked=true`:
- **Disabled styling:** Purple-tinted background, reduced opacity
- **Lock icon:** Appears in label only (small, unobtrusive)
- **Dropdown arrow:** Hidden when locked
- **Input:** Shows empty placeholder, cannot type
- **NO overlay text:** The `lockMessage` prop is accepted for compatibility but NOT displayed
- **NO "Sign in to continue" text** in dropdown area

**Why no overlay text?** Showing "Sign in to continue" on every single dropdown was ugly and repetitive UX. Lock messaging now appears ONLY in the central overlay at the top of the prompt builder section.

---

## AspectRatioSelector Component

**File:** `frontend/src/components/providers/aspect-ratio-selector.tsx`
**Version:** 1.2.0

### Lock State Visual Treatment (v1.2.0)

When `disabled=true`:
- **Disabled buttons:** `opacity-50`, `cursor-not-allowed`
- **NO overlay text:** Clean disabled appearance
- **NO "Sign in to continue" text**

---

## Usage Tracking Implementation

### Copy Prompt Button Enhancement

The "Copy prompt" button must be enhanced to track usage:

```typescript
const handleCopyPrompt = async () => {
  // Existing copy functionality
  await navigator.clipboard.writeText(assembledPrompt);
  
  // Track usage for authenticated free users
  if (isAuthenticated && userTier === 'free') {
    try {
      await trackPromptUsage(userId);
      updateDailyUsage(current => ({
        ...current,
        count: current.count + 1
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

### Randomise Button Lock State

The ðŸŽ² Randomise button must be disabled when locked:

```typescript
<button
  type="button"
  onClick={handleRandomise}
  disabled={isLocked}  // Disabled when locked
  className={`... ${
    isLocked
      ? 'cursor-not-allowed border-slate-700 bg-slate-800/50 text-slate-500'
      : 'border-purple-500/70 bg-gradient-to-r from-purple-600/20 to-pink-600/20 ...'
  }`}
>
  <span>ðŸŽ²</span>
  Randomise
</button>
```

### Usage Tracking API

**Endpoint:** `POST /api/usage/track`
**Purpose:** Increment daily usage count for authenticated users

**Request:**
```typescript
{
  action: 'prompt_copy'
}
```

**Response:**
```typescript
{
  success: boolean;
  usage: {
    count: number;
    limit: number | null;
    resetTime: string; // ISO timestamp
  }
}
```

---

## File Structure

```
frontend/src/
â”œâ”€â”€ app/providers/[id]/
â”‚   â”œâ”€â”€ page.tsx                    # Provider prompt builder page (auth-aware)
â”‚   â””â”€â”€ prompt-builder/
â”‚       â””â”€â”€ page.tsx                # Redirect to /providers/[id]
â”œâ”€â”€ components/providers/
â”‚   â”œâ”€â”€ prompt-builder.tsx          # Main prompt builder component v8.3.0 (~1500 lines)
â”‚   â”œâ”€â”€ aspect-ratio-selector.tsx   # Aspect ratio selector v1.2.0 (no lock overlay)
â”‚   â””â”€â”€ provider-workspace.tsx      # Full-height wrapper
â”œâ”€â”€ components/ui/
â”‚   â””â”€â”€ combobox.tsx                # Multi-select combobox v6.4.0 (~530 lines)
â”œâ”€â”€ hooks/
â”‚   â””â”€â”€ use-promagen-auth.ts        # Authentication hook
â”œâ”€â”€ data/providers/
â”‚   â”œâ”€â”€ prompt-options.json         # 12 categories (~2100 options, ~2200 lines)
â”‚   â””â”€â”€ platform-formats.json       # 42 platform assembly rules
â”œâ”€â”€ lib/
â”‚   â”œâ”€â”€ prompt-builder.ts           # Assembly logic (~1050 lines)
â”‚   â”‚   â”œâ”€â”€ NEGATIVE_TO_POSITIVE    # 30-entry conversion map
â”‚   â”‚   â”œâ”€â”€ convertNegativesToPositives()
â”‚   â”‚   â”œâ”€â”€ supportsNativeNegative()  # Check for native negative support
â”‚   â”‚   â”œâ”€â”€ formatPromptForCopy()     # Returns positive only
â”‚   â”‚   â”œâ”€â”€ assembleNatural()         # Natural language assembly
â”‚   â”‚   â”œâ”€â”€ assembleMidjourney()      # Midjourney assembly
â”‚   â”‚   â”œâ”€â”€ assembleStableDiffusion()
â”‚   â”‚   â””â”€â”€ ... (7 platform families)
â”‚   â””â”€â”€ usage/
â”‚       â”œâ”€â”€ anonymous-storage.ts    # Anonymous tracking v2.0.0 (daily reset)
â”‚       â”œâ”€â”€ constants.ts            # Usage limits
â”‚       â””â”€â”€ index.ts                # Re-exports
â””â”€â”€ types/
    â””â”€â”€ prompt-builder.ts           # TypeScript types
        â”œâ”€â”€ PromptCategory          # 12 categories
        â”œâ”€â”€ CATEGORY_ORDER          # Optimal order for prompt construction
        â”œâ”€â”€ CATEGORY_LIMITS         # Selection limits per category
        â”œâ”€â”€ PLATFORMS_WITH_NATIVE_NEGATIVE  # 14 platforms
        â””â”€â”€ ComboboxProps           # Includes allowFreeText
```

---

## Implementation Checklist

- [x] PromptBuilder with 12-category dropdown system
- [x] ~~Selection limits: Free tier (all 1 except negative 5), Paid tier (style/lighting/fidelity get 2)~~ **REPLACED by platform-aware limits**
- [x] **Platform-aware category limits** (v8.0.0) â€” 4 tiers with different selection counts
- [x] **Platform tier assignments** â€” All 42 platforms mapped to tiers 1-4
- [x] **Pro Promagen +1 bonus** on stackable categories
- [x] **Auto-trim on platform switch** â€” Silently removes excess selections
- [x] **Dynamic tooltip guidance** (v8.1.0) â€” Shows actual limit per platform
- [x] **Bulletproof auto-close** (v6.3.0) â€” Closes BEFORE state update for single-select
- [x] **Done button** for multi-select dropdowns (limit â‰¥ 2)
- [x] **Double-click protection** via ref guard
- [x] Platform-specific prompt optimization (7 families)
- [x] Negative-to-positive conversion (30 mappings)
- [x] Custom negative handling ("without X")
- [x] Combobox component with multi-select + custom entry
- [x] 50-char custom entry limit
- [x] Auto-close dropdown when max reached
- [x] ðŸŽ² Randomise button with purple gradient
- [x] Randomise fills ALL 12 categories (including negative)
- [x] **Randomise disabled when locked** (v6.4.0)
- [x] Full-height layout aligned with exchange rails
- [x] Uniform scrollbar styling
- [x] Copy prompt functionality
- [x] Open in Provider functionality
- [x] Analytics events wired
- [x] ~~Platform family badge display~~ **REMOVED**
- [x] ~~Provider tags display~~ **REMOVED**
- [x] Platform tips display
- [x] Artistly uses natural family (not SD)
- [x] LaunchPanel removed (no longer needed)
- [x] **Fidelity category added** (position #11)
- [x] **~100 options per positive category**
- [x] **~1000 negative options**
- [x] **Clean assembled prompt output (no separator)**
- [x] **Core Colours gradient on Clear all button**
- [x] **Conditional free text for negative (platform-dependent)**
- [x] **supportsNativeNegative() function added**
- [x] **Dropdown shows ALL options (no artificial limit)**
- [x] **Anonymous 5-try feature** (localStorage tracking)
- [x] **Anonymous daily reset** (v2.0.0 - resets at midnight)
- [x] **Authentication integration** (Clerk)
- [x] **Lock state visual treatment** (disabled styling only, NO dropdown overlay text)
- [x] **Usage tracking on Copy prompt**
- [x] **Daily quota enforcement** (10/day Standard, unlimited Pro Promagen)
- [x] **Combobox v6.3.0** (bulletproof auto-close, Done button, double-click protection)
- [x] **AspectRatioSelector v1.2.0** (no lock overlay)
- [x] **Prompt builder v8.2.0** (platform-aware limits, dynamic tooltips, auto-trim)

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
- **Done button visible for multi-select** (limit â‰¥ 2)

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
- Open in Provider href matches `/go/[id]?src=provider_detail`
- Dropdowns close when max selections reached
- Negative category free text hidden for non-native platforms

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

**Test file:** `frontend/src/app/providers/[id]/__tests__/page.test.tsx`

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

**Existing features preserved:** Yes (required for every change)

---

## Removed Features (Historical)

These features were removed as they added no value:

| Feature | Removed Date | Reason |
|---------|--------------|--------|
| Platform family badge | 1 Jan 2026 | Added visual clutter, no user value |
| Provider tags display | 1 Jan 2026 | Redundant with provider page |
| "Negative prompt:" separator | 1 Jan 2026 | Confused users, cluttered preview |
| LaunchPanel | 31 Dec 2025 | Replaced by full-height prompt builder |
| 30-item dropdown limit | 1 Jan 2026 | Artificially hid curated options |
| **Dropdown lock message overlay** | 4 Jan 2026 | Ugly UX, repetitive text on every dropdown |

---

## Changelog

- **8 Jan 2026 (v8.3.0):** **FREE TIER LIMIT REDUCED** — Changed Standard Promagen daily prompt limit from 30/day to **10/day**. Updated lock state progression: Free signed-in (0-9) → (10) locked. Benefits list updated. See paid_tier.md for rationale.

- **5 Jan 2026 (v8.2.0):** **PLATFORM-AWARE CATEGORY LIMITS** â€” Complete overhaul of selection limits system. Limits now vary by platform tier (Tier 1: CLIP-based, Tier 2: Midjourney, Tier 3: Natural Language, Tier 4: Plain Language). All 42 platforms assigned to appropriate tier. Pro Promagen users get +1 on stackable categories. Auto-trim on platform switch silently removes excess selections. Dynamic tooltip guidance shows actual limits with proper singular/plural grammar. Combobox v6.3.0: bulletproof auto-close (closes BEFORE state update for single-select), Done button for multi-select, double-click protection. PromptBuilder v8.2.0 with platform-aware usePromagenAuth({ platformId }) hook. See paid_tier.md Â§5.5 for full tier matrix.
- **4 Jan 2026 (v6.4.0):** **LOCK STATE UX CLEANUP** â€” Removed "Sign in to continue" text overlay from individual Combobox dropdowns. Lock messaging now appears ONLY in the central overlay at top of prompt builder section. Combobox v5.0.0: accepts `lockMessage` prop but does NOT display it. AspectRatioSelector v1.2.0: no lock overlay. PromptBuilder v6.4.0: removed `lockMessage` prop from all Combobox and AspectRatioSelector instances. Randomise button disabled when locked. This is a UX improvement â€” showing the same text on every dropdown was ugly and cluttered.
- **4 Jan 2026 (v2.0.0 anonymous-storage):** **ANONYMOUS DAILY RESET** â€” Anonymous users now get 5 prompts per day (resets at midnight local time), matching the authenticated user experience. Previously was 5 prompts total lifetime. Anonymous storage upgraded to v2 schema with `lastResetDate` field. Migration: v1 data invalidated on read, triggers fresh v2 start.
- **3 Jan 2026 (v4.2):** **TERMINOLOGY UPDATE** â€” Renamed "paid" to "Pro Promagen" and "free" to "Standard Promagen" in user-facing references. Updated category table headers. Updated test descriptions. Internal code still uses `'paid'` for brevity.
- **3 Jan 2026 (v4.1):** **ANONYMOUS 5-TRY UPDATE** â€” Added 5 free prompts for anonymous users before sign-in required. Lock states expanded from 4 to 5 states. Lock overlay UI redesign: CTA button at top (no lock icon), centred layout, benefits list. Anonymous usage stored in localStorage with tamper detection. Updated architecture diagram.
- **2 Jan 2026 (v4.0):** **MAJOR AUTHENTICATION UPDATE** â€” Added prompt builder authentication requirements. Lock states for unauthenticated users. Daily usage quotas (10/day for Standard, unlimited for Pro Promagen). Usage tracking on "Copy prompt" clicks. Purple-pink gradient lock styling. Enhanced selection limits for Pro Promagen users. Midnight reset in user's timezone. Updated testing requirements for authentication flows.
- **1 Jan 2026 (v3.1):** Updated selection limits for tiered access. Standard Promagen: all categories limit 1 (except negative at 5). Pro Promagen: style, lighting, and fidelity upgraded to limit 2. See `paid_tier.md` Â§5.5. Removed artificial 30/100-item dropdown cap â€” now shows ALL options (scrollable). Removed "Type to filter X more options" message.
- **1 Jan 2026 (v3.0):** Major update. Added Fidelity category (now 12 total). Expanded to ~100 options per category and ~1000 negative options. Removed platform family badge. Removed provider tags. Removed "Negative prompt:" separator from output. Added Core Colours gradient to Clear all button. Randomise now fills ALL 12 categories including negative (2-3 options). Added conditional free text for negative category (platform-dependent). Added `supportsNativeNegative()` function. Updated category order for optimal prompt construction.
- **1 Jan 2026:** Expanded to 11 categories (added Action, Environment, Materials). Added selection limits (1/2/5). Added ðŸŽ² Randomise button. Implemented negative-to-positive conversion for natural language platforms. Fixed Artistly platform family mapping. Added dropdown auto-close. Removed max badge from tooltips. Added 50-char custom entry limit.
- **31 Dec 2025:** Major rewrite. Removed LaunchPanel, PromptBuilder fills full height. Added 9-category dropdown system with 30 options each. Added platform-specific optimization (7 families, 42 platforms). Uniform scrollbar styling.
- **28 Dec 2025:** Initial version with two-panel layout (PromptBuilder + LaunchPanel).
