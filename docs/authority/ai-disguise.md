# AI Disguise — Prompt Lab Intelligence Engine

**Version:** 4.0.0  
**Created:** 22 March 2026  
**Updated:** 25 March 2026  
**Owner:** Promagen  
**Status:** Parts 1–4d BUILT and deployed. Part 5 passive learning pipeline DEFERRED. Part 6 (testing) BUILT — 115-test harmony lockdown suite.  
**Scope:** Prompt Lab (`/studio/playground`) ONLY. The standard builder (`/providers/[id]`) is untouched.  
**Authority:** This document defines the architecture, API routes, animation system, provider switching behaviour, and learning pipeline for the Prompt Lab's AI-powered prompt generation and optimisation system.

> **Cross-references:**
>
> - `prompt-lab.md` — Studio section routes, Prompt Lab architecture, component table (v3.0.0)
> - `harmonizing-claude-openai.md` — Dual-assessor harmony engineering methodology (v1.0.0 — **STALE**, needs update to cover R6+ and stress tests)
> - `unified-prompt-brain.md` — One Brain assembly architecture (standard builder)
> - `prompt-optimizer.md` — Client-side 4-phase optimizer (standard builder)
> - `prompt-builder-page.md` — Builder UI and `assemblePrompt()` integration
> - `prompt-intelligence.md` — Intelligence layer, tier preview, colour coding
> - `paid_tier.md` — Pro gating (Prompt Lab is Pro exclusive)
> - `human-factors.md` — Zeigarnik Effect (§4), Anticipatory Dopamine (§3), Temporal Compression (§6)
> - `code-standard.md` — All code standards (clamp, no grey text, co-located animations)

---

## Table of Contents

1. [Design Philosophy](#1-design-philosophy)
2. [Architecture Overview](#2-architecture-overview)
3. [The Three API Calls](#3-the-three-api-calls)
4. [Call 1 — Category Extraction (Existing)](#4-call-1--category-extraction-existing)
5. [Call 2 — AI Tier Generation](#5-call-2--ai-tier-generation)
6. [Call 2 — System Prompt (v3.0.0)](#6-call-2--system-prompt-v300)
7. [Call 2 — Post-Processing Layer (v3.0.0)](#7-call-2--post-processing-layer-v300)
8. [Call 2 — Harmony Engineering (v3.0.0)](#8-call-2--harmony-engineering-v300)
9. [Call 3 — AI Prompt Optimisation](#9-call-3--ai-prompt-optimisation)
10. [Provider Switching Behaviour](#10-provider-switching-behaviour)
11. [Algorithm Cycling Animation System](#11-algorithm-cycling-animation-system)
12. [The 101 Algorithm Names](#12-the-101-algorithm-names)
13. [Algorithm Count Display](#13-algorithm-count-display)
14. [Visual UX Flow](#14-visual-ux-flow)
15. [Standard Builder Learning Pipeline](#15-standard-builder-learning-pipeline)
16. [API Route Specifications](#16-api-route-specifications)
17. [Security & Cost Controls](#17-security--cost-controls)
18. [File Map](#18-file-map)
19. [Non-Regression Rules](#19-non-regression-rules)
20. [Decisions Log](#20-decisions-log)
21. [Build Order](#21-build-order)

---

## 1. Design Philosophy

### The Disguise Principle

The user never knows AI is involved. The system presents itself as "1,001 proprietary algorithms" — a sophisticated computational engine that analyses, scores, reweights, and optimises prompts through deterministic processing. The reality is three targeted GPT-5.4-mini API calls, but the UX tells a story of deep algorithmic intelligence.

**Why this matters:** Users who pay for Pro Promagen are paying for superior output quality. Saying "we send it to ChatGPT" undermines the value proposition. Saying "our engine runs 97 optimisation algorithms across your prompt" communicates expertise, engineering depth, and proprietary value.

### Naming Convention

| Internal (code)                        | User-facing                      | Never say              |
| -------------------------------------- | -------------------------------- | ---------------------- |
| `generateTierPrompts()`                | "Prompt Intelligence Engine"     | "AI generation"        |
| `optimisePrompt()`                     | "Deep Optimisation Pipeline"     | "GPT call"             |
| API route `/api/generate-tier-prompts` | (invisible)                      | "API", "OpenAI"        |
| API route `/api/optimise-prompt`       | (invisible)                      | "external service"     |
| Algorithm cycling animation            | "Analysing..." / "Processing..." | "Waiting for response" |
| `✓ 97 algorithms applied`              | Exactly as written               | "AI finished"          |

### Scope Boundary

| Feature                              | Affected? | Notes                                                                  |
| ------------------------------------ | --------- | ---------------------------------------------------------------------- |
| Prompt Lab (`/studio/playground`)    | YES       | All 3 calls, all animations                                            |
| Standard builder (`/providers/[id]`) | NO        | Zero changes. Uses existing `assemblePrompt()` + client-side optimizer |
| Homepage PotM / "Try in"             | NO        | Uses existing weather generator + One Brain                            |
| Standard builder learning (future)   | YES       | Passive data collection from Prompt Lab generations                    |

---

## 2. Architecture Overview

### Current Pipeline (Standard Builder)

```
User selects dropdown terms
        │
        ▼
┌──────────────────────────┐
│  assemblePrompt()        │  prompt-builder.ts (One Brain)
│  Platform-specific       │  String template assembly
│  formatting              │
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────┐
│  Client-side optimizer   │  prompt-optimizer.ts
│  4-phase trim pipeline   │  No API calls
└──────────────────────────┘
```

### New Pipeline (Prompt Lab Only)

```
User types human description + clicks "Generate Prompt"
        │
        ├──────────────────────────────────────────────┐
        │ PARALLEL                                      │
        ▼                                               ▼
┌──────────────────────┐              ┌──────────────────────────────┐
│  CALL 1 (existing)   │              │  CALL 2 (v3.0.0)             │
│  /api/parse-sentence │              │  /api/generate-tier-prompts  │
│                      │              │                              │
│  GPT-5.4-mini        │              │  GPT-5.4-mini                │
│  Extracts 12 cats    │              │  Generates 4 tier prompts    │
│  → JSON categories   │              │  18-rule system prompt       │
│                      │              │  + post-processing layer     │
│  Visual: 12 category │              │  → tier1, tier2, tier3,      │
│  badges cycle in     │              │    tier4 prompt text         │
│  sequence (150ms     │              │                              │
│  stagger)            │              │  Visual: tier cards populate │
│                      │              │  with AI-generated prompts   │
└──────────┬───────────┘              └──────────────┬───────────────┘
           │                                         │
           ▼                                         ▼
┌──────────────────────┐              ┌──────────────────────────────┐
│  Dropdowns populate  │              │  Post-processing:            │
│  with matched terms  │              │  P1: T2 --no deduplication   │
│  (existing UX)       │              │  P2: T1 trailing period strip│
└──────────────────────┘              │  → Clean output to client    │
                                      └──────────────────────────────┘

User selects provider → clicks "Optimise"
        │
        ▼
┌──────────────────────────────────────────────────────────────────┐
│  CALL 3                                                          │
│  /api/optimise-prompt                                            │
│                                                                  │
│  GPT-5.4-mini                                                    │
│  Takes: assembled text + provider ID + platform-formats context  │
│  Returns: optimised prompt tuned to provider's sweet spot        │
│                                                                  │
│  Visual: "101 algorithms" cycling animation (synchronised        │
│  with API response time, slot-machine deceleration landing)      │
│                                                                  │
│  Landing: "✓ {N} algorithms applied" where N is randomised       │
└──────────────────────────────────────────────────────────────────┘
```

---

## 3. The Three API Calls

| Call   | Route                             | Model        | Input tokens (est.) | Output tokens (est.) | Cost (est.) | Timing                     |
| ------ | --------------------------------- | ------------ | ------------------- | -------------------- | ----------- | -------------------------- |
| Call 1 | `POST /api/parse-sentence`        | gpt-5.4-mini | ~500                | ~300                 | ~$0.002     | On "Generate Prompt" click |
| Call 2 | `POST /api/generate-tier-prompts` | gpt-5.4-mini | ~600                | ~500                 | ~$0.003     | In parallel with Call 1    |
| Call 3 | `POST /api/optimise-prompt`       | gpt-5.4-mini | ~400                | ~300                 | ~$0.002     | On "Optimise" toggle ON    |

**Total cost per full cycle:** ~$0.007 (GPT-5.4-mini).

### Timing

| Call   | Trigger                       | Typical latency | Animation                                   |
| ------ | ----------------------------- | --------------- | ------------------------------------------- |
| Call 1 | "Generate Prompt" click       | 1–3s            | 12 category badges cycle in (150ms stagger) |
| Call 2 | Fires in parallel with Call 1 | 2–4s            | None (cards appear when ready)              |
| Call 3 | "Optimise" toggle ON          | 2–5s            | Algorithm cycling → "✓ N applied"           |

---

## 4. Call 1 — Category Extraction (Existing)

Unchanged from v1.0.0. See `src/app/api/parse-sentence/route.ts` (243 lines).

---

## 5. Call 2 — AI Tier Generation

### Purpose

Replace the string-template tier generators (`generators.ts`) with AI-generated tier prompts for the Prompt Lab. The AI receives the user's original human text and generates all 4 tier prompts directly, preserving the user's creative language, spatial relationships, and poetic intent.

### Route

**Path:** `POST /api/generate-tier-prompts`  
**File:** `src/app/api/generate-tier-prompts/route.ts` (523 lines — v4.0.0; post-processing extracted to `src/lib/harmony-post-processing.ts`)

### Request Schema

```typescript
const ProviderContextSchema = z.object({
  tier: z.number().int().min(1).max(4),
  name: z.string().max(100),
  promptStyle: z.string().max(50),
  sweetSpot: z.number().int().min(10).max(2000),
  tokenLimit: z.number().int().min(10).max(5000),
  qualityPrefix: z.array(z.string().max(50)).max(10).optional(),
  weightingSyntax: z.string().max(50).optional(),
  supportsWeighting: z.boolean().optional(),
  negativeSupport: z.enum(["separate", "inline", "none", "converted"]),
});

const RequestSchema = z.object({
  sentence: z.string().min(1).max(1000),
  providerId: z.string().max(50).nullable(),
  providerContext: ProviderContextSchema.nullable(),
});
```

### Response Schema

```typescript
const TierOutputSchema = z.object({
  positive: z.string().max(2000),
  negative: z.string().max(500),
});

const ResponseSchema = z.object({
  tier1: TierOutputSchema,
  tier2: TierOutputSchema,
  tier3: TierOutputSchema,
  tier4: TierOutputSchema,
});
```

### Frontend Integration

**Hook:** `useTierGeneration` (`src/hooks/use-tier-generation.ts`, 224 lines)

**Priority:** If `aiTierPrompts` is available, it takes precedence over template-generated prompts in the tier preview cards. The template-generated prompts remain as fallback (API failure, timeout, etc.).

### Call 2 Firing Rules

| Event                                             | Action                                                           |
| ------------------------------------------------- | ---------------------------------------------------------------- |
| User clicks "Generate Prompt"                     | Fire Call 2 in parallel with Call 1                              |
| User switches provider (with existing human text) | Re-fire Call 2 with new provider context                         |
| User de-selects provider                          | Keep last-generated tiers, show "Generated for {Provider}" badge |
| User modifies human text after generation         | Do NOT auto-fire — user must click "Generate Prompt" again       |
| No human text entered                             | Call 2 not available (button disabled)                           |

---

## 6. Call 2 — System Prompt (v4.0.0)

**The system prompt is defined in code as the single source of truth.** See `buildSystemPrompt()` in `src/app/api/generate-tier-prompts/route.ts` (lines 115–262). The prompt is dynamic — it changes based on selected provider context (weight syntax, token limits, quality prefix).

The system prompt evolved through 6+ rounds of harmony engineering between Claude (system prompt author) and GPT-5.4-mini (executor). See §8 for methodology. The prompt went from 11 rules scoring 62/100 to 30 rules scoring 96/100, with 7 post-processing functions catching mechanical artefacts.

**Rule count:** 30 (ceiling enforced by `RULE_CEILING` in `harmony-compliance.ts` with test assertion).  
**Rule inventory:** T1 (8 rules), T2 (6 rules), T3 (5 rules), T4 (5 rules), Global (6 rules).

> **⚠️ WARNING:** The system prompt text below is from v3.0.0 (23 March 2026) and is **STALE**. It shows 18 rules. The deployed prompt has 30 rules. Always read `buildSystemPrompt()` in the code for the current prompt. This section is preserved as historical reference for the harmony engineering journey.

### System Prompt (Call 2 — v3.0.0, 23 March 2026) — HISTORICAL REFERENCE

```
You are an expert AI image prompt generator for 42 AI image generation platforms.

Given a natural English description, generate 4 different prompt versions optimised for different platform families. Return ONLY valid JSON with no preamble, no markdown, no explanation.

The 4 tiers:

TIER 1 — CLIP-Based (e.g., Leonardo, Stable Diffusion, DreamStudio):
- Weighted keyword syntax — WHEN NO PROVIDER IS SPECIFIED: you MUST use parenthetical syntax: (term:1.3). Example: (lone mermaid:1.4), (coral reef:1.2). Do NOT use double-colon :: syntax unless a specific provider below requires it.
- WHEN A PROVIDER IS SPECIFIED in PROVIDER CONTEXT below: use THAT provider's exact syntax instead (e.g., Leonardo uses term::1.3 double-colon, Stable Diffusion uses (term:1.3) parentheses).
- Front-load subject and style with highest weights (1.3–1.4 for subject, 1.2–1.3 for style/lighting)
- SUBJECT MUST ALWAYS CARRY THE HIGHEST WEIGHT in the entire prompt. No mood, atmosphere, or secondary element may have a higher weight than the primary subject.
- Quality prefix: masterpiece, best quality, highly detailed
- Quality suffix: sharp focus, 8K, intricate textures (add at end)
- Comma-separated weighted keywords, NOT sentences
- Rich phrases longer than 4 words should NOT be weight-wrapped — break into shorter weighted terms instead
- NEVER weight-wrap isolated colour words (e.g., "yellows", "orange"). Always pair colours with their visual context (e.g., "yellow reef fish", "orange coral").
- CLIP interprets LITERALLY — avoid metaphorical language. Use "schools of fish" not "clouds of fish", "beams of light" not "rivers of light", "patches of coral" not "carpet of coral". Every term must describe something visually concrete.
- Separate negative prompt with common quality negatives
- MANDATORY: Include at least one composition or camera term NOT in the user's input (e.g., wide scene, cinematic composition, central subject, underwater perspective, volumetric lighting). This is your expert value-add.
- STRICT ORDERING: quality prefix → weighted subject → weighted environment/scene → unweighted supporting details → composition cues → quality suffix. Follow this order exactly.
- NO sentence-ending punctuation. No periods, exclamation marks, or question marks. CLIP prompts are comma-separated keyword lists, not sentences.
- Target: ~100 tokens (~350 characters) for creative text

TIER 2 — Midjourney Family (e.g., Midjourney, BlueWillow):
- Descriptive prose with style weighting via :: syntax (e.g., cinematic::2.0)
- SUBJECT MUST CARRY THE HIGHEST :: WEIGHT. Mood and atmosphere terms must have lower weights than the subject. Do NOT give abstract terms like "quiet magic" or "beauty" the highest weight — weight the visual subject and key visual elements highest.
- Place :: weights at the END of complete descriptive clauses, NEVER mid-phrase. WRONG: "reef fish::1.4 in shimmering blues" (breaks clause). RIGHT: "bright reef fish in shimmering blues and orange::1.4" (weight after complete phrase).
- CRITICAL — --no FLAG IS MANDATORY. ALL negative/exclusion terms MUST come after a --no flag. Without --no, Midjourney treats everything as positive prompt. Negatives placed inline WITHOUT --no will DAMAGE the image by adding the unwanted elements. This is the most common structural error — do NOT make it.
- Negatives MUST be scene-specific, not boilerplate. For an underwater scene use "--no above water, murky, foggy, dark". For a portrait use "--no cropped, out of frame". Do NOT default to "extra limbs, distorted anatomy" unless the scene features human anatomy prominently.
- MANDATORY: Include at least one art style or rendering medium reference (e.g., digital painting, concept art, fantasy illustration, underwater photography, cinematic still). This anchors the model's aesthetic interpretation.
- MANDATORY: Include at least one composition or framing cue NOT in the user's input (e.g., wide underwater view, cinematic framing, central subject, dramatic perspective).
- Rich artistic and mood descriptors work well
- STRICT ORDERING: weighted subject first → environment/scene description → style/composition cues → --ar and --v and --s parameters → --no negatives LAST. The positive description must be fully complete before any parameters begin.
- STRUCTURAL EXAMPLE (follow this pattern exactly):
  lone mermaid::2.0 gliding through crystal-clear tropical water, bright reef fish in shimmering blues and orange::1.4, cinematic underwater photography::1.2, wide underwater view, silver scales catching sunlight, coral gardens and sea fans below, serene luminous depth --ar 16:9 --v 7 --s 500 --no above water, murky, foggy, dark, text, watermark (negatives appear exactly ONCE — never repeat this block)
- Target: ~300 characters for creative text (before parameters). Richer inputs may need more space — prioritise completeness over brevity.
- FINAL RULE FOR THIS TIER — NEVER DUPLICATE NEGATIVES. The --no block appears ONCE. Each negative term appears EXACTLY ONCE. If you have already written the negatives, STOP. Do not write them again. Repeating the negative list is the single most common structural error — check your output before finishing.

TIER 3 — Natural Language (e.g., DALL·E, Adobe Firefly, Google Imagen):
- Full grammatical sentences describing the scene
- Describe as if telling an artist what to paint — spatial relationships, prepositions, poetry preserved
- Include lighting, atmosphere, and composition naturally within sentences
- Convert negatives to positive reinforcement ("sharp and clear" not "no blur")
- CRITICAL: Do NOT return a lightly edited version of the user's input. You are a prompt engineer, not a paraphraser. The output must demonstrate expert knowledge the user does not have.
- MANDATORY: Weave an art style or medium reference naturally into the description — do NOT use explicit rendering directives. BANNED PHRASES: "rendered as", "in the style of", "should feel like", "meant to look like", "designed to resemble", "intended to appear as", "the image should". Instead, integrate style as part of the scene itself (e.g., "a luminous digital fantasy scene of..." or "with the vivid clarity of underwater photography" or "in cinematic wide-angle detail"). The style must feel like a natural part of the description, never a meta-instruction to the model.
- MANDATORY: Add at least one composition or camera cue NOT in the user's input (e.g., "viewed from below looking up toward the surface", "in a wide cinematic underwater scene", "with the subject centred in the frame").
- MANDATORY: Add at least one atmospheric or lighting detail NOT in the user's input (e.g., "with luminous tropical clarity", "dappled caustic light patterns on the seabed", "god rays piercing the blue depths").
- STRICT ORDERING across 2–4 sentences: Sentence 1 = subject + primary action + composition/style. Sentence 2 = secondary visual elements + lighting. Sentence 3 (if needed) = environment + atmosphere. Keep rendering style woven in, not stated as a separate directive.
- Target: ~250–350 characters

TIER 4 — Plain Language (e.g., Canva, Bing, Freepik):
- Simple, focused, short description
- Minimal technical jargon — a non-expert should understand it
- MUST be 2–3 short sentences: first sentence for the subject and action with key elements, second sentence for the environment, optional third sentence for mood/atmosphere if needed
- Keep all key visual anchors from the input — do not over-compress. Include the subject and at least 3 supporting visual elements, but do NOT list more than 5 elements in a single sentence.
- ALWAYS state the primary setting EXPLICITLY. Do not rely on implication. Write "underwater" not just "in water". Write "in a dense forest" not just "with trees". Plain language platforms need direct, unambiguous setting cues.
- STRICT ORDERING: Sentence 1 = subject + action + 3–4 key visual elements. Sentence 2 = explicit setting + environment details. Sentence 3 (optional) = lighting/atmosphere + mood.
- Every sentence MUST be at least 10 words. Do not compress mood and setting into a bare adjective list. WRONG: "It is underwater, clear, and dreamlike." (7 words, bare adjective checklist). RIGHT: "The underwater scene glows with soft light and a calm, dreamlike atmosphere." (12 words, paints the feeling). Bare adjective lists are structurally wrong for this family — write complete descriptive sentences.
- Do not use meta-language like "fill the scene", "in this image", or "the composition shows". Describe what exists, not the image itself.
- Target: ~150–200 characters

{providerBlock}

Rules:
1. PRESERVE the user's creative intent — their vision, metaphors, spatial descriptions, and poetic language. Do not paraphrase away the poetry. But DO restructure, reorder, and enhance for each platform's optimal interpretation.
2. YOUR JOB IS TO ADD EXPERT PROMPT ENGINEERING VALUE. Every tier must contain at least one element the user did NOT provide: a composition term, a camera angle, a lighting technique, a style/medium reference, or an atmospheric detail. If you return something the user could have written themselves, you have failed.
3. Each tier must feel NATIVE to its platform family — not like a reformatted version of another tier.
4. Tier 1 must have clean, high-signal keyword assembly — no sentence fragments or orphaned verbs.
5. Tier 2 must read as natural prose that Midjourney interprets well — not keyword soup. Positive description must be FULLY COMPLETE before any --ar/--v/--s/--no parameters begin. The --no flag MUST be present before ANY negative terms.
6. Tier 3 must be grammatically complete with coherent spatial flow AND demonstrate prompt engineering expertise beyond the user's input. Style references must be woven naturally into description — NEVER use meta-instructions like "the image should feel like", "rendered as", or "meant to look like". Describe the scene, not what you want the model to do.
7. Tier 4 must be short enough that a casual user understands it instantly, but complete enough to produce a good image. The primary setting (underwater, outdoor, indoor, etc.) must be stated explicitly.
8. Negative prompts should protect against quality issues SPECIFIC to the description — do not use generic negatives. Tailor negatives to what could go wrong with THIS scene. For Tier 2: negatives MUST follow a --no flag — placing negatives inline without --no is a CRITICAL structural error that reverses their meaning.
9. WEIGHT HIERARCHY (applies to Tier 1 and Tier 2): The primary subject MUST carry the highest weight. Supporting visual elements get medium weights. Abstract mood terms (beauty, wonder, magic, peaceful) get the LOWEST weights or no weight wrapping at all. This is non-negotiable.
10. CRITICAL — Weight syntax is PROVIDER-SPECIFIC. When a provider is specified in PROVIDER CONTEXT below, you MUST use that provider's exact weight syntax. For example: Leonardo uses term::weight (double colon), Stable Diffusion uses (term:weight) (parentheses). Do NOT default to parentheses when the provider specifies double colon. WHEN NO PROVIDER IS SELECTED: Tier 1 MUST use parenthetical syntax — e.g., (term:1.3). Using :: without a provider context is WRONG.
11. Quality suffix: For Tier 1, append quality terms at the end: sharp focus, 8K, intricate textures. These are standard CLIP quality anchors.
12. CONVERT ABSTRACT EMOTIONAL TERMS TO VISUAL EQUIVALENTS. Do not use "beauty", "wonder", "quiet magic" as standalone terms — these are not visually renderable. Instead use visually concrete equivalents: "ethereal light", "dreamlike underwater glow", "serene atmosphere", "luminous tropical clarity", "tranquil ocean depth". Every term in the prompt should describe something a camera could capture.

Return format:
{
  "tier1": { "positive": "...", "negative": "..." },
  "tier2": { "positive": "...", "negative": "..." },
  "tier3": { "positive": "...", "negative": "..." },
  "tier4": { "positive": "...", "negative": "..." }
}
```

When `providerId` is set, `{providerBlock}` injects:

```
PROVIDER CONTEXT (OVERRIDES GENERIC TIER RULES):
The user has selected {providerName} (Tier {tier} — {tierName}).
This platform uses {promptStyle} format.
WEIGHT SYNTAX FOR THIS PROVIDER: {weightingSyntax} — YOU MUST USE THIS EXACT SYNTAX, not parentheses unless this IS parentheses.
Sweet spot: ~{sweetSpot} tokens. Token limit: {tokenLimit}.
Quality prefix: {qualityPrefix}.
This platform supports/does NOT support term weighting.
Negative support: {negativeSupport}.
Prioritise Tier {tier} output quality — this is the tier the user will use.
```

When `providerId` is null, `{providerBlock}` is empty — generic best-practice tiers are generated.

### v3.0.0 Changes from v2.0.0 System Prompt

| Change                   | v2.0.0                                  | v3.0.0                                                                                                                   | Fix ID  |
| ------------------------ | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------- |
| T1 default syntax        | Vague "DEFAULT: (term:1.3)"             | Explicit with concrete examples: `(lone mermaid:1.4), (coral reef:1.2)` + "Using :: without a provider context is WRONG" | B1      |
| Midjourney version       | `--v 6`                                 | `--v 7`                                                                                                                  | B2      |
| Weight hierarchy         | Not enforced                            | "SUBJECT MUST ALWAYS CARRY THE HIGHEST WEIGHT" in T1 and T2 + Rule 9                                                     | B3      |
| `--no` flag              | "Negative via --no flag at end" (vague) | "CRITICAL — --no FLAG IS MANDATORY" + "will DAMAGE the image" + structural example                                       | B4      |
| `::` placement           | Not addressed                           | "Place :: weights at the END of complete descriptive clauses" with WRONG/RIGHT examples                                  | B5      |
| Duplicate negatives      | Not addressed                           | "FINAL RULE — NEVER DUPLICATE NEGATIVES" as last T2 instruction + reinforcement in example                               | B6      |
| T1 punctuation           | Not addressed                           | "NO sentence-ending punctuation"                                                                                         | B7      |
| Composition cues         | Not required                            | MANDATORY per tier: composition/camera terms the user didn't provide                                                     | S1      |
| Expert value-add         | "Do NOT add visual elements"            | "YOUR JOB IS TO ADD EXPERT PROMPT ENGINEERING VALUE" — reversed the instruction                                          | S2      |
| Abstract terms           | Allowed                                 | "CONVERT ABSTRACT EMOTIONAL TERMS TO VISUAL EQUIVALENTS" — Rule 12                                                       | S3      |
| Isolated colours         | Allowed                                 | "NEVER weight-wrap isolated colour words — pair with visual context"                                                     | S4      |
| T3 paraphrasing          | Not addressed                           | "You are a prompt engineer, not a paraphraser"                                                                           | S5      |
| T4 sentence count        | "One or two sentences maximum"          | "MUST be 2–3 short sentences"                                                                                            | S6/S15  |
| Art style reference      | Not required                            | MANDATORY for T2 and T3                                                                                                  | S7      |
| Scene-specific negatives | Generic allowed                         | "MUST be scene-specific, not boilerplate" with examples                                                                  | S8      |
| T2 structural example    | None                                    | Full example with correct ordering and `(negatives appear exactly ONCE)` note                                            | S9      |
| Literal language         | Not addressed                           | "CLIP interprets LITERALLY — avoid metaphorical language" with examples                                                  | S10     |
| T3 banned phrases        | Not addressed                           | 7 banned directive phrases: "rendered as", "should feel like", etc.                                                      | S11/S14 |
| T4 explicit setting      | Not addressed                           | "ALWAYS state the primary setting EXPLICITLY"                                                                            | S12     |
| Ordering templates       | Not addressed                           | STRICT ORDERING per tier with exact element order                                                                        | S13     |
| T2 char target           | ~200                                    | ~300 (richer inputs need more space)                                                                                     | S16     |
| T4 sentence minimum      | Not addressed                           | "Every sentence MUST be at least 10 words" with WRONG/RIGHT example                                                      | S17     |
| T4 meta-language         | Not addressed                           | "Do not use meta-language like 'fill the scene'"                                                                         | S18     |
| Temperature              | 0.3                                     | 0.5 (more creative T3 restructuring)                                                                                     | Idea 1  |
| Max completion tokens    | 1500                                    | 2000 (headroom for mandatory additions)                                                                                  | Idea 2  |

---

## 7. Call 2 — Post-Processing Layer (v4.0.0)

**v3.0.0:** Added P1 + P2. **v4.0.0:** Expanded to 7 functions (P1, P2, P3, P8, P10, P11, P12), extracted to testable module, 115-test lockdown suite.

After GPT returns validated JSON, the post-processing pipeline runs server-side before the response reaches the client. These catch GPT mechanical artefacts that system prompt rules cannot prevent. Proven across 6 harmony rounds + 3 stress tests (900-char complex inputs).

**File:** `src/lib/harmony-post-processing.ts` (342 lines) — extracted from route.ts for testability.  
**Test:** `src/lib/__tests__/harmony-post-processing.test.ts` (601 lines, 72 tests).  
**Import:** `route.ts` imports `postProcessTiers()` from the extracted module.

### Pipeline per tier

| Tier | Chain         | What it catches                                                                           |
| ---- | ------------- | ----------------------------------------------------------------------------------------- |
| T1   | P12 → P2      | CLIP-unfriendly adjectives → trailing punctuation                                         |
| T2   | P1            | Duplicate MJ --no/--ar/--v/--s params (+ P5 in harmony-compliance.ts adds missing params) |
| T3   | P11           | "[Abstract noun] [perception verb]" meta-commentary openers                               |
| T4   | P3 → P8 → P10 | Self-correction → meta-language openers → short sentence merge                            |

### Function inventory

| ID  | Function                           | Tier | Problem it solves                                                                                                                                                                                     | Catch rate                       |
| --- | ---------------------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| P1  | `deduplicateMjParams()`            | T2   | GPT duplicates entire --no block ~85% of runs at temp 0.5. Also deduplicates --ar/--v/--s and detects fusion artifacts.                                                                               | 100%                             |
| P2  | `stripTrailingPunctuation()`       | T1   | GPT adds trailing periods to CLIP prompts.                                                                                                                                                            | 100%                             |
| P3  | `fixT4SelfCorrection()`            | T4   | GPT produces "Is this X? No, it is Y" hallucinations.                                                                                                                                                 | 100%                             |
| P8  | `fixT4MetaOpeners()`               | T4   | GPT produces "The [abstract noun] [meta verb]" sentence openers. Uses 23 abstract nouns × 21 meta verbs lookup sets. Broadened in v4.0.0.                                                             | 100% for sentence-start patterns |
| P10 | `mergeT4ShortSentences()`          | T4   | GPT produces bare adjective checklists under 10 words as final sentence. Merges into previous sentence via em-dash.                                                                                   | 100%                             |
| P11 | `fixT3MetaOpeners()`               | T3   | GPT produces "The [abstract noun] [perception verb]" sentence openers. Uses 20 abstract nouns × 18 perception verbs lookup sets.                                                                      | 100% for sentence-start patterns |
| P12 | `stripClipQualitativeAdjectives()` | T1   | GPT produces CLIP-unfriendly qualitative adjectives (subtle, gentle, soft, etc.) before nouns. Strips from unweighted segments only — weight-wrapped terms like `(soft glow:1.2)` are never modified. | 100% on unweighted segments      |

### Compliance gate (separate file)

**File:** `src/lib/harmony-compliance.ts` (486 lines) — deterministic syntax validation.

| ID  | Function                   | Tier | Purpose                                                        |
| --- | -------------------------- | ---- | -------------------------------------------------------------- |
| P4  | `enforceT1Syntax()`        | T1   | Converts wrong weight syntax for selected provider             |
| P5  | `enforceMjParameters()`    | T2   | Adds missing --ar/--v/--s/--no params                          |
| P6  | `detectT4MetaLanguage()`   | T4   | Flags meta-language (detection only, P8 auto-fixes)            |
| P9  | `detectT4ShortSentences()` | T4   | Flags under-10-word sentences (detection only, P10 auto-fixes) |

### `postProcessTiers()` — Orchestrator

```typescript
import { postProcessTiers } from "@/lib/harmony-post-processing";

// In route.ts, after Zod validation:
const processed = postProcessTiers(validated.data);
```

### Belt and Braces Principle

The system prompt rules **reduce** GPT errors. The post-processing functions **catch** the ones that slip through. Both layers are required — the system prompt alone cannot eliminate GPT mechanical artefacts at temperature 0.5. The post-processing layer is permanent and must never be bypassed or removed.

---

## 8. Call 2 — Harmony Engineering (v4.0.0)

**v3.0.0:** 5 rounds (62→93). **v4.0.0:** 6 rounds + 3 stress tests (62→96), dual-assessor converged (≤1 point gap), 30 system prompt rules, 7 post-processing functions, 115-test lockdown suite.

### Methodology

1. Claude writes/updates the system prompt rules in `route.ts`
2. GPT-5.4-mini generates 4 tier prompts from a test input
3. Both Claude and ChatGPT independently score each tier on structural correctness (0–100)
4. Both identify bugs and suggest improvements
5. Claude builds fixes, cycle repeats
6. **v4.0.0:** After score convergence, 3 stress tests (900-char complex inputs) validated the system under load

### Proven Patterns

| Pattern                          | Description                                                                                                                                                                                    | Evidence                                   |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| **Examples > abstract rules**    | GPT follows concrete WRONG/RIGHT examples more reliably than abstract instructions. Adding `Example: (lone mermaid:1.4)` fixed T1 syntax. Adding the structural example fixed T2 ordering.     | B1 (R2→R3: 85→92), S9 (R3: 58→88)          |
| **Instruction positioning**      | GPT pays most attention to first and last instructions in a block. Moving the no-duplicate rule to FINAL position in T2 improved compliance.                                                   | B6 positioning (R4→R5)                     |
| **Banned-phrase expansion**      | GPT finds synonyms for banned terms. Banning "rendered as" → GPT uses "should feel like". Must iteratively expand the banned list.                                                             | S14 (R4→R5: "should feel like" eliminated) |
| **Post-processing > more rules** | After ~18 rules, each new rule competes for GPT's attention. If GPT violates a rule >30% of the time after 2 rounds, build a code-level catch instead.                                         | P8, P10, P11, P12 (R3–R6)                  |
| **Temperature trade-offs**       | 0.5 enables creative T3 restructuring but causes mechanical duplication in T2. Acceptable trade-off — P1 catches the duplication.                                                              | Idea 1 (R2 onwards)                        |
| **Noun-substitution evasion**    | GPT rotates nouns to dodge bans: "The scene feels" → "The stillness feels" → "The room feels". Pattern-level code catches (abstract noun + perception verb lookup sets) are the permanent fix. | P8 broadened (ST2), P11 broadened (R5)     |

### Scoring Journey

| Round | T1  | T2 (prod) | T3  | T4  | Average   | Key Fix                                                                                 |
| ----- | --- | --------- | --- | --- | --------- | --------------------------------------------------------------------------------------- |
| R1    | 88  | 93        | 90  | 74  | **86**    | Baseline with 27 rules from prior work                                                  |
| R2    | 93  | 94        | 96  | 82  | **91**    | T1-8 clustering, T1-4 sensory, T3-5 opening diversity, T4-5 scene depth, P8 meta-opener |
| R3    | 95  | 95        | 97  | 93  | **95**    | G1 emotional mandate, T1-6 time-of-day weighting, P10 short sentence merge              |
| R4    | 97  | 95        | 96  | 94  | **95.5**  | T1-8 concept dedup trap, T3 "that feels" ban, T4 limit 200→250                          |
| R5    | 97  | 96        | 95  | 95  | **95.75** | P11 broadened (abstract noun + perception verb), P12 CLIP adjective stripper            |
| R6    | 97  | 96        | 95  | 95  | **95.75** | Prompt trim (removed 150-token T3 ban — P11 handles in code), confirmed system stable   |

### Stress Tests (900-char complex inputs)

| Test | Scene                                                            | T1    | T2 prod | T3  | T4    | Avg       | Key Finding                                             |
| ---- | ---------------------------------------------------------------- | ----- | ------- | --- | ----- | --------- | ------------------------------------------------------- |
| ST1  | Lighthouse (dual lighting, 5 focal planes, storm)                | 92–94 | 96      | 97  | 88–94 | **93–95** | Dual-lighting interaction gap, T4 under-compression     |
| ST2  | Cellist (abstract emotion, fine detail, decay)                   | 95    | 96      | 96  | 88–94 | **94–95** | "The room feels" → triggered P8 broadening              |
| ST3  | Deep-sea diver (technical terms, extreme scale, bioluminescence) | 93    | 96      | 98  | 95    | **95.5**  | First clean T2 (no dupe negatives), G2 reformatting gap |

### Convergence Status

**Dual-assessor gap:** ≤1 point across all tiers for 4 consecutive rounds (R3–R6). Formally converged per the harmony doc's exit criteria.

**Average on moderate inputs:** 96/100. **Average on complex inputs:** 94.5/100. **Known ceiling:** GPT lists elements side-by-side instead of composing them into unified visual systems on multi-source lighting/atmosphere scenes. This is an architectural limitation, not fixable via prompt rules.

### Harmony Score

**Current: 96/100.** 30 system prompt rules. 7 post-processing functions (P1, P2, P3, P8, P10, P11, P12). 4 compliance functions (P4, P5, P6, P9). 115-test lockdown suite. Rule ceiling: 30 (raise requires explicit approval).

---

## 9. Call 3 — AI Prompt Optimisation

Unchanged from v2.0.0. See `src/app/api/optimise-prompt/route.ts` (315 lines).

**Path:** `POST /api/optimise-prompt`

_Full specification remains as documented in v2.0.0 §6. Call 3 system prompt has not been through harmony engineering yet — that is the next planned phase._

---

## 10. Provider Switching Behaviour

Unchanged from v2.0.0. See v2.0.0 §7.

---

## 11. Algorithm Cycling Animation System

Unchanged from v2.0.0. See v2.0.0 §8.

---

## 12. The 101 Algorithm Names

Unchanged from v2.0.0. See v2.0.0 §9.

---

## 13. Algorithm Count Display

Unchanged from v2.0.0. See v2.0.0 §10.

---

## 14. Visual UX Flow

Unchanged from v2.0.0. See v2.0.0 §11.

---

## 15. Standard Builder Learning Pipeline

Unchanged from v2.0.0. See v2.0.0 §12.

---

## 16. API Route Specifications

### `/api/generate-tier-prompts` (Call 2) — UPDATED v3.0.0

| Property              | Value                                                                 |
| --------------------- | --------------------------------------------------------------------- |
| Method                | POST                                                                  |
| Runtime               | nodejs                                                                |
| Dynamic               | force-dynamic                                                         |
| Max duration          | 15s                                                                   |
| Rate limit            | 20/hour prod, 200/hour dev                                            |
| Rate limit key        | `generate-tier-prompts`                                               |
| Auth required         | No (Pro gate is at page level)                                        |
| Model                 | gpt-5.4-mini                                                          |
| Temperature           | **0.5** (up from 0.3 — enables creative T3 restructuring)             |
| Max completion tokens | **2000** (up from 1500 — headroom for mandatory additions)            |
| Response format       | json_object                                                           |
| Cache                 | no-store                                                              |
| **Post-processing**   | **P1+P2+P3+P8+P10+P11+P12** via `harmony-post-processing.ts` — see §7 |
| System prompt rules   | **30 rules** (up from 18) — see §6                                    |

### `/api/optimise-prompt` (Call 3)

| Property              | Value                                                    |
| --------------------- | -------------------------------------------------------- |
| Method                | POST                                                     |
| Runtime               | nodejs                                                   |
| Dynamic               | force-dynamic                                            |
| Max duration          | 15s                                                      |
| Rate limit            | 30/hour prod, 200/hour dev                               |
| Rate limit key        | `optimise-prompt`                                        |
| Auth required         | No (Pro gate is at page level)                           |
| Model                 | gpt-5.4-mini                                             |
| Temperature           | 0.2 (low — optimisation should be deterministic-feeling) |
| Max completion tokens | 1200                                                     |
| Response format       | json_object                                              |
| Cache                 | no-store                                                 |

---

## 17. Security & Cost Controls

Unchanged from v2.0.0. See v2.0.0 §14.

---

## 18. File Map

### New Files (all BUILT)

| File                                                | Purpose                                                                       | Actual lines |
| --------------------------------------------------- | ----------------------------------------------------------------------------- | ------------ |
| `src/app/api/generate-tier-prompts/route.ts`        | Call 2 API route (imports post-processing from lib)                           | **523**      |
| `src/lib/harmony-post-processing.ts`                | **NEW v4.0.0** — Extracted post-processing pipeline (P1,P2,P3,P8,P10,P11,P12) | **342**      |
| `src/lib/harmony-compliance.ts`                     | Compliance gate (P4,P5,P6,P9) + rule ceiling tracking                         | **486**      |
| `src/lib/__tests__/harmony-post-processing.test.ts` | **NEW v4.0.0** — 72-test lockdown suite for post-processing                   | **601**      |
| `src/lib/__tests__/harmony-compliance.test.ts`      | 43-test compliance gate regression suite                                      | **453**      |
| `src/app/api/optimise-prompt/route.ts`              | Call 3 API route                                                              | 315          |
| `src/hooks/use-tier-generation.ts`                  | Hook for Call 2 (AI tier generation)                                          | 224          |
| `src/hooks/use-ai-optimisation.ts`                  | Hook for Call 3 (AI optimisation + animation timing)                          | 335          |
| `src/hooks/use-drift-detection.ts`                  | Prompt DNA Drift Detection (zero API calls)                                   | 165          |
| `src/data/algorithm-names.ts`                       | 101 cycling + 3 finale names + shuffle + count                                | 187          |
| `src/components/prompt-lab/algorithm-cycling.tsx`   | Cycling animation component (amber→emerald)                                   | 256          |
| `src/components/prompt-lab/drift-indicator.tsx`     | "N changes detected" amber badge                                              | 136          |

### Modified Files (all BUILT)

| File                                                         | Change                                                                                                                                  | Actual lines |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| `src/components/prompts/playground-workspace.tsx`            | AI Disguise orchestrator — lifts hooks, auto-re-fires, cascade clear                                                                    | 313          |
| `src/components/prompts/enhanced-educational-preview.tsx`    | Call 3 wiring, `AlgorithmCycling`, full-width layout, cascade clear via `clearSignal`, footer Clear All (purple gradient, full cascade) | **2,014**    |
| `src/components/providers/describe-your-image.tsx`           | Engine bay gradient Generate button (pulse + shimmer), purple gradient Clear All, `clearSignal` prop, format detection, drift indicator | **722**      |
| `src/components/providers/prompt-builder.tsx`                | Pass-through AI Disguise props (`onDescribeClear`, `onDescribeGenerate`, etc.)                                                          | 3,644        |
| `src/components/prompt-builder/four-tier-prompt-preview.tsx` | "Generated for X" badge, tier provider icons strip, white tier labels, `providers` prop                                                 | **788**      |

### Untouched Files (explicitly protected)

| File                                                   | Reason                                                                                        |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `src/lib/prompt-builder.ts`                            | One Brain remains the standard builder's assembly engine                                      |
| `src/lib/prompt-builder/generators.ts`                 | Template generators remain as fallback for Prompt Lab and sole engine for standard builder    |
| `src/lib/prompt-optimizer.ts`                          | Client-side optimizer remains — AI result overrides in display but client-side still runs     |
| `src/app/api/parse-sentence/route.ts`                  | Call 1 is unchanged (243 lines)                                                               |
| `src/hooks/use-sentence-conversion.ts`                 | Extraction hook is unchanged                                                                  |
| `src/components/prompt-builder/intelligence-panel.tsx` | 515 lines — REMOVED FROM PROMPT LAB RENDER but code file untouched (used by standard builder) |

---

## 19. Non-Regression Rules

### Standard Builder Protection

1. **Standard builder is untouched** — no changes to `/providers/[id]` route, `assemblePrompt()`, `generators.ts`, or client-side optimizer
2. **Call 1 is unchanged** — `/api/parse-sentence` route, `useSentenceConversion` hook, and dropdown population animation remain identical
3. **One Brain principle preserved** — `assemblePrompt()` remains the sole assembly engine for the standard builder. The Prompt Lab's AI tiers are a parallel output, not a replacement of One Brain
4. **Template generators remain as fallback** — if Call 2 fails, times out, or returns invalid data, the Prompt Lab falls back to `generateAllTierPrompts()` (template output)
5. **Optimizer client-side pipeline preserved** — the standard builder's 4-phase optimizer continues to work exactly as documented in `prompt-optimizer.md`

### AI Disguise Rules

6. **Algorithm names never reference AI** — no mention of "GPT", "OpenAI", "AI", "language model", "LLM", or "neural network" in any user-facing text
7. **Weight syntax is provider-specific** — Leonardo uses `term::weight` (double colon), Stable Diffusion uses `(term:weight)` (parentheses). When no provider selected, Tier 1 MUST use parenthetical syntax.
8. **4-word weight wrapping rule** — rich phrases longer than 4 words must NOT be weight-wrapped in Call 2 or Call 3 output. Break into shorter weighted terms.
9. **Quality suffix for Tier 1** — `sharp focus, 8K, intricate textures` appended at end for all Tier 1 platforms
10. **AI hooks lifted in PlaygroundWorkspace** — `useTierGeneration` and `useDriftDetection` must be in the orchestrator, NOT in child components. State must persist across provider switches.
11. **Call 2 fires in PARALLEL with Call 1** — never sequential
12. **Call 3 re-fires debounced (800ms)** when `activeTierPromptText` changes while optimizer is ON
13. **`activeTierPromptText` uses `aiTierPrompts ?? generatedPrompts`** — AI text takes priority over template text
14. **Post-processing is mandatory** — `postProcessTiers()` MUST run on all Call 2 responses before returning to client. Do not bypass or remove any P1–P12 function. Post-processing functions live in `src/lib/harmony-post-processing.ts` — route.ts imports from this module.

### Layout & UI Rules

15. **IntelligencePanel is REMOVED from Prompt Lab** — do NOT re-add. DnaBar still fed via simplified `useRealIntelligence`. Panel remains in standard builder only.
16. **Prompt Lab layout is full-width single column** (`space-y-4`) — do NOT restore `lg:grid-cols-3` grid
17. **Clear must cascade through ALL state** — textarea, 12 category dropdowns, optimizer OFF, AI tiers clear, AI optimise clear, aspect ratio null, scene undefined, drift reset. Footer Clear All uses `clearSignal` to trigger DescribeYourImage internal reset.
18. **Generate button uses engine bay styling when text present** — sky→emerald→indigo gradient, `dyi-generate-pulse` animation, shimmer overlay on hover. Slate/disabled when textarea empty.
19. **Clear All buttons use purple gradient** — `border-purple-500/70 bg-gradient-to-r from-purple-600/20 to-pink-600/20 text-white`. Both top and footer Clear All buttons are identical in style and function.
20. **Drift detection ≥ 3 changes triggers "Regenerate" pulse** — amber animation on Generate button, text changes to "Regenerate". Under 3 changes: badge only.
21. **Tier labels are white** — "Tier X: Name" text uses `text-white font-medium`, not `text-slate-500`.
22. **Tier provider icons strip** — Shows all providers for the active tier, centered between header and tier cards. PotM-matching style: `bg-white/15 ring-1 ring-white/10`, `clamp(30px, 2.3vw, 38px)` squares, hover glow + scale-110. Non-clickable.

### Existing Behaviour

23. **All code standards apply** — `clamp()` sizing, no grey text, no opacity dimming, cursor-pointer on clickables, co-located animations, desktop-only
24. **Pro gating unchanged** — Prompt Lab remains Pro exclusive (gating implementation per `paid_tier.md §5.13`)
25. **`incrementLifetimePrompts()` preserved** — all copy handlers must continue to track usage
26. **Colour-coded prompts preserved** — AI-generated tier text must still support `parsePromptIntoSegments()` colour coding for Pro users
27. **Existing features preserved: Yes** — required statement for every change set

### v4.0.0 Rules

28. **Post-processing extraction is permanent** — all P1–P12 functions live in `src/lib/harmony-post-processing.ts`, not in route.ts. Do not move them back. route.ts imports `postProcessTiers()` from the module.
29. **115-test harmony lockdown suite must pass before shipping** — `harmony-post-processing.test.ts` (72 tests) + `harmony-compliance.test.ts` (43 tests). Any red test = post-processing drift. Fix the code, not the test.
30. **Rule ceiling is 30** — adding a new system prompt rule requires either replacing an existing rule, building a post-processing code fix instead, or explicit Martin approval to raise the ceiling. Rule count tracked in `harmony-compliance.ts` with test enforcement.

---

## 20. Decisions Log

| #   | Decision                                                                                      | Rationale                                                                                                                                                                                                                                             | Date        |
| --- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| D1  | Call 1 + Call 2 fire in parallel                                                              | Faster UX — user sees dropdowns populating AND tier prompts appearing simultaneously                                                                                                                                                                  | 22 Mar 2026 |
| D2  | Call 2 is generic when no provider, provider-tailored when provider selected                  | Generic tiers show platform families; provider tiers show platform-specific best practices                                                                                                                                                            | 22 Mar 2026 |
| D3  | De-selecting provider keeps last-generated tiers with "Generated for X" badge                 | Respects user's work, saves API costs, avoids jarring "prompts vanished" moment                                                                                                                                                                       | 22 Mar 2026 |
| D4  | Switching providers re-fires Call 2 with visual shimmer transition                            | Prompts must feel refined, not replaced — smooth cross-fade, no flash/jump                                                                                                                                                                            | 22 Mar 2026 |
| D5  | Call 3 fires on "Optimise" click with algorithm cycling animation                             | Creates impression of deep computational processing, synchronised with API response                                                                                                                                                                   | 22 Mar 2026 |
| D6  | 101 algorithm names with slot-machine deceleration and min 1.8s display                       | Showmanship — the user sees intelligence at work, never feels like "waiting for a server"                                                                                                                                                             | 22 Mar 2026 |
| D7  | Algorithm count display: randomised 87–102 range                                              | High enough to impress, variable enough to feel dynamic, specific enough to feel genuine                                                                                                                                                              | 22 Mar 2026 |
| D8  | Standard builder learns from Prompt Lab data (passive, then active)                           | Competitive moat — the more users use Prompt Lab, the smarter the standard builder gets                                                                                                                                                               | 22 Mar 2026 |
| D9  | User-facing language: "Prompt Intelligence Engine", "Deep Optimisation Pipeline" — never "AI" | Protects value proposition — users pay for proprietary engineering, not a GPT wrapper                                                                                                                                                                 | 22 Mar 2026 |
| D10 | Standard builder "Refine" button (Phase 3, future) — NOT "Polish with AI"                     | Consistent with disguise principle — all user-facing language implies algorithms, not AI                                                                                                                                                              | 22 Mar 2026 |
| D11 | IntelligencePanel removed from Prompt Lab render                                              | Scored 52/100 — designed for dropdown workflow, became passive sidebar in AI Disguise flow                                                                                                                                                            | 23 Mar 2026 |
| D12 | Full-width single column layout (removed `lg:grid-cols-3`)                                    | Removing Intelligence Panel frees 33% horizontal space                                                                                                                                                                                                | 23 Mar 2026 |
| D13 | Clear button cascade resets ALL state                                                         | Partial clear caused stale optimised text and "96 changes detected" on next generation                                                                                                                                                                | 23 Mar 2026 |
| D14 | Provider-specific weight syntax enforcement in Call 2 + Call 3 system prompts                 | Leonardo uses `term::weight`, SD uses `(term:weight)`. Generic rule caused wrong syntax                                                                                                                                                               | 23 Mar 2026 |
| D15 | 4-word weight wrapping rule added to both system prompts                                      | Long weighted phrases produce noisy CLIP output                                                                                                                                                                                                       | 23 Mar 2026 |
| D16 | Quality suffix added for Tier 1                                                               | Tier 1 reference format includes quality suffix per platform-formats docs                                                                                                                                                                             | 23 Mar 2026 |
| D17 | Debounced Call 3 re-fire at 800ms                                                             | Prevents excessive API calls while keeping optimised prompt in sync                                                                                                                                                                                   | 23 Mar 2026 |
| D18 | `useAiOptimisation` as separate hook                                                          | Clean separation from existing client-side optimizer                                                                                                                                                                                                  | 23 Mar 2026 |
| D19 | Temperature increased from 0.3 to 0.5 for Call 2                                              | Enables more creative T3 restructuring. T1/T2 disciplined by strong syntax rules. Trade-off: T2 mechanical duplication caught by P1.                                                                                                                  | 23 Mar 2026 |
| D20 | Max completion tokens increased from 1500 to 2000                                             | Mandatory composition, style, and atmosphere additions across all 4 tiers need headroom. Cost increase: ~$0.001 per call.                                                                                                                             | 23 Mar 2026 |
| D21 | Post-processing layer added (P1 + P2)                                                         | Belt and braces — system prompt rules reduce GPT errors, post-processing catches the rest. GPT mechanical artefacts (duplicate negatives, trailing periods) cannot be eliminated via prompt alone at temperature 0.5.                                 | 23 Mar 2026 |
| D22 | Harmony engineering methodology — 5-round iterative testing with dual assessment              | Converged from 62/100 (R1) to 93/100 (R5). Proven patterns: examples > rules, instruction positioning, banned-phrase expansion, post-processing safety nets.                                                                                          | 23 Mar 2026 |
| D23 | Generate button adopts engine bay gradient styling                                            | When text present: sky→emerald→indigo pulse + shimmer on hover (identical to Launch Platform Builder). When empty: slate disabled. Professional visual hierarchy.                                                                                     | 23 Mar 2026 |
| D24 | Clear All buttons use purple gradient with white text                                         | Matches Dynamic/Randomise button style per `buttons.md` canonical style. Both top and footer Clear All identical.                                                                                                                                     | 23 Mar 2026 |
| D25 | Tier provider icons strip added to FourTierPromptPreview                                      | Shows all providers for the active tier between header and cards. PotM-matching style (bg-white/15, ring-white/10, hover glow + scale-110). Non-clickable, tooltip on hover. Educational — teaches users which providers belong to which tier family. | 23 Mar 2026 |
| D26 | Tier labels changed from `text-slate-500` to `text-white`                                     | No grey text anywhere in Prompt Lab. Code standard: no `text-slate-500` or `text-slate-600` on user-facing text.                                                                                                                                      | 23 Mar 2026 |
| D27 | Rule ceiling raised from 27 → 30                                                              | +T1-8 (semantic clustering), +T3-5 (opening diversity), +T4-5 (scene depth). Martin-approved.                                                                                                                                                         | 25 Mar 2026 |
| D28 | Post-processing expanded P1+P2 → P1–P12                                                       | P3 (self-correction), P8 (T4 meta-openers), P10 (short merge), P11 (T3 meta-openers), P12 (CLIP adjective strip). Code catches what prompt rules can't.                                                                                               | 25 Mar 2026 |
| D29 | Post-processing extracted to `harmony-post-processing.ts`                                     | Functions were private in route.ts — untestable. Extraction enables 72-test lockdown suite.                                                                                                                                                           | 25 Mar 2026 |
| D30 | P8/P11 broadened with abstract-noun + perception-verb lookup sets                             | GPT substitutes nouns to dodge bans. Lookup sets (20+ nouns × 18+ verbs) catch all variants.                                                                                                                                                          | 25 Mar 2026 |
| D31 | T4 character limit raised 200 → 250                                                           | GPT exceeded 200 chars in all 6 rounds. Mandatory scene depth + mood phrase needs headroom.                                                                                                                                                           | 25 Mar 2026 |
| D32 | 115-test harmony lockdown suite created                                                       | 72 post-processing + 43 compliance tests. Real GPT fixtures from 6 rounds + 3 stress tests.                                                                                                                                                           | 25 Mar 2026 |

---

## 21. Build Order

### Part 1 — Foundation (API routes + data) ✅ BUILT

1. ✅ Created `src/data/algorithm-names.ts` — 187 lines
2. ✅ Created `src/app/api/generate-tier-prompts/route.ts` — **523 lines** (was 406 at v3.0.0; post-processing extracted to `harmony-post-processing.ts`)
3. ✅ Created `src/app/api/optimise-prompt/route.ts` — 315 lines

### Part 2 — Hooks ✅ BUILT

4. ✅ Created `src/hooks/use-tier-generation.ts` — 224 lines
5. ✅ Created `src/hooks/use-ai-optimisation.ts` — 335 lines
6. ✅ Created `src/hooks/use-drift-detection.ts` — 165 lines

### Part 3 — Animation Components ✅ BUILT

7. ✅ Created `src/components/prompt-lab/algorithm-cycling.tsx` — 256 lines
8. ✅ Created `src/components/prompt-lab/drift-indicator.tsx` — 136 lines

### Part 4 — Integration (Prompt Lab wiring) ✅ BUILT

9. ✅ `playground-workspace.tsx` rewritten as AI Disguise orchestrator (229→313 lines)
10. ✅ `describe-your-image.tsx` updated (577→**722** lines) — Engine bay Generate button, purple Clear All, `clearSignal`, format detection, drift indicator
11. ✅ `enhanced-educational-preview.tsx` updated (1,899→**2,014** lines) — Call 3 wiring, cascade clear via `clearSignal`, footer purple Clear All, full-width layout
12. ✅ `four-tier-prompt-preview.tsx` updated (647→**788** lines) — "Generated for X" badge, tier provider icons strip, white tier labels, `providers` prop
13. ✅ `prompt-builder.tsx` updated — AI Disguise prop pass-through

### Part 4b — Fixes (post-build) ✅ BUILT

14. ✅ Provider-specific weight syntax fix (D14)
15. ✅ 4-word weight wrapping rule (D15)
16. ✅ Quality suffix for Tier 1 (D16)
17. ✅ Clear cascade fix (D13)
18. ✅ IntelligencePanel removed from Prompt Lab (D11, D12)

### Part 4c — Harmony Engineering (v3.0.0) ✅ BUILT

19. ✅ 5 rounds of system prompt refinement: B1–B7, S1–S17 (§6, §8)
20. ✅ Post-processing layer: P1 + P2 + `postProcessTiers()` (§7)
21. ✅ Temperature 0.3 → 0.5, max tokens 1500 → 2000 (D19, D20)
22. ✅ Generate button engine bay styling (D23)
23. ✅ Clear All purple gradient buttons (D24)
24. ✅ Tier provider icons strip (D25)
25. ✅ Tier labels white (D26)

### Part 4d — Harmony Engineering v2 (v4.0.0) ✅ BUILT

26. ✅ 6 additional harmony rounds (R1–R6) with frozen valley test input (D27)
27. ✅ Rule ceiling raised 27 → 30: T1-8 clustering, T3-5 opening diversity, T4-5 scene depth (D27)
28. ✅ Post-processing expanded: P3, P8, P10, P11, P12 added (D28)
29. ✅ Post-processing extracted to `src/lib/harmony-post-processing.ts` (D29)
30. ✅ P8/P11 broadened with abstract-noun + perception-verb lookup sets (D30)
31. ✅ T4 character limit 200 → 250 (D31)
32. ✅ T3 "that feels" added to banned phrases
33. ✅ G1 emotional atmosphere mandate (per-tier mood token examples)
34. ✅ T1-6 time-of-day weighting mandate
35. ✅ T1-8 interaction merging (Option B — dual-lighting WRONG/RIGHT)
36. ✅ 3 stress tests (900-char inputs): lighthouse, cellist, deep-sea diver

### Part 5 — Learning Pipeline (passive) ⏳ DEFERRED

37. ⏳ Add learning pair logging to telemetry route — NOT YET BUILT
38. ⏳ Extend prompt-telemetry schema to include AI generation data — NOT YET BUILT

### Part 6 — Testing ✅ BUILT (v4.0.0)

39. ✅ `harmony-post-processing.test.ts` — 72 tests covering all P1–P12 functions (D32)
40. ✅ `harmony-compliance.test.ts` — 43 tests covering syntax conversion, MJ params, T3/T4 detection, rule ceiling
41. ✅ Drift detection tests — assert lookup set sizes (T3: 20 nouns × 18 verbs, T4: 23 nouns × 21 verbs, CLIP: 10 adjectives)
42. ✅ Full pipeline integration tests — verify P3→P8→P10 chain order and cross-tier no-op behaviour
43. ⏳ Integration test: full flow from human text → AI tiers → AI optimisation — NOT YET BUILT
44. ⏳ Animation timing tests (minimum display, deceleration, landing) — NOT YET BUILT

---

## Changelog

- **25 March 2026 (v4.0.0):** **HARMONY ENGINEERING v2 + POST-PROCESSING EXTRACTION + TEST LOCKDOWN.** Six additional harmony rounds (R1–R6) with dual Claude/ChatGPT assessment, converged to ≤1 point gap across all tiers. Three 900-char stress tests (lighthouse, cellist, deep-sea diver) validated system at 94.5–96/100. System prompt rules expanded from 18 to 30 (ceiling raised 27→30, Martin-approved): +T1-8 semantic clustering with interaction merging, +T3-5 opening sentence diversity, +T4-5 mandatory scene depth, +G1 emotional atmosphere mandate, +T1-6 time-of-day weighting, +T3 "that feels" ban. Post-processing expanded from P1+P2 to 7 functions: +P3 (T4 self-correction), +P8 (T4 meta-openers, broadened with 23 abstract nouns × 21 meta verbs), +P10 (T4 short sentence merge), +P11 (T3 meta-openers, broadened with 20 abstract nouns × 18 perception verbs), +P12 (T1 CLIP qualitative adjective stripper). All post-processing extracted from route.ts to `src/lib/harmony-post-processing.ts` (342 lines) for testability. 115-test lockdown suite created: `harmony-post-processing.test.ts` (72 tests) + `harmony-compliance.test.ts` (43 tests). Drift detection tests assert lookup set sizes. T4 character limit raised 200→250 (D31). Decisions log expanded D26→D32. Non-regression rules expanded 27→30. Build order: Part 4d added (11 items), Part 6 updated from DEFERRED to BUILT.

- **23 March 2026 (v3.0.0):** **HARMONY ENGINEERING + UI POLISH.** System prompt evolved from 11 rules (scoring 62/100) to 18 rules (scoring 93/100) through 5 rounds of iterative testing with dual Claude/ChatGPT assessment. Added §6 (complete v3.0.0 system prompt), §7 (post-processing layer: P1 deduplicateMjNegatives, P2 stripTrailingPunctuation, postProcessTiers orchestrator), §8 (harmony engineering methodology with scoring journey and proven patterns). API specs updated: temperature 0.3→0.5, max_completion_tokens 1500→2000. File map updated with current line counts. UI changes: Generate button adopts engine bay gradient+pulse+shimmer when text present; Clear All buttons use purple gradient with white text; tier labels changed to white; tier provider icons strip added to FourTierPromptPreview. Non-regression rules expanded from 23 to 27. Decisions log expanded from D18 to D26. Build order updated with Part 4c (harmony engineering, 7 items).

- **23 March 2026 (v2.0.0):** **AI DISGUISE SYSTEM — FULL BUILD.** Parts 1–5 built and deployed. 8 new files, 5 modified files. Complete AI Disguise pipeline: Call 2 (tier generation), Call 3 (AI optimisation), algorithm cycling animation, drift detection, provider switching with auto-re-fire. System prompt v1 with 11 rules. IntelligencePanel removed, full-width layout. Clear cascade. Provider-specific syntax fixes.

---

_End of document._
