# Left-Hand Rail — Platform Match + Prompt Scoring Engine (Call 4)

**Version:** 1.2.0
**Created:** 2 April 2026
**Updated:** 2 April 2026
**Owner:** Promagen
**Status:** APPROVED — v1.2.0 final review revision. Architecture locked. Ready to build.
**Scope:** Prompt Lab (`/studio/playground`) left rail ONLY. Homepage and World Context left rails remain exchange-based — untouched.
**Authority:** This document defines the architecture, API contract, visual design, animation system, and build order for the Prompt Lab's left-hand rail replacement.

> **Cross-references:**
>
> - `ai-disguise.md` v5.0.0 — Disguise principle, algorithm naming, Call 1–3 architecture
> - `prompt-lab.md` v4.0.0 — Prompt Lab routes, component table, data flow
> - `prompt-lab-v4-flow.md` v2.0.0 — Check → Assess → Decide → Generate four-phase flow
> - `prompt-optimizer.md` v6.0.0 — Call 3 architecture, 43 independent builders
> - `human-factors.md` v1.1.0 — Curiosity Gap, Variable Reward, Anticipatory Dopamine, Loss Aversion, Von Restorff
> - `code-standard.md` v4.0 — clamp(), no grey text, co-located animations, cursor-pointer
> - `best-working-practice.md` — Human Factors Gate, SSOT discipline, playground-first workflow
> - `platform-config.json` + `platform-config.ts` — Platform SSOT (40 platforms)
> - `righthand-rail.md` v1.2.0 — Companion doc for the right-hand Pipeline X-Ray rail

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [What It Replaces](#2-what-it-replaces)
3. [Human Factors Declaration](#3-human-factors-declaration)
4. [Two-State Architecture](#4-two-state-architecture)
5. [State 1 — Platform Navigator (Before Generation)](#5-state-1--platform-navigator-before-generation)
6. [State 2 — Scoring Panel (After Call 3)](#6-state-2--scoring-panel-after-call-3)
7. [Call 4 — API Contract](#7-call-4--api-contract)
8. [Call 4 — System Prompt Specification](#8-call-4--system-prompt-specification)
9. [Call 4 — Cost & Throttle Controls](#9-call-4--cost--throttle-controls)
10. [Animation System](#10-animation-system)
11. [Disguise Layer](#11-disguise-layer)
12. [Edge Cases](#12-edge-cases)
13. [Data Flow Diagram](#13-data-flow-diagram)
14. [File Map](#14-file-map)
15. [Build Order](#15-build-order)
16. [Non-Regression Rules](#16-non-regression-rules)
17. [Decisions Log](#17-decisions-log)

---

## 1. Purpose

The Prompt Lab's left rail currently displays stock exchange cards — financial data that has no relationship to AI image prompt building. This confuses the value proposition and makes Promagen look unfocused.

The replacement rail serves two functions:

1. **Platform Navigator** — a clean, tier-grouped list of all 40 platforms that the user can click to select a platform. Discovery + navigation.
2. **Prompt Scoring Engine** — after the user generates and optimises a prompt, Call 4 fires and scores the optimised prompt against the selected platform, returning a score out of 100 and 2–3 specific improvement directives.

The scoring engine is the engagement loop. The user sees "87.3 — add a focal point to push to ~92" → edits the prompt → regenerates → score updates → did it go up? That uncertainty is Variable Reward. That loop is why users come back.

**Score meaning:** A score of 87 on Leonardo means "close to Leonardo's ideal prompt." It is not comparable to 87 on Midjourney — each platform is scored against its own ceiling. The score is a per-platform quality signal, not a universal league table.

---

## 2. What It Replaces

**Removed from Prompt Lab page only:**
- `ReorderedExchangeRails` (left content)
- `ExchangeList` component rendering in the left rail
- All exchange-related data flow in `playground-page-client.tsx`

**NOT removed:**
- Exchange rails on homepage (`/`) — untouched
- Exchange rails on World Context (`/world-context`) — untouched
- Exchange rails on Pro Promagen page (`/pro-promagen`) — untouched
- `HomepageGrid` component — untouched (new rail content passes via `leftContent` prop)

The `HomepageGrid` three-column grid stays. The left rail's `<section>` panel chrome stays (`rounded-3xl bg-slate-950/70 ring-1 ring-white/10`). Only the content inside changes.

---

## 3. Human Factors Declaration

Every visual element in this rail must trace to a named human factor.

### State 1 — Platform Navigator

| Element | Primary Factor | Why |
|---|---|---|
| Tier-grouped platform list | Spatial Framing (§7) | Tier groups create a mental map: "CLIP platforms are here, NL platforms are there." Reduces cognitive load for the 40-platform selection. |
| Platform click → loads in centre | Fitts's Law (§13) | Platform name is a large click target in the rail. Closer than scrolling the centre dropdown. |
| Tier colour dots | Von Restorff Effect (§12) | Each tier has a unique colour (blue/purple/emerald/orange). The dot isolates each group visually without labels. |

### State 2 — Scoring Panel

| Element | Primary Factor | Why |
|---|---|---|
| Score reveal animation | Anticipatory Dopamine (§3) | Three-phase pattern: cycling animation (awareness) → deceleration (acceleration) → score lands (payoff). |
| Non-round decimal score (87.3) | Aesthetic-Usability Effect (§14) | Precision implies rigour. "87" feels rounded. "87.3" feels measured. Users trust precise numbers more. |
| Improvement directives with category colour dots | Curiosity Gap (§1) | Each directive names a category ("Add composition: wide establishing shot") but doesn't show the result. The gap between the suggestion and the improved score drives the click. |
| Score delta on re-generation (↑ 5.8) | Variable Reward (§2) | Did it go up? By how much? The user cannot predict the delta. That unpredictability is the addiction. |
| Score colour coding (emerald/amber/rose) | Colour Psychology (§17) | Emerald ≥ 85 = "your prompt is strong." Amber 70–84 = "room to improve." Rose < 70 = "needs work." Three-colour system, max allowed on a single view. |

**Anti-pattern to avoid:** Showing the score instantly. The animation must create anticipation. A number that appears without ceremony has no psychological weight.

---

## 4. Client State Machine

v1.0.0 described "exactly two visual states." That was a design fiction. The real client will have intermediate realities that must be explicitly handled. This section defines the actual state machine.

### State Discriminated Union

```typescript
type ScoringRailState =
  | { phase: 'idle' }                                           // No platform selected, no generation
  | { phase: 'browsing'; selectedPlatformId: string }           // Platform selected, no generation yet
  | { phase: 'optimising'; selectedPlatformId: string }         // Call 3 in flight
  | { phase: 'scoring'; selectedPlatformId: string }            // Call 3 done, Call 4 in flight
  | { phase: 'scored'; selectedPlatformId: string;              // Call 4 returned, fresh score
      score: ScoreResult; previousScore?: ScoreResult }
  | { phase: 'scored-cached'; selectedPlatformId: string;       // Identical prompt, cached score shown
      score: ScoreResult; cacheReason: 'unchanged' | 'rate-limited' }
  | { phase: 'failed'; selectedPlatformId: string;              // Call 4 failed
      lastScore?: ScoreResult; error: string }
  | { phase: 'blocked-free' }                                   // Free user, Pro gate shown
```

### Visual Mapping

| State | What the user sees |
|---|---|
| `idle` | Platform Navigator — full 40-platform tier-grouped list, no selection |
| `browsing` | Platform Navigator — selected platform highlighted, no score |
| `optimising` | Platform Navigator with selected platform, waiting for Call 3 |
| `scoring` | Scoring Panel — platform badge visible, score cycling animation playing |
| `scored` | Scoring Panel — score landed, improvement cards visible, delta shown if applicable |
| `scored-cached` | Scoring Panel — score shown with amber "(cached)" or "(unchanged)" label |
| `failed` | Scoring Panel — last score shown if available with amber "(last scored)" label, or "Score unavailable" message |
| `blocked-free` | Platform Navigator visible but scoring panel replaced with Pro Promagen upgrade prompt |

### State Transitions

```
idle ──[platform selected]──→ browsing
browsing ──[Call 3 fires]──→ optimising
optimising ──[Call 3 completes]──→ scoring (Call 4 auto-fires)
optimising ──[Call 3 fails]──→ browsing (with error toast)
scoring ──[Call 4 returns]──→ scored
scoring ──[Call 4 cached]──→ scored-cached
scoring ──[Call 4 fails]──→ failed
scored ──[new generation]──→ optimising (previousScore preserved for delta)
scored ──[platform switch]──→ optimising (different platform, Call 3 re-fires)
scored ──["All platforms" click]──→ browsing
scored-cached ──[new generation]──→ optimising
failed ──[retry/regenerate]──→ optimising
any ──[free user detected]──→ blocked-free
```

**Navigator states** (`idle`, `browsing`, `optimising`, `blocked-free`): show the platform list.
**Scoring states** (`scoring`, `scored`, `scored-cached`, `failed`): show the scoring panel.

---

## 5. State 1 — Platform Navigator (Before Generation)

### Layout

A vertical scrollable list of all 40 platforms inside the existing rail panel. Grouped by tier with tier headers.

```
┌─ Platform Match ─────────────────────────┐
│                                           │
│  CLIP-Based · 7 platforms                 │
│  ● Stable Diffusion                       │
│  ● Leonardo AI                            │
│  ● ComfyUI                                │
│  ● Tensor.Art                             │
│  ● NovelAI                                │
│  ● Fotor                                  │
│  ● NightCafe                              │
│                                           │
│  Midjourney · 1 platform                  │
│  ● Midjourney                             │
│                                           │
│  Natural Language · 21 platforms          │
│  ● Adobe Firefly                          │
│  ● DALL·E (Bing)                          │
│  ● Google Imagen                          │
│  ...                                      │
│                                           │
│  Plain Language · 11 platforms            │
│  ● Canva                                  │
│  ● Craiyon                                │
│  ...                                      │
└───────────────────────────────────────────┘
```

### Styling

**Heading:** "Platform Match" in the standard gradient text (`bg-gradient-to-r from-sky-400 via-emerald-300 to-indigo-400 bg-clip-text text-transparent`). Font size: `clamp(0.7rem, 0.95vw, 1.1rem)`.

**Tier headers:** Tier name in white at `clamp(0.6rem, 0.75vw, 0.85rem)`, tier colour as a 2px underline. Platform count in `text-slate-400` (dimmest allowed colour).

**Platform rows:** Each row is a slim clickable card:
- Left: tier colour dot (6px circle, solid fill)
- Centre: platform display name in white, `clamp(0.6rem, 0.72vw, 0.8rem)`
- Full row is `cursor-pointer` with hover state: background `rgba(tierColour, 0.06)`, border-left `2px solid rgba(tierColour, 0.3)`
- Active/selected platform: persistent background tint + brighter border

**Scrollbar:** Matches rail standard: `scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/20 hover:scrollbar-thumb-white/30`.

**No grey text. No opacity dimming. All sizing via `clamp()`.**

### Interaction

Click any platform row → fires the same provider selection handler as the centre dropdown. The centre column updates, Call 2 fires if needed, Call 3 fires when optimise is toggled. The rail row shows a selected state (tier-coloured left border at 50% opacity, faint background tint).

---

## 6. State 2 — Scoring Panel (After Call 3)

### Layout

When Call 3 completes, the rail transitions from the platform list to the scoring panel for the selected platform.

```
┌─ Prompt Quality Score ───────────────────┐
│                                           │
│  ← All platforms                          │
│                                           │
│  ● Leonardo AI          Tier 3 · NL      │
│                                           │
│     ╔════════════════════════════╗        │
│     ║                            ║        │
│     ║        87.3               ║        │
│     ║     ━━━━━━━━━━━━          ║        │
│     ║      out of 100           ║        │
│     ║                            ║        │
│     ╚════════════════════════════╝        │
│                                           │
│  ↑ 5.8 from last generation               │
│                                           │
│  HOW TO IMPROVE                           │
│                                           │
│  🟢 Composition                            │
│  Add a focal point or framing direction.  │
│  Pushing from ~87 → ~92.                  │
│                                           │
│  💡 Lighting                               │
│  Specify light source direction — "rim    │
│  light from behind" outperforms "dramatic │
│  lighting" on NL platforms.               │
│                                           │
│  🏛️ Environment                           │
│  Ground the scene in a specific place.    │
│  "Tokyo alleyway" beats "city street."    │
│                                           │
│  ─────────────────────────                │
│  Scored by 97 Prompt Analysis Algorithms  │
│  14 calibrated for Leonardo AI            │
│                                           │
└───────────────────────────────────────────┘
```

### Score Display

**Score number:** Large, centred. Font size `clamp(1.8rem, 2.5vw, 3rem)`. Font weight 700. Colour: emerald-400 (≥85), amber-400 (70–84), rose-400 (<70). One decimal place always shown (87.0, not 87).

**Progress bar:** Thin bar (3px height) below the score. Width = score percentage. Colour matches score colour. Rounded ends.

**"out of 100"** label below the bar: white at `clamp(0.55rem, 0.65vw, 0.75rem)`.

**Delta indicator:** Only shown on re-generation (second+ score for same platform). "↑ 5.8" in emerald or "↓ 2.1" in rose. If delta is 0 or within ±0.5: "≈ stable" in amber.

### Improvement Directives

**Section heading:** "HOW TO IMPROVE" in white, uppercase, letter-spacing `0.05em`, `clamp(0.6rem, 0.72vw, 0.82rem)`.

**Each directive** is a card with:
- Category emoji + category name in the category's colour (from `CATEGORY_COLOURS` SSOT)
- 1–2 lines of specific, actionable advice in white
- Impact badge: "HIGH" in emerald, "MEDIUM" in amber, "LOW" in white. The badge tells the user where to focus effort without claiming false precision about point gains.

**Maximum 3 directives.** Minimum 2. If the prompt scores 95+, show 1 directive plus a "Near-optimal" badge in emerald.

### Footer

**Disguise footer:** "Scored by 97 Prompt Analysis Algorithms" (number rotates between 93–101, see §11). Second line: "{N} calibrated for {platform name}" — number is `12 + (platformId.charCodeAt(0) % 6)`, giving each platform a different but consistent number (12–17).

**No mention of AI, GPT, or OpenAI anywhere in this panel.**

---

## 7. Call 4 — API Contract

### Route

`POST /api/score-prompt`

### Request Schema

```typescript
const ScorePromptRequestSchema = z.object({
  /** The optimised prompt text (output of Call 3) */
  optimisedPrompt: z.string().min(1).max(8000),
  /** The assembled prompt text (output of Call 2, input to Call 3) — for fidelity comparison */
  assembledPrompt: z.string().min(1).max(8000),
  /** The original human-written sentence */
  originalSentence: z.string().min(1).max(2000),
  /** Platform ID from platform-config.json */
  platformId: z.string().min(1).max(100),
  /** Platform display name for the system prompt context */
  platformName: z.string().min(1).max(200),
  /** Tier of the platform (1–4) */
  tier: z.number().int().min(1).max(4),
  /** The platform's prompt style */
  promptStyle: z.enum(['keywords', 'natural', 'plain']),
  /** Platform character limits for scoring context */
  idealMin: z.number().int().min(0),
  idealMax: z.number().int().min(0),
  maxChars: z.number().int().min(0).nullable(),
  /** Which categories Call 1 detected with content (not just user-filled — actual extraction results) */
  detectedCategories: z.array(z.object({
    category: z.string(),
    termCount: z.number().int().min(0),
  })).max(12),
  /** Whether the platform supports negative prompts */
  negativeSupport: z.enum(['separate', 'inline', 'none', 'converted']),
  /** The negative prompt if present */
  negativePrompt: z.string().max(5000).optional(),
  /** The changes Call 3 reported making (for context on what was adapted) */
  call3Changes: z.array(z.string()).max(20).optional(),
});
```

**Why `assembledPrompt` and `detectedCategories` are included:** v1.0.0 only passed `filledCategories` as a list of names. The scorer needs to know (a) what the prompt looked like *before* Call 3 touched it, to evaluate whether optimisation helped or hurt, and (b) the richness of detection per category, not just presence/absence. A category with 3 extracted terms is different from one with 1.

### Response Schema

```typescript
const ScorePromptResponseSchema = z.object({
  /** Overall quality score for this prompt on this platform (0.0–100.0) */
  score: z.number().min(0).max(100),
  /** 2–3 specific improvement directives */
  improvements: z.array(z.object({
    /** Which prompt category this improvement targets */
    category: z.string(),
    /** Actionable advice (1–2 sentences) */
    advice: z.string().max(300),
    /** Directional impact: how much this category matters for this platform */
    impact: z.enum(['high', 'medium', 'low']),
  })).min(2).max(3),
  /** What the prompt already does well (1 sentence, for positive reinforcement) */
  strength: z.string().max(200),
});
```

**Why `impact` replaced `estimatedGain`:** v1.0.0 had `estimatedGain: number` (e.g., +4.5). ChatGPT's review correctly identified that the model has no evidence to distinguish +4.5 from +2.1. Those numbers would look authoritative without being anchored. Directional impact (`high`/`medium`/`low`) is honest about the precision we actually have.

### HTTP Contract

| Status | Meaning | Body |
|---|---|---|
| 200 | Success | `ScorePromptResponseSchema` JSON |
| 400 | Validation error | `{ error: string, message: string }` |
| 429 | Rate limited (cooldown active) | `{ error: 'rate_limited', message: 'Scoring cooldown active' }` |
| 500 | OpenAI or server error | `{ error: string, message: string }` |

### Content Policy

Same detection pattern as Call 1/Call 2: catch both 400 `content_policy_violation` and 200 `finish_reason: "content_filter"`. Return neutral error message — "Unable to score this prompt. Try rephrasing." No details exposed.

---

## 8. Call 4 — System Prompt Specification

### Model

`gpt-5.4-mini` — same model as Calls 1–3. Temperature: `0.2` (scoring must be consistent, not creative).

### Max Tokens

`600` — score + 3 improvements + strength fits comfortably under 400 tokens. 600 gives headroom.

### System Prompt

```
You are a prompt quality assessor for AI image generation platforms.

You will receive:
- An optimised prompt written for a specific platform
- The assembled prompt it was derived from (pre-optimisation)
- The original human sentence
- Platform metadata (name, tier, prompt style, character limits, negative support)
- Which categories were detected and their richness (term count)
- What changes the optimiser reported making

YOUR TASK: Score the optimised prompt's quality for THIS SPECIFIC PLATFORM on a scale of 0.0 to 100.0. Return one decimal place.

SCORING RUBRIC (5 axes, weighted):

1. ANCHOR PRESERVATION — 30 points
   The most important axis. Does the optimised prompt preserve the visual anchors from the original human sentence?
   - Identify the key visual elements the user described (specific objects, colours, moods, spatial relationships)
   - Every anchor present in the original that survives into the optimised prompt = points
   - Every anchor that was dropped, genericised, or replaced with a weaker synonym = deduction
   - "purple and copper sky" → "colourful sky" = significant deduction (anchor lost)
   - "purple and copper sky" → "sky streaked with purple and burnished copper" = full marks (anchor preserved + enriched)
   - Compare the optimised prompt against the ORIGINAL HUMAN SENTENCE, not the assembled prompt. The user's intent is the ground truth.

2. PLATFORM-NATIVE SYNTAX — 25 points
   Does the prompt read like an expert wrote it specifically for this platform?
   - Tier 1 (CLIP): Weighted keywords properly structured? Quality boosters present? No prose leaking in?
   - Tier 2 (Midjourney): MJ parameters correct and well-chosen? Prose style matches MJ conventions?
   - Tier 3 (Natural Language): Flows as visual prose? Not a keyword list? Reads like a visual director's brief?
   - Tier 4 (Plain Language): Concise and focused? Not over-engineered? Every word earns its place?
   - Platform-specific caveats: some platforms (Canva, Imagen, Ideogram) rewrite prompts downstream — score based on what the platform's INPUT expects, not what its engine might do internally.

3. VISUAL SPECIFICITY — 20 points
   Does the prompt create a clear, unambiguous mental image?
   - Specific visual anchors: "golden hour rim light on wet cobblestones" = high
   - Generic descriptions: "nice lighting on a street" = low
   - Sensory density: prompts that engage multiple senses (texture, light, atmosphere, spatial depth) score higher
   - BUT: specificity must serve the scene, not pad the prompt. Filler specificity ("highly detailed, ultra-realistic, 8K, masterpiece" on a T3 platform that ignores these terms) = no credit

4. ECONOMY & CLARITY — 15 points
   Is the prompt efficient? Does every element earn its place?
   - Within idealMin–idealMax character range = full marks for budget fit
   - Within range but padded with filler or redundancy = deduction even if length is "correct"
   - Over maxChars = 0 for this axis
   - Under idealMin but every word is precise = partial credit (brevity is not always a fault)
   - Repetition, synonym stacking, or restating the same idea in different words = deduction
   - This axis rewards density of meaning, not density of characters

5. NEGATIVE PROMPT QUALITY — 10 points
   - Platform supports negatives AND negatives are present AND scene-specific: 10 points
   - Platform supports negatives AND negatives are present but generic ("blurry, ugly"): 4 points
   - Platform supports negatives AND no negatives provided: 0 points
   - Platform does NOT support negatives: award 10 points automatically (no penalty for platform limitation)
   - Negative prompts that contradict the positive prompt = deduction

IMPORTANT SCORING RULES:
- Score honestly. If the prompt deserves 72.4, return 72.4. Do not inflate.
- Category coverage is a SOFT signal, not a scoring axis. A sparse prompt with 4 well-chosen categories can outscore a dense prompt with 10 mediocre categories. Do not mechanically reward breadth.
- If the optimised prompt is WORSE than the assembled prompt (anchors dropped, meaning changed, filler added), the score must reflect that — even if the optimised version is syntactically valid.

IMPROVEMENTS: Return exactly 2 improvements if score ≥ 85, exactly 3 if below 85. Each must:
- Name a specific prompt category (subject, action, style, environment, composition, camera, lighting, colour, atmosphere, materials, fidelity, negative)
- Give actionable advice specific to THIS PLATFORM (not generic tips)
- Rate the impact as "high", "medium", or "low"
- Never suggest changes that would exceed the platform's maxChars

STRENGTH: One sentence describing what the prompt already does well. Be specific.

RESPONSE FORMAT: Return ONLY valid JSON, no markdown, no preamble:
{
  "score": 84.7,
  "improvements": [
    { "category": "composition", "advice": "Add a focal point direction — 'rule of thirds, subject left of frame' gives Leonardo AI specific framing to work with.", "impact": "high" },
    { "category": "atmosphere", "advice": "Expand atmosphere beyond 'foggy' — specify density and light interaction: 'thin ground fog catching amber streetlight'.", "impact": "medium" },
    { "category": "negative", "advice": "Add scene-specific negatives. 'Modern vehicles, power lines, lens flare' would protect the period setting.", "impact": "low" }
  ],
  "strength": "Excellent lighting specificity — 'golden hour rim light with long shadows' gives the engine precise direction that survives platform processing."
}
```

### User Message Template

```
PLATFORM: {platformName} (Tier {tier}, {promptStyle} style)
CHARACTER LIMITS: idealMin={idealMin}, idealMax={idealMax}, maxChars={maxChars}
NEGATIVE SUPPORT: {negativeSupport}
DETECTED CATEGORIES: {detectedCategories.map(c => `${c.category} (${c.termCount} terms)`).join(', ')}
CALL 3 CHANGES: {call3Changes?.join('; ') || '(none reported)'}

ORIGINAL HUMAN SENTENCE:
{originalSentence}

ASSEMBLED PROMPT (pre-optimisation):
{assembledPrompt}

OPTIMISED PROMPT:
{optimisedPrompt}

NEGATIVE PROMPT:
{negativePrompt || '(none)'}
```

### Playground-First Workflow

**Before coding the route, validate the system prompt in OpenAI Playground:**
- Model: `gpt-5.4-mini`
- Response format: `json_object`
- Reasoning effort: medium
- Temperature: 0.2

**Acceptance criteria:** Score 95+ on system prompt quality (assessed by ChatGPT and Grok independently). Scores must be consistent — same prompt scored twice should produce scores within ±2.0 of each other. Improvement directives must be platform-specific (not generic tips that work for any platform).

**Test prompts:** Use the two standard test inputs (cyberpunk courier scene and fox shrine scene) optimised for at least 3 different platforms across different tiers.

### Calibration Architecture

The score must be trustworthy before it ships. A number with theatre but no truth is worse than no number at all.

**Benchmark Dataset:** Before the route goes live, build a calibration set of 10 prompt/platform pairs covering all 4 tiers:

| # | Prompt Scene | Platform | Tier | Expected Quality Band |
|---|---|---|---|---|
| 1 | Cyberpunk courier (standard test) | Stable Diffusion | T1 | 80–90 |
| 2 | Cyberpunk courier | Midjourney | T2 | 82–92 |
| 3 | Cyberpunk courier | Leonardo AI | T3 | 78–88 |
| 4 | Fox shrine (standard test) | DALL·E (Bing) | T3 | 80–90 |
| 5 | Fox shrine | Canva | T4 | 75–85 |
| 6 | Watercolour portrait (new test) | Adobe Firefly | T3 | 80–90 |
| 7 | Watercolour portrait | Craiyon | T4 | 70–80 |
| 8 | Sci-fi hangar mechanic (existing test) | ComfyUI | T1 | 82–90 |
| 9 | Minimal still life (sparse prompt) | Picsart | T4 | 70–82 |
| 10 | Dense atmosphere scene (rich prompt) | NovelAI | T1 | 85–95 |

Each pair is scored 5 times. The acceptance criteria:

1. **Consistency:** Same prompt scored 5 times must fall within ±2.0 points of its own mean. If variance exceeds ±2.0, the rubric needs tightening — not temperature adjustment.
2. **Cross-platform sanity:** A strong T3 prompt should not score higher on a T1 platform than a strong T1 prompt does on that same T1 platform. Tier-native prompts must outscore tier-foreign prompts.
3. **Fidelity sensitivity:** Deliberately dropping a key anchor from the optimised prompt (e.g., removing "purple and copper sky" → "colourful sky") must produce a measurable score drop (≥3.0 points). If anchor-dropping doesn't move the score, the rubric is blind.
4. **Improvement actionability:** Score 3 directives per benchmark. Each must be platform-specific — reject any directive that applies equally to all 40 platforms.

**Regression Harness:** After launch, run the 10-pair benchmark weekly. If any pair drifts outside its expected band by >3.0 points, the system prompt needs review. Store benchmark results in `docs/authority/score-calibration-log.md`.

**Calibration maturity:** This 10-pair dataset is a launch threshold — it proves the scorer is not obviously broken, not that it is well calibrated. Post-launch target: expand to 3 pairs per platform (120 total) within 30 days of first deploy. The expanded set must cover edge prompts (very sparse, very dense, negative-heavy, no-negative) alongside the standard test scenes.

**Known Scorer Biases (to monitor):**
- GPT may over-reward CLIP-style quality boosters on T3/T4 platforms where they have no effect
- GPT may under-penalise anchor loss when the replacement "sounds good" as prose
- GPT may score short T4 prompts low purely for brevity, even when brevity is correct for the platform
- Cross-platform equivalence is approximate — "87 on Leonardo" and "87 on Midjourney" indicate similar quality relative to each platform's ideal, not identical prompt quality

---

## 9. Call 4 — Cost & Throttle Controls

### Cost Per Call

GPT-5.4-mini at ~0.15¢/1K input + ~0.60¢/1K output.
- Input: ~400 tokens (system) + ~200 tokens (user message) = ~600 tokens → ~$0.001
- Output: ~200 tokens → ~$0.001
- **Total per score: ~$0.002**

### Full Generation Cycle Cost

| Call | Cost | When |
|---|---|---|
| Call 1 (parse-sentence) | ~$0.002 | Generate click |
| Call 2 (generate-tier-prompts) | ~$0.004 | Generate click (parallel with Call 1) |
| Call 3 (optimise-prompt) | ~$0.002 | Optimise toggle ON |
| **Call 4 (score-prompt)** | **~$0.002** | **Auto after Call 3** |
| **Total** | **~$0.010** | **Per full cycle** |

### Throttle Rules

1. **Auto-fire only:** Call 4 fires automatically when Call 3 completes. No manual trigger button. No "Score" button in the UI.

2. **Cooldown:** Minimum 3 seconds between Call 4 requests. If the user switches platforms rapidly, only the final platform fires Call 4 (debounce at 3s).

3. **Delta-check:** If the optimised prompt text is identical to the last-scored text AND the platform is the same, skip Call 4. Return the cached score. This prevents re-scoring when the user toggles optimise off and on without changing the prompt.

4. **Rate limit:** Maximum 20 Call 4 requests per user per hour. After 20, return 429 with "Scoring cooldown active — try again in a few minutes." The UI shows the last cached score with an amber "(cached)" label.

5. **Pro-only:** Call 4 only fires for authenticated Pro Promagen users. Free users see the Platform Navigator (State 1) but never transition to State 2. This is a conversion driver — see §3 Loss Aversion.

### Client-Side Score Cache

The cache lives in the `usePromptScoring` hook as a React `useRef<Map>` — not on the server. Vercel serverless functions cold-start and scale horizontally, which means server-side in-memory maps evaporate between invocations. Client-side is the only honest cache location.

```typescript
// Cache key: platformId + SHA-256 hash of optimised prompt text
// Cache value: ScoreResult (score + improvements + strength)
// Max entries: 5 (LRU eviction)
// Scope: current browser session (clears on page refresh)
// Purpose: prevents re-scoring identical prompt+platform pairs
```

The delta-check compares the current `platformId + promptHash` against the cache before firing Call 4. If found, the cached score is returned immediately with `cacheReason: 'unchanged'`. The raw score (unclamped) is stored in the cache for accurate delta calculation on the next generation.

---

## 10. Animation System

### State 1 → State 2 Transition

When Call 3 completes and Call 4 fires:

1. **Platform list fades out** — 300ms opacity 1→0 with `translateY(-8px)` for upward exit
2. **Scoring panel fades in** — 400ms opacity 0→1 with `translateY(12px) → translateY(0)`, staggered:
   - Platform badge: 0ms delay
   - Score container: 200ms delay (empty, showing cycling animation)
   - Improvement cards: appear after score lands

### Score Reveal (Call 4 Returns)

**Three-phase pattern matching algorithm-cycling (`ai-disguise.md` §8):**

**Phase 1 — Cycling (while Call 4 is in flight):**
- The score display area shows a rapid number cycling animation
- Numbers flash between random values (60.0–99.9) at 120ms intervals
- Amber colour (`#FCD34D`), monospace font (`SF Mono, Fira Code`)
- Container has `alg-pulse` amber glow (1.4s ease-in-out infinite)
- Accompanying text: "Analysing prompt structure..." in amber-300

**Phase 2 — Deceleration (Call 4 response received):**
- Number cycling slows: 200ms → 350ms → 500ms → 800ms intervals
- Numbers converge toward the actual score (±5, ±3, ±1, exact)
- Colour shifts amber → emerald-300 (`#6EE7B7`)
- Glow shifts to `alg-pulse-emerald` (1.8s ease-in-out infinite)
- Text changes: "Calibrating for {platform}..." in emerald-300

**Phase 3 — Landing:**
- Final score pops in with `scale(1.06) → scale(1.0)` over 300ms (from `alg-landing-pop`)
- Score colour resolves to final colour (emerald/amber/rose based on value)
- Container glow settles to a gentle breathing pulse in the score colour (2s infinite)
- "✓" checkmark fades in to the left of the score
- Improvement cards cascade in with 300ms stagger, each entering with `translateX(12px) → translateX(0)`, opacity 0→1

**Timing budget:**
- Minimum display time: 2.0 seconds (even if Call 4 responds instantly)
- Phase 1 cycling: 1.2s minimum
- Phase 2 deceleration: 0.6s (4 steps)
- Phase 3 landing + stagger: 0.4s + 0.9s (3 cards × 300ms)
- Total: ~3.1s minimum, feels like deep analysis

**Ceremony scaling (repeat use):** First score in a session = full 3.1s ceremony. Second+ score for the same platform in the same session = shortened ceremony: 1.5s total (skip Phase 1 cycling, go straight to deceleration from the previous score value). This prevents the scoring loop from feeling slow on the 5th iteration when the user is chasing a number. Different platform = full ceremony (new context, user expects fresh analysis).

### Score Delta Animation

When the user regenerates and Call 4 returns a new score:

- Old score fades to 50% opacity over 200ms
- New score counts from old value to new value over 600ms (ticker animation, each digit flips independently like a mechanical counter)
- If improved: emerald pulse on the container, "↑ 5.8" appears with `translateY(4px) → translateY(0)` entry
- If decreased: rose flash (100ms), "↓ 2.1" appears with same entry animation
- If stable (±0.5): amber "≈ stable" with no flash

### Co-Located Animation Styles

All keyframes in a single `<style dangerouslySetInnerHTML>` block at the top of the component:

```
@keyframes score-cycling { ... }
@keyframes score-decel { ... }
@keyframes score-landing-pop { ... }
@keyframes score-pulse-emerald { ... }
@keyframes score-pulse-amber { ... }
@keyframes score-pulse-rose { ... }
@keyframes score-delta-enter { ... }
@keyframes improvement-card-enter { ... }
```

**`prefers-reduced-motion`:** All motion animations disabled. Score appears immediately at final value. Improvement cards appear without slide animation (opacity-only fade). Number cycling replaced with a static "Scoring..." text.

---

## 11. Disguise Layer

All user-facing text follows `ai-disguise.md` §1 — no mention of AI, GPT, OpenAI, or language models.

| Internal concept | User-facing text |
|---|---|
| GPT scoring call | "Prompt Analysis Algorithms" |
| Score calculation | "Quality assessment" |
| API response | "Algorithm calibration" |
| System prompt | "Scoring parameters" |
| Improvement suggestions | "Optimisation directives" |

### Algorithm Count Theatre

The footer shows "Scored by {N} Prompt Analysis Algorithms / {M} calibrated for {platform}".

- N rotates between 93–101 (same as Call 3's algorithm count range from `getAlgorithmCount()`)
- M = `12 + (platformId.charCodeAt(0) % 6)` — deterministic per platform, range 12–17
- These numbers are cosmetic. They reinforce the "deep algorithmic processing" narrative.

### Diagnostic Language

Improvement directives use precise, technical language:

**Good:** "Expand atmosphere anchors — specify fog density and light interaction for NL engine parsing."
**Bad:** "Add more detail about the atmosphere."

**Good:** "Character budget at 73% capacity — 81 chars available for composition enrichment."
**Bad:** "Your prompt is a bit short."

The language should feel like a diagnostic readout, not a chatbot suggestion.

---

## 12. Edge Cases

| Edge Case | Behaviour |
|---|---|
| **Call 4 fails (network/API error)** | Transition to `failed` state. Show last cached score if available with amber "(last scored)" label. If no cache: show "Score unavailable — try regenerating" in amber. Never show an error code or stack trace. |
| **Score display clamping** | Scores below 30 are displayed as 30.0 with a note "Below scoring threshold." The 30.0 floor is a display decision for user motivation, not a scoring rule. The raw score is stored in the client cache and used for delta calculation — only the displayed number is clamped. Scores above 98 are displayed as-is — no artificial ceiling. If the rubric produces too many 98+ scores, the rubric needs work, not a display cap. |
| **User switches platform rapidly** | 3-second debounce. Only the final platform fires Call 4. Intermediate platforms hold in `optimising` state showing "Switching..." in amber. |
| **User regenerates without changing prompt** | Delta-check catches this. Transition to `scored-cached` with "(unchanged)" label. No API call. |
| **Call 3 returned `wasOptimized: false`** | Call 4 still fires. The assembled prompt IS the optimised prompt for format_only/reorder_only platforms. Score it as-is. |
| **Free user (not Pro)** | `blocked-free` state. Platform navigator still works for discovery. Scoring panel replaced with Pro upgrade prompt. No Call 4 fired. |
| **No platform selected** | `idle` state — full platform list, no selection highlight, no scoring possible. |
| **Prompt Lab v4 flow** | Call 4 fires after Call 3 regardless of which v4 phase triggered generation. The scoring input is always the final optimised prompt. |
| **Algorithm cycling still running when Call 4 returns** | Queue the score reveal. Wait for algorithm cycling to reach its landing phase before starting the score animation. The two animations must not overlap. |
| **Platform that rewrites prompts downstream** | Canva, Imagen, Ideogram, and others may rewrite prompts internally. The score reflects the quality of the prompt *submitted to* the platform, not what the platform does with it. The system prompt accounts for this (§8: "score based on what the platform's INPUT expects"). A caveat note may appear for known-rewriting platforms: "This platform may further process your prompt." |
| **Score changes on tiny wording edits but advice stays similar** | Expected behaviour. Small wording changes can shift the score by 1–3 points. If the advice is substantively the same, the directives should reference the same categories with different specifics. If the same generic advice appears across multiple runs, that's a rubric failure to investigate. |
| **Optimised prompt is worse than assembled** | The rubric explicitly handles this (§8, axis 1: "If the optimised prompt is WORSE than the assembled prompt... the score must reflect that"). The score will be lower, and the improvement directives should include "Anchor loss detected" language. |
| **Rate limit hit (20/hour)** | Transition to `scored-cached` with `cacheReason: 'rate-limited'`. Show last score with amber "(rate limited — cached score)" label. |

---

## 13. Data Flow Diagram

```
User types description → clicks "Generate Prompt"
  │
  ├─ Call 1 fires (parse-sentence) ──→ Category badges populate
  │
  └─ Call 2 fires (generate-tier-prompts) ──→ 4 tier cards fill
       │
       └─ User toggles "Optimise" ON
            │
            ├─ Call 3 fires (optimise-prompt) ──→ Optimised prompt appears
            │                                      Algorithm cycling plays
            │
            └─ Call 3 completes ──→ LEFT RAIL: State 1 → State 2 transition
                                     │
                                     ├─ Call 4 fires (score-prompt)
                                     │   Input: optimised prompt + platform context
                                     │
                                     ├─ Score cycling animation plays (2.0s minimum)
                                     │
                                     └─ Call 4 returns ──→ Score lands
                                                           Improvement cards cascade
                                                           Delta shown if re-generation
```

---

## 14. File Map

| File | Purpose | New/Modified |
|---|---|---|
| `src/app/api/score-prompt/route.ts` | Call 4 API route | NEW |
| `src/hooks/use-prompt-scoring.ts` | Call 4 client hook + animation controller | NEW |
| `src/components/prompt-lab/platform-match-rail.tsx` | Left rail: State 1 (navigator) + State 2 (scoring) | NEW |
| `src/components/prompt-lab/score-display.tsx` | Score number + cycling animation + delta | NEW |
| `src/components/prompt-lab/improvement-card.tsx` | Individual improvement directive card | NEW |
| `src/lib/prompt-scoring/types.ts` | Call 4 request/response TypeScript types | NEW |
| `src/app/studio/playground/playground-page-client.tsx` | Pass new `leftContent` to HomepageGrid | MODIFIED |

**No modifications to:**
- `HomepageGrid` (receives new content via existing `leftContent` prop)
- `platform-config.json` (all data already present)
- Any Call 1/2/3 routes or hooks
- Any of the 43 builder files

---

## 15. Build Order

| Part | What | Depends On | Estimated Lines |
|---|---|---|---|
| **1** | `types.ts` — Request/response TypeScript types + Zod schemas | None | ~80 |
| **2** | `route.ts` — Call 4 API route with throttle, cache, content policy | Part 1 | ~200 |
| **3** | System prompt validation in OpenAI Playground | Part 2 | N/A (manual) |
| **4** | `platform-match-rail.tsx` — State 1 platform navigator | `platform-config.json` | ~250 |
| **5** | `use-prompt-scoring.ts` — Client hook with animation phases | Parts 1–2 | ~200 |
| **6** | `score-display.tsx` — Score number with cycling/landing animation | Part 5 | ~200 |
| **7** | `improvement-card.tsx` — Directive card with category colour | Part 5 | ~80 |
| **8** | State 2 integration into `platform-match-rail.tsx` | Parts 5–7 | Extends Part 4 |
| **9** | `playground-page-client.tsx` — Wire left rail + Call 4 trigger | Parts 4, 8 | ~30 lines modified |

**Part 3 is the gate.** No code ships until the system prompt scores 95+ in Playground with consistent results across test prompts.

---

## 16. Non-Regression Rules

1. Exchange rails on homepage, World Context, and Pro page must not be affected by any change in this feature.
2. `HomepageGrid` component must not be modified — new content passes via existing props.
3. Call 1, Call 2, and Call 3 routes must not be modified.
4. The 43 builder files must not be modified.
5. Platform selection from the left rail must use the same handler as the centre dropdown — never a parallel selection mechanism.
6. Score animation must not start until algorithm cycling (Call 3) has completed its landing phase.
7. Call 4 must never fire for free/anonymous users.
8. Call 4 must never fire if Call 3 has not completed successfully.
9. Delta-check must prevent re-scoring identical prompt+platform combinations.
10. Rate limit (20/hour) must be enforced server-side, not client-side.
11. Display clamping: scores below 30 shown as 30.0 with threshold note. No artificial ceiling — rubric controls distribution.
12. `prefers-reduced-motion` must disable all motion animations (opacity-only fallbacks).
13. No grey text in either state — no `text-slate-500`, `text-slate-600`, no `text-white/[opacity < 0.4]`.
14. All sizing via `clamp()` — no fixed px/rem without clamp.
15. Co-located animations only — no new entries in `globals.css`.
16. No mention of AI, GPT, or OpenAI in any user-facing string.

---

## 17. Decisions Log

| # | Decision | Rationale | Date |
|---|---|---|---|
| D1 | Call 4 uses GPT scoring instead of client-side deterministic scoring | Generic scoring algorithms never produce genuinely useful rankings. GPT reads the actual prompt and evaluates it against platform-specific capabilities — produces actionable improvement tips that drive the engagement loop. | 2 Apr 2026 |
| D2 | Score is per-platform, not a ranking across all 40 | Scoring all 40 would require 40 API calls. Per-platform scoring is $0.002. The improvement tips only make sense when they're specific to one platform. | 2 Apr 2026 |
| D3 | ~~Non-round decimal scores forced~~ → Precision comes from rubric, not instruction | v1.0.0 told GPT "never return .0 endings." ChatGPT review correctly identified this as injecting fake precision. Removed. The rubric now produces natural decimal variance because the scoring axes don't align to round numbers. | 2 Apr 2026 |
| D4 | 3-second debounce on platform switch | Prevents rapid-fire API calls when user scrolls through platforms. Only the final selection fires Call 4. | 2 Apr 2026 |
| D5 | ~~Score floor 30, ceiling 98.5~~ → Display clamp at 30, no ceiling | v1.0.0 capped at 98.5. ChatGPT review: "naked gamification." Removed ceiling. If rubric produces too many 98+ scores, fix the rubric, not the display. Floor remains as display clamp (below 30 is punitive), not a scoring rule. | 2 Apr 2026 |
| D6 | Pro-only gating for Call 4 | Free users see the platform navigator (still valuable for discovery). Scoring is Pro-only. | 2 Apr 2026 |
| D7 | Playground-first validation before any code | System prompt must score 95+ in Playground with consistent results before route is coded. | 2 Apr 2026 |
| D8 | ~~Server-side in-memory cache~~ → Client-side hook cache (`useRef<Map>`, 5 entries LRU) | v1.0.0 had server-side map. Vercel serverless cold-starts make that fiction. Cache now lives in `usePromptScoring` hook, keyed on `platformId + promptHash`, session-scoped, clears on refresh. | 2 Apr 2026 |
| D9 | Anchor preservation as primary scoring axis (30pts) | v1.0.0 had "category coverage" as a 20pt axis. ChatGPT review: "More categories is not always better." Replaced with anchor preservation — the dimension that trend-analysis.md already identified as most important. Fidelity to original intent is the ground truth. | 2 Apr 2026 |
| D10 | `estimatedGain` replaced with directional `impact` | v1.0.0 had precise gain numbers ("+4.5 points"). ChatGPT review: "ungrounded — the model has no evidence." Replaced with high/medium/low impact — honest about the precision we actually have. | 2 Apr 2026 |
| D11 | Request includes `assembledPrompt` and `detectedCategories` with term counts | v1.0.0 only passed `filledCategories` as name strings. The scorer needs the pre-optimisation prompt for fidelity comparison, and term richness per category, not just presence/absence. | 2 Apr 2026 |
| D12 | 8-state client state machine replaces "exactly two states" | v1.0.0's two-state model couldn't represent: scoring-in-flight, cached-score, failed, rate-limited, free-user-blocked. Real UI has intermediate realities. Proper discriminated union prevents impossible state combinations. | 2 Apr 2026 |
| D13 | Calibration architecture required before launch | 10-pair benchmark dataset, ±2.0 variance target, fidelity sensitivity test, weekly regression harness. A score with theatre but no truth is worse than no score. | 2 Apr 2026 |

---

## Changelog

- **2 Apr 2026 (v1.2.0):** **FINAL REVIEW POLISH (86→90+ target).** 5 precision fixes from second ChatGPT review. (1) §1: Added explicit score non-comparability statement — "87 on Leonardo is not comparable to 87 on Midjourney, each platform scored against its own ceiling." (2) §9: Server-side in-memory cache replaced with client-side `useRef<Map>` in the hook. Vercel serverless cold-starts make server-side maps unreliable. Cache key: `platformId + SHA-256(promptText)`, LRU 5 entries, session-scoped. Raw score stored for delta accuracy. (3) §8.1: Benchmark dataset acknowledged as launch threshold, not mature calibration. Post-launch target: expand to 120 pairs (3 per platform) within 30 days. (4) §10: Ceremony scaling added — first score = full 3.1s, repeat scores for same platform = shortened 1.5s (skip cycling, decelerate from previous value). Different platform = full ceremony. (5) §12: Display clamp at 30.0 clarified as display-only — raw score stored in cache for accurate deltas. Cross-reference version fixed: righthand-rail.md v1.0.0 → v1.2.0.
- **2 Apr 2026 (v1.1.0):** **POST-REVIEW REVISION.** 5 major changes from ChatGPT architectural review. (1) §4: "Exactly two states" replaced with 8-state discriminated union client state machine: idle, browsing, optimising, scoring, scored, scored-cached, failed, blocked-free. Full transition diagram. (2) §8: Scoring rubric completely rewritten. Anchor Preservation now primary axis (30pts, was 0). Category Coverage removed as axis (was 20pts) — replaced by soft signal in scoring rules. Economy & Clarity replaces Character Budget Fit (rewards density of meaning, not middle-of-range). Forced ".0 avoidance" instruction removed — precision comes from rubric, not cosmetics. (3) §8.1: NEW calibration architecture section — 10-pair benchmark dataset across all 4 tiers, ±2.0 variance target, fidelity sensitivity test (anchor-drop must move score ≥3.0pts), cross-platform sanity check, weekly regression harness, known scorer biases documented. (4) §7: Request schema enriched — added `assembledPrompt` for fidelity comparison, replaced `filledCategories: string[]` with `detectedCategories: {category, termCount}[]` for richness signalling, added `call3Changes` for optimiser context. Response schema: `estimatedGain: number` replaced with `impact: 'high' | 'medium' | 'low'` — honest about precision available. (5) §12: Edge cases expanded from 10 to 13 — added platform rewriting caveat, anchor-loss detection, rate-limit state handling. Score floor remains as display clamp, ceiling removed. Decisions log expanded from D8 to D13.
- **2 Apr 2026 (v1.0.0):** Initial version.

---

_This document is the authority for the Prompt Lab left-hand rail. No code is written until this doc is approved. The system prompt must be validated in OpenAI Playground before the route is coded._

_**Key principle:** The score is the hook. The improvement tips are the loop. The delta is the addiction._
