# AI Disguise — Prompt Lab Intelligence Engine

**Version:** 1.0.0  
**Created:** 22 March 2026  
**Owner:** Promagen  
**Status:** SPECIFICATION — Not yet built  
**Scope:** Prompt Lab (`/studio/playground`) ONLY. The standard builder (`/providers/[id]`) is untouched.  
**Authority:** This document defines the architecture, API routes, animation system, provider switching behaviour, and learning pipeline for the Prompt Lab's AI-powered prompt generation and optimisation system.

> **Cross-references:**
>
> - `unified-prompt-brain.md` — One Brain assembly architecture (standard builder)
> - `prompt-optimizer.md` — Client-side 4-phase optimizer (standard builder)
> - `prompt-builder-page.md` — Builder UI and `assemblePrompt()` integration
> - `prompt-lab.md` — Studio section routes and Prompt Lab architecture
> - `prompt-intelligence.md` — Intelligence layer, tier preview, colour coding
> - `paid_tier.md` — Pro gating (Prompt Lab is Pro exclusive)
> - `code-standard.md` — All code standards (clamp, no grey text, co-located animations)

---

## Table of Contents

1. [Design Philosophy](#1-design-philosophy)
2. [Architecture Overview](#2-architecture-overview)
3. [The Three API Calls](#3-the-three-api-calls)
4. [Call 1 — Category Extraction (Existing)](#4-call-1--category-extraction-existing)
5. [Call 2 — AI Tier Generation (NEW)](#5-call-2--ai-tier-generation-new)
6. [Call 3 — AI Prompt Optimisation (NEW)](#6-call-3--ai-prompt-optimisation-new)
7. [Provider Switching Behaviour](#7-provider-switching-behaviour)
8. [Algorithm Cycling Animation System](#8-algorithm-cycling-animation-system)
9. [The 101 Algorithm Names](#9-the-101-algorithm-names)
10. [Algorithm Count Display](#10-algorithm-count-display)
11. [Visual UX Flow](#11-visual-ux-flow)
12. [Standard Builder Learning Pipeline](#12-standard-builder-learning-pipeline)
13. [API Route Specifications](#13-api-route-specifications)
14. [Security & Cost Controls](#14-security--cost-controls)
15. [File Map](#15-file-map)
16. [Non-Regression Rules](#16-non-regression-rules)
17. [Decisions Log](#17-decisions-log)
18. [Build Order](#18-build-order)

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
│  CALL 1 (existing)   │              │  CALL 2 (NEW)                │
│  /api/parse-sentence │              │  /api/generate-tier-prompts  │
│                      │              │                              │
│  GPT-5.4-mini        │              │  GPT-5.4-mini                │
│  Extracts 12 cats    │              │  Generates 4 tier prompts    │
│  → JSON categories   │              │  directly from human text    │
│                      │              │  + provider context          │
│  Visual: 12 category │              │  → tier1, tier2, tier3,      │
│  badges cycle in     │              │    tier4 prompt text         │
│  sequence (150ms     │              │                              │
│  stagger)            │              │  Visual: tier cards populate │
│                      │              │  with AI-generated prompts   │
└──────────┬───────────┘              └──────────────┬───────────────┘
           │                                         │
           ▼                                         ▼
┌──────────────────────┐              ┌──────────────────────────────┐
│  Dropdowns populate  │              │  4-Tier Preview cards fill   │
│  with matched terms  │              │  with AI-generated text      │
│  (existing UX)       │              │  "Generated for Leonardo AI" │
└──────────────────────┘              │  badge if provider selected  │
                                      └──────────────────────────────┘

User selects provider → clicks "Optimise"
        │
        ▼
┌──────────────────────────────────────────────────────────────────┐
│  CALL 3 (NEW)                                                    │
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

### Cost Analysis

| Call                     | Model        | Est. input tokens | Est. output tokens | Cost per call | When fired                 |
| ------------------------ | ------------ | ----------------- | ------------------ | ------------- | -------------------------- |
| Call 1                   | gpt-5.4-mini | ~400              | ~300               | ~$0.002       | On "Generate Prompt" click |
| Call 2                   | gpt-5.4-mini | ~600              | ~500               | ~$0.003       | In parallel with Call 1    |
| Call 3                   | gpt-5.4-mini | ~800              | ~400               | ~$0.003       | On "Optimise" click        |
| **Total per full cycle** |              |                   |                    | **~$0.008**   |                            |

### Timing

| Call   | Trigger                       | Expected latency | Minimum display time               |
| ------ | ----------------------------- | ---------------- | ---------------------------------- |
| Call 1 | "Generate Prompt" button      | 1.5–3s           | None (existing UX)                 |
| Call 2 | Fires in parallel with Call 1 | 2–4s             | None (cards appear when ready)     |
| Call 3 | "Optimise" button click       | 2–4s             | 1.8s minimum (algorithm animation) |

---

## 4. Call 1 — Category Extraction (Existing)

**Route:** `POST /api/parse-sentence`  
**File:** `src/app/api/parse-sentence/route.ts` (243 lines)  
**Status:** Already built and working.

No changes to Call 1. It continues to:

1. Accept human text (max 1,000 chars)
2. Send to GPT-5.4-mini with the 12-category system prompt
3. Return structured JSON with terms per category
4. Hook `useSentenceConversion` matches terms to vocabulary
5. Dropdowns populate with staggered 150ms animation

Call 1 remains the sole source of truth for dropdown population and DNA score calculation.

---

## 5. Call 2 — AI Tier Generation (NEW)

### Purpose

Replace the string-template tier generators (`generators.ts`) with AI-generated tier prompts for the Prompt Lab. The AI receives the user's original human text and generates all 4 tier prompts directly, preserving the user's creative language, spatial relationships, and poetic intent.

### Route

**Path:** `POST /api/generate-tier-prompts`  
**File:** `src/app/api/generate-tier-prompts/route.ts` (NEW)

### Request Schema

```typescript
const RequestSchema = z.object({
  /** The user's original human text description */
  sentence: z.string().min(1).max(1000),
  /** Selected provider ID, or null for generic tiers */
  providerId: z.string().max(50).nullable(),
  /** Provider's platform format data (sent by client to avoid server-side file reads) */
  providerContext: z
    .object({
      tier: z.number().min(1).max(4),
      promptStyle: z.string(),
      sweetSpot: z.number(),
      tokenLimit: z.number(),
      qualityPrefix: z.array(z.string()).optional(),
      weightingSyntax: z.string().optional(),
      supportsWeighting: z.boolean().optional(),
      negativeSupport: z.enum(["separate", "inline", "none"]),
    })
    .nullable(),
});
```

### System Prompt (Call 2)

```
You are an expert AI image prompt generator for {platformCount} AI image generation platforms.

Given a natural English description, generate 4 different prompt versions optimised for different platform families. Return ONLY valid JSON with no preamble.

The 4 tiers:

TIER 1 — CLIP-Based (e.g., Leonardo, Stable Diffusion, DreamStudio):
- Weighted keyword syntax: (term:1.3), (term:1.1)
- Front-load subject and style with highest weights
- Quality prefix: masterpiece, best quality, highly detailed
- Comma-separated keywords, NOT sentences
- Separate negative prompt field
- Keep within ~100 tokens (350 chars)

TIER 2 — Midjourney Family:
- Natural language with parameter flags
- Style weighting via :: syntax (e.g., cinematic::2.0)
- End with parameters: --ar 16:9 --v 6 --s 500
- Negative via --no flag
- Artistic and mood descriptors work well
- Keep within ~200 chars for creative text

TIER 3 — Natural Language (e.g., DALL·E, Adobe Firefly):
- Full grammatical sentences
- Describe the scene as if telling an artist what to paint
- Include lighting, atmosphere, and composition naturally
- Convert negatives to positive reinforcement
- Keep within ~300 chars

TIER 4 — Plain Language (e.g., Canva, Bing, Freepik):
- Simple, focused description
- Short and direct
- Minimal technical jargon
- One or two sentences maximum
- Keep within ~150 chars

{providerSpecificInstructions}

Rules:
1. PRESERVE the user's creative intent — their exact words, metaphors, and spatial descriptions
2. Do NOT add elements not present in the input
3. Each tier should feel native to its platform family — not like a reformatted version of the others
4. Quality anchors may be added (masterpiece, detailed) but never override user content
5. Negative prompts should protect against common quality issues relevant to the description

Return format:
{
  "tier1": { "positive": "...", "negative": "..." },
  "tier2": { "positive": "...", "negative": "..." },
  "tier3": { "positive": "...", "negative": "..." },
  "tier4": { "positive": "...", "negative": "..." }
}
```

When `providerId` is set, `{providerSpecificInstructions}` injects platform-specific guidance:

```
The user has selected {providerName} ({tierName}).
This platform uses {promptStyle} format with {weightingSyntax} syntax.
Sweet spot: ~{sweetSpot} tokens. Token limit: {tokenLimit}.
Quality prefix: {qualityPrefix}.
Negative support: {negativeSupport}.
Prioritise Tier {tierNumber} output quality — this is the tier that will be used.
```

When `providerId` is null, `{providerSpecificInstructions}` is empty — generic best-practice tiers are generated.

### Response Schema

```typescript
const TierOutput = z.object({
  positive: z.string().max(2000),
  negative: z.string().max(500),
});

const ResponseSchema = z.object({
  tier1: TierOutput,
  tier2: TierOutput,
  tier3: TierOutput,
  tier4: TierOutput,
});
```

### Frontend Integration

**New hook:** `useTierGeneration` (NEW file: `src/hooks/use-tier-generation.ts`)

```typescript
interface UseTierGenerationReturn {
  /** AI-generated tier prompts (null until first generation) */
  aiTierPrompts: GeneratedPrompts | null;
  /** Whether the API call is in progress */
  isGenerating: boolean;
  /** Error message if the call failed */
  error: string | null;
  /** Which provider the tiers were generated for (for badge display) */
  generatedForProvider: string | null;
  /** Trigger tier generation */
  generate: (
    sentence: string,
    providerId: string | null,
    providerContext: ProviderContext | null,
  ) => Promise<void>;
}
```

**Integration point:** In `enhanced-educational-preview.tsx` and `prompt-builder.tsx` (when in Prompt Lab mode), the `FourTierPromptPreview` component receives `aiTierPrompts` instead of (or merged with) the template-generated `mergedPrompts`.

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

## 6. Call 3 — AI Prompt Optimisation (NEW)

### Purpose

Replace the client-side 4-phase optimizer with AI-powered prompt optimisation for the Prompt Lab. The AI takes the assembled prompt text and restructures it for the specific platform — not just trimming length but intelligently reordering, reweighting, removing filler, and strengthening quality anchors.

### Route

**Path:** `POST /api/optimise-prompt`  
**File:** `src/app/api/optimise-prompt/route.ts` (NEW)

### Request Schema

```typescript
const RequestSchema = z.object({
  /** The assembled prompt text to optimise */
  promptText: z.string().min(1).max(5000),
  /** The user's original human description (for reference) */
  originalSentence: z.string().max(1000).optional(),
  /** Selected provider ID */
  providerId: z.string().min(1).max(50),
  /** Provider's platform format data */
  providerContext: z.object({
    name: z.string(),
    tier: z.number().min(1).max(4),
    promptStyle: z.string(),
    sweetSpot: z.number(),
    tokenLimit: z.number(),
    maxChars: z.number().nullable(),
    idealMin: z.number(),
    idealMax: z.number(),
    qualityPrefix: z.array(z.string()).optional(),
    weightingSyntax: z.string().optional(),
    supportsWeighting: z.boolean().optional(),
    negativeSupport: z.enum(["separate", "inline", "none"]),
    categoryOrder: z.array(z.string()).optional(),
  }),
});
```

### System Prompt (Call 3)

```
You are an expert prompt optimiser for the AI image generation platform "{providerName}".

Your job is to take an assembled prompt and optimise it specifically for {providerName}, which is a Tier {tier} ({tierName}) platform.

Platform specifications:
- Prompt style: {promptStyle}
- Sweet spot: {idealMin}–{idealMax} characters
- Token limit: {tokenLimit}
- Weight syntax: {weightingSyntax}
- Quality prefix: {qualityPrefix}
- Category priority order: {categoryOrder}
- Negative handling: {negativeSupport}

Optimisation rules:
1. Reorder terms by platform-specific impact priority: {categoryOrder}
2. Remove redundant or duplicate semantic content
3. Strengthen quality anchors appropriate to this platform
4. Trim filler tokens (orphaned verbs, fragments, excessive adjectives)
5. Ensure the final prompt is within the sweet spot ({idealMin}–{idealMax} chars)
6. For CLIP platforms: ensure weights are properly distributed (subject highest, filler lowest)
7. For Midjourney: ensure parameters are correctly formatted and placed at end
8. For natural language platforms: ensure grammatical coherence
9. For plain platforms: keep it short, focused, and impactful
10. PRESERVE the user's core creative intent — optimise structure, not meaning

Return ONLY valid JSON:
{
  "optimised": "the optimised prompt text",
  "negative": "the optimised negative prompt (if applicable)",
  "changes": ["brief description of each change made"],
  "charCount": number,
  "tokenEstimate": number
}
```

### Response Schema

```typescript
const ResponseSchema = z.object({
  optimised: z.string().max(5000),
  negative: z.string().max(1000).optional(),
  changes: z.array(z.string().max(200)).max(20),
  charCount: z.number(),
  tokenEstimate: z.number(),
});
```

### Frontend Integration

**Modified hook:** `use-prompt-optimization.ts` gains a new mode for Prompt Lab.

When operating inside the Prompt Lab (`isLabMode: true`), the `getOptimizedPrompt()` function calls the new API route instead of running the client-side 4-phase pipeline. The algorithm cycling animation plays during the API call.

**Call 3 Firing Rules:**

| Event                                                     | Action                                         |
| --------------------------------------------------------- | ---------------------------------------------- |
| User clicks "Optimise" toggle ON (with provider selected) | Fire Call 3                                    |
| User switches provider while optimizer is ON              | Re-fire Call 3 with new provider context       |
| User modifies selections while optimizer is ON            | Re-fire Call 3 (debounced 500ms)               |
| No provider selected                                      | Optimizer toggle disabled (existing behaviour) |
| Optimizer toggled OFF                                     | Clear optimised output, show assembled prompt  |

---

## 7. Provider Switching Behaviour

### De-selection (provider → none)

When the user de-selects a provider (returns to "Choose platform..."):

1. AI-generated tier prompts remain visible in the 4-tier preview cards
2. A badge appears: **"Generated for {ProviderName}"** — uses the provider's brand colour
3. The assembled prompt box retains its current content
4. The optimizer toggle is force-disabled (existing behaviour)
5. No API call is fired
6. The "Generated for" badge disappears only when the user generates new prompts

### Re-selection (none → provider, or provider A → provider B)

When the user selects a (new) provider:

1. If human text exists in the "Describe Your Image" textarea:
   - Call 2 re-fires with the new provider context
   - Tier cards show a brief loading shimmer (200ms fade overlay + skeleton pulse)
   - Once the response arrives, tier cards cross-fade to new content (300ms transition)
2. If no human text exists:
   - Template-generated tiers update instantly (existing behaviour, no API call)
3. The "Generated for" badge updates to the new provider name
4. If the optimizer was ON, Call 3 re-fires with the new provider context

### Visual Transition on Provider Switch

The tier cards must NOT flash, jump, or blank out during provider switching. The transition should feel like the prompts are being "refined" rather than replaced:

1. Current tier text stays visible at full opacity
2. A subtle shimmer overlay (translucent gradient sweep, 200ms) passes across the card
3. Text cross-fades to new content (300ms ease-in-out)
4. The "Generated for" badge smoothly transitions (badge text fades out → in, 200ms)

**Animation co-located** in `<style dangerouslySetInnerHTML>` per `best-working-practice.md`.

---

## 8. Algorithm Cycling Animation System

### Overview

When Call 3 (optimise) fires, the user sees algorithm names cycling rapidly in the optimised prompt area. This creates the impression of a sophisticated multi-stage computation pipeline.

### Animation Phases

**Phase 1 — Fast Cycling (while waiting for API response):**

- Algorithm names cycle every 160–200ms (randomised interval per cycle)
- Names are drawn from the master list (§9), shuffled on each optimisation run
- Display format: `⚙ {Algorithm Name}...` in a monospace or semi-monospace font
- Background: subtle dark pulsing glow (co-located keyframe animation)
- Text colour: `text-amber-400` cycling to `text-emerald-400` as it progresses (gradient shift over time to suggest "warming up → processing → nearly done")

**Phase 2 — Deceleration (API response received, but animation continues):**

When the API response arrives, the animation does NOT stop immediately. Instead:

1. Cycling speed slows: 200ms → 350ms → 500ms → 700ms → 1000ms (5 more items shown)
2. Each item lingers slightly longer, creating a "slot machine stopping" feel
3. The last 3 items are always from a curated "finale" subset:
   - "Finalising prompt structure"
   - "Applying quality verification"
   - "Validating output integrity"

**Phase 3 — Landing:**

1. Final message appears: `✓ {N} algorithms applied` (see §10 for N calculation)
2. Brief pause (400ms)
3. The optimised prompt text fades in (300ms ease-in-out)
4. The entire cycling area transforms into the optimised prompt display

### Minimum Display Time

If the API responds in under 1.8 seconds, the animation continues cycling until at least 1.8 seconds have elapsed. This ensures the user always sees meaningful "processing" activity. The minimum guarantees at least 8–10 algorithm names are displayed.

### Maximum Display Time

If the API takes longer than 8 seconds (timeout approaching), the cycling continues but a subtle "This is taking longer than usual..." message appears beneath the cycling text after 6 seconds. At 10 seconds, the animation stops with a graceful error: "Optimisation timed out — showing assembled prompt."

---

## 9. The 101 Algorithm Names

These are the algorithm names that cycle during the optimisation animation. They are written to sound technically credible — real enough that an AI image generation expert would nod, impressive enough that a casual user would be fascinated.

Names are shuffled randomly on each optimisation run. The user never sees the same sequence twice.

### Category: Token & Weight Analysis (20)

1. Analysing semantic token density
2. Calibrating CLIP attention weights
3. Mapping cross-attention distribution
4. Evaluating token position decay
5. Computing attention head alignment
6. Detecting token overflow boundaries
7. Scoring positional emphasis curves
8. Rebalancing weight distribution
9. Normalising CLIP embedding vectors
10. Profiling token-to-pixel influence
11. Estimating diffusion step impact
12. Quantifying prompt-to-latent mapping
13. Resolving weight saturation zones
14. Measuring encoder throughput
15. Scanning for orphaned token fragments
16. Verifying weight syntax compliance
17. Calculating diminishing returns threshold
18. Indexing attention priority layers
19. Tracing token influence propagation
20. Benchmarking encoding efficiency

### Category: Quality & Fidelity Optimisation (18)

21. Amplifying core quality anchors
22. Strengthening fidelity descriptors
23. Optimising quality prefix placement
24. Evaluating resolution signal density
25. Boosting masterpiece token weight
26. Assessing aesthetic coherence score
27. Calibrating sharpness parameters
28. Validating detail preservation ratio
29. Enhancing photorealistic signal chain
30. Scoring output quality prediction
31. Measuring visual fidelity potential
32. Adjusting clarity emphasis levels
33. Profiling HDR dynamic range tokens
34. Verifying anti-artifact safeguards
35. Tuning noise reduction signals
36. Balancing detail vs abstraction
37. Computing perceived quality index
38. Optimising render-ready markers

### Category: Composition & Spatial Intelligence (16)

39. Analysing compositional flow patterns
40. Reweighting foreground-background ratio
41. Evaluating depth-of-field signals
42. Optimising rule-of-thirds alignment
43. Detecting perspective coherence
44. Scoring spatial relationship clarity
45. Balancing subject-environment weight
46. Assessing framing intelligence
47. Computing visual hierarchy score
48. Mapping leading line emphasis
49. Calibrating negative space allocation
50. Evaluating vanishing point signals
51. Profiling aspect ratio optimality
52. Resolving compositional conflicts
53. Normalising focal point distribution
54. Aligning camera-lens coherence

### Category: Colour & Lighting Intelligence (16)

55. Harmonising colour-light coherence
56. Evaluating chromatic balance
57. Calibrating lighting direction signals
58. Scoring ambient illumination weight
59. Detecting colour palette conflicts
60. Optimising warm-cool tone ratio
61. Rebalancing shadow-highlight tokens
62. Profiling golden hour signal strength
63. Assessing volumetric light density
64. Mapping rim lighting emphasis
65. Computing colour harmony index
66. Normalising tonal range distribution
67. Verifying atmospheric light scatter
68. Adjusting chiaroscuro balance
69. Measuring colour saturation curves
70. Optimising luminance contrast ratio

### Category: Platform-Specific Tuning (16)

71. Loading platform syntax profile
72. Applying provider-specific formatting
73. Calibrating sweet spot length target
74. Optimising for platform token encoder
75. Adjusting prompt architecture for model
76. Mapping category priority to platform
77. Evaluating platform response patterns
78. Scoring platform-optimised term order
79. Configuring negative prompt syntax
80. Validating parameter flag positions
81. Tuning weight syntax for target model
82. Aligning with platform quality gates
83. Profiling model attention architecture
84. Computing platform-specific trim map
85. Adjusting for model context window
86. Optimising inference step alignment

### Category: Semantic & Structural Analysis (15)

87. Removing semantic redundancy
88. Detecting duplicate concept clusters
89. Pruning low-signal modifier chains
90. Resolving synonym saturation
91. Compressing verbose descriptors
92. Eliminating orphaned verb fragments
93. Stripping grammar debris tokens
94. Consolidating overlapping attributes
95. Rewriting compound descriptions
96. Defragmenting prompt structure
97. Bridging disconnected scene elements
98. Tightening descriptor specificity
99. Collapsing adjacent near-synonyms
100.  Streamlining modifier hierarchy
101.  Merging compatible style references

### Finale Subset (always last 3 shown)

102. Finalising prompt structure
103. Applying quality verification
104. Validating output integrity

**Total: 101 cycling + 3 finale = 104 names in the master list.**

### Implementation

```typescript
// src/data/algorithm-names.ts (NEW)

/** Master list of algorithm display names for the optimisation cycling animation */
export const ALGORITHM_NAMES: readonly string[] = [
  "Analysing semantic token density",
  "Calibrating CLIP attention weights",
  // ... all 101 names
] as const;

/** Always shown as the final 3 items before landing */
export const FINALE_NAMES: readonly string[] = [
  "Finalising prompt structure",
  "Applying quality verification",
  "Validating output integrity",
] as const;

/** Shuffle array (Fisher-Yates) — returns new array, does not mutate */
export function shuffleAlgorithms(): string[] {
  const arr = [...ALGORITHM_NAMES];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}
```

---

## 10. Algorithm Count Display

### The Landing Number

When the animation lands, it displays: `✓ {N} algorithms applied`

**N is calculated as:**

```
N = BASE + VARIATION
where:
  BASE = 87 (minimum credible number)
  VARIATION = Math.floor(Math.random() * 16) (0–15)

Result range: 87–102
```

This produces numbers like 87, 91, 94, 97, 99, 102 — always high, always different, always credible as "we ran between 87 and 102 algorithms depending on your prompt's characteristics."

### Why This Range

- Below 80 feels "not that many"
- Above 110 feels exaggerated
- 87–102 sits in the sweet spot of "impressively many but believably specific"
- The variation makes it feel genuinely dynamic — the system analysed THIS prompt and determined exactly how many algorithms were applicable

### Display Format

```
✓ 97 algorithms applied
```

- Colour: `text-emerald-400`
- Font: same as surrounding UI (not monospace for the final landing)
- Icon: checkmark (✓), not emoji
- Brief 200ms scale-up animation on appearance (1.0 → 1.05 → 1.0)

---

## 11. Visual UX Flow

### Complete User Journey (Prompt Lab)

```
1. User opens Prompt Lab (/studio/playground)
2. User types description in "Describe Your Image" textarea
3. User clicks "Generate Prompt"
   │
   ├─ Call 1 fires → 12 category badges cycle in (existing, 150ms stagger)
   │  └─ Dropdowns populate → DNA score updates
   │
   └─ Call 2 fires (parallel) → 4 tier cards show loading shimmer
      └─ AI prompts arrive → tier cards cross-fade to AI content
         └─ If provider selected: "Generated for Leonardo AI" badge appears
         └─ If no provider: generic badge or no badge

4. User selects provider from dropdown
   │
   ├─ If human text exists → Call 2 re-fires with provider context
   │  └─ Tier cards shimmer → cross-fade to provider-tailored prompts
   │  └─ Badge updates: "Generated for {Provider}"
   │
   └─ If no human text → template tiers update instantly (no API call)

5. User clicks "Optimise" toggle
   │
   ├─ Algorithm cycling animation starts immediately
   │  └─ ⚙ Analysing semantic token density...
   │  └─ ⚙ Calibrating CLIP attention weights...
   │  └─ ⚙ Mapping cross-attention distribution...
   │  └─ (continues cycling 160–200ms per name)
   │
   ├─ Call 3 fires → API processing
   │
   ├─ API responds (2–4s)
   │  └─ Animation enters Phase 2 (deceleration)
   │  └─ 350ms... 500ms... 700ms... 1000ms...
   │  └─ "Finalising prompt structure..."
   │  └─ "Applying quality verification..."
   │  └─ "Validating output integrity..."
   │
   └─ Landing: "✓ 97 algorithms applied"
      └─ 400ms pause
      └─ Optimised prompt text fades in
      └─ Transparency panel updates (changes list)

6. User switches provider (Leonardo → Midjourney)
   │
   ├─ If optimizer was ON:
   │  └─ Call 2 re-fires (new provider tiers)
   │  └─ Call 3 re-fires (new provider optimisation)
   │  └─ Algorithm cycling plays again
   │
   └─ If optimizer was OFF:
      └─ Call 2 re-fires only
      └─ Tier cards shimmer → update

7. User de-selects provider (back to "Choose platform...")
   │
   └─ Tiers stay as-is with "Generated for {last provider}" badge
   └─ Optimizer toggle force-disabled
   └─ No API calls fired
```

---

## 12. Standard Builder Learning Pipeline

### Passive Data Collection

Every time Call 2 or Call 3 fires in the Prompt Lab, we log the input→output pair for future use. This data feeds into improving the standard builder's string templates over time.

### Data Stored (via existing prompt-telemetry route)

```typescript
interface LearningPair {
  /** The structured selections that went into the generation */
  selections: PromptSelections;
  /** The AI-generated tier prompts (Call 2 output) */
  aiTierPrompts: {
    tier1: { positive: string; negative: string };
    tier2: { positive: string; negative: string };
    tier3: { positive: string; negative: string };
    tier4: { positive: string; negative: string };
  };
  /** The AI-optimised prompt (Call 3 output, if applicable) */
  aiOptimisedPrompt?: string;
  /** The provider it was optimised for */
  providerId: string | null;
  /** Timestamp */
  generatedAt: string;
}
```

### Three Phases of Learning

**Phase 1 — Passive collection (ships with v1.0):**
Log every Prompt Lab generation pair. No analysis yet. Build the dataset.

**Phase 2 — Pattern extraction (future):**
Analyse logged pairs to identify:

- Term reordering patterns per platform
- Quality anchors the AI consistently adds
- Filler terms the AI consistently removes
- Weight distribution patterns per tier

**Phase 3 — Standard builder "Prompt Refinement" button (future, Pro only):**
On the standard builder, Pro users get a button labelled **"Refine"** (not "Polish with AI" — the user thinks it's algorithmic). This sends the assembled prompt through Call 3 for AI optimisation.

User-facing label: **"Prompt Refinement Engine"** or **"Deep Refine"**

This phase is NOT part of the initial build. It requires Phase 1 data collection to be running first.

---

## 13. API Route Specifications

### `/api/generate-tier-prompts` (Call 2)

| Property              | Value                                                     |
| --------------------- | --------------------------------------------------------- |
| Method                | POST                                                      |
| Runtime               | nodejs                                                    |
| Dynamic               | force-dynamic                                             |
| Max duration          | 15s                                                       |
| Rate limit            | 20/hour prod, 200/hour dev                                |
| Rate limit key        | `generate-tier-prompts`                                   |
| Auth required         | No (Pro gate is at page level)                            |
| Model                 | gpt-5.4-mini                                              |
| Temperature           | 0.3 (slightly higher than extraction for creative output) |
| Max completion tokens | 1500                                                      |
| Response format       | json_object                                               |
| Cache                 | no-store                                                  |

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

## 14. Security & Cost Controls

### Rate Limiting

Both new routes use the existing `rateLimit()` utility from `src/lib/rate-limit.ts`:

- Per-IP rate limiting (20–30 requests/hour in production)
- Generous limits in development (200/hour)
- Returns 429 with `Retry-After` header when exceeded

### Input Validation

- All inputs validated with Zod schemas (§5, §6)
- HTML/script tags stripped from all text inputs
- Maximum character limits enforced on all string fields

### Cost Guardrails

- GPT-5.4-mini is the cheapest model — no accidental model upgrades
- `max_completion_tokens` capped to prevent runaway responses
- Rate limits prevent abuse (max ~$0.50/hour per user in the worst case)
- Vercel spend management thresholds apply (per `vercel-pro-promagen-playbook.md`)

### API Key

Uses the existing `env.providers.openAiApiKey` from `src/lib/env.ts`. No new environment variables required.

---

## 15. File Map

### New Files

| File                                              | Purpose                               | Est. lines |
| ------------------------------------------------- | ------------------------------------- | ---------- |
| `src/app/api/generate-tier-prompts/route.ts`      | Call 2 API route                      | ~200       |
| `src/app/api/optimise-prompt/route.ts`            | Call 3 API route                      | ~250       |
| `src/hooks/use-tier-generation.ts`                | Hook for Call 2 (AI tier generation)  | ~120       |
| `src/hooks/use-ai-optimisation.ts`                | Hook for Call 3 (AI optimisation)     | ~180       |
| `src/data/algorithm-names.ts`                     | 104 algorithm names + shuffle utility | ~130       |
| `src/components/prompt-lab/algorithm-cycling.tsx` | Cycling animation component           | ~250       |

### Modified Files

| File                                                         | Change                                                                       | Impact |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------- | ------ |
| `src/components/prompts/enhanced-educational-preview.tsx`    | Wire AI tiers into FourTierPromptPreview, add "Generated for" badge          | Medium |
| `src/components/providers/prompt-builder.tsx`                | Wire AI tiers when in Prompt Lab mode (detected via `providerSelector` prop) | Medium |
| `src/hooks/use-prompt-optimization.ts`                       | Add lab mode that calls API instead of client-side optimizer                 | Small  |
| `src/components/prompt-builder/four-tier-prompt-preview.tsx` | Add loading shimmer state, cross-fade transition                             | Small  |

### Untouched Files (explicitly protected)

| File                                               | Reason                                                                                     |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `src/lib/prompt-builder.ts`                        | One Brain remains the standard builder's assembly engine                                   |
| `src/lib/prompt-builder/generators.ts`             | Template generators remain as fallback for Prompt Lab and sole engine for standard builder |
| `src/lib/prompt-optimizer.ts`                      | Client-side optimizer remains the standard builder's optimizer                             |
| `src/app/api/parse-sentence/route.ts`              | Call 1 is unchanged                                                                        |
| `src/hooks/use-sentence-conversion.ts`             | Extraction hook is unchanged                                                               |
| `src/components/providers/describe-your-image.tsx` | UI component is unchanged                                                                  |

---

## 16. Non-Regression Rules

1. **Standard builder is untouched** — no changes to `/providers/[id]` route, `assemblePrompt()`, `generators.ts`, or client-side optimizer
2. **Call 1 is unchanged** — `/api/parse-sentence` route, `useSentenceConversion` hook, and dropdown population animation remain identical
3. **One Brain principle preserved** — `assemblePrompt()` remains the sole assembly engine for the standard builder. The Prompt Lab's AI tiers are a parallel output, not a replacement of One Brain
4. **Template generators remain as fallback** — if Call 2 fails, times out, or returns invalid data, the Prompt Lab falls back to `generateAllTierPrompts()` (template output)
5. **Optimizer client-side pipeline preserved** — the standard builder's 4-phase optimizer continues to work exactly as documented in `prompt-optimizer.md`
6. **All code standards apply** — `clamp()` sizing, no grey text, no opacity dimming, cursor-pointer on clickables, co-located animations, desktop-only
7. **Pro gating unchanged** — Prompt Lab remains Pro exclusive (gating implementation per `paid_tier.md §5.13`)
8. **Algorithm names never reference AI** — no mention of "GPT", "OpenAI", "AI", "language model", "LLM", or "neural network" in any user-facing text
9. **`incrementLifetimePrompts()` preserved** — all copy handlers must continue to track usage
10. **Colour-coded prompts preserved** — AI-generated tier text must still support `parsePromptIntoSegments()` colour coding for Pro users
11. **Existing features preserved: Yes** — required statement for every change set

---

## 17. Decisions Log

| #   | Decision                                                                                      | Rationale                                                                                  | Date        |
| --- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ----------- |
| D1  | Call 1 + Call 2 fire in parallel                                                              | Faster UX — user sees dropdowns populating AND tier prompts appearing simultaneously       | 22 Mar 2026 |
| D2  | Call 2 is generic when no provider, provider-tailored when provider selected                  | Generic tiers show platform families; provider tiers show platform-specific best practices | 22 Mar 2026 |
| D3  | De-selecting provider keeps last-generated tiers with "Generated for X" badge                 | Respects user's work, saves API costs, avoids jarring "prompts vanished" moment            | 22 Mar 2026 |
| D4  | Switching providers re-fires Call 2 with visual shimmer transition                            | Prompts must feel refined, not replaced — smooth cross-fade, no flash/jump                 | 22 Mar 2026 |
| D5  | Call 3 fires on "Optimise" click with algorithm cycling animation                             | Creates impression of deep computational processing, synchronised with API response        | 22 Mar 2026 |
| D6  | 101 algorithm names with slot-machine deceleration and min 1.8s display                       | Showmanship — the user sees intelligence at work, never feels like "waiting for a server"  | 22 Mar 2026 |
| D7  | Algorithm count display: randomised 87–102 range                                              | High enough to impress, variable enough to feel dynamic, specific enough to feel genuine   | 22 Mar 2026 |
| D8  | Standard builder learns from Prompt Lab data (passive, then active)                           | Competitive moat — the more users use Prompt Lab, the smarter the standard builder gets    | 22 Mar 2026 |
| D9  | User-facing language: "Prompt Intelligence Engine", "Deep Optimisation Pipeline" — never "AI" | Protects value proposition — users pay for proprietary engineering, not a GPT wrapper      | 22 Mar 2026 |
| D10 | Standard builder "Refine" button (Phase 3, future) — NOT "Polish with AI"                     | Consistent with disguise principle — all user-facing language implies algorithms, not AI   | 22 Mar 2026 |

---

## 18. Build Order

### Part 1 — Foundation (API routes + data)

1. Create `src/data/algorithm-names.ts` — 104 names + shuffle utility
2. Create `src/app/api/generate-tier-prompts/route.ts` — Call 2 API route
3. Create `src/app/api/optimise-prompt/route.ts` — Call 3 API route

### Part 2 — Hooks

4. Create `src/hooks/use-tier-generation.ts` — Call 2 hook
5. Create `src/hooks/use-ai-optimisation.ts` — Call 3 hook with animation timing

### Part 3 — Animation Component

6. Create `src/components/prompt-lab/algorithm-cycling.tsx` — cycling animation with phases

### Part 4 — Integration (Prompt Lab wiring)

7. Wire AI tiers into `enhanced-educational-preview.tsx` (no-provider mode)
8. Wire AI tiers into `prompt-builder.tsx` (provider-selected mode)
9. Wire AI optimisation into optimizer toggle (lab mode only)
10. Add "Generated for X" badge to tier preview
11. Add loading shimmer + cross-fade transitions to tier cards

### Part 5 — Learning Pipeline (passive)

12. Add learning pair logging to telemetry route
13. Extend prompt-telemetry schema to include AI generation data

### Part 6 — Testing

14. Unit tests for both new API routes
15. Unit tests for both new hooks
16. Integration test: full flow from human text → AI tiers → AI optimisation
17. Animation timing tests (minimum display, deceleration, landing)

---

_End of document._
