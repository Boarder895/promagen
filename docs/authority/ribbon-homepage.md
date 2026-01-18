Homepage – Main Promagen Hub
The homepage is the user's command centre.
It is built around:
A three-column market layout (left rail, centre column, right rail).
A market belt in the centre column:
Today: Three stacked ribbon rows are LIVE:

- FX row (8 chips by default)
- Commodities row (8 chips by default)
- Crypto row (8 chips by default)
  A central AI Providers Leaderboard panel, directly under the ribbons.
  Everything is centred, balanced, and responsive. On larger screens the layout keeps three columns with generous breathing room around the rails; on smaller screens the layout gracefully collapses.

  1.1 Overall Structure & Responsiveness

Page canvas (viewport-locked layout — implemented Dec 31, 2025)

Background: deep, subtle dark gradient.
Height: exactly 100dvh — page fills viewport precisely, no more, no less.
Overflow: hidden on html/body — NO page-level scrollbar ever appears.

All scrolling happens inside individual containers:

- Providers table: scrolls vertically when content exceeds available space
- Exchange rails: scroll vertically and are synchronized (scroll one, both move)
- Each container uses `overflow-y: auto` so scrollbars only appear when needed

All core content lives inside a centred container with a maximum width (e.g. max-w-6xl or similar on desktop) so the layout never becomes absurdly wide on big monitors.

Layout structure (flex-based):

```
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

Critical CSS classes:

- `h-dvh` — exactly 100dvh (dynamic viewport height, accounts for mobile browser chrome)
- `overflow-hidden` — prevents page scroll
- `flex-1` — fills available space
- `min-h-0` — allows flex children to shrink below their content size (required for internal scroll)
- `shrink-0` — prevents shrinking (for fixed-height sections like hero and footer)

Three-column grid
The main content area is a three-column CSS grid:
Left rail: 0.9fr
Table structure
Header: "AI Providers Leaderboard".
Columns (left → right):

Provider (icon + name; rank may appear as a muted prefix; flag + city + HH:MM clock)
Promagen Users
Image Quality (ordinal rank: 1st, 2nd, etc.)
Support (social media icons with glowing tooltips — includes Pinterest & X, 2-row layout for 5+ icons)
API/Affiliate
Overall Score (includes a small trend indicator inline; Overall Score stays far right)

Notes:

- Trend is not a standalone column (it lives inside Overall Score).
- Tags are removed from the homepage leaderboard table.

  Hard rule: the FX chip label font size must never be smaller than 11.5px.

- Snap rule (readability-first): if keeping a single line would require the label font to drop below 11.5px, the FX row must snap to exactly two lines.
  In two-line mode, the label font size must be as large as possible while still fitting cleanly within two lines (no overflow, no clipped text), keeping alignment and spacing consistent.

- Small / extreme narrow: if even two lines cannot fit cleanly at 11.5px, prefer horizontal scroll rather than reducing the label font below 11.5px.

In all cases the rule remains: render exactly what fx-pairs.json specifies, in SSOT order, regardless of how many FX are selected.

Everything is set up with fluid widths so the layout "snaps" cleanly rather than collapsing awkwardly as the window is moved between different screens and resolutions.

Market Belt in the Centre Column

The market belt is now firmly part of the centre column, not a full-width band at the absolute top of the page.

## Pair label formatting (test-locked)

The FX pair separator standard is **non-negotiable**.

- Add a tiny "event taxonomy" section somewhere authoritative listing allowed `eventType` values and weights, so nobody invents new names later and breaks aggregation.

- Use the **ASCII forward slash** `/` (**U+002F**) between ISO-4217 currency codes.

That means:

- **Canonical machine form:** `BASE/QUOTE` → `EUR/USD`, `AUD/GBP`
- **Canonical display form:** `BASE / QUOTE` (spaces around slash) → `AUD / GBP`

This UI spacing is part of the contract and is protected by tests  
(see: `frontend/src/__tests__/fx-pairs.test.ts`).

**Hard rules**

- Always use plain ASCII `/` (U+002F).
- Never output a backslash `\`.
- Never use look-alike characters such as `⁄` (fraction slash) or `∕` (division slash).
- Keep codes uppercase (ISO 4217).
- Spaces are required exactly as shown.

**Normalisation at the borders**

- Accept common inbound variants:  
  `EURUSD`, `EUR-USD`, `EUR_USD`, `EUR:USD`, `EUR\USD`, `EUR/USD`  
  → normalise to `EUR/USD`.
- Store `base` and `quote` separately as the **Single Source of Truth (SSOT)**; strings are renderings only.

Keep codes uppercase 3-letter ISO-4217 (BASE and QUOTE).

Avoid lookalike characters that will randomly break tests/matching/copy-paste across systems (e.g. fraction slash ⁄ or division slash ∕). Only / is allowed.

How to "fix it forever" (without code): two permanent guardrails

Stop storing "the symbol string" as truth.
Store base and quote separately as the Single Source of Truth (SSOT). Any label/symbol string is just a rendering.

Normalise at the borders, not in the middle.
Accept common inbound variants and normalise them immediately to the canonical internal form BASE/QUOTE. Examples of inbound variants to accept:
EURUSD, EUR-USD, EUR_USD, EUR:USD, EUR\USD, EUR/USD → normalise to EUR/USD
Then render UI labels from base + quote as BASE / QUOTE.

Implementation discipline:

Treat formatting as a single-source rule (one shared formatter used everywhere), so the UI, SSOT, and tests cannot drift apart.

AI Providers Leaderboard

Final design (target)
The final intended stack inside the centre column is:
FX Row (top) – N chips (driven by SSOT)
Commodities Row (middle) – 8 chips ✅ LIVE (Jan 12, 2026)
Crypto Row (bottom) – 8 chips ✅ LIVE (Jan 12, 2026)
AI Providers Leaderboard card

All three ribbon rows are now live and share identical architecture.

---

## 2.1 FX Row – Single Source of Truth (SSOT) Driven

The FX row is the first strip of the market belt, sitting inside the centre column above the AI Providers Leaderboard.

Core rule (hard rule)
The homepage FX row is entirely driven by:
C:\Users\Proma\Projects\promagen\frontend\src\data\fx\fx-pairs.json

This means:

- The ribbon does not hard-code "5" or "8" anywhere.
- The number of FX chips shown on the homepage is simply the number of entries you designate for the homepage in that JSON.
- To change the homepage FX set (count, order, orientation, paid/free defaults), you edit that single file only.

Default configuration (current)
The current homepage defaults are set to 8 FX chips. This is a content choice controlled in fx-pairs.json, not a UI limitation. You can increase or reduce the count freely by editing fx-pairs.json and the homepage will reflect it.

Chip contents
Each FX chip shows:
Pair label in BASE/QUOTE format (driven by the pair entry).
A compact status badge ("live", "cached", "—") depending on data availability.
A soft pill style: rounded corners, subtle border, dark background.

In addition (FX "alive" language):
A single green "winner arrow" may appear next to one side of the pair label, pointing at the currency that has strengthened over the look-back horizon.
The arrow never duplicates (never two arrows). It may move sides depending on which currency is winning.
Neutral pairs remain visually calm but still feel "alive" through micro-motion rules (defined later in this document).

Status meaning:
live → data is fresh from the primary fx.ribbon provider (no cross-provider fallback).
cached → data is served from cache within TTL (banner/tooltip shows "Cached • {age}").
— → data could not be retrieved (no valid cache). The chip remains in place, but values render as "—".

Orientation (no ribbon inversion)
The ribbon does not provide an "invert" control.
The direction displayed is the direction defined by the selected pair entry in fx-pairs.json.
If you want the opposite direction on the ribbon, you do it via SSOT (by selecting the opposite-direction pair entry if it exists in your catalogue, or by changing the configured entry according to your catalogue rules).

Layout behaviour (variable N)
The FX row uses a stable layout that supports any number of chips:

- Desktop: chips share the available width evenly (flex: 1) and remain visually consistent.
- Medium screens: chips compress but keep alignment.
- Small screens: the row can switch to wrapping or horizontal scroll (implementation choice), but the rule remains: render exactly what fx-pairs.json specifies, in SSOT order.

Paid tier behaviour (SSOT-first)
For paid users, the layout stays identical; the difference is the chosen FX set.
The paid selection (including count) is still expressed through SSOT-driven configuration so that the homepage remains "edit one file, see the site change".

---

## 2.2 Commodities Row – ✅ LIVE (Jan 12, 2026)

The Commodities row sits directly beneath the FX row in the centre column.

### Implementation Status: LIVE

The Commodities ribbon is now fully operational with identical architecture to FX.

### Structure (Current)

8 chips total, displaying key commodities:

- Precious metals: Gold (XAU/USD), Silver (XAG/USD)
- Energy: Brent Crude, WTI Crude, Natural Gas
- Agricultural: Coffee, Sugar
- Industrial metals: Copper

### SSOT

Commodities SSOT file: `frontend/src/data/commodities/commodities-catalog.json`

Each commodity entry includes:

- `id`: Unique identifier
- `symbol`: TwelveData symbol (e.g., "XAU/USD")
- `name`: Short name for API/display
- `ribbonLabel`: Full descriptive label for ribbon display (NEW - Jan 12, 2026)
- `unit`: Trading unit ("/oz", "/bbl", "/lb", etc.)
- `brandColor`: Hex color for visual identity

### RibbonLabel Field (NEW - Jan 12, 2026)

The `ribbonLabel` field provides full, descriptive names for ribbon display:

```json
{
  "id": "brent",
  "symbol": "BRENT",
  "name": "Brent",
  "ribbonLabel": "Brent Crude Oil",
  "unit": "/bbl",
  "brandColor": "#EF4444"
}
```

**Display logic:**

- Primary: Use `ribbonLabel` if present
- Fallback: Use `name` if `ribbonLabel` is missing
- Safety net: CSS `line-clamp-1` prevents overflow on long labels

### Brand Colors (Commodities)

Optimized for visibility on dark backgrounds:

| Commodity   | Color  | Hex     | Rationale                       |
| ----------- | ------ | ------- | ------------------------------- |
| Gold        | Gold   | #FFD700 | Traditional gold representation |
| Silver      | Silver | #C0C0C0 | Traditional silver              |
| Brent Crude | Red    | #EF4444 | Energy/oil association          |
| WTI Crude   | Orange | #F97316 | Distinguishes from Brent        |
| Natural Gas | Blue   | #3B82F6 | Gas flame association           |
| Coffee      | Red    | #DC2626 | Bold, visible on dark           |
| Sugar       | Purple | #A855F7 | Distinctive, avoids cream/white |
| Copper      | Orange | #F97316 | Copper metal tone               |

### Price Formatting

Commodities use `formatCommodityPrice()`:

```typescript
// Examples:
'$2,630.50 /oz'; // Gold, Silver
'$74.30 /bbl'; // Oil
'$2.85 /lb'; // Coffee
```

Format: `${currencySymbol}${formattedPrice} ${unit}`

### Calming Architecture

Commodities use identical calming to FX:

- Gateway endpoint: `/commodities`
- Frontend API route: `/api/commodities`
- Frontend hook: `use-commodities-quotes.ts`
- TTL: 1800 seconds (30 minutes)
- Cache key: `commodities:ribbon:all`

### API Timing Stagger

Commodities refresh at **:10 and :40** (10-minute offset from FX):

```
FX:          :00, :30 (base)
Commodities: :10, :40 (10-min offset) ←
Crypto:      :20, :50 (20-min offset)
```

### Rich Tooltip (NEW - Jan 12, 2026)

Hovering a commodity chip displays a rich tooltip with:

- Full commodity name (from `ribbonLabel`)
- Historical data (year established, interesting fact)
- Brand color glow effect

See §2.5 Rich Tooltip Implementation for details.

### Free tier

Fixed 8-item set, defined in SSOT.

### Paid tier (target)

Paid users can tune composition (still 8 total to keep the belt visually stable).

---

## 2.3 Crypto Row – ✅ LIVE (Jan 12, 2026)

Crypto row sits beneath Commodities in the final layout.

### Implementation Status: LIVE

The Crypto ribbon is now fully operational with identical architecture to FX and Commodities.

### Structure (Current)

8 chips total, displaying major cryptocurrencies:

- Bitcoin (BTC)
- Ethereum (ETH)
- XRP
- Solana (SOL)
- Cardano (ADA)
- Stellar (XLM)
- Cosmos (ATOM)
- Aptos (APT)

### SSOT

Crypto SSOT file: `frontend/src/data/crypto/crypto-catalog.json`

Each crypto entry includes:

- `id`: Unique identifier
- `symbol`: TwelveData symbol (e.g., "BTC/USD")
- `name`: Short name for display
- `ribbonLabel`: Full descriptive label for ribbon display (NEW - Jan 12, 2026)
- `brandColor`: Hex color for visual identity
- `yearFounded`: Year the cryptocurrency was launched
- `founder`: Creator/founder name(s)
- `fact`: Interesting historical fact

### RibbonLabel Field (NEW - Jan 12, 2026)

The `ribbonLabel` field provides full names for ribbon display:

```json
{
  "id": "btc",
  "symbol": "BTC/USD",
  "name": "BTC",
  "ribbonLabel": "Bitcoin",
  "brandColor": "#F7931A",
  "yearFounded": 2009,
  "founder": "Satoshi Nakamoto",
  "fact": "First decentralized cryptocurrency"
}
```

### Brand Colors (Crypto)

Optimized for visibility on dark backgrounds:

| Crypto   | Color  | Hex     | Rationale                      |
| -------- | ------ | ------- | ------------------------------ |
| Bitcoin  | Orange | #F7931A | Official Bitcoin brand color   |
| Ethereum | Purple | #627EEA | Official Ethereum brand color  |
| XRP      | Green  | #22C55E | Vibrant (was dark silver)      |
| Solana   | Purple | #9945FF | Official Solana brand color    |
| Cardano  | Blue   | #0033AD | Official Cardano brand color   |
| Stellar  | Teal   | #14B8A6 | Vibrant (was black, invisible) |
| Cosmos   | Indigo | #6366F1 | Vibrant (was dark blue)        |
| Aptos    | Cyan   | #06B6D4 | Vibrant (was black, invisible) |
| NEAR     | Green  | #00EC97 | Vibrant (was black, invisible) |
| Algorand | Mint   | #00D4A4 | Vibrant (was black, invisible) |

**Important:** Several crypto brand colors were updated on Jan 12, 2026 because the official brand colors (often black or very dark) were invisible on the dark ribbon background.

### Price Formatting

Crypto uses `formatCryptoPrice()`:

```typescript
// Examples:
'$92,098.00 ea'; // Bitcoin
'$3,245.67 ea'; // Ethereum
'$2.34 ea'; // XRP
```

Format: `${currencySymbol}${formattedPrice} ea`

### Calming Architecture

Crypto uses identical calming to FX:

- Gateway endpoint: `/crypto`
- Frontend API route: `/api/crypto`
- Frontend hook: `use-crypto-quotes.ts`
- TTL: 1800 seconds (30 minutes)
- Cache key: `crypto:ribbon:all`

### API Timing Stagger

Crypto refreshes at **:20 and :50** (20-minute offset from FX):

```
FX:          :00, :30 (base)
Commodities: :10, :40 (10-min offset)
Crypto:      :20, :50 (20-min offset) ←
```

### Rich Tooltip (NEW - Jan 12, 2026)

Hovering a crypto chip displays a rich tooltip with:

- Full cryptocurrency name (from `ribbonLabel`)
- Year founded
- Founder/creator
- Historical fact
- Brand color glow effect

See §2.5 Rich Tooltip Implementation for details.

### Free tier

Fixed 8-item set, defined in SSOT.

### Paid tier (target)

Still 8 total to preserve vertical rhythm.
User can swap in other coins from the crypto catalogue via SSOT-driven configuration.

---

## 2.4 Belt Spacing & Alignment

The three rows (FX, Commodities, Crypto) are considered one stacked unit inside the centre column.

Row spacing
A consistent top and bottom spacing token is used between rows (e.g. 0.75rem or 1rem).
On mobile, the spacing can be slightly increased to keep rows visually separated when stacked with the AI Providers card.

Alignment
All rows left-align with the centre column grid, so chips line up neatly with the AI Providers card below.

---

## 2.5 Rich Tooltip Implementation (NEW - Jan 12, 2026)

All three ribbon types (FX, Commodities, Crypto) now feature rich tooltips that display contextual information on hover.

### Component

File: `src/components/ui/rich-tooltip.tsx`

### Features

- **Edge-aware positioning**: Tooltips automatically adjust when near screen edges
- **Brand color glow**: Subtle glow effect using the asset's brand color
- **Historical data**: Year founded, founder, interesting facts
- **Clean design**: No arrow (removed for cleaner aesthetic)
- **High z-index**: z-index 9999 ensures tooltip appears above all content

### Edge Detection (Symmetric Thresholds)

```typescript
const LEFT_EDGE_THRESHOLD = 0.35; // 35% from left edge
const RIGHT_EDGE_THRESHOLD = 0.35; // 35% from right edge

// Position logic:
// - If trigger is in left 35%: align tooltip to left edge of trigger
// - If trigger is in right 35%: align tooltip to right edge of trigger
// - Otherwise: center tooltip on trigger
```

### Visual Styling

```css
/* Tooltip container */
background: rgba(23, 23, 23, 0.98);
border: 1px solid rgba(255, 255, 255, 0.1);
border-radius: 8px;
padding: 12px 16px;
z-index: 9999;

/* Brand color glow */
filter: drop-shadow(0 0 8px ${brandColor}40);
```

### Content Structure (Crypto Example)

```
┌─────────────────────────────────┐
│ Bitcoin                          │  ← ribbonLabel (bold)
│ Founded: 2009                    │  ← yearFounded
│ Founder: Satoshi Nakamoto        │  ← founder
│ First decentralized cryptocurrency│ ← fact
└─────────────────────────────────┘
     [brand color glow: #F7931A]
```

### Content Structure (Commodities Example)

```
┌─────────────────────────────────┐
│ Brent Crude Oil                  │  ← ribbonLabel (bold)
│ Global benchmark for oil pricing │  ← fact/description
└─────────────────────────────────┘
     [brand color glow: #EF4444]
```

### Line-Clamp Safety Net

Long labels use CSS line-clamp as a safety net:

```css
.ribbon-label {
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
```

---

## 2.6 API Timing Stagger (NEW - Jan 12, 2026)

To prevent simultaneous API calls that would exceed TwelveData's per-minute rate limit, each ribbon refreshes at staggered intervals.

### Schedule

```
Hour timeline (repeats every hour):
┌────┬────┬────┬────┬────┬────┬────┐
│:00 │:10 │:20 │:30 │:40 │:50 │:00 │
├────┼────┼────┼────┼────┼────┼────┤
│ FX │COM │CRY │ FX │COM │CRY │ FX │
└────┴────┴────┴────┴────┴────┴────┘

FX:          Minutes 0 and 30 (base schedule)
Commodities: Minutes 10 and 40 (10-minute offset)
Crypto:      Minutes 20 and 50 (20-minute offset)
```

### Rationale

- TwelveData has a per-minute rate limit of 8 credits
- Each ribbon refresh uses 8 credits (8 symbols × 1 credit each)
- Without stagger: 3 ribbons × 8 = 24 credits at :00 and :30 → **rate limited**
- With stagger: 8 credits at each slot → **safe**

### Implementation

Each hook calculates the time until its next refresh slot:

```typescript
// use-commodities-quotes.ts
function getMsUntilNextCommoditiesSlot(): number {
  const now = new Date();
  const minute = now.getMinutes();
  const targets = [10, 40]; // Commodities refresh slots

  let best = targets[0] + 60 - minute;
  for (const t of targets) {
    const delta = t - minute;
    if (delta > 0 && delta < best) best = delta;
  }

  return Math.max(1000, best * 60_000 - now.getSeconds() * 1000);
}

// use-crypto-quotes.ts
function getMsUntilNextCryptoSlot(): number {
  const now = new Date();
  const minute = now.getMinutes();
  const targets = [20, 50]; // Crypto refresh slots
  // ... same calculation
}
```

### Comments in Code

Container components document the schedule:

```typescript
// Refresh schedule (coordinated with FX and Commodities):
// - FX:          :00, :30 (base)
// - Commodities: :10, :40 (10 min offset)
// - Crypto:      :20, :50 (20 min offset)
```

---

## 2.7 Removed Features (Jan 12, 2026)

### Pause Button ❌ REMOVED

The global "Calm Mode" pause button has been **removed** from all ribbon containers.

**What was removed:**

- Pause button component from ribbon containers
- `useLiveStatus` hook references in ribbons
- "Calm mode" terminology from UI

**Rationale:**

- Analytics showed near-zero user engagement with pause functionality
- Ribbons already respect `prefers-reduced-motion` automatically
- Visibility backoff (6x when tab hidden) handles idle scenarios
- Simplifies ribbon UI to focus on data display

**What remains (motion control still works):**

- `prefers-reduced-motion` CSS media query support
- Visibility-aware polling backoff
- Individual chip animations (subtle, non-intrusive)

### Emoji Budget Indicator ❌ REMOVED

The emoji budget indicator (🛫/🏖️/🧳) that appeared beside the pause button has been **removed**.

**What was removed:**

- `emoji-bank.json` budget_guard group
- Budget emoji rendering in ribbon containers
- Budget state passthrough in API responses (meta.budget.emoji removed)

**Rationale:**

- Added visual clutter to a clean ribbon design
- Budget state is operational concern, not user-facing
- Monitoring via `/health` and `/trace` endpoints is sufficient
- Conflicts with the minimal, professional ribbon aesthetic

**What remains (budget protection still works):**

- Server-side budget tracking (unchanged)
- Budget warnings/blocks in gateway logs (unchanged)
- `/health` endpoint budget status (unchanged)
- Automatic graceful degradation when budget is exhausted

---

## 2.8 Support Icons Implementation (Updated Jan 18, 2026)

The Support column displays clickable social media icons for each AI provider, replacing the static Visual Styles text.

### Component

File: `src/components/providers/support-icons-cell.tsx`

### Type Definition

File: `src/types/providers.ts`

```typescript
/**
 * Social media links for a provider.
 * Only official accounts - all fields are optional.
 *
 * Platform order in UI:
 * LinkedIn → Instagram → Facebook → YouTube → Discord → Reddit → TikTok → Pinterest → X
 */
export type ProviderSocials = {
  linkedin?: string;
  instagram?: string;
  facebook?: string;
  youtube?: string;
  discord?: string;
  reddit?: string;
  tiktok?: string;
  pinterest?: string; // NEW Jan 18, 2026
  x?: string; // NEW Jan 18, 2026
};
```

### SSOT

Data source: `src/data/providers/providers.json`

Each provider has an optional `socials` field:

```json
{
  "id": "canva",
  "name": "Canva Magic Media",
  "socials": {
    "linkedin": "https://www.linkedin.com/company/canva/",
    "instagram": "https://www.instagram.com/canva/",
    "facebook": "https://www.facebook.com/canva/",
    "youtube": "https://www.youtube.com/@Canva",
    "tiktok": "https://www.tiktok.com/@canva",
    "x": "https://x.com/canva",
    "pinterest": "https://au.pinterest.com/canva/"
  }
}
```

### Platform Display Order

Icons always render in this fixed order (if present):

| Position | Platform  | Notes                        |
| -------- | --------- | ---------------------------- |
| 1        | LinkedIn  | Professional networking      |
| 2        | Instagram | Visual social                |
| 3        | Facebook  | General social               |
| 4        | YouTube   | Video content                |
| 5        | Discord   | Community chat               |
| 6        | Reddit    | Community forums             |
| 7        | TikTok    | Short-form video             |
| 8        | Pinterest | Visual discovery (NEW)       |
| 9        | X         | Twitter/X (NEW, always last) |

### Brand Colors

Each platform uses its official brand color (vibrant, full color — never greyscale):

| Platform  | Label     | Hex       | Visual                     | Glow Color              |
| --------- | --------- | --------- | -------------------------- | ----------------------- |
| LinkedIn  | LinkedIn  | `#0A66C2` | 🔵 Professional blue       | `#0A66C2`               |
| Instagram | Instagram | `#E4405F` | 🔴 Gradient pink/red       | `#E4405F`               |
| Facebook  | Facebook  | `#1877F2` | 🔵 Facebook blue           | `#1877F2`               |
| YouTube   | YouTube   | `#FF0000` | 🔴 YouTube red             | `#FF0000`               |
| Discord   | Discord   | `#5865F2` | 🟣 Blurple                 | `#5865F2`               |
| Reddit    | Reddit    | `#FF4500` | 🟠 Reddit orange           | `#FF4500`               |
| TikTok    | TikTok    | `#00F2EA` | 🔵 Cyan/teal               | `#00F2EA`               |
| Pinterest | Pinterest | `#E60023` | 🔴 Pinterest red (NEW)     | `#E60023`               |
| X         | X         | `#FFFFFF` | ⚪ White with dark outline | `rgba(255,255,255,0.6)` |

### X/Twitter Icon Visibility

The X icon requires special treatment for dark background visibility:

```typescript
// X Icon uses white fill with dark outline for contrast
function XIcon({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      {/* Dark outline for contrast on dark backgrounds */}
      <path
        d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"
        fill="none"
        stroke="rgba(0,0,0,0.6)"
        strokeWidth="1.5"
      />
      {/* White fill on top */}
      <path
        d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"
        fill={color}
      />
    </svg>
  );
}
```

**Key decisions for X icon:**

- White (`#FFFFFF`) matches X's own dark mode branding
- Dark outline (`rgba(0,0,0,0.6)`) provides contrast on dark backgrounds
- Subtle white glow on hover: `rgba(255,255,255,0.6)`

### Icon Specifications

| Property        | Value            | Notes                            |
| --------------- | ---------------- | -------------------------------- |
| Size            | 18×18px          | 1.5× the 12px flag size          |
| Gap             | 8px (0.5rem)     | Between icons                    |
| Row gap         | 4px (0.25rem)    | Between rows when 2-row layout   |
| Color           | Full brand color | Never greyscale                  |
| Default opacity | 70%              | Slightly dimmed when not hovered |
| Hover opacity   | 100%             | Full brightness on hover         |
| Hover scale     | 1.15             | Subtle growth on hover           |
| Hover glow      | drop-shadow      | Platform color glow              |
| Transition      | 200ms ease       | Smooth hover transitions         |

### 2-Row Layout (Smart Wrapping)

When a provider has 5 or more social icons, the cell splits into two rows to prevent horizontal overflow:

```
THRESHOLD: More than 4 icons triggers 2-row layout

Single row (≤4 icons):
┌──────────────────────────────────┐
│ [in] [📷] [f] [▶]                │  ← All tooltips open ABOVE
└──────────────────────────────────┘

Two rows (5+ icons):
┌──────────────────────────────────┐
│ [in] [📷] [f] [▶]                │  ← Row 1: First 4, tooltips ABOVE ↑
│ [🎮] [♪] [📌] [X]                │  ← Row 2: Remaining, tooltips BELOW ↓
└──────────────────────────────────┘
```

**Implementation:**

```typescript
const ICONS_PER_ROW = 4;

const needsTwoRows = activePlatforms.length > ICONS_PER_ROW;

if (!needsTwoRows) {
  // Single row - all tooltips open above
  return (
    <div className="support-icons-cell flex items-center gap-2">
      {activePlatforms.map((platform) => (
        <SocialIconLink ... tooltipDirection="above" />
      ))}
    </div>
  );
}

// Two rows layout
const row1Platforms = activePlatforms.slice(0, ICONS_PER_ROW);  // First 4 icons
const row2Platforms = activePlatforms.slice(ICONS_PER_ROW);     // Remaining icons

return (
  <div className="support-icons-cell flex flex-col gap-1">
    {/* Row 1: tooltips open ABOVE */}
    <div className="flex items-center gap-2">
      {row1Platforms.map((platform) => (
        <SocialIconLink ... tooltipDirection="above" />
      ))}
    </div>
    {/* Row 2: tooltips open BELOW */}
    <div className="flex items-center gap-2">
      {row2Platforms.map((platform) => (
        <SocialIconLink ... tooltipDirection="below" />
      ))}
    </div>
  </div>
);
```

**Providers affected by 2-row layout:**

| Provider           | Total Icons | Row 1                                  | Row 2                |
| ------------------ | ----------- | -------------------------------------- | -------------------- |
| Canva              | 7           | LinkedIn, Instagram, Facebook, YouTube | TikTok, X, Pinterest |
| Adobe Firefly      | 6           | LinkedIn, Instagram, Facebook, YouTube | TikTok, X            |
| Microsoft Designer | 6           | LinkedIn, Instagram, Facebook, YouTube | TikTok, X            |
| Imagine (Meta)     | 6           | LinkedIn, Instagram, Facebook, YouTube | TikTok, X            |
| Google Imagen      | 6           | LinkedIn, Instagram, Facebook, YouTube | TikTok, X            |
| Leonardo AI        | 6           | LinkedIn, Instagram, Facebook, YouTube | Discord, X           |

### Tooltip Implementation

Tooltips display "{Provider} on {Platform}" with platform-colored glow:

```typescript
function SocialIconLink({
  platform,
  url,
  providerName,
  tooltipDirection = 'above',
}: {
  platform: keyof ProviderSocials;
  url: string;
  providerName: string;
  tooltipDirection?: 'above' | 'below';
}) {
  const tooltipText = `${providerName} on ${label}`;
  // Example: "Midjourney on Discord"

  // Tooltip positioning based on direction
  const tooltipPositionClasses = tooltipDirection === 'above'
    ? 'bottom-full mb-2'  // Opens above
    : 'top-full mt-2';    // Opens below

  // Arrow positioning based on direction
  const arrowClasses = tooltipDirection === 'above'
    ? 'top-full border-t-slate-900'  // Arrow points down (tooltip above)
    : 'bottom-full border-b-slate-900'; // Arrow points up (tooltip below)

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" ...>
      <span className="support-icon-wrapper" style={{
        opacity: isHovered ? 1 : 0.7,
        transform: isHovered ? 'scale(1.15)' : 'scale(1)',
        filter: isHovered
          ? `drop-shadow(0 0 4px ${iconGlowRgba}) drop-shadow(0 0 8px ${iconGlowRgba})`
          : 'none',
      }}>
        <IconComponent size={18} color={color} />
      </span>

      {/* Tooltip with platform-colored glow */}
      {isHovered && (
        <span
          className={`absolute left-1/2 -translate-x-1/2 ${tooltipPositionClasses} ...`}
          style={{
            boxShadow: `0 0 8px ${tooltipGlowRgba}, 0 0 16px ${tooltipGlowRgba}`,
            border: `1px solid ${hexToRgba(glowColor, 0.3)}`,
          }}
        >
          {tooltipText}
          <span className={`absolute left-1/2 -translate-x-1/2 ${arrowClasses} ...`} />
        </span>
      )}
    </a>
  );
}
```

### Empty State

Providers without any social links render a single em-dash:

```tsx
if (activePlatforms.length === 0) {
  return <span className="text-slate-500">—</span>;
}
```

This is intentionally informative — an empty cell tells users the provider has limited community/support reach.

### Hover Behavior Summary

| State   | Opacity | Scale | Glow                | Tooltip |
| ------- | ------- | ----- | ------------------- | ------- |
| Default | 70%     | 1.0   | None                | Hidden  |
| Hover   | 100%    | 1.15  | Platform color glow | Visible |

### CSS Classes

```css
/* Container - single row */
.support-icons-cell {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

/* Container - two rows */
.support-icons-cell.two-rows {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

/* Individual icon link */
.support-icon-link {
  display: inline-flex;
  position: relative;
  transition: transform 0.2s ease-out;
}

.support-icon-link:focus {
  outline: 2px solid rgba(99, 102, 241, 0.5);
  outline-offset: 2px;
  border-radius: 4px;
}

/* Icon wrapper with hover effects */
.support-icon-wrapper {
  transition: all 0.2s ease;
}

/* Reduced motion support */
@media (prefers-reduced-motion: reduce) {
  .support-icon-link,
  .support-icon-wrapper {
    transition: none;
  }
  .support-icon-wrapper {
    filter: none !important;
    transform: none !important;
  }
}
```

### Accessibility

- Each icon is wrapped in an `<a>` element
- `aria-label` provides full context: `"{Provider} on {Platform}"`
- `target="_blank"` opens in new tab
- `rel="noopener noreferrer"` for security
- Focus ring visible on keyboard navigation
- Respects `prefers-reduced-motion` media query
- Tooltips positioned to avoid viewport clipping (above/below based on row)

### Data Coverage (Jan 18, 2026)

| Metric                      | Count |
| --------------------------- | ----- |
| Total providers             | 42    |
| Providers with X (Twitter)  | 37    |
| Providers with Pinterest    | 1     |
| Providers with no X account | 5     |

**Providers without X account:**

- MyEdit
- Artistly
- Hotpot.ai
- Pixlr
- PicWish

**Provider with Pinterest:**

- Canva (`https://au.pinterest.com/canva/`)

### X URLs by Provider (Complete List)

| Provider           | X URL                           |
| ------------------ | ------------------------------- |
| Midjourney         | `https://x.com/midjourney`      |
| OpenAI             | `https://x.com/openai`          |
| Flux               | `https://x.com/bfl_ml`          |
| Leonardo           | `https://x.com/LeonardoAi_`     |
| Google Imagen      | `https://x.com/GoogleAI`        |
| Runway             | `https://x.com/runwayml`        |
| Stability          | `https://x.com/StabilityAI`     |
| DreamStudio        | `https://x.com/StabilityAI`     |
| Adobe Firefly      | `https://x.com/Adobe`           |
| Ideogram           | `https://x.com/ideogram_ai`     |
| Playground         | `https://x.com/playgroundai`    |
| Microsoft Designer | `https://x.com/Microsoft`       |
| Imagine (Meta)     | `https://x.com/Meta`            |
| NovelAI            | `https://x.com/novelaiofficial` |
| Clipdrop           | `https://x.com/clipdropapp`     |
| Photoleap          | `https://x.com/PhotoleapApp`    |
| Lexica             | `https://x.com/lexica_art`      |
| OpenArt            | `https://x.com/openart_ai`      |
| Jasper Art         | `https://x.com/heyjasperai`     |
| 123RF              | `https://x.com/123rf`           |
| Freepik            | `https://x.com/freepik`         |
| Getimg             | `https://x.com/getimg_ai`       |
| Canva              | `https://x.com/canva`           |
| ArtGuru            | `https://x.com/ArtGuruOfficial` |
| Artbreeder         | `https://x.com/Artbreeder`      |
| Bing               | `https://x.com/Microsoft`       |
| Simplified         | `https://x.com/sosimplified`    |
| NightCafe          | `https://x.com/NightCafeStudio` |
| BlueWillow         | `https://x.com/BlueWillow_AI`   |
| Picsart            | `https://x.com/picsart`         |
| Dreamlike          | `https://x.com/dreamlike_art`   |
| VistaCreate        | `https://x.com/VistaCreate`     |
| Visme              | `https://x.com/VismeApp`        |
| Fotor              | `https://x.com/Fotor20`         |
| Remove.bg          | `https://x.com/remove_bg`       |
| DeepAI             | `https://x.com/DeepAI`          |
| Craiyon            | `https://x.com/craiyonAI`       |

### Data Verification

Social links sourced from official provider pages (verified Jan 18, 2026):

- ✅ All URLs manually verified against official websites
- ✅ "Not found" entries in source data render as no icon
- ✅ Corporate parent socials used where product is subsidiary (e.g., Adobe Firefly uses Adobe socials)
- ✅ X URLs verified for 37 providers
- ✅ Pinterest URL verified for Canva

---

Left & Right Exchange Rails

The left and right rails host exchange cards. These cards frame the centre belt and leaderboard.

Rail content (conceptual)
Left rail: a vertical list of small cards (e.g. exchanges / markets).
Right rail: another vertical list of small cards, mirroring the left.

Each card might show:
Exchange name
Open/closed state
Local time
Simple status icon.

Visual treatment
Cards are small, neat, and stack vertically with minimal gap.
They share visual language with the belt (rounded corners, soft borders, dark background) but are clearly distinct blocks.

Behaviour
On wide screens: rails are visible and vertically scrollable as needed.
On smaller screens: the rails collapse into the main column stack above and below the belt + leaderboard or via a "More exchanges" accordion.

### Exchange Card Structure (Updated Jan 13, 2026)

Each exchange card displays a two-section layout:

```
┌─────────────────────────────────────────────────────────────────────┐
│  TOP SECTION: 3-column grid (50%/25%/25%)                           │
├─────────────────────────────────────────────────────────────────────┤
│  Exchange Name (ribbonLabel)  │  LED Clock  │  Temperature          │
│  City + Flag                  │  ● Status   │  Weather Emoji        │
├─────────────────────────────────────────────────────────────────────┤
│  BOTTOM SECTION: Index Row (full width)                             │
│  Index Name                           Price  ▲ +Change (+Percent)   │
└─────────────────────────────────────────────────────────────────────┘
```

**Top Section (3-column grid):**

| Column | Width | Content                                      |
| ------ | ----- | -------------------------------------------- |
| Left   | 50%   | Exchange name (ribbonLabel), City + Flag     |
| Centre | 25%   | LED Clock, Market Status (● Open / ○ Closed) |
| Right  | 25%   | Temperature (°C), Weather condition emoji    |

**Bottom Section (Index Row):**

The index row displays the exchange's benchmark index with live market data:

| Element    | Position | Content                                                                  |
| ---------- | -------- | ------------------------------------------------------------------------ |
| Index Name | Left     | From catalog `marketstack.indexName` (e.g., "Nikkei 225")                |
| Price      | Right    | Current value with thousands separators (e.g., "38,945.72")              |
| Change     | Right    | Direction arrow + absolute change + percent (e.g., "▲ +312.45 (+0.81%)") |

**Index Row States:**

1. **Loading (No API data yet):**
   - Index name visible (from catalog SSOT)
   - Price shows animated `···` placeholder
2. **Live (API data available):**
   - Full display: "Nikkei 225 38,945.72 ▲ +312.45 (+0.81%)"
   - Up: ▲ green (`text-emerald-400`)
   - Down: ▼ red (`text-rose-400`)
   - Flat: • grey (`text-slate-400`)

3. **Error (API failed):**
   - Same as loading state (graceful degradation)
   - Index name still visible, price shows `···`

**Key Design Principle:** The index row is ALWAYS visible. The index name comes from the catalog (SSOT), so it appears immediately on page load. Only the price/change data waits for the API response. This prevents the card from "growing" when data arrives.

**Data Source:**

- Index name: `exchanges.catalog.json` → `marketstack.indexName`
- Price/change: Gateway `/indices` → Marketstack API
- Refresh: Every 30 minutes at :05 and :35 (staggered from other feeds)

**Component Files:**

- `src/components/exchanges/exchange-card.tsx` — ExchangeCard, IndexRowWithData, IndexRowSkeleton
- `src/components/exchanges/types.ts` — IndexQuoteData, ExchangeCardData.indexName
- `src/components/exchanges/adapters.ts` — toCardData() passes indexName from catalog

### Exchange Card Hover Effect (Warm Glow)

Each exchange has a unique `hoverColor` in the catalog. On hover:

- Border: glows with exchange color at 50% opacity
- Box shadow: layered glow effect (40px outer, 80px soft, inset accent)
- Radial gradient overlays: top and bottom ethereal accents
- Transition: 200ms ease-out

This matches the RichTooltip glow effect for visual consistency.

Paid-tier exchange rail rules (homepage side-rails)

### Synchronized Rail Scrolling (Implemented Dec 31, 2025)

The left and right exchange rails scroll in perfect sync. When the user scrolls either rail, both rails move together.

**Behavior:**

- Scroll left rail → right rail moves in sync
- Scroll right rail → left rail moves in sync
- Providers table scrolls independently (not synced to rails)
- Sync uses scroll percentage, not absolute pixels (handles different content heights)

**Technical Implementation:**

- `HomepageGrid` is a client component (`'use client'`)
- Uses `useRef` for scroll container references
- Percentage-based sync algorithm:
  1. Calculate scroll percentage from source container
  2. Apply same percentage to target container
  3. `requestAnimationFrame` prevents infinite loops
  4. `isSyncing` ref guard prevents recursive scroll events

**When Scrolling Activates:**

- Rails only scroll when content exceeds container height
- If all exchange cards fit in the viewport, no scrollbar appears
- `overflow-y: auto` — scrollbar appears only when needed

**Scrollbar Styling:**

- Width: 6px (thin, unobtrusive)
- Track: transparent
- Thumb: white at 20% opacity, 30% on hover
- Firefox fallback: `scrollbar-width: thin`

Authority (SSOT): `C:\Users\Proma\Projects\promagen\docs\authority\paid_tier.md`

Paid users can control:

- Reference frame (two options only): my location OR Greenwich (London / 0°). No other time zones exist.
- Exchange selection (which exchanges are shown).
- Exchange count: any integer from **6 to 16** (odd or even).

Ordering rule (hard rule, never overridden):

- Take the chosen set and sort by homeLongitude so the whole page reads east → west.
- Split evenly into two halves.
- Left rail shows the first half top-to-bottom (east → west).
- Right rail shows the second half top-to-bottom in reverse order so that, when you scan left-to-right, the full layout reads east → west.

Free tier uses the baked-in default rail set and count; the visual layout remains identical, only the content set differs.

AI Providers Leaderboard – Centre Column

Directly under the market belt sits the AI Providers Leaderboard card.

Table structure

Header: "AI Providers Leaderboard".

Columns (left → right):

- Provider (official icon + name; optional muted rank prefix; flag + city + HH:MM clock; click opens provider detail)
- Promagen Users (top up to 6 country flags + counts; 2·2·2 layout; render nothing if zero; overflow becomes "… +n")
- Image Quality (ordinal rank: 1st, 2nd, 3rd, etc. + vote button — derived from imageQualityRank field)
- Support (social media icons with glowing tooltips — NEW Jan 18, 2026; replaces Visual Styles)
- API/Affiliate (🔌 / 🤝 / 🔌🤝; blank = unknown/not set)
- Overall Score (0–100; far right; trend indicator inline — no separate Trend column; no Tags column)

  Final header row

Provider | Promagen Users | Image Quality | Support | API/Affiliate | Overall Score ▼

Column definitions (in this exact order)

1. Provider

Three-line layout per cell (updated Jan 1, 2026):

**Line 1:** Rank prefix + Provider name (hyperlinked) + Provider icon (PNG)

- Rank: muted prefix ("1.", "2.", etc.)
- Name: hyperlinked to `/go/{id}?src=leaderboard_homepage` → opens provider website in new tab
- Icon: local PNG from `/icons/providers/{id}.png` (18×18px), also hyperlinked to homepage
  - Fallback: `fallback.png` on load error
  - Exception: DreamStudio uses 🏠 emoji

**Line 2:** Flag + City

- Country flag (16px) from `countryCode`
- HQ city from `hqCity`

**Line 3:** Clock + Prompt builder link

- Live clock from `timezone` field
- 🎨 + "Prompt builder" (cyan text), links to `/providers/{id}/prompt-builder`

2. Promagen Users

Top up to 6 countries by Promagen usage **for that provider** (this is per provider row, not a global total).

Hard truth rules

- Show only what is true (analytics-derived).
- If the provider has zero users, render an empty cell (no "0", no dashes, no placeholders).
- If the provider's aggregate is stale (updatedAt older than 48 hours), render an empty cell and log a warning (so Vercel logs show it).
- If a provider has only 1–2 countries with usage, show only those (do not render empty slots).

Layout (fixed; the cell may grow in height and that is expected)

- Display up to 6 countries in a 2·2·2 layout:
  - Row 1: 2 countries
  - Row 2: 2 countries
  - Row 3: 2 countries
- Keep each country block compact with a small gap between blocks.
- Do not allow country blocks to wrap within a row.
- If there are more than 6 countries, show the top 6 plus a trailing "… +n"
  (where n = additional countries not shown).

Format (per country block)

- Flag + space + Roman numeral count
  Example:
  🇩🇪 I 🇬🇧 II
  🇺🇸 X 🇫🇷 IV
  🇪🇸 III 🇯🇵 I

3. Image Quality

Display: ordinal rank (1st, 2nd, 3rd, etc.) + vote button

- Top 3 show medal emoji: 🥇 🥈 🥉
- Vote button allows community voting (see voting rules in community documentation)

4. Support (NEW - Jan 18, 2026)

**Replaces:** Visual Styles column (removed)

**Purpose:** Actionable social media links answering "How do I get help or follow this provider?"

**Display:** Row of clickable social media icons (7 platforms supported)

| Platform  | Icon Color | Brand Hex |
| --------- | ---------- | --------- |
| LinkedIn  | Blue       | #0A66C2   |
| Instagram | Pink/Red   | #E4405F   |
| Facebook  | Blue       | #1877F2   |
| YouTube   | Red        | #FF0000   |
| Discord   | Purple     | #5865F2   |
| Reddit    | Orange     | #FF4500   |
| TikTok    | Cyan       | #00F2EA   |

**Icon specifications:**

- Size: 18×18px (1.5× the 12px flag size)
- Color: Always full brand color (never greyscale)
- Hover: Glows brighter via `drop-shadow` + scale(1.15)
- Click: Opens official page in new tab (`target="_blank"`)

**Tooltip:**

- Format: `{Provider} on {Platform}` (e.g., "Midjourney on Discord")
- Style: Glowing colorful tooltip matching crypto/commodities rich tooltips
- Glow color: Uses platform's brand color
- Background: `rgba(15, 23, 42, 0.97)` with brand-color border
- Box-shadow: Multi-layer glow effect

**Empty state:**

- Providers without any social links show "—" (em-dash)
- This is informative: tells user the provider has limited community reach

**Data source:** `socials` field in `providers.json`

```json
{
  "id": "midjourney",
  "socials": {
    "instagram": "https://www.instagram.com/midjourney/",
    "discord": "https://discord.gg/midjourney"
  }
}
```

**Coverage (as of Jan 18, 2026):**

- 28 providers have at least one social link
- 14 providers have no social links (shows "—")

**Example coverage by provider:**

| Provider      | LinkedIn | Instagram | Facebook | YouTube | Discord | Reddit | TikTok |
| ------------- | -------- | --------- | -------- | ------- | ------- | ------ | ------ |
| Midjourney    | —        | ✅        | —        | —       | ✅      | —      | —      |
| OpenAI        | ✅       | ✅        | —        | ✅      | —       | —      | —      |
| Google Imagen | ✅       | ✅        | ✅       | ✅      | —       | —      | ✅     |
| Stability AI  | ✅       | —         | —        | —       | ✅      | —      | —      |
| Leonardo      | —        | —         | —        | —       | —       | —      | —      |
| Adobe Firefly | ✅       | ✅        | ✅       | ✅      | —       | —      | ✅     |
| Canva         | ✅       | ✅        | ✅       | ✅      | —       | —      | ✅     |

**Why this replaces Visual Styles:**

| Aspect          | Visual Styles (old) | Support (new)                   |
| --------------- | ------------------- | ------------------------------- |
| Actionable?     | ❌ No (dead text)   | ✅ Yes — click to follow        |
| Scannable?      | ❌ Requires reading | ✅ Icons are instant            |
| Differentiates? | ⚠️ Weakly           | ✅ Discord presence matters!    |
| Width needed    | ~200px              | ~100px                          |
| User value      | Low                 | High — "How do I contact them?" |

**Accessibility:**

- Each icon wrapped in `<a>` with `aria-label="{Provider} on {Platform}"`
- Focus ring: 2px indigo outline
- Respects `prefers-reduced-motion` (disables scale/glow animations)

5. API/Affiliate

Emoji indicators (single cell):

- 🔌 = API available
- 🤝 = Affiliate program
- 🔌🤝 = Both
- Blank = unknown/not set

6. Overall Score

0–100 score, far right column.
Trend indicator inline (not a separate column).

---

## 6.1 Typography

Primary font: Inter (variable, very clean and neutral).
Size hierarchy:
Belt chip labels ≥ 11.5px (hard rule, never smaller).
Leaderboard provider name: normal body size.
Leaderboard secondary text (city, time): small but legible.

Case style:
Belt labels: uppercase 3-letter codes (ISO 4217) and explicit "/" separators.
Leaderboards: standard sentence case in most columns, with perhaps a strong uppercase for headers.

## 6.2 Colour

Base page: near-black to very dark grey gradient.
Chips: dark grey background, slightly lighter border.
Text: primarily off-white.
Accents:
Green for "up / positive / winning" signals (e.g. arrows, positive trend).
Soft red or amber for "down / negative" if needed, but avoid flooding the UI with red.
Category tags can use subtle differentiated hues (FX vs Commodities vs Crypto).

### Brand Colors by Asset Type (NEW - Jan 12, 2026)

**FX:** No brand colors (uses standard chip styling)

**Commodities:** See §2.2 for full color table

- Gold, Silver, Energy (red/orange), Agricultural (red/purple), Industrial (orange)

**Crypto:** See §2.3 for full color table

- Official brand colors where visible on dark; vibrant alternatives where official colors are too dark

## 6.3 Motion

Motion is subtle and purposeful:
Small pulsing on live indicators.
Smooth transitions when belt content updates.
Hover states on chips and rows.

Motion respects `prefers-reduced-motion` automatically. No manual pause required.

FX-specific motion rules (the "alive but not obnoxious" brief)
For FX chips we deliberately separate:
Data truth (prices can update often) from UI truth (signals should be calm and meaningful).

FX micro-motion building blocks:

- Gentle luminosity pulse (neutral-only): price text very subtly brightens/dims ("breathing"), not flashing.
  Period: ~6–10 seconds.
  Opacity change: tiny (e.g. ~90% → 100% → 90%).
  Purpose: "the market is alive, but nothing decisive is happening."
- Micro-tick animation on update (all states): when the price updates, digits slide up/down by ~1–2px and settle.
  Direction of the micro-tick can follow the tick direction even if the 24h winner-arrow does not change.
  Purpose: "exchange terminal energy" without constant directional noise.
- Background whisper (optional, all states): a very faint background tint flash behind the number on tick updates.
  Greenish tint if tick was up, reddish tint if tick was down.
  Duration: ~200–300ms then fades away.
  Rule: must be subconscious; if you notice it consciously, it is too strong.
- Winner-arrow side-change transition: when the winner-arrow moves from left to right (or right to left), it must not "jump".
  It fades out, repositions, then fades back in.
  Purpose: preserve calmness and avoid visual shock.
- Winner-arrow "calm life" (when shown): a barely-there glow pulse OR a tiny drift so it feels alive, not static.
  Rule: purely decorative — must not change winner decision logic, thresholds/hysteresis, or the micro-timing delay.
  Must be disabled under prefers-reduced-motion.

---

Global Behaviour – Finance Ribbon

The Finance Ribbon is the conceptual home of the belt logic.

## 7.1 Data Flow

The ribbon reads from a small set of hooks/stores:

- FX selection comes from SSOT (fx-pairs.json), which defines what appears on the homepage.
- Commodities selection comes from SSOT (commodities-catalog.json).
- Crypto selection comes from SSOT (crypto-catalog.json).

Each ribbon has its own dedicated hook:

- `use-fx-quotes.ts` → FX ribbon
- `use-commodities-quotes.ts` → Commodities ribbon
- `use-crypto-quotes.ts` → Crypto ribbon

Data contract expectations (Brain v2 alignment):

- The UI requests quotes from the backend and does not talk to providers directly.
- The gateway performs one batched upstream request for all ribbon symbols (comma-separated) rather than one request per item.
- The gateway returns quotes in SSOT order, with a clear mode: "live" or "cached" (never "demo").
- The UI renders in the order returned (which must match SSOT) and formats using SSOT precision rules.

Client fetch stance (do not sabotage edge caching)

- The ribbon UI must not use `fetch(..., { cache: 'no-store' })` (or any equivalent cache-busting behaviour).
  That defeats `s-maxage`/TTL calming and turns polling into real origin + upstream traffic.
- The ribbon UI should call API endpoints without cookies (use `credentials: 'omit'`) so the CDN cache is not fragmented.

## 7.1.1 Hard-wired API savings & guardrails (must stay true)

These are hard requirements (not "nice ideas"):

- Bulk request (N → 1): ribbon symbols are batched so N items never become N upstream calls.
- Symbol de-duplication: if SSOT contains duplicates, the upstream request still only includes each symbol once.
- TTL caching: repeated homepage loads within the TTL window do not hit the upstream provider again.
- Single-flight (de-duplication under load): concurrent requests share a single upstream fetch and fan-out the cached result.
- 429 cooldown + "ride-cache": if the upstream rate-limits, Promagen extends TTL and serves cached values during the cooldown window.
  No repeated retries that burn credits.
- SSOT-key invalidation: when the SSOT symbol set changes, cache keys change and old cached payloads do not "poison" the new set.
- CDN cache headers: the API response is cache-friendly (edge caching) for the duration of the server TTL policy.
- API Timing Stagger: Each ribbon refreshes at different times (FX :00/:30, Commodities :10/:40, Crypto :20/:50) to prevent per-minute rate limit hits.

Budget guardrail (must stay true)

- The system tracks budget usage in memory (daily + rolling per-minute).
- Thresholds include a safety margin:
  - Warning at ~70% of daily allowance (default 800/day).
  - Block at ~95% of daily allowance OR per-minute cap hit (default 8/min).
- Budget state is computed only inside the Refresh Authority and then passed through.
- When blocked, the authority refuses upstream calls and serves ride-cache only (or unavailable if no cache).
- This budget guard does not weaken TTL/single-flight/bulk-only; it reinforces cost control in addition to those mechanisms.

## 7.1.2 Centralised polling (so 10 widgets ≠ 10 polls)

Front-end policy:

- There is exactly one client poller for each data feed (FX, Commodities, Crypto).
- All components read from the same shared store/context for their data feed.
- Adding more widgets must not multiply API calls.

### Vercel Pro guardrails for the ribbon (cost safety)

- Canonical playbook: `C:\Users\Proma\Projects\promagen\docs\authority\vercel-pro-promagen-playbook.md`
- Protect `/api/fx`, `/api/commodities`, `/api/crypto` with WAF rate limiting and bot rules.
- Set Spend Management thresholds so a traffic spike can't become a surprise bill.
- Keep ribbons edge-cacheable via TTL-aligned cache headers.

## 7.2 Live Data vs Cached vs Unavailable

The belt is designed around live data first.
There is no synthetic "demo" market data on the homepage ribbon.

Fallback order:

1. live (preferred)
2. cached (only if cache exists and is within TTL)
3. unavailable (render "—" without inventing numbers)

Logic:
Try the primary live feed (no cross-provider fallback).
If the primary live fetch fails (provider down, responses invalid, or adapter rejects payload):

- If valid cache exists (within TTL): render cached values and show a subtle banner above the ribbon:
  "Live data temporarily unavailable – showing cached prices."
- If no valid cache exists: render "—" values and show a subtle banner:
  "Live data temporarily unavailable."

As soon as live data returns, the belt quietly switches back to live, removing the banner.

## 7.2.1 TTL policy (development vs production)

TTL is a cost-control dial.
The system must support environment-specific TTL without code changes.

Policy (current decision):

- Production TTL target: 30 minutes (1800 seconds) for all ribbon feeds.
- Development TTL may be shorter to make testing practical.

Notes:

- A longer prod TTL massively reduces upstream credits.
- Client polling can be more frequent than TTL without increasing upstream usage (server serves cache),
  but centralised polling still matters for performance and server load.

## 7.3 Finance Ribbon Architecture

The Finance Ribbon contains:

- The market belt (FX, Commodities, Crypto rows — all LIVE)
- Motion respects `prefers-reduced-motion` media query

Implementation notes:

- Each ribbon row has its own container component
- Each container uses its dedicated quotes hook
- Motion animations are CSS-based and respond to user preferences

---

## 7.4 FX Winner Arrow Logic (production spec)

Each FX chip can display a single green arrow pointing at the "winning" side of the pair.

**⚠️ KEY CONCEPT: The arrow is VERTICAL (always points upward ↑), indicating "strengthened". The arrow does NOT rotate or point left/right. What changes is the arrow's POSITION (left side vs right side of the pair), NOT its direction.**

Meaning
We answer: "Which currency has strengthened over our look-back horizon?"
Current decision:

- Horizon: 24-hour rolling baseline (24h change).

Arrow rules (hard rules)

- Exactly one arrow maximum per pair.
- No red arrow, no double arrows.
- Arrow is always green when shown.
- Arrow points at the currency that has strengthened over the horizon.

Arrow placement (the "side flip" rule)
Arrow visual spec (icon + calm "life")

- Must be a real arrow glyph (shaft + head). Do not use a triangle/chevron glyph (e.g. ▲) as the winner indicator.

- **Arrow is ALWAYS upward-pointing (vertical ↑)**, indicating "this currency strengthened"
- **What changes is the arrow's POSITION** (left or right side), NOT its direction
- Arrow placement:
  - **BASE wins** → arrow appears on **LEFT side** (after BASE code, before BASE flag)
  - **QUOTE wins** → arrow appears on **RIGHT side** (before QUOTE code)
- Visual examples:
  - BASE stronger: `EUR ↑ 🇪🇺 / USD 🇺🇸` (arrow on left)
  - QUOTE stronger: `EUR 🇪🇺 / ↑ USD 🇺🇸` (arrow on right)
  - Neutral: `EUR 🇪🇺 / USD 🇺🇸` (no arrow)
- "Life" effect (visual-only, does not change decision/timing):
  - Choose ONE: gentle glow pulse OR tiny drift (do not stack multiple effects).
  - Glow pulse: very soft (opacity/blur/shadow), period ~4–7s, tiny amplitude.
  - Drift: translateY ±1px, period ~6–10s, ease-in-out.
  - Must be disabled under prefers-reduced-motion.
- Layout stability: keep a fixed arrow container box so chip width does not shift when the arrow appears/disappears.

For a pair BASE/QUOTE:

- If BASE is stronger → arrow appears next to BASE (left side).
- If QUOTE is stronger → arrow appears next to QUOTE (right side).
  If the winner changes over time, the arrow may move from left to right or vice versa.
  It must never duplicate.

Thresholds (anti-noise)
Arrows must not flap due to tiny micro-moves.
We use thresholds by pair class:

- Majors: neutral band ±0.02%
- Volatile / EM: neutral band ±0.05%

Interpretation:

- If |deltaPct| is inside the neutral band → treat as neutral.
  No winner-arrow is shown (movement is expressed via micro-motion).
- If |deltaPct| is outside the band → winner-arrow may be shown.

Hysteresis (pro refinement, prevents boundary jitter)
We use different thresholds for:

- Arrow appearing
- Arrow disappearing / flipping

Conceptual policy:

- Arrow appears when |deltaPct| > 0.03% (or pair-class equivalent).
- Arrow disappears / flips only when |deltaPct| < 0.015% (or pair-class equivalent).
  Result:
- Arrow changes are decisive and calm.

Confidence encoded via opacity (subtle)
Without adding more icons:

- Barely over threshold: arrow renders slightly dimmer (~70–80% opacity).
- Strong move (e.g. > 2× threshold): arrow at full opacity.
  This avoids "binary on/off" feel.

Micro-timing delay (confirmation feel)
When delta crosses the threshold and would cause an arrow show/flip:
Wait ~500–800ms before applying the change.
This makes the UI feel human and confirmed rather than twitchy.

Stale-data behaviour (market closed / cached / upstream pause)

If quotes stop changing for any reason, the ribbon naturally becomes still:

- Winner-arrow stays put because deltas don't change.

- No special mode exists; normal refresh/caching rules apply.
- Layout stays stable (show "—" for missing values, not empty gaps).
  Arrow side-change transition (micro-transition)
  When the arrow moves sides:

- Fade out → reposition → fade in.
  No hard jumps.

Hover explanation (optional, desktop-only)
Hovering the arrow may reveal an explanatory tooltip:
"GBP strengthened vs USD over 24h (+0.12%)"
Mobile: no hover behaviour; keep it clean.

## 7.4.1 Neutral state "alive" language (production spec)

Neutral is not static; it is controlled calm.

Neutral definition:

- |deltaPct| <= neutral threshold band for that pair-class.

Neutral visual behaviour:

- No winner-arrow.
- Gentle luminosity pulse on price text (breathing, ~6–10s, tiny opacity shift).
- Micro-tick animation still occurs on each price update.
- Optional background whisper may acknowledge tick direction without changing arrow state.

## 7.5 Tests (High Level)

Key behaviours to test:

- The FX row renders exactly N chips, where N is driven by fx-pairs.json (no hard-coded counts).
- The Commodities row renders chips driven by commodities-catalog.json.
- The Crypto row renders chips driven by crypto-catalog.json.
- SSOT order is preserved end-to-end: SSOT file order → gateway response order → UI render order.
- Motion animations respect `prefers-reduced-motion` media query.
- Winner arrow always appears at most once per pair and follows the winning currency when the configured orientation changes.
- Winner arrow flips sides correctly (BASE vs QUOTE) and never duplicates.
- Threshold behaviour prevents arrow jitter near neutral boundaries.
- Hysteresis prevents "nervous pacing" at the threshold edge.
- Centralised polling ensures multiple widgets do not multiply API requests.
- API timing stagger ensures FX, Commodities, and Crypto refresh at different times.
- Rich tooltips display correct content and position correctly at screen edges.
- Support icons render only for platforms with valid URLs in provider's `socials` field.
- Support icons display in consistent order (LinkedIn → Instagram → Facebook → YouTube → Discord → Reddit → TikTok → Pinterest → X).
- Support icons show full brand color (never greyscale).
- Support icon hover shows glowing tooltip with provider name and platform.
- Support column shows "—" for providers with no social links.
- Support icon links open in new tab with `rel="noopener noreferrer"`.
- Support icon animations respect `prefers-reduced-motion` media query.
- X icon renders with dark outline for visibility on dark backgrounds.
- Pinterest icon renders in correct red (#E60023) brand color.
- 2-row layout triggers when provider has 5+ social icons.
- Row 1 tooltips open above, Row 2 tooltips open below.
- Tooltip arrow direction matches tooltip position (down arrow for above, up arrow for below).

---

FX Picker & Configuration (Paid Only, SSOT-Compatible)

The paid experience introduces a proper configuration UI to adjust the homepage FX set, but the homepage still remains SSOT-driven:

- The picker edits the underlying configuration source (directly, or by writing to a persisted config that compiles into the same SSOT shape).
- The homepage ribbon remains a pure consumer: it renders whatever SSOT says, in SSOT order, at whatever count SSOT defines.

This keeps the mental model brutally simple:
Edit fx-pairs.json (or the paid picker that writes SSOT) → refresh → homepage updates.
No extra hidden files, no "magic" hard-coded numbers.

### FX Picker Limits (Authority: paid_tier.md §5.5)

| Aspect             | Value                    |
| ------------------ | ------------------------ |
| **Minimum pairs**  | 6                        |
| **Maximum pairs**  | 16                       |
| **Allowed counts** | Any integer from 6 to 16 |
| **Full catalog**   | 3,192 pairs              |

---

**Last updated:** January 18, 2026

**Changelog:**

- **18 Jan 2026 (PM):** Support column major update - Pinterest, X, 2-row layout
  - NEW: Pinterest platform added (`#E60023` red)
  - NEW: X (Twitter) platform added (`#FFFFFF` white with dark outline)
  - NEW: 2-row layout when provider has 5+ icons (4 icons per row)
  - NEW: Smart tooltip direction (Row 1: above, Row 2: below)
  - NEW: X icon uses dark outline for visibility on dark backgrounds
  - Data: 37 providers now have X URLs
  - Data: Canva has Pinterest URL
  - Platform order extended: LinkedIn → Instagram → Facebook → YouTube → Discord → Reddit → TikTok → Pinterest → X
  - Type: `ProviderSocials` updated with `pinterest?: string` and `x?: string`
  - Hover behavior: 70% opacity default → 100% + scale(1.15) + glow on hover
- **18 Jan 2026 (AM):** Support column replaces Visual Styles
  - NEW: Support column with clickable social media icons (LinkedIn, Instagram, Facebook, YouTube, Discord, Reddit, TikTok)
  - Icons display in full brand color (never greyscale)
  - Hover effect: glow brighter + scale(1.15)
  - Glowing colorful tooltips: "{Provider} on {Platform}"
  - 18×18px icons (1.5× flag size)
  - SSOT: `socials` field added to providers.json
  - Component: `src/components/providers/support-icons-cell.tsx`
  - Type: `ProviderSocials` added to `src/types/providers.ts`
  - 28 providers have social data; 14 show "—" (informative absence)
  - Respects `prefers-reduced-motion` media query
- **12 Jan 2026:** Major ribbon update
  - Commodities ribbon now LIVE (was "not yet live")
  - Crypto ribbon now LIVE (was "not yet live")
  - All three ribbons share identical calming architecture
  - Added RibbonLabel field for full descriptive names
  - Added brand colors for Commodities and Crypto
  - Added Rich Tooltip implementation (§2.5)
  - Added API Timing Stagger (§2.6): FX :00/:30, Commodities :10/:40, Crypto :20/:50
  - REMOVED: Pause button from all ribbons
  - REMOVED: Emoji budget indicator (🛫/🏖️/🧳)
  - Updated price formatting documentation
  - Crypto brand colors updated for visibility on dark backgrounds
- **10 Jan 2026:** FX SSOT Consolidated — Merged `fx.pairs.json` and `pairs.json` into single unified `fx-pairs.json`. All references updated throughout document.
- **9 Jan 2026:** Added Gateway SSOT Integration section under §2.1 FX Row. Gateway now fetches pairs from frontend `/api/fx/config` endpoint on startup instead of hardcoding.
- **8 Jan 2026:** Market Pulse v2.1 — Dynamic city connections (no hardcoding), Option 3+4 combined visual effects, city normalization with aliases, unified `.market-pulse-active` CSS class.
- **2 Jan 2026:** Added vote button to Image Quality column. Added community voting rules and implementation references.
