# paid_tier.md â€” What Is Free and What Is Paid in Promagen

**Last updated:** 9 April 2026  
**Version:** 8.0.0  
**Status:** Authoritative  
**Scope:** Product behaviour, access rules, and monetisation boundaries  
**Rule:** If a capability is not explicitly listed in this document, it is free.

---

## 1. Core rule (non-negotiable)

**Anything not written in this document is part of Standard Promagen (free).**

There are no implied paywalls.
There are no "soft locks".
There are no hidden tier changes.

`paid_tier.md` is the **exception list**, not the feature catalogue.

---

## 1.1 Terminology

| Term                  | Definition                                                                                                                                                                               |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Pro Promagen**      | The paid subscription tier. Always use "Pro Promagen" in user-facing text (UI labels, tooltips, CTAs, prompts). Internal code may use `isPaidUser` or `userTier === 'paid'` for brevity. |
| **Standard Promagen** | The free tier. If not explicitly listed in this document, a feature is Standard Promagen.                                                                                                |

**UI usage examples:**

- CTAs: "Upgrade to Pro Promagen"
- Badges: "Pro Promagen" or "Pro"
- Tooltips: "ðŸ”’ Pro Promagen Feature"
- Lock messages: "Upgrade to Pro Promagen for unlimited"

**Code usage:**

- Clerk metadata: `{ "tier": "paid" }` (internal, not user-facing)
- Hook returns: `userTier: 'free' | 'paid'` (internal)
- UI strings: Always "Pro Promagen" or "Standard Promagen"

---

## 2. Promagen v1 (Free, no sign-in)

Version 1 of Promagen is **completely free**.

The purpose of v1 is:

- Stability
- Correctness
- Behavioural truth
- Real-world bug discovery

There is **no sign-in** during this phase.

Free users see the world as Promagen defines it:

- Neutral
- Predictable
- Honest
- Calm

No personalisation, no memory, no gating.

---

### 2.1 Free features (explicit list)

The following features are available to all users without sign-in:

- **Stock exchange cards** â€” Default selection of 16 exchanges (SSOT-defined)
- **Live local time clocks** â€” Each exchange card displays the current local time in that exchange's timezone
- **Market status indicators** â€” Open/closed status for each exchange
- **Stock index data** â€” Each exchange card displays its benchmark index (e.g., Nikkei 225, S&P 500) with live price, change, and percent change (subject to Marketstack API budget rules)
- **FX ribbon** â€” Real-time foreign exchange data (subject to TwelveData API budget rules)
- **Weather badges** â€” Current weather for each exchange city
- **AI Providers Leaderboard** â€” Browse and compare all 40 AI image generation providers
- **Market Pulse** — Dynamic exchange↔provider city connection animations (derived at runtime, not hardcoded)
- **Scene Starters (25 free scenes)** — One-click prompt templates across 10 thematic worlds (Phase 2)
- **Explore Drawer** — Expandable vocabulary panel showing 9,058 browseable phrases per category with search and source-grouped tabs (Phase 3)
- **Cascading Intelligence** — Downstream dropdowns reorder options based on upstream selections for coherent prompt building (Phase 1)
- **Prompt of the Moment** — Live weather-driven 4-tier prompts rotating through 102 cities every 10 minutes, with copy and "Try in [Provider]" actions (homepage §4)
- **Like system** — Like/unlike prompts anonymously (session cookie) or authenticated; feeds into Community Pulse and scoring pipeline (homepage §7)
- **Community Pulse** — Right-rail feed showing 20 most recent prompts + "most liked today" card, auto-refreshing every 30 seconds (homepage §6)
- **Online Users** — Country-based concurrent user display in Prompt of the Moment (shown when total ≥50) (homepage §8)
- **World Context page** — Full financial homepage (FX ribbon, exchange rails, weather) at `/world-context`, accessible via Mission Control button on all pages (homepage §10)

These features define the baseline experience.
They are complete and honest.

---

## 3. Sign-in (not paid): memory, context, and prompt access

After v1 is stable, **sign-in is introduced**.

Sign-in **unlocks access to the prompt builder** and provides memory and context.

### 3.1 Authentication provider

Promagen uses **Clerk** as its identity provider. See `docs/authority/clerk-auth.md` for technical details.

Sign-in methods:

- Google OAuth
- Apple OAuth
- Facebook OAuth
- Email/password

### 3.2 Prompt builder access (tiered)

**Anonymous users (not signed in):**

- **3 free prompts per day** before sign-in required
- **Daily reset at midnight** in user's local timezone (same as authenticated users)
- Anonymous usage counter visible: "X/3 free prompts"
- Stored in localStorage (browser-local, no account needed)
- After 3 prompts: overlay locks with "Sign in to continue" button

**Visual treatment when locked (anonymous or free user at limit):**

- All category dropdowns show **disabled styling only** (purple-tinted, non-interactive)
- **NO "Sign in to continue" text displayed inside individual dropdowns** (clean UX)
- Centred overlay with action button at top of the prompt builder section
- Message: "You've used your 3 free prompts" (anonymous) or "Daily limit reached" (free user)
- Benefits list shown in overlay
- Lock icon appears in dropdown labels only
- Dropdown arrows hidden when locked
- Dropdowns show empty placeholder when locked

**Free tier prompt access (after sign-in):**

- **Full access to all 12 categories** with ~2,100 curated prompt terms
- **Platform-aware selection limits** as documented in Â§5.6 and prompt-builder-page.md
- **5 prompts per day** â€” tracked on "Copy prompt" button clicks
- **Daily reset at midnight** in user's local timezone
- When quota reached: dropdowns lock with "Upgrade to Pro Promagen for unlimited" message

### 3.3 Usage tracking system

**Trigger event:** "Copy prompt" button click â€” the moment users extract value from Promagen's curation work

**Why "Copy prompt" and not "Generate"?**

- Promagen doesn't generate images â€” it crafts prompts
- The copy action is when curation value transfers to the user
- Clicking "Copy" = extracting a finished, curated prompt
- This aligns with Promagen's role as a prompt curator, not an image generator

**Counter mechanics:**

| Event                    | Counter behaviour               |
| ------------------------ | ------------------------------- |
| User copies prompt       | Increment by 1                  |
| User copies same prompt  | Increment by 1 (no dedup)       |
| Page refresh             | Counter persists                |
| Midnight (local)         | Counter resets to 0             |
| User clears localStorage | Counter resets (anonymous only) |
| New device login         | Clerk count restored            |

**Storage:**

- Anonymous: localStorage with tamper detection (see below)
- Authenticated free: Vercel KV keyed by `userId:date`
- Pro Promagen: No tracking (unlimited)

**Anonymous tamper detection:**

```typescript
interface AnonymousUsage {
  count: number; // Current prompt count (0-3)
  lastResetDate: string; // YYYY-MM-DD for daily reset
  version: 2; // Schema version
  checksum: string; // HMAC of count + lastResetDate + version
}
```

If checksum validation fails, counter resets to 0 and user is shown a gentle message: "Usage data was reset. You have 3 prompts remaining today."

### 3.4 Geographic ordering (reference frame)

**Standard Promagen:**

- Reference frame = user's detected location
- Exchanges ordered relative to user's longitude
- Automatic, no configuration needed

**Detection method:**

1. IP-based geolocation via Vercel headers (`x-vercel-ip-longitude`)
2. Fallback: browser Geolocation API (with permission)
3. Final fallback: Greenwich Meridian (0Â° longitude)

**No prompt for location:** The system uses available signals silently. If all signals fail, Greenwich Meridian becomes the default reference.

---

## 4. Technical implementation

### 4.1 Tier detection (Clerk metadata)

User tier is stored in Clerk's `publicMetadata`:

```typescript
interface ClerkPublicMetadata {
  tier: "free" | "paid";
  promptTier?: number; // 1–4, paid users only (All Prompt Format selection)
  exchangeSelection?: {
    exchangeIds: string[];
    updatedAt: string;
  };
  fxSelection?: {
    pairIds: string[];
    updatedAt: string;
  };
  stripeCustomerId?: string; // Stripe customer ID (set on first checkout)
  cancelAtPeriodEnd?: boolean; // true when user has cancelled but still has access
  currentPeriodEnd?: string; // ISO timestamp — when current billing period ends
}
```

**Hook usage:**

```typescript
function Component() {
  const { userTier, categoryLimits, platformTier, clerkPromptTier } =
    usePromagenAuth({
      platformId,
    });
  // userTier: 'free' | 'paid' (internal)
  // UI should display: "Standard Promagen" | "Pro Promagen"
  // categoryLimits: Platform-aware limits for current provider
  // platformTier: 1 | 2 | 3 | 4
  // clerkPromptTier: number | null — stored prompt tier preference (paid users only)
}
```

---

## 5. Pro Promagen exclusive features

### 5.1 Unlimited daily prompts

Pro Promagen users have **unlimited daily prompt copies** â€” no counter, no quota.

---

### 5.2 Reference frame choice

Standard Promagen users see exchanges ordered relative to their detected location.

Pro Promagen users may choose their reference frame:

- "My Location" â€” exchanges ordered relative to geolocation
- "Greenwich Meridian" â€” exchanges ordered relative to 0Â° longitude

This is the **only reference frame control**.

---

### 5.3 Exchange selection (user-curated rails)

Pro Promagen users may choose which exchanges appear on their homepage rails.

#### Tier Comparison

| Aspect           | Standard Promagen           | Pro Promagen                                    |
| ---------------- | --------------------------- | ----------------------------------------------- |
| Exchanges shown  | SSOT default (currently 16) | User-curated selection                          |
| Exchange count   | Fixed by SSOT               | **0 to 16** (any integer)                       |
| Catalog access   | N/A                         | Full catalog (89 exchanges, 109 unique indices) |
| Index selection  | Default index only          | Choose from 159 available index options         |
| Configuration UI | None                        | Exchange Picker in `/pro-promagen`              |

#### Allowed Exchange Counts

Any integer from **0 to 16** inclusive.

Rules:

- Minimum 0 exchanges (allows "start fresh" workflow)
- Maximum 16 exchanges (aligns with FX pair ceiling, controls display density)
- **Any count allowed** â€” odd or even (e.g., 7, 9, 11, 13, 15 are all valid)

#### Exchange Picker UI (v2.1.0 â€” Fullscreen Continental Accordion)

Pro Promagen users access the Exchange Picker via the `/pro-promagen` configuration page.

**Current Implementation (1 Feb 2026):**

- Exchanges row in comparison table shows **purple gradient trigger button**: "Select Stock Exchanges [3/16]"
- Click button â†’ **entire centre panel becomes the picker** (fullscreen mode)
- Only the Done button visible at bottom â€” NO headers, NO badges, NO table
- Continental accordion groups show all 89 exchanges by 7 regions
- "Done â€” Save Selection" button (purple gradient) closes picker and returns to table

**Visual Flow:**

```
NORMAL STATE:
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  Feature          â”‚ Standard    â”‚ Pro Promagen                      â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚  FX Pairs         â”‚ 8 fixed     â”‚ [ðŸ’± Select FX Pairs        2/16]  â”‚ â† EMERALD BUTTON
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚  Exchanges        â”‚ 16 fixed    â”‚ [ðŸŒ Select Stock Exchanges 11/16] â”‚ â† PURPLE BUTTON
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚  Stock Indices    â”‚ All default    â”‚ Per-exchange in Exchange Picker              â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚  ... other rows                                                     â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜

         â†“ CLICK EXCHANGE BUTTON â†“

FULLSCREEN PICKER MODE:
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”    â”‚
â”‚  â”‚  ðŸŒ YOUR SELECTION (11/16)                        [Reset]   â”‚    â”‚
â”‚  â”‚  [ðŸ‡¯ðŸ‡µ TSE âœ•] [ðŸ‡­ðŸ‡° HKEX âœ•] [ðŸ‡¸ðŸ‡¬ SGX âœ•] [ðŸ‡ºðŸ‡¸ NYSE âœ•] ...     â”‚    â”‚
â”‚  â”‚  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• (progress bar)    â”‚    â”‚
â”‚  â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤    â”‚
â”‚  â”‚  ðŸ” Search by exchange, city, or country...                 â”‚    â”‚
â”‚  â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤    â”‚
â”‚  â”‚  â–º ðŸŒ Asia (5 selected)                                     â”‚    â”‚
â”‚  â”‚  â–º ðŸŒŠ Oceania (0 selected)                                  â”‚    â”‚
â”‚  â”‚  â–º ðŸ° Europe (3 selected)                                   â”‚    â”‚
â”‚  â”‚  â–º ðŸœï¸ Africa (1 selected)                                   â”‚    â”‚
â”‚  â”‚  â–º ðŸ•Œ Middle East (0 selected)                              â”‚    â”‚
â”‚  â”‚  â–º ðŸ—½ North America (2 selected)                            â”‚    â”‚
â”‚  â”‚  â–º ðŸŒ´ South America (0 selected)                            â”‚    â”‚
â”‚  â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤    â”‚
â”‚  â”‚           [ âœ“ Done â€” Save Selection ]                       â”‚    â”‚ â† PURPLE GRADIENT
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜    â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

**Picker Features:**

- Sticky selection tray at top (selected exchanges always visible with remove buttons)
- Progress bar showing selection count (color-coded: emerald â†’ amber â†’ orange)
- Search/filter by exchange name, city, or country
- 7 continental accordion groups (all closed by default)
- SVG flags from `/public/flags/{iso2}.svg` (263 flags available)
- Regional "Select All" buttons per continent
- Ethereal glow effects matching Promagen design system
- Responsive scroll: `max-h-[400px]` on mobile, fills space on desktop

**Scroll Behaviour (v2.5.0):**

- Small screens: `max-h-[400px]` with `overflow-y-auto`
- Large screens: Fills available space, scrolls when expanded continents exceed viewport
- Scrollbar styling: `scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/20`

**Components:**

- Trigger button: `ExchangePickerTrigger` (canonical purple gradient per code-standard.md Â§6.1)
- Picker: `ExchangePicker` (continental accordion, full 89-exchange catalog)
- Done button: Closes picker, returns to table

**Files:**

| File                                               | Purpose                                | Version |
| -------------------------------------------------- | -------------------------------------- | ------- |
| `src/components/pro-promagen/comparison-table.tsx` | Contains trigger + fullscreen callback | v2.8.0  |
| `src/components/pro-promagen/exchange-picker.tsx`  | Continental accordion component        | v2.8.0  |
| `src/app/pro-promagen/pro-promagen-client.tsx`     | Manages fullscreen state               | v2.8.0  |
| `src/lib/geo/continents.ts`                        | Continent definitions and configs      | v1.0.0  |

#### Storage Architecture (Hybrid localStorage + Clerk)

Exchange selection uses a **hybrid storage** approach for fast reads with cross-device sync:

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                  EXCHANGE SELECTION DATA FLOW                    â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚                                                                 â”‚
â”‚  User action (Exchange Picker)                                  â”‚
â”‚         â”‚                                                       â”‚
â”‚         â–¼                                                       â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”                                           â”‚
â”‚  â”‚  localStorage   â”‚  â† Immediate write (fast UX)              â”‚
â”‚  â”‚promagen:exch:selâ”‚                                           â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”˜                                           â”‚
â”‚           â”‚                                                     â”‚
â”‚           â–¼ (async, debounced 2s)                              â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”                                           â”‚
â”‚  â”‚ Clerk metadata  â”‚  â† Persistent source of truth             â”‚
â”‚  â”‚ exchangeSelect  â”‚                                           â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”˜                                           â”‚
â”‚           â”‚                                                     â”‚
â”‚           â–¼ (on login, other devices)                          â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”                                           â”‚
â”‚  â”‚ Sync to local   â”‚  â† Clerk â†’ localStorage on auth          â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜                                           â”‚
â”‚                                                                 â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

#### localStorage Schema

```typescript
// Key: promagen:exchange:selection
interface ExchangeSelectionLocal {
  exchangeIds: string[]; // e.g. ["tse-tokyo", "nyse-new-york", ...]
  updatedAt: string; // ISO timestamp
  syncedAt: string | null; // Last Clerk sync timestamp
  version: 1;
}
```

#### Regional Presets

Quick presets allow one-click regional selection:

| Preset               | Description               | Example Exchanges                |
| -------------------- | ------------------------- | -------------------------------- |
| Asia Pacific         | Major APAC markets        | ASX, TSE, HKEX, SGX, SSE, KRX... |
| Americas             | North & South America     | NYSE, NASDAQ, TSX, B3, BMV...    |
| Europe & Middle East | EMEA region               | LSE, Euronext, Xetra, Tadawul... |
| Global Majors        | World's largest exchanges | NYSE, NASDAQ, LSE, TSE, SSE...   |
| Emerging Markets     | High-growth economies     | BSE, SSE, B3, JSE, BIST...       |

#### Fallback Behaviour

| Condition                        | Result                                    |
| -------------------------------- | ----------------------------------------- |
| Free user                        | SSOT default exchanges (no picker access) |
| Pro user, no selection saved     | SSOT default exchanges                    |
| Pro user, localStorage corrupted | Clerk data used                           |
| Pro user, Clerk unreachable      | localStorage used                         |
| Pro user, both unavailable       | SSOT default exchanges                    |

Rules:

- Selection affects **scope only**, never ordering logic
- All exchanges may be from one hemisphere if the user wishes
- Ordering always follows longitude relative to chosen reference frame
- SSOT still controls default exchanges for free users and fallback

Authority for implementation: `docs/authority/ribbon-homepage.md`

#### Exchange Catalog Data Integrity (17 March 2026)

All 53 real exchanges (excluding city-vibe entries) now have populated `marketstack` fields. Zero empty marketstack entries remain.

**Fixes applied:**

| Exchange              | Issue                                                        | Fix                                                                                                 |
| --------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| JSE Johannesburg (ZA) | `marketstack: {}` — no index data                            | Added `defaultBenchmark: "jse"`, `defaultIndexName: "JSE All Share"`, plus `sa40` (FTSE/JSE Top 40) |
| SSE Santiago (CL)     | `marketstack: {}` — no index data                            | Added `defaultBenchmark: "igpa"`, `defaultIndexName: "IGPA"`                                        |
| ZSE Zagreb (HR)       | `hoursTemplate: "europe-standard"` (not in test allowed set) | Changed to `"europe-croatia"`                                                                       |
| ISE Dublin (IE)       | `hoursTemplate: "europe-standard"` (not in test allowed set) | Changed to `"europe-ireland"`                                                                       |

**Stale-but-valid API data:** Several exchanges return prices with old `asOf` dates (e.g., JSE All Share from 2023-04-21, FTSE 100 from 2023-05-03, CROBEX from 2021-03-03). These display the last known good data from Marketstack. If the API ever updates, the cards refresh automatically. Showing stale real data is better than showing nothing.

#### Continental Classification Change (17 March 2026)

**Turkey (TR)** moved from `EUROPE` to `MIDDLE_EAST` in `src/lib/geo/continents.ts`. This affects:

- Exchange Picker accordion grouping (BIST Istanbul now under Middle East)
- ExchangesPreviewPanel regional window (BIST now in "Africa & M. East" window)

---

### 5.4 Reserved (removed)

_Section removed — exchange count and hemisphere selection merged into §5.3 Exchange selection._

---

### 5.5 FX pair selection (user-curated ribbon)

Pro Promagen users may choose which FX pairs appear on their homepage ribbon.

#### Tier Comparison

| Aspect           | Standard Promagen          | Pro Promagen                           |
| ---------------- | -------------------------- | -------------------------------------- |
| FX pairs shown   | SSOT default (currently 8) | User-curated selection                 |
| Pair count       | Fixed by SSOT              | **0 to 16**                            |
| Catalog access   | N/A                        | Full catalog (102 pairs)               |
| Configuration UI | None                       | FX Picker (Regional Fullscreen v2.0.0) |

#### Allowed Pair Counts

Any integer from **0 to 16** inclusive.

Rules:

- Minimum 0 pairs (allows "start fresh" workflow)
- Maximum 16 pairs (aligns with exchange count ceiling, controls API budget)

#### FX Picker UI (v2.0.0 â€” Regional Fullscreen Accordion)

**CONFIRMED DESIGN (29 Jan 2026):**

The FX Picker mirrors the Exchange Picker UX but uses **4 regional groups based on BASE currency**:

**Grouping Rule (Option A â€” Confirmed):**

| Pair Example | Region Displayed     | Reason                            |
| ------------ | -------------------- | --------------------------------- |
| EUR/USD      | Europe               | EUR is base, EUR â†’ Europe       |
| USD/JPY      | Americas             | USD is base, USD â†’ Americas     |
| GBP/ZAR      | Europe               | GBP is base, GBP â†’ Europe       |
| AUD/NZD      | Asia Pacific         | AUD is base, AUD â†’ Asia Pacific |
| ZAR/JPY      | Middle East & Africa | ZAR is base, ZAR â†’ MEA          |

**4 Regional Groups:**

| Region               | Emoji | Gradient           | Currencies Mapped                                   |
| -------------------- | ----- | ------------------ | --------------------------------------------------- |
| Americas             | ðŸŒŽ  | sky-blue-indigo    | USD, CAD, MXN, BRL, ARS, CLP, COP, PEN...           |
| Europe               | ðŸ°   | blue-indigo-violet | EUR, GBP, CHF, SEK, NOK, DKK, PLN, CZK, HUF, TRY... |
| Asia Pacific         | ðŸŒ   | rose-orange-amber  | JPY, CNH, HKD, SGD, KRW, INR, AUD, NZD, THB, MYR... |
| Middle East & Africa | ðŸŒ   | emerald-green-lime | AED, SAR, ILS, ZAR, QAR, KWD, EGP, NGN, KES...      |

**Visual Flow:**

```
NORMAL STATE:
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  Feature          â”‚ Standard    â”‚ Pro Promagen                      â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚  FX Pairs         â”‚ 8 fixed     â”‚ [ðŸ’± Select FX Pairs        2/16]  â”‚ â† EMERALD BUTTON
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚  Exchanges        â”‚ 16 fixed    â”‚ [ðŸŒ Select Stock Exchanges 11/16] â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜

         â†“ CLICK FX BUTTON â†“

FULLSCREEN FX PICKER MODE:
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”    â”‚
â”‚  â”‚  ðŸ’± YOUR SELECTION (2/16)                         [Reset]   â”‚    â”‚
â”‚  â”‚  [ðŸ‡ªðŸ‡ºðŸ‡ºðŸ‡¸ EUR/USD âœ•] [ðŸ‡¬ðŸ‡§ðŸ‡ºðŸ‡¸ GBP/USD âœ•]                       â”‚    â”‚
â”‚  â”‚  â•â•â•â•â•â•â•â• (emerald progress bar)                            â”‚    â”‚
â”‚  â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤    â”‚
â”‚  â”‚  ðŸ” Search by pair, currency, or country...                 â”‚    â”‚
â”‚  â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤    â”‚
â”‚  â”‚  â–º ðŸŒŽ Americas (0 selected)                                 â”‚    â”‚
â”‚  â”‚  â–º ðŸ° Europe (2 selected)                                   â”‚    â”‚
â”‚  â”‚  â–º ðŸŒ Asia Pacific (0 selected)                             â”‚    â”‚
â”‚  â”‚  â–º ðŸŒ Middle East & Africa (0 selected)                     â”‚    â”‚
â”‚  â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤    â”‚
â”‚  â”‚           [ âœ“ Done â€” Save Selection ]                       â”‚    â”‚ â† EMERALD GRADIENT
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜    â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

**Expanded Region View (when accordion open):**

```
â”‚  â–¼ ðŸ° Europe (2 selected)                          [Select All]   â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”   â”‚
â”‚  â”‚ [ðŸ‡ªðŸ‡ºðŸ‡ºðŸ‡¸] EUR/USD    Eurozone / United States     [MAJOR] â˜‘ï¸  â”‚   â”‚
â”‚  â”‚ [ðŸ‡ªðŸ‡ºðŸ‡¬ðŸ‡§] EUR/GBP    Eurozone / United Kingdom    [MAJOR] â˜   â”‚   â”‚
â”‚  â”‚ [ðŸ‡ªðŸ‡ºðŸ‡¯ðŸ‡µ] EUR/JPY    Eurozone / Japan             [MAJOR] â˜   â”‚   â”‚
â”‚  â”‚ [ðŸ‡¬ðŸ‡§ðŸ‡ºðŸ‡¸] GBP/USD    United Kingdom / United States [MAJOR] â˜‘ï¸â”‚   â”‚
â”‚  â”‚ [ðŸ‡¬ðŸ‡§ðŸ‡¯ðŸ‡µ] GBP/JPY    United Kingdom / Japan        [CROSS] â˜  â”‚   â”‚
â”‚  â”‚ [ðŸ‡¨ðŸ‡­ðŸ‡¯ðŸ‡µ] CHF/JPY    Switzerland / Japan          [CROSS] â˜   â”‚   â”‚
â”‚  â”‚ ...                                                          â”‚   â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜   â”‚
```

**Dual Flag Display:**

Each FX pair shows **two overlapping SVG flags** (base currency + quote currency):

- Base flag: Full visibility, z-index 10
- Quote flag: Slightly overlapped (`-ml-1`), 90% opacity, z-index 0
- Both flags from `/public/flags/{iso2}.svg` (263 flags available)
- Flag size in list: 20px, in chips: 14px

**Picker Features:**

- Sticky selection tray at top (selected pairs always visible with dual flags)
- Progress bar showing 0-16 count (color-coded: red â†’ emerald â†’ amber â†’ orange)
- Search/filter by pair label, base code, quote code, or country names
- 4 regional accordion groups (all closed by default)
- Category badges: MAJOR (amber), CROSS (slate), EMERGING (emerald)
- Regional "Select All" buttons per region
- Pairs sorted by rank (liquidity) within each region
- Responsive scroll: `max-h-[400px]` on mobile, fills space on desktop

**Progress Bar Colors:**

| Count         | Color   | Meaning           |
| ------------- | ------- | ----------------- |
| 0 (below min) | Red     | Below minimum     |
| 1-12          | Emerald | Healthy selection |
| 13-15         | Amber   | Approaching limit |
| 16            | Orange  | At maximum        |

**Scroll Behaviour:**

- Small screens: `max-h-[400px]` with `overflow-y-auto`
- Large screens: Fills available space, scrolls when expanded regions exceed viewport
- Scrollbar styling: `scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/20`

**Components:**

- Trigger button: `FxPickerTrigger` (emerald-sky gradient, currency exchange icon)
- Picker: `FxPicker` (regional accordion, full 102-pair catalog)
- Done button: Closes picker, returns to table (emerald-sky gradient)

**Files:**

| File                                               | Purpose                                       | Version |
| -------------------------------------------------- | --------------------------------------------- | ------- |
| `src/components/fx/fx-picker.tsx`                  | Regional FX Picker component                  | v2.0.0  |
| `src/lib/fx/fx-regions.ts`                         | Currency â†’ Region mapping (100+ currencies) | v1.0.0  |
| `src/lib/fx/fx-picker-helpers.ts`                  | Grouping, search, validation utilities        | v1.0.0  |
| `src/components/pro-promagen/comparison-table.tsx` | FxPickerTrigger + callback                    | v2.8.0  |
| `src/app/pro-promagen/pro-promagen-client.tsx`     | Fullscreen FX mode state                      | v2.8.0  |

**Currency-to-Region Mapping (Comprehensive):**

```typescript
// Americas (18 currencies)
(USD,
  CAD,
  MXN,
  BRL,
  ARS,
  CLP,
  COP,
  PEN,
  UYU,
  DOP,
  JMD,
  TTD,
  BSD,
  BBD,
  PAB,
  CRC,
  GTQ,
  HNL);

// Europe (25 currencies)
(EUR,
  GBP,
  CHF,
  SEK,
  NOK,
  DKK,
  PLN,
  CZK,
  HUF,
  RON,
  BGN,
  HRK,
  RUB,
  UAH,
  TRY,
  ISK,
  RSD,
  MKD,
  ALL,
  BAM,
  MDL,
  BYN,
  GEL,
  AMD,
  AZN);

// Asia Pacific (28 currencies)
(JPY,
  CNY,
  CNH,
  HKD,
  SGD,
  KRW,
  TWD,
  INR,
  THB,
  MYR,
  IDR,
  PHP,
  VND,
  PKR,
  BDT,
  LKR,
  NPR,
  MMK,
  KHR,
  LAK,
  BND,
  MNT,
  KZT,
  UZS,
  AUD,
  NZD,
  FJD,
  PGK);

// Middle East & Africa (34 currencies)
(AED,
  SAR,
  ILS,
  QAR,
  KWD,
  BHD,
  OMR,
  JOD,
  LBP,
  IRR,
  IQD,
  SYP,
  YER,
  EGP,
  ZAR,
  NGN,
  KES,
  MAD,
  TND,
  GHS,
  MUR,
  BWP,
  NAD,
  ZWL,
  TZS,
  UGX,
  ETB,
  XOF,
  XAF,
  DZD,
  LYD,
  AOA,
  MZN,
  RWF,
  ZMW,
  MWK);
```

**Data Flow:**

```
fx-pairs.json (102 pairs, with base/quote country codes)
     â†“
fxCatalog prop â†’ ProPromagenClient
     â†“
catalogToPickerOptions() â†’ FxPairOption[] (adds region based on base currency)
     â†“
groupByRegion() â†’ Map<FxRegion, FxPairOption[]>
     â†“
FX Picker UI renders regional accordion
```

**When `fx-pairs.json` is updated:**

- âœ… Add new pair â†’ Appears automatically in correct region
- âœ… Remove pair â†’ Disappears automatically
- âœ… Change category/rank â†’ Grouping/ordering updates
- âœ… No code changes needed

**Note on Africa & Middle East Region:**

This region may show fewer pairs than others because fx-pairs.json currently has limited pairs where currencies like ZAR, AED, SAR are the **base** currency. To add more pairs to this region, add entries to fx-pairs.json where MEA currencies are the base (e.g., `ZAR/JPY`, `AED/USD`, `SAR/EUR`).

#### Storage Architecture (Hybrid localStorage + Clerk)

FX selection uses a **hybrid storage** approach for fast reads with cross-device sync:

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                    FX SELECTION DATA FLOW                       â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚                                                                 â”‚
â”‚  User action (FX Picker)                                        â”‚
â”‚         â”‚                                                       â”‚
â”‚         â–¼                                                       â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”                                           â”‚
â”‚  â”‚  localStorage   â”‚  â† Immediate write (fast UX)              â”‚
â”‚  â”‚ promagen:fx:sel â”‚                                           â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”˜                                           â”‚
â”‚           â”‚                                                     â”‚
â”‚           â–¼ (async, debounced 2s)                              â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”                                           â”‚
â”‚  â”‚ Clerk metadata  â”‚  â† Persistent source of truth             â”‚
â”‚  â”‚ fxSelection     â”‚                                           â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”˜                                           â”‚
â”‚           â”‚                                                     â”‚
â”‚           â–¼ (on login, other devices)                          â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”                                           â”‚
â”‚  â”‚ Sync to local   â”‚  â† Clerk â†’ localStorage on auth          â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜                                           â”‚
â”‚                                                                 â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

**Why hybrid?**

| Approach          | Problem                                                                |
| ----------------- | ---------------------------------------------------------------------- |
| Query param only  | Ugly URLs, breaks on share, not persistent                             |
| localStorage only | No cross-device sync, lost on browser clear                            |
| Clerk only        | Requires API call on every page load (latency)                         |
| **Hybrid**        | Fast reads (local), eventual consistency (Clerk), graceful degradation |

#### localStorage Schema

```typescript
// Key: promagen:fx:selection
interface FxSelectionLocal {
  pairIds: string[]; // e.g. ["eur-usd", "gbp-jpy", ...]
  updatedAt: string; // ISO timestamp
  syncedAt: string | null; // Last Clerk sync timestamp
  version: 1;
}
```

#### Clerk Metadata Schema

```typescript
// In Clerk publicMetadata
interface ClerkPublicMetadata {
  tier: "free" | "paid";
  fxSelection?: {
    pairIds: string[]; // Max 16 items
    updatedAt: string; // ISO timestamp
  };
}
```

#### Gateway Integration

The gateway receives pair selection via **POST body** (not query params):

```typescript
// Frontend â†’ Gateway request
POST /fx
Content-Type: application/json

{
  "pairIds": ["eur-usd", "gbp-usd", "usd-jpy", ...],
  "tier": "paid"
}
```

**Server-side validation:**

- Reject if `pairIds.length > 16` (hard limit)
- Reject if any pair ID not in SSOT catalog (allowlist)
- Log warning if odd count (should not happen with UI constraints)

#### Sync Behaviour

| Scenario                           | Behaviour                            |
| ---------------------------------- | ------------------------------------ |
| Fresh login                        | Clerk â†’ localStorage (Clerk wins)  |
| localStorage exists, no Clerk data | localStorage â†’ Clerk (migrate)     |
| Both exist, Clerk newer            | Clerk â†’ localStorage               |
| Both exist, localStorage newer     | localStorage â†’ Clerk               |
| Conflict (same timestamp)          | Clerk wins (source of truth)         |
| Offline                            | localStorage used, sync on reconnect |

#### Fallback Behaviour

| Condition                        | Result                                |
| -------------------------------- | ------------------------------------- |
| Free user                        | SSOT default pairs (no picker access) |
| Pro user, no selection saved     | SSOT default pairs                    |
| Pro user, localStorage corrupted | Clerk data used                       |
| Pro user, Clerk unreachable      | localStorage used                     |
| Pro user, both unavailable       | SSOT default pairs                    |

#### UI Lock State

- Standard Promagen: No FX Picker button visible
- Pro Promagen: FX Picker button visible and functional

Rules:

- Selection does **not** affect ordering â€” longitude ordering is invariant
- Selection affects **content only** (which pairs), not **physics** (how they're ordered)
- SSOT still controls default pairs for free users and fallback
- The ribbon remains SSOT-driven; Pro users edit their personal SSOT-compatible config

Authority for implementation: `docs/authority/ribbon-homepage.md` (FX Picker section)

---

### 5.6 Prompt builder selection limits (platform-aware precision control)

Selection limits are **platform-aware** â€” different AI platforms handle prompt complexity differently. The system assigns each of Promagen's 40 supported platforms to one of four tiers based on their prompt handling capabilities.

#### Platform Tier Philosophy

| Tier | Name              | Platforms | Philosophy                                                                |
| ---- | ----------------- | --------- | ------------------------------------------------------------------------- |
| 1    | CLIP-Based        | 13        | Weighted syntax, keyword stacking, benefits from quality boosters         |
| 2    | Midjourney Family | 2         | Structured parameters (`--ar`, `--v`), loves style stacking, highest caps |
| 3    | Natural Language  | 10        | Conversational prompts, simpler colour/mood, moderate caps                |
| 4    | Plain Language    | 17        | Short simple prompts (5–15 words ideal), all categories capped at 1       |

**Source of truth:** `src/data/platform-tiers.ts` (tier definitions) and `src/lib/usage/constants.ts` (category limits).

#### Surface-Aware Prompt Tier System (All Prompt Format)

The prompt tier displayed in flag tooltips is **surface-aware** for Standard Promagen users and **globally overridable** for Pro Promagen users.

**Standard Promagen — Variable Reward (per-surface rotation):**

Free users see different tiers on different surfaces, creating variety:

| Surface         | Default Tier | Rationale                                      |
| --------------- | ------------ | ---------------------------------------------- |
| Exchange cards  | Tier 3       | Most visible — rich natural sentences          |
| AI Leaderboard  | _native_     | Each provider's own tier (educational variety) |
| FX ribbon       | Tier 1       | Technical CLIP weights look advanced           |
| Commodities     | Tier 2       | Midjourney parameters are visually distinctive |
| Mission Control | Tier 4       | Simplest entry point, accessible               |

**Source of truth:** `FREE_SURFACE_TIERS` in `src/hooks/use-global-prompt-tier.ts`

**Pro Promagen — Global override:**

Paid users select a single tier (1–4) that applies to ALL surfaces. Selection is stored:

1. **localStorage** (`promagen:pro:prompt-tier`) — immediate read on page load
2. **Clerk metadata** (`publicMetadata.promptTier`) — cross-device sync, source of truth
3. **API route** (`/api/user/preferences` PATCH) — validates tier is 1–4, rejects free users with 403

**Priority chain (Pro users):** Clerk metadata → localStorage → Tier 4 fallback

When Clerk data arrives (async hydration), it overwrites localStorage to ensure consistency. The `useEffect` in `use-global-prompt-tier.ts` watches `[isPro, freeTier, clerkPromptTier]`.

**Hook:** `useGlobalPromptTier(surface, nativeTier?)` — returns `{ tier, setTier }`. Every tooltip consumer passes its surface name. The hook decides whether to use the free surface tier or the Pro global override.

**Consumer files that pass surface:**

| File                           | Surface param       |
| ------------------------------ | ------------------- |
| `exchange-list.tsx`            | `'exchange-cards'`  |
| `provider-cell.tsx`            | `'leaderboard'`     |
| `finance-ribbon.container.tsx` | `'fx-ribbon'`       |
| `commodity-mover-card.tsx`     | `'commodities'`     |
| `mission-control.tsx`          | `'mission-control'` |

**Naming:** The feature was renamed from "Weather Prompt Format" to "All Prompt Format" in `presets.ts` because it affects ALL prompt tooltips (weather-driven, city-vibe, and leaderboard), not just weather.

#### Category Limits by Tier (Free Users)

| Category       | Tier 1 | Tier 2 | Tier 3 | Tier 4 | Pro Bonus |
| -------------- | ------ | ------ | ------ | ------ | --------- |
| Subject        | 1      | 1      | 1      | 1      | —         |
| Action         | 1      | 1      | 1      | 1      | —         |
| Environment    | 1      | 1      | 1      | 1      | —         |
| Composition    | 1      | 1      | 1      | 1      | —         |
| Camera         | 1      | 1      | 1      | 1      | —         |
| **Style**      | 2      | 3      | 2      | 1      | **+1**    |
| **Lighting**   | 2      | 3      | 2      | 1      | **+1**    |
| **Colour**     | 2      | 2      | 1      | 1      | **+1**    |
| **Atmosphere** | 2      | 2      | 1      | 1      | **+1**    |
| **Materials**  | 2      | 2      | 1      | 1      | **+1**    |
| **Fidelity**   | 2      | 3      | 2      | 1      | **+1**    |
| **Negative**   | 5      | 8      | 3      | 2      | **+1**    |

**12 categories total.** Tier 2 (Midjourney) has the highest caps — MJ handles style stacking, multiple light sources, and long `--no` lists well. Tier 4 (Plain Language) is capped at 1 per category because simple platforms work best with short prompts.

**Stackable categories** (bold above) get **platform-specific Pro bonuses** via `PLATFORM_SPECIFIC_LIMITS` in `constants.ts`. The legacy flat `+1` via `generatePaidLimits()` is used as tier-generic fallback when a platform has no per-platform entry.

> **Budget-aware conversions (v3.0.0):** Fidelity and negative selections on conversion platforms (Midjourney, Flux, Recraft, Luma, DALL-E, Firefly, etc.) represent UI slots, not guaranteed output slots. The assembler's budget-aware conversion pipeline converts user selections into platform-native equivalents and fits as many as the prompt budget allows. Parametric conversions (MJ `--quality 2`, `--stylize 300`) are always included (cost=0). Inline conversions are budget-gated — the highest-scoring conversions are included first. Deferred conversions appear in the Transparency Panel with their reason. Source: `conversion-costs.ts`, `conversion-budget.ts`, `conversion-scorer.ts`, `conversion-affinities.ts` in `src/lib/prompt-builder/`.

#### Platform Assignments

**Source of truth:** `src/data/platform-tiers.ts` — all 40 providers from `providers.json` are assigned.

**Tier 1 — CLIP-Based (13 platforms):**
Artguru, Clipdrop, Dreamlike.art, DreamStudio, Getimg.ai, Jasper Art, Leonardo AI, Lexica, NightCafe, NovelAI, OpenArt, Playground AI, Stability AI / Stable Diffusion

**Tier 2 — Midjourney Family (2 platforms):**
BlueWillow, Midjourney

**Tier 3 — Natural Language (10 platforms):**
Adobe Firefly, Bing Image Creator, Flux (Black Forest Labs), Google Imagen, Hotpot.ai, Ideogram, Imagine (Meta), Microsoft Designer, DALL·E 3 (OpenAI), Runway ML

**Tier 4 — Plain Language (17 platforms):**
Artbreeder, Artistly, Canva Magic Media, Craiyon, DeepAI, Fotor, Freepik AI, MyEdit (CyberLink), Photoleap, Picsart, PicWish, Pixlr, Remove.bg (Kaleido AI), Simplified, Visme AI, VistaCreate, 123RF AI Generator

#### Behaviour on Platform Switch

When user switches to a platform with lower limits:

1. Auto-trim excess selections (most recently added removed first)
2. Show toast: "Selection trimmed to fit [Platform] limits"
3. Preserve user's preference order where possible

---

### 5.7 Market Pulse city connections

Market Pulse is **fully dynamic** — connections are derived at runtime by matching `exchange.city === provider.hqCity` in `src/data/city-connections.ts`. There are no hardcoded city lists and **no Pro/free gating**. Every user sees the same connections.

The number of active connections depends on which exchanges and providers share a city. If a new provider or exchange is added to their respective JSON files, connections auto-update.

**Not a Pro feature.** Market Pulse is available to all users equally. It was originally planned with tiered city counts but the implementation uses fully dynamic matching instead.

Authority for implementation: `src/data/city-connections.ts`, `src/hooks/use-market-pulse.ts`

---

### 5.8 Image Quality vote weight multiplier

When voting on AI provider image quality, Pro Promagen users' votes count **1.5×**.

| User Type         | Vote Weight |
| ----------------- | ----------- |
| Standard Promagen | 1.0×        |
| Pro Promagen      | 1.5×        |

**Source of truth:** `src/hooks/use-promagen-auth.ts` line 230: `const voteWeight = userTier === 'paid' ? 1.5 : 1.0;`

Authority for implementation: `docs/authority/ai providers.md` (voting system section)

---

### 5.9 Ask Promagen (LLM-powered suggestions)

"Ask Promagen" allows users to describe what they want in natural language and receive curated prompt suggestions.

#### Tier Comparison

| Aspect      | Anonymous       | Standard Promagen | Pro Promagen |
| ----------- | --------------- | ----------------- | ------------ |
| Daily limit | 5 suggestions   | 10 suggestions    | Unlimited    |
| Reset time  | Midnight local  | Midnight local    | N/A          |
| Storage     | localStorage    | Vercel KV         | N/A          |
| Lock state  | Sign-in overlay | Upgrade overlay   | Never locked |

#### Example Interaction

**User input:** "I want a cyberpunk city at night with neon lights"

**Promagen response:**

```
Subject: Futuristic cityscape
Environment: Urban metropolis
Time: Night
Lighting: Neon glow, artificial lighting
Atmosphere: Dystopian, electric
Style: Cyberpunk, sci-fi
Colours: Electric blue, hot pink, purple
```

#### Cost Control

| Aspect   | Implementation                                           |
| -------- | -------------------------------------------------------- |
| Model    | Claude Haiku (~$0.25/1M input tokens) or GPT-4o-mini     |
| Caching  | Identical queries cached in Vercel KV for 24h            |
| Debounce | 500ms debounce, only calls on [Suggest â†’] button click |

#### Fallback

If LLM call fails:

1. Show toast: "Suggestion unavailable â€” try the dropdowns below"
2. Log error for monitoring
3. Do **not** count against user's daily limit

#### Storage Schema

```typescript
// Anonymous localStorage
interface AnonymousAskUsage {
  count: number; // Daily suggestion count
  lastResetDate: string; // YYYY-MM-DD
  version: 1;
  checksum: string;
}

// Authenticated (Vercel KV)
// Key: `ask:${userId}:${date}`
interface AuthenticatedAskUsage {
  userId: string;
  date: string; // YYYY-MM-DD in user's timezone
  suggestionCount: number;
  timezone: string;
  lastUpdated: string; // ISO timestamp
}
```

**Status:** Planned feature â€” see `TODO-api-integration.md` Â§2.4 for implementation details.

Authority for implementation: `docs/authority/TODO-api-integration.md`

---

### 5.10 Pro Promagen Page — Feature Control Panel (`/pro-promagen`)

**Last updated:** 22 March 2026
**Architecture:** Feature Control Panel v7.0.0 + Debounced Intent v5.0.0 + Dropdown Cooldown + ImageGen Rotate v6.0.0
**Replaces:** Comparison table layout (removed 14 March 2026)

The `/pro-promagen` route serves **two purposes from the same UI**:

| User Type | Mode          | Behaviour                                                                                       |
| --------- | ------------- | ----------------------------------------------------------------------------------------------- |
| Free user | Preview       | 9 feature cards show Standard vs Pro values. Hover-previews show features. CTA → `/upgrade`     |
| Paid user | Configuration | Same 9 cards become live controls. Tier selector active. Exchange Picker accessible. CTA → Save |

No other SaaS uses this pattern — the same page is both the sales page and the configuration cockpit.

#### Page Layout (Uses HomepageGrid — same as `/` and `/world-context`)

```
┌───────────────────────────────────────────────────────────────────────┐
│  "Pro Promagen — Unlock the Full Engine"                              │
├──────────┬─────────────────────────────────────────┬──────────────────┤
│          │                                         │                  │
│ Engine   │  ★ Pro Promagen  [Preview/Config badge] │  Mission         │
│ Bay      │  ┌──────────┬──────────┬──────────┐     │  Control         │
│ (xl+)    │  │⚡ Daily   │🎨 Format │🎬 Scenes │     │                  │
│          │  │ Prompts  │          │          │     │  Exchange        │
│ Exchange │  ├──────────┼──────────┼──────────┤     │  Cards           │
│ Cards    │  │📊 Exchange│💾 Saved  │🧪 Prompt │     │  (right)         │
│ (left)   │  │          │          │   Lab    │     │                  │
│          │  ├──────────┼──────────┼──────────┤     │                  │
│          │  │🌍 Frame  │⚙️ Stacking│🖼️ Image │     │                  │
│          │  │          │          │  Gen     │     │                  │
│          │  └──────────┴──────────┴──────────┘     │                  │
│          │                                         │                  │
│          │  ┌─────────────────────────────────────┐ │                  │
│          │  │  HOVER PREVIEW / PAYMENT AREA       │ │                  │
│          │  │  (swaps on card hover)               │ │                  │
│          │  └─────────────────────────────────────┘ │                  │
│          │                                         │                  │
│          │  [★ Upgrade to Pro Promagen]  (CTA)     │                  │
│          │                                         │                  │
└──────────┴─────────────────────────────────────────┴──────────────────┘
```

#### The 9 Feature Cards (3×3 Grid)

Each card uses the **exchange-card glow pattern** — same `hexToRgba()`, same triple-layer `boxShadow`, same radial gradient overlays, same 200ms transition. Each card has a unique colour.

| Card | Emoji | Label               | Colour  | Free Value                       | Pro Value                          | Action (Free)  | Action (Pro)   | Live Stat        |
| ---- | ----- | ------------------- | ------- | -------------------------------- | ---------------------------------- | -------------- | -------------- | ---------------- |
| 1    | ⚡    | Daily Prompts       | #f59e0b | X / 3 today                      | Unlimited                          | Go unlimited → | Unlimited      | count/limit or ∞ |
| 2    | 🎨    | Prompt Format       | #60a5fa | All current prompts are a spread | The choice of Prompt Text is yours | Pro only       | Tier dropdown  | —                |
| 3    | 🎬    | Scenes              | #c084fc | 25 free scenes                   | 200 · 23 worlds                    | Unlock 175 →   | Explore →      | 25 or 200        |
| 4    | 📊    | Exchanges           | #22d3ee | 16 fixed                         | 0–16, your choice                  | Customise →    | Configure →    | count            |
| 5    | 💾    | Saved               | #a78bfa | X · browser only                 | Synced across devices              | View library → | Open library → | saved count      |
| 6    | 🧪    | Prompt Lab          | #fb7185 | Pro exclusive                    | Full access                        | Pro only       | Open lab →     | —                |
| 7    | 🌍    | Frame               | #34d399 | Your location                    | You / Greenwich toggle             | Pro only       | Active         | —                |
| 8    | 🧠    | Prompt Intelligence | #fb923c | Standard assembly                | 45-platform adaptive engine        | Pro only       | Active         | —                |
| 9    | 🖼️    | Image Gen           | #e879f9 | Copy & paste                     | Generate inside Promagen           | Coming to Pro  | Coming to Pro  | —                |

**Cards with navigation** (→ arrow on hover): Daily Prompts (free only → `/upgrade`), Scenes, Exchanges (opens picker), Saved, Prompt Lab (paid only).

**Cards without navigation** (info-only): Daily Prompts (paid), Prompt Format, Frame, Prompt Intelligence, Image Gen.

**Live data cards:** Daily Prompts reads `useDailyUsage` count. Saved reads `useSavedPrompts().allPrompts.length`. Exchange count reads `selectedExchanges.length`.

#### Prompt Format Card — Tier Dropdown + Hover Preview

The Prompt Format card has special behaviour:

**Inside the card (v7.0.0):**

- **Paid users** see a colour-coded `<select>` dropdown showing T1·CLIP / T2·MJ / T3·Natural / T4·Plain. Each `<option>` has its tier colour (blue/purple/emerald/orange). Border and text colour match the selected tier. Selection fires `onDropdownSelect` which triggers a 2-second panel switch cooldown (prevents accidental hover into adjacent Saved card).
- **Free/unpaid users** see standard feature card layout: white text "All current prompts are a spread" + blue text "The choice of Prompt Text is yours" — same two-row pattern as every other feature card.
- Selection saves to localStorage + Clerk metadata via `handlePromptTierChange`

**Below the cards (hover preview — TierPreviewPanel):**

When user hovers the Prompt Format card, the CTA/payment area transforms into **4 horizontal tooltip-style windows** (one per tier: T1 CLIP, T2 Midjourney, T3 Natural Language, T4 Plain Language).

**Centred amber header:** "Pick a format — every prompt on Promagen follows your choice" — italic, pulsing, centred, same as all other preview panels. No dropdown in the header (removed v7.0.0).

**Each TierWindow contains (top to bottom):**

1. **"Image Prompt" header** (white, `font-semibold`) + **PRO badge** (paid users only) + **Save button** + **Copy button** — matches real `WeatherPromptTooltip` header
2. **Tier badge pill** — coloured dot + "Tier N: Label" in tier colour, `rounded-full` with `ring-1`, identical to real `TierBadge` component
3. **Prompt text** — auto-scrolling (17s cycle via `proAutoScroll`), **colour-coded by category** using `labBuildTermIndex` + `labParsePrompt` + `CATEGORY_COLOURS` (same as Prompt Lab). Falls back to white text if no `categoryMap` available. Font: `font-mono leading-relaxed`
4. **"Other formats available"** section — `border-t border-white/[0.06]` separator, `text-slate-400` label, then 3 full-width **unblurred** tier rows (one for each other tier). Each row: colour dot + "TX" label + visible preview text (truncated, `text-slate-400`). Clickable — switches tier via `onTierChange`. **No blur, no lock icons** — free and paid see identical view.
5. **"Unlock all formats"** — amber gradient `<a href="/pro-promagen">` with lock icon, free users only
6. **Gold crown** — "👑 Active tier" on the currently selected window

**Free vs paid — identical view.** Free users see the exact same 4 windows as paid users. No blurring, no locks on the tier rows.

**3 ways to select tier:**

1. Dropdown in the Prompt Format feature card (paid only)
2. Click inside a preview window
3. Click in real flag emoji tooltips on any page

All 3 paths sync via `useGlobalPromptTier`.

**Dropdown cooldown (v7.0.0):** After a tier is selected via the dropdown, a 2-second `dropdownCooldownRef` blocks `handleCardHover` from switching to a different panel. This prevents the cursor from accidentally triggering the Saved card preview when moving away from the dropdown.

**State flow:**

```
Prompt Format card hover → setFormatHovered(true)
  → CTA area conditionally renders TierPreviewPanel
  → TierPreviewPanel calls usePromptShowcase() for live PotM data
  → 4 TierWindows render with potmData.prompts.tier1–tier4
  → Each TierWindow receives tierCategoryMap for colour coding
Mouse leave → setFormatHovered(false) → CTA/UpgradeCta renders
```

#### Hover Bridge + Debounced Intent Pattern (All 9 Cards — v5.0.0)

All 9 feature cards (6 with previews, 3 info-only) use the **debounced intent detection** pattern for preview panels:

1. **No active panel → first card hover** → opens preview instantly (zero debounce)
2. **Same card re-hovered** → no action (already showing)
3. **Different card hovered while panel is active** → 150ms debounce starts. If cursor leaves that card within 150ms (passing through toward the preview), switch is cancelled. If cursor stays 150ms (deliberate hover), panel switches.
4. **Cursor enters preview panel** → cancels all debounces and linger timers (safe zone)
5. **Card leave without entering another card** → starts 2-second linger timer
6. **Cursor leaves preview panel** → panel closes immediately

**Why 150ms debounce (not 100ms or 200ms):** 150ms is fast enough to feel instant for deliberate hovers, long enough to filter diagonal cursor movement across cards while heading toward the preview panel below. Tested against the 3×3 grid layout where cards are small and closely spaced.

**History:** v4.0.0 used an intent triangle (Amazon mega-menu pattern) — a geometric corridor from cursor anchor to preview panel edges. This failed because the single-point triangle apex created a razor-thin corridor that only worked ~5% of the time on small card grids. v5.0.0 replaces geometry with temporal debouncing, which is geometry-independent and works 100% of the time.

**Implementation:** Single `activePanel` state (union type) + `lingerRef` (2s setTimeout) + `switchDebounceRef` (150ms setTimeout) + `inPreviewRef` (boolean). Preview panel container has `onMouseEnter`/`onMouseLeave` handlers, only attached when `activePanel !== null`.

**Performance:** All 9 preview panels (8 feature + 1 CTA/payment) are always mounted, toggled via `style={{ display: activePanel === 'x' ? 'flex' : 'none' }}`. This avoids mount-on-hover spikes. CSS toggle = zero React work, instant paint.

**Preview panels per card:**

| Card                   | Preview Panel            | Content                                                             |
| ---------------------- | ------------------------ | ------------------------------------------------------------------- |
| ⚡ Daily Prompts       | DailyPromptsPreviewPanel | Miniaturised builder mockup with auto-scrolling colour-coded prompt |
| 🎨 Prompt Format       | TierPreviewPanel         | 4 horizontal tooltip-clone windows with colour-coded PotM data      |
| 🎬 Scenes              | ScenesPreviewPanel       | 5 free world windows + 18 pro world emojis                          |
| 📊 Exchanges           | ExchangesPreviewPanel    | CTA window + 4 regional auto-scrolling mini exchange cards          |
| 💾 Saved               | SavedPreviewPanel        | Up to 5 most recent saved prompts with auto-scroll (white text)     |
| 🧪 Prompt Lab          | PromptLabPreviewPanel    | "What Promagen Sees" + 4 rotating provider prompts                  |
| 🌍 Frame               | FramePreviewPanel        | 5 reference city windows with exchange cards                        |
| 🧠 Prompt Intelligence | IntelligencePreviewPanel | Prompt translation showcase across platforms                        |
| 🖼️ Image Gen           | ImageGenPreviewPanel     | Single-card rotation: colour-coded prompt + real AI image           |

#### Exchanges Preview Panel (v4.0.0)

When the Exchanges card is hovered, 5 vertical windows appear:

**Window 1 (CTA):** "Configure Your Exchanges" with 📊 icon, description ("Select 6–16 exchanges to shape every prompt"), and clickable "Click to Select" button opening the fullscreen Exchange Picker. Cyan (#22d3ee) glow.

**Windows 2–5 (Regional):** Americas, Europe, Africa & M. East, Asia Pacific. Each shows mini exchange cards with flag + name + city + index name (where available). Cards styled identically to real rail cards. One exchange per country (deduped by iso2). Display order follows `iso2Codes` array (Americas: US, CA, MX first). **All cards rendered** — auto-scroll (17s `proAutoScroll` cycle) reveals cards that overflow, same pattern as Frame preview. Amber header: "Choose the exchanges that power your prompts".

#### Saved Preview Panel (v7.0.0)

When the Saved card is hovered, up to 5 most recent saved prompts appear as horizontal windows with auto-scroll.

**Each `SavedPromptWindow` contains:**

- Platform name (coloured) + provider icon
- Tier badge pill
- **White prompt text** with auto-scroll (17s `proAutoScroll` cycle via `useAutoScroll()`)
- "Browser only" warning label (amber)

**Empty slots** (if fewer than 5 saved): dashed purple outlines with 💾 icon and "Empty slot" text.

**Why white text (not colour-coded):** Saved prompts are frozen snapshots from arbitrary cities/weather/times. The PotM `categoryMap` from today won't accurately match terms in a prompt saved last week. Colour coding would be misleading — most terms would fall through as structural grey. White text is honest.

**Amber header:** "{count} prompt(s) saved — browser only" (personalised) or "Start saving prompts — build your library" (empty).

**Bottom row:** "Clear cache = all gone" (amber) | "Pro: Synced forever" (emerald)

#### Daily Prompts Preview Panel (v5.0.0)

When the Daily Prompts card is hovered, a miniaturised, read-only snapshot of the standard prompt builder appears. This shows what the tool _looks like to use_, not the output — differentiating from the Prompt Lab and Prompt Format previews.

**Content (auto-scrolling vertically):**

- **Provider badge** — icon + name from PotM `tierProviders.tier1[0]`
- **12 category rows** in a compact 2-column grid, each label in its `CATEGORY_COLOURS` colour with selected terms as coloured chips (max 3 visible + overflow count)
- **Assembled prompt box** — full colour-coded text via `parsePromptIntoSegments()`, "✨ Dynamic" stage badge, char count
- **Optimized prompt box** — emerald border, "⚡ Optimized" badge, colour-coded text

**Auto-scroll animation:**

- Content starts at `translateY(0)` (top visible)
- 0.3s hold
- Slow scroll down over ~8 seconds (CSS `@keyframes`, ease-in-out)
- 0.3s hold at bottom
- Slow scroll back up over ~8 seconds
- Total cycle: ~17 seconds
- `prefers-reduced-motion` disables the scroll
- Scroll distance computed via `ResizeObserver` on content height minus container height

**Data source:** `usePromptShowcase()` — same PotM data that rotates every 3 minutes on the homepage. Assembled prompt computed live via `assemblePrompt()` with the PotM's `categoryMap` and `tierProviders.tier1[0]`.

**Click behaviour:** Clicking anywhere in the preview navigates to `/providers/{providerId}` with the PotM payload pre-loaded via `sessionStorage.setItem('promagen:preloaded-payload', ...)`. User lands in the real builder with live data already populated.

**Amber header text:** "Unlimited colour-coded prompts — this is what Pro looks like" — italic, pulsing, same `text-amber-400/80 animate-pulse` pattern as all other preview panels.

**Design matches:** Same glass/glow pattern as other preview panels — amber (#f59e0b) tint matching Daily Prompts card colour, `rgba(15, 23, 42, 0.97)` background, triple-layer box-shadow, radial gradient overlays.

#### Frame Preview Panel (v6.0.0)

When the Frame card is hovered, 5 vertical windows appear — each showing what the exchange rail looks like when a different reference city is the anchor point.

**5 reference cities:** Tokyo (pink #fb7185), New York (blue #60a5fa), Sydney (cyan #22d3ee), Mumbai (amber #fbbf24), London (emerald #34d399).

**Each window has:**

- Hero bubble at top — flag (hero size), city name in window colour with glow, "Reference Point" label
- Exchange cards below — identical style to real rail cards (same `hexToRgba()`, borders, glow overlays, flag sizes)
- Auto-scroll (17s cycle) on each column to reveal all cards

**Amber header:** "Choose the reference that shapes your prompts"

**Bottom row:** "✓ Same exchanges, different perspective" (emerald) | "Pro: Your city leads" (amber)

#### Image Generation Preview Panel (v6.0.0) — BYOAPI Teaser

When the Image Gen card is hovered, a single full-height showcase card appears, rotating through 5 platforms with a crossfade every 15 seconds.

**Status:** "Coming to Pro" — this is a teaser for the Bring Your Own API Key feature. No generation functionality exists yet. The preview uses real AI-generated images stored as static assets.

**Layout:** Single card fills the entire preview area. Left half: colour-coded prompt text. Right half: real AI-generated image with blur-to-sharp animation.

**5 platforms with API access (no Midjourney — it has no API):**

| Platform    | Family   | Scene            | Image Asset                             |
| ----------- | -------- | ---------------- | --------------------------------------- |
| Leonardo AI | leonardo | Cyberpunk Street | `/images/pro/imagegen-leonardo.jpg`     |
| Flux Pro    | flux     | Desert Sunset    | `/images/pro/imagegen-flux.jpg`         |
| DALL·E 3    | natural  | Aurora Borealis  | `/images/pro/imagegen-openai.png`       |
| Ideogram    | ideogram | Zen Garden       | `/images/pro/imagegen-ideogram.png`     |
| Imagine     | natural  | Coral Reef       | `/images/pro/imagegen-imagine-meta.png` |

**Prompt text:** The actual prompts used to generate the images, segmented by category colour using `CATEGORY_COLOURS` SSOT. Leonardo uses `term::1.3` (double-colon) syntax, Flux uses keyword chains, DALL·E/Ideogram/Imagine use natural language prose. Font: `font-mono leading-relaxed`, `clamp(0.625rem, 0.65vw, 0.8rem)` — matches Prompt Lab preview exactly.

**Blur-to-sharp animation (15s cycle):**

1. Image starts at `blur(18px)`, dim, desaturated — simulates generation starting
2. Gradually resolves over ~10 seconds (brightness + saturation return)
3. Crystal clear for ~3 seconds — the payoff
4. Fades back to blur — cycle restarts
5. Fuchsia progress bar at bottom synced to the cycle

**Crossfade rotation (15s per card):**

- 300ms fade-out → swap to next platform → 300ms fade-in
- `key={activeIdx}` forces fresh mount, resetting blur animation naturally
- 5 fuchsia dots indicate active card position

**Human factors:** Anticipatory Dopamine (blur-to-sharp simulates real generation suspense) + Curiosity Gap ("Coming to Pro" on a feature that shows real results)

**Flow header (fixed at top):** "Your Prompt → Your API Key → Your Image" with "Coming to Pro" badge

**Bottom row:** "✓ Your key · Your images · Your privacy" (emerald) | "Coming to Pro Promagen" (amber)

#### Exchange Selection Save Gating

| User Type | Can Open Picker | Can Browse    | Selections Persist         | Propagates to Other Pages |
| --------- | --------------- | ------------- | -------------------------- | ------------------------- |
| Free user | Yes             | Yes (preview) | No                         | No                        |
| Paid user | Yes             | Yes           | Yes (localStorage + Clerk) | Yes (all surfaces)        |

#### Exchange Picker (Fullscreen Mode)

When paid users click the Exchanges card (or free users click "Customise"):

1. **Entire centre panel becomes the Exchange Picker** (fullscreen mode)
2. Only the Done button visible at bottom — NO header, NO cards, NO CTA
3. Continental accordion groups show all 89 exchanges by 7 regions
4. "Done — Save Selection" button closes picker and returns to cards
5. State managed via `isExchangePickerFullscreen` boolean

**Note:** FX Picker was fully removed (v3.0.0, 10 March 2026). FX pair selection is no longer available on the Pro page. The FX ribbon is hidden on this route (`showFinanceRibbon={false}`).

#### Demo Mode (Zero API Cost)

| Data Type       | Source                               | Display                     |
| --------------- | ------------------------------------ | --------------------------- |
| Exchange clocks | Client `Intl.DateTimeFormat`         | Real local time             |
| Market status   | Client calculation                   | Open/Closed                 |
| Weather badges  | Demo placeholder                     | Shows "—" or static icon    |
| Exchange cards  | Same component as homepage           | Identical styling           |
| PotM prompts    | `/api/homepage/prompt-of-the-moment` | Live (shared with homepage) |

#### Component Architecture

| Component                  | Source                                            | Notes                                               |
| -------------------------- | ------------------------------------------------- | --------------------------------------------------- |
| `HomepageGrid`             | `@/components/layout/homepage-grid`               | Standard 3-column layout                            |
| `FeatureControlPanel`      | `@/components/pro-promagen/feature-control-panel` | 3×3 feature card grid (v7.0.0, 453 lines)           |
| `TierPreviewPanel`         | `pro-promagen-client.tsx` (inline)                | 4 tooltip-clone windows with colour-coded PotM data |
| `SavedPromptWindow`        | `pro-promagen-client.tsx` (inline)                | Single saved prompt with auto-scroll (white text)   |
| `DailyPromptsPreviewPanel` | `pro-promagen-client.tsx` (inline)                | Auto-scrolling miniaturised builder mockup          |
| `FramePreviewPanel`        | `pro-promagen-client.tsx` (inline)                | 5 reference city windows with exchange cards        |
| `ImageGenPreviewPanel`     | `pro-promagen-client.tsx` (inline)                | Single-card rotation: prompt + AI image (v6.0.0)    |
| `IntelligencePreviewPanel` | `pro-promagen-client.tsx` (inline)                | Prompt translation showcase across platforms        |
| `UpgradeCta`               | `@/components/pro-promagen/upgrade-cta`           | Mode-aware button                                   |
| `ExchangePicker`           | `@/components/pro-promagen/exchange-picker`       | Continental accordion (fullscreen mode)             |
| `ExchangeList`             | `@/components/ribbon/exchange-list`               | Left/right exchange rails                           |
| `EngineBay`                | `@/components/home/engine-bay`                    | Provider icon grid (xl+ only)                       |
| `MissionControl`           | `@/components/home/mission-control`               | Home button shown (not Pro button)                  |
| `ProGemBadge`              | `@/components/layout/pro-gem-badge`               | Evolving hexagonal gem badge (§5.15)                |
| `SaveIcon`                 | `@/components/prompts/library/save-icon`          | Save button in tier preview windows                 |
| `usePromptShowcase`        | `@/hooks/use-prompt-showcase`                     | Live PotM data (3-min rotation)                     |
| `useGlobalPromptTier`      | `@/hooks/use-global-prompt-tier`                  | Shared tier hook — SSOT for all surfaces (§5.16)    |

#### State Management (v5.0.0 — Debounced Intent + Shared Tier Hook)

```typescript
// In pro-promagen-client.tsx (v5.0.0+)
const [selectedExchanges, setSelectedExchanges] =
  useState<string[]>(defaultExchangeIds);
// Tier selection uses the shared hook — single source of truth across
// Pro page, exchange tooltips, and all other surfaces. No local state.
const { tier: selectedPromptTier, saveTier: hookSaveTier } =
  useGlobalPromptTier("pro-page");
const [isExchangePickerFullscreen, setIsExchangePickerFullscreen] =
  useState(false);

// Debounced Intent — unified panel visibility
type PreviewPanel =
  | "daily"
  | "format"
  | "scenes"
  | "saved"
  | "lab"
  | "exchanges"
  | "frame"
  | "imagegen"
  | "intelligence";
const [activePanel, setActivePanel] = useState<PreviewPanel | null>(null);
const lingerRef = useRef<ReturnType<typeof setTimeout>>();
const switchDebounceRef = useRef<ReturnType<typeof setTimeout>>();
const inPreviewRef = useRef(false);

// Dropdown cooldown — 2s block on panel switching after tier dropdown select
const dropdownCooldownRef = useRef(false);

// Hydration gate — false until useEffect reads localStorage
const [hydrated, setHydrated] = useState(false);

// handlePromptTierChange delegates to hookSaveTier —
// handles local state, localStorage, Clerk persistence, AND same-tab sync
const handlePromptTierChange = useCallback(
  (tier: PromptTier) => hookSaveTier(tier),
  [hookSaveTier],
);
```

**Key changes (v4.0.0 → v5.0.0):**

- `useState<PromptTier>(4)` **removed** — replaced by `useGlobalPromptTier('pro-page')` shared hook
- Clerk tier hydration `useEffect` **removed** — hook handles internally
- `handlePromptTierChange` **simplified** from 12 lines to 1 (delegates to `hookSaveTier`)
- `PreviewPanel` type gains `'daily'`, `'frame'`, `'imagegen'` (8 preview panels, not 5)
- Intent triangle refs (`mousePosRef`, `intentAnchorRef`, `sectionRef`) **removed** — replaced by `switchDebounceRef`
- Same-tab sync: `saveTier()` in hook dispatches synthetic `StorageEvent` so all hook instances update immediately

**Key changes (v6.0.0 → v7.0.0):**

- `PreviewPanel` type gains `'intelligence'` (9 preview panels)
- Card 8 changed from "⚙️ Stacking" to "🧠 Prompt Intelligence" — 45/17 alternating stat removed
- Prompt Format card: paid users see colour-coded tier dropdown (per-option colours), free users see "All current prompts are a spread" / "The choice of Prompt Text is yours"
- TierPreviewPanel header: dropdown removed, amber text centred
- TierWindow: "Tier N: Label" row removed, prompt text colour-coded via `labBuildTermIndex`/`CATEGORY_COLOURS`, "Other formats" rows unblurred (no lock icons), "Unlock all formats" per-window for free users
- `dropdownCooldownRef` added — 2s cooldown after dropdown selection blocks panel switching
- `onDropdownSelect` callback added to `FeatureControlPanel` interface
- ExchangesPreviewPanel: `slice(0, maxVisibleCards)` removed — all cards render, auto-scroll via `useAutoScroll()`
- SavedPreviewPanel: extracted `SavedPromptWindow` sub-component with `useAutoScroll()`, white prompt text (colour coding removed — saved prompts lack reliable categoryMap)
- DailyPromptsPreviewPanel: Category Colour Key removed from bottom
- All "40 platform" references updated to "40 platforms" across 4 files

#### Data Flow (v5.0.0)

1. Page loads → show SSOT defaults (tier from shared hook, 16 exchanges)
2. `useGlobalPromptTier('pro-page')` hook reads Clerk metadata → localStorage → fallback Tier 4
3. `useEffect` reads localStorage for saved exchange preferences
4. User hovers any feature card → `handleCardHover(panel, true)`
5. If no panel active → switch instantly. If different panel active → 150ms debounce starts
6. If cursor stays 150ms → `activePanel` set → preview appears
7. If cursor leaves card within 150ms → debounce cancelled (pass-through filtered)
8. User leaves card without entering another → 2s linger timer starts
9. If cursor enters preview panel within 2s → timer cancelled, panel stays
10. Cursor leaves preview → `activePanel` null → CTA/payment area shown
11. User clicks T1–T4 in Prompt Format card → `hookSaveTier()` fires → updates local state + localStorage + Clerk + dispatches StorageEvent for same-tab sync
12. All exchange tooltips on the page pick up the tier change via their own `useGlobalPromptTier` hook instances (StorageEvent listener)
13. User hovers Daily Prompts card → DailyPromptsPreviewPanel shows miniaturised builder with auto-scrolling colour-coded prompt
14. User clicks inside Daily Prompts preview → navigates to `/providers/{providerId}` with PotM payload pre-loaded
15. User hovers Exchanges card → ExchangesPreviewPanel shows regional mini-cards
16. User clicks "Click to Select" in preview (or clicks card) → fullscreen picker opens
17. User makes selections → "Done" returns to card grid
18. User hovers Frame card → FramePreviewPanel shows 5 reference city windows with exchange cards
19. User hovers Image Gen card → ImageGenPreviewPanel shows single rotating card with colour-coded prompt + blur-to-sharp AI image (rotates every 15s across 5 platforms)
20. **Paid users:** Save → localStorage + Clerk metadata → propagates to all surfaces
21. **Free users:** Preview only, "Start Free Trial" → Stripe Checkout

#### File Structure

```
src/
├── app/pro-promagen/
│   ├── page.tsx                      # Server component
│   ├── pro-promagen-client.tsx       # Client orchestrator + 9 preview panels (4,693 lines, v7.0.0)
│   ├── error.tsx                     # Error boundary
│   └── loading.tsx                   # Loading skeleton (LCP-optimised heading)
├── components/pro-promagen/
│   ├── feature-control-panel.tsx     # 3×3 feature card grid (453 lines, v7.0.0)
│   ├── exchange-picker.tsx           # Continental accordion (774 lines, v3.0.0)
│   ├── upgrade-cta.tsx               # Stripe pricing cards + trial buttons (609 lines)
│   ├── index.ts                      # Barrel export
│   └── __tests__/
│       └── exchange-picker.test.tsx
├── components/layout/
│   └── pro-gem-badge.tsx             # Evolving hexagonal gem badge (NEW, ~200 lines)
├── hooks/
│   └── use-global-prompt-tier.ts     # Shared tier hook — SSOT for all surfaces (244 lines, v2.0.0)
├── lib/
│   └── lifetime-counter.ts           # incrementLifetimePrompts() + getLifetimePrompts() (NEW)
├── data/pro-promagen/
│   ├── presets.ts                    # FEATURE_COMPARISON + WEATHER_PROMPT_TIER_OPTIONS
│   └── currency-search-data.ts      # FX search index (legacy, may be removed)
├── lib/pro-promagen/
│   ├── exchange-picker-helpers.ts    # Grouping/search utilities
│   ├── types.ts                      # TypeScript interfaces (incl. isMultiIndexConfig guard)
│   └── index.ts                      # Barrel export
├── lib/stripe/
│   ├── stripe.ts                     # Stripe singleton
│   └── clerk-session.ts              # JWT cookie reader
├── lib/geo/
│   └── continents.ts                 # 7 continent configs (Turkey → MIDDLE_EAST, 280 lines)
├── public/images/pro/                # Static AI-generated images for Image Gen preview
│   ├── imagegen-leonardo.jpg         # Cyberpunk Street (Leonardo AI)
│   ├── imagegen-flux.jpg             # Desert Sunset (Flux Pro)
│   ├── imagegen-openai.png           # Aurora Borealis (DALL·E 3)
│   ├── imagegen-ideogram.png         # Zen Garden (Ideogram)
│   └── imagegen-imagine-meta.png     # Coral Reef (Imagine / Meta)
└── app/api/stripe/
    ├── checkout/route.ts             # Creates Checkout Session
    ├── webhook/route.ts              # Handles Stripe events
    └── portal/route.ts               # Customer Portal redirect
```

**Dead files (not imported, candidates for removal):**

- `comparison-table.tsx` — replaced by FeatureControlPanel
- `scene-grid-preview.tsx` — removed from render
- `tier-comparison-strip.tsx` — removed from render
- `tier-showcase.tsx` — removed from render
- `usage-snapshot.tsx` — removed from render

#### Validation Rules

- Exchanges: 0 ≤ count ≤ 16, all IDs must exist in SSOT catalog
- Prompt tier: 1, 2, 3, or 4 only (validated in `/api/user/preferences` route)
- Free users can fully interact (try before buy) but selections don't persist

#### Stripe Integration (LIVE — 16 March 2026)

Payment is handled via **Stripe Checkout** (redirect flow, not embedded). Now live with real payments.

**Pricing:**

| Plan    | Price                                  | Billing           | Trial            |
| ------- | -------------------------------------- | ----------------- | ---------------- |
| Monthly | £15.99/month                           | Monthly recurring | 7-day free trial |
| Annual  | £149.99/year (£12.49/month equivalent) | Yearly recurring  | 7-day free trial |

**Currency:** GBP only (clean UK accounting — Promagen Ltd is UK-registered).

**Checkout flow (sign-in first):**

1. User clicks "Start Free Trial" on `/pro-promagen`
2. If not signed in → Clerk sign-in modal first
3. Frontend POSTs to `/api/stripe/checkout` with `{ priceId, email }`
4. API creates Stripe Checkout Session (reads userId from `__session` JWT cookie)
5. User redirected to Stripe's hosted payment page (PCI-compliant, 3D Secure, Apple Pay, Google Pay)
6. On success: Stripe fires `checkout.session.completed` webhook → `/api/stripe/webhook`
7. Webhook updates Clerk `publicMetadata.tier` from `'free'` to `'paid'` + stores `stripeCustomerId`
8. User redirected back to `/pro-promagen` in Configuration mode

**Cancellation policy:**

- User accesses Stripe Customer Portal via "Manage Subscription" button on `/pro-promagen`
- Cancellation sets `cancel_at_period_end: true` — user keeps Pro access until billing period ends
- `cancelAtPeriodEnd` and `currentPeriodEnd` stored in Clerk metadata
- When period ends: `customer.subscription.deleted` webhook fires → tier reverts to `'free'`
- Users can reactivate via the same Portal before the period ends

**Payment area:** Below the 9 feature cards. Shows side-by-side Monthly/Annual pricing cards when no panel is hovered. Hover-preview system temporarily replaces this area on card hover, then reverts.

**Files:**

| File                                          | Purpose                                                            |
| --------------------------------------------- | ------------------------------------------------------------------ |
| `src/lib/stripe/stripe.ts`                    | Stripe singleton                                                   |
| `src/lib/stripe/clerk-session.ts`             | JWT cookie reader (bypasses `auth()` for App Router compatibility) |
| `src/app/api/stripe/checkout/route.ts`        | Creates Checkout Session                                           |
| `src/app/api/stripe/webhook/route.ts`         | Handles 4 Stripe events                                            |
| `src/app/api/stripe/portal/route.ts`          | Creates Customer Portal session                                    |
| `src/components/pro-promagen/upgrade-cta.tsx` | Pricing cards + trial buttons (609 lines)                          |

**Environment variables (Vercel Production):**

- `STRIPE_SECRET_KEY` — Live mode secret key
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — Live mode publishable key
- `STRIPE_WEBHOOK_SECRET` — Webhook signing secret
- `STRIPE_PRICE_MONTHLY` — Monthly Price ID
- `STRIPE_PRICE_ANNUAL` — Annual Price ID

Authority: `docs/authority/stripe.md`

---

### 5.11 WorldPrompt Live Background (Pro Promagen exclusive)

> **Status: NOT IMPLEMENTED.** No WorldPrompt code exists in the codebase. This section preserves the original design intent for future reference. Do not treat any of the below as implemented or build on it without a fresh architecture review.

**Original concept (9 Jan 2026):** Transform the homepage background into an AI-generated scene derived from real-world data (weather, time, market status, FX mood). Would follow a 30-minute rotation through 4 cities, use DALL·E 3 for image generation, and cache images for 24h in Vercel KV (~48 images/day max). Pro users would see the live background; Standard users would see a static dark gradient.

**Why not built:** The homepage was redesigned (homepage.md v2.0.0) with a new three-column grid layout featuring Prompt of the Moment, Scene Starters, and Community Pulse. The WorldPrompt background concept may conflict with the new layout's visual density.

**If revived:** See original spec in `worldprompt-creative-engine.md` (referenced in §7). A fresh architecture review is required to reconcile with the current homepage layout.

---

### 5.12 Scene Starters (prompt builder quick-start)

Scene Starters are curated one-click prompt templates in the prompt builder. They pre-populate 5–8 categories simultaneously from a library of 200 themed scenes.

#### Tier Comparison

| Aspect                     | Standard Promagen                        | Pro Promagen                   |
| -------------------------- | ---------------------------------------- | ------------------------------ |
| Scene count                | 25 scenes                                | 200 scenes (25 free + 175 pro) |
| Worlds accessible          | 5 free worlds (limited scenes per world) | All 23 worlds (full library)   |
| Tier-aware prefills        | Yes                                      | Yes                            |
| Modification tracking      | Yes                                      | Yes                            |
| Flavour phrases in Explore | Yes (when scene has them)                | Yes (when scene has them)      |

#### Scene Distribution

200 scenes across 23 worlds (5 free + 18 pro):

**Free worlds (5 worlds, 25 scenes — 5 each):**
Portraits & People, Landscapes & Worlds, Mood & Atmosphere, Style-Forward, Trending / Seasonal

**Pro worlds (18 worlds, 175 scenes):**
Cinematic, Fantasy & Mythology, Sci-Fi & Future, Historical Eras, Urban & Street, Nature & Elements, Architecture & Interiors, Portraiture & Character, Dark & Horror, Whimsical & Surreal, Cultural & Ceremonial, Abstract & Experimental, Food & Still Life, Animals & Creatures, Commodity-Inspired, Weather-Driven, Seasonal, Micro & Macro

Free scenes are concentrated in 5 dedicated free worlds so free users get a complete experience within those themes. Pro scenes span 18 additional thematic worlds.

#### Pro Gate Behaviour

- Free scenes (25): fully accessible, no restrictions
- Pro scenes (175): visible with 🔒 icon at 50% opacity
- Anonymous user clicking pro scene → "Sign in first" (Clerk sign-in modal)
- Free signed-in user clicking pro scene → "Upgrade to Pro" dialog with link to `/pro-promagen`
- Pro scenes never dead-end — always show an upgrade path

#### Authority

See `scene-starters.md` for full architecture, data schema, and file locations.

---

### 5.13 Prompt Lab (`/studio/playground`) — Pro Promagen exclusive

The Prompt Lab is Promagen's AI-powered prompt creation environment at `/studio/playground`. It is listed as card 6 (🧪) in the Feature Control Panel on `/pro-promagen`.

**v8.0.0 (23 March 2026):** The Prompt Lab now features the AI Disguise system — three targeted API calls to GPT-5.4-mini that generate and optimise prompts directly from human text, disguised as "1,001 proprietary algorithms". Full specification: `ai-disguise.md`. Architecture and component details: `prompt-lab.md` v3.0.0.

#### Tier Comparison

| Aspect                   | Standard Promagen | Pro Promagen                                       |
| ------------------------ | ----------------- | -------------------------------------------------- |
| Access                   | Not available     | Full access                                        |
| Route                    | —                 | `/studio/playground`                               |
| Provider selection       | —                 | Dropdown (all 40)                                  |
| AI tier generation       | —                 | Call 2 — GPT generates 4 native tier prompts       |
| AI prompt optimisation   | —                 | Call 3 — GPT optimises for specific provider       |
| Algorithm cycling        | —                 | 101 names, amber→emerald, slot-machine landing     |
| Drift detection          | —                 | Word-level diff with "Regenerate" pulse            |
| Intelligence panel       | —                 | **Removed (v8.0.0)** — DnaBar conflict count retained |
| Layout                   | —                 | Full-width single column (`space-y-4`)             |
| Tier preview             | —                 | All 4 tiers (colour-coded, AI-generated)           |
| Colour-coded prompts     | —                 | Full colour-coding (§5.14)                         |
| Assembled prompt box     | —                 | Colour-coded + stage badge + AI tier text priority |
| Dynamic label switching  | —                 | Assembled → Optimized on toggle (uses `effectiveWasOptimized`) |
| Colour legend            | —                 | LabCategoryColourLegend in header                  |
| Optimizer neutral mode   | —                 | Disabled until provider selected                   |

#### Current Status

**Gating: NOT IMPLEMENTED.** The `/studio/playground` route currently has zero auth checks — any user can access it. This was flagged as requiring a Pro gate (auth check + lock overlay) but has not been built.

**When gating is implemented:**

- Anonymous users → redirect to sign-in
- Free signed-in users → lock overlay with "Upgrade to Pro Promagen" CTA linking to `/pro-promagen`
- Pro users → full access

#### Architecture

The Prompt Lab uses the same base components as the standard builder but with an AI Disguise overlay — 3 API calls to GPT-5.4-mini for generation and optimisation, plus dedicated hooks and animation components.

**Core files:**

| File                                                      | Purpose                                                      | Lines |
| --------------------------------------------------------- | ------------------------------------------------------------ | ----- |
| `src/app/studio/playground/page.tsx`                      | Server component (data fetch)                                | 69    |
| `src/app/studio/playground/playground-page-client.tsx`    | Client wrapper (provider state)                              | 135   |
| `src/components/prompts/playground-workspace.tsx`         | AI Disguise orchestrator (lifts hooks, auto-re-fires)        | 313   |
| `src/components/prompts/enhanced-educational-preview.tsx` | Lab preview — full-width, AI wiring, algorithm cycling       | 2,008 |
| `src/components/providers/describe-your-image.tsx`        | Human text input — Clear, drift, "Regenerate" pulse          | 667   |

**AI Disguise files (new in v8.0.0):**

| File                                                      | Purpose                                                      | Lines |
| --------------------------------------------------------- | ------------------------------------------------------------ | ----- |
| `src/app/api/generate-tier-prompts/route.ts`              | Call 2 — AI tier generation                                  | 319   |
| `src/app/api/optimise-prompt/route.ts`                    | Call 3 — AI prompt optimisation                              | 315   |
| `src/hooks/use-tier-generation.ts`                        | Call 2 hook (AbortController for provider-switch)            | 224   |
| `src/hooks/use-ai-optimisation.ts`                        | Call 3 hook (3-phase animation timing)                       | 335   |
| `src/hooks/use-drift-detection.ts`                        | Prompt DNA drift detection (zero API calls)                  | 165   |
| `src/data/algorithm-names.ts`                             | 101 cycling + 3 finale names + shuffle                       | 187   |
| `src/components/prompt-lab/algorithm-cycling.tsx`          | Cycling animation (amber→emerald, slot-machine)              | 256   |
| `src/components/prompt-lab/drift-indicator.tsx`            | "N changes detected" amber badge                             | 136   |

**Removed from Prompt Lab (v8.0.0):**

| Component | Status |
| --- | --- |
| `IntelligencePanel` | **REMOVED from render.** Scored 52/100 for AI Disguise workflow — designed for dropdown-selection, became passive sidebar. DnaBar still fed via simplified `useRealIntelligence`. Panel remains in standard builder (`/providers/[id]`). Code file untouched (515 lines). |

**Key difference from standard builder:**

- Standard (`/providers/[id]`): Provider pre-selected from URL, template assembly via `assemblePrompt()`, client-side 4-phase optimizer, Intelligence Panel sidebar, 3-column grid
- Prompt Lab (`/studio/playground`): Provider selected via dropdown, AI tier generation (Call 2) with template fallback, AI optimisation (Call 3) with client-side fallback, full-width single column, algorithm cycling animation

#### Prompt Lab Parity Features (v5.0.0)

These features bring the Lab to parity with the standard builder (retained from v5.0.0):

**Colour-coded prompts in all 4 tiers:** `FourTierPromptPreview` receives `isPro` and `termIndex` props. When `isPro=true`, each tier card renders prompt text via `parsePromptIntoSegments()` with `CATEGORY_COLOURS`. File: `four-tier-prompt-preview.tsx` (684 lines).

**Assembled prompt box:** Full-width box showing `activeTierPromptText` (AI tier text when available via `aiTierPrompts ?? generatedPrompts`, template text as fallback). Colour-coded for Pro users. Inline `SaveIcon` + copy icons. `StageBadge` in header. Char count right-aligned.

**Optimized prompt box provider label:** When provider selected, shows "Optimized prompt in [ProviderName] [icon]" with 20×20px provider icon. Uses `effectiveOptimisedText` (AI result priority over client-side).

**Dynamic label switching:** When `isOptimizerEnabled && selectedProviderId`:

- Label: "Optimized prompt in [Provider] [icon]" in `text-emerald-300`
- Border: `border-emerald-600/50 bg-emerald-950/20`
- Text: `text-emerald-100`
  **Note:** Condition uses `effectiveWasOptimized` (AI result takes priority over client-side `wasOptimized`).

**Optimizer disabled in neutral mode:** `finalOptimizerDisabled = isOptimizerDisabled || !selectedProviderId`. Neutral tooltip: "Select an AI provider above to enable optimisation."

**Green "Within optimal range":** When optimizer ON + provider selected + no trimming + not actively optimising: emerald bar "✓ Within optimal range — X chars".

**LabCategoryColourLegend:** Header between `│` divider and Optimize toggle. Emoji `clamp(18px, 1.4vw, 22px)`, solid `rgba(15, 23, 42, 0.97)` bg.

**Inline copy + save icons:** Both assembled and optimized boxes. All copy handlers call `incrementLifetimePrompts()`.

**Lifetime counter wiring:** All copy handlers call `incrementLifetimePrompts()`. Feeds Pro Gem Badge (§5.15).

#### AI Disguise Features (v8.0.0)

**AI Tier Generation (Call 2):** "Generate Prompt" fires Call 2 in parallel with Call 1. AI generates 4 tier-native prompts from human text, preserving poetry and spatial relationships. Provider-specific weight syntax (Leonardo `::`, SD `()`, Midjourney `::` prose). 4-word weight wrapping rule — long phrases broken to shorter weighted terms. Quality suffix for Tier 1. Template generators are fallback only.

**"Generated for" Badge:** Violet badge on 4-tier header when provider selected and Call 2 has returned. Persists when provider de-selected. Updates on provider switch.

**AI Prompt Optimisation (Call 3):** Fires when optimizer toggled ON. Restructures prompt for specific provider — reorders by impact priority, applies provider syntax, removes filler, strengthens quality anchors. Debounced 800ms re-fire when `activeTierPromptText` changes (AR, selections, AI tiers).

**Algorithm Cycling Animation:** 101 names cycle at 160–200ms (amber monospace), decelerating to slot-machine stop, landing on "✓ {87–102} algorithms applied" (emerald). 1.8s minimum, 12s hard timeout. `prefers-reduced-motion` respected.

**Prompt DNA Drift Detection:** Client-side word-level diff. When `isDrifted && changeCount >= 3`: Generate button pulses amber, text changes to "Regenerate". Below 3: badge only. Zero API calls.

**Clear Button:** Core Colours gradient (`from-sky-400 via-emerald-300 to-indigo-400 text-black`). Full cascade: textarea, 12 category dropdowns (`{ selected: [], customValue: '' }`), optimizer OFF, AI tiers clear, AI optimise clear, aspect ratio, scene, drift.

**Hint Text:** After generation, when no drift: "Edit your description above and click Regenerate to refine your prompts". Disappears when drift detected.

#### Feature Control Panel Integration

On the Pro page:

- **Free users:** Card shows "Pro exclusive" / "Pro only" — no navigation link
- **Paid users:** Card shows "Full access" / "Open lab →" — links to `/studio/playground`

Authority: `docs/authority/ai-disguise.md` (v2.0.0), `docs/authority/prompt-lab.md` (v3.0.0)

---

### 5.14 Colour-Coded Prompt Anatomy (Pro Promagen exclusive)

Pro Promagen users see colour-coded prompt text in the prompt builder, replacing the default monochrome rendering. Each term in the assembled and optimized prompt preview is coloured according to its source category, making the prompt scannable and educational.

**Human factor:** Von Restorff Effect (isolation effect) — distinct category colours make individual terms pop against the dark background. Loss Aversion — free users see plain text; the visible colour-coding is a tangible value-add they're missing.

#### Tier Comparison

| Aspect                   | Standard Promagen        | Pro Promagen                             |
| ------------------------ | ------------------------ | ---------------------------------------- |
| Category dropdown labels | White/slate text         | Each label in its category colour        |
| Assembled prompt text    | Plain `text-slate-100`   | Colour-coded by category                 |
| Optimized prompt text    | Plain `text-emerald-100` | Colour-coded by category                 |
| Colour legend tooltip    | Not visible              | 🎨 icon → hover shows 13-colour key      |
| Structural text (glue)   | N/A                      | Slate (`#94A3B8`) — commas, prepositions |

#### 13 Category Colours (SSOT)

| #   | Category    | Colour    | Hex       | Purpose                     |
| --- | ----------- | --------- | --------- | --------------------------- |
| 1   | Subject     | Gold      | `#FCD34D` | The star of the show        |
| 2   | Action      | Lime      | `#A3E635` | Movement / energy           |
| 3   | Style       | Purple    | `#C084FC` | Artistic reference          |
| 4   | Environment | Sky blue  | `#38BDF8` | Place / setting             |
| 5   | Composition | Emerald   | `#34D399` | Framing / structure         |
| 6   | Camera      | Orange    | `#FB923C` | Lens / angle                |
| 7   | Lighting    | Amber     | `#FBBF24` | Light source / direction    |
| 8   | Colour      | Pink      | `#F472B6` | Colour grade                |
| 9   | Atmosphere  | Cyan      | `#22D3EE` | Fog / haze / particles      |
| 10  | Materials   | Teal      | `#2DD4BF` | Surface / texture           |
| 11  | Fidelity    | Soft blue | `#93C5FD` | Quality boosters (8K, etc.) |
| 12  | Negative    | Red       | `#F87171` | Constraints / exclusions    |
| 13  | Structural  | Slate     | `#94A3B8` | Commas, glue text           |

**SSOT file:** `src/lib/prompt-colours.ts` — single source of truth for all colour constants, labels, emojis, and the prompt text parser.

#### Surfaces

Colour-coding is active on:

- **Standard prompt builder** (`/providers/[id]`) — assembled + optimized prompt boxes + category labels + colour legend in header
- **Prompt Lab** (`/studio/playground`) — category labels + assembled + optimized prompt boxes + 4-tier preview cards + LabCategoryColourLegend in header
- **Homepage Prompt of the Moment** — always visible (not Pro-gated, uses same SSOT colours)
- **Pro Promagen page** (`/pro-promagen`) — all preview windows (always visible, uses same SSOT colours) + Daily Prompts preview (miniaturised builder with colour-coded text)

#### Colour Legend Tooltip

A small 🎨 icon appears next to the "Assembled prompt" heading (Pro users only). Hover or click shows a tooltip with all 13 category→colour mappings. Built per tooltip standards: 400ms close delay, min 10px font, no opacity dimming.

#### Files

| File                                                         | Purpose                             | Version |
| ------------------------------------------------------------ | ----------------------------------- | ------- |
| `src/lib/prompt-colours.ts`                                  | SSOT: colours, labels, parser       | v1.0.0  |
| `src/components/ui/combobox.tsx`                             | `labelColour` prop                  | v7.3.0  |
| `src/components/providers/prompt-builder.tsx`                | Pro colour-coding + legend          | v10.2.0 |
| `src/components/prompts/enhanced-educational-preview.tsx`    | Lab colour-coding (full parity)     | v8.0.0  |
| `src/components/prompt-builder/four-tier-prompt-preview.tsx` | Colour-coded 4-tier cards           | v8.0.0  |
| `src/components/home/prompt-showcase.tsx`                    | Imports shared SSOT                 | v9.2.0  |
| `src/app/pro-promagen/pro-promagen-client.tsx`               | Imports shared SSOT + Daily preview | v5.0.0  |

---

### 5.15 Pro Gem Badge (evolving visual identity)

The Pro Gem Badge replaces the flat green "PRO" pill in the shared layout. It appears on every page (via `homepage-grid.tsx`) in the header row, right of the Listen button.

#### Evolving Tiers (6 levels by lifetime prompt count)

| Threshold | Tier Name    | Colour | Hex       |
| --------- | ------------ | ------ | --------- |
| 0+        | Raw Crystal  | Purple | `#a78bfa` |
| 100+      | Cut Sapphire | Blue   | `#38bdf8` |
| 500+      | Emerald      | Green  | `#34d399` |
| 1,000+    | Amber        | Gold   | `#fbbf24` |
| 5,000+    | Rose Diamond | Pink   | `#f472b6` |
| 10,000+   | Prismatic    | White  | `#f0f0f0` |

**Visual:** Hexagonal SVG with "P" centre mark. Pulsing glow animation via `drop-shadow` that intensifies per tier. Hover intensifies glow by 1.5×. The Prismatic tier (10K+) gets an inner facet with a shimmer animation. Hover tooltip: "Pro Promagen · [Tier Name] · X prompts crafted".

**Lifetime counter:** `src/lib/lifetime-counter.ts` provides `incrementLifetimePrompts()` and `getLifetimePrompts()`. Single localStorage key `promagen:lifetime_prompts`. Fallback: reads `promagen_saved_prompts` count if lifetime key not yet set.

**Counter wiring:** `incrementLifetimePrompts()` is called in all copy handlers in both builders:

- `prompt-builder.tsx`: `handleCopyPrompt`, `handleCopyAssembled`, `handleCopyOptimized` (3 calls)
- `enhanced-educational-preview.tsx`: `handleCopy`, `handleCopyOptimized`, `handleCopyAssembled` (3 calls)

**Design rules:**

- All sizing via `clamp()` — desktop-only, no mobile breakpoints
- Pulsing animation via `<style dangerouslySetInnerHTML>` — nothing in globals.css
- `prefers-reduced-motion: reduce` → animation disabled
- No opacity-based state dimming

#### Files

| File                                                      | Purpose                        | Status |
| --------------------------------------------------------- | ------------------------------ | ------ |
| `src/components/layout/pro-gem-badge.tsx`                 | ProGemBadge component (NEW)    | v1.0.0 |
| `src/lib/lifetime-counter.ts`                             | Counter utilities (NEW)        | v1.0.0 |
| `src/components/layout/homepage-grid.tsx`                 | Imports ProGemBadge            | v5.0.0 |
| `src/components/providers/prompt-builder.tsx`             | Wires incrementLifetimePrompts | v5.0.0 |
| `src/components/prompts/enhanced-educational-preview.tsx` | Wires incrementLifetimePrompts | v5.0.0 |

---

### 5.16 Bidirectional Tier Sync (Pro page ↔ exchange tooltips)

The prompt tier selection is now a single source of truth across all surfaces via `useGlobalPromptTier` hook. Changes made in one location propagate instantly to all others.

#### The Problem (pre v5.0.0)

The Pro page had its own `useState<PromptTier>(4)` local state (line 1799 of v4.0.0). Exchange tooltips read from `useGlobalPromptTier` hook. Two separate React states — clicking a tier preview updated one, the tooltips read the other. They only synced on page refresh.

#### The Fix (v5.0.0)

**Single hook:** Pro page replaced `useState` with `useGlobalPromptTier('pro-page')`. The `'pro-page'` surface was added to the `PromptSurface` union type and `FREE_SURFACE_TIERS` map (defaults to Tier 4 for free users).

**Same-tab sync:** `saveTier()` in the hook now dispatches a synthetic `StorageEvent` after writing to localStorage. Native `StorageEvent` only fires in other tabs — this dispatch fires in the same tab, so every `useGlobalPromptTier` instance on the page picks it up in the same render cycle.

#### Flow

| Action                       | Where                                | What happens everywhere                                                                                                               |
| ---------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Click T1 in preview window   | Pro page → `hookSaveTier(1)`         | Updates React state + localStorage + Clerk + dispatches StorageEvent → all tooltip hook instances update → next hover shows T1 format |
| Click T3 inside a tooltip    | Exchange tooltip → `onTierChange(3)` | Same `saveTier` path → preview window tick moves to T3 → tooltip re-renders in T3 format                                              |
| Open Pro page in another tab | N/A                                  | Cross-tab `StorageEvent` fires naturally → hook picks it up                                                                           |

**Save Preferences button:** No longer involved in tier selection. It remains for exchange selections only. Tier changes are live — no save step needed.

#### PromptSurface Type (v2.0.0)

```typescript
export type PromptSurface =
  | "exchange-cards" // Free: Tier 3 (Natural Language)
  | "leaderboard" // Free: native tier per provider
  | "fx-ribbon" // Free: Tier 1 (CLIP-Based)
  | "commodities" // Free: Tier 2 (Midjourney Family)
  | "mission-control" // Free: Tier 4 (Plain Language)
  | "pro-page"; // Free: Tier 4 (overridden by Pro selection)
```

#### Files

| File                                           | Change                                                                                                                                                     |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/hooks/use-global-prompt-tier.ts`          | Added `'pro-page'` to `PromptSurface`, added synthetic `StorageEvent` dispatch in `saveTier()`                                                             |
| `src/app/pro-promagen/pro-promagen-client.tsx` | Replaced `useState<PromptTier>` with `useGlobalPromptTier('pro-page')`, removed Clerk hydration `useEffect`, simplified `handlePromptTierChange` to 1 line |

---

## 6. Invariants (apply to everyone, always)

These rules are **never overridden**, including for paid users:

- Exchanges are **always ordered by longitude relative to reference frame**
- **Most easterly exchange appears on the left**
- **Most westerly exchange appears on the right**
- Ordering is **physics-based**, not user-defined
- No drag-and-drop ordering
- No favourites-first ordering
- No manual pinning
- **Prompt builder access is tiered** — Anonymous: 3/day, Free signed-in: 5/day, Pro: unlimited (§3.2)
- **Prompt Lab (`/studio/playground`) requires Pro Promagen** — NOT YET GATED (see §5.13)

Users may choose **scope** and **reference**, but not **physics**.

---

## 7. What this document does NOT cover

This document does **not** redefine or duplicate:

- FX ribbon rules
- FX selection architecture details (only limits and storage schema defined here)
- API cost control rules
- Caching and budget guards
- Analytics and metrics derivation
- UI layout invariants
- Market Pulse animation behaviour (fully dynamic, no Pro gating — see §5.7)
- Community voting mechanics (only weight multiplier is defined here)
- Authentication implementation details
- Prompt builder architecture details
- Homepage layout and components (Prompt of the Moment, Community Pulse, etc.)

Authority for those lives elsewhere:

- FX behaviour and SSOT rules → `docs/authority/ribbon-homepage.md`
- Market Pulse specification → `src/data/city-connections.ts` + `src/hooks/use-market-pulse.ts`
- Cost control and provider authority → `promagen-api-brain-v2.md`
- Platform and spend guardrails → `vercel-pro-promagen-playbook.md`
- Prompt builder architecture → `docs/authority/prompt-builder-page.md`
- Community voting system → `docs/authority/ai providers.md`
- Authentication architecture → `docs/authority/clerk-auth.md`
- Platform tier assignments → `src/data/platform-tiers.ts`
- Category limits → `src/lib/usage/constants.ts`
- Homepage features → `docs/authority/homepage.md`
- Scene Starters → `docs/authority/scene-starters.md`
- Feature Control Panel → `src/components/pro-promagen/feature-control-panel.tsx`
- Surface-aware prompt tiers → `src/hooks/use-global-prompt-tier.ts` (v5.0.0, includes `'pro-page'` surface + same-tab sync)
- Prompt tier API → `src/app/api/user/preferences/route.ts`
- Prompt Lab → `docs/authority/prompt-lab.md` (v3.0.0)
- AI Disguise system → `docs/authority/ai-disguise.md` (v2.0.0)
- Prompt Lab parity features → `src/components/prompts/enhanced-educational-preview.tsx` (v8.0.0, 2,008 lines)
- Pro Gem Badge → `src/components/layout/pro-gem-badge.tsx` + `src/lib/lifetime-counter.ts`
- Stripe payments → `docs/authority/stripe.md`
- Continental exchange grouping → `src/lib/geo/continents.ts`
- Ask Promagen → **NOT IMPLEMENTED** (§5.9, planned feature)
- WorldPrompt Live Background → **NOT IMPLEMENTED** (§5.11, see `worldprompt-creative-engine.md` for original spec)

This document only defines **who can control what**, and **when**.

---

## 8. Design intent (for future contributors)

This is not feature gating.
This is **perspective gating**.

- Standard Promagen users get a complete, honest product (after sign-in for prompt builder)
- Sign-in adds orientation, memory, and prompt access
- Pro Promagen adds control and focus
- No tier ever withholds truth

If a proposed Pro Promagen feature violates these principles, it does not belong in Promagen.

---

## 9. Change discipline

Any change to Pro Promagen behaviour must:

1. Be added explicitly to this document
2. State the exact capability gained
3. Preserve all invariants listed above

If it is not written here, it is Standard Promagen (free).

---

## Changelog

- **23 Mar 2026:** **PROMPT LAB AI DISGUISE + INTELLIGENCE PANEL REMOVAL (v8.0.0)** — §5.13: Major Prompt Lab update. AI Disguise system deployed — 3 GPT-5.4-mini API calls for prompt generation and optimisation, disguised as "1,001 proprietary algorithms". Call 2 (`/api/generate-tier-prompts`, 319 lines) generates 4 native tier prompts from human text, fired in parallel with Call 1. Call 3 (`/api/optimise-prompt`, 315 lines) AI-optimises assembled prompt for specific provider, fired on optimizer toggle. Provider-specific weight syntax enforcement — Leonardo uses `term::weight`, SD uses `(term:weight)`, never hardcoded. 4-word weight wrapping rule — long phrases broken to shorter weighted terms. Quality suffix for Tier 1 (`sharp focus, 8K, intricate textures`). 8 new files (2 API routes, 3 hooks, 2 animation components, 1 data file). `PlaygroundWorkspace` rewritten as AI Disguise orchestrator (229→313 lines). `enhanced-educational-preview.tsx` (1,899→2,008 lines): Call 3 wiring with debounced 800ms re-fire, `AlgorithmCycling` render, effective optimised values. `IntelligencePanel` removed from Prompt Lab render (scored 52/100 for AI workflow). Layout changed from `lg:grid-cols-3` to full-width single column. `DescribeYourImage` (577→667 lines): Clear button with Core Colours gradient + full cascade reset (12 dropdowns, optimizer OFF, AI clear), drift indicator, "Regenerate" amber pulse when drift ≥ 3, hint text. `FourTierPromptPreview` (647→684 lines): "Generated for X" violet badge. Tier comparison table expanded (15 aspects). AI Disguise features section added (7 features). Leonardo syntax fixed from `(weighted:1.3)` to `term::1.3` in §5.10 ImageGen text. Authority refs updated: added `ai-disguise.md` v2.0.0, `prompt-lab.md` v3.0.0. §5.14 file versions updated to v8.0.0.
- **22 Mar 2026:** **PRO PAGE TOOLTIP PREVIEW + PLATFORM COUNT + PANEL FIXES (v7.0.0)** — Major Pro page overhaul across 4 files. §5.10: Prompt Format card redesigned — paid users see colour-coded tier `<select>` dropdown (each option styled in tier colour: blue/purple/emerald/orange), free users see standard two-row text ("All current prompts are a spread" / "The choice of Prompt Text is yours"). 45/17 alternating stat removed from Prompt Intelligence card. Card 8 renamed from "⚙️ Stacking" to "🧠 Prompt Intelligence" (#fb923c). TierPreviewPanel header: dropdown removed, amber text centred. TierWindow rebuilt to match real `WeatherPromptTooltip` structure: "Image Prompt" header + PRO badge + Save/Copy, tier badge pill, **colour-coded prompt text** via `labBuildTermIndex`/`labParsePrompt`/`CATEGORY_COLOURS` (same as Prompt Lab), "Other formats available" with **unblurred** tier rows (no lock icons — free and paid see identical view), "Unlock all formats" per-window for free users, gold crown on active. Dropdown cooldown: `dropdownCooldownRef` blocks `handleCardHover` for 2 seconds after dropdown selection to prevent accidental panel switch to adjacent Saved card. `onDropdownSelect` callback added to `FeatureControlPanel` interface. ExchangesPreviewPanel: removed `slice(0, maxVisibleCards)` clip — all regional exchange cards now render with auto-scroll (17s `proAutoScroll` cycle), matching Frame preview pattern. SavedPreviewPanel: extracted `SavedPromptWindow` sub-component with `useAutoScroll()` + `pro-auto-scroll` CSS class; prompt text white (colour coding removed — saved prompts lack reliable categoryMap data for accurate term matching). DailyPromptsPreviewPanel: Category Colour Key (🎨 4-column legend) removed. All "40 platform" references updated to "40 platforms" in `pro-promagen-client.tsx` (6 refs), `upgrade-cta.tsx` (1 ref), `tier-showcase.tsx` (1 ref), `feature-control-panel.tsx` (1 ref). `PreviewPanel` type expanded to 9 values (`'intelligence'` added). File sizes: `pro-promagen-client.tsx` 4,693 lines, `feature-control-panel.tsx` 453 lines.
- **19 Mar 2026:** **IMAGE GEN PREVIEW + VOTE POWER REMOVED (v6.0.0)** — §5.10: Vote Power card (🏆, #fbbf24) removed from 3×3 grid position 9. Replaced by Image Generation card (🖼️, #e879f9) — "Coming to Pro" teaser for BYOAPI feature. Vote weighting (1.5×) still active in backend (§5.8), just no longer a headline card. New `ImageGenPreviewPanel` — single full-height card rotating through 5 platforms (Leonardo, Flux, DALL·E 3, Ideogram, Imagine) every 15s with 300ms crossfade. Left half: colour-coded prompt segments using `CATEGORY_COLOURS` SSOT, `font-mono leading-relaxed` matching Prompt Lab font. Right half: real AI-generated images from `/public/images/pro/` with blur-to-sharp CSS animation (18px→0 over 10s, hold 3s, reset). Fuchsia progress bar synced to cycle. 5 navigation dots. `key={activeIdx}` resets animation on swap. New `FramePreviewPanel` — 5 reference city windows (Tokyo, New York, Sydney, Mumbai, London) showing exchange cards rearranged per anchor city, with auto-scroll. `PreviewPanel` type expanded to 8 values (`'frame'` + `'imagegen'` added). `onImageGenHover` prop added to `FeatureControlPanel`. 9 preview panels always mounted (8 feature + 1 CTA). `feature-control-panel.tsx` updated to v2.2.0 (431 lines). `pro-promagen-client.tsx` updated to v6.0.0 (3,560 lines). 5 static image assets added to `public/images/pro/`.
- **18 Mar 2026:** **PRO PAGE OVERHAUL v5.0.0 — DAILY PREVIEW + TIER SYNC + DEBOUNCED INTENT + GEM BADGE + LAB PARITY** — Major Pro page and Prompt Lab update across 8 files. §5.10: Hover Bridge replaced by Debounced Intent v5.0.0 — 150ms debounce on card-to-card switches filters diagonal cursor movement (replaces failed Intent Triangle from v4.1). Daily Prompts card gains preview panel (`DailyPromptsPreviewPanel`) — miniaturised builder mockup with 12 colour-coded category rows, assembled + optimized prompt boxes, auto-scrolling (17s cycle: 0.3s hold → 8s down → 0.3s hold → 8s up), click navigates to `/providers/{id}` with PotM payload. `PreviewPanel` type expanded from 5 to 6 values (`'daily'` added). Pro page local `useState<PromptTier>` replaced by `useGlobalPromptTier('pro-page')` shared hook — single source of truth for tier across Pro page and all exchange tooltips. Same-tab sync via synthetic `StorageEvent` dispatch in `saveTier()`. §5.13: Prompt Lab parity — all 4 tier preview cards colour-coded, assembled prompt box with StageBadge, dynamic label switching (assembled → optimized when optimizer enabled, no `wasOptimized` gate), provider icon on optimized label, `LabCategoryColourLegend` in header, optimizer disabled in neutral mode, green "Within optimal range" feedback, inline copy + save icons. §5.15: Pro Gem Badge — evolving hexagonal gem replaces flat PRO pill in homepage-grid header. 6 tiers by lifetime prompt count (Raw Crystal → Cut Sapphire → Emerald → Amber → Rose Diamond → Prismatic). Pulsing glow animation, `prefers-reduced-motion` respected, all sizing `clamp()`. `incrementLifetimePrompts()` wired into all 6 copy handlers (3 in standard builder, 3 in Lab). §5.16: Bidirectional Tier Sync — `'pro-page'` added to `PromptSurface` type, `useGlobalPromptTier` dispatches synthetic StorageEvent for same-tab sync. Files: pro-promagen-client.tsx (2,716 lines), enhanced-educational-preview.tsx (1,899 lines), feature-control-panel.tsx (419 lines), use-global-prompt-tier.ts (244 lines), pro-gem-badge.tsx (~200 lines, NEW), lifetime-counter.ts (NEW), homepage-grid.tsx (updated), four-tier-prompt-preview.tsx (updated).
- **17 Mar 2026:** **COLOUR-CODED PROMPT ANATOMY (v4.1.0)** — Added §5.14. Pro Promagen users see colour-coded prompt text in the prompt builder: 12 category colours + 1 structural (slate-400). Category dropdown labels take on their category colour. Assembled and optimized prompt preview boxes render terms in category colours. 🎨 legend tooltip shows the full colour key (400ms close delay, min 10px font). New shared SSOT: `src/lib/prompt-colours.ts` replaces 3 duplicated local `CATEGORY_COLOURS` constants (prompt-showcase, pro-promagen-client). Combobox v7.3.0 adds `labelColour` prop. Human factors: Von Restorff Effect (category isolation), Loss Aversion (free users see plain text), Colour Psychology in Dark Interfaces §17 (3× weight on dark backgrounds).
- **17 Mar 2026:** **COLOUR-CODED PROMPT ANATOMY (v4.1.0)** — Added §5.14. Pro Promagen users see colour-coded prompt text in the prompt builder: 12 category colours + 1 structural (fuchsia). Category dropdown labels take on their category colour. Assembled and optimized prompt preview boxes render terms in category colours. 🎨 legend tooltip shows the full colour key (400ms close delay, min 10px font). Structural colour changed from slate-400 (#94A3B8, invisible on dark) to fuchsia-400 (#E879F9). New shared SSOT: `src/lib/prompt-colours.ts` replaces 3 duplicated local `CATEGORY_COLOURS` constants (prompt-showcase, pro-promagen-client, and admin vocab page excluded). Combobox v7.3.0 adds `labelColour` prop. Human factors: Von Restorff Effect (category isolation), Loss Aversion (free users see plain text), Colour Psychology in Dark Interfaces §17 (3× weight on dark backgrounds).
- **17 Mar 2026:** **HOVER BRIDGE + EXCHANGES PREVIEW + DATA FIXES (v4.0.0)** — §5.10: Replaced 4 individual boolean hover states with unified `activePanel` union type + 2-second hover bridge pattern (linger delay + stay-while-inside). All 9 feature cards now participate in the same hover system. Added ExchangesPreviewPanel (5 windows: CTA + 4 regional mini-exchange cards matching real rail card style). Exchange card count uses Engine Bay measurement pattern (ResizeObserver on first card). Added exchange selection save gating documentation (free = preview only, paid = persists everywhere). Updated State Management, Data Flow, File Structure sections. §5.3: JSE Johannesburg and SSE Santiago marketstack fields populated in exchanges.catalog.json (zero empty marketstack entries remain). Zagreb hoursTemplate `europe-standard` → `europe-croatia`, Dublin `europe-standard` → `europe-ireland`. Turkey (TR) moved from EUROPE to MIDDLE_EAST in continents.ts (affects picker grouping + preview panel). §5.10 Stripe: Updated from "Planned" to "LIVE" with pricing (£15.99/mo, £149.99/yr), cancellation policy, and full file list. Added `stripeCustomerId`, `cancelAtPeriodEnd`, `currentPeriodEnd` to ClerkPublicMetadata. Updated line counts across all files.
- **16 Mar 2026:** **STRIPE LIVE MODE + CANCELLATION + LCP (v3.1.0)** — Stripe switched from sandbox to live payments. Pricing finalised: £15.99/month, £149.99/year (£12.49/mo equivalent), 7-day free trial on both plans. GBP only. Cancellation policy: `cancelAtPeriodEnd` keeps Pro access until billing period ends. Customer Portal for self-service cancellation/reactivation. Clerk auth in checkout uses JWT cookie reader (`clerk-session.ts`) instead of `auth()` for App Router compatibility. LCP fix: gradient heading in `loading.tsx` for fast server render. Preview panel mount spike fix: all panels always-rendered, toggled via CSS `display` property instead of conditional React rendering.
- **16 Mar 2026:** **FONT SIZE REDUCTION + COMPOUND KEYS + EXCHANGE NAMES (v3.0.1)** — 77 fontSize clamp values reduced by 1 step across feature-control-panel, pro-promagen-client, and upgrade-cta. Exchange names shortened to abbreviations in exchanges.catalog.json (e.g., "Johannesburg Stock Exchange (JSE)" → "JSE"). Compound key system (`exchangeId::benchmark`) shipped for multi-index exchanges — config endpoint now emits all indices, gateway fans out quotes to compound IDs. Commodity mover card gap halved (3ch → 1.5ch).
- **14 Mar 2026:** **FEATURE CONTROL PANEL COCKPIT (v3.0.0)** — Complete rewrite of §5.10. Comparison table replaced by 3×3 Feature Control Panel — 9 exchange-card-style feature cards with unique glow colours, live data, and hover-triggered previews. Prompt Format card shows inline T1–T4 tier selector with "Select tier ↓" label; hover triggers 4 horizontal tooltip-clone windows below the cards showing live Prompt of the Moment data in all 4 tiers with copy/save buttons and animated amber header. Each card serves dual purpose: sales (free users see Standard vs Pro) and configuration (paid users interact directly). Exchange Picker fullscreen mode preserved. FX Picker references removed (was deleted v3.0.0). Vote Weight now visible as card 9 (was deliberately hidden). Dead files noted: comparison-table.tsx, scene-grid-preview.tsx, tier-comparison-strip.tsx, tier-showcase.tsx, usage-snapshot.tsx. Added Stripe integration plan. Updated file structure and line counts.
- **14 Mar 2026:** **SURFACE-AWARE PROMPT TIER SYSTEM + LIMITS UPDATE (v3.0.0)** — §3.2/§3.3: Anonymous daily limit reduced from 5 to 3 (matches `ANONYMOUS_FREE_LIMIT = 3` in constants.ts). §4.1: Added `promptTier` to Clerk metadata interface. §5.6: Added "Surface-Aware Prompt Tier System" subsection documenting the per-surface free tier rotation (Variable Reward pattern) and Pro global override with Clerk persistence. "Weather Prompt Format" renamed to "All Prompt Format" throughout. 5 consumer files documented (exchange-list, provider-cell, finance-ribbon, commodity-mover-card, mission-control).
- **14 Mar 2026:** **DOC CORRECTIONS (v3.0.0)** — §5.12: Fixed world count from "10 worlds" to "23 worlds" (5 free + 18 pro). Updated world name list to match `worlds.ts` (was showing incorrect names like "Underwater & Aerial" which don't exist). §5.13: Added Prompt Lab section — documents Pro exclusive status, current lack of auth gating, architecture, and Feature Control Panel integration. §6: Added Prompt Lab gating invariant (not yet enforced). §5.10: Added dead file cleanup table (1,136 lines across 5 orphaned files). §7: Added 4 new authority references.
- **4 Mar 2026:** **DOC AUDIT v2.0.0** — Cross-referenced all sections against src.zip. 12 corrections:
  - §2.1: Added 6 missing homepage free features (Prompt of the Moment, Like system, Community Pulse, Online Users, World Context page, Market Pulse description updated to "dynamic" from "4 cities")
  - §5.6: Removed stale duplicate Tier 4 platform list (Firefly, Ideogram, Recraft, etc. — these were from the old spec, not matching `platform-tiers.ts`)
  - §5.10 layout diagram: Added Engine Bay (left, xl+) and Mission Control (right, Home button). Added Weather Prompt Format row to table. Title changed to "Uses HomepageGrid" from "Identical to Homepage".
  - §5.10 Component Reuse: Added EngineBay and MissionControl rows
  - §5.10 Data Flow: Added steps for localStorage hydration and weather tier selection
  - §5.10 State Management: Confirmed two-boolean pattern (not FullscreenPickerMode union). Added `selectedPromptTier` state. Removed stale empty code block.
  - §6 Invariants: Fixed "Prompt builder access requires sign-in (no exceptions)" → "Prompt builder access is tiered" (anonymous 5/day, free 10/day, Pro unlimited)
  - §5.7 Market Pulse changelog entry: Marked "16 cities" as superseded (now fully dynamic)
  - Version/date added to header (v2.0.0, 4 March 2026)
- **25 Feb 2026:** **SCENE STARTERS + EXPLORE DRAWER (v9.0.0)** — Added §5.12 Scene Starters. 200 curated scenes (25 free, 175 pro) across 10 worlds. Pro gate: locked scenes show upgrade dialog. Updated §2.1 free features: added Scene Starters (25 free), Explore Drawer (9,058 phrases), Cascading Intelligence. See scene-starters.md for full documentation. See prompt-builder-evolution-plan-v2.md for architecture.
- **1 Feb 2026:** **INDICES DROPDOWN REMOVED (v2.8.0)** — Removed ChipsDropdown component from comparison-table.tsx (333 lines of code removed). Root cause: duplicate React key errors from multi-index exchanges (e.g., XETRA having DAX + MDAX). ChipsDropdown rendered index chips with exchange MIC as key, causing collisions when multiple indices shared the same exchange. Solution: index selection now handled per-exchange via dropdown in Exchange Picker (exchange-card.tsx). StatusBadge component also removed (28 lines, unreferenced). File reduced from 932→570 lines (39% smaller). Updated §5.10 comparison table row: "Stock Indices" now shows "Per-exchange in Exchange Picker" instead of ChipsDropdown. All file versions bumped to v2.8.0.
- **29 Jan 2026:** **FX PICKER REGIONAL FULLSCREEN REDESIGN (v2.0.0)** â€” Complete rewrite of Â§5.5 FX Picker UI. Implemented fullscreen regional accordion (matches Exchange Picker UX). 4 regions based on BASE currency: Americas (ðŸŒŽ), Europe (ðŸ°), Asia Pacific (ðŸŒ), Middle East & Africa (ðŸŒ). Features: dual SVG flags per pair (base+quote), sticky selection tray, progress bar (0-16), search across all regions, category badges (MAJOR/CROSS/EMERGING). Files: `fx-picker.tsx` v2.0.0, `fx-regions.ts` v1.0.0 (100+ currency mappings), `fx-picker-helpers.ts` v1.0.0. Updated Â§5.10 to reflect fullscreen picker modes. Trigger button: emerald-sky gradient with currency exchange icon. Note: MEA region shows fewer pairs because fx-pairs.json has limited BASE currency entries for that region.
- **29 Jan 2026:** **EXCHANGE PICKER SCROLL FIX (v2.5.0)** â€” Fixed large screen scroll behavior in Exchange Picker. Now uses `overflow-y-auto` on all screen sizes with `max-h-[400px] lg:max-h-none`. Removed `lg:overflow-visible` which broke scrolling entirely. All continents closed by default. Updated Â§5.3 with current implementation details.
- **29 Jan 2026:** **PRO PROMAGEN CONFIG PAGE FULLSCREEN PICKERS (v2.6.0)** â€” Updated Â§5.10 to reflect fullscreen picker mode. When FX or Exchange picker is triggered, entire centre panel becomes the picker (no headers, no badges, no table). State managed via `fullscreenPickerMode: 'none' | 'exchange' | 'fx'`. Files updated: `pro-promagen-client.tsx` v2.6.0, `comparison-table.tsx` v2.4.0.
- **13 Jan 2026:** **STOCK INDEX DATA ON EXCHANGE CARDS** â€” Added "Stock index data" to Â§2.1 free features list. Each exchange card now displays its benchmark index (e.g., Nikkei 225, S&P 500) with live price, day change, and percent change. Data sourced from Marketstack API (separate budget from TwelveData). Index row always visible on card â€” shows index name immediately (from catalog), price shows skeleton until API data arrives.
- **10 Jan 2026:** **FX DATA SSOT CONSOLIDATION** â€” Merged `fx.pairs.json` (defaults, country codes, longitude) and `pairs.json` (catalog metadata, demo prices) into single unified `fx-pairs.json`. Now only ONE file to maintain for FX data. Updated Â§5.5 catalog reference (102 pairs), Â§5.10 demo data source. Minimum count changed from 6 to 0 (allows "start fresh" workflow).
- **9 Jan 2026:** **WORLDPROMPT LIVE BACKGROUND** â€” Added Â§5.11 WorldPrompt Live Background (Pro Promagen exclusive). Homepage background becomes AI-generated scene derived from WorldPrompt data (weather, time, market status, FX mood). Includes context bar, fullscreen mode, 2-second crossfade transitions. Cost-controlled with 24h cache, ~48 images/day max. Added worldprompt-creative-engine.md Part 13 to Â§7 authority references.
- **10 Jan 2026:** **PRO PROMAGEN CONFIG PAGE SIMPLIFIED** â€” Rewrote Â§5.10 to use standard homepage layout (identical FX ribbon, exchange cards). Dropdowns for FX Pairs and Exchanges embedded in comparison table (not separate panels). Removed Vote Weight and Market Pulse from display (internal features). Alphabetical dropdown order with colorful styling. Demo weather placeholder shown. Reuses existing components: `HomepageGrid`, `FxRibbon`, `ExchangeCard`, `Combobox`.
- **9 Jan 2026:** **PRO PROMAGEN CONFIGURATION PAGE** â€” Added Â§5.10 `/pro-promagen` route. Dual-mode page: preview (free users) + configuration (paid users). Features: FX selection (0-16 pairs), Exchange selection (0-16 exchanges), quick presets (regional/currency), visual progress bars, comparison table, perks summary. Preview uses demo data (zero API cost). Design follows `/prompts/explore` DNA Helix + Ethereal Glow pattern.
- **9 Jan 2026:** **EXCHANGE SELECTION FOR PRO USERS** â€” Rewrote Â§5.3 to add full exchange selection feature (mirrors FX selection). Pro users choose 0-16 exchanges from 130-exchange catalog. Added hybrid localStorage + Clerk storage schema. Added regional presets (Asia Pacific, Americas, Europe & Middle East, Global Majors, Emerging Markets). Removed old Â§5.4 (exchange count merged into Â§5.3).
- **9 Jan 2026:** **EXCHANGE COUNT FLEXIBILITY** â€” Changed exchange count rule from "multiples of 2 only" to **"any integer 0-16"**. Odd numbers (7, 9, 11, 13, 15) now allowed. Rationale: arbitrary restriction served no UX purpose.
- **9 Jan 2026:** **MARKET PULSE EXPANDED TO 16 CITIES** — ~~Superseded: Market Pulse is now fully dynamic — derived at runtime from `exchange.city === provider.hqCity` with no hardcoded city count. See §5.7.~~
- **9 Jan 2026:** **FREE TIER EXCHANGE COUNT UPDATED** â€” Updated Â§2.1 to reflect 16 default exchanges (was 12). SSOT file `exchanges.selected.json` now contains 16 exchanges.
- **9 Jan 2026:** **FX PAIR SELECTION FOR PRO USERS** â€” Added Â§5.5 FX pair selection (user-curated ribbon). Pro Promagen users can select **0â€“16 FX pairs** (any count in range) from full 102-pair catalog. Hybrid storage: localStorage (fast reads) + Clerk metadata (cross-device sync). Gateway validates pair count server-side. Renumbered Â§5.5â†’Â§5.6, Â§5.6â†’Â§5.7, Â§5.7â†’Â§5.8, Â§5.8â†’Â§5.9. Updated Â§3.2 reference. Added FX selection architecture to Â§7 exclusions.
- **8 Jan 2026:** **FREE TIER LIMIT REDUCED** â€” Changed Standard Promagen daily prompt limit from 30/day to **10/day**. Clean progression: Anonymous 5/day â†’ Free 10/day â†’ Paid unlimited. Rationale: 30/day meant only power users hit friction; 10/day creates upgrade motivation for regular creators while remaining generous enough to love the product.
- **8 Jan 2026:** Added Â§5.8 Ask Promagen â€” LLM-powered suggestions (daily limits). Anonymous: 5/day, Standard: 10/day, Pro: Unlimited. Includes storage schema, lock state behaviour, cost control approach, and fallback handling. Status: planned feature.
- **5 Jan 2026:** **PLATFORM-AWARE CATEGORY LIMITS v8.2.0** â€” Complete rewrite of Â§5.5. Selection limits are now platform-aware with 4 tiers (CLIP, Midjourney, Natural Language, Plain Language). Each of the 40 platforms assigned to appropriate tier. Pro Promagen users get +1 on stackable categories (style, lighting, colour, atmosphere, materials, fidelity, negative). Auto-trim on platform switch. Dynamic tooltip guidance shows actual limits. See prompt-builder-page.md for implementation details.
- **4 Jan 2026:** **ANONYMOUS DAILY RESET** â€” Anonymous users now get 5 prompts **per day** (resets at midnight local time), matching the authenticated user experience. Previously was 5 prompts total lifetime. Updated Â§3.2 and Â§3.3 with new behavior. Anonymous storage upgraded to v2 schema with `lastResetDate` field. Migration: v1 data invalidated on read, triggers fresh v2 start.
- **4 Jan 2026:** **LOCK STATE UX CLEANUP** â€” Lock state visual treatment now uses disabled styling only on dropdowns and aspect ratio selector. **Removed "Sign in to continue" text from individual dropdown overlays** (was ugly/cluttered UX). Lock icon only appears in dropdown labels. Updated Â§3.2 with detailed component behavior. Authority: prompt-builder-page.md.
- **3 Jan 2026:** **TERMINOLOGY UPDATE** â€” Renamed paid tier to "Pro Promagen" throughout. Added Â§1.1 Terminology section defining "Pro Promagen" and "Standard Promagen". Updated all user-facing references. Internal code variables remain `'paid'` for brevity.
- **3 Jan 2026:** **ANONYMOUS 5-TRY UPDATE** â€” Added 5 free prompts for anonymous users before sign-in required (Â§3.2). Anonymous usage stored in localStorage with tamper detection. Updated lock state progression to include anonymous states (Â§3.3). Lock overlay UI: button at top, no lock icon, centred layout.
- **2 Jan 2026:** **MAJOR UPDATE** â€” Added prompt builder authentication requirements (Â§3.2), usage quotas (Â§3.3), geographic ordering (Â§3.4), unlimited usage for paid (Â§5.1). Updated free features list to remove direct prompt access. Added location detection requirements. Updated invariants to include authentication.
- **2 Jan 2026:** Added Â§3.1 Authentication provider (Clerk). Added Â§4.1 Technical implementation (Clerk metadata). Added clerk-auth.md to Â§7 authority references.
- **2 Jan 2026:** Added Â§5.7 Image Quality vote weight multiplier. Added community voting authority reference to Â§7.
- **2 Jan 2026:** Added Â§5.6 Market Pulse city connections. Added Market Pulse (4 cities) to Â§2.1 free features. Added Market Pulse authority reference to Â§7.
- **1 Jan 2026:** Added Â§5.5 Prompt builder selection limits. Added prompt builder to Â§2.1 free features. Added prompt-builder-page.md to Â§7 authority references.
