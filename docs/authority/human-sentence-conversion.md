# Human Sentence Conversion

**Version:** 2.0.0  
**Date:** 23 March 2026  
**Status:** BUILT and deployed  
**Owner:** Promagen  
**Authority:** This document defines the architecture, UI, API route, and term-matching logic for converting natural English text into structured, platform-specific AI image prompts.

**Cross-references:**

- `ai-disguise.md` — AI Disguise system (Call 1 is the parse-sentence route documented here; Call 2 fires in parallel)
- `prompt-lab.md` — Studio section, Prompt Lab architecture, component table
- `prompt-intelligence.md` — Intelligence engine, semantic tags, DNA scoring
- `unified-prompt-brain.md` — One Brain / `assemblePrompt()` single assembly path
- `prompt-optimizer.md` — Client-side 4-phase optimizer
- `paid_tier.md` — Pro Promagen feature gates
- `buttons.md` — Button styling standards (Generate button, Clear All)
- `code-standard.md` — All code standards (clamp, no grey text, co-located animations)

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [Architecture](#2-architecture)
3. [The API Call (Call 1)](#3-the-api-call-call-1)
4. [Term Matching](#4-term-matching)
5. [UI Component — DescribeYourImage](#5-ui-component--describeyourimage)
6. [Generate Button — Engine Bay Styling](#6-generate-button--engine-bay-styling)
7. [Clear All — Full Cascade Reset](#7-clear-all--full-cascade-reset)
8. [Format Detection](#8-format-detection)
9. [Drift Detection](#9-drift-detection)
10. [AI Disguise Integration (Call 2)](#10-ai-disguise-integration-call-2)
11. [File Map](#11-file-map)
12. [Pro Gate](#12-pro-gate)
13. [Error Handling](#13-error-handling)
14. [Security & Cost Control](#14-security--cost-control)
15. [Non-Regression Rules](#15-non-regression-rules)
16. [Future Extensions](#16-future-extensions)

---

## 1. Problem Statement

Users think in sentences. AI image platforms think in structured categories with platform-specific syntax.

Today, a user must manually break their creative vision into 12 dropdown selections. This works for users who understand prompt engineering. It fails for users who think like this:

> "A lone mermaid glides through the open sea in crystal-clear tropical water, surrounded by clouds of bright reef fish in shimmering blues, yellows, and orange."

That sentence contains subject, action, environment, lighting, atmosphere, colour, and materials — but the user shouldn't need to know that. They paste it in, click Generate, and the engine does the thinking.

### The quality case

The real problem isn't convenience — it's image quality. When a user pastes a raw sentence into Leonardo (CLIP, 75 tokens), everything after token 75 is silently truncated. When they paste it into Midjourney, most words are wasted. When they paste it into Canva (Plain Language tier), the long paragraph overwhelms a tool designed for short inputs.

The Intelligence Engine solves all of this — but only if input arrives as structured category selections. This feature bridges the gap.

---

## 2. Architecture

### The Two-Track System

When the user clicks "Generate Prompt", two API calls fire **in parallel**:

- **Call 1** (`/api/parse-sentence`) — Categorises human text into 12 structured categories → populates dropdowns
- **Call 2** (`/api/generate-tier-prompts`) — Generates 4 tier-native prompts directly from human text → populates tier preview cards

Call 1 is documented here. Call 2 is documented in `ai-disguise.md` §5–§8.

### Data flow (Call 1)

```
┌─────────────────────────────────────────────────────────────────┐
│  HUMAN SENTENCE CONVERSION (Call 1)                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌──────────────────┐                                          │
│   │ User types or     │                                          │
│   │ pastes natural    │                                          │
│   │ English text      │                                          │
│   └────────┬─────────┘                                          │
│            │                                                     │
│            ▼                                                     │
│   ┌──────────────────┐                                          │
│   │ POST /api/        │ ← GPT-5.4-mini (OpenAI)                │
│   │ parse-sentence    │                                          │
│   │ Parse only        │                                          │
│   │ "Categorise into  │                                          │
│   │  12 categories"   │                                          │
│   └────────┬─────────┘                                          │
│            │                                                     │
│            ▼                                                     │
│   ┌──────────────────┐                                          │
│   │ Term Matching     │                                          │
│   │ (use-sentence-    │                                          │
│   │  conversion.ts)   │                                          │
│   │                   │                                          │
│   │ Exact match?      │                                          │
│   │ → Select it       │                                          │
│   │                   │                                          │
│   │ Substring match?  │                                          │
│   │ → Select shortest │                                          │
│   │                   │                                          │
│   │ Fuzzy (Lev ≤ 3)? │                                          │
│   │ → Select it       │                                          │
│   │                   │                                          │
│   │ No match?         │                                          │
│   │ → Custom entry    │                                          │
│   └────────┬─────────┘                                          │
│            │                                                     │
│            ▼                                                     │
│   ┌──────────────────┐                                          │
│   │ 12 DROPDOWNS      │                                          │
│   │ POPULATE           │                                          │
│   │ (staggered 150ms  │                                          │
│   │  per category)    │                                          │
│   └────────┬─────────┘                                          │
│            │                                                     │
│            ▼                                                     │
│   ┌──────────────────────────────────────────────────┐          │
│   │ EXISTING PIPELINE (unchanged)                     │          │
│   │                                                   │          │
│   │ assemblePrompt() → One Brain                      │          │
│   │ ├── Encoder detection (CLIP/T5/MJ/ChatGLM3/Prop) │          │
│   │ ├── Per-platform limits (540 unique values)       │          │
│   │ ├── Weight syntax (platform-specific)             │          │
│   │ ├── Fidelity conversion                           │          │
│   │ ├── Negative routing                              │          │
│   │ ├── Smart trim (lowest-relevance first)           │          │
│   │ └── Platform-specific output                      │          │
│   │                                                   │          │
│   │ Output: optimised, platform-specific prompt       │          │
│   └──────────────────────────────────────────────────┘          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### The One Brain Rule

**The API call parses. The engine optimises. These are two different jobs.**

Call 1 categorises the human sentence into 12 structured categories. From that point forward, the existing `assemblePrompt()` pipeline handles everything. Call 1's only job is parsing — it never optimises, reorders, or formats.

Call 2 (AI Disguise) generates tier prompts in parallel but through a completely separate path. See `ai-disguise.md` §5.

---

## 3. The API Call (Call 1)

### Route

**Path:** `POST /api/parse-sentence`  
**File:** `src/app/api/parse-sentence/route.ts` (243 lines)

### Specification

| Property              | Value                                                                  |
| --------------------- | ---------------------------------------------------------------------- |
| Method                | POST                                                                   |
| Runtime               | nodejs                                                                 |
| Dynamic               | force-dynamic                                                          |
| Max duration          | 15s                                                                    |
| Rate limit            | 20/hour prod, 200/hour dev                                             |
| Rate limit key        | `parse-sentence`                                                       |
| Model                 | GPT-5.4-mini (OpenAI)                                                  |
| Temperature           | 0.15 (low — consistent extraction with slight flex for creative terms) |
| Max completion tokens | 700                                                                    |
| Response format       | json_object                                                            |
| Cache                 | no-store                                                               |

### Request Schema

```typescript
const RequestSchema = z.object({
  sentence: z.string().min(1).max(1000),
});
```

### Response Schema

```typescript
const CategoryArraySchema = z.array(z.string().max(100)).max(10);

const ParseResponseSchema = z.object({
  subject: CategoryArraySchema,
  action: CategoryArraySchema,
  style: CategoryArraySchema,
  environment: CategoryArraySchema,
  composition: CategoryArraySchema,
  camera: CategoryArraySchema,
  lighting: CategoryArraySchema,
  colour: CategoryArraySchema,
  atmosphere: CategoryArraySchema,
  materials: CategoryArraySchema,
  fidelity: CategoryArraySchema,
  negative: CategoryArraySchema,
});
```

### System Prompt (actual deployed text)

```
You are a prompt categorisation engine for AI image generation.

Given a natural English description of an image, extract terms into exactly these 12 categories. Return ONLY valid JSON with no preamble, no markdown, no explanation.

Categories (with examples of what belongs in each):
- subject: The main focus — people, animals, objects, landscapes, architecture, scenes, or abstract concepts.
- action: What the subject is doing or the scene's motion.
- style: Artistic style or rendering approach.
- environment: The setting, location, or backdrop.
- composition: Framing, layout, and depth.
- camera: Lens, camera model, and technical specs.
- lighting: Light source, direction, and quality.
- colour: Dominant colours, palette, or tonal character.
- atmosphere: Mood, weather effects, and atmospheric conditions.
- materials: Textures, surfaces, and physical qualities.
- fidelity: Quality descriptors, resolution, and technical quality terms.
- negative: Things to exclude. Only populate if exclusions are mentioned.

Rules:
1. Be thorough — extract everything described or strongly implied. Aim to populate 10–12 categories for rich descriptions.
2. Use short phrases (1–4 words per term), not full sentences.
3. A category may have multiple terms — return as an array.
4. If a category genuinely has no relevant content, return an empty array.
5. Camera specs go in "camera" — not composition. Depth of field and framing go in "composition".
6. Quality terms like "sharp focus", "8K", "detailed" ALWAYS go in "fidelity".
7. Physical textures and surface materials go in "materials".
8. Preserve the user's creative intent — do not reinterpret or "improve" their words.
9. Do NOT invent or infer terms not in the input.
10. Do NOT embellish terms. "shot on Leica" stays as "shot on Leica", not "vintage Leica look".
```

---

## 4. Term Matching

**File:** `src/hooks/use-sentence-conversion.ts` (260 lines)

After Call 1 returns 12 category arrays, each term is matched against Promagen's existing vocabulary using a 3-step cascade:

### Matching priority

| Step                       | Method                                                                                  | Example                                                        |
| -------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| 1. Exact match             | Case-insensitive string equality                                                        | "golden hour" → selects "golden hour"                          |
| 2. Substring containment   | Shortest matching option wins (prevents embellishment)                                  | "Leica" → selects "shot on Leica" (shortest containing option) |
| 3. Fuzzy (Levenshtein ≤ 3) | Only for terms 5+ chars. Number-aware — "90mm lens" will NOT fuzzy-match to "50mm lens" | "photographc" → selects "photographic"                         |
| 4. No match                | Term goes into the category's custom entry field                                        | "bioluminescent jellyfish" → custom entry                      |

### Pre-processing

Before matching, terms go through a pre-processing pass (`preprocessExtractedTerms()`) that fixes common GPT extraction issues: contextless fragments, redundant wrappers, and known bad patterns.

### Category population

Matched terms populate the `categoryState` in the prompt builder. Each category receives a `CategoryState`:

```typescript
{ selected: string[], customValue: string }
```

- `selected` — vocabulary terms that matched (steps 1–3)
- `customValue` — terms that didn't match (step 4), comma-joined

---

## 5. UI Component — DescribeYourImage

**File:** `src/components/providers/describe-your-image.tsx` (722 lines)  
**Pattern:** Collapsible horizontal strip (identical to SceneSelector)

### Layout

```
┌─ Trigger bar (collapsed): "✍️ Describe Your Image"  ──────────────────┐
│  ⚡️ is completed animation                   Click to expand ▾       │
└─────────────────────────────────────────────────────────────────────────┘
┌─ Expanded panel ────────────────────────────────────────────────────────┐
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ Paste a natural-language description for an image prompt...        │ │
│  │                                                          750/1000 │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│  [⚡ Generate Prompt] [Clear All]  📐 Composition  Ctrl+Enter   [Close]│
│                                                                         │
│  💡 3 empty: Composition, Camera, Materials — add detail to boost DNA  │
│  Edit your description above and click Regenerate to refine prompts    │
└─────────────────────────────────────────────────────────────────────────┘
```

### Props

```typescript
interface DescribeYourImageProps {
  categoryState: Record<PromptCategory, CategoryState>;
  setCategoryState: React.Dispatch<
    React.SetStateAction<Record<PromptCategory, CategoryState>>
  >;
  isLocked: boolean;
  onTextChange?: (text: string) => void; // AI Disguise: tracks human text
  onGenerate?: (sentence: string) => void; // AI Disguise: fires Call 2 in parallel
  onClear?: () => void; // AI Disguise: full cascade reset
  isDrifted?: boolean; // Drift detection state
  driftChangeCount?: number; // Word-level change count
  clearSignal?: number; // External clear trigger (footer Clear All)
}
```

### State

| State           | Type            | Purpose                                           |
| --------------- | --------------- | ------------------------------------------------- |
| `isExpanded`    | boolean         | Trigger bar collapsed/expanded                    |
| `inputText`     | string          | Textarea content                                  |
| `hasGenerated`  | boolean         | Whether a generation has completed                |
| `formatWarning` | FormatDetection | Amber warning if user pastes pre-formatted prompt |

### Features

| Feature                    | Description                                                                                                               |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Collapsible strip**      | Trigger bar "✍️ Describe Your Image". Expands to reveal textarea + controls.                                              |
| **Textarea**               | 1,000 char max, amber warning at 800 chars. Auto-focus on expand.                                                         |
| **Generate Prompt button** | Engine bay gradient when text present (§6). Slate/disabled when empty.                                                    |
| **Clear All button**       | Purple gradient, white text. Full cascade reset (§7).                                                                     |
| **Category badges**        | During generation, shows which category is currently populating with colour-coded emoji badges (150ms stagger animation). |
| **Format detection**       | Warns if user pastes CLIP/MJ formatted prompts instead of natural language (§8).                                          |
| **Drift indicator**        | Shows "N changes detected" badge when user edits after generation. "Regenerate" amber pulse when drift ≥ 3 (§9).          |
| **Empty categories hint**  | After generation, shows which categories are empty with suggestion to add detail.                                         |
| **Ctrl+Enter shortcut**    | Keyboard shortcut to generate without clicking button.                                                                    |
| **`clearSignal` prop**     | Incremented by parent (footer Clear All) to trigger internal reset without lifting all state up.                          |

---

## 6. Generate Button — Engine Bay Styling

The Generate Prompt button adopts the exact same visual treatment as the Launch Platform Builder button in the engine bay (`engine-bay.tsx`).

### Three states

| State              | Visual                                                       | Class                                                                                                        |
| ------------------ | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| **Empty textarea** | Slate/disabled. No animation. `cursor-not-allowed`           | `bg-slate-800/40 border-slate-700/30`                                                                        |
| **Text present**   | Sky→emerald→indigo gradient. Pulsing glow. Shimmer on hover. | `dyi-generate-active border-sky-400/60 bg-gradient-to-r from-sky-400/40 via-emerald-300/40 to-indigo-400/40` |
| **Loading**        | Same gradient, no pulse. Spinner icon + "Parsing..." text.   | `dyi-generating border-sky-400/40 bg-gradient-to-r from-sky-400/30 via-emerald-300/30 to-indigo-400/30`      |

### Animations (co-located in `DESCRIBE_STYLES`)

| Animation                    | Keyframes                                                                 | Duration      | Purpose                          |
| ---------------------------- | ------------------------------------------------------------------------- | ------------- | -------------------------------- |
| `dyi-generate-pulse`         | Sky/emerald box-shadow oscillation (identical to `engine-bay-pulse`)      | 2s infinite   | Draws attention to active button |
| `dyi-generate-shimmer-sweep` | White gradient translateX sweep (identical to `engine-bay-shimmer-sweep`) | 1.5s infinite | Hover sparkle effect             |

Both respect `prefers-reduced-motion`.

---

## 7. Clear All — Full Cascade Reset

Two identical Clear All buttons exist in the Prompt Lab — one next to Generate (top), one in the footer.

### Style

Purple gradient matching Dynamic/Randomise buttons (canonical style from `buttons.md` §2.1):

```
border-purple-500/70 bg-gradient-to-r from-purple-600/20 to-pink-600/20 text-white
hover:from-purple-600/30 hover:to-pink-600/30 hover:border-purple-400
```

**Text colour:** `text-white`. Both are `<button>` elements (not `<a>`), so the `body { color: #020617 }` inheritance issue from `buttons.md` §1.1 does not apply.

### Clear cascade (full state reset)

When either Clear All is clicked, the following resets in order:

| Layer                       | What resets                                                         |
| --------------------------- | ------------------------------------------------------------------- |
| **DescribeYourImage**       | `inputText` → empty, `hasGenerated` → false, `formatWarning` → none |
| **Category dropdowns**      | All 12 categories → `{ selected: [], customValue: '' }`             |
| **AI Disguise (workspace)** | `humanText` → empty, `aiTierPrompts` → null, drift synced           |
| **AI Optimisation**         | `clearAiOptimise()`, optimizer toggle OFF                           |
| **Scene/AR**                | `activeSceneId` → undefined, `aspectRatio` → null                   |
| **Explore drawer**          | `expandedExploreCategory` → null                                    |
| **Diff data**               | `diffData` → null                                                   |

### `clearSignal` mechanism

The footer Clear All cannot directly access DescribeYourImage's internal state (`inputText`, `hasGenerated`). Instead:

1. Footer `handleClear()` calls `setClearSignal(s => s + 1)`
2. DescribeYourImage has `useEffect` watching `clearSignal`
3. When `clearSignal` changes, it resets its own internal state + calls `onClear()`

This avoids lifting textarea state to the parent while still enabling full cascade from the footer.

---

## 8. Format Detection

**Function:** `detectPromptFormat()` in `describe-your-image.tsx`

Warns users who paste pre-formatted AI prompts instead of natural language descriptions. Only fires when input > 10 characters.

### Patterns detected

| Pattern             | Detection                                                   | Warning                                                           |
| ------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------- |
| CLIP-Based (Tier 1) | `(term::1.3)` or `term::1.3` or `(term:1.2)` — 2+ matches   | "This looks like a pre-formatted CLIP prompt with weight syntax." |
| Midjourney (Tier 2) | `--ar`, `--stylize`, `--v`, `--s`, `--q`, `--no` — 1+ match | "This looks like a Midjourney prompt with parameter flags."       |
| Generic weighted    | 3+ `::` occurrences                                         | "This looks like a weighted AI prompt."                           |

All warnings include: "The generator works best with plain English descriptions."

T3 (Natural Language) and T4 (Plain Language) inputs pass through without warnings — they're already natural language.

---

## 9. Drift Detection

**Hook:** `useDriftDetection` (`src/hooks/use-drift-detection.ts`, 165 lines)

After generation, if the user edits their text, the system tracks word-level changes using a bag-of-words symmetric difference. Zero API calls.

### Behaviour

| Change count | Visual                                                                                         |
| ------------ | ---------------------------------------------------------------------------------------------- |
| 0            | No indicator                                                                                   |
| 1–2          | DriftIndicator badge: "N changes detected"                                                     |
| ≥ 3          | Generate button text → "Regenerate", amber pulse animation (`dyi-regen`), DriftIndicator badge |

### Purpose

Implements the Zeigarnik Effect (`human-factors.md` §4) — the unfinished-task nag. Users who edit after generating feel compelled to regenerate, creating a loop of engagement.

---

## 10. AI Disguise Integration (Call 2)

DescribeYourImage sits inside `EnhancedEducationalPreview` which is orchestrated by `PlaygroundWorkspace`. When "Generate Prompt" is clicked:

1. `onGenerate(inputText)` fires → workspace triggers Call 2 (`generateTiers()`) in parallel
2. `convert(inputText)` fires → Call 1 (`/api/parse-sentence`) extracts categories
3. Both run simultaneously — user sees category badges populating (Call 1) and tier cards filling (Call 2)

The user never knows two API calls fired. The UX presents it as one seamless "analysis" operation.

See `ai-disguise.md` §5–§8 for Call 2 system prompt, post-processing, and harmony engineering details.

---

## 11. File Map

| File                         | Path                          | Lines | Purpose                                                                                             |
| ---------------------------- | ----------------------------- | ----- | --------------------------------------------------------------------------------------------------- |
| `describe-your-image.tsx`    | `src/components/providers/`   | 722   | UI component — textarea, Generate/Clear buttons, format detection, drift indicator, category badges |
| `parse-sentence/route.ts`    | `src/app/api/parse-sentence/` | 243   | Call 1 API route — GPT-5.4-mini categorisation, Zod validation, rate limiting                       |
| `use-sentence-conversion.ts` | `src/hooks/`                  | 260   | Term matching hook — exact→fuzzy→custom, pre-processing, CategoryState builder                      |
| `use-drift-detection.ts`     | `src/hooks/`                  | 165   | Drift detection — bag-of-words symmetric diff, zero API calls                                       |
| `drift-indicator.tsx`        | `src/components/prompt-lab/`  | 136   | "N changes detected" amber badge component                                                          |

---

## 12. Pro Gate

### Tier access

| Tier                           | Access        |
| ------------------------------ | ------------- |
| Anonymous (3 prompts/day)      | Not available |
| Signed-in free (5 prompts/day) | Not available |
| Pro (unlimited)                | Full access   |

**Current status:** NOT YET GATED. The Prompt Lab is accessible to all users during v1 stability testing. Gating implementation per `paid_tier.md` §5.13.

### Rationale

Per-use API cost (~$0.005 for Call 1 + Call 2 combined). Strongest conversion driver — free users see "Generate Prompt", try to click, see Pro gate.

---

## 13. Error Handling

### API failure

If Call 1 fails (timeout, rate limit, malformed response):

- Red error text: "Couldn't parse your description. Try again or use the dropdowns manually."
- Dropdowns are not populated with partial/broken data
- Error logged to console with `[parse-sentence]` prefix
- User can retry or use manual dropdown selection

### Malformed response

- Zod schema validation on response — any unexpected structure is rejected
- Each category array capped at 10 terms, each term capped at 100 chars
- Skip invalid categories, populate valid ones

### Empty categories

After generation, if 1–5 categories are empty, a hint appears:

> 💡 3 empty: Composition, Camera, Materials — add detail to boost your DNA score

---

## 14. Security & Cost Control

### Rate limiting

- 20 conversions per hour in production (per IP)
- 200 per hour in development
- Rate limit response: 429 with `Retry-After` header

### Input sanitisation

- HTML/script tags stripped: `.replace(/<[^>]*>/g, '')`
- Maximum 1,000 characters
- Empty/whitespace-only input rejected

### Prompt injection protection

- System prompt hardcoded server-side, never exposed to client
- User text sent as user message only
- Response validated against strict Zod schema
- Parsed terms go through the same vocabulary matching pipeline as manual selections

### Cost

- ~$0.002 per Call 1 invocation (GPT-5.4-mini)
- ~$0.003 per Call 2 invocation (fires in parallel)
- Total per generation: ~$0.005

---

## 15. Non-Regression Rules

1. **Call 1 parses only** — never optimises, reorders, or formats. One Brain handles assembly.
2. **Generate button must match engine bay styling exactly** — `dyi-generate-pulse` and `dyi-generate-shimmer` are copied from `engine-bay-pulse` and `engine-bay-shimmer-sweep`. Do not diverge.
3. **Clear All must cascade through ALL state** — textarea, 12 dropdowns, AI tiers, AI optimise, optimizer toggle, aspect ratio, scene, drift. Partial clear causes stale state bugs.
4. **Both Clear All buttons must be identical** — top (next to Generate) and footer. Same purple gradient, same white text, same full cascade.
5. **`clearSignal` must increment, not reset** — `setClearSignal(s => s + 1)` not `setClearSignal(1)`. The `useEffect` compares previous vs current.
6. **Format detection only fires above 10 chars** — prevents false positives on short input.
7. **Category badges use 150ms stagger** — `dyi-cat-badge` animation with `animation-delay` per index.
8. **Drift threshold for "Regenerate" is ≥ 3 word changes** — below 3 shows badge only, no button text change.
9. **All animations co-located in `DESCRIBE_STYLES`** — not in `globals.css`. Per `best-working-practice.md`.
10. **Textarea auto-focuses on expand** — 300ms delay for smooth CSS transition to complete first.

---

## 16. Future Extensions (Not In Scope)

### 16.1 Batch conversion

User uploads multiple sentences. Each is parsed and saved as a separate prompt in the library.

### 16.2 Conversation mode

Back-and-forth: "Make it more dramatic" → API adjusts categories → dropdowns update.

### 16.3 Image-to-sentence-to-prompt

User uploads reference image → vision API describes it → sentence conversion parses it → dropdowns populate.

### 16.4 Learning from corrections

When a user modifies parsed selections (e.g., moves "golden hour" from atmosphere to lighting), that correction feeds back into system prompt tuning.

---

## Changelog

| Date        | Version | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ----------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 23 Mar 2026 | 2.0.0   | **COMPLETE REWRITE — reflects actual built state.** Status changed from "Design approved — not yet built" to "BUILT and deployed". Owner corrected to "Promagen". API provider corrected from Claude API to GPT-5.4-mini (OpenAI). UI decision resolved: Option A (collapsible strip above dropdowns). Added §5 (DescribeYourImage component, 722 lines), §6 (engine bay Generate button styling with pulse + shimmer), §7 (Clear All full cascade reset with `clearSignal` mechanism), §8 (format detection for CLIP/MJ/weighted prompts), §9 (drift detection), §10 (AI Disguise Call 2 parallel firing). System prompt updated to match actual deployed `route.ts` (10 rules with thorough categorisation examples). Term matching documented with 3-step cascade (exact→fuzzy→custom) including number-aware Levenshtein guard. File map with actual line counts. Non-regression rules (10 rules). All original design sections (architecture, error handling, security, future extensions) updated to reflect built reality. |
| 20 Mar 2026 | 1.0.0   | Initial design document. Architecture, API spec, data flow, dropdown population logic, Pro gate, error handling, security, implementation plan. Pre-build, all theoretical.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

---

_End of document._
