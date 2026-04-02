# Right-Hand Rail — Pipeline X-Ray (The Glass Case)

**Version:** 1.2.0
**Created:** 2 April 2026
**Updated:** 2 April 2026
**Owner:** Promagen
**Status:** APPROVED — v1.2.0 final review revision. Architecture locked. Ready to build.
**Scope:** Prompt Lab (`/studio/playground`) right rail ONLY. Homepage and World Context right rails remain exchange-based — untouched.
**Authority:** This document defines the architecture, visual design, animation system, and build order for the Prompt Lab's right-hand rail replacement — a real-time visualisation of the three-call pipeline, styled as a WWII-era decryption machine viewed through glass.

> **Cross-references:**
>
> - `lefthand-rail.md` v1.2.0 — Companion doc for the left-hand Platform Match + Scoring rail
> - `ai-disguise.md` v5.0.0 — Disguise principle, algorithm naming, Call 1–3 architecture, 165 algorithm names
> - `prompt-lab.md` v4.0.0 — Prompt Lab routes, component table, data flow
> - `prompt-optimizer.md` v6.0.0 — Call 3 architecture, 43 independent builders, `changes[]` response field
> - `human-factors.md` v1.1.0 — Anticipatory Dopamine, Temporal Compression, Curiosity Gap, Zeigarnik Effect, Optimal Stimulation
> - `code-standard.md` v4.0 — clamp(), no grey text, co-located animations, cursor-pointer, prefers-reduced-motion
> - `best-working-practice.md` — Human Factors Gate, animation-as-communication, SSOT discipline
> - `prompt-colours.ts` — 13-colour category SSOT
> - `algorithm-names.ts` — 165 cycling names + 3 finale names

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [The Visual Concept — "The Glass Case"](#2-the-visual-concept--the-glass-case)
3. [What It Replaces](#3-what-it-replaces)
4. [Human Factors Declaration](#4-human-factors-declaration)
5. [Data Sources — Zero New API Calls](#5-data-sources--zero-new-api-calls)
6. [The Three Phases](#6-the-three-phases)
7. [Phase 0 — Dormant Machine (Idle State)](#7-phase-0--dormant-machine-idle-state)
8. [Phase 1 — The Decoder (Call 1: Category Detection)](#8-phase-1--the-decoder-call-1-category-detection)
9. [Phase 2 — The Switchboard (Call 2: Tier Generation)](#9-phase-2--the-switchboard-call-2-tier-generation)
10. [Phase 3 — The Alignment (Call 3: Platform Optimisation)](#10-phase-3--the-alignment-call-3-platform-optimisation)
11. [The Glass Case — Container Aesthetic](#11-the-glass-case--container-aesthetic)
12. [Colour Palette — Brass, Copper, and Amber](#12-colour-palette--brass-copper-and-amber)
13. [Animation System — Mechanical Motion](#13-animation-system--mechanical-motion)
14. [The Teletype — Text Reveal System](#14-the-teletype--text-reveal-system)
15. [Edge Cases](#15-edge-cases)
16. [Accessibility](#16-accessibility)
17. [File Map](#17-file-map)
18. [Build Order](#18-build-order)
19. [Non-Regression Rules](#19-non-regression-rules)
20. [Decisions Log](#20-decisions-log)

---

## 1. Purpose

The Prompt Lab's right rail currently displays stock exchange cards. This document replaces them with a real-time visualisation of the three-call pipeline — a machine that lets the user peer through glass into the workings of the "1,001 algorithms."

The X-Ray doesn't just report what happened. It performs. Every API call triggers mechanical animations — rotors spinning, cables connecting, cogs aligning — that make a 2–4 second wait feel like watching precision engineering. The user sees the machine work on their specific prompt, producing output unique to their input. No two runs look the same because no two prompts are the same.

**The metaphor:** An Enigma-era decryption machine in a glass display case. You can see the rotors, the wiring, the mechanical counters. When it processes, the rotors spin, the counters flip, the cables light up. When it finishes, everything clicks into alignment and the result appears on the ticker tape.

---

## 2. The Visual Concept — "The Glass Case"

### Reference Aesthetic

The visual language draws from three WWII-era machines:

1. **The Enigma Machine** — Rotors that spin independently, each locking into a different position. The category detection rotors each find their setting.

2. **The Bombe (Turing's decryption machine)** — Banks of interconnected drums processing in parallel. The four tier generation "drums" spin simultaneously, each producing different output.

3. **Colossus (first electronic computer)** — Patch cables, valve indicators, mechanical counters. The optimisation phase shows cables routing to the selected platform, valves lighting up as checks pass.

### What This Is NOT

This is not steampunk. No excessive cogs, no leather textures, no sepia filters. The aesthetic is **precision military engineering** — clean, purposeful, every element has a function. Think Bletchley Park, not Jules Verne. The machine is serious. The glass case makes it beautiful.

---

## 3. What It Replaces

**Removed from Prompt Lab page only:**
- `ReorderedExchangeRails` (right content)
- `ExchangeList` component rendering in the right rail
- All exchange-related data flow for the right rail in `playground-page-client.tsx`

**NOT removed:** Exchange rails on homepage, World Context, Pro page — all untouched.

The `HomepageGrid` three-column grid stays. New content passes via the existing `rightContent` prop.

---

## 4. Human Factors Declaration

| Element | Primary Factor | Why |
|---|---|---|
| Dormant machine with barely-moving parts | Zeigarnik Effect (§4) | The incomplete, waiting machine creates psychological tension — it wants to run. The user wants to see it run. |
| Phase 1 rotor cascade | Anticipatory Dopamine (§3) | Each rotor locking into place is a micro-reward. The cascade builds: "another one found, and another..." The user counts the categories detected. |
| Phase 2 parallel drum spin | Temporal Compression (§6) | Four elements processing simultaneously occupies working memory across multiple visual focal points. A 2-second wait feels like half a second. |
| Phase 3 cable routing + cog alignment | Optimal Stimulation Theory (§5) | The most complex visual phase arrives at the moment the user has been waiting longest. Complexity peaks at maximum anticipation. |
| Unique output per prompt | Variable Reward (§2) | Different prompts produce different rotor positions, different cable routes, different counter values. Same machine, unpredictable output. |
| Ticker tape text reveal | Curiosity Gap (§1) | Characters appear one by one. The user can read ahead slightly but can't see the full message until the tape finishes. |
| Glass case reflection | Aesthetic-Usability Effect (§14) | The glass gives the machine perceived value. The same components without the glass look like a dashboard. With the glass, they look like a museum exhibit. |

**Anti-pattern:** Repetitive animations. If the user sees the exact same rotor sequence every time, the Variable Reward dies. Rotor positions, drum spin durations, cable routing paths, and counter values must all derive from the actual prompt data — making every run visually unique.

---

## 5. Data Sources — Zero New API Calls

The X-Ray derives ALL visual content from existing Call 1, Call 2, and Call 3 responses. No new API calls. No builder modifications. This is purely a visual layer on top of data that already exists.

| Phase | Data Source | Available Fields |
|---|---|---|
| **Phase 1** (Category Detection) | Call 1 response — dual-compatible (see §8.1) | **Current (extract mode):** 12 category arrays — which categories have content, term count per category. **v4 (assess mode):** Coverage map with `covered: boolean` + `matchedPhrases: string[]` per category. Phase 1 must consume either shape. |
| **Phase 2** (Tier Generation) | Call 2 response (`aiTierPrompts`) | 4 tier outputs — `.positive` text, `.negative` text, word counts, character counts |
| **Phase 3** (Platform Optimisation) | Call 3 response (`AiOptimiseResult`) | `optimised` text, `negative` text, `changes: string[]`, `charCount`, `tokenEstimate` |

### Derived Metrics (Client-Side Computation)

These are computed from the existing data at render time — not stored or transmitted:

| Metric | Derivation | Visual Use |
|---|---|---|
| Categories detected (count) | Count non-empty arrays in Call 1 response | Number of rotors that lock |
| Category richness (per-category) | Term count per category (1 = thin, 3+ = rich) | Rotor "depth" indicator |
| Tier word counts | `prompt.split(/\s+/).length` on each tier's `.positive` | Drum counter display |
| Optimisation delta | Compare assembled vs optimised text length | Cable routing distance |
| Changes count | `changes.length` from Call 3 | Number of cog alignments |
| Character budget usage | `charCount / maxChars × 100` | Gauge fill percentage |

---

## 6. The Three Phases

The X-Ray is a vertical timeline divided into three physical sections inside the glass case. Each section is a distinct mechanical subsystem. They activate sequentially as the pipeline runs.

```
┌─ THE GLASS CASE ──────────────────────────┐
│                                            │
│  ╔══ § THE DECODER ══════════════════╗    │
│  ║  ◎ ◎ ◎ ◎ ◎ ◎ ◎ ◎ ◎ ◎ ◎ ◎      ║    │ ← 12 category rotors
│  ║  Sbj Act Sty Env Cmp Cam         ║    │
│  ║  Lit Col Atm Mat Fid Neg         ║    │
│  ║                                    ║    │
│  ║  8 of 12 categories decoded       ║    │
│  ╚════════════════════════════════════╝    │
│           │ │ │ │                          │
│           ▼ ▼ ▼ ▼  (wiring)               │
│  ╔══ § THE SWITCHBOARD ══════════════╗    │
│  ║                                    ║    │
│  ║  T1 ▓▓▓▓▓▓░░  127 words          ║    │ ← 4 tier drums
│  ║  T2 ▓▓▓▓▓░░░   98 words          ║    │
│  ║  T3 ▓▓▓▓▓▓▓░  156 words          ║    │
│  ║  T4 ▓▓▓░░░░░   43 words          ║    │
│  ║                                    ║    │
│  ║  4 tier variants generated        ║    │
│  ╚════════════════════════════════════╝    │
│           │                                │
│           ▼  (cable to platform)           │
│  ╔══ § THE ALIGNMENT ════════════════╗    │
│  ║                                    ║    │
│  ║  ● Leonardo AI · Tier 3 · NL     ║    │
│  ║                                    ║    │
│  ║  ⚙ Subject-front restructure     ║    │ ← cog indicators
│  ║  ⚙ Atmosphere anchors expanded   ║    │
│  ║  ⚙ Character budget: 147/500     ║    │
│  ║                                    ║    │
│  ║  ▒▒▒▒▒▒▒▒▒▒▒▒▒▒░░░░  73%        ║    │ ← capacity gauge
│  ║                                    ║    │
│  ║  ═══ TICKER TAPE ════════════     ║    │
│  ║  ✓ 3 adaptations · 147 chars     ║    │
│  ╚════════════════════════════════════╝    │
│                                            │
└────────────────────────────────────────────┘
```

---

## 7. Phase 0 — Dormant Machine (Idle State)

Before any generation, the machine is dormant but alive.

### Visual

All three sections are visible but dim. The machine is waiting.

**The Decoder:** 12 rotor circles in a 6×2 grid. Each is a small circle (`clamp(18px, 1.6vw, 24px)` diameter) with a 1px ring in `rgba(184, 115, 51, 0.15)` (faint brass). Inside each circle: a 3-letter category abbreviation (`Sbj`, `Act`, `Sty`, `Env`, `Cmp`, `Cam`, `Lit`, `Col`, `Atm`, `Mat`, `Fid`, `Neg`) in `rgba(251, 191, 36, 0.2)` — barely visible amber.

The rotors have a breathing animation: a very slow rotation (`0deg → 3deg → 0deg → -3deg → 0deg`, 8s cycle, staggered start per rotor so they don't move in sync). This creates the impression of a machine at rest — pistons gently cycling, ready to engage.

**The Switchboard:** 4 horizontal bars (one per tier), each a thin rectangle in `rgba(184, 115, 51, 0.08)`. Tier colour dots at left end, dim. No values.

**The Alignment:** Empty panel with a faint outline of where the platform badge and cog indicators will appear. A single thin horizontal line representing the dormant ticker tape, faintly pulsing (`opacity 0.05 → 0.1`, 4s cycle).

**Section headers:** "THE DECODER", "THE SWITCHBOARD", "THE ALIGNMENT" — uppercase, letter-spacing `0.12em`, in `rgba(184, 115, 51, 0.3)` (dim brass). Font: `clamp(0.5rem, 0.55vw, 0.6rem)`. These look like labels stamped into the machine casing.

**Wiring between sections:** Thin vertical lines (1px, `rgba(251, 191, 36, 0.06)`) connecting Decoder to Switchboard, and Switchboard to Alignment. Barely visible. They light up when data flows between phases.

---

## 8. Phase 1 — The Decoder (Call 1: Category Detection)

**Trigger:** Call 1 (`/api/parse-sentence`) fires.
**Data source:** Call 1 response — dual-compatible with both current and v4 schemas.

### Data Contract Compatibility (v4-Ready)

Call 1 currently returns `ParsedCategories` — 12 category arrays (extract mode). The v4 Prompt Lab flow (`prompt-lab-v4-flow.md`) changes Call 1 to return a `CoverageAssessmentResponse` — a coverage map with `covered: boolean` and `matchedPhrases: string[]` per category.

The Decoder must consume **either** shape:

```typescript
// Normalised input the Decoder actually uses
interface DecoderCategoryInput {
  category: string;        // 'subject', 'lighting', etc.
  detected: boolean;       // true if Call 1 found content
  richness: number;        // 0 = not detected, 1–3+ = term/phrase count
}

// Adapter: extract mode (current)
function fromExtract(data: ParsedCategories): DecoderCategoryInput[] {
  return CATEGORY_NAMES.map(cat => ({
    category: cat,
    detected: data[cat].length > 0,
    richness: data[cat].length,
  }));
}

// Adapter: assess mode (v4)
function fromAssess(data: CoverageAssessmentResponse): DecoderCategoryInput[] {
  return CATEGORY_NAMES.map(cat => ({
    category: cat,
    detected: data.coverage[cat]?.covered ?? false,
    richness: data.coverage[cat]?.matchedPhrases?.length ?? 0,
  }));
}
```

The Decoder component receives `DecoderCategoryInput[]` — it never touches the raw API response. This adapter pattern means the v4 flow can ship without touching the X-Ray.

### Animation Sequence

1. **Machine awakens** (0ms): All 12 rotors stop their idle breathing and begin spinning — `rotate(0deg) → rotate(720deg)` over 600ms, `ease-in` (fast start, dramatic). Colour shifts from dim brass to active amber `rgba(251, 191, 36, 0.5)`. The section header "THE DECODER" brightens to full brass `#B87333`.

2. **Rotors lock sequentially** (as Call 1 response arrives): For each category that has content, its rotor "locks" — the spin decelerates rapidly (`ease-out` over 150ms) and stops at a position determined by the number of terms detected. The lock triggers:
   - A 1px ring colour change from amber to the category's colour (from `CATEGORY_COLOURS` SSOT)
   - A small scale pop: `scale(1.0) → scale(1.15) → scale(1.0)` over 200ms
   - The category abbreviation text brightens to the category colour at full opacity
   - A tiny "tick" indicator appears: a filled dot below the rotor (category colour, 3px)

   **Stagger:** 120ms between each rotor locking. The order follows the sequence categories appear in the Call 1 response (typically subject first, then the rest). This creates a cascade — clunk, clunk, clunk — like tumblers falling into place.

3. **Empty categories stay dim** — rotors for categories not detected slow their spin gradually over 400ms, settling back to the dim breathing state. Their ring stays faint brass. No colour. No dot. This makes the "gaps" in the prompt immediately visible.

4. **Summary line** appears below the rotor grid via teletype (see §14): "8 of 12 categories decoded" (or whatever the count is). In amber when <10 detected, in emerald when 10+. The number is the category count, not a score.

5. **Wiring activates** — the vertical lines from Decoder down to Switchboard light up. They "draw" themselves top-to-bottom over 300ms (`stroke-dasharray` animation on an SVG path, amber glow).

### Rotor Position Logic

Each rotor's final rotation angle is determined by the data, making every run visually unique:

```typescript
// Rotor stops at a position based on detected term count
// 1 term = 45°, 2 terms = 90°, 3+ terms = 135°
// This means rich categories visibly rotate further than thin ones
const rotorAngle = Math.min(terms.length, 3) * 45;
```

This is Variable Reward — the user sees different rotor configurations for every prompt. A prompt rich in atmosphere but thin in composition produces a visibly different machine state than a composition-heavy prompt.

---

## 9. Phase 2 — The Switchboard (Call 2: Tier Generation)

**Trigger:** Call 2 (`/api/generate-tier-prompts`) response arrives.
**Data source:** `aiTierPrompts` — four tier outputs with `.positive` and `.negative` text.

### Animation Sequence

1. **Four drums engage** (0ms): The 4 tier bars begin filling from left to right simultaneously. Each bar fills at a different rate (based on the actual word count of its tier output relative to the longest tier). This creates parallel processing — four things happening at once, occupying working memory for Temporal Compression.

   Fill animation: `width: 0% → N%` over 800ms, `cubic-bezier(0.4, 0, 0.2, 1)`. Each bar fills to a percentage proportional to its word count vs. the longest tier.

2. **Tier colour activation** — as each bar fills, its colour transitions from dim brass to the tier's colour:
   - T1: `#60a5fa` (blue-400) — matches `TIER_META` from `tier-showcase.tsx`
   - T2: `#c084fc` (purple-400)
   - T3: `#34d399` (emerald-400)
   - T4: `#fb923c` (orange-400)

3. **Mechanical counters** — at the right end of each bar, a word count appears in a split-flap display style:
   - Numbers "flip" from 000 to the actual count over 600ms
   - Each digit flips independently (tens column stabilises before units)
   - Font: monospace, amber glow effect (`text-shadow: 0 0 6px rgba(251, 191, 36, 0.3)`)
   - The flipping animation uses `rotateX()` — each digit rotates on its X-axis as it changes, like an airport departure board

   ```
   T1 ▓▓▓▓▓▓░░  127 words
   T2 ▓▓▓▓▓░░░   98 words
   T3 ▓▓▓▓▓▓▓░  156 words
   T4 ▓▓▓░░░░░   43 words
   ```

4. **Summary line** via teletype: "4 tier variants generated" in emerald.

5. **Cable routing** — a single SVG path draws from the Switchboard down to the Alignment section. The cable colour matches the tier of the currently selected platform (if one is selected). If no platform is selected, the cable is neutral amber.

### Bar Fill Logic

```typescript
// Each bar fills proportionally to its word count
const maxWords = Math.max(t1Words, t2Words, t3Words, t4Words);
const fillPercent = (tierWords / maxWords) * 100;
// Clamp to 15–100% so even short tiers are visible
const displayPercent = Math.max(15, fillPercent);
```

The proportional fill means the user can instantly see which tier produced the most output. T3 (Natural Language) typically fills the widest. T4 (Plain) is typically shortest. The visual difference teaches tier characteristics without a single word of explanation.

---

## 10. Phase 3 — The Alignment (Call 3: Platform Optimisation)

**Trigger:** Call 3 (`/api/optimise-prompt`) response arrives.
**Data source:** `AiOptimiseResult` — `optimised`, `changes[]`, `charCount`, `tokenEstimate`, `negative`.

This is the peak moment. The most complex visual phase arrives at the moment of maximum anticipation (after the user has watched Phases 1 and 2 build up).

### Animation Sequence

1. **Platform badge locks in** (0ms): The selected platform name + tier badge appears with a mechanical "stamp" animation — `scale(1.2) → scale(1.0)` over 200ms with a subtle `box-shadow` flash in the tier colour. The badge has a brass-coloured border (1px solid `#B87333`).

2. **Cog alignment cascade** (200ms, staggered): Each entry in the `changes[]` array from Call 3 becomes a "cog indicator" — a small gear icon that spins and then locks. The sequence:

   For each change string:
   - A gear icon (`⚙`) appears at `opacity: 0`, `rotate(0deg)`
   - It spins: `rotate(0deg) → rotate(180deg)` over 400ms with `ease-out`
   - It locks: `opacity: 0 → 1`, colour shifts from amber to emerald
   - The change description appears beside it via teletype (letter by letter, 20ms per character)
   - **Stagger between cogs: 350ms** — tight enough to feel purposeful without dragging

   **Phase 3 time budget: 3.5 seconds maximum.** If cog count × stagger + teletype would exceed this budget, batch remaining cogs: show them simultaneously with a single summary teletype line. This prevents Phase 3 from feeling ceremonial when `changes[]` is long.

   Example:
   ```
   ⚙ Subject-front restructure applied
   ⚙ Atmosphere anchors expanded to 3 terms
   ⚙ Character budget: 147 / 500 (29% utilised)
   ```

   The gear icons are small: `clamp(10px, 0.8vw, 14px)`. When locked (emerald), they have a faint glow: `drop-shadow(0 0 3px rgba(52, 211, 153, 0.3))`.

3. **Capacity gauge** (after last cog locks): A horizontal gauge fills from left to right showing `charCount / maxChars`:
   - Fill colour: emerald if <70% capacity, amber if 70–90%, rose if >90%
   - The fill draws itself over 600ms, `ease-out`
   - Percentage label appears at the right end with the split-flap counter animation
   - Below the gauge: "{charCount} / {maxChars} characters" in amber text

4. **If `changes[]` is empty** (prompt was already optimal): A single cog spins and locks with the text "Prompt already optimised — no adaptations needed" in emerald. The gauge still fills. One cog, not zero — the machine still did something.

5. **Ticker tape conclusion** (after gauge completes): The final summary line types out:
   ```
   ✓ {changes.length} adaptations · {charCount} chars · {tokenEstimate} tokens
   ```
   The `✓` is emerald. The rest is amber. The line appears via teletype at 30ms per character — slow enough to read, fast enough to feel mechanical.

6. **All cogs settle** (final moment): Once the ticker tape finishes, all gear icons in Phase 3 brighten simultaneously — a single coordinated brightness pulse (`filter: brightness(1) → brightness(1.2) → brightness(1)` over 200ms). Subtle, not theatrical. The Alignment section header brightens to full brass. This is the "machine has finished" signal — brief, not a performance.

### Cable Routing Detail

The SVG cable from Switchboard to Alignment becomes platform-aware in Phase 3:

- The cable highlights to the tier colour of the selected platform
- Small "data dots" travel along the cable during Phase 3 processing — 3px circles that move from top to bottom over 800ms, `ease-in-out`, in the tier colour
- 3–5 dots travel during the processing time, creating a "data flowing through the system" effect
- After Phase 3 completes, the cable stays lit at 30% opacity (the connection is established, the data flowed)

---

## 11. The Glass Case — Container Aesthetic

The right rail's panel chrome changes from the standard `rounded-3xl bg-slate-950/70 ring-1 ring-white/10` to the glass case style. This is passed via the `rightRailClassName` prop on `HomepageGrid`.

### CSS Implementation

```css
/* The glass case — outermost container */
.glass-case {
  border-radius: clamp(12px, 1.2vw, 20px);
  background:
    linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.025) 0%,
      transparent 20%
    ),
    rgba(2, 6, 23, 0.85);  /* slate-950 at 85% — slightly more transparent than standard */
  box-shadow:
    inset 0 1px 0 0 rgba(255, 255, 255, 0.04),  /* top glass reflection */
    inset 0 -1px 0 0 rgba(0, 0, 0, 0.3),         /* bottom shadow */
    0 0 0 1px rgba(184, 115, 51, 0.12),            /* brass frame ring */
    0 0 20px rgba(184, 115, 51, 0.03);             /* very faint brass ambient */
}

/* When the machine is processing (any phase active) */
.glass-case--active {
  box-shadow:
    inset 0 1px 0 0 rgba(255, 255, 255, 0.06),
    inset 0 -1px 0 0 rgba(0, 0, 0, 0.3),
    0 0 0 1px rgba(184, 115, 51, 0.25),            /* brass ring brightens */
    0 0 30px rgba(251, 191, 36, 0.04);             /* warm amber ambient glow */
  transition: box-shadow 600ms ease;
}
```

The glass effect is subtle. At rest, the rail looks almost standard but with a slightly warmer tone. When processing, the brass frame brightens and a warm glow appears — the machine is powered on.

### Internal "Back Panel"

Behind the three phase sections, a very faint texture suggests the internal panel of the machine:

```css
.glass-case-interior {
  background-image:
    radial-gradient(
      circle at 20% 50%,
      rgba(184, 115, 51, 0.02) 0%,
      transparent 50%
    ),
    radial-gradient(
      circle at 80% 30%,
      rgba(251, 191, 36, 0.015) 0%,
      transparent 40%
    );
}
```

Two faint radial gradients in brass/amber create the impression of internal structure without being distracting. These are static — no animation.

---

## 12. Colour Palette — Brass, Copper, and Amber

The X-Ray uses a restricted palette that evokes WWII-era instrumentation. This is a deliberate departure from Promagen's standard purple/pink/cyan vocabulary — the machine is its own visual world behind the glass.

| Colour | Hex | Usage |
|---|---|---|
| **Brass** | `#B87333` | Section headers, frame ring, structural elements. The "metal" of the machine. |
| **Copper** | `#CD7F32` | Rotor rings (idle), cable outlines, gauge track. Warmer than brass for smaller details. |
| **Active Amber** | `#FBBF24` | Processing states, spinning elements, data flow dots. The "powered on" colour. |
| **Warm Amber** | `#FCD34D` | Teletype text, counter digits, summary lines. The "output" colour. |
| **Lock Emerald** | `#34D399` | Rotor lock state, cog lock state, completion indicators. "This part is done." |
| **Tier Colours** | Blue/Purple/Emerald/Orange | Switchboard bars, platform badge, cable routing. Tier identity inside the machine. |
| **Category Colours** | 13-colour SSOT | Rotor lock colours (each category's rotor locks to its own colour). Identity through the machine. |
| **Dim Brass** | `rgba(184, 115, 51, 0.15)` | Dormant state elements. "The machine exists but isn't running." |
| **Glass Reflection** | `rgba(255, 255, 255, 0.025)` | Top edge gradient. "You're looking through glass." |

**Rule:** No purple, pink, or cyan inside the glass case (those are Promagen UI colours, not machine colours). The only exceptions are category colours on rotor locks (which must match `prompt-colours.ts`) and tier colours on the switchboard bars (which must match `TIER_META`).

**No grey text inside the glass case.** Dim elements use dim brass, not slate. The machine lives in a brass/amber world, not a grey one.

---

## 13. Animation System — Mechanical Motion

Every animation inside the glass case must feel **mechanical** — weight, inertia, and resistance. Not smooth, not elastic, not bouncy. Mechanical.

### Easing Curves

| Motion Type | CSS Easing | Feel |
|---|---|---|
| Rotor spin-up | `cubic-bezier(0.2, 0, 0.8, 1)` | Heavy start, building momentum |
| Rotor lock (deceleration) | `cubic-bezier(0, 0, 0.2, 1)` | Rapid deceleration, decisive stop |
| Bar fill | `cubic-bezier(0.4, 0, 0.2, 1)` | Standard material motion |
| Cog spin + lock | `cubic-bezier(0.1, 0, 0.3, 1)` | Weighted rotation that slows with resistance |
| Gauge fill | `cubic-bezier(0.4, 0, 0, 1)` | Fast start, slow precision fill to exact value |
| Scale pop (lock moment) | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Slight overshoot then settle — the mechanical "clunk" |

### Co-Located Keyframes

All keyframes live in a single `<style dangerouslySetInnerHTML>` block in the root X-Ray component:

```css
/* Rotor idle breathing — each rotor gets a random animation-delay */
@keyframes xray-rotor-breathe {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(3deg); }
  75% { transform: rotate(-3deg); }
}

/* Rotor spin-up when processing starts */
@keyframes xray-rotor-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(720deg); }
}

/* Scale pop when a rotor/cog locks */
@keyframes xray-lock-pop {
  0% { transform: scale(1.0); }
  50% { transform: scale(1.15); }
  100% { transform: scale(1.0); }
}

/* Split-flap digit flip */
@keyframes xray-digit-flip {
  0% { transform: rotateX(0deg); opacity: 1; }
  50% { transform: rotateX(-90deg); opacity: 0; }
  51% { transform: rotateX(90deg); opacity: 0; }
  100% { transform: rotateX(0deg); opacity: 1; }
}

/* Cog spin before locking */
@keyframes xray-cog-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(180deg); }
}

/* Data dot travelling along cable */
@keyframes xray-data-dot {
  0% { transform: translateY(0); opacity: 0; }
  10% { opacity: 1; }
  90% { opacity: 1; }
  100% { transform: translateY(var(--cable-length)); opacity: 0; }
}

/* Gauge fill shimmer */
@keyframes xray-gauge-shimmer {
  0% { background-position: -200% center; }
  100% { background-position: 200% center; }
}

/* Synchronized cog pulse (final alignment) */
@keyframes xray-alignment-pulse {
  0% { transform: scale(1.0); filter: brightness(1); }
  50% { transform: scale(1.08); filter: brightness(1.3); }
  100% { transform: scale(1.0); filter: brightness(1); }
}

/* Teletype cursor blink */
@keyframes xray-cursor-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

/* prefers-reduced-motion: disable all rotation/translation */
@media (prefers-reduced-motion: reduce) {
  .xray-rotor-breathe,
  .xray-rotor-spin,
  .xray-cog-spin,
  .xray-data-dot {
    animation: none !important;
  }
  .xray-lock-pop,
  .xray-alignment-pulse {
    animation: none !important;
  }
  .xray-digit-flip {
    animation: none !important;
    transform: none !important;
  }
}
```

### Uniqueness Per Run

Animations must derive timing and values from the actual data, ensuring no two runs look identical:

| Variable | Source | Visual Effect |
|---|---|---|
| Rotor lock angle | Term count per category | Different rotors stop at different positions |
| Rotor lock stagger | Order of categories in Call 1 response | Different cascade sequence each time |
| Bar fill width | Word count per tier | Different proportions in the switchboard |
| Counter target values | Actual word counts | Different numbers flip to |
| Cog count | `changes.length` from Call 3 | 0–6 cogs appear (different every time) |
| Gauge fill percentage | `charCount / maxChars` | Different fill level |
| Cable colour | Selected platform's tier colour | Blue/purple/emerald/orange routing |

---

## 14. The Teletype — Text Reveal System

Summary text in the X-Ray appears via a teletype animation — characters appearing one by one, left to right, with a blinking cursor at the leading edge.

### Implementation

```typescript
// Teletype component — renders text character by character
interface TeletypeProps {
  text: string;
  /** Milliseconds per character */
  speed?: number;
  /** Delay before typing starts */
  delay?: number;
  /** Colour for the text */
  color?: string;
  /** Callback when typing completes */
  onComplete?: () => void;
}
```

**Speed:** 25ms per character for summary lines, 20ms per character for cog descriptions. Fast enough to feel mechanical, slow enough to read.

**Cursor:** A thin amber rectangle (`|`) at the trailing edge, blinking at 530ms interval (`xray-cursor-blink`). Disappears 200ms after typing completes.

**Sound consideration:** No audio. The visual teletype is enough. Audio would require user interaction to enable (browser autoplay policy) and would clash with the optional Listen button.

**The teletype is NOT used for Phase 0 (dormant) labels.** Those appear immediately — they're labels stamped into the machine casing, not output.

---

## 14.1. Performance Degradation Ladder

The Glass Case has multiple concurrent animations (rotors, bars, counters, cables, cogs, teletype). On low-end devices or under GPU pressure, this must degrade gracefully — not jank.

### Three Rendering Tiers

| Tier | Name | Trigger | What's Active | What's Removed |
|---|---|---|---|---|
| **Full** | All effects | Default on modern hardware | Everything: rotor spin, split-flap counters, SVG cable dots, teletype, cog cascade, idle breathing, glass reflections | Nothing |
| **Reduced** | Core + simplifications | `prefers-reduced-motion: reduce` OR detected low framerate (<30fps for 500ms) | Rotors: instant lock (no spin). Bars: instant fill (no animation). Counters: final value shown (no flip). Cables: static lines (no data dots). Teletype: 2× speed (12ms/char). Cogs: instant appear (no spin). Idle breathing: disabled. | Rotor spin-up, split-flap flip, data dot travel, cog spin, idle breathing, glass case glow transitions |
| **Minimal** | Information only | Very low framerate (<15fps for 1s) OR `navigator.hardwareConcurrency <= 2` | Static display: all phases show final state immediately when data arrives. No animation. Category dots show detected/not as coloured/dim. Bars show final width. Cogs show as static emerald dots. | All animation. Teletype replaced with instant text. Split-flap replaced with plain numbers. Cables as thin static lines. |

### Framerate Detection

```typescript
let lastFrameTime = 0;
let frameCount = 0;
let currentFps = 60;

function measureFps(timestamp: number) {
  frameCount++;
  if (timestamp - lastFrameTime >= 500) {
    currentFps = (frameCount * 1000) / (timestamp - lastFrameTime);
    frameCount = 0;
    lastFrameTime = timestamp;
  }
  requestAnimationFrame(measureFps);
}
```

The X-Ray checks `currentFps` before starting each phase's animation. If fps has dropped below threshold, it downgrades for that phase. It does not upgrade mid-phase — once a phase starts at a tier, it finishes at that tier.

**One-way downgrade per generation:** Degradation is one-way for the lifetime of a single generation. Once a generation triggers reduced tier, it stays reduced for that entire generation even if framerate recovers. The next generation re-evaluates fresh from full tier. This prevents visual thrashing (full → reduced → full → reduced) within a single pipeline run.

### DOM Budget

Maximum DOM elements inside the Glass Case at any time: ~80 at peak (Phase 3 active). **Hard cap: 100 elements per rail total** — all three phases combined, including dormant elements from inactive phases. If Phase 3 would push over 100, collapse cog descriptions into a single summary line.

---

## 15. Edge Cases

| Edge Case | Behaviour |
|---|---|
| **User regenerates prompt** | Phase 1 rotors spin back to neutral (200ms), then re-lock with new data. Phases 2–3 clear and rebuild. The machine "resets and reprocesses" — not a clean wipe, a mechanical reset. |
| **Call 1 fails** | Phase 1 rotors slow-stop in random positions (no lock). Section header shows "DECODER · signal lost" in rose. Phases 2–3 stay dormant. |
| **Call 2 fails** | Phase 1 stays locked. Phase 2 bars flash once in rose then return to dim. "SWITCHBOARD · generation failed" in rose. Phase 3 stays dormant. |
| **Call 3 not triggered** | Phases 1–2 complete normally. Phase 3 stays dormant with breathing idle animation. The Zeigarnik Effect does work — the incomplete machine nags. |
| **Call 3 fails** | Phases 1–2 stay locked. Phase 3 platform badge appears but cogs spin and fail to lock — they slow-stop at random angles in rose. "ALIGNMENT · calibration failed" in rose. |
| **Call 3 returns empty `changes[]`** | One cog still spins and locks ("Prompt already optimised"). The machine always does *something* — it never feels like it didn't try. |
| **Platform switch after Phase 3** | Phase 3 clears (cogs spin back to neutral). When Call 3 re-fires, Phase 3 rebuilds for the new platform. Phases 1–2 remain stable. Cable colour changes to new platform's tier. |
| **Very long `changes[]` (6+ items)** | Show first 4 cogs individually. Remaining entries collapse to "… and {N} more adaptations" in amber. Phase 3 time budget (3.5s) enforced — if stagger would exceed budget, batch remaining cogs. |
| **All 12 categories detected** | All rotors lock in their category colours. Summary shows "12 of 12 categories decoded" in emerald with a brightness pulse — all rotors flash simultaneously. |
| **Rapid generation (Call 1 + 2 complete in <500ms)** | Enforce minimum Phase 1 display time of 800ms before Phase 2 begins. |
| **New generation while animation is in-flight** | **Cancellation model:** All in-flight animations cancelled immediately. Animated elements snap to idle/neutral state (no partial locks, no half-filled bars). New generation's Phase 1 begins fresh. No queueing — new generation always wins. Stale animations must never complete after new data arrives. Implementation: each generation gets a monotonic `generationId`; animation callbacks check their `generationId` against current before executing any state update. |
| **Data snapshot ownership** | Each generation captures a frozen data snapshot at generation start. Phase 1 reads from its generation's Call 1 snapshot. Phase 2 reads from its generation's Call 2 snapshot. Phase 3 reads from its generation's Call 3 snapshot. Later-arriving upstream data from a different generation never mutates an in-flight visualisation. The snapshot is the generation's ground truth. |
| **Call 2 arrives while Phase 1 still animating** | Phase 2 data is buffered. Phase 2 begins only after Phase 1's minimum display time (800ms) has elapsed AND the last Phase 1 rotor has locked. If Phase 1 finishes before Call 2 returns, the Switchboard holds in dormant state with locked Decoder above. |
| **Call 3 data stale (prompt edited after Call 3 fired)** | The drift indicator in the centre column flags this. The X-Ray shows the Phase 3 data that Call 3 returned — it does not detect staleness itself. Centre column owns that responsibility. |
| **Container height overflow** | Glass Case has `overflow-y: auto` with standard Promagen scrollbar. Phase 0 + 1 + 2 fit without scrolling. Phase 3 with 4+ cogs may scroll. The gauge and ticker tape must always be visible on scroll — if cogs push them below the fold, cap visible cogs at 3 and collapse the rest. |
| **Low-end device** | Performance degradation ladder (§14.1) activates. Minimal tier: all phases show final state immediately with no animation. The Glass Case still shows the data — it just doesn't perform. |

---

## 16. Accessibility

### `prefers-reduced-motion`

All rotation, translation, and scaling animations disabled. Elements appear at their final state instantly. Text still appears via teletype but at 2× speed (12ms per character instead of 25ms). Counter numbers appear at final value without flip animation.

### Screen Reader

- Glass case container: `role="complementary"`, `aria-label="Pipeline processing visualisation"`
- Each phase section: `role="status"`, `aria-live="polite"`
- Phase headers: `aria-label` includes full description ("The Decoder — category detection, 8 of 12 categories found")
- Rotor states announced: "Subject: detected", "Camera: not detected"
- Teletype text: full text in `aria-label` on the container (screen reader gets the complete text immediately, doesn't wait for the visual animation)

### Keyboard

No interactive elements in the X-Ray. It is display-only. No focus traps, no tab stops. The user never needs to interact with the glass case — they interact with the centre column and the left rail.

---

## 17. File Map

| File | Purpose | New/Modified |
|---|---|---|
| `src/components/prompt-lab/pipeline-xray.tsx` | Root X-Ray component — glass case container + 3 phase sections | NEW |
| `src/components/prompt-lab/xray-decoder.tsx` | Phase 1: 12 category rotors | NEW |
| `src/components/prompt-lab/xray-switchboard.tsx` | Phase 2: 4 tier drum bars + counters | NEW |
| `src/components/prompt-lab/xray-alignment.tsx` | Phase 3: platform badge + cog cascade + gauge + ticker tape | NEW |
| `src/components/prompt-lab/xray-teletype.tsx` | Shared teletype text reveal component | NEW |
| `src/components/prompt-lab/xray-cable.tsx` | SVG cable + data dot animation between sections | NEW |
| `src/components/prompt-lab/xray-split-flap.tsx` | Split-flap mechanical counter digit component | NEW |
| `src/lib/pipeline-xray/derive-metrics.ts` | Client-side metric computation from Call 1/2/3 data + v4 adapter functions | NEW |
| `src/lib/pipeline-xray/types.ts` | TypeScript types for X-Ray state + derived metrics | NEW |
| `src/app/studio/playground/playground-page-client.tsx` | Pass new `rightContent` to HomepageGrid + `rightRailClassName` for glass case | MODIFIED |

**No modifications to:**
- `HomepageGrid` (uses existing `rightContent` + `rightRailClassName` props)
- Any Call 1/2/3 routes or hooks
- Any of the 43 builder files
- `platform-config.json`
- `prompt-colours.ts` (imported, not modified)

---

## 18. Build Order

| Part | What | Depends On | Estimated Lines |
|---|---|---|---|
| **1** | `types.ts` — X-Ray state types + derived metric types | None | ~60 |
| **2** | `derive-metrics.ts` — Compute visual metrics from Call 1/2/3 responses | Part 1 | ~80 |
| **3** | `xray-teletype.tsx` — Shared teletype component | None | ~100 |
| **4** | `xray-split-flap.tsx` — Shared split-flap counter component | None | ~120 |
| **5** | `pipeline-xray.tsx` — Glass case container + Phase 0 dormant state | Parts 1, 3 | ~200 |
| **6** | `xray-decoder.tsx` — Phase 1: 12 category rotors with lock animation | Parts 2, 5 | ~250 |
| **7** | `xray-cable.tsx` — SVG cable + data dot animation | Part 5 | ~100 |
| **8** | `xray-switchboard.tsx` — Phase 2: 4 tier bars + counters | Parts 2, 4, 7 | ~250 |
| **9** | `xray-alignment.tsx` — Phase 3: platform badge + cog cascade + gauge + ticker | Parts 2, 3, 7 | ~300 |
| **10** | `playground-page-client.tsx` — Wire right rail + glass case className | Parts 5–9 | ~40 lines modified |

Parts 3–4 are shared components used across phases. Build them first.
Part 5 (the glass case shell + dormant state) is the visual foundation. Ship it early so the aesthetic can be evaluated before building the complex animations.
Parts 6–9 are the three phases — build in order since Phase 2 depends on Phase 1 completing, and Phase 3 depends on Phase 2.

---

## 19. Non-Regression Rules

1. Exchange rails on homepage, World Context, and Pro page must not be affected.
2. `HomepageGrid` must not be modified — uses existing `rightContent` and `rightRailClassName` props.
3. Call 1, Call 2, and Call 3 routes must not be modified.
4. The 43 builder files must not be modified.
5. `prompt-colours.ts` is imported read-only — never modified.
6. `algorithm-names.ts` is not consumed by the X-Ray (algorithm cycling is in the centre column).
7. Phase 1 animation must not start until Call 1 is actually firing (not before "Generate" click).
8. Phase 2 animation must not start until Call 2 response has arrived (data drives the visuals).
9. Phase 3 animation must not start until Call 3 response has arrived.
10. Phase minimum display times must be enforced even if API responds instantly (800ms for Phase 1).
11. Phase 3 time budget: 3.5 seconds maximum. Cog stagger + teletype must not exceed this.
12. The glass case styling must not affect the left rail or centre column.
13. `prefers-reduced-motion` must disable all rotation, translation, and scaling. Teletype runs at 2× speed. Counters appear at final value.
14. No grey text inside the glass case — dim elements use dim brass, never slate.
15. All sizing via `clamp()`.
16. Co-located animations only — no new entries in `globals.css`.
17. Maximum 4 individual cog indicators in Phase 3 (5th+ collapsed to summary).
18. No audio. Visual-only.
19. No interactive elements inside the glass case. Display-only, no focus traps.
20. New generation cancels all in-flight animations immediately. Stale phase animations must never complete after new data arrives.
21. Phase 1 Decoder must consume both current (extract arrays) and v4 (coverage map) Call 1 schemas via adapter pattern. The component never touches raw API responses.
22. Performance degradation: framerate below 30fps for 500ms triggers reduced tier. Below 15fps triggers minimal tier. Tier never upgrades mid-phase.
23. DOM element hard cap: 100 elements inside the Glass Case at any time.

---

## 20. Decisions Log

| # | Decision | Rationale | Date |
|---|---|---|---|
| D1 | WWII Enigma/Bombe/Colossus aesthetic, not steampunk | Steampunk is decoration. Military engineering is purposeful. Every element has a function. The machine must feel serious, not whimsical. | 2 Apr 2026 |
| D2 | Zero new API calls — derive everything from existing responses | The X-Ray is a visualisation layer, not a data layer. Adding API calls would increase latency and cost for a display-only feature. All data already exists in Call 1/2/3 responses. | 2 Apr 2026 |
| D3 | Glass case styling via `rightRailClassName` prop, not by modifying HomepageGrid | HomepageGrid already supports panel className overrides. No grid changes needed. | 2 Apr 2026 |
| D4 | Brass/copper/amber palette inside the glass case | The machine needs its own visual world. Promagen's standard purple/pink/cyan would make it look like a dashboard widget, not a precision instrument. Brass evokes engineering heritage. | 2 Apr 2026 |
| D5 | Data-derived animation parameters (rotor angles, bar widths, counter values) | Fixed animations would be repetitive. Data-driven animations make every run visually unique, which drives Variable Reward. The user watches to see what the machine does *this time*. | 2 Apr 2026 |
| D6 | Minimum 800ms display time for Phase 1 even on fast API responses | Mechanical things take time. A machine that processes instantly doesn't look like it did anything. The enforced minimum creates the perception of serious computation. | 2 Apr 2026 |
| D7 | Teletype text reveal instead of instant text | Teletype creates Curiosity Gap (what's the full message?) and reinforces the mechanical aesthetic. Instant text would break the metaphor. | 2 Apr 2026 |
| D8 | No audio for mechanical sound effects | Browser autoplay policies would require user interaction. Audio would clash with the Listen button. The visual metaphor is strong enough alone. | 2 Apr 2026 |
| D9 | ~~5-cog maximum~~ → 4-cog individual maximum + collapse | Reduced from 5 to 4 to tighten Phase 3 timing. Combined with 3.5s phase time budget to prevent ceremony. | 2 Apr 2026 |
| D10 | Empty `changes[]` still shows one cog | The machine must always visibly do something. A Phase 3 with zero animation would feel broken. One cog with "already optimised" maintains the metaphor. | 2 Apr 2026 |
| D11 | Phase 1 Decoder uses adapter pattern for v4 Call 1 compatibility | ChatGPT review identified contract conflict: Call 1 is moving from category arrays (extract mode) to coverage map (assess mode). Adapter pattern means the v4 flow can ship without touching X-Ray code. | 2 Apr 2026 |
| D12 | Three-tier performance degradation ladder (full → reduced → minimal) | ChatGPT review: "no performance fallbacks." Added framerate detection, three rendering tiers, DOM budget cap. The Glass Case must degrade gracefully, never jank. | 2 Apr 2026 |
| D13 | Phase 3 time budget: 3.5 seconds maximum | ChatGPT review: "Phase 3 is in danger of dragging." Cog stagger reduced 500→350ms. Time budget enforced — excess cogs batched. Precision, not ceremony. | 2 Apr 2026 |
| D14 | Generation cancellation model with `generationId` | New generation immediately cancels all in-flight animations. No queueing, no stale completions. Each generation gets a monotonic ID; callbacks verify before executing. | 2 Apr 2026 |
| D15 | Synchronized cog pulse simplified to brightness-only | ChatGPT review: "sounds satisfying on paper but often lands as overproduced." Reduced from scale+glow to a 200ms brightness pulse. Subtle, not theatrical. | 2 Apr 2026 |

---

## Changelog

- **2 Apr 2026 (v1.2.0):** **FINAL REVIEW POLISH (88→90+ target).** 4 precision fixes from second ChatGPT review. (1) §14.1: Framerate degradation confirmed as one-way per generation — once reduced, stays reduced for that generation even if fps recovers. Next generation re-evaluates fresh. Prevents visual thrashing. (2) §14.1: DOM hard cap clarified as per-rail total (all three phases combined, including dormant elements). (3) §15: Added data snapshot ownership edge case — each generation captures frozen snapshots of Call 1/2/3 data at generation start. Later-arriving upstream data never mutates an in-flight visualisation. (4) Cross-reference version in lefthand-rail.md updated from v1.0.0 to v1.1.0 (now v1.2.0).
- **2 Apr 2026 (v1.1.0):** **POST-REVIEW REVISION.** 5 targeted fixes from ChatGPT architectural review (79/100 → target 88+). (1) §8: Phase 1 Decoder updated with dual-schema compatibility for v4 Prompt Lab flow. Adapter pattern normalises both extract-mode (category arrays) and assess-mode (coverage map) into `DecoderCategoryInput[]`. Component never touches raw API response. (2) §14.1: NEW performance degradation ladder — three rendering tiers (full, reduced, minimal). Framerate detection at 500ms intervals. Thresholds: <30fps → reduced, <15fps → minimal. DOM budget hard cap: 100 elements. (3) §10: Phase 3 timing tightened — cog stagger reduced 500→350ms. Phase 3 time budget capped at 3.5 seconds. Excess cogs batched. Synchronized cog pulse simplified to brightness-only (200ms, no scale). (4) §15: Edge cases expanded from 10 to 16 — added animation cancellation model (`generationId` pattern), Call 2 buffering during Phase 1, stale Call 3 data handling, container height overflow strategy, low-end device degradation. Cog cap reduced 5→4 individual + collapse. (5) §19: Non-regression rules expanded 18→23 — added Phase 3 time budget, cancellation, v4 compatibility, performance tiers, DOM cap. Decisions log expanded D10→D15.
- **2 Apr 2026 (v1.0.0):** Initial version.

---

_This document is the authority for the Prompt Lab right-hand rail. No code is written until this doc is approved._

_**Key principle:** The machine doesn't just report what happened. It performs. The user peers through glass into precision engineering. Every run is unique because every prompt is unique. The excitement isn't the result — it's watching the machine find it._
