# Harmonizing Claude ↔ OpenAI — System Prompt Engineering Playbook

**Version:** 1.0.0  
**Created:** 23 March 2026  
**Owner:** Promagen  
**Status:** Active — proven methodology, applied to Call 2 (generic tiers), ready to apply to Call 3 (platform-specific)  
**Authority:** This document defines the repeatable methodology for engineering system prompts where Claude writes the instructions and GPT-5.4-mini executes them, with both Claude and ChatGPT independently scoring output quality.

> **Cross-references:**
>
> - `ai-disguise.md` v3.0.0 — §6 (deployed system prompt), §7 (post-processing layer), §8 (harmony engineering summary)
> - `prompt-lab.md` v3.1.0 — Prompt Lab architecture, component table
> - `human-sentence-conversion.md` v2.0.0 — Call 1 (parse-sentence) specification
> - `code-standard.md` — All code standards

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [The Harmony Model](#2-the-harmony-model)
3. [Proven Patterns](#3-proven-patterns)
4. [Anti-Patterns](#4-anti-patterns)
5. [System Prompt Evolution — The 18 Rules](#5-system-prompt-evolution--the-18-rules)
6. [Post-Processing Layer](#6-post-processing-layer)
7. [Scoring Methodology](#7-scoring-methodology)
8. [Round-by-Round Journey](#8-round-by-round-journey)
9. [Applying to Call 3 — Platform-Specific Optimisation](#9-applying-to-call-3--platform-specific-optimisation)
10. [Decision Framework](#10-decision-framework)
11. [Non-Regression Rules](#11-non-regression-rules)

---

## 1. Purpose

Promagen uses a split-brain architecture where **Claude** (Anthropic) writes the system prompts and code, and **GPT-5.4-mini** (OpenAI) executes them at runtime to generate image prompts for 42 AI platforms. This creates a unique engineering challenge: the author of the instructions never sees them executed, and the executor never participated in designing them.

This document captures the repeatable methodology that took Call 2's generic tier output from **62/100 to 93/100** across 5 rounds of iterative refinement, with dual-assessor score convergence from a 20-point gap to a 1.75-point gap.

### Why this doc exists

Without it, the next developer (or future Martin) would have to rediscover through trial and error:

- Why concrete examples work and abstract rules don't
- Why instruction positioning matters (first and last bullets get attention)
- Why GPT finds synonyms for banned terms and how to counter it
- Why some artefacts are unfixable via prompt and need code-level safety nets
- Why temperature 0.5 is the right trade-off for this use case
- What the 18 rules do and why each one exists

This doc is also the **playbook for Call 3** — the same methodology applied to 42 platform-specific system prompts.

---

## 2. The Harmony Model

### Architecture

```
┌─────────────────────┐     writes      ┌─────────────────────┐
│                     │ ───────────────> │                     │
│  CLAUDE (Anthropic) │   system prompt  │  GPT-5.4-mini       │
│                     │                  │  (OpenAI)            │
│  Roles:             │                  │  Roles:              │
│  - System prompt    │     executes     │  - Reads prompt      │
│    author           │ <─────────────── │  - Generates 4 tier  │
│  - Code author      │   tier prompts   │    prompts per input │
│  - Assessor #1      │                  │                      │
│                     │                  │                      │
└─────────────────────┘                  └─────────────────────┘
         │                                         │
         │ scores output                           │ scores output
         ▼                                         ▼
┌─────────────────────┐                  ┌─────────────────────┐
│  CLAUDE assessment   │                  │  ChatGPT assessment  │
│  (this conversation) │                  │  (separate window)   │
│                      │                  │                      │
│  Structural scoring  │                  │  Structural scoring  │
│  per tier (0–100)    │                  │  per tier (0–100)    │
│                      │    converge?     │                      │
│  Bug identification  │ <──────────────> │  Bug identification  │
│  Improvement list    │                  │  Improvement list    │
└─────────────────────┘                  └─────────────────────┘
         │                                         │
         └──────────────── merge ──────────────────┘
                            │
                            ▼
                  ┌─────────────────────┐
                  │  UNIFIED FIX LIST   │
                  │  Bugs + improvements│
                  │  → Claude builds    │
                  │  → Cycle repeats    │
                  └─────────────────────┘
```

### The Cycle

1. **Claude writes/updates** the system prompt rules in `route.ts`
2. **Martin deploys** and runs the same test input through the Prompt Lab
3. **GPT-5.4-mini generates** 4 tier prompts from the test input
4. **Martin pastes** the output to both Claude (this conversation) and ChatGPT (separate window)
5. **Both assess independently** — structural scoring per tier (0–100), bug identification, improvement suggestions
6. **Martin shares** ChatGPT's assessment with Claude
7. **Claude analyses** agreement/disagreement, produces a unified fix list
8. **Martin approves** specific fixes to build
9. **Claude builds** the approved fixes
10. **Cycle repeats** from step 2

### Why dual assessment works

- **Claude knows the system prompt** — can trace output failures to specific rule gaps
- **ChatGPT doesn't know the system prompt** — grades raw output quality without bias toward the author's intentions
- **ChatGPT is grading its own work** — catches things it knows it should have done better
- **Score convergence** proves the output is objectively good, not just compliant with rules one assessor wrote

### Key insight: ChatGPT doesn't know about post-processing

ChatGPT grades raw GPT output. It doesn't know P1 (deduplication) and P2 (punctuation strip) exist. This means:

- ChatGPT's scores reflect the worst case the user could see (without safety nets)
- Claude's scores reflect what the user actually sees (after safety nets)
- The gap between them measures how much value the post-processing layer adds
- Keeping ChatGPT unaware maintains pressure to improve the raw output

---

## 3. Proven Patterns

### Pattern 1: Examples > Abstract Rules

**The most important finding.** GPT follows concrete WRONG/RIGHT examples far more reliably than abstract instructions.

| Abstract rule (weak)                            | Concrete example (strong)                                                                                                                | Fix ID |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| "Default to (term:weight) parenthetical syntax" | "Example: (lone mermaid:1.4), (coral reef:1.2). Do NOT use double-colon :: syntax unless a specific provider below requires it."         | B1     |
| "Negative via --no flag at end"                 | Full structural example: `lone mermaid::2.0 ... --ar 16:9 --v 7 --s 500 --no above water, murky, foggy, dark, text, watermark`           | S9     |
| "Place :: at end of clauses"                    | "WRONG: 'reef fish::1.4 in shimmering blues'. RIGHT: 'bright reef fish in shimmering blues and orange::1.4'"                             | B5     |
| "Don't compress to bare adjective lists"        | "WRONG: 'It is underwater, clear, and dreamlike.' RIGHT: 'The underwater scene glows with soft light and a calm, dreamlike atmosphere.'" | S17    |

**Why this works:** GPT is a pattern-matching engine. It can replicate a pattern it sees far more accurately than it can interpret an abstract rule and infer the correct pattern. Every major fix that produced a measurable score jump included a concrete example.

**Application to Call 3:** Every platform-specific instruction must include at least one complete example output, not just rules about format.

### Pattern 2: Instruction Positioning

GPT pays most attention to **the first and last instructions** in a section block. Middle instructions get progressively less attention as the block lengthens.

**Evidence:** The "NEVER DUPLICATE NEGATIVES" rule was placed in the middle of the T2 section (line 152) for two rounds. GPT duplicated negatives ~50% of the time. When moved to the absolute last position as "FINAL RULE FOR THIS TIER", duplication dropped (though P1 still catches residual cases).

**Application:**

- Put the most critical rule for each tier as the **first** bullet
- Put the most commonly violated rule as the **last** bullet
- Keep the middle for standard rules that GPT follows reliably

### Pattern 3: Banned-Phrase Expansion

GPT obeys the letter of a ban but finds synonyms for the spirit.

| Banned            | GPT's workaround        | Expanded ban            |
| ----------------- | ----------------------- | ----------------------- |
| "rendered as"     | "should feel like"      | Added to ban list (S14) |
| "in the style of" | "meant to look like"    | Added to ban list (S14) |
| —                 | "the image should"      | Added to ban list (S14) |
| —                 | "designed to resemble"  | Added to ban list (S14) |
| —                 | "intended to appear as" | Added to ban list (S14) |

**Current banned phrases for T3 (Natural Language):**
"rendered as", "in the style of", "should feel like", "meant to look like", "designed to resemble", "intended to appear as", "the image should"

**Application to Call 3:** When banning a pattern, immediately brainstorm 3–5 synonyms GPT might use and ban those too. It's cheaper to over-ban than to discover workarounds in production.

### Pattern 4: Belt and Braces

Some GPT mechanical artefacts **cannot be eliminated via system prompt**. They are model-level behaviours at the given temperature. The correct approach is two layers:

1. **System prompt rule** — reduces the error rate (e.g., from 100% to 50%)
2. **Post-processing code** — catches remaining errors server-side before the user sees them (reduces user-visible rate to 0%)

**Current belt-and-braces pairs:**

| Artefact                  | System prompt rule                                                | Post-processing catch                                                                      |
| ------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| T2 duplicate `--no` block | "FINAL RULE — NEVER DUPLICATE NEGATIVES" (last instruction in T2) | `deduplicateMjNegatives()` — splits on `--no`, deduplicates comma-separated terms, rejoins |
| T1 trailing period        | "NO sentence-ending punctuation"                                  | `stripTrailingPunctuation()` — regex strips trailing `.!?`                                 |

**Application to Call 3:** After the first round of testing, identify which errors persist despite rules. Build post-processing for those immediately — don't waste rounds trying to fix them via prompt alone.

### Pattern 5: Temperature Trade-offs

| Temperature    | Behaviour                                                                                                          | Trade-off                        |
| -------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------- |
| 0.3 (original) | T1/T2 syntax very reliable, T3 stays too close to input (paraphrasing)                                             | Safe but boring                  |
| 0.5 (current)  | T3 genuinely restructures, T1/T2 syntax still disciplined by strong rules, T2 occasionally duplicates `--no` block | Creative but needs P1 safety net |
| 0.7+           | Too creative — syntax rules break, weight hierarchy ignored                                                        | Not viable                       |

**Decision (D19):** 0.5 with P1 safety net. The creative T3 gain is worth the mechanical T2 artefact that P1 catches.

**Application to Call 3:** Call 3 optimises an existing prompt for a specific platform — it needs precision, not creativity. Keep Call 3 at temperature 0.2.

### Pattern 6: Value-Add Inversion

The original Rule 2 said: "Do NOT add visual elements not present or strongly implied in the input."

This produced paraphrased output that added zero expert value. The fix **inverted** the instruction:

"YOUR JOB IS TO ADD EXPERT PROMPT ENGINEERING VALUE. Every tier must contain at least one element the user did NOT provide. If you return something the user could have written themselves, you have failed."

**Impact:** T3 went from 58/100 (near-copy of input) to 95/100 (genuinely restructured with composition, style, and atmosphere additions).

**Application to Call 3:** The optimisation prompt must also be explicit that "making it shorter" is not enough — the AI must add platform-specific knowledge the user doesn't have.

---

## 4. Anti-Patterns

### Anti-Pattern 1: Trusting GPT to self-assess

ChatGPT gave itself 88/100 in Round 1 while Claude gave 62/100. The actual quality was closer to 62. GPT is generous when grading its own output.

**Mitigation:** Always use the external assessor (Claude) as the primary score, with ChatGPT's self-assessment as a secondary signal. When they diverge, investigate — the truth is usually closer to the harsher score.

### Anti-Pattern 2: Fixing prompt issues with more prompt

After 3 rounds, the system prompt had 18 rules. Adding more rules has diminishing returns — GPT's attention budget is finite. If a rule isn't working after 2 rounds of refinement, the fix is **post-processing code**, not a 19th rule.

**Threshold:** If GPT violates a rule >30% of the time after the rule has been strengthened with examples and repositioned, stop prompt-engineering and build a code-level catch.

### Anti-Pattern 3: Scoring before convergence

In Round 1, Claude scored T2 at 55 and ChatGPT scored it at 91. That 36-point gap meant neither score was reliable. Only after convergence (Round 5: gap = 3 points) could scores be trusted.

**Rule:** Don't make architectural decisions based on scores until dual-assessor gap is <10 points.

### Anti-Pattern 4: Optimising the wrong tier

T4 (Plain Language) dropped from 94 to 82 between rounds — not because of a rule problem, but because of GPT temperature variability on a simple output. Spending a round adding rules for T4 would have been wasted effort. The fix was a minimum-quality bar (10-word sentence rule with WRONG/RIGHT example) — 3 lines that directly addressed the failure mode.

**Rule:** Diagnose whether a score drop is a rule gap or GPT variability before building a fix.

---

## 5. System Prompt Evolution — The 18 Rules

### Rule Inventory (deployed in `route.ts` lines 117–199)

#### Tier-specific rules (embedded in tier sections)

| ID   | Tier | Rule                                                         | Round added              | Impact       |
| ---- | ---- | ------------------------------------------------------------ | ------------------------ | ------------ |
| T1-1 | T1   | Parenthetical syntax with concrete examples when no provider | R2 (B1)                  | +23 on T1    |
| T1-2 | T1   | Subject must carry highest weight                            | R2 (B3)                  | +5 on T1     |
| T1-3 | T1   | Never weight-wrap isolated colour words                      | R2 (S4)                  | +3 on T1     |
| T1-4 | T1   | CLIP interprets literally — no metaphorical language         | R3 (S10)                 | +3 on T1     |
| T1-5 | T1   | Mandatory composition/camera term                            | R2 (S1)                  | +8 on T1     |
| T1-6 | T1   | Strict ordering template                                     | R3 (S13)                 | +4 on T1     |
| T1-7 | T1   | No sentence-ending punctuation                               | R4 (B7)                  | Caught by P2 |
| T2-1 | T2   | Subject must carry highest :: weight                         | R2 (B3)                  | +30 on T2    |
| T2-2 | T2   | :: at end of complete clauses (WRONG/RIGHT)                  | R3 (B5)                  | +5 on T2     |
| T2-3 | T2   | --no flag mandatory (CRITICAL warning)                       | R3 (B4)                  | +30 on T2    |
| T2-4 | T2   | Scene-specific negatives, not boilerplate                    | R2 (S8)                  | +5 on T2     |
| T2-5 | T2   | Mandatory art style reference                                | R2 (S7)                  | +3 on T2     |
| T2-6 | T2   | Strict ordering template                                     | R3 (S13)                 | +5 on T2     |
| T2-7 | T2   | Structural example (full prompt)                             | R3 (S9)                  | +10 on T2    |
| T2-8 | T2   | FINAL RULE — never duplicate negatives                       | R4 (B6) + R5 positioning | Caught by P1 |
| T3-1 | T3   | Not a paraphraser — add expert value                         | R2 (S5)                  | +30 on T3    |
| T3-2 | T3   | Banned directive phrases (7 phrases)                         | R3 (S11) + R4 (S14)      | +7 on T3     |
| T3-3 | T3   | Mandatory composition + atmosphere additions                 | R2 (S1)                  | +5 on T3     |
| T3-4 | T3   | Style woven naturally, not as directive                      | R3 (S11)                 | +3 on T3     |
| T3-5 | T3   | Strict ordering template (2–4 sentences)                     | R3 (S13)                 | +3 on T3     |
| T4-1 | T4   | 2–3 sentences (relaxed from exactly 2)                       | R4 (S15)                 | +2 on T4     |
| T4-2 | T4   | Explicit primary setting                                     | R3 (S12)                 | +8 on T4     |
| T4-3 | T4   | 10-word sentence minimum (WRONG/RIGHT)                       | R5 (S17)                 | +11 on T4    |
| T4-4 | T4   | No meta-language                                             | R4 (S18)                 | +2 on T4     |

#### Global rules (Rules section, lines 179–191)

| #   | Rule                                                 | Purpose                                            |
| --- | ---------------------------------------------------- | -------------------------------------------------- |
| 1   | Preserve creative intent BUT restructure and enhance | Balance preservation with transformation           |
| 2   | Add expert prompt engineering value                  | Inverted from "don't add" (the biggest single fix) |
| 3   | Each tier must feel native to its platform family    | Prevents reformatting one tier into another        |
| 4   | T1: clean keyword assembly                           | No sentence fragments                              |
| 5   | T2: prose + mandatory --no flag                      | Reinforces T2-3                                    |
| 6   | T3: spatial flow + no meta-instructions              | Reinforces T3-2                                    |
| 7   | T4: short but complete + explicit setting            | Reinforces T4-2                                    |
| 8   | Scene-specific negatives + --no mandatory for T2     | Reinforces T2-3/T2-4                               |
| 9   | Weight hierarchy — subject highest                   | Reinforces T1-2/T2-1                               |
| 10  | Provider-specific syntax                             | The original fix (B1)                              |
| 11  | Quality suffix for T1                                | Standard CLIP anchors                              |
| 12  | Convert abstract emotions to visual equivalents      | "Beauty" → "ethereal light"                        |

---

## 6. Post-Processing Layer

**File:** `src/app/api/generate-tier-prompts/route.ts` (lines 202–258)

### Functions

| Function                     | Target                 | What it does                                                                     | Why needed                                                                                      |
| ---------------------------- | ---------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `deduplicateMjNegatives()`   | T2 positive            | Splits on `--no`, deduplicates comma-separated terms case-insensitively, rejoins | GPT duplicates `--no` block ~50% at temp 0.5. System prompt rule reduces but doesn't eliminate. |
| `stripTrailingPunctuation()` | T1 positive + negative | Regex strips trailing `.!?`                                                      | GPT adds periods despite B7 rule. CLIP prompts must not have sentence punctuation.              |
| `postProcessTiers()`         | All tiers              | Orchestrator: P1 on tier2, P2 on tier1, pass-through tier3/tier4                 | Single call point after Zod validation, before JSON response.                                   |

### Integration point

```typescript
// After Zod validation (line 387):
const processed = postProcessTiers(validated.data);
return NextResponse.json({ tiers: processed }, { ... });
```

### Non-regression rule

`postProcessTiers()` MUST run on all Call 2 responses. Do not bypass, remove, or make conditional. The post-processing is invisible to the user and costs zero latency (string operations only).

---

## 7. Scoring Methodology

### What we score

**Structural correctness of the generic 4-family output.** Not image quality, not aesthetic preference, not prompt effectiveness. Purely: does the output conform to the structural rules for its language family?

### Per-tier criteria

#### T1 (CLIP-Based)

| Criterion                                        | Weight | What "good" looks like                                                  |
| ------------------------------------------------ | ------ | ----------------------------------------------------------------------- |
| Correct syntax (parenthetical/provider-specific) | High   | `(lone mermaid:1.4)` not `lone mermaid::1.4`                            |
| Subject highest weight                           | High   | Subject at 1.4, nothing else higher                                     |
| Strict ordering                                  | Medium | Quality prefix → subject → environment → details → composition → suffix |
| Composition cue present                          | Medium | At least one term the user didn't provide                               |
| No metaphorical language                         | Medium | "Schools of fish" not "clouds of fish"                                  |
| Paired colour words                              | Low    | "Yellow reef fish" not standalone "yellows"                             |
| No trailing period                               | Low    | Caught by P2 if GPT violates                                            |

#### T2 (Midjourney Family)

| Criterion                 | Weight   | What "good" looks like                                       |
| ------------------------- | -------- | ------------------------------------------------------------ |
| `--no` flag present       | Critical | Without it, negatives become positive prompt — image damaged |
| Subject highest :: weight | High     | Subject at 2.0, nothing else higher                          |
| :: at end of clauses      | High     | Complete phrase before weight                                |
| Strict ordering           | High     | Subject → scene → style → params → --no last                 |
| Scene-specific negatives  | Medium   | Tailored to this scene, not boilerplate                      |
| Art style reference       | Medium   | Anchors aesthetic interpretation                             |
| No duplicate negatives    | Medium   | P1 catches if GPT duplicates                                 |

#### T3 (Natural Language)

| Criterion                   | Weight | What "good" looks like                                    |
| --------------------------- | ------ | --------------------------------------------------------- |
| Not a paraphrase            | High   | Noticeably different from input                           |
| No banned directive phrases | High   | Zero instances of "rendered as", "should feel like", etc. |
| Style woven naturally       | Medium | Part of description, not meta-instruction                 |
| Composition cue added       | Medium | Expert addition the user didn't provide                   |
| Atmospheric detail added    | Medium | Expert addition the user didn't provide                   |
| Sentence ordering           | Low    | Subject → elements → environment/atmosphere               |

#### T4 (Plain Language)

| Criterion                 | Weight | What "good" looks like                          |
| ------------------------- | ------ | ----------------------------------------------- |
| Explicit setting          | High   | "Underwater" not implied                        |
| 2–3 sentences             | Medium | Not 1, not 4+                                   |
| Every sentence ≥ 10 words | Medium | No bare adjective checklists                    |
| Simple vocabulary         | Medium | Non-expert friendly                             |
| No meta-language          | Low    | "Reef fish swim" not "reef fish fill the scene" |

### Scoring scale

- **90–100:** Structurally excellent. All rules followed. Minor aesthetic preferences only.
- **80–89:** Structurally good. 1–2 minor rule gaps. No critical errors.
- **70–79:** Structurally adequate. Some rules not followed. Room for improvement.
- **60–69:** Structurally weak. Multiple rules broken. Significant gaps.
- **Below 60:** Structurally broken. Critical errors (wrong syntax, missing `--no`, paraphrased output).

---

## 8. Round-by-Round Journey

### Round 1 — Baseline (62/100)

**System prompt:** 11 rules, vague language, no examples.

| Tier | Score | Key failure                                                                  |
| ---- | ----- | ---------------------------------------------------------------------------- |
| T1   | 62    | Wrong syntax (`::` instead of parenthetical), no composition, abstract terms |
| T2   | 55    | Missing `--no` flag, inverted weights (`quiet magic::2.0`), `--v 6` stale    |
| T3   | 58    | Near-copy of input, zero expert additions                                    |
| T4   | 72    | "Underwater" never stated, one sentence only                                 |

**Assessor gap:** 20+ points. ChatGPT gave itself 88.

### Round 2 — First fixes (78/100, +16)

**Fixes applied:** B1 (syntax example), B2 (`--v 7`), B3 (weight hierarchy), S1 (composition), S2 (value-add inversion), S3 (visual-emotional conversion), S4–S8.

| Tier | Score | Change | Key improvement                                  |
| ---- | ----- | ------ | ------------------------------------------------ |
| T1   | 85    | +23    | Syntax correct, composition present              |
| T2   | 58    | +3     | Weights fixed, still missing `--no`              |
| T3   | 88    | +30    | No longer paraphrased, style + composition added |
| T4   | 80    | +8     | Better detail, still no "underwater"             |

### Round 3 — Structural templates (91/100, +13)

**Fixes applied:** B4 (`--no` flag), B5 (`::` placement), S9 (structural example), S10 (literal language), S11 (style directive), S12 (explicit setting), S13 (ordering templates).

| Tier | Score | Change | Key improvement                             |
| ---- | ----- | ------ | ------------------------------------------- |
| T1   | 92    | +7     | Ordering template, no metaphors             |
| T2   | 88    | +30    | `--no` present, structural example followed |
| T3   | 91    | +3     | Style directive softer                      |
| T4   | 94    | +14    | "Underwater" explicit, 2 sentences          |

**Assessor gap:** 3 points. Converging.

### Round 4 — Post-processing + banned phrases (89/100, -2)

**Fixes applied:** S14 (banned phrases expanded), S15 (2–3 sentences), S16 (300 char target), P1 (deduplication), P2 (punctuation strip). Temperature 0.3→0.5, tokens 1500→2000.

| Tier | Score | Change | Key improvement                                                 |
| ---- | ----- | ------ | --------------------------------------------------------------- |
| T1   | 95    | +3     | Steady                                                          |
| T2   | 85    | -3     | Duplicate persists, P1 catches it                               |
| T3   | 94    | +3     | Zero banned phrases — S14 working                               |
| T4   | 82    | -12    | GPT variability dip ("It is underwater, clear, and dreamlike.") |

**T4 regression:** Same rules, worse execution. Diagnosed as temperature variability, not rule gap.

### Round 5 — Final polish (93/100, +4)

**Fixes applied:** T2 FINAL RULE repositioning, S17 (10-word minimum with WRONG/RIGHT example).

| Tier | Score | Change | Key improvement                        |
| ---- | ----- | ------ | -------------------------------------- |
| T1   | 96    | +1     | Plateau                                |
| T2   | 88    | +3     | Better weight hierarchy (4 levels)     |
| T3   | 95    | +1     | Cleanest output — no directives at all |
| T4   | 93    | +11    | 10-word rule fixed the regression      |

**Assessor gap:** 1.75 points. **Converged.**

### Score trajectory

```
100 ┤
 95 ┤                              ●────●  T1
 90 ┤                    ●────●────●────●  T3
 85 ┤              ●                 ●──●  T2 (P1 catches dupes)
 80 ┤        ●     │           ●
 75 ┤        │     │                 ●──●  T4
 70 ┤   ●    │     │
 65 ┤   │    │     │
 60 ┤   ●────●     │
 55 ┤   ●          ●
    └──R1───R2───R3───R4───R5──────────
```

---

## 9. Applying to Call 3 — Platform-Specific Optimisation

Call 3 (`POST /api/optimise-prompt`) takes an assembled prompt + provider context and returns a platform-optimised version. The same harmony methodology applies with these adjustments:

### Differences from Call 2

| Aspect          | Call 2 (generic tiers)                 | Call 3 (platform-specific)                     |
| --------------- | -------------------------------------- | ---------------------------------------------- |
| Input           | Human text (creative, variable length) | Assembled prompt (structured, predictable)     |
| Output          | 4 tier prompts (4 families)            | 1 optimised prompt (1 specific platform)       |
| Temperature     | 0.5 (creative restructuring)           | 0.2 (precision, deterministic feel)            |
| System prompt   | 18 rules for 4 families                | Per-platform rules (~5–10 per platform)        |
| Post-processing | P1 + P2                                | TBD — build after Round 1 identifies artefacts |
| Test matrix     | 1 input × 4 outputs                    | 1 input × 42 platforms                         |

### Recommended approach

1. **Start with 5 representative platforms** (one per tier + edge case): Leonardo (T1/CLIP), Midjourney (T2/MJ), DALL-E 3 (T3/NL), Canva (T4/Plain), Flux (T1/different encoder)
2. **Write initial platform-specific system prompt** using Pattern 1 (concrete examples for each platform)
3. **Run Round 1** — test with the mermaid scene (proven rich test input)
4. **Score with dual assessment** — same methodology as Call 2
5. **Build fixes** — apply proven patterns (examples, positioning, banned phrases)
6. **Build post-processing** — whatever artefacts GPT produces that can't be prompt-fixed
7. **Expand to all 42** once the 5-platform template is stable

### What to carry forward from Call 2

- Every per-platform example MUST include a complete output (Pattern 1)
- Critical rules go first and last in each platform section (Pattern 2)
- Ban directive language preemptively with 5+ synonyms (Pattern 3)
- Budget 2 rounds for post-processing discovery (Pattern 4)
- Keep Call 3 at temperature 0.2 — precision over creativity (Pattern 5)

---

## 10. Decision Framework

### When to add a system prompt rule

- GPT produces the wrong output AND the rule would fix it for >70% of cases
- The rule can be expressed as a concrete WRONG/RIGHT example
- The rule doesn't conflict with existing rules

### When to build post-processing instead

- GPT violates the rule >30% of the time despite examples and repositioning
- The artefact is mechanical (duplication, punctuation) not semantic
- A 5-line string operation catches it reliably

### When to adjust temperature

- Increase: if output is too conservative/paraphrased (T3 was)
- Decrease: if syntax/structural rules are being violated (Call 3 should be 0.2)
- Never above 0.5 for structured output with syntax requirements

### When to stop iterating

- Dual-assessor gap < 5 points for 2 consecutive rounds
- Average score > 90
- Remaining improvements are aesthetic, not structural
- The next meaningful jump requires a different approach (platform-specific)

---

## 11. Non-Regression Rules

1. **This methodology is the standard for all GPT system prompt work** — Call 3, future Call 2 updates, any new API routes that use GPT
2. **Dual assessment is mandatory** — never ship a system prompt change without testing through both Claude and ChatGPT
3. **Post-processing cannot be removed** — even if GPT appears to stop producing artefacts, the safety net costs nothing and catches edge cases
4. **Temperature must be documented and justified** — every API route must record its temperature and the rationale in the route file header
5. **Concrete examples in every system prompt** — no rule without a WRONG/RIGHT pair or a structural example
6. **Martin approves all changes before implementation** — ideas are proposed, not built. "Put it forward but don't implement it until I say so."

---

## Changelog

- **23 Mar 2026 (v1.0.0):** Initial document. Captures the complete methodology from 5 rounds of Call 2 harmony engineering (62→93/100). Documents all 6 proven patterns, 4 anti-patterns, the 18-rule system prompt inventory, the post-processing layer, scoring methodology with per-tier criteria, the round-by-round journey with score trajectory, and the application playbook for Call 3 platform-specific optimisation.

---

_End of document._
