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

## Table structure (Updated 22 Jan 2026)

Header: "AI Providers Leaderboard".

**Columns (left → right) — 5 columns:**

| Column         | Width | Sortable | Notes                                                             |
| -------------- | ----- | -------- | ----------------------------------------------------------------- |
| Provider       | 30%   | No       | Icon + name + rank prefix + flag/city/clock + API/Affiliate emoji |
| Promagen Users | 18%   | No       | Top 6 country flags + Roman numerals (see cron_jobs.md)           |
| Image Quality  | 18%   | ✅ Yes   | Ordinal rank + medal + vote button, **centered**                  |
| Support        | 18%   | No       | Social media icons, **max 4 per row, centered**                   |
| Overall Score  | 16%   | ✅ Yes   | Score + trend indicator                                           |

**Column layout changes (22 Jan 2026):**

- API/Affiliate column REMOVED — emojis (🔌/🤝) moved inline to Provider cell
- Table now has **5 columns** instead of 6
- Column widths use **proportional percentages** for fluid auto-scaling
- **Vertical grid lines** between columns (`border-r border-white/5`)
- **All headers centered** (`text-center`)
- **Mobile card view** for small screens (hidden on desktop, shown via CSS)

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

Crypto uses identical calming to FX and Commodities:

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

### Rich Tooltip

Same implementation as Commodities. Hovering displays:

- Full crypto name (from `ribbonLabel`)
- Year founded
- Founder name
- Interesting historical fact
- Brand color glow effect

### Free tier

Fixed 8-item set, defined in SSOT.

### Paid tier (target)

Paid users can tune composition (still 8 total to keep the belt visually stable).

---

## 2.5 Rich Tooltip Implementation (NEW - Jan 12, 2026)

Both Commodities and Crypto ribbons feature rich, informative tooltips on hover.

### Structure

```
┌────────────────────────────────────┐
│  Gold                              │  ← Full name (ribbonLabel)
│  Historical trading since 600 BC   │  ← Interesting fact
│  ░░░░░░ Brand color glow ░░░░░░    │  ← Subtle glow effect
└────────────────────────────────────┘
```

### Styling

- Background: `rgba(15, 23, 42, 0.97)` (near-black, high opacity)
- Border: 1px solid with brand color
- Border radius: 8px
- Box shadow: Multi-layer glow using brand color
- Padding: 12px 16px
- Max width: 280px
- Z-index: 50 (above other UI elements)

### Brand Color Integration

Each tooltip's glow uses the item's `brandColor`:

```css
box-shadow:
  0 0 12px rgba(brandColor, 0.3),
  0 0 24px rgba(brandColor, 0.15),
  0 4px 12px rgba(0, 0, 0, 0.4);
```

### Animation

- Fade in: 150ms ease-out
- Position: Centered above the chip
- Respects `prefers-reduced-motion`

---

## 2.6 API Timing Stagger (NEW - Jan 12, 2026)

To prevent API request collisions, each ribbon type refreshes at staggered times:

| Ribbon      | Refresh Times | Offset   |
| ----------- | ------------- | -------- |
| FX          | :00, :30      | Base     |
| Commodities | :10, :40      | +10 mins |
| Crypto      | :20, :50      | +20 mins |

### Implementation

The stagger is implemented in each ribbon's polling hook using `getStaggeredInterval()`:

```typescript
// fx: base (0 offset)
// commodities: 10-minute offset
// crypto: 20-minute offset
const interval = getStaggeredInterval(ribbonType);
```

### Benefits

- Prevents simultaneous API calls from different ribbons
- Distributes gateway load evenly
- Reduces risk of rate limiting
- Each ribbon refreshes twice per hour (every 30 minutes)

---

## 3. Leaderboard Visual Design (Updated 22 Jan 2026)

### 3.1 Leaderboard Glow Frame (NEW - 22 Jan 2026)

The AI Providers Leaderboard table has a glowing border frame that wraps all 4 sides, drawing attention to the leaderboard as a focal point.

**Visual structure:**

```
░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
░░                                   ░░
░░  ┌─────────────────────────────┐  ░░
░░  │   AI PROVIDERS TABLE        │  ░░
░░  │   (Leaderboard)             │  ░░
░░  └─────────────────────────────┘  ░░
░░                                   ░░
░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
    ↑ Glow wraps ALL 4 SIDES only around the table
```

**Important:** The glow frame wraps ONLY the AI Providers table, NOT the Finance Ribbon above it.

**Gradient colors (matches "Intelligent Prompt Builder" heading):**

```css
/* Gradient: sky-400 → emerald-300 → indigo-400 */
sky-400:     rgb(56, 189, 248)
emerald-300: rgb(110, 231, 183)
indigo-400:  rgb(129, 140, 248)
```

**CSS implementation:**

Uses CSS mask-composite technique to create a hollow frame:

```css
.leaderboard-glow-frame {
  position: relative;
  z-index: 0;
}

/* Solid gradient border frame */
.leaderboard-glow-frame::before {
  content: '';
  position: absolute;
  inset: -7px; /* Frame extends 7px outside container */
  padding: 7px; /* Frame thickness */
  border-radius: 1.25rem;
  background: linear-gradient(
    135deg,
    rgba(56, 189, 248, 4) 0%,
    /* sky-400 */ rgba(110, 231, 183, 4) 50%,
    /* emerald-300 */ rgba(129, 140, 248, 4) 100% /* indigo-400 */
  );
  /* Mask creates hollow frame (cuts out center) */
  mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  mask-composite: exclude;
  animation: leaderboardGlowPulse 3s ease-in-out infinite;
}

/* Soft blur glow halo */
.leaderboard-glow-frame::after {
  content: '';
  position: absolute;
  inset: -10px; /* Larger spread for blur */
  padding: 10px;
  border-radius: 1.5rem;
  background: linear-gradient(
    135deg,
    rgba(56, 189, 248, 0.3) 0%,
    rgba(110, 231, 183, 0.25) 50%,
    rgba(129, 140, 248, 0.3) 100%
  );
  mask: /* same as above */;
  mask-composite: exclude;
  filter: blur(14px);
  animation: leaderboardGlowPulse 5s ease-in-out infinite;
  animation-delay: 0.5s; /* Offset for visual interest */
}

@keyframes leaderboardGlowPulse {
  0%,
  100% {
    opacity: 0.2;
  }
  50% {
    opacity: 1;
  }
}
```

**Tuning guide:**

| Property                | Location (globals.css) | Effect                  |
| ----------------------- | ---------------------- | ----------------------- |
| Solid frame brightness  | `::before` rgba values | Higher = brighter frame |
| Blur glow brightness    | `::after` rgba values  | Higher = stronger glow  |
| Pulse low point         | `0%, 100%` opacity     | Lower = more contrast   |
| Pulse high point        | `50%` opacity          | Keep at 1 for max       |
| Solid frame pulse speed | `::before` animation   | 3s default              |
| Blur glow pulse speed   | `::after` animation    | 5s default              |
| Frame thickness         | `inset` + `padding`    | Match both values       |
| Blur intensity          | `filter: blur()`       | Higher = softer glow    |
| Glow spread             | `::after` `inset`      | Larger = wider halo     |

**Reduced motion support:**

```css
@media (prefers-reduced-motion: reduce) {
  .leaderboard-glow-frame::before,
  .leaderboard-glow-frame::after {
    animation: none;
    opacity: 0.85;
  }
}
```

---

### 3.2 Sortable Headers — Bloomberg-Style (NEW - 22 Jan 2026)

Sortable columns (Image Quality, Overall Score) have professional, discoverable headers.

**Visual states:**

```
INACTIVE:                    HOVER:                       ACTIVE (sorted):
┌──────────────────┐         ┌──────────────────┐         ┌──────────────────┐
│ Image Quality ⇅  │         │ Image Quality ⇅  │         │ Image Quality ▼  │
│                  │         │ ───────────────  │         │ ═══════════════  │
└──────────────────┘         └──────────────────┘         └──────────────────┘
     (dim arrows)               (underline + brighter)        (cyan glow + underline)
```

**Features:**

- **Always-visible sort arrows:** ⇅ when inactive, ▼/▲ when active
- **Underline on hover:** Cyan gradient, grows from center
- **Glow on active:** Cyan drop-shadow on arrow and text
- **Toggle direction:** Click same column to flip asc/desc
- **Accessible:** `aria-label`, `focus-visible` ring

**Sort behavior:**

| Column        | Default Direction | Logic                       |
| ------------- | ----------------- | --------------------------- |
| Image Quality | Ascending         | Lower rank = better (1st)   |
| Overall Score | Descending        | Higher score = better (100) |

**CSS classes:**

```css
.sortable-header {
  /* Button reset + layout */
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.sortable-header::after {
  /* Underline effect */
  width: 0; /* Grows on hover */
  background: linear-gradient(90deg, transparent, rgba(34, 211, 238, 0.6), transparent);
}

.sortable-header:hover::after {
  width: 70%;
}

.sortable-header-arrow {
  color: rgba(100, 116, 139, 0.5); /* Dim when inactive */
}

.sortable-header-arrow-active {
  color: rgba(34, 211, 238, 1); /* Cyan when active */
  filter: drop-shadow(0 0 4px rgba(34, 211, 238, 0.5));
}

.sortable-header-active .sortable-header-label {
  text-shadow: 0 0 8px rgba(34, 211, 238, 0.3);
}
```

**Component structure:**

```tsx
<SortableHeader
  label="Image Quality"
  column="imageQuality"
  currentSort={sortBy}
  currentDirection={sortDirection}
  onSort={handleSort}
/>
```

---

### 3.3 Centered Content (Updated 22 Jan 2026)

**Support column icons:**

- Icons are horizontally centered within the cell
- Max 4 icons per row (ICONS_PER_ROW = 4)
- If 5+ icons: splits into 2 rows, both centered
- Uses `flex items-center justify-center gap-2`

**Image Quality column:**

- Cell content is horizontally centered
- Uses `inline-flex items-center justify-center`
- Rank + medal + vote button all centered as a unit

---

On mobile, the spacing can be slightly increased to keep rows visually separated when stacked with the AI Providers card.

All rows left-align with the centre column grid, so chips line up neatly with the AI Providers card below.

---

## 4. Support Column (Updated 22 Jan 2026)

The Support column displays clickable social media icons for each AI provider.

### Platform Support (9 platforms)

| Platform  | Icon Color | Brand Hex | Notes                                  |
| --------- | ---------- | --------- | -------------------------------------- |
| LinkedIn  | Blue       | #0A66C2   |                                        |
| Instagram | Pink/Red   | #E4405F   |                                        |
| Facebook  | Blue       | #1877F2   |                                        |
| YouTube   | Red        | #FF0000   |                                        |
| Discord   | Purple     | #5865F2   |                                        |
| Reddit    | Orange     | #FF4500   |                                        |
| TikTok    | Cyan       | #00F2EA   |                                        |
| Pinterest | Red        | #E60023   | NEW - Jan 18, 2026                     |
| X         | White      | #FFFFFF   | NEW - Jan 18, 2026, dark outline added |

**Platform order:** LinkedIn → Instagram → Facebook → YouTube → Discord → Reddit → TikTok → Pinterest → X

### Icon specifications

- Size: 18×18px (1.5× the 12px flag size)
- Color: Always full brand color (never greyscale)
- Default opacity: 70%
- Hover: 100% opacity + scale(1.15) + glow
- Click: Opens official page in new tab (`target="_blank"`)

### Layout (Updated 22 Jan 2026)

- **Max 4 icons per row** (ICONS_PER_ROW constant)
- **Centered horizontally** within the cell
- If 5+ icons: splits into 2 rows
  - Row 1: First 4 icons, tooltips open ABOVE
  - Row 2: Remaining icons, tooltips open BELOW

```tsx
// Single row (1-4 icons)
<div className="support-icons-cell flex items-center justify-center gap-2">

// Two rows (5+ icons)
<div className="support-icons-cell flex flex-col items-center gap-1">
  <div className="flex items-center justify-center gap-2">{/* Row 1 */}</div>
  <div className="flex items-center justify-center gap-2">{/* Row 2 */}</div>
</div>
```

### X Icon Visibility

X (Twitter) uses white (#FFFFFF) which is invisible on light backgrounds. Solution:

```tsx
// Dark outline for contrast on dark backgrounds
<path d="..." fill="none" stroke="rgba(0,0,0,0.6)" strokeWidth="1.5" />
// White fill on top
<path d="..." fill={color} />
```

### Tooltip

- Format: `{Provider} on {Platform}` (e.g., "Midjourney on Discord")
- Glow color: Uses platform's brand color
- Direction: Above for row 1, below for row 2

### Empty state

- Providers without any social links show "—" (em-dash)
- This is informative: tells user the provider has limited community reach

### Data source

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
- Canva has Pinterest URL

### Accessibility

- Each icon wrapped in `<a>` with `aria-label="{Provider} on {Platform}"`
- Focus ring: 2px indigo outline
- Respects `prefers-reduced-motion` (disables scale/glow animations)

---

AI Providers Leaderboard – Centre Column

Directly under the market belt sits the AI Providers Leaderboard card.

### Table structure (Updated 22 Jan 2026)

Header: "AI Providers Leaderboard".

**Columns (left → right) — 5 columns total:**

1. **Provider** (30% width)
   - Official icon + name (hyperlinked)
   - Rank prefix (muted)
   - Flag + city + HH:MM clock
   - 🔌/🤝 API/Affiliate emojis (moved from separate column)

2. **Promagen Users** (18% width)
   - Top 6 countries by usage per provider
   - 2×2×2 layout with Roman numerals
   - Empty if no users or stale data
   - See cron_jobs.md for implementation

3. **Image Quality** (18% width) — **SORTABLE**
   - Ordinal rank: 1st, 2nd, 3rd, etc.
   - Top 3 show medal: 🥇 🥈 🥉
   - Vote button
   - **Centered content**

4. **Support** (18% width)
   - Social media icons
   - **Max 4 per row, centered**
   - 2-row layout for 5+ icons

5. **Overall Score** (16% width) — **SORTABLE**
   - Score 0–100
   - Trend indicator inline (↑/↓/●)

**Removed columns:**

- API/Affiliate — emojis moved to Provider cell
- Visual Styles — replaced by Support column
- Tags — removed from homepage

### Column definitions

#### 1. Provider

Three-line layout per cell (updated Jan 1, 2026):

**Line 1:** Rank prefix + Provider name (hyperlinked) + Provider icon (PNG) + API/Affiliate emoji

- Rank: muted prefix ("1.", "2.", etc.)
- Name: hyperlinked to `/go/{id}?src=leaderboard_homepage` → opens provider website in new tab
- Icon: local PNG from `/icons/providers/{id}.png` (18×18px), also hyperlinked to homepage
  - Fallback: `fallback.png` on load error
  - Exception: DreamStudio uses 🏠 emoji
- API/Affiliate: 🔌 (API available) / 🤝 (Affiliate program) / 🔌🤝 (Both)

**Line 2:** Flag + City

- Country flag (16px) from `countryCode`
- HQ city from `hqCity`

**Line 3:** Clock + Prompt builder link

- Live clock from `timezone` field
- 🎨 + "Prompt builder" (cyan text), links to `/providers/{id}/prompt-builder`

#### 2. Promagen Users

Top up to 6 countries by Promagen usage **for that provider** (this is per provider row, not a global total).

**Hard truth rules:**

- Show only what is true (analytics-derived).
- If the provider has zero users, render an empty cell (no "0", no dashes, no placeholders).
- If the provider's aggregate is stale (updatedAt older than 48 hours), render an empty cell and log a warning (so Vercel logs show it).
- If a provider has only 1–2 countries with usage, show only those (do not render empty slots).

**Layout** (fixed; the cell may grow in height and that is expected):

- Display up to 6 countries in a 2×2×2 grid layout
- Keep each country block compact with a small gap between blocks
- Do not allow country blocks to wrap within a row

**Format** (per country block):

- Flag + space + Roman numeral count
- Example: 🇺🇸 XLII 🇬🇧 XVII

> **Implementation details:** See **cron_jobs.md** § Promagen Users Aggregation for:
> - Database schema (`provider_activity_events`, `provider_country_usage_30d`)
> - Cron route (`/api/promagen-users/cron`)
> - Library helpers (`src/lib/promagen-users/index.ts`)
> - Environment variables and observability

#### 3. Image Quality

Display: ordinal rank (1st, 2nd, 3rd, etc.) + vote button

- Top 3 show medal emoji: 🥇 🥈 🥉
- Vote button allows community voting
- **Content centered horizontally**

#### 4. Support

See §4 Support Column for full details.

- **Icons centered horizontally**
- **Max 4 icons per row**

#### 5. Overall Score

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

### Leaderboard Glow Frame Colors (NEW - 22 Jan 2026)

**Gradient (matches "Intelligent Prompt Builder" heading):**

- sky-400: `rgb(56, 189, 248)`
- emerald-300: `rgb(110, 231, 183)`
- indigo-400: `rgb(129, 140, 248)`

## 6.3 Motion

Motion is subtle and purposeful:
Small pulsing on live indicators.
Smooth transitions when belt content updates.
Hover states on chips and rows.

Motion respects `prefers-reduced-motion` automatically. No manual pause required.

### Leaderboard Glow Pulse (NEW - 22 Jan 2026)

The leaderboard glow frame has a subtle breathing animation:

- Solid frame: 3-second cycle
- Blur glow: 5-second cycle (offset by 0.5s)
- Opacity range: 0.2 → 1.0 → 0.2
- Disabled for users with `prefers-reduced-motion`

FX-specific motion rules (the "alive but not obnoxious" brief)
For FX chips we deliberately separate:
Data truth (prices can update often) from UI truth (signals should be calm and meaningful).

FX micro-motion building blocks:

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
- **Sortable headers show always-visible arrows (⇅ inactive, ▼/▲ active).**
- **Sortable headers show underline on hover.**
- **Sortable headers show glow effect when active.**
- **Clicking sortable header toggles sort direction.**
- **Image Quality sorts ascending by default (lower rank = better).**
- **Overall Score sorts descending by default (higher score = better).**
- **Leaderboard glow frame renders on all 4 sides of providers table.**
- **Leaderboard glow frame does NOT wrap Finance Ribbon.**
- **Leaderboard glow pulse animation has 3s/5s cycles.**
- **Leaderboard glow respects prefers-reduced-motion.**
- **Support icons are centered horizontally in cell.**
- **Image Quality cell content is centered horizontally.**

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

**Last updated:** January 22, 2026

**Changelog:**

- **22 Jan 2026:** Promagen Users implementation moved to cron_jobs.md
  - UI display rules (layout, format, truth rules) remain here
  - Implementation details (database, cron, library) now in cron_jobs.md
  - Added cross-reference note in § Column definitions
- **22 Jan 2026:** Major leaderboard visual update
  - NEW: Leaderboard glow frame — glowing border wrapping all 4 sides of providers table
    - Gradient: sky-400 → emerald-300 → indigo-400 (matches heading)
    - CSS mask-composite technique for hollow frame
    - Solid frame: 7px thickness, 3s pulse cycle
    - Blur glow: 14px blur, 5s pulse cycle
    - Respects prefers-reduced-motion
  - NEW: Professional sortable headers (Bloomberg-style)
    - Always-visible sort arrows (⇅ inactive, ▼/▲ active)
    - Underline on hover (cyan gradient)
    - Glow on active (cyan drop-shadow)
    - Toggle direction on click
    - Sortable columns: Image Quality, Overall Score
  - NEW: Centered content in Support and Image Quality columns
    - Support icons: `justify-center`, max 4 per row
    - Image Quality: centered rank + medal + vote button
  - CHANGED: Table layout — 5 columns instead of 6
    - API/Affiliate column REMOVED (emojis moved to Provider cell)
    - Column widths: 30% | 18% | 18% | 18% | 16%
  - CHANGED: Column widths use proportional percentages for fluid auto-scaling
  - NEW: Vertical grid lines between columns (`border-r border-white/5`)
  - NEW: Mobile card view for small screens
  - Files changed:
    - `src/components/providers/providers-table.tsx` — SortableHeader component, glow frame class
    - `src/components/providers/support-icons-cell.tsx` — centered icons
    - `src/app/globals.css` — sortable header styles, leaderboard glow frame styles
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
