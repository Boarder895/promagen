# API Call 3 — Prompt Optimisation System

> **Authority document** — Governs the Call 3 optimisation pipeline end-to-end.
> Version 3.0.0 — 1 Apr 2026
> SSOT: `src.zip` — always believe the code over this doc if they conflict.

---

## 1. What Call 3 Does

Call 3 takes a tier prompt (from Call 2) and optimises it for a specific platform. The user has already selected a provider. Call 3 restructures the prompt to match that platform's syntax, length preferences, and capabilities.

Call 1 parses the sentence. Call 2 generates 4 tier prompts (no provider selected). Call 3 refines for the chosen provider.

**v3.0.0 architectural change:** Call 3 is now a hybrid system — algorithms first, GPT second, validation last. 62% of platforms (25/40) use deterministic code-only paths with zero OpenAI cost. The remaining 15 platforms call GPT but are protected by an 8-check regression guard that rejects output worse than the input.

---

## 2. The Preflight Decision Engine

Before any optimisation runs, the preflight engine (`src/lib/optimise-prompts/preflight.ts`) decides the optimisation strategy. This runs BEFORE GPT is considered.

### 2.1 call3Mode — Per-Platform Config

Every platform has a `call3Mode` field in `platform-config.json`. This is the primary routing signal.

| Mode               | Count | What happens                                  | OpenAI cost |
| ------------------ | ----- | --------------------------------------------- | ----------- |
| `reorder_only`     | 11    | Deterministic subject-front-load, no GPT      | Zero        |
| `mj_deterministic` | 1     | Midjourney clause parser + normaliser, no GPT | Zero        |
| `format_only`      | 13    | Group compliance gate cleanup only, no GPT    | Zero        |
| `gpt_rewrite`      | 15    | Full GPT path with regression guard           | API call    |
| `pass_through`     | 0     | Return assembled prompt unchanged             | Zero        |

### 2.2 Platform Assignments (v3.0.0)

**reorder_only (11):** artguru, artistly, bluewillow, clipdrop, craiyon, hotpot, jasper-art, microsoft-designer, photoleap, picsart, picwish

All Tier 4 NL platforms. Plain-language, no special syntax, no weighting. Subject front-loading is the only safe deterministic improvement.

**mj_deterministic (1):** midjourney

Tier 2. Uses `::weight` clause syntax, `--param` flags, `--no` negatives. Deterministic parse/validate/normalise handles structure; GPT only called if structure is broken.

**format_only (13):** dreamlike, dreamstudio, fotor, imagine-meta, leonardo, lexica, myedit, novelai, pixlr, simplified, stability, visme, vistacreate

7 Tier 1 CLIP platforms (weighted keyword syntax — GPT rewriting keywords causes more harm than good) + 6 Tier 3 platforms where testing proved GPT added no value (verb swaps, invented content, exceeded idealMax).

**gpt_rewrite (15):** 123rf, adobe-firefly, artbreeder, bing, canva, deepai, flux, google-imagen, ideogram, kling, luma-ai, openai, playground, recraft, runway

Tier 3 platforms where GPT restructuring may add value (wider char ranges, richer prose support, video platforms). All protected by the regression guard.

### 2.3 Decision Flow

```
call3Mode from config
        │
        ├── pass_through ────────→ PASS_THROUGH (return unchanged)
        │
        ├── reorder_only ────────→ subject already leading? → PASS_THROUGH
        │                          subject can be moved?    → REORDER_ONLY
        │                          not confident?           → PASS_THROUGH (not GPT)
        │
        ├── format_only ─────────→ FORMAT_ONLY (compliance gate only)
        │
        ├── mj_deterministic ────→ parse + validate structure
        │                          valid?   → MJ_DETERMINISTIC_ONLY
        │                          broken?  → GPT_REWRITE (fallback)
        │
        └── gpt_rewrite ─────────→ exceeds maxChars? → COMPRESS_ONLY
                                   otherwise         → GPT_REWRITE
```

The key safety principle: **low confidence degrades to preservation, not invention.** If the deterministic transform isn't confident, the prompt is returned unchanged — never routed to GPT as a fallback for `reorder_only` or `format_only` platforms.

---

## 3. The Deterministic Transforms

### 3.1 Subject-Front-Loader (`reorderSubjectFirst`)

Moves the primary subject to word 1 of sentence 1. Pattern A only — opener moves to end, subject+rest moves to front. No internal restructuring, no verb changes, no invented framing.

**Opener detection** — two categories:

Single-word (24): at, in, on, beneath, below, under, above, over, beyond, behind, before, across, along, between, among, amid, inside, outside, within, through, near, beside, against, during

Two-word compound (12 families with validated second tokens):

- Depth: `deep in/within/beneath/below/under/among/amid`, `far above/beyond/below/across`, `high above/on/over/atop`, `low beneath/below/in`
- Cover: `half hidden/buried/submerged/obscured/covered/lost`
- Participial: `surrounded by`, `bathed in/beneath/under`, `lost in/among/beneath`, `hidden in/beneath/behind/among`, `perched on/atop/above`, `nestled among/in/between`, `silhouetted against/beneath/before`

**False positive prevention:** "Deep green water" → "green" not in Deep's valid second-word set → null → PASS_THROUGH. Single-word "deep" alone is never treated as an opener.

**Smart placement:** The opener inserts after the subject+verb+object, before the first clause-break comma (participial: holding/carrying/casting, possessive: her/his/their, prepositional: with/as/while). If no clause break found, falls back to end-append.

Example:

- Input: `Deep in a cedar forest at moonlight, a young woman kneels before a weathered fox shrine, her paper lantern casting amber light on stone.`
- Output: `A young woman kneels before a weathered fox shrine deep in a cedar forest at moonlight, her paper lantern casting amber light on stone.`

**Safety rules:**

- Only operates on sentence 1
- Requires article-led subject (a/an/the/one)
- Rejects prompts with weight syntax (`::`, `(term:1.3)`, `--flags`)
- Rejects multi-subject before main verb ("a fox and a priest")
- Returns null if not confident → caller falls through to PASS_THROUGH

### 3.2 Midjourney Deterministic Transformer (`midjourney-deterministic.ts`)

Parses Midjourney prompts into structural units, validates, and normalises. Does NOT change prose or weights — structure only.

**Parser (`parseMjPrompt`):**

- Splits prompt into prose section + parameter section at the first `--` boundary
- Converts leaked parenthetical weights `(term:1.3)` to `::` format when clean; flags mixed syntax for GPT fallback
- Parses weighted clauses from `::weight` patterns
- Extracts `--ar`, `--v`, `--s` (keeps last on duplicates), merges and deduplicates `--no` blocks

**Validator (`validateMjStructure`):**

- Hard fail: fewer than 2 or more than 6 weighted clauses
- Hard fail: empty clause prose or clause prose under 3 words
- Hard fail: first clause weight is not the highest
- Hard fail: weights not in descending order
- Hard fail: missing `--ar`
- Hard fail: mixed parenthetical + `::` syntax
- Soft warn: clause prose under 5 words (acceptable but thin)

**Normaliser (`normaliseMjPrompt`):**

- Rebuilds clauses with consistent formatting
- Applies defaults for missing params (`--ar 16:9 --v 7 --s 500`)
- Enforces parameter order: `--ar --v --s --no` (always last)
- Ensures generic quality floor in `--no` (blurry, text, watermark)
- Deduplicates `--no` terms
- Strips residual parenthetical weights from clause prose

### 3.3 Anchor Extraction (`extractAnchors`)

Lightweight anchor manifest extracted from the assembled prompt. Used by the decision engine and the regression guard.

Extracts: subject phrase + position, named colours, light source descriptions, environment/setting nouns, action verbs, total anchor count, whether subject is already front-loaded.

---

## 4. The Three Numbers

Every platform has three character values in `platform-config.json`.

| Field      | Purpose                                                            | Who uses it                                  | Shown to GPT? |
| ---------- | ------------------------------------------------------------------ | -------------------------------------------- | ------------- |
| `idealMin` | Quality floor — prompts shorter than this produce poor images      | Route zone logic (ENRICH detection)          | **NO**        |
| `idealMax` | Quality ceiling — optimal range upper bound                        | Call 2 + standard builder only               | **NO**        |
| `maxChars` | Platform hard limit — the platform rejects or truncates above this | GPT (system prompt) + compliance gate (code) | **YES**       |

### 4.1 maxChars Capping Rule

14 platforms had `maxChars > idealMax × 2.5`. These are capped to prevent GPT filling headroom with padding.

**Rule:** If `maxChars > idealMax × 2.5`, set `maxChars = idealMax × 2.5`.

| Platform      | idealMax | Old maxChars | New maxChars |
| ------------- | -------- | ------------ | ------------ |
| bluewillow    | 200      | 6000         | 500          |
| craiyon       | 150      | 500          | 375          |
| dreamlike     | 350      | 1000         | 875          |
| dreamstudio   | 350      | 2000         | 875          |
| flux          | 500      | 2000         | 1250         |
| google-imagen | 350      | 1024         | 875          |
| kling         | 350      | 2500         | 875          |
| lexica        | 350      | 1000         | 875          |
| luma-ai       | 350      | 5000         | 875          |
| midjourney    | 400      | 6000         | 1000         |
| novelai       | 400      | 2000         | 1000         |
| openai        | 400      | 4000         | 1000         |
| recraft       | 400      | 1500         | 1000         |
| stability     | 350      | 2000         | 875          |

---

## 5. The Zone System (GPT path only)

The route computes a zone from the assembled prompt length and config numbers. Only used on the GPT path (15 platforms). Injected into the **user message**, not the system prompt.

```
0 ──── idealMin ──── maxChars ────→
   ENRICH       REFINE       COMPRESS
```

| Zone     | Condition                          | Strategy                                                    |
| -------- | ---------------------------------- | ----------------------------------------------------------- |
| ENRICH   | promptLength < idealMin            | Room to add detail                                          |
| REFINE   | idealMin ≤ promptLength ≤ maxChars | Restructure, front-load, tighten — length may go up or down |
| COMPRESS | promptLength > maxChars            | Must fit within platform limit                              |

GPT sees: `Platform: {name}. Reference draft: {length} chars. Platform limit: {maxChars} chars. Strategy: {ZONE} — {description}`

No `idealMin`, `idealMax`, or target range is ever shown to GPT.

---

## 6. Length Discipline — What GPT Sees

### 6.1 System Prompt (in every builder)

```
LENGTH RULES:
HARD: Do not shorten any prompt that is below {maxChars} characters.
SOFT: You may lengthen the prompt up to {maxChars} characters, but only if the added content is a genuine visual anchor — not filler.
Your job is to produce the best possible prompt for this platform. Length is not a goal. Anchor preservation is.
```

### 6.2 What GPT Does NOT See

No `idealMin`, no `idealMax`, no character range, no sweet spot, no target count.

### 6.3 Why This Works

GPT treats any character range as a target and compresses to hit it. With the new rules, GPT sees only "don't shorten below {maxChars}" — no number pulling it down. The zone block says "REFINE — restructure" not "REFINE — compress to range."

---

## 7. The Regression Guard (`regression-guard.ts`)

Runs AFTER GPT and all compliance gates, BEFORE returning to the user. Compares GPT's output against the assembled input on 8 structural metrics. If regression is detected, GPT's output is discarded and the assembled prompt is returned.

### 7.1 The Eight Checks

| #   | Check                   | What it detects                                                     | Which tiers |
| --- | ----------------------- | ------------------------------------------------------------------- | ----------- |
| 1   | Dropped anchors         | Colours, light sources, env nouns in input missing from output      | All         |
| 2   | Invented content        | Style labels (20), framing cues (16), invented anchors not in input | All         |
| 3   | Verb substitution       | Verbs both dropped AND replaced (not just lost)                     | T2/T3/T4    |
| 4   | Sentence count drift    | 3 sentences merged into 1 run-on                                    | T3/T4       |
| 5   | Weight regression       | Fewer `::weight` clauses in output than input                       | T1/T2       |
| 6   | Composition scaffolding | "In the foreground... in the background" filler sentences           | T3/T4       |
| 7   | Textbook language       | "Creates a sense of depth", "for dramatic impact"                   | T3/T4       |
| 8   | Redundant phrases       | Same 3+ word phrase repeated where input didn't repeat it           | T3/T4       |

### 7.2 Tier-Specific Thresholds

| Option                      | T1 (CLIP) | T2 (MJ) | T3 (NL) | T4 (Plain) |
| --------------------------- | --------- | ------- | ------- | ---------- |
| Check sentence count        | No        | No      | Yes     | Yes        |
| Check verbs                 | No        | Yes     | Yes     | Yes        |
| Verb substitution hard fail | No        | No      | No      | **Yes**    |
| Max invented items          | 3         | 2       | 2       | 1          |
| Max dropped anchors         | 1         | 1       | 2       | 1          |
| Check prose quality         | No        | No      | Yes     | Yes        |
| Max textbook score          | —         | —       | 3pts    | 2pts       |

### 7.3 Prose Quality Detectors (Checks 6, 7, 8)

**Composition scaffolding (Check 6):**

- Dictionary of 20 composition scaffold phrases
- Hard fail: "in the foreground" + "in the background/midground" in the same sentence, OR 2+ scaffold phrases in one sentence
- Soft fail: 2+ phrases invented across the output
- Delta-based: only flags phrases in output not in input

**Textbook language (Check 7):**

- Split into hard bucket (15 phrases — almost always filler: "creates a sense of", "draws the viewer", "for dramatic impact") and soft bucket (16 phrases — occasionally legitimate: "complementing the", "contrasting sharply with")
- Cumulative scoring: hard phrase = 2pts, soft phrase = 1pt
- T4 fails at 2+ points (any single hard phrase). T3 fails at 3+ points.

**Redundant phrases (Check 8):**

- Extracts 3-grams, 4-grams, 5-grams from output
- Token-based overlap collapse: longest match kept, shorter contiguous subsequences suppressed
- Ignore list prevents double-penalty with composition detector
- Any new redundant phrase = fail (on tiers that check prose)

### 7.4 Prose Quality Diagnostics

`ProseQualityFindings` is always populated on the regression result, even when the output passes. Contains: composition findings with sentence context, textbook hard/soft findings, redundant phrases, cumulative scores. Logged to server console for threshold tuning.

### 7.5 Lightweight MJ Regression Check

Separate from the full guard. Runs on the MJ deterministic fast path only. Checks: clause count preserved, weights present, `--ar` present, `--no` has content, no parenthetical syntax leaked. Does NOT check prose quality or invented content — deterministic transforms don't invent.

---

## 8. Architecture — GPT's Job vs Gate's Job vs Guard's Job

### Preflight's Job (pure code, runs first)

- Decide whether GPT is needed at all
- Extract anchor manifest from assembled prompt
- Run deterministic transform if applicable (reorder, MJ normalise, format gate)
- Return result without calling GPT for 25/40 platforms

### GPT's Job (via system prompt + user message, 15 platforms only)

- Restructure prompt for the platform's syntax and style
- Front-load the primary subject
- Preserve every visual anchor
- Follow zone direction (ENRICH / REFINE / COMPRESS)
- Return valid JSON

### Gate's Job (compliance function in code, runs after GPT)

- Strip unsupported syntax GPT missed
- Detect negative contradiction (positive+negative overlap)
- Enforce `maxChars` hard limit
- Log diagnostics

### Guard's Job (regression check, runs last on GPT path)

- Compare GPT output against assembled input on 8 metrics
- Reject GPT output if it regressed
- Return assembled prompt with compliance cleanup if rejected
- Always populate prose quality diagnostics for tuning

---

## 9. Request Flow — Step by Step

### Step 1: User clicks "Optimise Prompt"

Frontend hook `useAiOptimisation` fires. Algorithm cycling animation starts (165 algorithm names, landing count 131–165). POST to `/api/optimise-prompt`.

### Step 2: Route validates and rate-limits

Zod schema validates request body including `call3Mode`. Rate limit: 30/hour production, 200/hour dev.

### Step 3: Preflight decision

Route extracts `call3Mode` from `providerContext`, runs `analyseOptimisationNeed()`.

### Step 4a: Deterministic fast path (25 platforms)

If decision is `PASS_THROUGH`, `REORDER_ONLY`, `FORMAT_ONLY`, or `MJ_DETERMINISTIC_ONLY`:

- Run the appropriate deterministic transform
- Run group compliance gate (syntax cleanup, maxChars enforcement)
- For MJ: run lightweight regression check
- Return result. **GPT never called. Zero OpenAI cost.**

### Step 4b: GPT path (15 platforms)

If decision is `GPT_REWRITE` or `COMPRESS_ONLY`:

1. Compute zone from prompt length + config
2. Build system prompt via `resolveGroupPrompt()`
3. Build user message with zone block
4. Call OpenAI (`gpt-5.4-mini`, temp 0.4 prose / 0.2 CLIP, 1200 max tokens, json_object)
5. Parse and validate response

### Step 5: Compliance pipeline (GPT path only)

```
Step 1:   Group compliance gate (syntax cleanup, maxChars enforcement)
Step 1.5: Negative contradiction guard (positive+negative overlap)
Step 2:   Generic syntax enforcement (unknown platforms only)
Step 2.5: T2 weight validator (hard reject on total weight loss)
Step 3:   Regression guard (8 checks — no worse than input)
          → Prose quality diagnostics logged
```

If regression guard fails: GPT output discarded, assembled prompt returned with compliance cleanup.

### Step 6: Return result

Server-side `charCount` override. Return JSON with `result` object.

---

## 10. Frontend Plumbing

### 10.1 call3Mode Flow

```
platform-config.json → platform-config.ts adapter → getPlatformFormat()
    → enhanced-educational-preview.tsx (aiOptimiseContext)
    → POST request body (providerContext.call3Mode)
    → route.ts (parsed.data.providerContext.call3Mode ?? 'gpt_rewrite')
```

If `call3Mode` is missing from the request, the route defaults to `gpt_rewrite`. This was the source of a critical bug (v2.0.0 → v3.0.0): the frontend context builder was not passing `call3Mode` through, causing all 40 platforms to silently fall back to GPT.

### 10.2 T4 NL Input Swap

For NL platforms viewing Tier 4, the frontend sends T3 tier text as `promptText` — T3 is richer prose, giving GPT better material.

**Exception:** `reorder_only`, `pass_through`, and `format_only` modes always send the displayed T4 text. The user expects the optimised output to be a rearrangement of what they see, not a different text entirely. This was the source of a second bug where Artistly's deterministic reorder was operating on hidden T3 text while the UI showed T4.

### 10.3 Header Relabelling

When Call 3 returns the assembled prompt unchanged (`isOptimisedButUnchanged`), the UI:

- Changes header from "Assembled prompt for [platform]" to "Optimised prompt for [platform]" in emerald text
- Shows "Already optimised — no changes needed for [platform]" with change chips
- Uses the language "the Algorithms declared the assembled prompt to also be the Optimised Prompt" — no user-facing references to GPT or AI

### 10.4 Algorithm Cycling Animation

165 algorithm names across 8 categories cycle during optimisation. Landing count: 131–165 (randomised). Names include preflight decision engine terms, anchor preservation terms, and regression guard terms — reflecting the actual engine's work.

---

## 11. File Map

| File                                                      | Purpose                                                        |
| --------------------------------------------------------- | -------------------------------------------------------------- |
| `src/app/api/optimise-prompt/route.ts`                    | Call 3 route — preflight, GPT, compliance pipeline             |
| `src/lib/optimise-prompts/preflight.ts`                   | Decision engine + anchor extraction + deterministic reorder    |
| `src/lib/optimise-prompts/midjourney-deterministic.ts`    | MJ parser, validator, normaliser                               |
| `src/lib/optimise-prompts/regression-guard.ts`            | 8-check regression guard + prose quality detectors             |
| `src/lib/optimise-prompts/resolve-group-prompt.ts`        | Routes provider → builder                                      |
| `src/lib/optimise-prompts/platform-groups.ts`             | Provider → group mapping                                       |
| `src/lib/optimise-prompts/group-*.ts`                     | Per-platform builder files (system prompts + compliance gates) |
| `src/lib/harmony-compliance.ts`                           | Generic compliance gates                                       |
| `src/data/providers/platform-config.json`                 | SSOT for all platform config including call3Mode               |
| `src/data/providers/platform-config.ts`                   | TS adapter                                                     |
| `src/data/algorithm-names.ts`                             | 165 cycling algorithm names                                    |
| `src/components/prompts/enhanced-educational-preview.tsx` | Frontend context builder + optimise trigger                    |
| `src/hooks/use-ai-optimisation.ts`                        | Call 3 hook with animation                                     |
| `src/types/prompt-builder.ts`                             | PlatformFormat type with call3Mode                             |

---

## 12. Action Plan — Getting All 40 Platforms Performing Better When Optimised

### 12.1 Completed (v3.0.0)

- Preflight decision engine — routes 25/40 platforms to deterministic paths
- Deterministic subject-front-loader with widened opener patterns (36+ patterns, smart placement)
- Midjourney deterministic parser/validator/normaliser
- 8-check regression guard with prose quality detectors
- T4 verb substitution hard fail
- Hard/soft textbook bucketing with cumulative scoring
- Token-based n-gram collapse for redundant phrase detection
- T3 swap fix — deterministic modes always use displayed text
- call3Mode plumbing fix — flows end-to-end from config to API
- Algorithm cycling names updated (131→165, reflecting real engine work)
- 5 shortlist platforms tested and moved to format_only (imagine-meta, simplified, myedit, vistacreate, visme)

### 12.2 Next: Fix the comma-less clause boundary limitation

The deterministic reorder misplaces the opener when there's no comma before `as/while/where`. Example: "A keeper grips the railing as waves explode below at twilight on a lighthouse deck" — the opener lands at the end instead of before "as". Fix: detect bare `as/while/where` after verb phrases as clause boundaries. Risk: higher false positive chance than comma-based detection. Test thoroughly before shipping.

### 12.3 Next: Tighten the remaining 15 GPT builder system prompts

Adobe Firefly consistently generates composition scaffold sentences that the regression guard rejects. This means Call 3 adds zero value for Firefly — GPT runs, gets rejected, assembled prompt returns. Same API cost as a useful call but no benefit.

**Action:** For each of the 15 `gpt_rewrite` platforms, review the builder system prompt in OpenAI Playground (`gpt-5.4-mini`, json_object, reasoning effort medium). Score 95+ before deploying. Remove any instruction that tells GPT to add composition language. Emphasise restructuring and front-loading over enrichment.

**Priority order:** Adobe Firefly (known scaffold problem), Canva, Google Imagen, Recraft, OpenAI, then the rest.

### 12.4 Next: Promote or demote platforms by evidence

Run both test scenes (cyberpunk courier + fox shrine) through all 15 remaining `gpt_rewrite` platforms. For each:

- If the regression guard consistently rejects → move to `format_only`
- If GPT passes but output is mediocre → tighten the builder
- If GPT passes and improves → keep on `gpt_rewrite`

Target: reduce `gpt_rewrite` from 15 to under 10.

### 12.5 Next: Quality scoring engine

LLM-powered scoring that auto-fires post-optimisation. Disguised behind UI theatre (staged animations, non-round decimal scores, diagnostic-style language). Three improvement directives per prompt. Threshold rule: 90%+ prompts get minimal feedback. This validates whether Call 3 is making prompts better, platform by platform.

### 12.6 Next: Harmony pass

Platform-by-platform Call 3 system prompt verification. ChatGPT-verified in Playground before coding. Targeting 95+ score per builder. Working through all 15 remaining `gpt_rewrite` platforms.

### 12.7 Future: Explore skip Call 3 for CLIP platforms

CLIP platforms (T1) gain ~2pts from Call 3 (85→87). NL platforms gain ~6-8pts (88→94). Call 3 earns its cost only on NL platforms. The 7 T1 CLIP platforms are already on `format_only` — but the question is whether even the compliance gate adds value. If not, they could move to `pass_through` and save the route call entirely.

---

## 13. Bugs Found and Fixed (v2.0.0 → v3.0.0)

| Bug                                             | Root cause                                             | Impact                                                             | Fix                                                                              |
| ----------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| `call3Mode` not reaching API                    | Missing line in frontend context builder               | All 40 platforms silently fell back to `gpt_rewrite`               | Added `call3Mode: format.call3Mode` to context builder                           |
| T3 text sent to deterministic path              | T4 NL input swap fired for `reorder_only` platforms    | Deterministic reorder operated on hidden T3 text, not displayed T4 | Swap skipped for `reorder_only`, `pass_through`, `format_only` modes             |
| Generic `enforceT1Syntax` destroying MJ weights | `supportsWeighting` missing from midjourney config     | All `::weight` tokens stripped on every platform                   | Fixed config + tier-aware gate (generic only for unknown platforms)              |
| GPT compressing prompts to idealMax             | System prompt showed idealMin-idealMax range as target | Prompts compressed from 319 to 205 chars, losing anchors           | Removed all char ranges from GPT — hard rule "don't shorten below maxChars" only |

---

## 14. Changelog

| Version | Date        | Changes                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1.0.0   | 31 Mar 2026 | Initial authority doc. Wave 2 deployed.                                                                                                                                                                                                                                                                                                                                                                                                                |
| 2.0.0   | 31 Mar 2026 | Length discipline overhaul. Removed idealMin/idealMax from GPT. Capped maxChars for 14 platforms.                                                                                                                                                                                                                                                                                                                                                      |
| 3.0.0   | 1 Apr 2026  | **Hybrid engine rebuild.** Preflight decision engine. Deterministic transforms (subject-front-loader, MJ parser). 8-check regression guard with prose quality detectors. Widened opener patterns (36+). Smart opener placement. T4 verb hard fail. Hard/soft textbook bucketing. Token-based n-gram collapse. call3Mode plumbing fix. T3 swap fix. 25/40 platforms skip GPT (62%). Algorithm names updated (165). UI rebrand ("Algorithms" not "GPT"). |
