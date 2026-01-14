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

**Anonymous tracking (localStorage v2):**

- 5 prompts per day (resets at midnight local time)
- Key: `promagen:anonymous:usage`
- Schema version: 2 (includes daily reset tracking)
- Tamper detection: checksum validation prevents manipulation
- Daily reset: `lastResetDate` field tracks when counter last reset

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
```

**Migration from v1:** Previous v1 data (without `lastResetDate`) is invalidated on read, triggering a fresh start with v2 schema. This gives existing anonymous users a clean slate with the new daily reset behavior.

**Authenticated tracking (Vercel KV):**

- Free users: 10 prompt copies per day
- Paid users: Unlimited prompt copies
- Counter resets at midnight in user's detected timezone
- Storage: Vercel KV (consistent with voting system)

**Lock state progression:**

1. **Anonymous (0-4 uses):** Full access + "X/5 free prompts today" counter
2. **Anonymous (5+ uses):** LOCKED + "Sign in to continue" button at top of overlay
3. **Free signed-in (0-9):** Full access + "X/10 prompts today" counter
4. **Free signed-in (10):** LOCKED + "Upgrade to Pro Promagen" button at top of overlay
5. **Pro Promagen:** Always enabled + expanded selection limits, no counter

**Lock state component behavior:**

- Combobox dropdowns: Disabled styling (purple tint, opacity reduced), NO overlay text
- Dropdown arrows: Hidden when locked
- Randomise button: Disabled when locked
- Free text input: Disabled when locked (cannot type)
- Copy prompt button: Shows "Sign in to continue" or "Upgrade" as appropriate
- Aspect ratio selector: Disabled buttons with reduced opacity, NO overlay text

### 3.4 Geographic exchange ordering (requires sign-in)

When a user signs in:

- **Location detection:** Browser geolocation API (free) with IP geolocation fallback (free tier)
- Stock exchanges arranged **east → west relative to user's location**
- Exchange rails split based on relative geographic position to user
- **Standard Promagen users:** Location detection + relative ordering (no choice)
- **Pro Promagen users:** Toggle between "My Location" and "Greenwich Meridian" reference frames

### 3.5 Additional sign-in benefits (still free tier)

When a user signs in:

- **Image Quality votes are tracked** and persisted to account
- **Geographic context** — exchanges positioned relative to user's location
- **Usage memory** — daily prompt quota tracking

### 3.6 Explicit exclusions at sign-in stage

The following do **not** exist:

- No arbitrary time zone selection
- No city pickers
- No custom exchange ordering
- No drag-and-drop ordering
- No favourites-first behaviour

Sign-in unlocks **context and access**, not customisation.

---

## 4. Pro Promagen tier: control within invariant rules

Pro Promagen users do **not** gain the ability to rewrite reality.

They gain **controlled freedom within physical and logical invariants**.

### 4.1 Technical implementation

User tier is stored in **Clerk's publicMetadata**:

```json
{
  "tier": "free" | "paid"
}
```

**Setting tier via Clerk Dashboard:**

1. Users → Select user → Edit Public Metadata
2. Add: `{ "tier": "paid" }`

**Setting tier programmatically:**

```typescript
import { clerkClient } from "@clerk/nextjs/server";

await clerkClient.users.updateUser(userId, {
  publicMetadata: { tier: "paid" },
});
```

**Reading tier in components:**

```typescript
import { usePromagenAuth } from "@/hooks/use-promagen-auth";

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

#### Exchange Picker UI

Pro Promagen users access the Exchange Picker via:

- `/pro-promagen` configuration page
- Quick presets for regional selection (Asia Pacific, Americas, Europe & Middle East, etc.)

The picker displays:

- Full 130-exchange catalog grouped by region
- Search/filter by exchange name, city, or country
- Current selection count vs. limit (progress bar)
- Regional presets for one-click selection
- "Reset to default" option

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

| Aspect           | Standard Promagen          | Pro Promagen               |
| ---------------- | -------------------------- | -------------------------- |
| FX pairs shown   | SSOT default (currently 8) | User-curated selection     |
| Pair count       | Fixed by SSOT              | **0 to 16**                |
| Catalog access   | N/A                        | Full catalog (102 pairs) |
| Configuration UI | None                       | FX Picker drawer           |

#### Allowed Pair Counts

Any integer from **0 to 16** inclusive.

Rules:

- Minimum 0 pairs (allows "start fresh" workflow)
- Maximum 16 pairs (aligns with exchange count ceiling, controls API budget)

#### FX Picker UI

Pro Promagen users access the FX Picker via:

- Settings drawer on homepage
- "Customise FX" button on ribbon (visible only to Pro users)

The picker displays:

- Full 102-pair catalog grouped by region/currency
- Search/filter by currency code
- Current selection count vs. limit
- "Reset to default" option

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

| Tier       | Name              | Prompt Style                                | Platforms    |
| ---------- | ----------------- | ------------------------------------------- | ------------ |
| **Tier 1** | CLIP-Based        | Tokenized keywords, high stacking tolerance | 13 platforms |
| **Tier 2** | Midjourney Family | Parameter-rich, very high tolerance         | 2 platforms  |
| **Tier 3** | Natural Language  | Conversational prompts, medium tolerance    | 10 platforms |
| **Tier 4** | Plain Language    | Simple prompts work best, low tolerance     | 17 platforms |

#### Selection Limits by Platform Tier (Standard Promagen)

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

Pro Promagen users receive **+1 selection** on categories that benefit from stacking:

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

#### Platform Tier Assignments (All 42 Platforms)

**Tier 1 — CLIP-Based (13 platforms):**
`stability`, `leonardo`, `clipdrop`, `nightcafe`, `dreamstudio`, `lexica`, `novelai`, `dreamlike`, `getimg`, `openart`, `playground`, `artguru`, `jasper-art`

**Tier 2 — Midjourney Family (2 platforms):**
`midjourney`, `bluewillow`

**Tier 3 — Natural Language (10 platforms):**
`openai`, `adobe-firefly`, `ideogram`, `runway`, `microsoft-designer`, `bing`, `flux`, `google-imagen`, `imagine-meta`, `hotpot`

**Tier 4 — Plain Language (17 platforms):**
`canva`, `craiyon`, `deepai`, `pixlr`, `picwish`, `fotor`, `visme`, `vistacreate`, `myedit`, `simplified`, `freepik`, `picsart`, `photoleap`, `artbreeder`, `123rf`, `remove-bg`, `artistly`

#### Research Rationale

| Tier                 | Why These Limits?                                                                  |
| -------------------- | ---------------------------------------------------------------------------------- |
| **Tier 1 (CLIP)**    | CLIP tokenizes efficiently — stacking 2-3 styles/lights produces coherent results  |
| **Tier 2 (MJ)**      | Midjourney was built for complex prompts — handles 3+ styles, `--no` with 8+ terms |
| **Tier 3 (NatLang)** | Conversational models prefer focused prompts — too many terms cause confusion      |
| **Tier 4 (Plain)**   | Consumer-focused tools work best with simple prompts — one style, one mood         |

#### Auto-Trim Behaviour

When a user switches platforms, selection limits may change. The system **silently trims** excess selections:

- Selections trimmed from end (keeps first N)
- No notification shown (clean UX)
- User can re-select different options if desired

**Example:** User on Midjourney (Tier 2) with 3 styles → switches to Artistly (Tier 4) → 2 styles automatically removed, 1 remains.

#### Dynamic Tooltip Guidance

Tooltips dynamically reflect the actual limit for the current platform:

- Artistly (Tier 4): "Pick 1 style. Keep it focused."
- Midjourney (Tier 2): "Pick up to 3 complementary styles. Avoid conflicting aesthetics."

Rules:

- Standard Promagen users have full access to all prompt options (after sign-in)
- Pro Promagen users gain **precision**, not **access**
- Selection limits adapt to each platform's capabilities
- The prompt builder remains complete and honest at all tiers

Authority for implementation: `docs/authority/prompt-builder-page.md`

---

### 5.7 Market Pulse city connections (expanded scope)

Market Pulse v2.0 visualises connections between stock exchanges and AI providers in the same city. The feature only activates during market open/close events (±1 minute windows).

**Standard Promagen (4 cities):**

| City      | Exchange | AI Provider(s)                           |
| --------- | -------- | ---------------------------------------- |
| Sydney    | ASX      | Leonardo AI                              |
| Hong Kong | HKEX     | Fotor, Artguru, PicWish                  |
| London    | LSE      | Stability AI, DreamStudio, Dreamlike.art |
| Chicago   | Cboe     | 123RF AI Generator                       |

**Pro Promagen adds (12 additional cities, 16 total):**

| City      | Exchange       | AI Provider(s)         |
| --------- | -------------- | ---------------------- |
| New York  | NYSE           | Runway ML, Artbreeder  |
| New York  | NASDAQ         | Runway ML, Artbreeder  |
| Paris     | Euronext       | Clipdrop               |
| Toronto   | TSX            | Ideogram               |
| Taipei    | TWSE           | MyEdit (CyberLink)     |
| Vienna    | Wiener Börse   | Remove.bg (Kaleido AI) |
| Warsaw    | GPW            | Getimg.ai              |
| Warsaw    | WSE NewConnect | Getimg.ai              |
| Singapore | SGX            | (future connections)   |
| Tokyo     | TSE            | (future connections)   |
| Mumbai    | BSE            | (future connections)   |
| São Paulo | B3             | (future connections)   |

Rules:

- Standard Promagen users see pulse animations for **4 cities** (7 provider connections)
- Pro Promagen users see pulse animations for **16 cities** (current + future connections)
- The animation behaviour is identical at both tiers — only scope differs
- Multi-session exchanges (Hong Kong) fire on all session boundaries at both tiers

Authority for implementation: `docs/authority/ribbon-homepage.md` (Market Pulse v2.0 section)

---

### 5.8 Image Quality vote weight multiplier

Pro Promagen users receive a **1.5× multiplier** on all Image Quality votes.

| Signal Type                     | Standard Weight | Pro Promagen Weight |
| ------------------------------- | --------------- | ------------------- |
| Image upload tagged to platform | 1               | 1.5                 |
| Like on image                   | 2               | 3                   |
| Favorable comment               | 2               | 3                   |
| Direct provider card like       | 3               | 4.5                 |

Rules:

- The multiplier is applied **server-side** and is not disclosed in the UI
- Both Standard and Pro Promagen users have the same **3 votes per day** limit
- Both Standard and Pro Promagen users have the same **1 vote per provider per 24 hours** limit
- The multiplier affects vote **weight**, not vote **count**
- This is a silent quality-of-influence enhancement, not a gating mechanism

**Rationale:** Pro Promagen users have demonstrated investment in the platform. Their quality assessments carry slightly more weight in aggregate rankings, creating an economic barrier to bot-farm manipulation while rewarding engaged users.

**Transparency policy:** If directly asked, Promagen will confirm that "rankings are based on community engagement signals" (truthful). The specific multiplier value is not disclosed to prevent gaming calculations.

Authority for implementation: `docs/authority/ai providers.md` (Community Voting System section)

---

### 5.9 Ask Promagen — LLM-powered suggestions (daily limits)

"Ask Promagen" uses server-side LLM calls to interpret natural language descriptions and auto-populate prompt builder dropdowns. This incurs real API costs (~$0.001 per suggestion).

#### Daily Suggestion Limits

| Tier                  | Daily Ask Promagen Limit |
| --------------------- | ------------------------ |
| **Anonymous**         | 5 suggestions/day        |
| **Standard Promagen** | 10 suggestions/day       |
| **Pro Promagen**      | Unlimited                |

#### Tracking

- **Anonymous:** Tracked in localStorage (same pattern as prompt usage, separate counter)
- **Authenticated:** Tracked in Vercel KV with key `ask:${userId}:${date}`
- **Reset:** Midnight in user's local timezone (consistent with prompt usage)

#### Lock State Behaviour

When limit reached:

- "Suggest" button becomes disabled (same purple-tint treatment as other locked UI)
- Tooltip shows: "Daily limit reached. Sign in for more." (anonymous) or "Upgrade to Pro Promagen for unlimited." (free)
- Dropdown manual selection remains fully functional
- User can still build prompts manually

#### Cost Control

| Aspect     | Approach                                               |
| ---------- | ------------------------------------------------------ |
| Rate limit | Per-user daily limits (above)                          |
| Model      | Claude Haiku (~$0.25/1M input tokens) or GPT-4o-mini   |
| Caching    | Identical queries cached in Vercel KV for 24h          |
| Debounce   | 500ms debounce, only calls on [Suggest →] button click |

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

| User Type | Mode          | Behaviour                                                                       |
| --------- | ------------- | ------------------------------------------------------------------------------- |
| Free user | Preview       | Interactive dropdowns, no persistence, demo data, "Upgrade to Pro Promagen" CTA |
| Paid user | Configuration | Interactive dropdowns, saves to localStorage + Clerk, "Save Preferences" CTA    |

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
│ SAME     │  │ FX Pairs       │ 8    │ [▼ dropdown] │  SAME         │
│ STYLING  │  │ Exchanges      │ 16   │ [▼ dropdown] │  STYLING      │
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

The comparison table shows Standard vs Pro features. **Only FX Pairs and Exchanges have dropdowns** — other rows are read-only display.

| Feature         | Standard      | Pro                                 |
| --------------- | ------------- | ----------------------------------- |
| **FX Pairs**    | 8 fixed       | **[▼ Dropdown]** 0–16, alphabetical |
| **Exchanges**   | 16 fixed      | **[▼ Dropdown]** 0–16, alphabetical |
| Reference Frame | Your location | Toggle: You / Greenwich             |
| Daily Prompts   | 10 per day    | Unlimited                           |
| Prompt Stacking | Base limits   | +1 on 7 categories                  |

**Not shown in table:** Vote Weight, Market Pulse (internal features, no user control needed).

#### Dropdown Styling

Dropdowns use the **same combobox component as Prompt Builder** (`@/components/ui/combobox`):

- Items listed in **alphabetical order**
- **Colorful gradient backgrounds** when open (emerald, sky, violet, amber)
- Search/filter functionality
- Multi-select with visual count indicator
- Same styling as rest of website

#### Demo Mode (Zero API Cost)

| Data Type        | Source                       | Display                  |
| ---------------- | ---------------------------- | ------------------------ |
| FX ribbon prices | `fx-pairs.json` demo values     | Shows demo prices        |
| Exchange clocks  | Client `Intl.DateTimeFormat` | Real local time          |
| Market status    | Client calculation           | Open/Closed              |
| Weather badges   | Demo placeholder             | Shows "—" or static icon |
| Exchange cards   | Same component as homepage   | Identical styling        |

**Key rule:** Exchange cards must use the **exact same component** as homepage (`ExchangeCard`), just fed demo data.

#### Component Reuse

| Component      | Source                                 | Notes                    |
| -------------- | -------------------------------------- | ------------------------ |
| `HomepageGrid` | `@/components/layout/homepage-grid`    | Standard 3-column layout |
| `FxRibbon`     | `@/components/fx/fx-ribbon`            | Fed demo prices          |
| `ExchangeCard` | `@/components/exchanges/exchange-card` | Fed demo weather         |
| `Combobox`     | `@/components/ui/combobox`             | Same as Prompt Builder   |

#### Data Flow

1. Page loads → show SSOT defaults
2. User selects FX pairs/exchanges from dropdowns
3. FX ribbon + exchange rails update instantly (demo data)
4. **Paid users:** Save → localStorage + Clerk metadata
5. **Free users:** Preview only, CTA → `/upgrade`

#### File Structure (Minimal)

```
frontend/src/
├── app/pro-promagen/
│   ├── page.tsx                    # Server component
│   ├── pro-promagen-client.tsx     # Client orchestrator
│   ├── error.tsx                   # Error boundary
│   └── loading.tsx                 # Loading skeleton
└── components/pro-promagen/
    ├── comparison-table.tsx        # Table with embedded dropdowns
    └── upgrade-cta.tsx             # Mode-aware button
```

#### Validation Rules

- FX pairs: 6 ≤ count ≤ 16, all IDs must exist in SSOT catalog
- Exchanges: 6 ≤ count ≤ 16, all IDs must exist in SSOT catalog

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

| Layer            | Purpose                          | CSS                                                                   |
| ---------------- | -------------------------------- | --------------------------------------------------------------------- |
| Background image | Full viewport coverage           | `position: fixed; inset: 0; object-fit: cover; z-index: -2`           |
| Dark overlay     | Ensures UI readability           | `position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: -1` |
| Existing UI      | All current components unchanged | `z-index: 0+`                                                         |
| Context bar      | Shows current WorldPrompt focus  | `position: fixed; bottom: 0; z-index: 10`                             |

#### Context Bar (Bottom Strip)

Always visible for Pro Promagen users. Shows what's driving the current image:

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ● Sydney, Australia • ASX Open • 24°C ☀️ • AUD/USD +0.3%     [Expand ⛶] │
└──────────────────────────────────────────────────────────────────────────┘
```

Elements:

- **Pulsing dot** — indicates live/updating
- **City + Country** — current WorldPrompt focus
- **Market status** — from existing exchange data
- **Weather** — from existing weather badges
- **Lead FX pair** — movement from FX ribbon
- **Expand button** — opens fullscreen mode

#### Image Generation Triggers

Images regenerate when data changes meaningfully:

| Trigger             | Example             | Frequency                |
| ------------------- | ------------------- | ------------------------ |
| City rotation       | Sydney → Tokyo      | Every 30 mins            |
| Time-of-day shift   | Morning → Afternoon | ~4× per city             |
| Market event        | ASX opens           | Aligns with Market Pulse |
| Weather change      | Sunny → Rain        | As condition changes     |
| Significant FX move | >1% change          | Mood shift               |

**Cache rule:** Same prompt text = reuse cached image (24h TTL).

**Estimated images per day:** ~48 max (12 cities × 4 time shifts), likely fewer with caching.

#### Image Transition

When new image arrives:

1. New image loads in hidden `<img>` element
2. On load complete, crossfade over 2 seconds
3. Old image removed from DOM
4. Context bar updates simultaneously

**Reduced motion:** Instant swap, no crossfade.

#### Fullscreen Mode

Pro users click **[Expand ⛶]** → modal overlay:

- Image at full resolution, no dark overlay
- Context info in bottom-left corner (semi-transparent)
- Generated text prompt shown (user can copy)
- ESC or click outside to close

#### Cost Control

| Control             | Value                  |
| ------------------- | ---------------------- |
| Cache TTL           | 24 hours               |
| Max generations/day | ~48 (with rotation)    |
| Model               | DALL-E 3 or equivalent |
| Resolution          | 1792×1024 (landscape)  |
| Estimated cost      | ~$2/day at $0.04/image |

#### Fallback States

| State              | Behaviour                                       |
| ------------------ | ----------------------------------------------- |
| Image loading      | Subtle shimmer on existing dark background      |
| Image failed       | Keep previous image, log error, retry in 5 mins |
| API quota exceeded | Fall back to gradient, hide context bar         |
| User not Pro       | No image, no context bar, existing dark UI      |

#### Component Structure

```
src/components/worldprompt-live/
├── worldprompt-background.tsx     # Fixed background image layer
├── worldprompt-overlay.tsx        # Dark overlay for readability
├── worldprompt-context-bar.tsx    # Bottom info strip
├── worldprompt-fullscreen.tsx     # Expanded view modal
├── use-worldprompt-image.ts       # Hook: fetches/caches generated image
└── index.ts                       # Public exports
```

#### API Route

```typescript
// src/app/api/worldprompt/image/route.ts

export async function GET(request: Request) {
  // 1. Get current WorldPrompt context
  // 2. Generate prompt text (existing engine)
  // 3. Hash prompt → cache key
  // 4. Check Vercel KV for cached image URL
  // 5. If miss: call image API, store result, return URL
  // 6. If hit: return cached URL
}
```

#### Accessibility

| Concern          | Solution                                              |
| ---------------- | ----------------------------------------------------- |
| Decorative image | `aria-hidden="true"` on background                    |
| Reduced motion   | Instant swap, no crossfade                            |
| Screen readers   | Context bar has `aria-live="polite"` for city changes |
| Contrast         | 70% overlay ensures WCAG AA on all UI text            |

Rules:

- Standard Promagen users see existing dark gradient background
- Pro Promagen users see AI-generated scenes from WorldPrompt data
- Images derive from existing data sources (no new APIs required)
- Feature is purely visual — no information is gated behind Pro tier
- Fullscreen mode provides screensaver-like ambient experience

Authority for implementation: `docs/authority/worldprompt-creative-engine.md` (Part 13)

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
