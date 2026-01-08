Homepage – Main Promagen Hub
The homepage is the user’s command centre.
It is built around:
A three-column market layout (left rail, centre column, right rail).
A market belt in the centre column:
Today: one FX row (currently configured to show 8 chips by default).
Soon: stacked Commodities (7-wide) and Crypto (5-wide) rows beneath it.
A central AI Providers Leaderboard panel, directly under the FX row.
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
Header: “AI Providers Leaderboard”.
Columns (left → right):

Provider (icon + name; rank may appear as a muted prefix; flag + city + HH:MM clock)
Promagen Users
Image Quality (ordinal rank: 1st, 2nd, etc.)
Visual Styles
API/Affiliate
Overall Score (includes a small trend indicator inline; Overall Score stays far right)

Notes:

- Trend is not a standalone column (it lives inside Overall Score).
- Tags are removed from the homepage leaderboard table.

  Hard rule: the FX chip label font size must never be smaller than 11.5px.

- Snap rule (readability-first): if keeping a single line would require the label font to drop below 11.5px, the FX row must snap to exactly two lines.
  In two-line mode, the label font size must be as large as possible while still fitting cleanly within two lines (no overflow, no clipped text), keeping alignment and spacing consistent.

- Small / extreme narrow: if even two lines cannot fit cleanly at 11.5px, prefer horizontal scroll rather than reducing the label font below 11.5px.

In all cases the rule remains: render exactly what fx.pairs.json specifies, in SSOT order, regardless of how many FX are selected.

Everything is set up with fluid widths so the layout “snaps” cleanly rather than collapsing awkwardly as the window is moved between different screens and resolutions.

Market Belt in the Centre Column

The market belt is now firmly part of the centre column, not a full-width band at the absolute top of the page.

## Pair label formatting (test-locked)

The FX pair separator standard is **non-negotiable**.

- Add a tiny “event taxonomy” section somewhere authoritative listing allowed `eventType` values and weights, so nobody invents new names later and breaks aggregation.

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

How to “fix it forever” (without code): two permanent guardrails

Stop storing “the symbol string” as truth.
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
Commodities Row (middle) – 7 chips in a 2·3·2 pattern
Crypto Row (bottom) – 5 chips
AI Providers Leaderboard card

The document below describes all three rows. Only the FX row is currently live.

2.1 FX Row – Single Source of Truth (SSOT) Driven

The FX row is the first strip of the market belt, sitting inside the centre column above the AI Providers Leaderboard.

Core rule (hard rule)
The homepage FX row is entirely driven by:
C:\Users\Proma\Projects\promagen\frontend\src\data\fx\fx.pairs.json

This means:

- The ribbon does not hard-code “5” or “8” anywhere.
- The number of FX chips shown on the homepage is simply the number of entries you designate for the homepage in that JSON.
- To change the homepage FX set (count, order, orientation, paid/free defaults), you edit that single file only.

Default configuration (current)
The current homepage defaults are set to 8 FX chips. This is a content choice controlled in fx.pairs.json, not a UI limitation. You can increase or reduce the count freely by editing fx.pairs.json and the homepage will reflect it.

Chip contents
Each FX chip shows:
Pair label in BASE/QUOTE format (driven by the pair entry).
A compact status badge (“live”, “cached”, “—”) depending on data availability.
A soft pill style: rounded corners, subtle border, dark background.

In addition (FX “alive” language):
A single green “winner arrow” may appear next to one side of the pair label, pointing at the currency that has strengthened over the look-back horizon.
The arrow never duplicates (never two arrows). It may move sides depending on which currency is winning.
Neutral pairs remain visually calm but still feel “alive” through micro-motion rules (defined later in this document).

Status meaning:
live → data is fresh from the primary fx.ribbon provider (no cross-provider fallback).
cached → data is served from cache within TTL (banner/tooltip shows “Cached • {age}”).
— → data could not be retrieved (no valid cache). The chip remains in place, but values render as “—”.

Orientation (no ribbon inversion)
The ribbon does not provide an “invert” control.
The direction displayed is the direction defined by the selected pair entry in fx.pairs.json.
If you want the opposite direction on the ribbon, you do it via SSOT (by selecting the opposite-direction pair entry if it exists in your catalogue, or by changing the configured entry according to your catalogue rules).

Layout behaviour (variable N)
The FX row uses a stable layout that supports any number of chips:

- Desktop: chips share the available width evenly (flex: 1) and remain visually consistent.
- Medium screens: chips compress but keep alignment.
- Small screens: the row can switch to wrapping or horizontal scroll (implementation choice), but the rule remains: render exactly what fx.pairs.json specifies, in SSOT order.

Paid tier behaviour (SSOT-first)
For paid users, the layout stays identical; the difference is the chosen FX set.
The paid selection (including count) is still expressed through SSOT-driven configuration so that the homepage remains “edit one file, see the site change”.

2.2 Commodities Row – Design (not yet live)

The Commodities row will sit directly beneath the FX row in the centre column.

Structure
7 chips total arranged conceptually in a 2·3·2 pattern:
Group A (2)
Group B (3) – user’s chosen “crown” category
Group C (2)
This gives a recognisable “crown” shape in the middle of the belt.

Free tier
Fixed 7-item set, defined in SSOT for commodities (single file / single source, same philosophy as FX).

Paid tier (target)
Paid users can tune composition (still 7 total to keep the belt visually stable).

Visuals
Commodities chips are slightly taller than FX chips, giving a sense of scale as you move down.
Icons should be simple, recognisable silhouettes.
Text is short: commodity name or recognised ticker.

2.3 Crypto Row – Design (not yet live)

Crypto row sits beneath Commodities in the final layout.

Structure
5 chips total.

Free tier
Fixed top set, defined in SSOT for crypto (single file / single source, same philosophy as FX).

Paid tier (target)
Still 5 total to preserve vertical rhythm.
User can swap in other coins from the crypto catalogue via SSOT-driven configuration.

Visual nuance
Crypto icons are slightly larger and more graphic than FX and Commodities.
Vertical “size taper” from top to bottom:
FX: smallest chips
Commodities: medium
Crypto: slightly larger
This creates a gentle visual emphasis as you move down the belt.

2.4 Belt Spacing & Alignment

The three rows (FX, Commodities, Crypto) are considered one stacked unit inside the centre column.

Row spacing
A consistent top and bottom spacing token is used between rows (e.g. 0.75rem or 1rem).
On mobile, the spacing can be slightly increased to keep rows visually separated when stacked with the AI Providers card.

Alignment
All rows left-align with the centre column grid, so chips line up neatly with the AI Providers card below.

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
On smaller screens: the rails collapse into the main column stack above and below the belt + leaderboard or via a “More exchanges” accordion.

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
- Exchange count (even numbers only): 6, 8, 10, 12, 14, or 16.

Ordering rule (hard rule, never overridden):

- Take the chosen set and sort by homeLongitude so the whole page reads east → west.
- Split evenly into two halves.
- Left rail shows the first half top-to-bottom (east → west).
- Right rail shows the second half top-to-bottom in reverse order so that, when you scan left-to-right, the full layout reads east → west.

Free tier uses the baked-in default rail set and count; the visual layout remains identical, only the content set differs.

AI Providers Leaderboard – Centre Column

Directly under the market belt (currently under the FX row alone) sits the AI Providers Leaderboard card.

Table structure

Header: “AI Providers Leaderboard”.

Columns (left → right):

- Provider (official icon + name; optional muted rank prefix; flag + city + HH:MM clock; click opens provider detail)
- Promagen Users (top up to 6 country flags + counts; 2·2·2 layout; render nothing if zero; overflow becomes “… +n”)
- Image Quality (ordinal rank: 1st, 2nd, 3rd, etc. + vote button — derived from imageQualityRank field)
- Visual Styles (max 2 lines; not tag soup; UI clamps to 2 lines)
- API/Affiliate (🔌 / 🤝 / 🔌🤝; blank = unknown/not set)
- Overall Score (0–100; far right; trend indicator inline — no separate Trend column; no Tags column)

  Final header row

Provider | Promagen Users | Image Quality | Visual Styles | API/Affiliate | Overall Score ▼

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
- If the provider has zero users, render an empty cell (no “0”, no dashes, no placeholders).
- If the provider’s aggregate is stale (updatedAt older than 48 hours), render an empty cell and log a warning (so Vercel logs show it).
- If a provider has only 1–2 countries with usage, show only those (do not render empty slots).

Layout (fixed; the cell may grow in height and that is expected)

- Display up to 6 countries in a 2·2·2 layout:
  - Row 1: 2 countries
  - Row 2: 2 countries
  - Row 3: 2 countries
- Keep each country block compact with a small gap between blocks.
- Do not allow country blocks to wrap within a row.
- If there are more than 6 countries, show the top 6 plus a trailing “… +n”
  (where n = additional countries not shown).

Format (per country block)

- Flag + space + Roman numeral count
  Example:
  🇩🇪 I 🇬🇧 II
  🇺🇸 X 🇫🇷 IV
  🇪🇸 III 🇯🇵 I

Two bullet-proofing upgrades (so it doesn’t become rubbish data)

Anti-gaming + dedupe

sessionId = random, anonymous, client-generated identifier; not identifying (no IPs).

These guardrails apply to **any metric derived from “activity” events**, including the future **Online Now** presence metric.

- Deduplicate by sessionId (one person = one session) so refreshing doesn’t create “phantom users”.
- Only heartbeat when the page is visible (avoids inflated “online” from background tabs).
- Weight “submit/success” more than “click/open” so browsing doesn’t dominate usage.
- Optionally exclude obvious bots (no JS, impossible event rates, known bot signatures, etc.).

Roman numerals without hurting usability

- Roman numerals are display-only.
- The underlying Arabic number must be available via hover/tooltip and accessibility text (aria-label),
  so it stays readable while keeping the UI classy.

3. Image Quality

Ordinal rank derived from the `imageQualityRank` field in providers.json, plus a community vote button.

**Layout:** `2nd 🥈 👍` (rank + medal + vote button)

**Rank display:**
- Format: "1st", "2nd", "3rd", "4th", etc.
- Top 3 show medal emoji: 🥇 🥈 🥉
- This represents the provider's ranking for raw output quality compared to other providers.

**Vote button (Added Jan 2, 2026):**
- Thumbs-up icon positioned to the right of rank/medal
- Outline thumb: Not yet voted (highlights green on hover)
- Filled emerald thumb: Already voted (within 24 hours)
- Dimmed outline: Daily limit reached (3 providers) or not authenticated
- Bounce animation (400ms) on successful vote
- Requires authentication to vote
- Silent limits (no counters or error messages shown)

**Community voting rules:**
- Max 3 providers per user per day
- 1 vote per provider per 24-hour rolling window
- Votes persist across sessions via localStorage
- Paid users receive 1.5× vote weight (server-side, not disclosed)
- Rankings recalculate hourly via cron job

**Implementation:**
- Button: `src/components/providers/image-quality-vote-button.tsx`
- Hook: `src/hooks/use-image-quality-vote.ts`
- Storage: `src/lib/vote-storage.ts`
- API: `src/app/api/providers/vote/route.ts`

Authority for voting mechanics: `docs/authority/ai providers.md` (Community Voting System section)
Authority for paid weight multiplier: `docs/authority/paid_tier.md` (§5.6)

4. Visual Styles

Max 2 lines: what it excels at visually (not a tag soup). UI clamps to 2 lines.

5. API/Affiliate

Emoji indicators (single cell):

🔌 = API available

🤝 = Affiliate programme available

🔌🤝 = Both

blank = Unknown / not set (no “—”)

(Optional tooltip text: “API available” / “Affiliate programme available”.)

6. Overall Score

0–100, derived from the 7-criteria rubric below. (Overall Score stays far right.)

Score rubric (7 criteria)

Output quality

Prompt obedience

Text-in-image

Editing power (inpaint/outpaint/img2img)

Control (seed/negative/guidance options)

Speed reliability (consistent under load)

Value (free tier + price vs results)

One-liners for Visual Styles
Provider Visual Styles
OpenAI DALL·E / GPT-Image Reliable all-rounder for clean, on-brief image generation. Photoreal and product-style visuals; strong clarity and polish.
Stability AI / Stable Diffusion Tinker-friendly powerhouse for custom workflows and control. Huge range from photo to stylised; great for guided looks.
Leonardo AI Creator-focused tool for fast iteration and asset-style outputs. Game/concept vibes; punchy stylised art and variants.
I23RF AI Generator Simple generator for quick concepts without heavy setup. General-purpose looks; best for fast idea sketches.
Artistly Easy creative generation aimed at quick marketing visuals. Social-ready graphics and stylised artwork.
Adobe Firefly Business-friendly generator designed for design pipelines. Clean graphic-design styles; brand-friendly compositions.
Midjourney Best-in-class aesthetics for striking concept imagery. Cinematic, painterly, stylised “wow” images.
Canva Text-to-Image Quick images that slot straight into Canva designs. Social graphics, simple illustrations, brand assets.
Bing Image Creator Fast, accessible image generation for everyday needs. General illustration and poster-ish imagery.
Ideogram The go-to when you need readable text in images. Posters, typography-led designs, logo-like graphics.
Picsart Mobile-first creation with quick edits and generative tools. Bold social styles, stickers, effects-heavy looks.
Fotor One-click style generation and light enhancement. Photo effects, basic stylised outputs, quick variations.
NightCafe Experiment hub for trying different models and styles. Art-forward, stylised, community-trend aesthetics.
Playground AI Rapid exploration tool for lots of iterations and drafts. Concept-style variations and design explorations.
Pixlr Lightweight browser editor with quick generation add-ons. Simple edits and effects; practical web-friendly outputs.
DeepAI Basic generator useful for prototypes and quick tests. Simple outputs; better for utility than wow-factor.
NovelAI Strong pick for anime and character-focused generation. Anime/manga aesthetics and consistent stylised characters.
Lexica Great for prompt discovery and quick style exploration. Stable-Diffusion-style aesthetics and inspiration-led outputs.

Keep Visual Styles to ~60 characters per line (max 2 lines) so the table stays tidy.

Rules:

- Overall Score column is always far right.
- Rank is not its own column; it’s a small prefix inside the Provider cell.
- Sorted by score (highest first).
- Keep the existing dark UI, spacing, and layout; on smaller screens prefer horizontal scroll over wrapping.
- Outbound behaviour remains unchanged: no direct external URLs in the UI (all outbound via `/go/{id}`).
- For the full data-field contract (enrichment fields), see: `docs/authority/ai providers.md`.

Behaviour
Scrolls vertically as needed.
On desktop, the card width matches the centre column width, aligning with the belts above.
On smaller screens, the card fills the main content width.

Free vs Paid – Final Layout Rules

The visual layout of the homepage is identical for free and paid tiers; only the content within the rows changes.

5.1 Free Tier

Centre column stack (target state):
FX row – SSOT-driven (defaults currently set to 8; can be any number via fx.pairs.json).
Commodities row – fixed 7.
Crypto row – fixed 5.
AI Providers Leaderboard.

Rails (free vs paid)
The rails use the same visual shell for free and paid tiers.

- Free tier: uses the baked-in default exchange list and default card count.
- Paid tier: uses the user’s chosen exchange list and chosen card count (6/8/10/12/14/16), following the strict longitude ordering rule defined above.

  5.2 Paid Tier

Centre column stack (target state):
FX row – SSOT-driven, user-curated set (count and composition defined by configuration).
Commodities row – same layout, composition tuned by selection.
Crypto row – same layout, composition tuned by selection.
AI Providers Leaderboard – may show additional columns or insights for paid users, but the visual shell remains the same.

The homepage never becomes a “busy dashboard” – it stays calm, with a small number of high-signal, well-aligned rows.

Visual Language & Motion

The homepage look and feel should be:
Dark, calm, and precise.
Minimal neon, no “casino” feel.
6.0 Box Language (Card-Only UI) — Non-Negotiable

Promagen uses ONE visual container language across the entire site: dark, rounded cards with a faint outline.
If we break this rule, the UI starts to feel messy, “home-made”, and users bounce.

Hard rules (must always be true)

1. One box language only (no exceptions)

- Every visible “box” is a Card.
- Every section container is a large Card (“Panel Card”).
- Every list item / row inside a Card is a smaller Card (“Row Card”).
- No alternative shells: no random rectangles, no sharp-corner boxes, no different panel treatments “just for this page”.

2. The Card Shell spec (the only allowed container treatment)
   All cards must follow the same shell pattern:

- Shape: rounded rectangle (soft corners only).
- Stroke: 1px hairline border, low contrast (faint outline; never high-contrast).
- Fill: muted dark/charcoal surface (no bright blocks).
- Depth: subtle elevation only (barely-there shadow or inner glow). No heavy drop shadows.
- Contrast: separation comes from spacing + faint strokes, not loud borders.

3. Nesting rules (cards within cards)

- Panel Card contains Row Cards.
- Row Cards may contain small “chip/pill” elements, but chip styling must still match the card language (rounded, subtle border, dark fill).
- Nesting must look intentional: each level is visibly “the same family”, just smaller.

4. Spacing beats decoration (premium comes from rhythm)

- Use a consistent spacing scale everywhere (padding and gaps must come from the same small set of values).
- Padding is consistent within each card tier (Panel vs Row vs Chip).
- Gaps between cards are consistent within each section.
- Never “eyeball” random padding/margins per component — spacing must feel systematic.

5. Radius discipline (no corner-radius chaos)

- Use a small, fixed set of corner radii across the site (e.g. one for Panel Cards and one for Row Cards; chips are allowed to be pill-rounded).
- Do not introduce new radii for one-off components.

6. Change control (anti-drift enforcement)

- Any new UI container MUST reuse the existing Card primitives/styles.
- If a new feature needs a new container style, stop: extend the single Card system (globally) rather than creating a one-off.
- “Third box style” is a hard failure: if a PR introduces a new container look, it must be revised before merge.

Visual fail conditions (easy sniff test)

- Sharp corners, bright outlines, thick borders, heavy shadows, random background panels, or inconsistent padding = NOT ALLOWED.
- If the page contains more than one “box language”, we’ve violated this contract.

  6.1 Typography

Use a clean sans-serif font throughout.
FX/Commodities/Crypto labels: mid-weight, small caps or well-spaced uppercase where appropriate.
Leaderboards: standard sentence case in most columns, with perhaps a strong uppercase for headers.

6.2 Colour

Base page: near-black to very dark grey gradient.
Chips: dark grey background, slightly lighter border.
Text: primarily off-white.
Accents:
Green for “up / positive / winning” signals (e.g. arrows, positive trend).
Soft red or amber for “down / negative” if needed, but avoid flooding the UI with red.
Category tags can use subtle differentiated hues (FX vs Commodities vs Crypto).

6.3 Motion

Motion is subtle and purposeful:
Small pulsing on live indicators.
Smooth transitions when belt content updates.
Hover states on chips and rows.

A global “calm mode” (pause) lets the user stop live animations without breaking data refresh.

FX-specific motion rules (the “alive but not obnoxious” brief)
For FX chips we deliberately separate:
Data truth (prices can update often) from UI truth (signals should be calm and meaningful).

FX micro-motion building blocks:

- Gentle luminosity pulse (neutral-only): price text very subtly brightens/dims (“breathing”), not flashing.
  Period: ~6–10 seconds.
  Opacity change: tiny (e.g. ~90% → 100% → 90%).
  Purpose: “the market is alive, but nothing decisive is happening.”
- Micro-tick animation on update (all states): when the price updates, digits slide up/down by ~1–2px and settle.
  Direction of the micro-tick can follow the tick direction even if the 24h winner-arrow does not change.
  Purpose: “exchange terminal energy” without constant directional noise.
- Background whisper (optional, all states): a very faint background tint flash behind the number on tick updates.
  Greenish tint if tick was up, reddish tint if tick was down.
  Duration: ~200–300ms then fades away.
  Rule: must be subconscious; if you notice it consciously, it is too strong.
- Winner-arrow side-change transition: when the winner-arrow moves from left to right (or right to left), it must not “jump”.
  It fades out, repositions, then fades back in.
  Purpose: preserve calmness and avoid visual shock.
- Winner-arrow “calm life” (when shown): a barely-there glow pulse OR a tiny drift so it feels alive, not static.
  Rule: purely decorative — must not change winner decision logic, thresholds/hysteresis, or the micro-timing delay.
  Must pause in Calm Mode (global pause) and must be disabled under prefers-reduced-motion.

Global Behaviour – Finance Ribbon & Live/Paused

The Finance Ribbon is the conceptual home of the belt logic.

7.1 Data Flow

The ribbon reads from a small set of hooks/stores:
FX selection comes from SSOT (fx.pairs.json), which defines what appears on the homepage.
Future: Commodities and Crypto use the same SSOT philosophy (one file, single source).
useLiveStatus – whether global live mode is on or paused (motion only, not data refresh).

Data contract expectations (Brain v2 alignment):

- The UI requests the “FX ribbon quotes” role from the backend and does not talk to providers directly.
- The gateway performs one batched upstream request for all ribbon symbols (comma-separated) rather than one request per pair.
- The gateway returns quotes in SSOT order, with a clear mode: "live" or "cached" (never “demo”).
- The UI renders in the order returned (which must match SSOT) and formats using SSOT precision rules.
  Client fetch stance (do not sabotage edge caching)

- The FX ribbon UI must not use `fetch(..., { cache: 'no-store' })` (or any equivalent cache-busting behaviour) when calling `/api/fx`.
  That defeats `s-maxage`/TTL calming and turns polling into real origin + upstream traffic.
- The FX ribbon UI should call `/api/fx` without cookies (use `credentials: 'omit'`) so the CDN cache is not fragmented.
- `/api/fx/trace` is diagnostics and should be `no-store`; `/api/fx` must remain cacheable.

  7.1.1 Hard-wired API savings & guardrails (must stay true)

These are hard requirements (not “nice ideas”):

- Bulk request (N → 1): ribbon symbols are batched so N pairs never become N upstream calls.
- Symbol de-duplication: if SSOT contains duplicates, the upstream request still only includes each symbol once.
- TTL caching: repeated homepage loads within the TTL window do not hit the upstream provider again.
- Single-flight (de-duplication under load): concurrent requests share a single upstream fetch and fan-out the cached result.
- 429 cooldown + “ride-cache”: if the upstream rate-limits, Promagen extends TTL and serves cached values during the cooldown window.
  No repeated retries that burn credits.
- SSOT-key invalidation: when the SSOT symbol set changes, cache keys change and old cached payloads do not “poison” the new set.
- CDN cache headers: the API response is cache-friendly (edge caching) for the duration of the server TTL policy.
- No cross-provider fallback chain for fx.ribbon (current v2): do not do “primary then backup then backup”; behaviour is live → cached → unavailable.
  The system serves live or cached; when the provider is unhealthy, we do not spam alternative providers.

  7.1.2 Centralised polling (so 10 widgets ≠ 10 polls)

Front-end policy:

- There is exactly one client poller for FX quotes.
- All components (ribbon, cards) read from the same shared store/context.
- Adding more widgets must not multiply /api/fx calls.
- Pause (“calm mode”) stops motion and client polling, but does not change server-side caching policy.

  7.1.3 “Always show 8, refresh 4 at a time” (Group A / Group B caching)

User experience goal:

- The UI always displays all 8 FX chips (stable layout, always complete).
- We update only half of them per refresh cycle to reduce upstream usage and still keep the belt feeling alive.

Mechanics:

- Maintain two cached payloads:
  Group A payload: contains the 4 Group A pairs.
  Group B payload: contains the 4 Group B pairs.
- On each refresh cycle, only one group is refreshed (one upstream batched call for that group).
  The UI merges both cached payloads into a single 8-row list.
- The UI’s order and selection still comes from SSOT.
  Group assignment (A vs B) is deterministic and explicit (so it does not “shuffle” unexpectedly).
- The system never falls back to “per-chip” requests.
  Even under this strategy, each group refresh remains a batched call.

Implication:

- At worst, across two refresh cycles you see two upstream calls (one for each group), not eight.
- This is compatible with TTL caching and single-flight; it does not weaken those guarantees.

  7.2 Live Data vs Cached vs Unavailable

The belt is designed around live data first.
There is no synthetic “demo” market data on the homepage ribbon.

Fallback order:

1. live (preferred)
2. cached (only if cache exists and is within TTL)
3. unavailable (render “—” without inventing numbers)

Logic:
Try the primary fx.ribbon live feed (no cross-provider fallback).
If the primary live fetch fails (provider down, responses invalid, or adapter rejects payload):

- If valid cache exists (within TTL): render cached values and show a subtle banner above the ribbon:
  “Live FX temporarily unavailable – showing cached prices.”
- If no valid cache exists: render “—” values and show a subtle banner:
  “Live FX temporarily unavailable.”

As soon as live data returns, the belt quietly switches back to live, removing the banner.

7.2.1 TTL policy (development vs production)

TTL is a cost-control dial.
The system must support environment-specific TTL without code changes.

Policy (current decision):

- Production TTL target: 30 minutes (1800 seconds) (for FX ribbon role).
- Development TTL may be shorter to make testing practical.

Notes:

- A longer prod TTL massively reduces upstream credits.
- Client polling can be more frequent than TTL without increasing upstream usage (server serves cache),
  but centralised polling still matters for performance and server load.

  7.3 Finance Ribbon, Heartbeat, and Pause

The Finance Ribbon is the central home of:
The market belt (FX row live, Commodities/Crypto later).
A global “live / paused” state for motion:
A small heartbeat indicator (dot or pill) that can pulse when live.
A pause button that stops polling animations and micro-pulses.

Implementation notes:
Live/paused state lives in a small shared helper/hook (e.g. live-motion.ts).
Ribbon row components read this state to decide whether to animate.
Any micro-animations are defined as reusable CSS/Tailwind classes.
The pause button is a genuine “calm mode” for the whole belt, not a gimmick.

Provider health indicator (now + future-proofing)

- Current v2 operating model: one primary provider and no backups. The ribbon status badge (“live” / “cached” / “—”) is sufficient.
- When backup providers are reintroduced, the FX/API status emoji rule applies:

  - If primary API and both backups are working, show 2 emojis.
  - If primary API and only 1 backup is working, show 1 emoji.
  - If primary is down, do not pretend things are fine: render cached/— and surface a subtle “Live unavailable” banner.

    7.4 FX Winner Arrow Logic (production spec)

Each FX chip can display a single green arrow pointing at the “winning” side of the pair.

**⚠️ KEY CONCEPT: The arrow is VERTICAL (always points upward ↑), indicating "strengthened". The arrow does NOT rotate or point left/right. What changes is the arrow's POSITION (left side vs right side of the pair), NOT its direction.**

Meaning
We answer: “Which currency has strengthened over our look-back horizon?”
Current decision:

- Horizon: 24-hour rolling baseline (24h change).

Arrow rules (hard rules)

- Exactly one arrow maximum per pair.
- No red arrow, no double arrows.
- Arrow is always green when shown.
- Arrow points at the currency that has strengthened over the horizon.

Arrow placement (the “side flip” rule)
Arrow visual spec (icon + calm “life”)

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
- “Life” effect (visual-only, does not change decision/timing):
  - Choose ONE: gentle glow pulse OR tiny drift (do not stack multiple effects).
  - Glow pulse: very soft (opacity/blur/shadow), period ~4–7s, tiny amplitude.
  - Drift: translateY ±1px, period ~6–10s, ease-in-out.
  - Must pause in Calm Mode and must disable under prefers-reduced-motion.
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
  This avoids “binary on/off” feel.

Micro-timing delay (confirmation feel)
When delta crosses the threshold and would cause an arrow show/flip:
Wait ~500–800ms before applying the change.
This makes the UI feel human and confirmed rather than twitchy.

Stale-data behaviour (market closed / cached / upstream pause)

If quotes stop changing for any reason, the ribbon naturally becomes still:

- Winner-arrow stays put because deltas don’t change.

- No special mode exists; normal refresh/caching rules apply.
- Layout stays stable (show “—” for missing values, not empty gaps).
  Arrow side-change transition (micro-transition)
  When the arrow moves sides:

- Fade out → reposition → fade in.
  No hard jumps.

Hover explanation (optional, desktop-only)
Hovering the arrow may reveal an explanatory tooltip:
“GBP strengthened vs USD over 24h (+0.12%)”
Mobile: no hover behaviour; keep it clean.

7.4.1 Neutral state “alive” language (production spec)

Neutral is not static; it is controlled calm.

Neutral definition:

- |deltaPct| <= neutral threshold band for that pair-class.

Neutral visual behaviour:

- No winner-arrow.
- Gentle luminosity pulse on price text (breathing, ~6–10s, tiny opacity shift).
- Micro-tick animation still occurs on each price update.
- Optional background whisper may acknowledge tick direction without changing arrow state.

  7.5 Tests (High Level)

Key behaviours to test:
The FX row renders exactly N chips, where N is driven by fx.pairs.json (no hard-coded counts).
SSOT order is preserved end-to-end: fx.pairs.json order → gateway response order → UI render order.
Global pause stops motion and client polling (Calm Mode), but does not change server caching policy.
Winner arrow always appears at most once per pair and follows the winning currency when the configured orientation changes.
Winner arrow flips sides correctly (BASE vs QUOTE) and never duplicates.
Threshold behaviour prevents arrow jitter near neutral boundaries.
Hysteresis prevents “nervous pacing” at the threshold edge.
Centralised polling ensures multiple widgets do not multiply /api/fx requests.
Group A/B strategy always shows 8 chips and refreshes only 4 at a time while preserving SSOT ordering.

FX Picker & Configuration (Paid Only, SSOT-Compatible)

The paid experience introduces a proper configuration UI to adjust the homepage FX set, but the homepage still remains SSOT-driven:

- The picker edits the underlying configuration source (directly, or by writing to a persisted config that compiles into the same SSOT shape).
- The homepage ribbon remains a pure consumer: it renders whatever SSOT says, in SSOT order, at whatever count SSOT defines.

This keeps the mental model brutally simple:
Edit fx.pairs.json (or the paid picker that writes SSOT) → refresh → homepage updates.
No extra hidden files, no “magic” hard-coded numbers.

What Happens When APIs Die (Live → Cached → Unavailable Rule)

Your rule: never invent market data.
The homepage ribbon does not display sample/demo prices.

Flow:
Ribbon tries to fetch live FX.
If the FX provider fails completely:

1. If valid cache exists:
   Show subtle banner above the ribbon:
   “Live FX temporarily unavailable – showing cached prices.”
   Ribbon renders cached values (stable layout; chip count unchanged).
2. If no valid cache exists:
   Show subtle banner above the ribbon:
   “Live FX temporarily unavailable.”
   Ribbon renders “—” for values (stable layout; chip count unchanged).

When live comes back, it silently swaps to live values again.

FX Observability & Dev Diagnostics (Trace Endpoint)

Purpose
When something breaks, we want answers in seconds:

- Is the upstream being hit once (batched) or many times (regression)?
- Is the cache working?
- Are null prices caused by missing symbol mappings (normalisation/lookup), not “bad APIs”?
- Did SSOT change invalidate the cache correctly?

Trace endpoint principles

- The trace endpoint must never trigger an upstream provider call.
  It reports the latest internal snapshot (cache state, last decision, missing symbols diagnostics).
- It is safe to call repeatedly during development.
  It does not “eat” upstream credits.
- It must be possible to disable or hide trace UI in production.

Trace snapshot should include (minimum)

- Upstream calls count (batched calls)
- Ribbon calls count (internal route hits)
- TTL value (seconds)
- Cache hit/miss and expiry timestamp
- Last decision (“cache_hit”, “cache_miss”, “cooldown_ride_cache”, etc.)
- Last fetch timestamp
- Missing symbols diagnostics:
  Missing symbols count
  Missing symbols list (SSOT symbols not found in provider results / map)

Dev-only display policy

- Any on-page “FX Dev Diagnostics” panel is for local/dev by default.
- Production (www.promagen.com) should not surface developer diagnostics unless explicitly enabled by a secure flag.
- The trace endpoint may remain available for operational debugging, but UI exposure is controlled.

Developer Notes / Implementation Hints

You want this wired into your existing setup as:
A mock useTier implementation (for local dev) so you can flip between free and paid.
A full file for the configuration UI (FX picker drawer) later.
A FinanceRibbon that:
Stays centred.
Always live-first.
Always renders from SSOT (fx.pairs.json).
Never uses synthetic/demo prices.
Never relies on a hard-coded chip count.

End result:
Free = SSOT default FX set (currently 8 by content).
Paid = user-curated FX set (count and composition still defined by SSOT).
Everything else on the page remains unchanged: rails and leaderboard stay put, and the three-column layout remains calm and predictable.

Homepage – Main Promagen Hub
The homepage is the user’s command centre.
It is built around:
A three-column market layout (left rail, centre column, right rail).
A market belt in the centre column:
Today: one FX row (currently configured to show 8 chips by default).
Soon: stacked Commodities (7-wide) and Crypto (5-wide) rows beneath it.
A central AI Providers Leaderboard panel, directly under the FX row.
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

Three-column grid
The main content area is a three-column CSS grid:
Left rail: 0.9fr
Centre: 2.2fr
Right rail: 0.9fr
The effect: the centre column visually anchors the page, with the two exchange rails framing it.

On smaller breakpoints:
The layout can retain three columns while space allows.
On narrow screens it collapses to a single column, stacking:
Left rail exchanges
Centre column content (FX row + AI Providers, later also Commodities + Crypto)
Right rail exchanges
Everything is set up with fluid widths so the layout “snaps” cleanly rather than collapsing awkwardly as the window is moved between different screens and resolutions.

Market Belt in the Centre Column

The market belt is now firmly part of the centre column, not a full-width band at the absolute top of the page.

Current state (implemented)
Within the centre column, from top to bottom:
FX Row (free tier) – default set currently contains 8 chips (content-driven, not hard-coded).
AI Providers Leaderboard

Final design (target)
The final intended stack inside the centre column is:
FX Row (top) – N chips (driven by SSOT)
Commodities Row (middle) – 7 chips in a 2·3·2 pattern
Crypto Row (bottom) – 5 chips
AI Providers Leaderboard card

The document below describes all three rows. Only the FX row is currently live.

2.1 FX Row – Single Source of Truth (SSOT) Driven

The FX row is the first strip of the market belt, sitting inside the centre column above the AI Providers Leaderboard.

Core rule (hard rule)
The homepage FX row is entirely driven by:
C:\Users\Proma\Projects\promagen\frontend\src\data\fx\fx.pairs.json

This means:

- The ribbon does not hard-code “5” or “8” anywhere.
- The number of FX chips shown on the homepage is simply the number of entries you designate for the homepage in that JSON.
- To change the homepage FX set (count, order, orientation, paid/free defaults), you edit that single file only.

Default configuration (current)
The current homepage defaults are set to 8 FX chips. This is a content choice controlled in fx.pairs.json, not a UI limitation. You can increase or reduce the count freely by editing fx.pairs.json and the homepage will reflect it.

Chip contents
Each FX chip shows:
Pair label in BASE/QUOTE format (driven by the pair entry).
A compact status badge (“live”, “cached”, “—”) depending on data availability.
A soft pill style: rounded corners, subtle border, dark background.

In addition (FX “alive” language):
A single green “winner arrow” may appear next to one side of the pair label, pointing at the currency that has strengthened over the look-back horizon.
The arrow never duplicates (never two arrows). It may move sides depending on which currency is winning.
Neutral pairs remain visually calm but still feel “alive” through micro-motion rules (defined later in this document).

Status meaning:
live → data is fresh from the primary fx.ribbon provider (no cross-provider fallback).
cached → data is served from cache within TTL (banner/tooltip shows “Cached • {age}”).
— → data could not be retrieved (no valid cache). The chip remains in place, but values render as “—”.

Orientation (no ribbon inversion)
The ribbon does not provide an “invert” control.
The direction displayed is the direction defined by the selected pair entry in fx.pairs.json.
If you want the opposite direction on the ribbon, you do it via SSOT (by selecting the opposite-direction pair entry if it exists in your catalogue, or by changing the configured entry according to your catalogue rules).

Layout behaviour (variable N)
The FX row uses a stable layout that supports any number of chips:

- Desktop: chips share the available width evenly (flex: 1) and remain visually consistent.
- Medium screens: chips compress but keep alignment.
- Small screens: the row can switch to wrapping or horizontal scroll (implementation choice), but the rule remains: render exactly what fx.pairs.json specifies, in SSOT order.

Paid tier behaviour (SSOT-first)
For paid users, the layout stays identical; the difference is the chosen FX set.
The paid selection (including count) is still expressed through SSOT-driven configuration so that the homepage remains “edit one file, see the site change”.

2.1.1 Budget Guard Mission – Homepage FX Impact (New)

Purpose
The homepage FX row is a “market surface” that must stay calm, accurate, and cheap to operate.
The current mission adds a server-owned budget guard that prevents Promagen from exceeding the free upstream allowance (default 800/day), while still keeping the homepage belt complete and stable.

Core behaviour (hard rules)

- Budget authority is server-owned (inside the FX Refresh Authority / Refresh Gate).
- The UI does not decide or infer budget thresholds. It only renders a server-provided state.
- When the budget blocks upstream calls, the system serves ride-cache only (or “—” if no cache exists).
- This must not weaken or regress any of the existing calmness controls:
  TTL caching, single-flight, A/B slicing + alternation, bulk-only batching, SSOT-key invalidation.

Visible UX change on homepage (minimal, emoji-only)
A small emoji-only indicator appears beside the Pause button on the FX ribbon row:

- 🛫 OK (budget healthy; under warning threshold)
- 🏖️ Warning (budget pressure; approaching daily/minute allowance)
- 🧳 Blocked (budget blocking upstream; ride-cache only)
  Emoji mapping is SSOT (anti-drift)

The three budget emojis above are a UX surface, but the mapping must not be hard-coded inside UI/modules.

Rules:

- Budget emojis live in the Emoji Bank SSOT: frontend/src/data/emoji/emoji-bank.json
- The Emoji Bank group key is `budget_guard` and must contain exactly: `ok`, `warning`, `blocked`.
- Import via the emoji helper layer (src/data/emoji/*). No local “BUDGET*EMOJI\*” constants are permitted anywhere.
- No “unknown/?” fallback is allowed for budget emojis; missing mappings must fail tests/builds.

Canonical mapping (non-negotiable):

- ok 🛫
- warning 🏖️
- blocked 🧳

Lock-in proof:

- A tiny integrity test must assert ok🛫 / warning🏖️ / blocked🧳 so refactors cannot swap them.

Important:

- Emoji-only means no visible wording on the homepage.
- SR-only text is allowed for accessibility, but the display remains emoji-only.
- This indicator is for operational confidence while building: it tells you immediately whether the homepage can safely keep “feeling alive” without spending you into a rate-limit event.

Where budget state comes from (single source of truth)

- The /api/fx payload includes meta.budget.state produced by the server authority.
- UI renders it as a pure passthrough.
- No client-side recompute of 70%/95% thresholds is permitted.

What the indicator is NOT

- It is not a “live/cached” substitute; those still reflect data availability.
- It is not a provider health indicator; it reflects spend pressure and gating decisions only.
- It is not a refresh permission control for the client; it is informational.

  2.2 Commodities Row – Design (not yet live)

The Commodities row will sit directly beneath the FX row in the centre column.

Structure
7 chips total arranged conceptually in a 2·3·2 pattern:
Group A (2)
Group B (3) – user’s chosen “crown” category
Group C (2)
This gives a recognisable “crown” shape in the middle of the belt.

Free tier
Fixed 7-item set, defined in SSOT for commodities (single file / single source, same philosophy as FX).

Paid tier (target)
Paid users can tune composition (still 7 total to keep the belt visually stable).

Visuals
Commodities chips are slightly taller than FX chips, giving a sense of scale as you move down.
Icons should be simple, recognisable silhouettes.
Text is short: commodity name or recognised ticker.

2.3 Crypto Row – Design (not yet live)

Crypto row sits beneath Commodities in the final layout.

Structure
5 chips total.

Free tier
Fixed top set, defined in SSOT for crypto (single file / single source, same philosophy as FX).

Paid tier (target)
Still 5 total to preserve vertical rhythm.
User can swap in other coins from the crypto catalogue via SSOT-driven configuration.

Visual nuance
Crypto icons are slightly larger and more graphic than FX and Commodities.
Vertical “size taper” from top to bottom:
FX: smallest chips
Commodities: medium
Crypto: slightly larger
This creates a gentle visual emphasis as you move down.

2.4 Belt Spacing & Alignment

The three rows (FX, Commodities, Crypto) are considered one stacked unit inside the centre column.

Row spacing
A consistent top and bottom spacing token is used between rows (e.g. 0.75rem or 1rem).
On mobile, the spacing can be slightly increased to keep rows visually separated when stacked with the AI Providers card.

Alignment
All rows left-align with the centre column grid, so chips line up neatly with the AI Providers card below.

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
On smaller screens: the rails collapse into the main column stack above and below the belt + leaderboard or via a “More exchanges” accordion.

Paid-tier exchange rail rules (homepage side-rails)
Paid users can choose how many exchange cards appear on the rails: 6, 8, 10, 12, 14, or 16 (even numbers only).

Ordering rule (this is a hard rule, not a suggestion):

- Take the chosen set and sort by homeLongitude (east → west; higher longitude first, lower last).
- Split evenly into two halves.
- Left rail shows the first half top-to-bottom (east → west).
- Right rail shows the second half top-to-bottom in reverse so that, when you scan the page left-to-right, the whole layout reads east → west.

Free tier uses the baked-in default rail set and count; the visual layout remains identical, only the content set differs.

AI Providers Leaderboard – Centre Column

Directly under the market belt (currently under the FX row alone) sits the AI Providers Leaderboard card.

Table structure
Header: “AI Providers Leaderboard”.
Columns (left → right):
Provider (icon + name; flag + city + HH:MM clock)
Promagen Users
Image Quality
Visual Styles
API/Affiliate
Overall Score

Rows:
Sorted by Overall Score (highest first).
Each row occupies the full width of the centre column card.

Behaviour
Scrolls vertically as needed.
On desktop, the card width matches the centre column width, aligning with the belts above.
On smaller screens, the card fills the main content width.

Free vs Paid – Final Layout Rules

The visual layout of the homepage is identical for free and paid tiers; only the content within the rows changes.

5.1 Free Tier

Centre column stack (target state):
FX row – SSOT-driven (defaults currently set to 8; can be any number via fx.pairs.json).
Commodities row – fixed 7.
Crypto row – fixed 5.
AI Providers Leaderboard.

Rails (free vs paid)
The rails use the same visual shell for free and paid tiers.

- Free tier: uses the baked-in default exchange list and default card count.
- Paid tier: uses the user’s chosen exchange list and chosen card count (6/8/10/12/14/16), following the strict longitude ordering rule defined above.

  5.2 Paid Tier

Centre column stack (target state):
FX row – SSOT-driven, user-curated set (count and composition defined by configuration).
Commodities row – same layout, composition tuned by selection.
Crypto row – same layout, composition tuned by selection.
AI Providers Leaderboard – may show additional columns or insights for paid users, but the visual shell remains the same.

The homepage never becomes a “busy dashboard” – it stays calm, with a small number of high-signal, well-aligned rows.

Visual Language & Motion

The homepage look and feel should be:
Dark, calm, and precise.
Minimal neon, no “casino” feel.

6.1 Typography

Use a clean sans-serif font throughout.
FX/Commodities/Crypto labels: mid-weight, small caps or well-spaced uppercase where appropriate.
Leaderboards: standard sentence case in most columns, with perhaps a strong uppercase for headers.

6.2 Colour

Base page: near-black to very dark grey gradient.
Chips: dark grey background, slightly lighter border.
Text: primarily off-white.
Accents:
Green for “up / positive / winning” signals (e.g. arrows, positive trend).
Soft red or amber for “down / negative” if needed, but avoid flooding the UI with red.
Category tags can use subtle differentiated hues (FX vs Commodities vs Crypto).

6.3 Motion

Motion is subtle and purposeful:
Small pulsing on live indicators.
Smooth transitions when belt content updates.
Hover states on chips and rows.

A global “calm mode” (pause) lets the user stop live animations without breaking data refresh.

FX-specific motion rules (the “alive but not obnoxious” brief)
For FX chips we deliberately separate:
Data truth (prices can update often) from UI truth (signals should be calm and meaningful).

FX micro-motion building blocks:

- Gentle luminosity pulse (neutral-only): price text very subtly brightens/dims (“breathing”), not flashing.
  Period: ~6–10 seconds.
  Opacity change: tiny (e.g. ~90% → 100% → 90%).
  Purpose: “the market is alive, but nothing decisive is happening.”
- Micro-tick animation on update (all states): when the price updates, digits slide up/down by ~1–2px and settle.
  Direction of the micro-tick can follow the tick direction even if the 24h winner-arrow does not change.
  Purpose: “exchange terminal energy” without constant directional noise.
- Background whisper (optional, all states): a very faint background tint flash behind the number on tick updates.
  Greenish tint if tick was up, reddish tint if tick was down.
  Duration: ~200–300ms then fades away.
  Rule: must be subconscious; if you notice it consciously, it is too strong.
- Winner-arrow side-change transition: when the winner-arrow moves from left to right (or right to left), it must not “jump”.
  It fades out, repositions, then fades back in.
  Purpose: preserve calmness and avoid visual shock.

Global Behaviour – Finance Ribbon & Live/Paused

The Finance Ribbon is the conceptual home of the belt logic.

7.1 Data Flow

The ribbon reads from a small set of hooks/stores:
FX selection comes from SSOT (fx.pairs.json), which defines what appears on the homepage.
Future: Commodities and Crypto use the same SSOT philosophy (one file, single source).
useLiveStatus – whether global live mode is on or paused (motion only, not data refresh).

Data contract expectations (Brain v2 alignment):

- The UI requests the “FX ribbon quotes” role from the backend and does not talk to providers directly.
- The gateway performs one batched upstream request for all ribbon symbols (comma-separated) rather than one request per pair.
- The gateway returns quotes in SSOT order, with a clear mode: "live" or "cached" (never “demo”).
- The UI renders in the order returned (which must match SSOT) and formats using SSOT precision rules.

Budget meta passthrough (New, server-owned)

- /api/fx may include meta.budget (including state and optional emoji).
- This is computed server-side inside the Refresh Authority as the single source of truth.
- The UI passes it through and may render an emoji indicator beside Pause.
- The client must not infer thresholds or attempt to “avoid blocking” by changing its own polling timing; the server authority remains the spend governor.

  7.1.1 Hard-wired API savings & guardrails (must stay true)

These are hard requirements (not “nice ideas”):

- Bulk request (N → 1): ribbon symbols are batched so N pairs never become N upstream calls.
- Symbol de-duplication: if SSOT contains duplicates, the upstream request still only includes each symbol once.
- TTL caching: repeated homepage loads within the TTL window do not hit the upstream provider again.
- Single-flight (de-duplication under load): concurrent requests share a single upstream fetch and fan-out the cached result.
- 429 cooldown + “ride-cache”: if the upstream rate-limits, Promagen extends TTL and serves cached values during the cooldown window.
  No repeated retries that burn credits.
- SSOT-key invalidation: when the SSOT symbol set changes, cache keys change and old cached payloads do not “poison” the new set.
- CDN cache headers: the API response is cache-friendly (edge caching) for the duration of the server TTL policy.
- No cross-provider fallback chain for fx.ribbon (current v2): do not do “primary then backup then backup”; behaviour is live → cached → unavailable.
  The system serves live or cached; when the provider is unhealthy, we do not spam alternative providers.

Budget guardrail (New, must stay true)

- The system tracks budget usage in memory (daily + rolling per-minute).
- Thresholds include a safety margin:
  - Warning at ~70% of daily allowance (default 800/day).
  - Block at ~95% of daily allowance OR per-minute cap hit (default 8/min).
- Budget state is computed only inside the Refresh Authority and then passed through.
- When blocked, the authority refuses upstream calls and serves ride-cache only (or unavailable if no cache).
- This budget guard does not weaken TTL/single-flight/A-B/bulk-only; it reinforces cost control in addition to those mechanisms.

  7.1.2 Centralised polling (so 10 widgets ≠ 10 polls)

Front-end policy:

- There is exactly one client poller for FX quotes.
- All components (ribbon, cards) read from the same shared store/context.
- Adding more widgets must not multiply /api/fx calls.
- Pause (“calm mode”) stops motion and client polling, but does not change server-side caching policy.

### Vercel Pro guardrails for the ribbon (cost safety)

- Canonical playbook: `C:\Users\Proma\Projects\promagen\docs\authority\vercel-pro-promagen-playbook.md`
- Protect `/api/fx` with WAF rate limiting and bot rules.
- Set Spend Management thresholds so a traffic spike can’t become a surprise bill.
- Keep the ribbon edge-cacheable via TTL-aligned cache headers (this is the difference between “fast” and “expensive”).
  Budget indicator note:

- Centralised polling is still important for client/server load, but budget state is not “controlled” by client polling.
- Even if /api/fx is called frequently, upstream spend is governed by the server authority + TTL + budget guard.

  7.1.3 “Always show 8, refresh 4 at a time” (Group A / Group B caching)

User experience goal:

- The UI always displays all 8 FX chips (stable layout, always complete).
- We update only half of them per refresh cycle to reduce upstream usage and still keep the belt feeling alive.

Mechanics:

- Maintain two cached payloads:
  Group A payload: contains the 4 Group A pairs.
  Group B payload: contains the 4 Group B pairs.
- On each refresh cycle, only one group is refreshed (one upstream batched call for that group).
  The UI merges both cached payloads into a single 8-row list.
- The UI’s order and selection still comes from SSOT.
  Group assignment (A vs B) is deterministic and explicit (so it does not “shuffle” unexpectedly).
- The system never falls back to “per-chip” requests.
  Even under this strategy, each group refresh remains a batched call.

Implication:

- At worst, across two refresh cycles you see two upstream calls (one for each group), not eight.
- This is compatible with TTL caching and single-flight; it does not weaken those guarantees.
- The budget guard further ensures that even allowed refresh cycles do not push you over daily/per-minute limits.

  7.2 Live Data vs Cached vs Unavailable

The belt is designed around live data first.
There is no synthetic “demo” market data on the homepage ribbon.

Fallback order:

1. live (preferred)
2. cached (only if cache exists and is within TTL)
3. unavailable (render “—” without inventing numbers)

Logic:
Try the primary fx.ribbon live feed (no cross-provider fallback).
If the primary live fetch fails (provider down, responses invalid, or adapter rejects payload):

- If valid cache exists (within TTL): render cached values and show a subtle banner above the ribbon:
  “Live FX temporarily unavailable – showing cached prices.”
- If no valid cache exists: render “—” values and show a subtle banner:
  “Live FX temporarily unavailable.”

As soon as live data returns, the belt quietly switches back to live, removing the banner.

Budget-blocked behaviour (New)
Budget blocking is a deliberate server safety behaviour, distinct from “provider down”.
When budget is blocked:

- Upstream calls are refused by the Refresh Authority.
- The belt renders ride-cache values (or “—” if no cache exists).
- The emoji indicator beside Pause communicates budget pressure (🧳 when blocked).
- This avoids credit burn and reduces the chance of a 429 event.

  7.2.1 TTL policy (development vs production)

TTL is a cost-control dial.
The system must support environment-specific TTL without code changes.

Policy (current decision):

- Production TTL target: 30 minutes (1800 seconds) (for FX ribbon role).
- Development TTL may be shorter to make testing practical.

Notes:

- A longer prod TTL massively reduces upstream credits.
- Client polling can be more frequent than TTL without increasing upstream usage (server serves cache),
  but centralised polling still matters for performance and server load.

Budget knobs (New, environment-driven)
Budget is also a cost-control dial and must be environment-configurable without code changes.

Recommended environment variables (server-only; set explicitly in production; read only via centralised config helpers, never directly via process.env in client components):

- FX_RIBBON_BUDGET_DAILY_ALLOWANCE=800 (recommended prod value; do not rely on fallback defaults)
- FX_RIBBON_BUDGET_MINUTE_ALLOWANCE=60 (per-minute cap used by the server budget guard)
- FX_RIBBON_BUDGET_MINUTE_WINDOW_SECONDS=60 (rolling window used for the per-minute cap)

Current threshold ratios (implementation constants):

- warnAt = 0.70 × cap
- blockAt = 0.95 × cap

Important operational note:
Avoid defining the same env var in both .env and .env.local with different values.
If duplicates exist, Next’s precedence can produce confusing “why is it 5 minutes again?” behaviour. Keep one source of truth per variable for local dev.

7.3 Finance Ribbon, Heartbeat, and Pause

The Finance Ribbon is the central home of:
The market belt (FX row live, Commodities/Crypto later).
A global “live / paused” state for motion:
A small heartbeat indicator (dot or pill) that can pulse when live.
A pause button that stops polling animations and micro-pulses.

Implementation notes:
Live/paused state lives in a small shared helper/hook (e.g. live-motion.ts).
Ribbon row components read this state to decide whether to animate.
Any micro-animations are defined as reusable CSS/Tailwind classes.
The pause button is a genuine “calm mode” for the whole belt, not a gimmick.

Budget indicator beside Pause (New, minimal UX)
A small emoji-only indicator appears immediately next to Pause:

- 🛫 ok
- 🏖️ warning
- 🧳 blocked

Rules:

- Emoji-only (no visible wording). SR-only text allowed.
- Renderer-only: the ribbon does not compute thresholds, does not fetch, does not poll.
- The indicator is a pure passthrough of server-provided state (meta.budget.state).
- Pause remains a motion/polling calm-mode control. It does not override server authority decisions.

Provider health indicator (now + future-proofing)

- Current v2 operating model: one primary provider and no backups. The ribbon status badge (“live” / “cached” / “—”) is sufficient.
- When backup providers are reintroduced, the FX/API status emoji rule applies:

  - If primary API and both backups are working, show 2 emojis.
  - If primary API and only 1 backup is working, show 1 emoji.
  - If primary is down, do not pretend things are fine: render cached/— and surface a subtle “Live unavailable” banner.

Budget indicator vs provider-health indicator (New clarification)

- The budget indicator (🛫/🏖️/🧳) is about spend pressure and gating.
- The provider-health indicator emoji rule is about upstream provider chain health.
- These two signals must never contradict the “live/cached/—” status badge. The badge remains the primary user-facing status.

  7.4 FX Winner Arrow Logic (production spec)

Each FX chip can display a single green arrow pointing at the “winning” side of the pair.

**⚠️ KEY CONCEPT: The arrow is VERTICAL (always points upward ↑), indicating "strengthened". The arrow does NOT rotate or point left/right. What changes is the arrow's POSITION (left side vs right side of the pair), NOT its direction.**

Meaning
We answer: “Which currency has strengthened over our look-back horizon?”
Current decision:

- Horizon: 24-hour rolling baseline (24h change).

Arrow rules (hard rules)

- Exactly one arrow maximum per pair.
- No red arrow, no double arrows.
- Arrow is always green when shown.
- Arrow points at the currency that has strengthened over the horizon.

Arrow placement (the “side flip” rule)
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
  This avoids “binary on/off” feel.

Micro-timing delay (confirmation feel)
When delta crosses the threshold and would cause an arrow show/flip:
Wait ~500–800ms before applying the change.
This makes the UI feel human and confirmed rather than twitchy.

Stale-data behaviour (market closed / cached / upstream pause)

If quotes stop changing for any reason, the ribbon naturally becomes still:

- Winner-arrow stays put because deltas don’t change.

- No special mode exists; normal refresh/caching rules apply.

- Layout stays stable (show “—” for missing values, not empty gaps).

Arrow side-change transition (micro-transition)
When the arrow moves sides:

- Fade out → reposition → fade in.
  No hard jumps.

Hover explanation (optional, desktop-only)
Hovering the arrow may reveal an explanatory tooltip:
“GBP strengthened vs USD over 24h (+0.12%)”
Mobile: no hover behaviour; keep it clean.

7.4.1 Neutral state “alive” language (production spec)

Neutral is not static; it is controlled calm.

Neutral definition:

- |deltaPct| <= neutral threshold band for that pair-class.

Neutral visual behaviour:

- No winner-arrow.
- Gentle luminosity pulse on price text (breathing, ~6–10s, tiny opacity shift).
- Micro-tick animation still occurs on each price update.
- Optional background whisper may acknowledge tick direction without changing arrow state.

  7.5 Tests (High Level)

Key behaviours to test:
The FX row renders exactly N chips, where N is driven by fx.pairs.json (no hard-coded counts).
SSOT order is preserved end-to-end: fx.pairs.json order → gateway response order → UI render order.
Global pause stops motion and client polling (Calm Mode), but does not change server caching policy.
Winner arrow always appears at most once per pair and follows the winning currency when the configured orientation changes.
Winner arrow flips sides correctly (BASE vs QUOTE) and never duplicates.
Threshold behaviour prevents arrow jitter near neutral boundaries.
Hysteresis prevents “nervous pacing” at the threshold edge.
Centralised polling ensures multiple widgets do not multiply /api/fx requests.
Group A/B strategy always shows 8 chips and refreshes only 4 at a time while preserving SSOT ordering.

Budget guard tests (New, high-level)
Key behaviours to test:
Budget state is surfaced end-to-end (route → hook → container → ribbon) without recomputation client-side.
When budget is blocked, server authority does not create upstream calls (ride-cache only).
Trace remains observer-only and reports budget ledger + warnings/violations without causing upstream traffic.
UI indicator renders emoji-only beside Pause and does not alter polling behaviour.
Budget emoji mapping lock-in (required)

Add/keep a tiny integrity test that asserts the canonical mapping:
ok🛫 / warning🏖️ / blocked🧳

This test must validate the SSOT Emoji Bank mapping (emoji-bank.json), not a re-declared constant in a module.

FX Picker & Configuration (Paid Only, SSOT-Compatible)

The paid experience introduces a proper configuration UI to adjust the homepage FX set, but the homepage still remains SSOT-driven:

- The picker edits the underlying configuration source (directly, or by writing to a persisted config that compiles into the same SSOT shape).
- The homepage ribbon remains a pure consumer: it renders whatever SSOT says, in SSOT order, at whatever count SSOT defines.

This keeps the mental model brutally simple:
Edit fx.pairs.json (or the paid picker that writes SSOT) → refresh → homepage updates.
No extra hidden files, no “magic” hard-coded numbers.

What Happens When APIs Die (Live → Cached → Unavailable Rule)

Your rule: never invent market data.
The homepage ribbon does not display sample/demo prices.

Flow:
Ribbon tries to fetch live FX.
If the FX provider fails completely:

1. If valid cache exists:
   Show subtle banner above the ribbon:
   “Live FX temporarily unavailable – showing cached prices.”
   Ribbon renders cached values (stable layout; chip count unchanged).
2. If no valid cache exists:
   Show subtle banner above the ribbon:
   “Live FX temporarily unavailable.”
   Ribbon renders “—” for values (stable layout; chip count unchanged).

When live comes back, it silently swaps to live values again.

Budget-blocked behaviour reminder (New)
Budget blocking is not “APIs died”; it is a deliberate safety rail to prevent overspend.
The ribbon should continue to render cached data where possible and remain visually stable.
The emoji indicator beside Pause communicates budget gating state without adding any extra UI noise.

FX Observability & Dev Diagnostics (Trace Endpoint)

Purpose
When something breaks, we want answers in seconds:

- Is the upstream being hit once (batched) or many times (regression)?
- Is the cache working?
- Are null prices caused by missing symbol mappings (normalisation/lookup), not “bad APIs”?
- Did SSOT change invalidate the cache correctly?

Trace endpoint principles

- The trace endpoint must never trigger an upstream provider call.
  It reports the latest internal snapshot (cache state, last decision, missing symbols diagnostics).
- It is safe to call repeatedly during development.
  It does not “eat” upstream credits.
- It must be possible to disable or hide trace UI in production.

Budget observability (New)
Trace is the place where budget pressure becomes explainable without guesswork.
Trace must expose:

- The current server-computed budget state (ok/warning/blocked).
- The ledger snapshot: daily usage and rolling minute usage.
- Warnings/violations explaining why the state is warning/blocked (e.g. “minute cap hit”, “daily block threshold reached”).
- Confirmation that trace is observer-only (no upstream triggered).

Trace snapshot should include (minimum)

- Upstream calls count (batched calls)
- Ribbon calls count (internal route hits)
- TTL value (seconds)
- Cache hit/miss and expiry timestamp
- Last decision (“cache_hit”, “cache_miss”, “cooldown_ride_cache”, etc.)
- Last fetch timestamp
- Missing symbols diagnostics:
  Missing symbols count
  Missing symbols list (SSOT symbols not found in provider results / map)

Budget snapshot additions (New, minimum)

- budget.state (ok/warning/blocked) as computed by Refresh Authority
- budget indicator (emoji convenience is optional; state is required)
- daily allowance (default 800/day) + used + remaining + warnAt + blockAt
- rolling per-minute allowance (default 8/min) + used + remaining + warnAt + blockAt + windowSeconds
- warnings[] (human-auditable list)
- violations[] (human-auditable list)

Dev-only display policy

- Any on-page “FX Dev Diagnostics” panel is for local/dev by default.
- Production (www.promagen.com) should not surface developer diagnostics unless explicitly enabled by a secure flag.
- The trace endpoint may remain available for operational debugging, but UI exposure is controlled.

Developer Notes / Implementation Hints

You want this wired into your existing setup as:
A mock useTier implementation (for local dev) so you can flip between free and paid.
A full file for the configuration UI (FX picker drawer) later.
A FinanceRibbon that:
Stays centred.
Always live-first.
Always renders from SSOT (fx.pairs.json).
Never uses synthetic/demo prices.
Never relies on a hard-coded chip count.

Budget mission wiring hints (New)

- Budget computation belongs in the Refresh Authority path (providers.ts), not in UI, not in routes.
- /api/fx route should only reflect budget meta (and optionally reflective headers), never compute it.
- /api/fx/trace route must read budget snapshot helpers and return ledger + warnings/violations without upstream calls.
- UI should render the emoji beside Pause and stay renderer-only.

End result:
Free = SSOT default FX set (currently 8 by content).
Paid = user-curated FX set (count and composition still defined by SSOT).
Everything else on the page remains unchanged: rails and leaderboard stay put, and the three-column layout remains calm and predictable.

## Stock Exchange Cards (Free Tier Default)

The homepage includes a grid of stock exchange cards, arranged **east → west** by longitude (invariant).

### Card Structure (Fixed Proportional 3-Column Layout)

Each exchange card is a unified component with **double height** (`py-4`) and a **fixed proportional 3-column grid** layout (50%/25%/25%):

```
┌───────────────────────────────────────────────────────────────────────────┐
│        50% (2fr)              │     25% (1fr)    │    25% (1fr)           │
│     LEFT-ALIGNED              │     CENTERED     │    CENTERED            │
│                               │                  │                        │
│  New Zealand Exchange (NZX)   │                  │                        │
│  Wellington           🇳🇿     │    14:23:45      │      18°C              │
│                      (2x)     │     ● Open       │       ☀️               │
└───────────────────────────────────────────────────────────────────────────┘
```

#### Left Column (50%) — Exchange Info, LEFT-ALIGNED

- **Exchange name** (full name, wraps to 2-3 lines if needed, font size unchanged)
- **City + Flag row:**
  - City name (left)
  - Flag (right of city, 2x size = 24px, small gap between)
  - Flag derived from `iso2` field

#### Center Column (25%) — Time & Status, CENTERED

- **Row 1:** Minimalist analog clock (SVG, 44px diameter)
  - 3 hands: hour (short, thick), minute (medium), second (thin, red)
  - 12 tick marks (thicker at 12, 3, 6, 9)
  - Smooth hand movement (no snapping)
  - Updates every second using client-side timezone conversion
  - Uses `Intl.DateTimeFormat` with exchange's `tz` field (IANA timezone)
  - Respects `prefers-reduced-motion` (hides second hand)
- **Row 2:** Market status indicator
  - **Open**: Emerald dot (`bg-emerald-500`) + "Open"
  - **Closed**: Rose dot (`bg-rose-500`) + "Closed"
  - Status derived from simple time-based logic using exchange's `tz` and `hoursTemplate`
  - Future: API-driven status including holidays, lunch breaks, special events

#### Right Column (25%) — Weather, CENTERED

- **Row 1:** Temperature in Celsius (e.g., `18°C`)
- **Row 2:** Weather condition emoji (e.g., ☀️ 🌧️ ❄️ 💨)
- Data source: API (wired in later; no demo mode)
- When weather data unavailable:
  - Temperature shows `—`
  - Emoji shows random weather emoji from SSOT (`emoji-bank.json` → `weather` group)

### Component Location

All exchange card components live in:

```
src/components/exchanges/
├── exchange-card.tsx          # Main unified card component
├── index.ts                   # Public exports
├── types.ts                   # Unified ExchangeCardData type
├── time/
│   ├── analog-clock.tsx       # Minimalist SVG analog clock (3 hands)
│   ├── exchange-clock.tsx     # Digital clock (legacy, still exported)
│   └── market-status.tsx      # Open/closed indicator
├── weather/
│   ├── exchange-temp.tsx      # Temperature display
│   └── exchange-condition.tsx # Weather emoji display
└── __tests__/
    ├── exchange-clock.test.tsx
    └── exchange-card.test.tsx
```

### Data Source

Exchange cards are driven by:

- **Free tier:** `src/data/exchanges/exchanges.selected.json` (12 exchanges)
- **Paid tier:** User-selected exchanges from `exchanges.catalog.json`

### Weather Emoji SSOT

Weather condition emojis are sourced from `src/data/emoji/emoji-bank.json` under the `weather` key.
When API weather is unavailable, a random emoji from this group is displayed.

Available weather emojis:

- sunny: ☀️
- partly_cloudy: ⛅
- cloudy: ☁️
- rain: 🌧️
- thunder: ⛈️
- drizzle: 🌦️
- snow: 🌨️
- wind: 💨
- fog: 🌫️
- tornado: 🌪️
- hail: 🧊
- hot: 🥵
- cold: 🥶
- umbrella: ☔
- barometer: 🌡️
- rainbow: 🌈
- sunrise: 🌅
- sunset: 🌇
- moon: 🌙
- stars: 🌟
- eclipse: 🌒

### Invariants (apply to all users)

- **Ordering:** Always by longitude (east → west)
- **Clock format:** Always 24-hour (`HH:MM:SS`)
- **Temperature:** Always Celsius
- **No demo data:** Weather shows `—` for temp when API unavailable (never fake temperatures)
- **Layout:** CSS Grid with fixed proportional columns (50%/25%/25%), double height (`py-4`), no visible column dividers
- **Column alignment:** Left column left-aligned, center and right columns centered
- **Flag size:** 2x default (24px), positioned right of city
- **Status colours:** Emerald (open), Rose (closed) — from existing palette

### Layout Strategy (Fixed Proportional Columns)

The exchange card uses **CSS Grid with fixed proportional columns** to ensure vertical alignment across all cards:

```
┌───────────────────────────────────────────────────────────────────────────┐
│        50% (2fr)              │     25% (1fr)    │    25% (1fr)           │
│     LEFT-ALIGNED              │     CENTERED     │    CENTERED            │
│                               │                  │                        │
│  New Zealand Exchange (NZX)   │                  │                        │
│  Wellington           🇳🇿     │    14:23:45      │      18°C              │
│                      (2x)     │     ● Open       │       ☀️               │
└───────────────────────────────────────────────────────────────────────────┘
```

**Key insight:** Fixed proportional columns (2fr/1fr/1fr = 50%/25%/25%) ensure that:

- All Time columns align vertically across all cards
- All Weather columns align vertically across all cards
- Proportions stay constant regardless of card width or screen size

**CSS implementation:**

```tsx
// Fixed proportional grid: 50%/25%/25%
<div className="grid grid-cols-[2fr_1fr_1fr] items-center ...">
  {/* Column 1 (50%): Exchange info - LEFT ALIGNED */}
  <div className="min-w-0 pr-2">
    <p>Exchange Name (wraps if long)</p>
    <div className="flex items-center gap-2">
      <span>City</span>
      <Flag size={24} /> {/* 2x size, right of city */}
    </div>
  </div>

  {/* Column 2 (25%): Time - CENTERED */}
  <div className="flex flex-col items-center">
    <AnalogClock tz={tz} size={44} /> {/* Minimalist SVG clock */}
    <MarketStatusIndicator />
  </div>

  {/* Column 3 (25%): Weather - CENTERED */}
  <div className="flex flex-col items-center">
    <ExchangeTemp />
    <ExchangeCondition />
  </div>
</div>
```

**Why this works:**

- `2fr` = 50% of card width (always)
- `1fr` = 25% of card width each (always)
- Proportions are fixed, so columns stack perfectly across all cards
- Long exchange names wrap within their 50% allocation

**Previous approaches (broken):**

- `justify-between` pushed content to edges, gaps varied based on content width
- `auto` columns caused columns to be different widths per card
- `grid-cols-[auto_1fr_auto_1fr_auto]` equal-gap approach still had misaligned columns

Authority: `docs/authority/code-standard.md` §6 (Fixed Proportional Column Layout)

### Performance Notes

- **Clock update:** Every second (via `setInterval`)
- **Clock rendering:** Pure SVG, zero external dependencies
- **Battery impact:** Negligible (~0.5% per hour)
- **Server load:** Zero (clocks are client-side)
- **Reduced motion:** Second hand hidden when `prefers-reduced-motion` is set
- **Network calls:** Weather via API when implemented

### Unified Exchange Type

```typescript
export type ExchangeCardData = {
  id: string;
  name: string;
  city: string;
  countryCode: string;
  tz: string;
  hoursTemplate?: string;
  // Weather (optional, from API)
  weather?: {
    tempC: number | null;
    emoji: string | null;
  } | null;
};
```

### Symmetry & Uniformity

Every exchange card has **identical structure**. No special cases, no exceptions.
This maintains visual symmetry and follows the principle: _"Uniformity over customization."_

### Files to Delete (after migration)

After the unified component is deployed, these files should be deleted:

- `src/components/home/rails/exchange-card.tsx`
- `src/components/ribbon/exchange-card.tsx`

Update imports in:

- `src/components/home/rails/exchange-column.tsx`
- `src/components/ribbon/exchange-rail.tsx`

---

## Component Architecture Update (Dec 31, 2025)

### Layout Components

| Component                                   | Type       | Purpose                                                            |
| ------------------------------------------- | ---------- | ------------------------------------------------------------------ |
| `src/app/layout.tsx`                        | Server     | Root layout — viewport-locked (`h-dvh overflow-hidden`), no footer |
| `src/components/layout/homepage-grid.tsx`   | **Client** | Three-column grid with scroll sync, contains footer                |
| `src/components/core/provenance-footer.tsx` | Server     | Footer — now rendered inside HomepageGrid                          |

### Key Implementation Files

| File                                      | Purpose                                                            |
| ----------------------------------------- | ------------------------------------------------------------------ |
| `src/app/globals.css`                     | Viewport lock (`overflow: hidden !important`), scrollbar utilities |
| `src/components/ribbon/exchange-list.tsx` | Exchange cards list (server component)                             |

### Scrollbar Utility Classes (globals.css)

```css
/* Webkit (Chrome, Safari, Edge) */
.scrollbar-thin::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.scrollbar-track-transparent::-webkit-scrollbar-track {
  background: transparent;
}

.scrollbar-thumb-white\/20::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}

.hover\:scrollbar-thumb-white\/30:hover::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.3);
}

/* Firefox fallback */
.scrollbar-thin {
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
}
```

### Why HomepageGrid is a Client Component

The synchronized scroll feature requires browser APIs that are only available in client components:

- `useRef` — for DOM element references
- `onScroll` — for scroll event handlers
- `requestAnimationFrame` — for smooth sync updates

Server components cannot use these hooks, so `HomepageGrid` must be a client component.

### Footer Placement Change

**Before:** Footer in `layout.tsx` outside main content
**After:** Footer inside `HomepageGrid` as final flex item

This change was required because:

1. Viewport lock (`h-dvh overflow-hidden`) requires all content in one container
2. Footer outside the container would push content beyond viewport
3. Footer inside can use `shrink-0` to maintain fixed height at bottom

---

## Market Pulse v2.1 Feature (Updated Jan 8, 2026)

### Overview

**Tagline:** _"The bridge comes alive when markets move."_

Market Pulse is a visual animation layer that connects stock exchanges to AI providers headquartered in the same city. Unlike static diagrams, it only appears during market transition events. When markets are dormant, the interface is clean and quiet. When markets are transitioning, the bridge between them literally lights up with flowing energy.

**Purpose:** Reinforces Promagen's core concept — "a bridge between markets and imagination" — with live visual feedback that appears only when meaningful.

### What's New in v2.1 (Jan 8, 2026)

| Change | Before (v2.0) | After (v2.1) |
|--------|---------------|--------------|
| **Connection system** | Hardcoded `CITY_CONNECTIONS` array | Dynamic: derived from `exchange.city === provider.hqCity` |
| **City matching** | Exact string match only | Normalized matching with aliases (Surry Hills → Sydney) |
| **Visual effects** | Bezier curves + particles | **Option 3+4 Combined**: Card glow + traveling balls |
| **Animation speed** | ~2s crossing | ~4s crossing (half speed, more elegant) |
| **Overlay system** | SVG with path elements | DOM-based with absolute positioning |
| **CSS class** | Multiple row classes | Single `.market-pulse-active` class |

### Core Philosophy

- **Dormant by default**: Clean interface for ~99% of the day
- **Event-driven activation**: Visual effects only appear ±1 minute around market opens/closes
- **Multi-session support**: Exchanges with lunch breaks (Tokyo, Hong Kong) fire 4 events per day
- **Continent-specific theming**: Each connection uses colors based on the exchange's continent
- **Zero hardcoding**: Add providers/exchanges to JSON files and connections auto-update

### Visual Effects (Option 3+4 Combined)

#### Option 3: Synchronized Card Glow

When an exchange is within ±1 minute of open/close:
- Exchange cards receive `.market-pulse-active` class
- Connected provider rows receive `.market-pulse-active` class
- Both elements glow with continent-appropriate color
- Indicator dots appear on card edges (via CSS `::after` pseudo-element)

#### Option 4: Traveling Balls

Glowing energy balls travel between connected exchanges and providers:
- **Spawn rate**: Every 400ms during active window
- **Travel time**: ~4 seconds crossing (0.0125 progress per 20ms frame)
- **Direction**: Random (50% exchange→provider, 50% provider→exchange)
- **Max concurrent**: 20 dots (older dots removed)
- **Fade zones**: 8% at each end for smooth appear/disappear

**Ball anatomy:**
```
┌─────────────────────────────────────────────┐
│  ╭───╮                                      │
│  │ ● │ ═══════════ (trail)                  │
│  ╰───╯                                      │
│    │                                        │
│    ├── Outer glow (radial gradient, 60% α)  │
│    ├── Ball core (16px, solid continent)    │
│    ├── Inner glow (box-shadow)              │
│    └── White hot center (8px, 80% opacity)  │
└─────────────────────────────────────────────┘
```

### Dynamic City Connections (v2.1 Architecture)

**CRITICAL CHANGE:** City connections are no longer hardcoded. They are derived at runtime.

#### How It Works

```
Exchange (exchanges.catalog.json)     Provider (providers.json)
┌──────────────────────────────┐     ┌──────────────────────────────┐
│ {                            │     │ {                            │
│   "id": "asx-sydney",        │     │   "id": "canva",             │
│   "city": "Sydney",          │ ══► │   "hqCity": "Surry Hills",   │
│   "iso2": "AU"               │     │   ...                        │
│ }                            │     │ }                            │
└──────────────────────────────┘     └──────────────────────────────┘
                │                                    │
                │         normalizeCity()           │
                │      "Surry Hills" → "Sydney"     │
                │                                   │
                └─────────────► MATCH ◄─────────────┘
```

#### City Normalization (Aliases)

The system handles city name variations through normalization:

| Provider City | Normalized To | Reason |
|---------------|---------------|--------|
| `Surry Hills` | `Sydney` | Canva uses suburb name |
| `Mountain View` | `San Francisco` | Google HQ (Bay Area) |
| `Menlo Park` | `San Francisco` | Meta HQ (Bay Area) |
| `Palo Alto` | `San Francisco` | Hotpot HQ (Bay Area) |
| `San Jose` | `San Francisco` | Adobe HQ (Bay Area) |
| `Redmond` | `Seattle` | Microsoft HQ (kept separate) |

**Source:** `src/data/city-connections.ts` → `CITY_ALIASES`

#### Dynamic Connection Generation

```typescript
// src/data/city-connections.ts

export function getConnectionsForExchange(exchangeId: string): CityConnection[] {
  const exchange = EXCHANGES.find((e) => e.id === exchangeId);
  if (!exchange) return [];

  const providers = getProvidersInCity(exchange.city);
  if (providers.length === 0) return [];

  const continent = getContinentFromCountryCode(exchange.iso2);

  return providers.map((provider) => ({
    exchangeId,
    providerId: provider.id,
    city: exchange.city,
    continent,
  }));
}
```

**Key functions:**
- `getConnectionsForExchange(exchangeId)` — Returns all providers in same city
- `getConnectionsForProvider(providerId)` — Returns all exchanges in same city
- `getProvidersInCity(city)` — Returns providers with matching `hqCity`
- `isProviderConnected(providerId)` — Boolean check for connection existence
- `getProviderConnectionInfo(providerId)` — Returns city, continent, and color

### Current City Connections (Dynamic — as of Jan 8, 2026)

Connections are **derived at runtime**. This table shows known matches based on current data:

| City | Continent | Exchange(s) | AI Provider(s) |
|------|-----------|-------------|----------------|
| **Sydney** | Oceania | ASX, Chi-X Australia, NSX | Leonardo AI, Canva (via Surry Hills alias) |
| **London** | Europe | LSE, Aquis, LSEG | Stability AI, DreamStudio, Dreamlike.art |
| **New York** | Americas | NYSE, NASDAQ | Runway ML, Artbreeder |
| **San Francisco** | Americas | — | OpenAI, Anthropic, Midjourney, Replicate, etc. (via Bay Area aliases) |
| **Hong Kong** | Asia | HKEX | Fotor, Artguru, PicWish |
| **Toronto** | Americas | TSX | Ideogram |
| **Paris** | Europe | Euronext Paris, SBF | Clipdrop |
| **Taipei** | Asia | TWSE | MyEdit (CyberLink) |
| **Vienna** | Europe | Wiener Börse (×2) | Remove.bg (Kaleido AI) |
| **Warsaw** | Europe | GPW, WSE NewConnect | Getimg.ai |

**Note:** San Francisco has no direct exchange but Bay Area providers connect via aliases when a San Francisco exchange is added.

### Adding New Connections

**To add a new city connection:**

1. **If adding an exchange:** Add to `exchanges.catalog.json` with correct `city` field
2. **If adding a provider:** Add to `providers.json` with correct `hqCity` field
3. **If city name varies:** Add alias to `CITY_ALIASES` in `city-connections.ts`
4. **No code changes needed** — connections derive automatically

**Example: Adding a Melbourne provider**
```json
// providers.json
{
  "id": "new-provider",
  "name": "Melbourne AI",
  "hqCity": "Melbourne",
  ...
}
```
→ Automatically connects to any exchanges with `city: "Melbourne"`

### Continent Color Palette

| Continent | Primary Color | Glow Color | CSS Variable |
|-----------|---------------|------------|--------------|
| **Oceania** | Cyan `#22d3ee` | `rgba(34, 211, 238, 0.6)` | `--pulse-color` |
| **Asia** | Gold `#fbbf24` | `rgba(251, 191, 36, 0.6)` | `--pulse-color` |
| **Europe** | Blue `#3b82f6` | `rgba(59, 130, 246, 0.6)` | `--pulse-color` |
| **Americas** | Emerald `#10b981` | `rgba(16, 185, 129, 0.6)` | `--pulse-color` |
| **Africa** | Orange `#f97316` | `rgba(249, 115, 22, 0.6)` | `--pulse-color` |
| **Middle East** | Purple `#a855f7` | `rgba(168, 85, 247, 0.6)` | `--pulse-color` |

**Country → Continent mapping:** `src/data/city-connections.ts` → `COUNTRY_TO_CONTINENT`

### Multi-Session Exchanges

Some exchanges have **lunch breaks** and therefore fire **4 events per day** instead of 2:

| Exchange | Morning Open | Lunch Close | Afternoon Open | Final Close |
|----------|--------------|-------------|----------------|-------------|
| **Hong Kong (HKEX)** | 09:30 | 12:00 | 13:00 | 16:00 |
| **Tokyo (TSE)** | 09:00 | 11:30 | 12:30 | 15:00 |
| **China (SSE/SZSE)** | 09:30 | 11:30 | 13:00 | 15:00 |

Each session boundary triggers its own ±1 minute event window with full visual effects.

### Technical Architecture (v2.1)

**Three-layer system:**

1. **Data Layer:** `src/data/city-connections.ts`
   - Dynamic connection generator (no hardcoding)
   - City normalization via `CITY_ALIASES`
   - `CONTINENT_COLORS` color definitions
   - Helper functions: `getConnectionsForExchange()`, `getProvidersInCity()`, etc.
   - `COUNTRY_TO_CONTINENT` mapping (60+ countries)

2. **Detection Layer:** `src/hooks/use-market-pulse.ts`
   - Checks market status every 1 second for accuracy
   - Detects ±1 minute event windows around all session opens/closes
   - Returns `pulseContexts` Map with state and progress for each exchange
   - Returns `activeExchangeIds` array (exchanges not in dormant state)
   - Fires `onBurst` callback when opening/closing events occur

3. **Rendering Layer:** `src/components/market-pulse/market-pulse-overlay.tsx`
   - Fixed overlay with `pointer-events: none`
   - Calculates positions using `getBoundingClientRect()`
   - Spawns traveling dots every 400ms
   - Animates dots using `requestAnimationFrame`
   - Applies `.market-pulse-active` class dynamically

**DOM requirements:**
- Exchange cards must have `data-exchange-id="{id}"` attribute
- Provider rows must have `data-provider-id="{id}"` attribute

### Component Props Interface

```typescript
// src/components/market-pulse/market-pulse-overlay.tsx

export type MarketPulseOverlayProps = {
  containerRef: RefObject<HTMLDivElement | null>;
  leftRailRef: RefObject<HTMLDivElement | null>;
  rightRailRef: RefObject<HTMLDivElement | null>;
  providersRef: RefObject<HTMLDivElement | null>;
  selectedExchangeIds: string[];
  displayedProviderIds: string[];
  pulseContexts: Map<string, ExchangePulseContext>;
  activeExchangeIds: string[];
};
```

### CSS Classes (globals.css)

```css
/* Card glow animation */
@keyframes market-pulse-card-glow {
  0%, 100% {
    box-shadow: 0 0 0 0 transparent;
  }
  50% {
    box-shadow: 0 0 20px 4px var(--pulse-color, #3b82f6);
  }
}

/* Indicator dot glow */
@keyframes market-pulse-dot-glow {
  0%, 100% {
    opacity: 0.4;
    transform: scale(0.8);
  }
  50% {
    opacity: 1;
    transform: scale(1);
  }
}

/* Active pulse state for cards and rows */
.market-pulse-active {
  position: relative;
  --pulse-color: #3b82f6; /* Default blue, overridden per continent */
  animation: market-pulse-card-glow 3s ease-in-out infinite;
}

/* Indicator dot on exchange cards (right edge) */
.market-pulse-active[data-exchange-id]::after {
  content: '';
  position: absolute;
  right: -4px;
  top: 50%;
  transform: translateY(-50%);
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: var(--pulse-color);
  animation: market-pulse-dot-glow 3s ease-in-out infinite;
}

/* Indicator dot on provider rows (left edge) */
.market-pulse-active[data-provider-id]::before {
  content: '';
  position: absolute;
  left: -4px;
  top: 50%;
  transform: translateY(-50%);
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: var(--pulse-color);
  animation: market-pulse-dot-glow 3s ease-in-out infinite;
}

/* Reduced motion: static glow instead of animation */
@media (prefers-reduced-motion: reduce) {
  .market-pulse-active {
    animation: none;
    box-shadow: 0 0 15px 2px var(--pulse-color, #3b82f6);
  }
  .market-pulse-active[data-exchange-id]::after,
  .market-pulse-active[data-provider-id]::before {
    animation: none;
    opacity: 1;
    transform: translateY(-50%) scale(1);
  }
}
```

### Integration with HomepageGrid

```tsx
// src/components/layout/homepage-grid.tsx
import { useMarketPulse } from '@/hooks/use-market-pulse';
import { MarketPulseOverlay } from '@/components/market-pulse';

export default function HomepageGrid({
  exchanges = [],
  displayedProviderIds = [],
}: HomepageGridProps) {
  const selectedExchangeIds = exchanges.map((e) => e.id);

  // Market Pulse v2.0 hook (detection layer)
  const { pulseContexts, activeExchangeIds } = useMarketPulse({
    exchanges,
    onBurst: (context) => {
      console.log(`${context.exchangeId} is ${context.state}`);
    },
  });

  return (
    <div ref={containerRef} className="relative">
      {/* ... layout ... */}
      <MarketPulseOverlay
        containerRef={containerRef}
        leftRailRef={leftRef}
        rightRailRef={rightRef}
        providersRef={providersRef}
        selectedExchangeIds={selectedExchangeIds}
        displayedProviderIds={displayedProviderIds}
        pulseContexts={pulseContexts}
        activeExchangeIds={activeExchangeIds}
      />
    </div>
  );
}
```

### What Was Removed/Changed in v2.1

| Element | v2.0 | v2.1 | Reason |
|---------|------|------|--------|
| **`CITY_CONNECTIONS` array** | Hardcoded static array | `[]` (empty, deprecated) | Dynamic generation preferred |
| **Bezier curves** | SVG path elements | Removed | Replaced by traveling dots |
| **SVG overlay** | `<svg>` element | `<div>` element | Simpler DOM-based approach |
| **Row breathing classes** | `.market-pulse-row-breathing` | `.market-pulse-active` | Single unified class |
| **Flash classes** | `.market-pulse-row-opening/closing` | Removed | Card glow handles transitions |

### Accessibility

- **Reduced motion**: Users with `prefers-reduced-motion` see static glows instead of animations
- **Aria-hidden**: All visual effects are decorative (`aria-hidden="true"`)
- **No seizure risk**: Maximum animation rate well below 3Hz threshold
- **No content dependency**: Feature is purely decorative; no information is lost if disabled

### Performance Notes

- Fixed overlay instead of per-element animations
- Dots use `requestAnimationFrame` for smooth 60fps
- Position calculations cached, recalculated only on scroll/resize
- Nothing rendered when dormant (zero overhead for ~99% of the day)
- Max 20 concurrent dots (oldest removed when limit reached)
- Status checks every 1 second (minimal CPU impact)

### A Day in the Life (Example: Sydney)

| Time (AEDT) | State | Visual |
|-------------|-------|--------|
| 09:59 | Pre-Open | Cards start glowing cyan. Indicator dots appear. Slow balls travel. |
| 10:00 | Opening | ASX OPENS. Glow intensifies. Balls spawn rapidly. |
| 10:01 | Dormant | Event window ends. Glow fades. Interface clean. |
| 15:59 | Pre-Close | Cards glow again. Balls travel in both directions. |
| 16:00 | Closing | ASX CLOSES. Final burst. All effects fade out. |
| 16:01 | Dormant | Clean interface until tomorrow. |

---

**Last updated:** January 8, 2026

**Changelog:**
- **8 Jan 2026:** Market Pulse v2.1 — Dynamic city connections (no hardcoding), Option 3+4 combined visual effects, city normalization with aliases, unified `.market-pulse-active` CSS class.
- **2 Jan 2026:** Added vote button to Image Quality column. Added community voting rules and implementation references.
