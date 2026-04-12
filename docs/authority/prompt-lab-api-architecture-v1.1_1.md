# Promagen Prompt Lab — API Pipeline Architecture Document

**Version:** 1.1.0 — ChatGPT sign-off conditions met
**Date:** 13 April 2026
**Author:** Martin Yarnold (Promagen) + Claude (build partner)
**Reviewer:** ChatGPT (independent assessor — signed off at 92/100 subject to 4 conditions, all now met)
**Scope:** Prompt Lab pipeline only. Standard builder (dropdown-based, 3,675 lines, no API calls) is unchanged and out of scope.

**Sign-off conditions (all met in v1.1.0):**

1. ✅ P3 revised — preserves approved scene intent, not identical wording
2. ✅ Anatomy schema extended — `source` and `locked` fields added
3. ✅ Deterministic MJ baseline framed as UI baseline, not quality authority
4. ✅ BQI measurement protocol for Call T2 defined (comparator, runner adaptation, fallback)

---

## 1. Purpose of this document

This document defines the complete Prompt Lab API pipeline: what each call does today, what's broken, what needs to change, and the phased build plan to get there. Nothing gets built until ChatGPT signs off on this document.

The Prompt Lab is the free-text path where users type a natural language description, the system categorises it, the user fills gaps, and the system generates and optimises platform-specific prompts. It is the premium path that justifies Promagen Pro.

---

## 2. Design philosophy

These principles govern every API call in the pipeline. They are non-negotiable.

**P1 — The user is the only source of creative intent.** The engine categorises, presents, and structures. It never invents content the user didn't provide. If the user gives sparse input, they get a sparse prompt. Put rubbish in, get rubbish out.

**P2 — Each call has exactly one job.** Call 1 categorises. Call 2 assembles. Call 3 / Call T2 optimises for the target platform. No call does two jobs. No job is split across two calls.

**P3 — Platform optimisation preserves approved intent, not identical wording.** Every platform-specific prompt must preserve the same approved scene intent and approved content set. Structure, emphasis, grouping, and syntax may change by platform — that is correct behaviour. New positive content may not be invented.

**P4 — Every GPT call returns an anatomy array.** Every prompt surface in the product gets 100% accurate colour coding. The model that wrote the prompt tags each segment with its category. No more substring matching against vocabulary lists.

**P5 — Visible transformation justifies "Optimise."** When the user clicks Optimise, the before/after delta must be real, visible, and attributable. If GPT can't produce measurably better output than the deterministic assembly, the platform stays deterministic.

**P6 — Source precedence is global and explicit.** Every call in the pipeline follows the same precedence order for approved content:

1. Human text (the user's original description) — highest authority
2. User-typed additions (explicit gap-fill terms the user entered)
3. Deterministic reference draft (safety reference only, not authority)
4. Generated negatives (the one permitted invention — protective, not creative)

No call may invent positive content beyond these sources. This precedence applies to Call 2, Call 3, and Call T2 identically.

---

## 3. Platform landscape

**40 platforms across 4 tiers:**

| Tier                  | Count | Syntax                                 | Negative support  | Examples                                                                    |
| --------------------- | ----- | -------------------------------------- | ----------------- | --------------------------------------------------------------------------- |
| T1 (CLIP)             | 7     | `(term:weight)` keyword tokens         | Separate field    | Stability, Leonardo, NightCafe, DreamStudio, Dreamlike, Lexica, Fotor       |
| T2 (Midjourney)       | 1     | `clause::weight` prose + `--no` inline | Inline via `--no` | Midjourney                                                                  |
| T3 (Natural Language) | 21    | Descriptive prose sentences            | Varies            | DALL-E, Firefly, Imagen, Ideogram, Flux, Recraft, Runway, Kling + 13 others |
| T4 (Plain)            | 11    | Simple plain English                   | None or basic     | Canva, Bing, Craiyon, Freepik + 7 others                                    |

**Call 3 GPT activation status (from DNA profiles):**

| Status               | Count | Platforms                                                  |
| -------------------- | ----- | ---------------------------------------------------------- |
| `requiresGPT: true`  | 7     | Midjourney, Flux, OpenAI, Kling, Recraft, Ideogram, Runway |
| `requiresGPT: false` | 34    | All others (deterministic path — Call 3 is a no-op)        |

---

## 4. Current pipeline — what exists today

```
User types description
    ↓
CALL 1 — /api/parse-sentence (455 lines)
    ↓
User sees coverage map, fills gaps
    ↓
CALL 2 — /api/generate-tier-prompts (665 lines)
    ↓
User sees assembled prompt, selects platform, clicks "Optimise"
    ↓
CALL 3 — /api/optimise-prompt (823 lines)
    ↓
User sees optimised prompt
```

### 4.1 Call 1 — Category Assessment (`/api/parse-sentence`)

**File:** `src/app/api/parse-sentence/route.ts` (455 lines)
**Hook:** `src/hooks/use-category-assessment.ts` (198 lines)
**Model:** `gpt-4.5-mini`, temp 0.2
**Cost:** ~$0.001 per call

**Two modes (backward compatible):**

| Mode      | Purpose                                                    | Consumer         |
| --------- | ---------------------------------------------------------- | ---------------- |
| `extract` | Returns 12-category term arrays for dropdown population    | Standard builder |
| `assess`  | Returns coverage map with matched phrases from user's text | Prompt Lab       |

**Assess mode input:** The user's raw text.

**Assess mode output:**

```json
{
  "coverage": {
    "subject": { "covered": true, "matchedPhrases": ["samurai"] },
    "action": { "covered": false, "matchedPhrases": [] },
    "lighting": { "covered": true, "matchedPhrases": ["golden hour"] },
    ...
  },
  "coveredCount": 6,
  "totalCategories": 12,
  "allSatisfied": false
}
```

**What the user sees:** The XRay Decoder — 12 category rotors that spin during the call, then lock to their category colour when detected. Undetected categories show as gaps the user can fill.

**Current problems with Call 1:**

- Categorisation quality is inconsistent — some categories are over-detected, others missed
- The colour coding of the user's text (from `matchedPhrases`) is separate from the prompt colour coding system and doesn't carry through to assembled/optimised prompts
- The `extract` mode (standard builder) and `assess` mode (Prompt Lab) share a route but have completely different system prompts and return shapes

### 4.2 Call 2 — Tier Prompt Generation (`/api/generate-tier-prompts`)

**File:** `src/app/api/generate-tier-prompts/route.ts` (665 lines)
**Hook:** `src/hooks/use-tier-generation.ts` (332 lines)
**Model:** `gpt-5.4-mini`, temp 0.5
**Cost:** ~$0.003 per call

**Input:** User's text + optional gap-fill decisions (gapIntent + categoryDecisions).

**Three gap-fill modes:**

| gapIntent       | Behaviour                                                             |
| --------------- | --------------------------------------------------------------------- |
| `all-satisfied` | No gaps — just the human text                                         |
| `skipped`       | User acknowledged gaps, chose to ignore them                          |
| `user-decided`  | User filled specific gaps with their own terms or chose "engine fill" |

**Output:** Four tier prompts in one GPT call:

```json
{
  "tier1": { "positive": "CLIP prompt...", "negative": "blurry, text..." },
  "tier2": {
    "positive": "MJ prompt with ::weights --ar --v --s --no...",
    "negative": ""
  },
  "tier3": { "positive": "NL prose prompt...", "negative": "blurry, text..." },
  "tier4": {
    "positive": "Plain English prompt...",
    "negative": "blurry, text..."
  }
}
```

**Current problems with Call 2:**

1. **T2 is a tier of one.** The T2 system prompt section exists solely for Midjourney. No other platform uses T2. The generic tier layer adds no reuse value — it's a middleman with one customer.

2. **Engine auto-fill violates P1.** When `gapIntent` is `user-decided` and a category has `fill: "engine"`, Call 2 is instructed to "add expert-level content for these." The engine is inventing content the user didn't provide. This directly contradicts the design philosophy.

3. **The system prompt is overloaded.** One GPT call generates 4 completely different prompt formats. The T2 section alone is 40+ lines of MJ-specific rules. T1 has CLIP syntax rules. T3 has banned phrases, verb fidelity, and restructuring requirements. T4 has character limits. Cramming all four into one system prompt means each tier gets less GPT attention and more interference from the others.

4. **No anatomy array.** The response contains only `positive` and `negative` strings — no category tagging. The downstream colour coding system has to guess what belongs to which category via substring matching, achieving only ~18% accuracy on assembled prompts.

5. **Call 2 instructs GPT to add content not in the draft.** The T2 section says "Include at least one art style or rendering medium reference" and "Include at least one composition or framing cue NOT in the user's input." The T3 section says "Add in this order: (1) composition/framing cue, (2) lighting/atmosphere detail, (3) style/medium reference woven naturally. Each must be something the user did NOT provide." These instructions directly contradict P1 (user is the only source of creative intent) and P3 (platform presentation is not content creation).

### 4.3 Call 3 — Platform Optimisation (`/api/optimise-prompt`)

**File:** `src/app/api/optimise-prompt/route.ts` (823 lines)
**Hook:** `src/hooks/use-ai-optimisation.ts` (341 lines)
**Model:** `gpt-4.5-mini`, temp 0.4 (prose) / 0.2 (CLIP)
**Cost:** ~$0.002 per call (when GPT fires)

**Input:** The assembled prompt from Call 2 + provider context (tier, platform ID, maxChars, idealMin/Max, call3Mode, etc.).

**Routing engine:** `src/lib/optimise-prompts/preflight.ts` (475 lines) determines the path:

| Decision                | When                          | What happens                                                         |
| ----------------------- | ----------------------------- | -------------------------------------------------------------------- |
| `DNA_DETERMINISTIC`     | `requiresGPT: false` in DNA   | Runs deterministic transforms only (no GPT)                          |
| `MJ_DETERMINISTIC_ONLY` | `call3Mode: mj_deterministic` | MJ-specific deterministic transforms                                 |
| `GPT_REWRITE`           | `call3Mode: gpt_rewrite`      | Fires group builder → GPT → compliance → APS gate → regression guard |
| `PASS_THROUGH`          | Various edge cases            | Returns assembled prompt unchanged                                   |

**Quality gates (all run on GPT output before returning):**

| Gate             | File                            | Lines  | Purpose                                                                                                             |
| ---------------- | ------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------- |
| Group compliance | Per-builder `groupCompliance()` | Varies | Platform-specific format enforcement                                                                                |
| APS gate         | `aps-gate.ts`                   | 511    | Anchor preservation scoring + invented content veto                                                                 |
| Regression guard | `regression-guard.ts`           | 702    | 10 checks: dropped anchors, invented content, verb substitution, sentence count, weight clause count, prose quality |

**41 group builders exist** in `src/lib/optimise-prompts/group-*.ts`, one per platform (some NL platforms share a template pattern).

**Current problems with Call 3:**

1. **27/40 platforms are no-ops.** Only 7 platforms have `requiresGPT: true`. The other 34 go through the deterministic path which runs transforms but often returns the assembled prompt unchanged. On those platforms, the "Optimise" button does nothing visible.

2. **MJ Call 3 cannot beat Call 2.** Three measurement attempts proved this:
   - v3 prompt (creative): 85 mean, 87.5% rescue dependency
   - v4 prompt (restructure-only): 84.38 mean, 37.5% rescue dependency
   - v4 + regression guard fix: 81.75 mean, 12.5% rescue dependency
     The gate problem is solved (12.5% rescue dependency), but GPT's MJ-native output scores LOWER than the assembled prose from Call 2. The two-step architecture has a structural ceiling for MJ.

3. **No anatomy array.** Same as Call 2 — the optimised prompt has no category tagging. Colour coding fails on optimised prompts.

4. **The route is 823 lines and growing.** It handles routing, GPT calls, compliance, APS, regression guard, response formatting, error handling, and observability — all in one file.

### 4.4 Score — BQI Scorer (`/api/score-prompt`)

**File:** `src/app/api/score-prompt/route.ts` (435 lines)
**Model:** `gpt-4.5-mini`, temp 0.1
**Purpose:** Internal measurement tool. Scores prompt quality on 7 dimensions (0–100). Used by the BQI batch runner, not exposed to users.

**Not part of the redesign** — stays as-is. Included here for completeness.

### 4.5 Colour coding system

**SSOT:** `src/lib/prompt-colours.ts` (230 lines)
**12 categories + 1 structural**, each with a distinct hex colour for dark backgrounds.

**Current approach:** `parsePromptIntoSegments()` does substring matching against a term→category index built from builder selections. For the standard builder (dropdown path), this works because the builder knows which terms belong to which categories. For the Prompt Lab path, the term index is empty or nearly so, resulting in 0–18% colour coding accuracy.

**Root cause:** The colour coding system doesn't understand the text. It can only match known terms. GPT rewrites terms into prose, and the parser can't follow.

---

## 5. Proposed redesign

### 5.0 Overview

```
User types description
    ↓
CALL 1 — Category assessment (improved)
    → Returns coverage map + matched phrases
    → Colour codes the user's text
    → No auto-fill, no suggestions, no engine decisions
    ↓
User sees coverage map, types additions into gap categories (or leaves empty)
    ↓
CALL 2 — Tier prompt generation (T2 removed, anatomy added)
    → Generates T1, T3, T4 only
    → Each tier includes anatomy array for colour coding
    → No engine auto-fill — only uses human text + user-typed additions
    → No "add content NOT in the user's input" instructions
    ↓
DETERMINISTIC ENGINE — Generic MJ assembly (no GPT)
    → Assembles a basic prose prompt for MJ from human text + user additions
    → This is what the user sees before clicking Optimise
    ↓
User selects platform, clicks "Optimise"
    ↓
    ├── Midjourney → CALL T2 (NEW — dedicated MJ call)
    │   → Human text + user additions → MJ-native prompt
    │   → One focused GPT call, full creative authority for MJ structure
    │   → Returns anatomy array
    │
    └── All other platforms → CALL 3 (improved)
        → Assembled prompt → platform-specific optimisation
        → Returns anatomy array
        → Dormant builders activated one at a time via harmony pass
```

### 5.1 Call 1 — Category Assessment (improved)

**What changes:**

| Area              | Current                                                  | Proposed                                                           |
| ----------------- | -------------------------------------------------------- | ------------------------------------------------------------------ |
| Engine auto-fill  | `fill: "engine"` option exists                           | Removed. User fills gaps manually or they stay empty.              |
| Category accuracy | Inconsistent detection                                   | Improved system prompt with stricter assessment rules              |
| Colour coding     | matchedPhrases don't connect to downstream colour coding | matchedPhrases stored client-side, used to seed downstream anatomy |
| Output shape      | Same                                                     | Same (backward compatible)                                         |

**What stays the same:**

- Two modes (extract / assess) — standard builder still uses extract mode
- The XRay Decoder UI — rotors, colours, gap display
- The coverage map structure
- The hook (`use-category-assessment.ts`)

**Key change — no engine auto-fill:**

The current UI shows gap categories with options like "Let the engine decide" or "Type your own." The engine-fill option is removed. Users either type their own addition or leave the category empty. This enforces P1: the user is the only source of creative intent.

### 5.2 Call 2 — Tier Prompt Generation (T2 removed, anatomy added)

**What changes:**

| Area                     | Current                                                                                                       | Proposed                                         |
| ------------------------ | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Tiers generated          | T1, T2, T3, T4                                                                                                | T1, T3, T4 only                                  |
| T2 system prompt section | 40+ lines of MJ-specific rules                                                                                | Removed entirely                                 |
| Engine auto-fill         | "Add expert-level content for engine-fill categories"                                                         | Removed. Only human text + user-typed additions. |
| Content invention        | T2: "Include style cue NOT in user's input." T3: "Add composition, lighting, style the user did NOT provide." | Removed. All tiers use only approved content.    |
| Response schema          | `{ positive, negative }` per tier                                                                             | `{ positive, negative, anatomy }` per tier       |
| Model                    | `gpt-5.4-mini`                                                                                                | Same                                             |

**The anatomy array addition:**

Every tier's response now includes an `anatomy` array that maps each segment of the prompt to its source category and provenance:

```json
{
  "tier3": {
    "positive": "An elderly samurai stands beneath cherry blossoms at sunset, golden hour light catching weathered armour across ancient temple grounds",
    "negative": "blurry, text, watermark",
    "anatomy": [
      {
        "text": "An elderly samurai stands beneath cherry blossoms",
        "category": "subject",
        "source": "human",
        "locked": true
      },
      {
        "text": " at ",
        "category": "structural",
        "source": "structural",
        "locked": false
      },
      {
        "text": "sunset",
        "category": "lighting",
        "source": "human",
        "locked": true
      },
      {
        "text": ", ",
        "category": "structural",
        "source": "structural",
        "locked": false
      },
      {
        "text": "golden hour light",
        "category": "lighting",
        "source": "user_addition",
        "locked": true
      },
      {
        "text": " catching ",
        "category": "structural",
        "source": "structural",
        "locked": false
      },
      {
        "text": "weathered armour",
        "category": "materials",
        "source": "user_addition",
        "locked": true
      },
      {
        "text": " across ",
        "category": "structural",
        "source": "structural",
        "locked": false
      },
      {
        "text": "ancient temple grounds",
        "category": "environment",
        "source": "human",
        "locked": true
      }
    ]
  }
}
```

**System prompt addition for anatomy:**

```
Include an "anatomy" array in each tier's response. The anatomy array maps every
character of the positive prompt to one of these categories: subject, action, style,
environment, composition, camera, lighting, colour, atmosphere, materials, fidelity,
negative, structural. Commas, spaces, conjunctions, and glue text are "structural".
Every character must be covered — the concatenation of all anatomy text segments must
exactly equal the positive prompt string.

Each anatomy segment must also include:
- "source": one of "human" (from the user's original text), "user_addition" (from
  explicit gap-fill terms the user typed), "generated_negative" (protective --no terms
  you created), or "structural" (commas, glue text, syntax).
- "locked": true if the content came from the user (human or user_addition) and must
  not be deleted or replaced by downstream optimisation. false for structural and
  generated content.
```

**What stays the same:**

- The route path (`/api/generate-tier-prompts`)
- The hook (`use-tier-generation.ts`)
- T1, T3, T4 prompt quality (improved by removing cross-tier interference)
- The compliance enforcement (`enforceT1Syntax`, `enforceMjParameters` → MJ enforcement removed)
- Backward compatibility for standard builder (extract mode in Call 1 unaffected)

**Content invention removal — specific lines to change in the system prompt:**

T2 section: Delete entirely.

T3 section, remove:

- "EXPERT VALUE PRIORITY: Add in this order: (1) composition/framing cue, (2) lighting/atmosphere detail, (3) style/medium reference woven naturally. Each must be something the user did NOT provide."
- Replace with: "Use only content from the user's description and their explicit category additions. Do not add composition, lighting, atmosphere, or style cues not present in the approved inputs."

T1 section: Review for any "add content not in the input" instructions and remove.

T4 section: Review similarly.

### 5.3 Call T2 — Dedicated Midjourney Call (NEW)

**Route:** `/api/optimise-prompt` (same route, new routing decision in preflight)
**Activation:** When platform is Midjourney and DNA has `dedicatedCall: true`
**Model:** `gpt-4.5-mini`, temp 0.3
**Cost:** ~$0.002 per call (same as one Call 3 — but replaces Call 2's T2 generation + Call 3's MJ path = net saving)

**Critical framing:** The deterministic MJ assembly (the generic prose prompt the user sees before clicking Optimise) is a **UI baseline, not a quality authority.** It exists to give the user an honest preview of their content before platform-specific optimisation. It is not a target to beat — it is a starting point to transform. BQI measurement compares Call T2 output against this deterministic baseline, but a small score dip is acceptable if the output is genuinely MJ-native and the user sees a visible, valuable transformation.

**What Call T2 receives:**

- `originalSentence` — the user's raw description
- `userAdditions` — any terms the user typed into gap categories (structured, not prose)
- `assembledPrompt` — the deterministic generic assembly (reference only, not authority)
- Platform context (maxChars, idealMin/Max, etc.)

**User message format:**

```
HUMAN DESCRIPTION:
samurai at sunset with cherry blossoms

USER ADDITIONS:
- lighting: golden hour
- materials: traditional armour

REFERENCE DRAFT (deterministic assembly — use as checksum against omission, not as authority):
samurai at sunset, cherry blossoms falling, golden hour lighting, traditional armour

Build a Midjourney-native prompt using the human description and user additions above.
```

**System prompt:** Authored by ChatGPT (scored 93/100). Full text in Appendix A.

Key principles in the system prompt:

- SOURCE PRIORITY: human text > user additions > reference draft
- Build from scratch for MJ, not restructure an existing prompt
- 3–4 weighted prose clauses with :: hierarchy
- Front-load subject at ::2.0
- Generate scene-protective --no terms (the ONE area where new content is permitted)
- SELF-CHECK before returning
- Returns anatomy array

**Output:**

```json
{
  "optimised": "samurai standing beneath cherry blossoms at sunset::2.0 golden hour light catching weathered armour across temple grounds::1.5 --ar 16:9 --v 7 --s 500 --no blurry, text, watermark, modern buildings, cars",
  "negative": "",
  "changes": ["Built MJ-native weighted clause structure from approved inputs", ...],
  "charCount": 285,
  "tokenEstimate": 60,
  "anatomy": [
    { "text": "samurai standing beneath cherry blossoms at sunset", "category": "subject", "source": "human", "locked": true },
    { "text": "::2.0 ", "category": "structural", "source": "structural", "locked": false },
    { "text": "golden hour light catching weathered armour", "category": "materials", "source": "user_addition", "locked": true },
    ...
  ]
}
```

**Quality gates:** Same as Call 3 — compliance gate, APS gate, regression guard all run on Call T2 output.

**Routing change in preflight.ts:**

```typescript
// New decision: MJ_DEDICATED
if (dna?.dedicatedCall && platformId === "midjourney") {
  return "MJ_DEDICATED";
}
```

**Activation gate (from ChatGPT review, 93/100):**
Ship Call T2 only if ALL of the following are true:

- Mean score ≥ 85 on the 8-scene test set
- Rescue dependency ≤ 20%
- At least 6/8 scenes survive APS without veto
- No scene drops > 3 points vs deterministic baseline (except scene-01-minimal)
- Anchor preservation ≥ 80% overall
- Manual spot-check on 3 MJ renders before ship

### 5.4 Call 3 — Platform Optimisation (improved)

**What changes:**

| Area             | Current                                  | Proposed                                 |
| ---------------- | ---------------------------------------- | ---------------------------------------- |
| MJ path          | Routes through Call 3                    | Removed — MJ goes through Call T2        |
| Anatomy array    | Not returned                             | Added to all GPT responses               |
| Dormant builders | 27 platforms on deterministic no-op path | Activated one at a time via harmony pass |
| Route size       | 823 lines                                | Reduced (MJ path removed)                |

**What stays the same:**

- The route path (`/api/optimise-prompt`)
- The hook (`use-ai-optimisation.ts`)
- The preflight routing engine
- APS gate, regression guard, compliance gate — all unchanged
- All 41 group builders — unchanged except MJ (which moves to Call T2)
- The 7 `requiresGPT: true` platforms (minus MJ = 6) continue through GPT path

**Dormant builder activation plan:**

34 platforms currently have `requiresGPT: false` (deterministic path). These are activated one at a time through the harmony pass process:

1. Set `harmonyStatus: in_progress` in DNA profile
2. Set `requiresGPT: true`
3. Run BQI batch (8 scenes)
4. Compare to deterministic baseline
5. If mean improves AND rescue dependency < 25% → set `harmonyStatus: verified`, ship
6. If not → revert to deterministic, move to next platform

Priority order: Platforms with the most commercial value and the most room for GPT to add value (dense scene handling, platform-specific syntax) go first.

### 5.5 Anatomy array — Universal colour coding

**Added to:** Call 2, Call 3, Call T2 (all GPT calls that produce prompt text).

**For deterministic paths:** The engine assembly function tags its own output because it knows which category each term came from (it assembled the prompt from structured selections or user additions).

**Front-end consumption:**

The `parsePromptIntoSegments()` function in `prompt-colours.ts` gains a new fast path: if an `anatomy` array is available, use it directly. No substring matching needed. Fall back to the current parser only when anatomy data is missing (backward compatibility with older saved prompts).

```typescript
export function renderPromptWithAnatomy(
  anatomy: AnatomySegment[],
): AnatomySegment[] {
  // Direct pass-through — anatomy already has text + category + provenance
  return anatomy;
}
```

**Anatomy segment schema:**

```typescript
interface AnatomySegment {
  text: string; // The prompt text fragment
  category: PromptCategory | "structural"; // Which of 12 categories + structural
  source: "human" | "user_addition" | "generated_negative" | "structural"; // Where it came from
  locked: boolean; // true = user-provided, do not delete
}
```

- `source: "human"` — from the user's original typed description
- `source: "user_addition"` — from explicit gap-fill terms the user typed
- `source: "generated_negative"` — protective --no terms generated by GPT (the one permitted invention)
- `source: "structural"` — commas, glue text, syntax markers (::, --, etc.)
- `locked: true` — content came from the user and must not be deleted by downstream optimisation
- `locked: false` — structural or generated content that may be regrouped or replaced

**Category set:** Same 12 + structural as today:
`subject, action, style, environment, composition, camera, lighting, colour, atmosphere, materials, fidelity, negative, structural`

**Coverage guarantee:** The concatenation of all `anatomy[].text` values must exactly equal the `positive` prompt string. If it doesn't, the front-end falls back to the substring parser.

---

## 6. What the user experiences (before and after)

### Before (current)

1. User types "samurai at sunset with cherry blossoms"
2. XRay Decoder spins, shows 3/12 categories covered
3. User sees gaps — some have "Let engine decide" option
4. User clicks Generate
5. Prompt appears — mostly grey text, 18% colour coded
6. User selects Midjourney, clicks Optimise
7. Prompt doesn't change (deterministic no-op) or changes and scores lower
8. User copies prompt, pastes into Midjourney — underwhelmed

### After (redesigned)

1. User types "samurai at sunset with cherry blossoms"
2. XRay Decoder spins, shows 3/12 categories covered
3. User sees gaps — types "golden hour" for lighting, "traditional armour" for materials, leaves others empty
4. User clicks Generate
5. Prompt appears — **100% colour coded** with anatomy data. Subject in gold, lighting in amber, materials in teal. User can SEE their content categorised.
6. User selects Midjourney, clicks Optimise
7. **Dramatic transformation:** generic prose → MJ-native weighted clauses with :: hierarchy, --no protection, parameters. Visibly different. 100% colour coded. Every word traceable to the user's input.
8. User copies prompt, pastes into Midjourney — sees a prompt that looks like an expert wrote it

---

## 7. Build plan

### Phase A — Call 1 improvements

**Scope:** System prompt refinement, remove engine auto-fill option from UI, improve colour coding accuracy of user's text.

**Files touched:**

- `src/app/api/parse-sentence/route.ts` — assess mode system prompt refinement
- `src/hooks/use-category-assessment.ts` — remove engine-fill option handling
- UI components for gap-fill display — remove "Let engine decide" option

**Success criteria:** Call 1 categorisation accuracy improves on manual test set. Engine-fill option removed from UI.

**Risk:** Low. No architectural change, just prompt refinement and UI simplification.

### Phase B — Call 2 cleanup

**Scope:** Remove T2 generation, remove content invention instructions, add anatomy array.

**Files touched:**

- `src/app/api/generate-tier-prompts/route.ts` — remove T2 section from system prompt, remove engine-fill instructions, add anatomy to response schema
- `src/hooks/use-tier-generation.ts` — handle new response shape
- `src/lib/prompt-colours.ts` — add `renderPromptWithAnatomy()` fast path
- UI components — render anatomy-based colour coding when available

**Success criteria:**

- T2 no longer generated in Call 2 output
- T1, T3, T4 quality maintained or improved (freed from T2 system prompt complexity)
- Anatomy array present in all tier outputs
- Colour coding renders at 100% accuracy on assembled prompts

**Risk:** Medium. Removing T2 changes the response shape. All consumers of the Call 2 response must handle the missing tier gracefully. The Prompt Lab UI must fall back to the deterministic MJ assembly for Midjourney platforms.

### Phase C — Build Call T2 (Midjourney dedicated call)

**Scope:** New routing decision in preflight, new user message construction, deploy ChatGPT's system prompt, anatomy array included.

**Files touched:**

- `src/lib/optimise-prompts/preflight.ts` — add `MJ_DEDICATED` routing decision
- `src/app/api/optimise-prompt/route.ts` — new branch for `MJ_DEDICATED` that builds user message from originalSentence + userAdditions
- `src/lib/optimise-prompts/group-midjourney.ts` — new system prompt (ChatGPT's Call T2 version)
- `src/data/platform-dna/profiles.json` — add `dedicatedCall: true` for Midjourney

**Success criteria (activation gate):**

- Mean score ≥ 85 on 8-scene test set
- Rescue dependency ≤ 20%
- ≥ 6/8 scenes survive APS without veto
- No scene drops > 3 points vs deterministic baseline (except scene-01-minimal)
- Anchor preservation ≥ 80%
- Manual spot-check on 3 MJ renders

**Risk:** Medium-high. This is a new GPT path with new input construction. The system prompt needs to handle sparse inputs gracefully. The activation gate prevents shipping bad output.

**BQI measurement protocol for Call T2:**

Call T2 changes the measurement model. Three artefacts are required per test cell:

| Artefact                  | Description                                                            |
| ------------------------- | ---------------------------------------------------------------------- |
| Deterministic MJ baseline | The generic prose prompt from the engine assembly (the "before" state) |
| Call T2 optimised output  | The MJ-native prompt Call T2 produced (the "after" state)              |
| Source package            | Human text + user additions used to produce both                       |

Measurement rules:

- **Comparator:** Call T2 output is scored against the deterministic MJ baseline. The old generic T2 output from Call 2 is retired from baseline authority — it no longer exists in the pipeline.
- **The deterministic baseline is a UI baseline, not a quality authority.** A small score dip is acceptable if Call T2's output is genuinely MJ-native and the user sees a visible transformation. The activation gate's ≥85 mean requirement is the real quality floor.
- **Runner adaptation:** The BQI batch runner must support a `--dedicated` flag that constructs the Call T2 user message from `originalSentence` + `userAdditions` (from the frozen snapshot) instead of using the assembled prompt as input.
- **Fallback behaviour in production:** If Call T2 fails the APS gate or regression guard on a live request, return the deterministic MJ baseline unchanged. The user sees the generic prompt — no error, no broken state. This is the same fallback pattern Call 3 already uses.

### Phase D — Call 3 platform activation

**Scope:** Activate dormant builders one at a time. Add anatomy array to all Call 3 GPT responses.

**Files touched:**

- `src/app/api/optimise-prompt/route.ts` — add anatomy to response schema
- `src/data/platform-dna/profiles.json` — flip `requiresGPT: true` per platform
- Individual `group-*.ts` builders — refine system prompts per platform
- `regression-guard.ts` — tuning per platform as needed

**Success criteria per platform:**

- Mean score ≥ deterministic baseline
- Rescue dependency < 25%
- Manual spot-check before ship

**Risk:** Low per platform (each is isolated). High in aggregate (34 platforms × harmony pass = months of work).

---

## 8. Dependencies and constraints

| Constraint                                           | Impact                                                                                              |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Standard builder stays unchanged                     | No changes to `prompt-builder.tsx`, `assemblePrompt()`, or dropdown vocabulary                      |
| Anatomy array must be backward compatible            | Old saved prompts without anatomy data must still render (substring parser fallback)                |
| BQI measurement infrastructure must work for Call T2 | Runner needs to support dedicated-call path (human text + additions as input, not assembled prompt) |
| Call 2 response shape change                         | All consumers must handle missing T2 tier gracefully                                                |
| No ship without activation gate passing              | Call T2 stays behind DNA flag until gate criteria met                                               |

---

## 9. Open questions for ChatGPT

1. **Is the content invention removal in Call 2 too aggressive?** The T3 section currently adds composition, lighting, and style that the user didn't provide. Removing this will make T3 prompts leaner but potentially less competitive with other tools. Is that the right trade-off for architectural integrity?

2. **Should Call 2 generate 3 tiers in one call or split into separate calls?** Currently one GPT call generates all tiers. Removing T2 makes it 3 tiers. Should we further split into individual calls per tier for better focus? Or is the cost (3× API calls) not worth the quality gain?

3. **Is the anatomy array schema correct?** Should each segment have additional metadata beyond `text` and `category`? (e.g., `weight` for CLIP platforms, `confidence` for assessment certainty, `source` for tracing whether the term came from human text or user additions?)

4. **Should the deterministic MJ assembly (the "before" state) also have anatomy?** If yes, the engine assembly function needs to tag its output. This is straightforward because the engine knows which category each term came from.

5. **Is there anything missing from this document?** Any architectural concern, edge case, or risk we haven't addressed?

---

## Appendix A — Call T2 System Prompt (by ChatGPT)

See separate file: `chatgpt-call-t2-system-prompt.md`

Scored 93/100 by ChatGPT on 13 April 2026.

Key features:

- SOURCE PRIORITY: human text > user additions > reference draft
- NON-NEGOTIABLE CONTENT RULES: comprehensive list of what GPT may NOT add
- MIDJOURNEY STRUCTURE: 3–4 weighted prose clauses, weight hierarchy, parameter rules
- NEGATIVES: allowed new content (protective platform syntax)
- WRONG/RIGHT examples modelling restructuring without invention
- SELF-CHECK before returning
- Full JSON response schema with anatomy array

---

## Appendix B — Measurement data (MJ baseline, 13 April 2026)

### Run history

| Run                 | Prompt version     | Mean  | Rescue dep. | GPT used | Notes                                          |
| ------------------- | ------------------ | ----- | ----------- | -------- | ---------------------------------------------- |
| bqr-mnvnophj-dnx7s7 | v3 (creative)      | 85.00 | 87.5%       | 1/8      | invented_content veto on 7/8                   |
| bqr-mnvoxbdy-t5ywg4 | v4 (restructure)   | 84.38 | 37.5%       | 5/8      | Regression guard killing valid consolidation   |
| bqr-mnvp2kbs-q8racd | v4 (baseline comp) | 83.88 | —           | —        | Baseline comparison run                        |
| bqr-mnvpm1wk-0kakym | v4 + guard fix     | 81.75 | 12.5%       | 7/8      | Gate solved, mean dropped — structural ceiling |

### Per-scene scores (v4 + guard fix vs deterministic baseline)

| Scene                          | Baseline | GPT restructured | Delta |
| ------------------------------ | -------- | ---------------- | ----- |
| scene-04-colour-saturation     | 97       | 85               | -12   |
| scene-05-spatial-relationships | 95       | 95               | 0     |
| scene-01-minimal               | 88       | 79               | -9    |
| scene-02-cyberpunk-courier     | 85       | 85               | 0     |
| scene-03-fox-shrine            | 85       | 85               | 0     |
| scene-06-negative-trigger      | 85       | 85               | 0     |
| scene-08-french-new-wave       | 73       | 69               | -4    |
| scene-07-compression-stress    | 72       | 71               | -1    |

### Conclusion

Call 3 cannot beat Call 2's assembled prompt for Midjourney. The two-step architecture has a structural ceiling. This data is the evidence base for the Call T2 architectural decision.

---

## Appendix C — File inventory

### API routes (Prompt Lab pipeline)

| Route                        | Lines | Call        | Purpose                  |
| ---------------------------- | ----- | ----------- | ------------------------ |
| `/api/parse-sentence`        | 455   | Call 1      | Category assessment      |
| `/api/generate-tier-prompts` | 665   | Call 2      | Tier prompt generation   |
| `/api/optimise-prompt`       | 823   | Call 3 / T2 | Platform optimisation    |
| `/api/score-prompt`          | 435   | BQI         | Internal quality scoring |

### Hooks

| Hook                         | Lines | Consumes        |
| ---------------------------- | ----- | --------------- |
| `use-category-assessment.ts` | 198   | Call 1          |
| `use-tier-generation.ts`     | 332   | Call 2          |
| `use-ai-optimisation.ts`     | 341   | Call 3          |
| `use-sentence-conversion.ts` | 260   | Legacy / bridge |

### Quality infrastructure

| File                  | Lines | Purpose                              |
| --------------------- | ----- | ------------------------------------ |
| `preflight.ts`        | 475   | Routing decision engine              |
| `regression-guard.ts` | 702   | 10-check quality gate                |
| `aps-gate.ts`         | 511   | Anchor preservation + invention veto |
| `prompt-colours.ts`   | 230   | Colour coding SSOT + parser          |

### Group builders (41 total)

| Category        | Count | Examples                                                       |
| --------------- | ----- | -------------------------------------------------------------- |
| T1 CLIP         | 6     | stability, dreamstudio, dreamlike, fotor, lexica, novelai      |
| T2 MJ           | 1     | midjourney (moves to Call T2)                                  |
| T3 NL specific  | 6     | dalle-api, flux-architecture, ideogram, kling, recraft, runway |
| T3 NL generic   | 21    | nl-adobe-firefly, nl-bing, nl-canva, nl-google-imagen, etc.    |
| T1 CLIP variant | 1     | sd-clip-double-colon                                           |
| Luma AI         | 1     | luma-ai                                                        |

### Measurement scripts

| Script                       | Purpose                        |
| ---------------------------- | ------------------------------ |
| `builder-quality-run.ts`     | BQI batch runner (1,740 lines) |
| `builder-quality-postrun.ts` | Mechanical scorer v2.0         |
| `builder-quality-vetoed.ts`  | Vetoed cell inspector v2.0     |
| `builder-quality-analyse.ts` | Failure analysis (645 lines)   |
| `builder-quality-suggest.ts` | Patch suggestion (411 lines)   |
| `generate-snapshots.ts`      | Frozen snapshot generator      |

---

_Document signed off by ChatGPT at 92/100. All 4 conditions met in v1.1.0. Build-ready._
