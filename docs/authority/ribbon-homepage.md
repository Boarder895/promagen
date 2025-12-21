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

Page canvas
Background: deep, subtle dark gradient.
min-height: 100vh so the page always covers the full viewport.
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

## Pair label formatting (test-locked)

The FX pair separator standard is **non-negotiable**.

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
Columns:
Rank
Provider name
Score
Trend
Tags

Rows:
Sorted by score (highest first).
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
- All components (ribbon, mini widgets, cards) read from the same shared store/context.
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
Global pause stops motion but not data refresh.
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

Page canvas
Background: deep, subtle dark gradient.
min-height: 100vh so the page always covers the full viewport.
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
- The homepage ribbon imports the emojis via the emoji helper layer (src/data/emoji/\*).
- No “BUDGET*EMOJI*\*” constants are permitted in providers/routes/components.

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
Columns:
Rank
Provider name
Score
Trend
Tags

Rows:
Sorted by score (highest first).
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
- All components (ribbon, mini widgets, cards) read from the same shared store/context.
- Adding more widgets must not multiply /api/fx calls.
- Pause (“calm mode”) stops motion and client polling, but does not change server-side caching policy.

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
Global pause stops motion but not data refresh.
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
