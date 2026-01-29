# paid_tier.md — What Is Free and What Is Paid in Promagen

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
- Tooltips: "🔒 Pro Promagen Feature"
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

- **Stock exchange cards** — Default selection of 16 exchanges (SSOT-defined)
- **Live local time clocks** — Each exchange card displays the current local time in that exchange's timezone
- **Market status indicators** — Open/closed status for each exchange
- **Stock index data** — Each exchange card displays its benchmark index (e.g., Nikkei 225, S&P 500) with live price, change, and percent change (subject to Marketstack API budget rules)
- **FX ribbon** — Real-time foreign exchange data (subject to TwelveData API budget rules)
- **Weather badges** — Current weather for each exchange city
- **AI Providers Leaderboard** — Browse and compare all 42 AI image generation providers
- **Market Pulse (4 cities)** — Visual connection animations for Sydney, Hong Kong, London, and Chicago

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

- **5 free prompts per day** before sign-in required
- **Daily reset at midnight** in user's local timezone (same as authenticated users)
- Anonymous usage counter visible: "X/5 free prompts"
- Stored in localStorage (browser-local, no account needed)
- After 5 prompts: overlay locks with "Sign in to continue" button

**Visual treatment when locked (anonymous or free user at limit):**

- All category dropdowns show **disabled styling only** (purple-tinted, non-interactive)
- **NO "Sign in to continue" text displayed inside individual dropdowns** (clean UX)
- Centred overlay with action button at top of the prompt builder section
- Message: "You've used your 5 free prompts" (anonymous) or "Daily limit reached" (free user)
- Benefits list shown in overlay
- Lock icon appears in dropdown labels only
- Dropdown arrows hidden when locked
- Dropdowns show empty placeholder when locked

**Free tier prompt access (after sign-in):**

- **Full access to all 12 categories** with ~2,100 curated prompt terms
- **Platform-aware selection limits** as documented in §5.6 and prompt-builder-page.md
- **10 prompts per day** — tracked on "Copy prompt" button clicks
- **Daily reset at midnight** in user's local timezone
- When quota reached: dropdowns lock with "Upgrade to Pro Promagen for unlimited" message

### 3.3 Usage tracking system

**Trigger event:** "Copy prompt" button click — the moment users extract value from Promagen's curation work

**Why "Copy prompt" and not "Generate"?**

- Promagen doesn't generate images — it crafts prompts
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
  count: number; // Current prompt count (0-5)
  lastResetDate: string; // YYYY-MM-DD for daily reset
  version: 2; // Schema version
  checksum: string; // HMAC of count + lastResetDate + version
}
```

If checksum validation fails, counter resets to 0 and user is shown a gentle message: "Usage data was reset. You have 5 prompts remaining today."

### 3.4 Geographic ordering (reference frame)

**Standard Promagen:**

- Reference frame = user's detected location
- Exchanges ordered relative to user's longitude
- Automatic, no configuration needed

**Detection method:**

1. IP-based geolocation via Vercel headers (`x-vercel-ip-longitude`)
2. Fallback: browser Geolocation API (with permission)
3. Final fallback: Greenwich Meridian (0° longitude)

**No prompt for location:** The system uses available signals silently. If all signals fail, Greenwich Meridian becomes the default reference.

---

## 4. Technical implementation

### 4.1 Tier detection (Clerk metadata)

User tier is stored in Clerk's `publicMetadata`:

```typescript
interface ClerkPublicMetadata {
  tier: 'free' | 'paid';
  exchangeSelection?: {
    exchangeIds: string[];
    updatedAt: string;
  };
  fxSelection?: {
    pairIds: string[];
    updatedAt: string;
  };
}
```

**Hook usage:**

```typescript
function Component() {
  const { userTier, categoryLimits, platformTier } = usePromagenAuth({
    platformId,
  });
  // userTier: 'free' | 'paid' (internal)
  // UI should display: "Standard Promagen" | "Pro Promagen"
  // categoryLimits: Platform-aware limits for current provider
  // platformTier: 1 | 2 | 3 | 4
}
```

---

## 5. Pro Promagen exclusive features

### 5.1 Unlimited daily prompts

Pro Promagen users have **unlimited daily prompt copies** — no counter, no quota.

---

### 5.2 Reference frame choice

Standard Promagen users see exchanges ordered relative to their detected location.

Pro Promagen users may choose their reference frame:

- "My Location" — exchanges ordered relative to geolocation
- "Greenwich Meridian" — exchanges ordered relative to 0° longitude

This is the **only reference frame control**.

---

### 5.3 Exchange selection (user-curated rails)

Pro Promagen users may choose which exchanges appear on their homepage rails.

#### Tier Comparison

| Aspect           | Standard Promagen           | Pro Promagen                       |
| ---------------- | --------------------------- | ---------------------------------- |
| Exchanges shown  | SSOT default (currently 16) | User-curated selection             |
| Exchange count   | Fixed by SSOT               | **0 to 16** (any integer)          |
| Catalog access   | N/A                         | Full catalog (130 exchanges)       |
| Configuration UI | None                        | Exchange Picker in `/pro-promagen` |

#### Allowed Exchange Counts

Any integer from **0 to 16** inclusive.

Rules:

- Minimum 6 exchanges (ensures meaningful rails)
- Maximum 16 exchanges (aligns with FX pair ceiling, controls display density)
- **Any count allowed** — odd or even (e.g., 7, 9, 11, 13, 15 are all valid)

#### Exchange Picker UI (v2.5.0 — Fullscreen Continental Accordion)

Pro Promagen users access the Exchange Picker via the `/pro-promagen` configuration page.

**Current Implementation (29 Jan 2026):**

- Exchanges row in comparison table shows **purple gradient trigger button**: "Select Stock Exchanges [3/16]"
- Click button → **entire centre panel becomes the picker** (fullscreen mode)
- Only the Done button visible at bottom — NO headers, NO badges, NO table
- Continental accordion groups show all 130 exchanges by 7 regions
- "Done — Save Selection" button (purple gradient) closes picker and returns to table

**Visual Flow:**

```
NORMAL STATE:
┌─────────────────────────────────────────────────────────────────────┐
│  Feature          │ Standard    │ Pro Promagen                      │
├───────────────────┼─────────────┼───────────────────────────────────┤
│  FX Pairs         │ 8 fixed     │ [💱 Select FX Pairs        2/16]  │ ← EMERALD BUTTON
├───────────────────┼─────────────┼───────────────────────────────────┤
│  Exchanges        │ 16 fixed    │ [🌐 Select Stock Exchanges 11/16] │ ← PURPLE BUTTON
├───────────────────┼─────────────┼───────────────────────────────────┤
│  Stock Indices    │ 16 fixed    │ [0 of 16 selected ▼]              │
├───────────────────┼─────────────┼───────────────────────────────────┤
│  ... other rows                                                     │
└─────────────────────────────────────────────────────────────────────┘

         ↓ CLICK EXCHANGE BUTTON ↓

FULLSCREEN PICKER MODE:
┌─────────────────────────────────────────────────────────────────────┐
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  🌐 YOUR SELECTION (11/16)                        [Reset]   │    │
│  │  [🇯🇵 TSE ✕] [🇭🇰 HKEX ✕] [🇸🇬 SGX ✕] [🇺🇸 NYSE ✕] ...     │    │
│  │  ════════════════════════════════════════ (progress bar)    │    │
│  ├─────────────────────────────────────────────────────────────┤    │
│  │  🔍 Search by exchange, city, or country...                 │    │
│  ├─────────────────────────────────────────────────────────────┤    │
│  │  ► 🌏 Asia (5 selected)                                     │    │
│  │  ► 🌊 Oceania (0 selected)                                  │    │
│  │  ► 🏰 Europe (3 selected)                                   │    │
│  │  ► 🏜️ Africa (1 selected)                                   │    │
│  │  ► 🕌 Middle East (0 selected)                              │    │
│  │  ► 🗽 North America (2 selected)                            │    │
│  │  ► 🌴 South America (0 selected)                            │    │
│  ├─────────────────────────────────────────────────────────────┤    │
│  │           [ ✓ Done — Save Selection ]                       │    │ ← PURPLE GRADIENT
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

**Picker Features:**

- Sticky selection tray at top (selected exchanges always visible with remove buttons)
- Progress bar showing selection count (color-coded: emerald → amber → orange)
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

- Trigger button: `ExchangePickerTrigger` (canonical purple gradient per code-standard.md §6.1)
- Picker: `ExchangePicker` (continental accordion, full 130-exchange catalog)
- Done button: Closes picker, returns to table

**Files:**

| File                                               | Purpose                                | Version |
| -------------------------------------------------- | -------------------------------------- | ------- |
| `src/components/pro-promagen/comparison-table.tsx` | Contains trigger + fullscreen callback | v2.4.0  |
| `src/components/pro-promagen/exchange-picker.tsx`  | Continental accordion component        | v2.5.0  |
| `src/app/pro-promagen/pro-promagen-client.tsx`     | Manages fullscreen state               | v2.6.0  |
| `src/lib/geo/continents.ts`                        | Continent definitions and configs      | v1.0.0  |

#### Storage Architecture (Hybrid localStorage + Clerk)

Exchange selection uses a **hybrid storage** approach for fast reads with cross-device sync:

```
┌─────────────────────────────────────────────────────────────────┐
│                  EXCHANGE SELECTION DATA FLOW                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  User action (Exchange Picker)                                  │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────────┐                                           │
│  │  localStorage   │  ← Immediate write (fast UX)              │
│  │promagen:exch:sel│                                           │
│  └────────┬────────┘                                           │
│           │                                                     │
│           ▼ (async, debounced 2s)                              │
│  ┌─────────────────┐                                           │
│  │ Clerk metadata  │  ← Persistent source of truth             │
│  │ exchangeSelect  │                                           │
│  └────────┬────────┘                                           │
│           │                                                     │
│           ▼ (on login, other devices)                          │
│  ┌─────────────────┐                                           │
│  │ Sync to local   │  ← Clerk → localStorage on auth          │
│  └─────────────────┘                                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
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

#### FX Picker UI (v2.0.0 — Regional Fullscreen Accordion)

**CONFIRMED DESIGN (29 Jan 2026):**

The FX Picker mirrors the Exchange Picker UX but uses **4 regional groups based on BASE currency**:

**Grouping Rule (Option A — Confirmed):**

| Pair Example | Region Displayed     | Reason                          |
| ------------ | -------------------- | ------------------------------- |
| EUR/USD      | Europe               | EUR is base, EUR → Europe       |
| USD/JPY      | Americas             | USD is base, USD → Americas     |
| GBP/ZAR      | Europe               | GBP is base, GBP → Europe       |
| AUD/NZD      | Asia Pacific         | AUD is base, AUD → Asia Pacific |
| ZAR/JPY      | Middle East & Africa | ZAR is base, ZAR → MEA          |

**4 Regional Groups:**

| Region               | Emoji | Gradient           | Currencies Mapped                                   |
| -------------------- | ----- | ------------------ | --------------------------------------------------- |
| Americas             | 🌎    | sky-blue-indigo    | USD, CAD, MXN, BRL, ARS, CLP, COP, PEN...           |
| Europe               | 🏰    | blue-indigo-violet | EUR, GBP, CHF, SEK, NOK, DKK, PLN, CZK, HUF, TRY... |
| Asia Pacific         | 🌏    | rose-orange-amber  | JPY, CNH, HKD, SGD, KRW, INR, AUD, NZD, THB, MYR... |
| Middle East & Africa | 🌍    | emerald-green-lime | AED, SAR, ILS, ZAR, QAR, KWD, EGP, NGN, KES...      |

**Visual Flow:**

```
NORMAL STATE:
┌─────────────────────────────────────────────────────────────────────┐
│  Feature          │ Standard    │ Pro Promagen                      │
├───────────────────┼─────────────┼───────────────────────────────────┤
│  FX Pairs         │ 8 fixed     │ [💱 Select FX Pairs        2/16]  │ ← EMERALD BUTTON
├───────────────────┼─────────────┼───────────────────────────────────┤
│  Exchanges        │ 16 fixed    │ [🌐 Select Stock Exchanges 11/16] │
└─────────────────────────────────────────────────────────────────────┘

         ↓ CLICK FX BUTTON ↓

FULLSCREEN FX PICKER MODE:
┌─────────────────────────────────────────────────────────────────────┐
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  💱 YOUR SELECTION (2/16)                         [Reset]   │    │
│  │  [🇪🇺🇺🇸 EUR/USD ✕] [🇬🇧🇺🇸 GBP/USD ✕]                       │    │
│  │  ════════ (emerald progress bar)                            │    │
│  ├─────────────────────────────────────────────────────────────┤    │
│  │  🔍 Search by pair, currency, or country...                 │    │
│  ├─────────────────────────────────────────────────────────────┤    │
│  │  ► 🌎 Americas (0 selected)                                 │    │
│  │  ► 🏰 Europe (2 selected)                                   │    │
│  │  ► 🌏 Asia Pacific (0 selected)                             │    │
│  │  ► 🌍 Middle East & Africa (0 selected)                     │    │
│  ├─────────────────────────────────────────────────────────────┤    │
│  │           [ ✓ Done — Save Selection ]                       │    │ ← EMERALD GRADIENT
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

**Expanded Region View (when accordion open):**

```
│  ▼ 🏰 Europe (2 selected)                          [Select All]   │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ [🇪🇺🇺🇸] EUR/USD    Eurozone / United States     [MAJOR] ☑️  │   │
│  │ [🇪🇺🇬🇧] EUR/GBP    Eurozone / United Kingdom    [MAJOR] ☐   │   │
│  │ [🇪🇺🇯🇵] EUR/JPY    Eurozone / Japan             [MAJOR] ☐   │   │
│  │ [🇬🇧🇺🇸] GBP/USD    United Kingdom / United States [MAJOR] ☑️│   │
│  │ [🇬🇧🇯🇵] GBP/JPY    United Kingdom / Japan        [CROSS] ☐  │   │
│  │ [🇨🇭🇯🇵] CHF/JPY    Switzerland / Japan          [CROSS] ☐   │   │
│  │ ...                                                          │   │
│  └─────────────────────────────────────────────────────────────┘   │
```

**Dual Flag Display:**

Each FX pair shows **two overlapping SVG flags** (base currency + quote currency):

- Base flag: Full visibility, z-index 10
- Quote flag: Slightly overlapped (`-ml-1`), 90% opacity, z-index 0
- Both flags from `/public/flags/{iso2}.svg` (263 flags available)
- Flag size in list: 20px, in chips: 14px

**Picker Features:**

- Sticky selection tray at top (selected pairs always visible with dual flags)
- Progress bar showing 0-16 count (color-coded: red → emerald → amber → orange)
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

| File                                               | Purpose                                     | Version |
| -------------------------------------------------- | ------------------------------------------- | ------- |
| `src/components/fx/fx-picker.tsx`                  | Regional FX Picker component                | v2.0.0  |
| `src/lib/fx/fx-regions.ts`                         | Currency → Region mapping (100+ currencies) | v1.0.0  |
| `src/lib/fx/fx-picker-helpers.ts`                  | Grouping, search, validation utilities      | v1.0.0  |
| `src/components/pro-promagen/comparison-table.tsx` | FxPickerTrigger + callback                  | v2.4.0  |
| `src/app/pro-promagen/pro-promagen-client.tsx`     | Fullscreen FX mode state                    | v2.6.0  |

**Currency-to-Region Mapping (Comprehensive):**

```typescript
// Americas (18 currencies)
(USD, CAD, MXN, BRL, ARS, CLP, COP, PEN, UYU, DOP, JMD, TTD, BSD, BBD, PAB, CRC, GTQ, HNL);

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
     ↓
fxCatalog prop → ProPromagenClient
     ↓
catalogToPickerOptions() → FxPairOption[] (adds region based on base currency)
     ↓
groupByRegion() → Map<FxRegion, FxPairOption[]>
     ↓
FX Picker UI renders regional accordion
```

**When `fx-pairs.json` is updated:**

- ✅ Add new pair → Appears automatically in correct region
- ✅ Remove pair → Disappears automatically
- ✅ Change category/rank → Grouping/ordering updates
- ✅ No code changes needed

**Note on Africa & Middle East Region:**

This region may show fewer pairs than others because fx-pairs.json currently has limited pairs where currencies like ZAR, AED, SAR are the **base** currency. To add more pairs to this region, add entries to fx-pairs.json where MEA currencies are the base (e.g., `ZAR/JPY`, `AED/USD`, `SAR/EUR`).

#### Storage Architecture (Hybrid localStorage + Clerk)

FX selection uses a **hybrid storage** approach for fast reads with cross-device sync:

```
┌─────────────────────────────────────────────────────────────────┐
│                    FX SELECTION DATA FLOW                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  User action (FX Picker)                                        │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────────┐                                           │
│  │  localStorage   │  ← Immediate write (fast UX)              │
│  │ promagen:fx:sel │                                           │
│  └────────┬────────┘                                           │
│           │                                                     │
│           ▼ (async, debounced 2s)                              │
│  ┌─────────────────┐                                           │
│  │ Clerk metadata  │  ← Persistent source of truth             │
│  │ fxSelection     │                                           │
│  └────────┬────────┘                                           │
│           │                                                     │
│           ▼ (on login, other devices)                          │
│  ┌─────────────────┐                                           │
│  │ Sync to local   │  ← Clerk → localStorage on auth          │
│  └─────────────────┘                                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
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
  tier: 'free' | 'paid';
  fxSelection?: {
    pairIds: string[]; // Max 16 items
    updatedAt: string; // ISO timestamp
  };
}
```

#### Gateway Integration

The gateway receives pair selection via **POST body** (not query params):

```typescript
// Frontend → Gateway request
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
| Fresh login                        | Clerk → localStorage (Clerk wins)    |
| localStorage exists, no Clerk data | localStorage → Clerk (migrate)       |
| Both exist, Clerk newer            | Clerk → localStorage                 |
| Both exist, localStorage newer     | localStorage → Clerk                 |
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

- Selection does **not** affect ordering — longitude ordering is invariant
- Selection affects **content only** (which pairs), not **physics** (how they're ordered)
- SSOT still controls default pairs for free users and fallback
- The ribbon remains SSOT-driven; Pro users edit their personal SSOT-compatible config

Authority for implementation: `docs/authority/ribbon-homepage.md` (FX Picker section)

---

### 5.6 Prompt builder selection limits (platform-aware precision control)

Selection limits are **platform-aware** — different AI platforms handle prompt complexity differently. The system assigns each of Promagen's 42 supported platforms to one of four tiers based on their prompt handling capabilities.

#### Platform Tier Philosophy

| Tier | Name             | Max Terms | Philosophy                             |
| ---- | ---------------- | --------- | -------------------------------------- |
| 1    | CLIP             | 3         | Token-limited, embedding-based         |
| 2    | Midjourney       | 4         | Structured parameters, moderate length |
| 3    | Natural Language | 5         | Handles complex multi-term prompts     |
| 4    | Plain Language   | 6         | Full natural language understanding    |

#### Category Limits by Tier

| Category       | Tier 1 | Tier 2 | Tier 3 | Tier 4 | Pro Bonus |
| -------------- | ------ | ------ | ------ | ------ | --------- |
| Subject        | 1      | 1      | 1      | 1      | —         |
| Action         | 1      | 1      | 1      | 1      | —         |
| Environment    | 1      | 1      | 1      | 1      | —         |
| Time           | 1      | 1      | 1      | 1      | —         |
| Composition    | 1      | 1      | 1      | 1      | —         |
| **Style**      | 1      | 2      | 3      | 4      | **+1**    |
| **Lighting**   | 1      | 2      | 2      | 3      | **+1**    |
| **Colour**     | 1      | 2      | 2      | 3      | **+1**    |
| **Atmosphere** | 1      | 1      | 2      | 2      | **+1**    |
| **Materials**  | 1      | 1      | 2      | 2      | **+1**    |
| **Fidelity**   | 1      | 1      | 2      | 2      | **+1**    |
| **Negative**   | 1      | 2      | 3      | 4      | **+1**    |

**Stackable categories** (bold above) get **+1 selection for Pro Promagen users**.

#### Platform Assignments

**Tier 1 (CLIP-based):**
DALL·E 2, VQGAN+CLIP, CLIP-Guided Diffusion, Big Sleep, DiscoDiffusion, Artbreeder

**Tier 2 (Midjourney-like):**
Midjourney, Niji Journey, BlueWillow, Playground AI, Leonardo AI, Lexica Aperture, Dreamlike, NightCafe, Craiyon, StarryAI, Deep Dream Generator, Jasper Art

**Tier 3 (Natural Language):**
DALL·E 3, Stable Diffusion 1.5, Stable Diffusion 2.1, Stable Diffusion XL, Kandinsky, IF by DeepFloyd, PixArt-α, Imagen (Google), Muse, SDXL Turbo, SD3, Kolors

**Tier 4 (Plain Language):**
Firefly (Adobe), Ideogram, Recraft, Flux, Krea AI, Freepik AI, Tensor Art, SeaArt, Shakker AI, Pika Labs, RunwayML, Bing Image Creator, Canva AI, Clipdrop

#### Behaviour on Platform Switch

When user switches to a platform with lower limits:

1. Auto-trim excess selections (most recently added removed first)
2. Show toast: "Selection trimmed to fit [Platform] limits"
3. Preserve user's preference order where possible

---

### 5.7 Market Pulse city connections

Standard Promagen: **4 cities** — Sydney, Hong Kong, London, Chicago

Pro Promagen: **16 cities** — All 4 free cities plus:

- Singapore (SGX)
- Tokyo (TSE)
- Frankfurt (Xetra)
- Paris (Euronext Paris)
- Amsterdam (Euronext Amsterdam)
- Zürich (SIX)
- Toronto (TSX)
- New York (NYSE)
- Mumbai (BSE)
- São Paulo (B3)
- Johannesburg (JSE)
- Dubai (DFM)

Market Pulse animations show connection lines between trading hubs.

Authority for implementation: `docs/authority/ribbon-homepage.md` (Market Pulse v2.0 section)

---

### 5.8 Image Quality vote weight multiplier

When voting on AI provider image quality, Pro Promagen users' votes count **2×**.

| User Type         | Vote Weight |
| ----------------- | ----------- |
| Standard Promagen | 1×          |
| Pro Promagen      | 2×          |

This acknowledges that Pro users are likely more invested in prompt quality and image generation outcomes.

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

| Aspect   | Implementation                                         |
| -------- | ------------------------------------------------------ |
| Model    | Claude Haiku (~$0.25/1M input tokens) or GPT-4o-mini   |
| Caching  | Identical queries cached in Vercel KV for 24h          |
| Debounce | 500ms debounce, only calls on [Suggest →] button click |

#### Fallback

If LLM call fails:

1. Show toast: "Suggestion unavailable — try the dropdowns below"
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

**Status:** Planned feature — see `TODO-api-integration.md` §2.4 for implementation details.

Authority for implementation: `docs/authority/TODO-api-integration.md`

---

### 5.10 Pro Promagen Configuration Page (`/pro-promagen`)

The `/pro-promagen` route allows Pro users to configure their FX pairs and exchanges. It uses the **standard homepage layout** — identical styling, components, and structure — with demo data instead of live API calls.

#### Page Purpose

| User Type | Mode          | Behaviour                                                                     |
| --------- | ------------- | ----------------------------------------------------------------------------- |
| Free user | Preview       | Interactive pickers, no persistence, demo data, "Upgrade to Pro Promagen" CTA |
| Paid user | Configuration | Interactive pickers, saves to localStorage + Clerk, "Save Preferences" CTA    |

#### Page Layout (Identical to Homepage)

```
┌─────────────────────────────────────────────────────────────────────┐
│  [FX Ribbon - demo prices based on user's FX pair selection]        │
├──────────┬─────────────────────────────────────────┬────────────────┤
│          │                                         │                │
│ Exchange │  Standard vs Pro Promagen               │  Exchange      │
│ Cards    │  ┌─────────────────────────────────┐   │  Cards         │
│ (left)   │  │ Feature        │ Std  │ Pro     │   │  (right)       │
│          │  ├────────────────┼──────┼─────────┤   │                │
│ SAME     │  │ FX Pairs       │ 8    │ [Picker]│   │  SAME         │
│ STYLING  │  │ Exchanges      │ 16   │ [Picker]│   │  STYLING      │
│ AS       │  │ Reference Frame│ You  │ Toggle  │   │  AS           │
│ HOMEPAGE │  │ Daily Prompts  │ 10   │ Unlimited│   │  HOMEPAGE     │
│          │  │ Prompt Stacking│ Base │ +1      │   │                │
│          │  └─────────────────────────────────┘   │                │
│          │                                         │                │
│          │  [Upgrade to Pro] or [Save Preferences] │                │
│          │                                         │                │
└──────────┴─────────────────────────────────────────┴────────────────┘
```

#### Comparison Table (Centre Column)

The comparison table shows Standard vs Pro features. **FX Pairs and Exchanges open fullscreen pickers** — other rows are read-only display.

| Feature         | Standard      | Pro                                           |
| --------------- | ------------- | --------------------------------------------- |
| **FX Pairs**    | 8 fixed       | **[💱 FX Picker Trigger]** → Fullscreen       |
| **Exchanges**   | 16 fixed      | **[🌐 Exchange Picker Trigger]** → Fullscreen |
| Stock Indices   | 16 fixed      | [▼ Dropdown] — ChipsDropdown                  |
| Reference Frame | Your location | Toggle: You / Greenwich                       |
| Daily Prompts   | 10 per day    | Unlimited                                     |
| Prompt Stacking | Base limits   | +1 on 7 categories                            |

**Not shown in table:** Vote Weight, Market Pulse (internal features, no user control needed).

#### Picker Trigger Styling

| Picker    | Trigger Style                                              | Done Button Style |
| --------- | ---------------------------------------------------------- | ----------------- |
| Exchanges | Purple-pink gradient (`from-purple-600/20 to-pink-600/20`) | Purple gradient   |
| FX Pairs  | Emerald-sky gradient (`from-emerald-600/20 to-sky-600/20`) | Emerald gradient  |

#### Fullscreen Picker Mode

When a picker trigger is clicked:

1. **Entire centre panel becomes the picker** (no headers, no badges, no table)
2. Picker fills the available space with its accordion interface
3. Done button at bottom returns to comparison table view
4. Only ONE picker can be open at a time

**State Management:**

```typescript
// In pro-promagen-client.tsx
type FullscreenPickerMode = 'none' | 'exchange' | 'fx';

const [fullscreenPickerMode, setFullscreenPickerMode] = useState<FullscreenPickerMode>('none');

// When 'exchange': Show ExchangePicker fullscreen
// When 'fx': Show FxPicker fullscreen
// When 'none': Show normal comparison table
```

#### Demo Mode (Zero API Cost)

| Data Type        | Source                       | Display                  |
| ---------------- | ---------------------------- | ------------------------ |
| FX ribbon prices | `fx-pairs.json` demo values  | Shows demo prices        |
| Exchange clocks  | Client `Intl.DateTimeFormat` | Real local time          |
| Market status    | Client calculation           | Open/Closed              |
| Weather badges   | Demo placeholder             | Shows "—" or static icon |
| Exchange cards   | Same component as homepage   | Identical styling        |

**Key rule:** Exchange cards must use the **exact same component** as homepage (`ExchangeCard`), just fed demo data.

#### Component Reuse

| Component        | Source                                      | Notes                    |
| ---------------- | ------------------------------------------- | ------------------------ |
| `HomepageGrid`   | `@/components/layout/homepage-grid`         | Standard 3-column layout |
| `FxRibbon`       | `@/components/fx/fx-ribbon`                 | Fed demo prices          |
| `ExchangeCard`   | `@/components/exchanges/exchange-card`      | Fed demo weather         |
| `ExchangePicker` | `@/components/pro-promagen/exchange-picker` | Continental accordion    |
| `FxPicker`       | `@/components/fx/fx-picker`                 | Regional accordion       |

#### Data Flow

1. Page loads → show SSOT defaults
2. User clicks FX or Exchange picker trigger
3. Fullscreen picker opens with current selection
4. User makes selections in accordion
5. "Done" → returns to table, selection state updated
6. **Paid users:** Save → localStorage + Clerk metadata
7. **Free users:** Preview only, CTA → `/upgrade`

#### File Structure

```
frontend/src/
├── app/pro-promagen/
│   ├── page.tsx                    # Server component
│   ├── pro-promagen-client.tsx     # Client orchestrator (v2.6.0)
│   ├── error.tsx                   # Error boundary
│   └── loading.tsx                 # Loading skeleton
├── components/pro-promagen/
│   ├── comparison-table.tsx        # Table with picker triggers (v2.4.0)
│   ├── exchange-picker.tsx         # Continental accordion (v2.5.0)
│   └── upgrade-cta.tsx             # Mode-aware button
├── components/fx/
│   ├── fx-picker.tsx               # Regional FX accordion (v2.0.0)
│   └── picker-toggle.tsx           # Picker toggle utilities
└── lib/fx/
    ├── fx-regions.ts               # Currency → Region mapping (v1.0.0)
    └── fx-picker-helpers.ts        # Grouping/search utilities (v1.0.0)
```

#### Validation Rules

- FX pairs: 0 ≤ count ≤ 16, all IDs must exist in SSOT catalog
- Exchanges: 0 ≤ count ≤ 16, all IDs must exist in SSOT catalog

Rules:

- Free users can fully interact (try before buy)
- Selections only persist for paid users
- Demo data avoids API costs
- Homepage reflects saved preferences after save

Authority for components: See `code-standard.md` §8.4 for dropdown patterns.

---

### 5.11 WorldPrompt Live Background (Pro Promagen exclusive)

WorldPrompt Live Background transforms the homepage into a living canvas. The background displays an AI-generated image derived from real-world data — weather, time of day, market status, FX mood, and seasonal context — following the WorldPrompt 30-minute rotation.

#### Tier Comparison

| Aspect              | Standard Promagen    | Pro Promagen                           |
| ------------------- | -------------------- | -------------------------------------- |
| Homepage background | Static dark gradient | AI-generated scene                     |
| Context bar         | Hidden               | Visible (city, weather, FX, market)    |
| Fullscreen mode     | N/A                  | Expand button → screensaver view       |
| Image updates       | N/A                  | On rotation + significant data changes |

#### Visual Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  ████████████████████████████████████████████████████████████████████████   │
│  ██                                                                    ██   │
│  ██   [Generated Image: Sydney harbour at dawn, warm amber light,      ██   │
│  ██    scattered clouds, Opera House silhouette, 24°C feeling]         ██   │
│  ██                                                                    ██   │
│  ██   ┌─────────────────────────────────────────────────────────┐     ██   │
│  ██   │  ◄ FX RIBBON ►                                          │     ██   │
│  ██   └─────────────────────────────────────────────────────────┘     ██   │
│  ██                                                                    ██   │
│  ██   ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐     ██   │
│  ██   │ NZX     │ │ ASX  ●  │ │ TSE     │ │ HKEX    │ │ SGX     │     ██   │
│  ██   └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘     ██   │
│  ██                                                                    ██   │
│  ██   ┌─────────────────────────────────────────────────────────┐     ██   │
│  ██   │  PROVIDERS TABLE                                        │     ██   │
│  ██   └─────────────────────────────────────────────────────────┘     ██   │
│  ██                                                                    ██   │
│  ████████████████████████████████████████████████████████████████████████   │
│                                                                             │
│  ● Sydney, Australia • ASX Open • 24°C ☀️ • AUD/USD +0.3%      [Expand ⛶]  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Layer System

| Layer       | Z-Index | Content                                      |
| ----------- | ------- | -------------------------------------------- |
| Background  | 0       | AI-generated image (blurred edges, vignette) |
| Overlay     | 1       | Semi-transparent gradient for readability    |
| Content     | 2       | FX ribbon, exchange cards, providers table   |
| Context bar | 3       | City info, expand button (fixed bottom)      |

#### Image Generation Pipeline

```
WorldPrompt Rotation (30 min)
        │
        ▼
┌─────────────────┐
│ Active City     │ (Sydney, Hong Kong, London, Chicago)
│ + Weather Data  │ (temp, conditions, time of day)
│ + FX Mood       │ (AUD/USD direction for Sydney, etc.)
│ + Market Status │ (ASX open/closed)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Prompt Assembly │ (worldprompt-creative-engine.md rules)
│ - No financials │ (artistic abstraction only)
│ - Safe anchors  │ (landmarks, not people)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ DALL·E 3 API   │
│ - 1024×1024    │
│ - Natural style │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Cache (24h)     │ (Vercel KV, ~48 images/day max)
└─────────────────┘
```

#### Cost Control

| Constraint     | Limit     | Rationale                        |
| -------------- | --------- | -------------------------------- |
| Images per day | ~48       | 4 cities × 2 images/hour         |
| Cache TTL      | 24 hours  | Reuse images for same conditions |
| Resolution     | 1024×1024 | Standard DALL·E 3                |
| Style          | Natural   | Consistent aesthetic             |

#### Context Bar

Shows at bottom of viewport (fixed):

```
● [City Flag] Sydney, Australia • ASX Open • 24°C ☀️ • AUD/USD +0.3%  [⛶ Expand]
```

- City flag: SVG from `/public/flags/`
- Market status: Derived from exchange hours
- Weather: From Visual Crossing API
- FX mood: Direction of city's primary currency pair
- Expand: Opens fullscreen screensaver mode

#### Fullscreen Mode

- Removes all UI except image and context bar
- 2-second crossfade between images
- Press Escape or click to exit
- Designed for ambient/passive viewing

Rules:

- Standard Promagen users see Gallery toggle but get upsell
- Pro Promagen users get full Gallery experience
- Images derive from existing market data (no new external APIs for MVP)
- Prompts never contain financial terminology (artistic abstraction only)
- Screensaver mode designed for ambient/passive viewing

Authority for implementation: `docs/authority/gallery-mode-master.md`

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
- **Prompt builder access requires sign-in** (no exceptions)

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
- Market Pulse animation behaviour (only scope is defined here)
- Community voting mechanics (only weight multiplier is defined here)
- Authentication implementation details
- Prompt builder architecture details
- Ask Promagen implementation details (only limits defined here)

Authority for those lives elsewhere:

- FX behaviour and SSOT rules → `docs/authority/ribbon-homepage.md`
- Market Pulse v2.0 specification → `docs/authority/ribbon-homepage.md`
- Cost control and provider authority → `promagen-api-brain-v2.md`
- Platform and spend guardrails → `vercel-pro-promagen-playbook.md`
- Prompt builder architecture → `docs/authority/prompt-builder-page.md`
- Community voting system → `docs/authority/ai providers.md`
- Authentication architecture → `docs/authority/clerk-auth.md`
- Ask Promagen implementation → `docs/authority/TODO-api-integration.md`
- WorldPrompt Live Background → `docs/authority/worldprompt-creative-engine.md`

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

- **29 Jan 2026:** **FX PICKER REGIONAL FULLSCREEN REDESIGN (v2.0.0)** — Complete rewrite of §5.5 FX Picker UI. Implemented fullscreen regional accordion (matches Exchange Picker UX). 4 regions based on BASE currency: Americas (🌎), Europe (🏰), Asia Pacific (🌏), Middle East & Africa (🌍). Features: dual SVG flags per pair (base+quote), sticky selection tray, progress bar (0-16), search across all regions, category badges (MAJOR/CROSS/EMERGING). Files: `fx-picker.tsx` v2.0.0, `fx-regions.ts` v1.0.0 (100+ currency mappings), `fx-picker-helpers.ts` v1.0.0. Updated §5.10 to reflect fullscreen picker modes. Trigger button: emerald-sky gradient with currency exchange icon. Note: MEA region shows fewer pairs because fx-pairs.json has limited BASE currency entries for that region.
- **29 Jan 2026:** **EXCHANGE PICKER SCROLL FIX (v2.5.0)** — Fixed large screen scroll behavior in Exchange Picker. Now uses `overflow-y-auto` on all screen sizes with `max-h-[400px] lg:max-h-none`. Removed `lg:overflow-visible` which broke scrolling entirely. All continents closed by default. Updated §5.3 with current implementation details.
- **29 Jan 2026:** **PRO PROMAGEN CONFIG PAGE FULLSCREEN PICKERS (v2.6.0)** — Updated §5.10 to reflect fullscreen picker mode. When FX or Exchange picker is triggered, entire centre panel becomes the picker (no headers, no badges, no table). State managed via `fullscreenPickerMode: 'none' | 'exchange' | 'fx'`. Files updated: `pro-promagen-client.tsx` v2.6.0, `comparison-table.tsx` v2.4.0.
- **13 Jan 2026:** **STOCK INDEX DATA ON EXCHANGE CARDS** — Added "Stock index data" to §2.1 free features list. Each exchange card now displays its benchmark index (e.g., Nikkei 225, S&P 500) with live price, day change, and percent change. Data sourced from Marketstack API (separate budget from TwelveData). Index row always visible on card — shows index name immediately (from catalog), price shows skeleton until API data arrives.
- **10 Jan 2026:** **FX DATA SSOT CONSOLIDATION** — Merged `fx.pairs.json` (defaults, country codes, longitude) and `pairs.json` (catalog metadata, demo prices) into single unified `fx-pairs.json`. Now only ONE file to maintain for FX data. Updated §5.5 catalog reference (102 pairs), §5.10 demo data source. Minimum count changed from 6 to 0 (allows "start fresh" workflow).
- **9 Jan 2026:** **WORLDPROMPT LIVE BACKGROUND** — Added §5.11 WorldPrompt Live Background (Pro Promagen exclusive). Homepage background becomes AI-generated scene derived from WorldPrompt data (weather, time, market status, FX mood). Includes context bar, fullscreen mode, 2-second crossfade transitions. Cost-controlled with 24h cache, ~48 images/day max. Added worldprompt-creative-engine.md Part 13 to §7 authority references.
- **10 Jan 2026:** **PRO PROMAGEN CONFIG PAGE SIMPLIFIED** — Rewrote §5.10 to use standard homepage layout (identical FX ribbon, exchange cards). Dropdowns for FX Pairs and Exchanges embedded in comparison table (not separate panels). Removed Vote Weight and Market Pulse from display (internal features). Alphabetical dropdown order with colorful styling. Demo weather placeholder shown. Reuses existing components: `HomepageGrid`, `FxRibbon`, `ExchangeCard`, `Combobox`.
- **9 Jan 2026:** **PRO PROMAGEN CONFIGURATION PAGE** — Added §5.10 `/pro-promagen` route. Dual-mode page: preview (free users) + configuration (paid users). Features: FX selection (0-16 pairs), Exchange selection (0-16 exchanges), quick presets (regional/currency), visual progress bars, comparison table, perks summary. Preview uses demo data (zero API cost). Design follows `/prompts/explore` DNA Helix + Ethereal Glow pattern.
- **9 Jan 2026:** **EXCHANGE SELECTION FOR PRO USERS** — Rewrote §5.3 to add full exchange selection feature (mirrors FX selection). Pro users choose 0-16 exchanges from 130-exchange catalog. Added hybrid localStorage + Clerk storage schema. Added regional presets (Asia Pacific, Americas, Europe & Middle East, Global Majors, Emerging Markets). Removed old §5.4 (exchange count merged into §5.3).
- **9 Jan 2026:** **EXCHANGE COUNT FLEXIBILITY** — Changed exchange count rule from "multiples of 2 only" to **"any integer 0-16"**. Odd numbers (7, 9, 11, 13, 15) now allowed. Rationale: arbitrary restriction served no UX purpose.
- **9 Jan 2026:** **MARKET PULSE EXPANDED TO 16 CITIES** — Updated §5.7 to reflect 16 total cities for Pro Promagen (was 12). Added Singapore (SGX), Tokyo (TSE), Mumbai (BSE), São Paulo (B3) to future connections list.
- **9 Jan 2026:** **FREE TIER EXCHANGE COUNT UPDATED** — Updated §2.1 to reflect 16 default exchanges (was 12). SSOT file `exchanges.selected.json` now contains 16 exchanges.
- **9 Jan 2026:** **FX PAIR SELECTION FOR PRO USERS** — Added §5.5 FX pair selection (user-curated ribbon). Pro Promagen users can select **0–16 FX pairs** (any count in range) from full 102-pair catalog. Hybrid storage: localStorage (fast reads) + Clerk metadata (cross-device sync). Gateway validates pair count server-side. Renumbered §5.5→§5.6, §5.6→§5.7, §5.7→§5.8, §5.8→§5.9. Updated §3.2 reference. Added FX selection architecture to §7 exclusions.
- **8 Jan 2026:** **FREE TIER LIMIT REDUCED** — Changed Standard Promagen daily prompt limit from 30/day to **10/day**. Clean progression: Anonymous 5/day → Free 10/day → Paid unlimited. Rationale: 30/day meant only power users hit friction; 10/day creates upgrade motivation for regular creators while remaining generous enough to love the product.
- **8 Jan 2026:** Added §5.8 Ask Promagen — LLM-powered suggestions (daily limits). Anonymous: 5/day, Standard: 10/day, Pro: Unlimited. Includes storage schema, lock state behaviour, cost control approach, and fallback handling. Status: planned feature.
- **5 Jan 2026:** **PLATFORM-AWARE CATEGORY LIMITS v8.2.0** — Complete rewrite of §5.5. Selection limits are now platform-aware with 4 tiers (CLIP, Midjourney, Natural Language, Plain Language). Each of the 42 platforms assigned to appropriate tier. Pro Promagen users get +1 on stackable categories (style, lighting, colour, atmosphere, materials, fidelity, negative). Auto-trim on platform switch. Dynamic tooltip guidance shows actual limits. See prompt-builder-page.md for implementation details.
- **4 Jan 2026:** **ANONYMOUS DAILY RESET** — Anonymous users now get 5 prompts **per day** (resets at midnight local time), matching the authenticated user experience. Previously was 5 prompts total lifetime. Updated §3.2 and §3.3 with new behavior. Anonymous storage upgraded to v2 schema with `lastResetDate` field. Migration: v1 data invalidated on read, triggers fresh v2 start.
- **4 Jan 2026:** **LOCK STATE UX CLEANUP** — Lock state visual treatment now uses disabled styling only on dropdowns and aspect ratio selector. **Removed "Sign in to continue" text from individual dropdown overlays** (was ugly/cluttered UX). Lock icon only appears in dropdown labels. Updated §3.2 with detailed component behavior. Authority: prompt-builder-page.md.
- **3 Jan 2026:** **TERMINOLOGY UPDATE** — Renamed paid tier to "Pro Promagen" throughout. Added §1.1 Terminology section defining "Pro Promagen" and "Standard Promagen". Updated all user-facing references. Internal code variables remain `'paid'` for brevity.
- **3 Jan 2026:** **ANONYMOUS 5-TRY UPDATE** — Added 5 free prompts for anonymous users before sign-in required (§3.2). Anonymous usage stored in localStorage with tamper detection. Updated lock state progression to include anonymous states (§3.3). Lock overlay UI: button at top, no lock icon, centred layout.
- **2 Jan 2026:** **MAJOR UPDATE** — Added prompt builder authentication requirements (§3.2), usage quotas (§3.3), geographic ordering (§3.4), unlimited usage for paid (§5.1). Updated free features list to remove direct prompt access. Added location detection requirements. Updated invariants to include authentication.
- **2 Jan 2026:** Added §3.1 Authentication provider (Clerk). Added §4.1 Technical implementation (Clerk metadata). Added clerk-auth.md to §7 authority references.
- **2 Jan 2026:** Added §5.7 Image Quality vote weight multiplier. Added community voting authority reference to §7.
- **2 Jan 2026:** Added §5.6 Market Pulse city connections. Added Market Pulse (4 cities) to §2.1 free features. Added Market Pulse authority reference to §7.
- **1 Jan 2026:** Added §5.5 Prompt builder selection limits. Added prompt builder to §2.1 free features. Added prompt-builder-page.md to §7 authority references.
