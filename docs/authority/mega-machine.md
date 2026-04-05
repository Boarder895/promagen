# The Bletchley Machine — Authority Build Document

**Version:** 1.2.0
**Created:** 5 April 2026
**Amended:** 5 April 2026 — ChatGPT 96/100 sign-off. Remaining concerns addressed.
**Owner:** Martin Yarnold — Promagen
**Status:** Signed off — build-ready
**Supersedes:** `docs/authority/righthand-rail.md` v1.2.0 §7–§18 (visual spec only — data flow unchanged)

---

## Changelog

| Version | Date       | Changes                                                                                                                                                                                                                                                                                                     |
| ------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.0.0   | 5 Apr 2026 | Initial build plan — 15 sections, all features, 5-delivery plan                                                                                                                                                                                                                                             |
| 1.1.0   | 5 Apr 2026 | ChatGPT review (92→96): added §6.9 event precedence, §10 runtime lifecycle, §11 sound policy, §12 draw-call control, §13 accessibility, §14 fallback/kill switch, §19 automated tests. Architecture expanded to 9 files (+config.ts). Animation controller moved to Delivery 1. All open questions resolved |
| 1.2.0   | 5 Apr 2026 | Remaining concerns: gauge "uncalibrated" state replaces blunt maxChars fallback, Delivery 1 line estimate corrected upward, component-level integration smoke test added                                                                                                                                    |

---

## Table of Contents

1. [What This Is](#1-what-this-is)
2. [What This Replaces](#2-what-this-replaces)
3. [The Metaphor](#3-the-metaphor)
4. [Technology Decision — Three.js](#4-technology-decision--threejs)
5. [Data Flow — How It Wires In](#5-data-flow--how-it-wires-in)
6. [Feature Specification](#6-feature-specification)
   - 6.1 The Housing (Glass Case)
   - 6.2 The Decoder — 12 Cipher Rotors
   - 6.3 The Switchboard — Patch Cable Connections
   - 6.4 The Alignment — Voltmeter Gauge
   - 6.5 The Idle State — Living Machine
   - 6.6 Sound Engine
   - 6.7 Randomisation System
   - 6.8 Phase Transitions
   - 6.9 Event Precedence Table
7. [Human Factors Declaration](#7-human-factors-declaration)
8. [Colour Palette](#8-colour-palette)
9. [Technical Constraints](#9-technical-constraints)
10. [Runtime Lifecycle](#10-runtime-lifecycle)
11. [Sound Policy](#11-sound-policy)
12. [Draw-Call Control Strategy](#12-draw-call-control-strategy)
13. [Accessibility](#13-accessibility)
14. [Fallback & Kill Switch](#14-fallback--kill-switch)
15. [File Map — What Gets Created / Changed](#15-file-map--what-gets-created--changed)
16. [Build Plan — Delivery Order](#16-build-plan--delivery-order)
17. [Non-Regression Rules](#17-non-regression-rules)
18. [Testing & Verification](#18-testing--verification)
19. [Automated Test Hooks](#19-automated-test-hooks)
20. [Decisions Log](#20-decisions-log)

---

## 1. What This Is

The Prompt Lab's right rail currently shows a flat CSS/SVG visualisation of the three-call pipeline (Decoder → Switchboard → Alignment). It works. It's accurate. It's boring. "Text with a brass border" — scored 30/100 for visual impact.

This document replaces it with a Three.js WebGL 3D machine — a physical object behind glass that you want to watch. The Bletchley Machine is a WWII-era decryption device crossed with a Victorian difference engine. Brass, glass, warm amber glow, mechanical sound. When idle, it breathes. When the user clicks Generate, it comes alive — rotors spin, cables connect, gauges sweep, steam vents, sparks fly.

The machine consumes the same data from the same props interface. Zero API changes. Zero new data sources. The only change is what the user sees and hears.

---

## 2. What This Replaces

### Files Replaced (deleted after new build verified)

| Current File           | Lines | What It Does                            | Replacement                                                |
| ---------------------- | ----- | --------------------------------------- | ---------------------------------------------------------- |
| `pipeline-xray.tsx`    | 232   | Glass case container + section wiring   | `bletchley-machine.tsx` (Three.js canvas + React wrapper)  |
| `xray-decoder.tsx`     | 418   | CSS pill rotors, category colours       | Built into Three.js scene (Decoder section)                |
| `xray-switchboard.tsx` | 339   | CSS progress bars, split-flap counters  | Built into Three.js scene (Switchboard section)            |
| `xray-alignment.tsx`   | 520   | CSS cog indicators, capacity bar        | Built into Three.js scene (Alignment section)              |
| `xray-teletype.tsx`    | 177   | Character-by-character text reveal      | HTML overlay on Three.js canvas (kept as concept, rebuilt) |
| `xray-split-flap.tsx`  | 203   | Mechanical digit flip animation         | Replaced by Three.js nixie-tube geometry                   |
| `xray-score.tsx`       | 368   | Killed user-facing score (already dead) | Not replaced — stays dead                                  |

**Total replaced:** ~2,257 lines of CSS/SVG → ~1,900 lines of Three.js + React (across 9 files)

### Files Modified

| File                         | Change                                                                                                                                    |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `playground-page-client.tsx` | Import `BletchleyMachine` instead of `PipelineXRay`. Props identical — drop-in swap. Feature flag wraps the swap for kill-switch rollback |
| `package.json`               | Add `three` and `@types/three` dependencies                                                                                               |

### Files NOT Touched

- `homepage-grid.tsx` — right rail container unchanged
- All API routes — zero changes
- All hooks (`use-ai-optimisation.ts`, etc.) — zero changes
- All types (`category-assessment.ts`, `prompt-intelligence.ts`) — zero changes
- `GLASS_CASE_CLASS` in `playground-page-client.tsx` — still applies (transparent outer container)

---

## 3. The Metaphor

The visual language draws from three real WWII-era machines:

**The Enigma Machine** — 12 cipher rotors that spin independently, each locking into a different position when its category is decoded. You see which categories were found and which weren't. The cascade of locks creates anticipation.

**The Bombe (Turing's decryption machine)** — Four parallel cable runs processing simultaneously. Each tier generates its prompt variant. Cables extend, energy pulses travel along them, nixie-tube counters roll up the word counts.

**Colossus (first electronic computer)** — The alignment gauge, capacity meters, ticker tape output. The final optimisation phase shows a physical needle finding its reading.

### What This Is NOT

Not steampunk. No leather textures, no sepia filters, no excessive ornamentation. Every element has a function — the gears drive the rotors, the cables carry the signal, the gauge measures the output. The brass is structural, not decorative. **Bletchley Park, not Jules Verne.** The precision is the beauty.

---

## 4. Technology Decision — Three.js

### Why Three.js (Path A)

CSS transforms with `rotateX(10deg)` pretend to be 3D. Three.js is 3D. The v2 CSS prototype proved that CSS can't deliver metallic shading, real shadows, real depth fog, or particle systems with gravity. The brief demands a machine you can feel — that requires real geometry, real materials, real lighting.

### What Three.js Gives Us

| Feature              | CSS/SVG                          | Three.js                                                 |
| -------------------- | -------------------------------- | -------------------------------------------------------- |
| Metallic shading     | ❌ Gradient approximation        | ✅ `MeshStandardMaterial` with `metalness: 0.85`         |
| Real shadows         | ❌ `box-shadow` (flat)           | ✅ Shadow maps cast by geometry                          |
| Depth fog            | ❌ Cannot do                     | ✅ `FogExp2` — back panel recedes into haze              |
| Gear teeth that mesh | ❌ SVG rotation (no interaction) | ✅ `ExtrudeGeometry` with actual tooth profiles          |
| Particle systems     | ❌ CSS animations (no gravity)   | ✅ Point systems with physics (steam rises, sparks fall) |
| Emissive glow        | ❌ `box-shadow` glow (flat)      | ✅ Emissive material property (light from within)        |

### Bundle Impact

- `three` (tree-shaken): ~150KB gzipped
- Loaded via `next/dynamic` with `ssr: false` — zero SSR, zero server bundle impact
- Only loads when desktop right rail renders — mobile never downloads it
- No additional dependencies beyond `three` and `@types/three`

### Desktop Only

The Bletchley Machine renders on desktop only. Mobile strategy is Shop Window — the right rail is hidden on mobile entirely. The Three.js canvas never initialises on viewports below `md` breakpoint. This eliminates all iOS WebGL concerns (canvas sizing, 3x pixel ratio, GPU memory limits).

---

## 5. Data Flow — How It Wires In

### The Pipeline (unchanged)

```
User types prompt
       │
       ▼
   Call 1: parse-sentence ─────────► assessment: CoverageAssessment
       │                               ├─ coverage: Record<category, { covered, phrases }>
       │                               ├─ coveredCount: number (e.g. 8)
       │                               └─ totalCategories: 12
       ▼
   Call 2: generate-tier-prompts ──► tierPrompts: GeneratedPrompts
       │                               ├─ tier1: string (CLIP)
       │                               ├─ tier2: string (Midjourney)
       │                               ├─ tier3: string (NL)
       │                               └─ tier4: string (Plain)
       ▼
   Call 3: optimise-prompt ────────► optimiseResult: AiOptimiseResult
                                       ├─ optimised: string
                                       ├─ changes: string[]
                                       ├─ charCount: number
                                       └─ tokenEstimate: number
```

### Props Interface (unchanged)

The new `BletchleyMachine` component accepts the identical `PipelineXRayProps` interface:

```typescript
export interface PipelineXRayProps {
  assessment?: CoverageAssessment | null; // Call 1 result
  isChecking?: boolean; // Call 1 in flight
  tierPrompts?: GeneratedPrompts | null; // Call 2 result
  isTierGenerating?: boolean; // Call 2 in flight
  optimiseResult?: AiOptimiseResult | null; // Call 3 result
  isOptimising?: boolean; // Call 3 in flight
  platformName?: string | null; // Selected platform
  platformTier?: number | null; // Platform tier (1–4)
  maxChars?: number | null; // Platform char limit
  generationId?: number; // Animation cancellation
  className?: string; // Outer container class
}
```

### Wiring Path (unchanged)

```
playground-page-client.tsx
  ├── State: xrayAssessment, xrayIsChecking, etc.
  ├── Callbacks: handleCoverageChange, handleTierGenerationChange, handleOptimisationChange
  │     └── Called by workspace component when API calls start/finish
  ├── Constructs: rightContent = <BletchleyMachine {...props} />
  └── Passes to: <HomepageGrid rightContent={rightContent} rightRailClassName={GLASS_CASE_CLASS} />
```

### Container

The HomepageGrid right rail renders:

```html
<section className="{GLASS_CASE_CLASS}">
  <!-- transparent, no padding, no ring -->
  <div ref="{rightRef}" className="... overflow-y-auto ...">
    {rightContent}
    <!-- BletchleyMachine renders here -->
  </div>
</section>
```

The `GLASS_CASE_CLASS` strips the default panel chrome (bg, ring, shadow) so the machine's own visual chrome takes over. The Three.js canvas fills this container.

### Data → Visual Mapping

| Data Source                        | Visual Element                                           | What Changes          |
| ---------------------------------- | -------------------------------------------------------- | --------------------- |
| `isChecking: true`                 | All 12 rotors start spinning                             | Machine wakes up      |
| `assessment.coverage[cat].covered` | Individual rotor locks (emerald) or stays dim            | Which rotors glow     |
| `assessment.coveredCount`          | Counter text "8 of 12 decoded"                           | Number shown          |
| `isTierGenerating: true`           | Cable extensions begin                                   | Switchboard activates |
| `tierPrompts.tier1` (word count)   | T1 nixie-tube counter target                             | Number rolled to      |
| `tierPrompts.tier2` (word count)   | T2 nixie-tube counter target                             | Number rolled to      |
| `tierPrompts.tier3` (word count)   | T3 nixie-tube counter target                             | Number rolled to      |
| `tierPrompts.tier4` (word count)   | T4 nixie-tube counter target                             | Number rolled to      |
| `isOptimising: true`               | Gauge needle begins sweep                                | Alignment activates   |
| `optimiseResult.charCount`         | Gauge needle target position (charCount / maxChars)      | Where needle settles  |
| `optimiseResult.changes`           | Ticker tape text content                                 | What gets printed     |
| `optimiseResult.changes.length`    | "N adaptations applied" counter                          | Adaptation count      |
| `platformName`                     | Brass plate label above gauge                            | Platform identity     |
| `platformTier`                     | Badge colour (T1 blue, T2 purple, T3 emerald, T4 amber)  | Tier identity         |
| `maxChars`                         | Gauge scale denominator                                  | Full-scale reference  |
| `generationId`                     | Animation cancellation — new ID kills running animations | Prevents stale state  |

### Local Derivation Rules

These values are derived locally inside the component, not from incoming props:

| Derived Value                | Source                                                                                              | Rule                                                                                                                         |
| ---------------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Rotor category order         | Hardcoded from `CATEGORY_ORDER` constant (same 12-item array used across all Prompt Lab components) | Fixed local mapping — not incoming data                                                                                      |
| Rotor category abbreviations | Hardcoded map: `subject → Sbj`, `action → Act`, etc.                                                | Fixed local mapping                                                                                                          |
| Tier word counts             | `tierPrompts.tierN.split(/\s+/).filter(Boolean).length`                                             | If `tierN` is `null`, `undefined`, or empty string → word count = 0, counter stays at zero, cable does not extend            |
| Gauge target angle           | `optimiseResult.charCount / maxChars` mapped to 0–270° arc                                          | If `maxChars` is `null` → gauge enters **uncalibrated state** (see §6.4). If `optimiseResult` is null → needle stays at zero |
| Adaptation count             | `optimiseResult.changes.length`                                                                     | If `changes` is empty array → "0 adaptations" — ticker tape skips text output                                                |

---

## 6. Feature Specification

### 6.1 The Housing (Glass Case)

The outer container. Everything lives inside this.

- Brass frame border with four corner rivets — each rivet is a sphere geometry with `MeshStandardMaterial` (`metalness: 0.9, roughness: 0.2`), catching the scene lights with a bright specular highlight at top-left
- Dark back panel (`#0A0D14`) receding into depth fog (`FogExp2`, density ~0.008) — the far wall feels distant
- Glass reflection overlay — a slow-drifting diagonal light bar across the front plane, like museum display glass catching overhead light. Not a physical glass mesh — a 2D post-process overlay on the canvas (cheaper, more controllable)
- Subtle warm amber inner glow — two dim point lights behind the instruments casting warmth outward. Intensity pulses on a 6–10s breathing cycle (amplitude 0.03–0.06, almost imperceptible but you feel it)
- Two meshing background gears — `ExtrudeGeometry` from a gear-tooth path. Low-segment extrusions (8 segments per tooth curve — background objects don't need high fidelity). Positioned behind the instruments, visible through gaps. One has 16 teeth, the other 10 (different sizes, interlocking). Idle: ~1 RPM. Active: 4x during decoding, 8x during optimising. `MeshStandardMaterial` in dark brass (`#3D2A18`, metalness 0.7) — visible but not competing with foreground instruments. Gear ratio is decorative — does not need to be mechanically correct, but teeth must not visibly clip or overlap

### 6.2 The Decoder — 12 Cipher Rotors

- 12 rotors in a 6×2 grid. Each rotor is a `CylinderGeometry` (short, coin-like) with `TorusGeometry` rings around the rim
- Category abbreviation on the face of each rotor — `CanvasTexture` with `ctx.fillText` mapped onto the cylinder face (no font file loading, no `TextGeometry`)
- Each rotor sits on a shared brass axle running through all six in its row — the axle is a thin `CylinderGeometry` in dark brass

**States per rotor:**

| State                 | Visual                                                          | Material                                     |
| --------------------- | --------------------------------------------------------------- | -------------------------------------------- |
| Idle                  | Slow breathing rotation (±3°, 8s cycle, staggered start)        | Dim brass (`metalness: 0.6, roughness: 0.4`) |
| Spinning              | Fast Y-axis rotation (randomised 2–5 full rotations per second) | Brass with slight amber emissive             |
| Locked (detected)     | Snaps to final position, stops                                  | Category colour emissive glow, bright text   |
| Locked (not detected) | Snaps to position, stays dim                                    | Dark brass, no emissive, dim text            |

**Timing:**

- Lock sequence: staggered left-to-right with randomised 120–200ms gaps
- Lock order: slight random shuffle — swap probability 30% per adjacent pair, so it's mostly left-to-right but not always
- Spark burst on lock: 8–15 point particles burst radially from rotor centre, with gravity (-9.8 y-axis), fade-out over 400ms. Spark count randomised per rotor
- Counter text (HTML overlay): "8 of 12 decoded" appears below in monospace, typewriter-stamped one character at a time

### 6.3 The Switchboard — Patch Cable Connections

- Four horizontal cable runs (T1, T2, T3, T4), each with socket geometry at left and right ends
- Sockets: small `CylinderGeometry` (recessed into a brass plate), dark centre, brass ring rim
- Cables: `TubeGeometry` following a catenary curve (slight sag — real wire under gravity, not a straight line)

**States per cable:**

| State     | Visual                                                                                                                                        |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Idle      | Sockets visible but dark. Random flicker on one socket every 4–8s (randomised which, randomised interval)                                     |
| Extending | Cable grows from left socket toward right socket. Extension speed randomised 400–700ms per tier                                               |
| Connected | Cable fully extended. Energy pulse (emissive bright spot) travels left→right along the catenary path repeatedly. Pulse speed varies per cable |
| Complete  | Pulse settles to steady dim glow. Nixie counter shows final value                                                                             |

**Timing:**

- Connection order: **fully randomised** — T3 might connect before T1. Full shuffle each run
- Gap between connections: randomised 200–400ms
- Steam burst between each connection: 3–5 particles rising from base vents, slight horizontal drift (randomised drift direction left or right)

**Nixie-tube counters:**

- At the right end of each cable: a small box geometry with a canvas-texture face showing warm amber digits
- Digits roll up mechanically — increment from 0 to target word count. Roll speed proportional to word count (higher counts roll longer, max 800ms)
- Word count derived from: `tierPrompts.tier1.split(/\s+/).filter(Boolean).length` — see §5 Local Derivation Rules for null/empty handling

**Cable colours (matching tier identity):**

| Tier | Cable Colour | Hex       |
| ---- | ------------ | --------- |
| T1   | Blue         | `#60A5FA` |
| T2   | Purple       | `#C084FC` |
| T3   | Emerald      | `#34D399` |
| T4   | Amber        | `#FB923C` |

### 6.4 The Alignment — Voltmeter Gauge

The peak moment. The most visually dramatic section.

- Large circular gauge: `RingGeometry` for the brass rim, `CircleGeometry` for the face, tick marks as thin `BoxGeometry` elements around the arc
- Needle: thin tapered `BoxGeometry` pivoting from centre pin (a small sphere)
- Arc fill: a second `RingGeometry` behind the needle that fills from 0→target with a gradient material (dark → amber → emerald)

**Needle physics:**

- Spring simulation: overshoot target by 8–15% (randomised), bounce back, overshoot less (damped harmonic oscillator)
- 2–3 oscillations before settling (randomised)
- Total sweep duration: 1.2–1.8s (randomised)
- Target angle derived from: `optimiseResult.charCount / maxChars` mapped to gauge arc (0° to 270°) — see below for uncalibrated state

**Idle state:**

- Needle rests at zero with very slow random drift (±1°, 8–12s sine cycle) — alive, not dead

**Uncalibrated state (maxChars is null):**

When `optimiseResult` arrives but `maxChars` is null (no platform selected, or platform config missing the value), the gauge does not jump to full scale. Instead:

- Needle stays at zero position (resting)
- Arc fill does not activate
- Capacity text shows only the absolute count: "347 chars" (no denominator, no slash)
- A small dim brass label below reads "— uncalibrated —" in monospace
- The ticker tape and adaptation counter still function normally — only the gauge's proportional reading is suppressed
- Once the user selects a platform and `maxChars` becomes available, the needle sweeps to the correct proportional position as if Call 3 just completed

This avoids the semantically incorrect "full saturation" that a `maxChars ?? 1` fallback would produce. An unknown denominator produces an honest "I don't know the scale" rather than a misleading "you're at 100%".

**Supporting elements:**

- Platform badge: HTML overlay above the gauge — platform name + tier colour dot
- Capacity text: HTML overlay — "347 / 500 chars" in monospace (or "347 chars" when uncalibrated)
- Ticker tape: HTML overlay below gauge — `optimiseResult.changes` joined, typewriter-stamped one character at a time. Scroll speed 30–50ms per char (randomised)
- Adaptation counter: "3 adaptations applied" — stamped after ticker tape completes

**Sound during alignment:**

- Rising frequency sweep (oscillator 200Hz → 800Hz) tracking needle movement
- Deep thud (80Hz sine + noise burst, 400ms) when needle settles at final position
- No sweep or thud in uncalibrated state (needle doesn't move)

### 6.5 The Idle State — Living Machine

The most important feature. Before any generation, before the user types a word, the machine is alive.

| Element          | Idle Behaviour                         | Randomisation                                                     |
| ---------------- | -------------------------------------- | ----------------------------------------------------------------- |
| Background gears | Turn at ~1 RPM                         | One gear ±5% speed variance vs the other (never perfectly synced) |
| Rotors           | Slow breathing rotation ±3°            | Each on different cycle length (7–9s range), staggered start      |
| Rotor twitch     | One random rotor jolts ±5° and returns | Which rotor: random. Interval: 3–6s (random)                      |
| Socket flicker   | One random socket brightens briefly    | Which socket: random. Interval: 4–8s (random)                     |
| Gauge needle     | Drifts ±1° on slow sine                | Cycle: 8–12s (random per page load)                               |
| Glass reflection | Diagonal light bar drifts slowly       | Direction: left-to-right, 20s cycle                               |
| Warm glow        | Ambient light intensity breathes       | Cycle: 6–10s, amplitude 0.03–0.06                                 |

No cold-start boot-up sequence. The machine is already alive in idle when the page loads. The idle state does the job — adding a boot animation creates complexity, another state, and another place for jank without improving the core interaction.

### 6.6 Sound Engine (Web Audio API — No External Files)

All sounds generated procedurally. Zero file downloads. See §11 Sound Policy for UX governance.

| Sound            | Trigger                          | Generation Method                                                           | Duration  |
| ---------------- | -------------------------------- | --------------------------------------------------------------------------- | --------- |
| Grinding rumble  | Call 1 begins (machine startup)  | Bandpass-filtered white noise (centre 150Hz, Q=2), exponential decay        | 500ms     |
| Rotor click      | Each rotor locks                 | Sine burst (800–1000Hz, randomised ±30Hz per rotor), fast exponential decay | 80ms      |
| Steam hiss       | Between phase transitions        | Bandpass white noise (centre 2kHz, Q=3), exponential decay                  | 200ms     |
| Nixie tick       | During counter roll-up           | Tiny noise bursts at 50ms intervals                                         | Per-digit |
| Gauge sweep      | During needle movement           | Sawtooth oscillator, frequency ramp 200Hz → 800Hz, tracking needle position | 1.2–1.8s  |
| Completion thud  | Needle settles at final position | Sine (80Hz) + noise burst, amplitude decay                                  | 400ms     |
| Typewriter clack | Each character on ticker tape    | Short noise burst (20ms), randomised ±10ms timing                           | 20ms      |

**Sound is not background music.** Every sound is a direct consequence of a visible mechanical action. Click = rotor locked. Hiss = steam vented. Thud = needle settled. The audio and visual are synchronised.

**No ambient hum.** The continuous 50Hz idle hum is removed from the spec. It's the most likely sound to become irritating and adds no value that the visual idle state doesn't already provide.

### 6.7 Randomisation System

Nothing repeats identically between runs. Every variable listed below is randomised within its stated range on each generation cycle.

| Variable                | Range                               | Per-what          |
| ----------------------- | ----------------------------------- | ----------------- |
| Rotor spin speed        | ±20% of base speed                  | Per rotor         |
| Rotor lock order        | 30% adjacent-swap probability       | Per run           |
| Lock timing gap         | 120–200ms                           | Per rotor pair    |
| Spark count             | 8–15 particles                      | Per rotor         |
| Click pitch             | ±30Hz around 900Hz base             | Per rotor         |
| Cable connection order  | Full shuffle of T1–T4               | Per run           |
| Cable extension speed   | 400–700ms                           | Per cable         |
| Cable gap timing        | 200–400ms                           | Per cable pair    |
| Steam drift direction   | Left or right                       | Per vent          |
| Gauge overshoot         | 8–15% past target                   | Per run           |
| Gauge oscillation count | 2 or 3 bounces                      | Per run           |
| Gauge sweep duration    | 1.2–1.8s                            | Per run           |
| Ticker char speed       | 30–50ms per character               | Per run           |
| Idle twitch target      | Any of 12 rotors                    | Per twitch event  |
| Idle twitch interval    | 3–6s                                | Per cycle         |
| Idle flicker target     | Any of 8 sockets (4 left + 4 right) | Per flicker event |
| Idle gear speed offset  | ±5% between the two gears           | Per page load     |

All randomisation ranges are defined in `bletchley/config.ts` (§15) for single-point tuning.

### 6.8 Phase Transitions

The machine has seven states. Transitions happen automatically based on prop changes.

```
IDLE ──► DECODING ──► DECODED ──► GENERATING ──► GENERATED ──► OPTIMISING ──► COMPLETE
  ▲                                                                               │
  └───────────────────────────────────────────────────────────────────────────────┘
                        (new generationId resets to IDLE)
```

| Transition             | Trigger                                                | Visual                                        | Sound               |
| ---------------------- | ------------------------------------------------------ | --------------------------------------------- | ------------------- |
| Idle → Decoding        | `isChecking` goes `true`                               | Gears speed to 4x, all rotors spin            | Grinding rumble     |
| Decoding → Decoded     | `assessment` arrives, `isChecking` goes `false`        | Rotors lock in staggered cascade, sparks      | Clicks (staggered)  |
| Decoded → Generating   | `isTierGenerating` goes `true`                         | Switchboard sockets illuminate                | Steam hiss          |
| Generating → Generated | `tierPrompts` arrives, `isTierGenerating` goes `false` | All cables connected, counters settled        | Final steam hiss    |
| Generated → Optimising | `isOptimising` goes `true`                             | Gears speed to 8x, needle lifts off zero      | Gauge sweep starts  |
| Optimising → Complete  | `optimiseResult` arrives, `isOptimising` goes `false`  | Needle settles, ticker tape feeds             | Thud + typewriter   |
| Complete → Idle        | New `generationId` incremented                         | All animations cancel, machine resets to idle | Silence (clean cut) |

**Cancellation:** When `generationId` increments mid-animation (user clicked Generate again), all running timers, tweens, and particle systems cancel immediately. The machine resets to idle, then starts the new sequence. No overlapping animations.

### 6.9 Event Precedence Table

The Prompt Lab has known race-condition complexity. This table defines what happens when events overlap.

| Scenario                                              | Behaviour                                                                                                                                                        |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User clicks Generate while Decoding is in progress    | `generationId` increments → all running animations cancel → machine resets to idle → new Decoding begins from scratch                                            |
| User clicks Generate while Optimising is in progress  | Same as above — full cancel and restart                                                                                                                          |
| Call 2 arrives after a newer Call 1 has started       | Stale `generationId` on the old Call 2 result → component ignores it (generationId mismatch guard)                                                               |
| User switches platform while Alignment is animating   | Gauge needle retargets to new `maxChars` immediately — spring physics restarts from current needle position to new target. Platform badge updates. No full reset |
| `optimiseResult` clears (optimise toggled off)        | Gauge needle sweeps back to zero. Ticker tape clears. Machine returns to Generated state (cables still connected)                                                |
| Component unmounts mid-animation (route change)       | All RAF cancelled, all timers cleared, renderer disposed, AudioContext closed. No leaked resources. See §10                                                      |
| `assessment` is null but `isChecking` is false        | Dormant state — rotors in idle breathing. No lock cascade                                                                                                        |
| `tierPrompts` arrives with empty string for a tier    | That tier's cable does not extend. Nixie counter stays at 0. Other tiers still animate normally                                                                  |
| `maxChars` is null when `optimiseResult` arrives      | Gauge enters uncalibrated state — needle stays at zero, capacity shows absolute count only, "— uncalibrated —" label shown. See §6.4                             |
| `maxChars` becomes available after uncalibrated state | Gauge transitions to calibrated — needle sweeps to proportional position as if Call 3 just completed                                                             |

---

## 7. Human Factors Declaration

Every visual element names the human factor it exploits (human-factors.md authority).

| Element                                 | Factor                     | Section | Why It Works                                                                        |
| --------------------------------------- | -------------------------- | ------- | ----------------------------------------------------------------------------------- |
| Dormant machine with breathing parts    | Zeigarnik Effect           | §4      | Incomplete machine creates tension — it wants to run, the user wants to see it run  |
| Rotor lock cascade                      | Anticipatory Dopamine      | §3      | Each lock is a micro-reward. "Another found, and another..." builds excitement      |
| Four cables processing in sequence      | Temporal Compression       | §6      | Multiple focal points occupy working memory. 2s wait feels like 0.5s                |
| Gauge needle overshoot + settle         | Optimal Stimulation        | §5      | Most complex visual at maximum anticipation — spring physics feels physical         |
| Different prompt → different animations | Variable Reward            | §2      | Same machine, unpredictable output. Third run still surprising                      |
| Ticker tape character reveal            | Curiosity Gap              | §1      | Can read ahead slightly but not fully. Must watch to completion                     |
| Glass case frame                        | Aesthetic-Usability Effect | §14     | Same components without glass = dashboard. With glass = museum exhibit              |
| Sound on every mechanical action        | Audio Psychology           | §16     | Sound confirms the visual. Click = lock confirmed. Thud = done. Reduces uncertainty |
| Needle settling as final moment         | Peak-End Rule              | §10     | The "peak" of the sequence. Users remember peaks and endings                        |
| Category colours on rotors              | Von Restorff Effect        | §12     | Each locked rotor is a unique colour — stands out from dim brass neighbours         |

---

## 8. Colour Palette

### Primary Materials

| Name        | Hex       | Usage                              | Three.js Material                        |
| ----------- | --------- | ---------------------------------- | ---------------------------------------- |
| Brass       | `#B87333` | Rotor bodies, frame, gauge rim     | `metalness: 0.85, roughness: 0.25`       |
| Brass Light | `#D4995C` | Rivet highlights, specular accents | `metalness: 0.9, roughness: 0.2`         |
| Brass Dim   | `#7A5C3E` | Frame ring, dormant wire           | `metalness: 0.6, roughness: 0.4`         |
| Brass Dark  | `#3D2A18` | Background gears, axles            | `metalness: 0.7, roughness: 0.35`        |
| Dark Panel  | `#0A0D14` | Back panel, cabinet interior       | `MeshBasicMaterial` (no lighting needed) |

### Emissive / State Colours

| Name        | Hex       | Usage                                            |
| ----------- | --------- | ------------------------------------------------ |
| Amber       | `#FBBF24` | Active/processing state, nixie digits, warm glow |
| Emerald     | `#34D399` | Locked/complete state, gauge fill                |
| Spark White | `#FFF7ED` | Spark particles                                  |
| Rose        | `#FB7185` | Error/overflow state on gauge                    |

### Tier Colours (Cable + Badge)

| Tier                | Colour  | Hex       |
| ------------------- | ------- | --------- |
| T1 CLIP             | Blue    | `#60A5FA` |
| T2 Midjourney       | Purple  | `#C084FC` |
| T3 Natural Language | Emerald | `#34D399` |
| T4 Plain Language   | Amber   | `#FB923C` |

### Category Colours (Rotor Lock Glow)

Sourced from `src/lib/prompt-colours.ts` (SSOT). Each rotor uses its category's colour as the emissive when locked.

All colour constants live in `bletchley/config.ts` — single source, single import.

---

## 9. Technical Constraints

### Hard Rules

1. **Desktop only.** Three.js canvas never initialises below `md` breakpoint. Use `next/dynamic` with `ssr: false` and a viewport-width check before mounting
2. **`prefers-reduced-motion`:** All animations freeze to static final state. All sound muted. Machine shows instruments in their idle positions, no movement
3. **Web Audio autoplay:** `AudioContext` created lazily on first user gesture (click or keypress). Never on page load
4. **All sizing via `clamp()`** for any HTML overlay text (counter, ticker tape, platform badge). Three.js geometry scales via camera/viewport calculations
5. **No grey text** on any HTML overlay. Dim brass (`#9B7B55`) minimum for dormant text. Bright white/amber/emerald for active text
6. **Cleanup on unmount:** `renderer.dispose()`, `scene.traverse(obj => obj.geometry?.dispose())`, all materials disposed, `AudioContext.close()`. No WebGL context leaks. Idempotent — safe under React Strict Mode double-mount
7. **Frame rate:** Target 60fps on modern desktop GPU. Graceful degradation to 30fps on lower-end machines
8. **Co-located styles** for any HTML overlay elements — `<style dangerouslySetInnerHTML>` inside the component, per code-standard.md §6.2
9. **Canvas pixel ratio:** `Math.min(window.devicePixelRatio, 2)` — cap at 2x to prevent 4K monitors from creating massive framebuffers
10. **CLS guard:** The right rail container preserves its height footprint during hydration and Three.js mount. The wrapper div has a fixed `min-height` matching the rail's layout allocation so the canvas appearing does not cause layout shift

### Dependencies

```json
{
  "three": "^0.170.0",
  "@types/three": "^0.170.0"
}
```

No other Three.js add-ons (no OrbitControls, no post-processing passes, no loaders). Everything built from core Three.js primitives.

### Performance Budget

| Metric                    | Target                     |
| ------------------------- | -------------------------- |
| Three.js bundle (gzipped) | < 160KB                    |
| Geometry count            | < 200 meshes               |
| Triangle count            | < 30,000                   |
| Particle count (peak)     | < 100                      |
| Draw calls                | < 50                       |
| Idle GPU usage            | < 5% (modern discrete GPU) |
| Active GPU usage          | < 15%                      |

See §12 for how these targets are enforced.

---

## 10. Runtime Lifecycle

### RAF Ownership

**One `requestAnimationFrame` loop only.** Owned by `scene-builder.ts`. All sections register their per-frame update functions with the scene builder via a `registerUpdate(fn)` pattern. No section runs its own RAF. The single loop calls all registered updaters, then renders.

```
RAF tick
  ├── decoder.update(delta)
  ├── switchboard.update(delta)
  ├── alignment.update(delta)
  ├── particles.update(delta)
  ├── gears.update(delta)
  └── renderer.render(scene, camera)
```

### Resize Handling

The container is a rail inside `HomepageGrid` with overflow handling. Resize responds to:

| Event                                    | Response                                                                                                                          |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Window resize                            | `ResizeObserver` on canvas parent. Renderer resizes to parent dimensions. Camera aspect ratio updates. No RAF restart             |
| Rail width change (e.g. sidebar toggle)  | Same `ResizeObserver` — handles any dimension change, not just window                                                             |
| Browser zoom                             | DPR recalculated, renderer pixel ratio updated. Geometry unchanged                                                                |
| Container dimensions zero on first mount | Guard: if width or height is 0, defer initialisation. Retry on next `ResizeObserver` callback. Do not create a zero-size renderer |

### Visibility / Backgrounding

| Condition                               | Behaviour                                                                                                                              |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Tab hidden (`document.hidden === true`) | RAF loop pauses. `AudioContext.suspend()`. No GPU work while tab is invisible                                                          |
| Tab visible again                       | RAF loop resumes. `AudioContext.resume()` (if sound enabled)                                                                           |
| Right rail scrolled offscreen           | Optional: `IntersectionObserver` on canvas. If not intersecting, pause RAF. Resume on re-entry. Low priority — rail is usually visible |

### React Strict Mode / Mount Safety

In development, React 18 Strict Mode mounts → unmounts → remounts components. The Three.js initialisation path must be **idempotent**:

- `useEffect` cleanup fully disposes renderer, scene, materials, geometries, AudioContext
- Second mount creates everything fresh — no stale references to disposed objects
- No singleton state outside the component (all state in refs or React state)
- `useRef` for renderer, scene, camera — not module-level variables

### Route Change / Unmount

When the user navigates away from the Prompt Lab:

1. `useEffect` cleanup fires
2. RAF loop cancelled (`cancelAnimationFrame`)
3. All pending `setTimeout`/`setInterval` cleared
4. `renderer.dispose()` — releases WebGL context
5. `scene.traverse()` — dispose all geometries and materials
6. `AudioContext.close()` — releases audio resources
7. Canvas element removed from DOM by React

No leaked WebGL contexts. No orphaned audio. No console warnings about missing `dispose()`.

---

## 11. Sound Policy

### Decisions (resolved)

| Question             | Decision                                                                | Rationale                                                                                                       |
| -------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Mute button?         | **Yes — small brass toggle, HTML overlay, top-right corner of machine** | Users expect local sound control. Do not rely on browser tab mute alone                                         |
| Default sound state? | **Muted on first visit**                                                | Unexpected noise from a page tool is a common annoyance. User must opt in                                       |
| Ambient hum?         | **Removed from spec entirely**                                          | Visual idle state already communicates "machine is alive". Continuous hum is the most irritating sound category |
| Cold-start boot-up?  | **No — machine is already alive in idle on page load**                  | Adds complexity, another state, another jank risk for minimal UX gain                                           |

### Mute Button Spec

- HTML overlay (not 3D geometry) — positioned top-right of the canvas container
- Small brass-coloured circle with a speaker icon (SVG). Muted state shows speaker with line-through
- `cursor-pointer`
- Clicking toggles `isMuted` state
- Sound preference persisted in `localStorage` key `promagen-machine-sound` (`"on"` or `"off"`)
- Default: `"off"` (muted)
- All action sounds (clicks, hisses, thuds, sweeps) are gated behind `!isMuted`
- When muted: `AudioContext` is never created (saves resources). When unmuted: `AudioContext` created on the toggle click itself (user gesture satisfies autoplay policy)
- Keyboard accessible: focusable with tab, togglable with Enter/Space

### Sound Hierarchy

When sound is enabled:

| Priority | Sound            | Always plays?         |
| -------- | ---------------- | --------------------- |
| 1        | Rotor click      | Yes — core feedback   |
| 2        | Completion thud  | Yes — signals "done"  |
| 3        | Gauge sweep      | Yes — tracks needle   |
| 4        | Steam hiss       | Yes — phase separator |
| 5        | Grinding rumble  | Yes — startup signal  |
| 6        | Nixie tick       | Yes but very quiet    |
| 7        | Typewriter clack | Yes but very quiet    |

All sounds are action-triggered. No background, ambient, or continuous sounds.

---

## 12. Draw-Call Control Strategy

Draw-call creep is the #1 build risk. This section defines how the <50 draw-call target is enforced.

### Material Reuse

Many meshes share the same visual appearance. These use **shared material instances**, not copies:

| Shared Material                           | Used By                                                  |
| ----------------------------------------- | -------------------------------------------------------- |
| `brassMat` (standard, metalness 0.85)     | All 12 rotor bodies, gauge rim, frame edges, socket rims |
| `brassDarkMat` (standard, metalness 0.7)  | Both background gears, both axles, tick marks            |
| `brassLightMat` (standard, metalness 0.9) | All 4 corner rivets                                      |
| `darkPanelMat` (basic, #0A0D14)           | Back panel                                               |

Unique materials only for elements that need unique emissive colours (12 rotor lock states, 4 cable colours, gauge arc fill). That's ~18 unique materials maximum.

### Merged Static Geometry

Elements that never move independently can be merged into single `BufferGeometry` draws:

| Merge Group    | Elements Merged                                   | Saves              |
| -------------- | ------------------------------------------------- | ------------------ |
| Housing static | Frame edges, back panel, rivet mounts             | ~8 draw calls → 1  |
| Gauge static   | Rim ring, face circle, all tick marks, centre pin | ~20 draw calls → 1 |
| Axles          | Both row axles                                    | 2 → 1              |

### Instancing (if needed)

If draw calls still creep above 40 after material reuse and geometry merging:

- 12 rotors → `InstancedMesh` with per-instance colour/transform (1 draw call instead of 12)
- 8 sockets → `InstancedMesh` (1 draw call instead of 8)

Instancing is the fallback, not the first approach. Material reuse + geometry merging should be sufficient.

### Draw-Call Budget

| Section                                                | Estimated Draw Calls     |
| ------------------------------------------------------ | ------------------------ |
| Housing (merged static)                                | 1                        |
| Background gears (2 meshes)                            | 2                        |
| Glass reflection overlay                               | 1                        |
| Rivets (merged or instanced)                           | 1                        |
| Axles (merged)                                         | 1                        |
| 12 Rotors (12 meshes, shared material swapped on lock) | 12                       |
| 12 Rotor labels (canvas textures on faces)             | 0 (part of rotor meshes) |
| 8 Sockets (instanced or merged)                        | 1–2                      |
| 4 Cables (TubeGeometry)                                | 4                        |
| 4 Nixie counters (box + canvas texture)                | 4                        |
| Gauge (merged static)                                  | 1                        |
| Gauge needle                                           | 1                        |
| Gauge arc fill                                         | 1                        |
| Particles (single Points mesh)                         | 1                        |
| **Total**                                              | **~31–33**               |

Comfortably under 50. Verified during Delivery 1 via `renderer.info.render.calls` logged to console in dev mode.

---

## 13. Accessibility

### Canvas Treatment

- The `<canvas>` element is `aria-hidden="true"` — it is a decorative visualisation, not interactive content
- All meaningful information is duplicated in HTML overlays that screen readers can access

### HTML Overlays (screen-reader visible)

| Overlay          | Content                                              | Semantic                                                                             |
| ---------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Decoder counter  | "8 of 12 categories decoded"                         | `<p role="status" aria-live="polite">` — announced on change                         |
| Tier word counts | "T1: 127 words, T2: 98 words..."                     | `<p role="status" aria-live="polite">`                                               |
| Platform badge   | "Leonardo AI · Tier 3"                               | `<p>`                                                                                |
| Capacity text    | "347 / 500 characters" or "347 chars" (uncalibrated) | `<p role="status" aria-live="polite">`                                               |
| Ticker tape      | Full changes text                                    | `<p role="status" aria-live="polite">` — announced when complete (not per-character) |
| Mute button      | "Toggle machine sound"                               | `<button aria-label="Toggle machine sound" aria-pressed="true/false">`               |

### Reduced Motion

When `prefers-reduced-motion: reduce` is active:

- All Three.js animations stop — machine shows static instrument positions
- No gear rotation, no rotor spin, no particle effects
- Gauge needle jumps directly to final position (no spring animation)
- Cables appear instantly connected (no extension animation)
- All sound muted regardless of mute button state
- HTML overlays still update with data — information is never lost

### Keyboard

- Mute button is the only interactive element. Focusable via Tab, togglable via Enter/Space
- No other keyboard traps inside the machine — it is display-only

---

## 14. Fallback & Kill Switch

### WebGL Failure Fallback

If WebGL context creation fails (old GPU, driver issues, browser restrictions):

1. `try/catch` around `new THREE.WebGLRenderer()` — catches context creation failure
2. Fallback: render a static HTML/CSS version of the machine — the current flat `PipelineXRay` component, loaded dynamically
3. Console warning: `"Bletchley Machine: WebGL unavailable, falling back to flat display"`
4. No user-facing error message — the fallback looks intentional, not broken

### Audio Failure Fallback

If `AudioContext` creation fails:

1. `try/catch` around `new AudioContext()` — catches permission/support failure
2. Sound silently disabled. Mute button hidden (nothing to toggle)
3. Visual machine operates normally — sound is enhancement, not dependency

### Kill Switch (Feature Flag)

A boolean flag in `playground-page-client.tsx` controls which component loads:

```typescript
const USE_BLETCHLEY_MACHINE = true; // Kill switch — set false to revert to flat display

const rightContent = USE_BLETCHLEY_MACHINE
  ? <BletchleyMachine {...props} />
  : <PipelineXRay {...props} />;
```

During the rollout period (Deliveries 1–4), both components exist in the codebase. The old `xray-*.tsx` files are only deleted in Delivery 5 after the machine is verified stable in production. If anything goes wrong, one boolean flip and redeploy reverts to the flat display.

After Delivery 5 sign-off, the flag and old files are removed.

---

## 15. File Map — What Gets Created / Changed

### New Files (9 files)

| File                                                          | Purpose                                                                                                                                                  | Approx Lines |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| `src/components/prompt-lab/bletchley-machine.tsx`             | Main component — Three.js canvas, React wrapper, HTML overlays, mute button, props consumption, fallback gate                                            | ~350         |
| `src/components/prompt-lab/bletchley/config.ts`               | **Shared constants** — all colours, timing ranges, randomisation ranges, material params, sound params, performance thresholds. Single source for tuning | ~150         |
| `src/components/prompt-lab/bletchley/scene-builder.ts`        | Three.js scene setup — renderer, camera, lights, fog, housing geometry, single RAF loop, resize handling, section registration, visibility pause         | ~280         |
| `src/components/prompt-lab/bletchley/decoder-section.ts`      | 12 rotor geometries, spin/lock/spark animations, update function registered with scene builder                                                           | ~250         |
| `src/components/prompt-lab/bletchley/switchboard-section.ts`  | 4 cable runs, socket geometry, catenary curves, nixie counters, update function                                                                          | ~250         |
| `src/components/prompt-lab/bletchley/alignment-section.ts`    | Gauge geometry, needle spring physics, arc fill, uncalibrated state, update function                                                                     | ~220         |
| `src/components/prompt-lab/bletchley/sound-engine.ts`         | Web Audio API — all 7 sound effects, mute control, lazy init, dispose                                                                                    | ~120         |
| `src/components/prompt-lab/bletchley/particles.ts`            | Steam + spark particle systems, gravity, fade, update function                                                                                           | ~100         |
| `src/components/prompt-lab/bletchley/animation-controller.ts` | Phase state machine (7 states), event precedence, randomisation orchestration, generationId cancellation, timing sequencer                               | ~180         |

**Total new:** ~1,900 lines across 9 files

Note: Delivery 1 (foundation) will likely land closer to ~900 lines than the original ~750 estimate. The wrapper, scene builder, config, animation controller shell, mute button, lifecycle handling, and resize/visibility logic all ship together and add up. This is expected — the estimate is approximate, not a hard cap.

### Modified Files

| File                         | Change                                                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `playground-page-client.tsx` | Add `USE_BLETCHLEY_MACHINE` flag. Dynamic import of `BletchleyMachine`. Conditional render. ~10 lines changed |
| `package.json`               | Add `three` + `@types/three`                                                                                  |

### Deleted Files (Delivery 5 only, after production verification)

| File                   | Lines              |
| ---------------------- | ------------------ |
| `xray-decoder.tsx`     | 418                |
| `xray-switchboard.tsx` | 339                |
| `xray-alignment.tsx`   | 520                |
| `xray-teletype.tsx`    | 177                |
| `xray-split-flap.tsx`  | 203                |
| `xray-score.tsx`       | 368 (already dead) |
| `pipeline-xray.tsx`    | 232                |

**Total deleted:** 2,257 lines (only after kill switch period ends)

---

## 16. Build Plan — Delivery Order

Each delivery is independently deployable and testable. If delivery N works, we don't need to undo it to ship delivery N+1.

### Delivery 1 — Foundation: Housing + Gears + Lifecycle Shell (~900 lines)

**What ships:** Empty glass case with brass frame, corner rivets, dark back panel, depth fog, glass reflection drift, two meshing background gears turning slowly. Plus: the animation-controller shell (state machine, RAF ownership, resize handling, visibility pause, generationId cancellation, section registration model). Mute button (HTML overlay, wired to localStorage). Config file with all shared constants. CLS-safe wrapper with min-height.

**Why lifecycle ships here:** If the state machine only arrives in Delivery 4, the three earlier deliveries each invent their own mini-lifecycle. The animation controller establishes the single RAF loop, the section registration pattern, and the cancellation primitives from day one. Decoder, Switchboard, and Alignment register into this framework.

**What you see:** A beautiful empty brass-framed case with gears slowly turning behind glass. Mute button in corner. The idle glow breathes.

**Props consumed:** `generationId` (for cancellation wiring)

**Test:** Dev server, open Prompt Lab, right rail shows the case. Gears turn. Glass reflection drifts. Mute button toggles. No errors in console. GPU usage < 5% idle. `renderer.info.render.calls` logged — confirm < 10. Resize browser — canvas resizes cleanly. Navigate away and back — no WebGL leak warnings. Tab hidden → RAF pauses. Tab visible → RAF resumes. Strict Mode double-mount → no duplicate renderers. Container zero-width → no crash, deferred init.

### Delivery 2 — The Decoder (12 Rotors + Sound) (~370 lines)

**What ships:** 12 rotor geometries on axles, idle breathing animation, spin + lock + spark cascade when Call 1 fires, rotor click sounds + grinding rumble, counter text overlay. Registers with animation-controller's RAF loop and state machine.

**Props consumed:** `assessment`, `isChecking`, `generationId`

**Test:** Type a prompt, click Generate. Rotors spin, then lock in staggered cascade with sparks and clicks. Counter shows "N of 12 decoded". Different prompts lock different rotors. Mute works. Cancel mid-spin (Generate again) — clean reset. Draw calls still < 30.

### Delivery 3 — The Switchboard (Cables + Nixie Counters) (~350 lines)

**What ships:** 4 cable runs with sockets, catenary cable extension, energy pulses, nixie-tube counter roll-up, steam vents between connections, steam hiss sound. Registered with animation-controller.

**Props consumed:** `tierPrompts`, `isTierGenerating`, `generationId`

**Test:** Generate prompts. After rotors lock, cables extend in randomised order with steam between. Nixie counters roll up to word counts. Different prompts produce different word counts. Empty tier string → that cable doesn't extend. Draw calls still < 40.

### Delivery 4 — The Alignment + Performance Hardening (~380 lines)

**What ships:** Voltmeter gauge with spring-physics needle, arc fill, uncalibrated state, platform badge, capacity text, ticker tape output, gauge sweep sound, completion thud, typewriter clack. Full phase transition system complete. Plus: **performance hardening pass** — verify draw-call budget, check GPU usage targets, test reduced-motion, test all event precedence scenarios from §6.9. Plus: **fallback verification** — WebGL failure path tested, kill switch tested.

**Props consumed:** `optimiseResult`, `isOptimising`, `platformName`, `platformTier`, `maxChars`, `generationId`

**Test:** Full end-to-end: Generate → rotors spin → cables connect → needle sweeps → ticker tape prints. Cancel mid-animation — clean reset. Switch platform mid-gauge — needle retargets. Different platforms → different needle positions. `renderer.info` confirms < 50 draw calls, < 30K triangles. maxChars null → uncalibrated state shows correctly. maxChars arrives later → gauge calibrates and needle sweeps. Reduced-motion: everything static, no sound. Screen reader: all overlays announced. WebGL failure: flat fallback loads. 10 consecutive Generates: no memory growth.

### Delivery 5 — Swap, Delete, Deploy

**What ships:** Remove `USE_BLETCHLEY_MACHINE` flag (hardcode to machine). Delete all old `xray-*.tsx` files and `pipeline-xray.tsx`. Verify production build. Deploy.

**Pre-flight:**

- `pnpm run build` — zero errors
- Production deploy — right rail shows the machine
- Full flow works end-to-end in production
- Kill switch tested: flag set to false → flat display loads → flag restored → machine loads
- 24-hour soak period before deleting old files

**Test:** `pnpm run build` — zero errors. Production deploy — right rail shows machine. Full flow works. Old files gone from bundle. Bundle size delta confirmed (~150KB three.js added, ~2.2K lines CSS removed).

---

## 17. Non-Regression Rules

These must remain true after every delivery:

1. **Centre column unchanged.** The text input, tier cards, assembled prompt, optimise toggle — all untouched
2. **Left rail unchanged.** Platform Match Rail — untouched
3. **API routes unchanged.** Zero changes to any `/api/` route
4. **Hooks unchanged.** `use-ai-optimisation.ts`, `use-prompt-lab.ts`, etc. — untouched
5. **Types unchanged.** `CoverageAssessment`, `GeneratedPrompts`, `AiOptimiseResult` — untouched
6. **Mobile unchanged.** Right rail hidden on mobile — Three.js never loads on mobile
7. **HomepageGrid unchanged.** Container layout, rail widths, responsive behaviour — untouched
8. **Pro page unchanged.** No modifications to `/pro-promagen/` or any other page
9. **Build passes.** `pnpm run build` must complete with zero errors after every delivery
10. **No new API calls.** The machine visualises existing data. Zero new network requests
11. **No CLS regression.** Right rail maintains its height footprint during hydration. No layout shift when canvas mounts
12. **Kill switch functional.** Until Delivery 5 sign-off, `USE_BLETCHLEY_MACHINE = false` must cleanly revert to flat display

---

## 18. Testing & Verification

### Per-Delivery Checklist

```
□ pnpm run build — zero errors
□ Remove-Item -Recurse -Force .next (clear cache)
□ pnpm run dev — no console errors on page load
□ Right rail renders the machine (or cabinet + gears for Delivery 1)
□ GPU usage in Task Manager < threshold (5% idle, 15% active)
□ renderer.info.render.calls logged in dev — confirm under budget
□ prefers-reduced-motion: ON — machine static, no sound
□ Resize browser window — canvas resizes smoothly, no distortion
□ Navigate away and back — no WebGL context leak warnings
□ Console: no Three.js warnings about missing dispose()
□ Mute button toggles sound. Preference persists across page reload
□ Kill switch: set flag false — flat display loads correctly
□ Tab hidden → resume: RAF pauses and resumes, no console errors
□ Browser zoom 125%, 150% — canvas scales correctly
```

### Full Integration Test (After Delivery 4)

```
□ Type prompt → Generate → full sequence plays (rotors → cables → gauge)
□ Different prompt → different rotor locks, different word counts, different needle position
□ Cancel mid-animation (Generate again) → clean reset, new sequence starts
□ Switch platform mid-generation → gauge updates to new maxChars
□ Sound plays only when mute button is off. Mute button toggles cleanly
□ Long prompt (all 12 categories covered) → all 12 rotors lock in category colours
□ Short prompt (3 categories) → only 3 rotors lock, 9 stay dim
□ Platform with low maxChars → needle at high angle (near full)
□ Platform with high maxChars → needle at low angle (plenty of room)
□ maxChars null → uncalibrated state: needle at zero, "347 chars", "— uncalibrated —"
□ maxChars arrives after uncalibrated → needle sweeps to proportional position
□ Empty tier string → that cable doesn't extend, counter stays 0
□ Reduced motion ON → static display, all data still shown in HTML overlays
□ Screen reader test: all overlays read out correct values
□ WebGL failure (simulate via renderer mock) → flat fallback loads
□ Strict Mode double-mount → no duplicate renderers, no leaked contexts
□ 10 consecutive Generate clicks → no memory growth, no orphaned animations
```

---

## 19. Automated Test Hooks

The machine is highly visual and stateful. Manual testing covers the visual, but automated tests protect against regressions in the state machine and lifecycle.

### Test IDs for Overlay States

Every HTML overlay element gets a `data-testid` attribute for automated queries:

| Element            | `data-testid`                                  |
| ------------------ | ---------------------------------------------- |
| Decoder counter    | `bletchley-decoder-count`                      |
| T1 word count      | `bletchley-nixie-t1`                           |
| T2 word count      | `bletchley-nixie-t2`                           |
| T3 word count      | `bletchley-nixie-t3`                           |
| T4 word count      | `bletchley-nixie-t4`                           |
| Platform badge     | `bletchley-platform-badge`                     |
| Capacity text      | `bletchley-capacity`                           |
| Uncalibrated label | `bletchley-uncalibrated`                       |
| Ticker tape        | `bletchley-ticker`                             |
| Mute button        | `bletchley-mute`                               |
| Machine phase      | `bletchley-phase` (value = current state name) |

### Unit Tests (animation-controller)

| Test                                        | Assertion                                                                    |
| ------------------------------------------- | ---------------------------------------------------------------------------- |
| Initial state                               | Phase is `IDLE`                                                              |
| `isChecking: true` → phase                  | Phase transitions to `DECODING`                                              |
| `assessment` arrives → phase                | Phase transitions to `DECODED`                                               |
| `generationId` increments mid-`DECODING`    | Phase resets to `IDLE`, all pending timers cleared                           |
| `generationId` increments mid-`OPTIMISING`  | Phase resets to `IDLE`, all pending timers cleared                           |
| Stale `tierPrompts` with old `generationId` | Ignored — phase does not advance                                             |
| Full prop sequence                          | `IDLE → DECODING → DECODED → GENERATING → GENERATED → OPTIMISING → COMPLETE` |

### Smoke Tests (mount/unmount/dispose)

| Test                                  | Assertion                                                       |
| ------------------------------------- | --------------------------------------------------------------- |
| Mount component                       | No console errors. `renderer.info` accessible                   |
| Unmount component                     | No WebGL context leak warning. No orphaned RAF                  |
| Mount → unmount → mount (Strict Mode) | Second mount works identically. No duplicate renderers          |
| Mount with container width 0          | Deferred init, no crash. Renderer created on first valid resize |

### Reduced Motion Test

| Test                             | Assertion                                                                                                                                    |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `prefers-reduced-motion: reduce` | Phase still transitions on prop changes. HTML overlays update. No animations fire. `data-testid="bletchley-phase"` still shows correct state |

### Component Integration Smoke Test

One minimal component-level test that verifies HTML overlays update correctly when props change, without requiring a browser WebGL context:

| Test                                   | Setup                                                                                         | Assertion                                                                                                                   |
| -------------------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Overlay updates on assessment prop     | Render `BletchleyMachine` with mock assessment (8/12 covered). WebGL renderer mocked to no-op | `data-testid="bletchley-decoder-count"` contains "8 of 12". `data-testid="bletchley-phase"` is `DECODED`                    |
| Overlay updates on tierPrompts prop    | Render with mock tierPrompts (tier1: "a b c", tier2: "d e")                                   | `data-testid="bletchley-nixie-t1"` shows "3". `data-testid="bletchley-nixie-t2"` shows "2"                                  |
| Overlay updates on optimiseResult prop | Render with mock optimiseResult (charCount: 347, changes: ["x","y"]), maxChars: 500           | `data-testid="bletchley-capacity"` contains "347 / 500". `data-testid="bletchley-ticker"` contains change text              |
| Uncalibrated state                     | Render with mock optimiseResult but maxChars: null                                            | `data-testid="bletchley-uncalibrated"` is visible. `data-testid="bletchley-capacity"` contains "347 chars" (no denominator) |

These tests mock the Three.js renderer (no real WebGL context needed) and verify only that the React wrapper correctly derives and displays data in the HTML overlays. They run via `pnpm run test:util` using the existing test infrastructure.

---

## 20. Decisions Log

| Date       | Decision                                        | Rationale                                                                                                                                                                                          |
| ---------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5 Apr 2026 | **Path A — Three.js**                           | CSS can't deliver metallic shading, real shadows, depth fog, or particle physics. The brief demands a physical machine — that requires real 3D                                                     |
| 5 Apr 2026 | **Desktop only**                                | Mobile is Shop Window. Right rail hidden on mobile. Three.js never loads below md breakpoint. Eliminates all iOS WebGL concerns                                                                    |
| 5 Apr 2026 | **Web Audio, no files**                         | All sounds procedural. Zero downloads. Initialised on first user gesture                                                                                                                           |
| 5 Apr 2026 | **Props interface unchanged**                   | `PipelineXRayProps` is the contract. New component is a drop-in visual replacement. Zero data flow changes                                                                                         |
| 5 Apr 2026 | **5-delivery build plan**                       | Each delivery independently deployable. Foundation first (including lifecycle shell), then instruments one section at a time, then swap + delete                                                   |
| 5 Apr 2026 | **9-file architecture**                         | 8 functional files + 1 shared `config.ts` for all constants, colours, timing ranges. Prevents drift, enables single-point tuning                                                                   |
| 5 Apr 2026 | **Mute button — YES**                           | Small brass HTML overlay toggle, top-right of canvas. Sound off by default. Preference persisted in localStorage. Keyboard accessible                                                              |
| 5 Apr 2026 | **Sound muted by default**                      | Unexpected noise from a page tool is a common annoyance. User opts in via mute button. First click creates AudioContext (satisfies autoplay policy)                                                |
| 5 Apr 2026 | **Ambient hum — REMOVED**                       | Visual idle state already communicates "machine is alive". Continuous hum is the most irritating sound category. No value added                                                                    |
| 5 Apr 2026 | **No cold-start boot-up**                       | Machine is already alive in idle on page load. Boot animation adds complexity, another state, another jank risk for minimal UX gain                                                                |
| 5 Apr 2026 | **Canvas texture for rotor labels**             | `CanvasTexture` with `ctx.fillText`, not `TextGeometry`. Simpler, lighter, no font file loading                                                                                                    |
| 5 Apr 2026 | **Gear ratio decorative**                       | Teeth must not visibly clip or overlap, but mechanical correctness is not required                                                                                                                 |
| 5 Apr 2026 | **Kill switch during rollout**                  | `USE_BLETCHLEY_MACHINE` boolean flag. Old files kept until Delivery 5 sign-off. One flip + redeploy reverts to flat display                                                                        |
| 5 Apr 2026 | **Animation controller ships in Delivery 1**    | Prevents three deliveries inventing their own mini-lifecycles. Single RAF loop, section registration, cancellation primitives established from day one                                             |
| 5 Apr 2026 | **Shared material reuse for draw-call control** | Draw-call creep is the #1 build risk. Shared materials, merged static geometry, instancing as fallback. Budget: <33 draw calls estimated, <50 hard limit                                           |
| 5 Apr 2026 | **WebGL failure → flat fallback**               | `try/catch` around renderer creation. Falls back to existing `PipelineXRay`. No user-facing error                                                                                                  |
| 5 Apr 2026 | **Gauge uncalibrated state**                    | When `maxChars` is null, gauge shows absolute count only with "— uncalibrated —" label. Avoids misleading full-scale saturation. Needle sweeps to correct position once maxChars becomes available |
| 5 Apr 2026 | **Delivery 1 estimate ~900 lines**              | Original ~750 was optimistic. Foundation includes wrapper, scene builder, config, animation controller shell, mute button, resize/visibility logic — realistically ~900                            |

---

_End of document. v1.2.0 — signed off, build-ready._
