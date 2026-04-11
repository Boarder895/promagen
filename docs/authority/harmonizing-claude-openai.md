# Harmonizing Claude ↔ OpenAI — System Prompt Engineering Playbook

**Version:** 4.0.0  
**Created:** 23 March 2026  
**Updated:** 11 April 2026  
**Owner:** Promagen  
**Status:** Active — proven methodology, applied to Call 2 (v4.5 production-confirmed via three-assessor stress testing, 27/27 HEALTHY harness rules) and Call 3 (40 independent builder files, harmony pass in progress). Three-assessor scoring standard established (Claude, ChatGPT, Grok). Call 2 quality architecture now includes mechanical scorer, schema normaliser, deterministic post-processing (P14/P15/P16), and harness infrastructure (16 files, 41 scenes, 5 runs).  
**Authority:** This document defines the repeatable methodology for engineering system prompts where Claude writes the instructions and GPT-5.4-mini executes them, with Claude, ChatGPT, and Grok independently scoring output quality.

> **Cross-references:**
>
> - `ai-disguise.md` v5.0.0 — §6 (deployed system prompt SSoT reference), §7 (post-processing layer), §8 (harmony engineering summary)
> - `prompt-lab.md` v4.0.0 — Prompt Lab architecture, component table, negative prompt window
> - `prompt-optimizer.md` v6.0.0 — Call 3 architecture (40 independent builders, compliance gates, server-side charCount)
> - `prompt-lab-v4-flow.md` v2.0.0 — Call 2 v4.5 status, three-assessor methodology, GPT ceilings
> - `human-sentence-conversion.md` v2.0.0 — Call 1 (parse-sentence) specification
> - `platform-config.json` + `platform-config.ts` — Platform SSOT (40 platforms)
> - `call-2-quality-architecture-v0.3.1_1.md` — Harness architecture, route-stage model, mechanical scorer
> - `call-2-normalise-schema.ts` — Schema repair normaliser (pre-validation tier-shape fixer)
> - `code-standard.md` — All code standards

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [The Harmony Model](#2-the-harmony-model)
3. [Proven Patterns](#3-proven-patterns)
4. [Anti-Patterns](#4-anti-patterns)
5. [System Prompt Evolution — The 30 Rules](#5-system-prompt-evolution--the-30-rules)
6. [Post-Processing Layer](#6-post-processing-layer)
7. [Scoring Methodology](#7-scoring-methodology)
8. [Round-by-Round Journey](#8-round-by-round-journey)
9. [Call 2 v4.0→v4.5 Fix Programme](#9-call-2-v40v45-fix-programme)
10. [Call 3 — Platform-Specific Optimisation](#10-call-3--platform-specific-optimisation)
11. [Decision Framework](#11-decision-framework)
12. [Non-Regression Rules](#12-non-regression-rules)

---

## 1. Purpose

Promagen uses a split-brain architecture where **Claude** (Anthropic) writes the system prompts and code, and **GPT-5.4-mini** (OpenAI) executes them at runtime to generate image prompts for 40 AI platforms. This creates a unique engineering challenge: the author of the instructions never sees them executed, and the executor never participated in designing them.

This document captures the repeatable methodology that took Call 2's generic tier output from **62/100 to 96/100** across 6 rounds of iterative refinement + 3 stress tests (900-char complex inputs), with dual-assessor score convergence from a 20-point gap to a ≤1-point gap. The methodology was subsequently extended to a **three-assessor model** (Claude, ChatGPT, Grok) for the v4.0→v4.5 fix programme, and applied to Call 3 through 40 independent platform builder files.

### Why this doc exists

Without it, the next developer (or future Martin) would have to rediscover through trial and error:

- Why concrete examples work and abstract rules don't
- Why instruction positioning matters (first and last bullets get attention)
- Why GPT finds synonyms for banned terms and how to counter it
- Why GPT rotates nouns to dodge code-level catches and how lookup sets fix it
- Why some artefacts are unfixable via prompt and need code-level safety nets
- Why temperature 0.5 is the right trade-off for this use case
- What the 30 rules do and why each one exists
- Why the post-processing pipeline was extracted to a separate testable module
- Why measuring the rule matters more than measuring the model (Pattern 8)
- Why schema repair belongs in deterministic code, not prompt instructions

This doc is also the **playbook for Call 3** — the same methodology applied to 40 platform-specific system prompts (harmony pass in progress).

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

**v3.0.0 upgrade — three-assessor model:** For the v4.0→v4.5 fix programme, **Grok** was added as a third independent assessor. Three human test scenes (station violinist, Victorian flower seller, sci-fi hangar mechanic) were scored by all three assessors. This revealed a critical calibration finding: **Claude scores T3 approximately 5–6 points too high and T4 approximately 3–5 points too high** compared to the ChatGPT/Grok median. Claude under-penalises verb substitutions and anchor drops. The triangulated median across three assessors is now the standard for calibration. Dual assessment (Claude + ChatGPT) remains sufficient for individual builder harmony passes; three-assessor is used for system-wide calibration.

### Three-way build review (v4.0.0)

Distinct from the three-assessor _scoring_ methodology above. Every build deliverable now uses a three-way _review_ workflow:

1. **Claude proposes** the build (code, config, or fix)
2. **Martin sends to ChatGPT** for independent structural assessment
3. **Claude reviews ChatGPT's feedback** — accepts genuine structural corrections, explicitly rejects incorrect findings with stated reasoning — produces final agreed version

This was used for every build drop in the Call 2 harness session (P14/P15/P16, schema normaliser, four-zone scorer, cellist scene). ChatGPT's structural observations are taken seriously even when absolute scores differ from Claude's.

### Key insight: ChatGPT doesn't know about post-processing

ChatGPT grades raw GPT output. It doesn't know post-processing exists (8 processing functions + `postProcessTiers()` orchestrator = 9 exported functions in Call 2's `harmony-post-processing.ts` at 624 lines; 7 processing functions + `postProcessTiers()` orchestrator = 8 exported functions in Call 3's separate `harmony-post-processing.ts` at 439 lines). This means:

- ChatGPT's scores reflect the worst case the user could see (without safety nets)
- Claude's scores reflect what the user actually sees (after safety nets)
- The gap between them measures how much value the post-processing layer adds
- Keeping ChatGPT unaware maintains pressure to improve the raw output
- The biggest persistent gap is T2: ChatGPT scores raw (with duplicated negatives) while Claude scores post-P1 (clean). This gap is ~2–3 points per round and is expected.

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

**Current banned phrases for T3 (Natural Language) — 11 phrases:**
"rendered as", "in the style of", "should feel like", "meant to look like", "designed to resemble", "intended to appear as", "the image should", "the scene feels", "the scene is", "the mood is", "that feels"

**v2.0.0 addition:** "that feels" added after R4 when GPT produced "a clarity that feels immense and resolute" — same meta-pattern as "the scene feels" with noun substitution.

**Application to Call 3:** When banning a pattern, immediately brainstorm 3–5 synonyms GPT might use and ban those too. It's cheaper to over-ban than to discover workarounds in production.

### Pattern 4: Belt and Braces

Some GPT mechanical artefacts **cannot be eliminated via system prompt**. They are model-level behaviours at the given temperature. The correct approach is two layers:

1. **System prompt rule** — reduces the error rate (e.g., from 100% to 50%)
2. **Post-processing code** — catches remaining errors server-side before the user sees them (reduces user-visible rate to 0%)

**Current belt-and-braces pairs (v4.0.0 — Call 2 only, 8 active):**

| Artefact                         | System prompt rule                          | Post-processing catch                                              | Added      |
| -------------------------------- | ------------------------------------------- | ------------------------------------------------------------------ | ---------- |
| T2 duplicate `--no` block        | "FINAL RULE — NEVER DUPLICATE NEGATIVES"    | P1 `deduplicateMjParams()` — deduplicates all MJ params            | R4         |
| T1 trailing period               | "NO sentence-ending punctuation"            | P2 `stripTrailingPunctuation()` — regex strips trailing `.!?`      | R4         |
| T4 self-correction hallucination | "NEVER include questions, self-corrections" | P3 `fixT4SelfCorrection()` — strips "? No, it is" patterns         | R2         |
| T4 meta-language openers         | "Do not use meta-language"                  | P8 `fixT4MetaOpeners()` — 23 abstract nouns × 21 meta verbs        | R2/ST2     |
| T4 short sentence checklists     | "Every sentence MUST be at least 10 words"  | P10 `mergeT4ShortSentences()` — em-dash merge into previous        | R3         |
| T1 over-long weight-wrap phrases | "CLIP weight-wrap: ≤4 words per group"      | P14 `enforceT1WeightWrap()` — 2-word-tail heuristic auto-split     | Harness v1 |
| T3 over-length output            | "280–420 characters"                        | P15 `enforceT3MaxLength()` — sentence/clause/whitespace truncation | Harness v1 |
| T4 over-length output            | "≤325 characters"                           | P16 `enforceT4MaxLength()` — sentence/comma/whitespace truncation  | Harness v1 |

**P11 `fixT3MetaOpeners()` and P12 `stripClipQualitativeAdjectives()` were removed from Call 2 on 28 Mar 2026** and now exist only in Call 3's separate `harmony-post-processing.ts` (439 lines, 8 exported functions).

**File:** Call 2 functions in `src/lib/harmony-post-processing.ts` (624 lines, 9 exported functions). Call 3 functions in `src/lib/optimise-prompts/harmony-post-processing.ts` (439 lines, 8 exported functions).

**Application to Call 3:** After the first round of testing, identify which errors persist despite rules. Build post-processing for those immediately — don't waste rounds trying to fix them via prompt alone. Call 3 now has its own 8-function post-processing pipeline.

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

### Pattern 7: Noun-Substitution Evasion (v2.0.0)

GPT doesn't just find synonym verbs for banned phrases — it rotates **nouns** to dodge both prompt bans and code catches. Proven across R3–R6 + stress tests:

| What was banned                | What GPT tried next              | What GPT tried after that        |
| ------------------------------ | -------------------------------- | -------------------------------- |
| "The scene feels" (prompt ban) | "The scene carries" (new verb)   | "The stillness feels" (new noun) |
| P11 catches "The scene [verb]" | GPT switches to "The room feels" | "The atmosphere carries"         |

**The fix:** Don't ban individual nouns or verbs. Build lookup sets: a set of abstract nouns (scene, room, stillness, atmosphere, void, silence, mood, etc.) crossed with a set of perception/meta verbs (feels, carries, holds, evokes, captures, etc.). The code catch matches `"The [any noun in set] [any verb in set]"` and strips it.

**Implementation:** P8 (T4, 23 nouns × 21 verbs) in both Call 2 and Call 3 post-processing. P11 (T3, 20 nouns × 18 verbs) now exists only in Call 3's `src/lib/optimise-prompts/harmony-post-processing.ts` (439 lines) — it was removed from Call 2 on 28 Mar 2026. The lookup sets are exported and their sizes are tested by drift-detection assertions.

**Application to Call 3:** Any banned pattern will need a lookup-set code catch from day one. GPT will find evasion routes faster than you can add prompt rules.

### Pattern 8: Measure First, Calibrate Second (v4.0.0)

**The four-zone split principle.** When a harness rule reports failures, question the _rule_ before questioning the _model_. The T3 `char_count_in_range` rule originally had a single threshold: anything below 280 chars was a failure. The harness showed high fail rates — but inspection revealed that many "failures" were sensible compact prompts in the 220–280 range that scored well visually. The rule was penalising good output.

**The fix:** Instead of tweaking the system prompt (which was already correct), the mechanical scorer was split into four diagnostic zones:

| Zone       | Range   | Verdict | Rationale                                                               |
| ---------- | ------- | ------- | ----------------------------------------------------------------------- |
| HARD_UNDER | < 220   | FAIL    | Genuinely thin — even aggressive compression shouldn't go this low      |
| SOFT_UNDER | 220–279 | PASS    | Sensible compression on shorter inputs — measurement problem, not model |
| Sweet spot | 280–420 | PASS    | Target range                                                            |
| OVER       | > 420   | FAIL    | Addressed by P15 truncation                                             |

ChatGPT recommended 220 as the HARD_UNDER threshold over Claude's initial proposal of 200 — another case where the three-way review pattern (Pattern documented in §2) caught a calibration error before it shipped.

**The T3 prompt tweak learning:** Three harness runs tested adding a nudge to the T3 system prompt section ("If your draft falls noticeably short or feels thin, enrich it with one concrete sensory, spatial, or lighting detail"). Measurement across three runs proved this prompt change had no measurable effect on T3 char count — the model was already producing output at its natural length. The fix was the four-zone scorer recalibration, not the prompt. Important learning for Pattern 2 (system prompt rules): **not every problem is a prompt problem, and some prompt tweaks produce no measurable change even when they sound correct.**

**Principle:** "A rule that penalises sensible compression on edge-case inputs is a measurement problem, not a model problem." Applies to any mechanical scoring system.

---

## 4. Anti-Patterns

### Anti-Pattern 1: Trusting GPT to self-assess

ChatGPT gave itself 88/100 in Round 1 while Claude gave 62/100. The actual quality was closer to 62. GPT is generous when grading its own output.

**Mitigation:** Always use the external assessor (Claude) as the primary score, with ChatGPT's self-assessment as a secondary signal. When they diverge, investigate — the truth is usually closer to the harsher score.

### Anti-Pattern 2: Fixing prompt issues with more prompt

After 3 rounds, the system prompt had 18 rules. By the end of 6 rounds, it reached 30 rules — the approved ceiling. Adding more rules has diminishing returns — GPT's attention budget is finite. If a rule isn't working after 2 rounds of refinement, the fix is **post-processing code**, not a 31st rule.

**Threshold:** If GPT violates a rule >30% of the time after the rule has been strengthened with examples and repositioned, stop prompt-engineering and build a code-level catch.

**v2.0.0 evidence:** The T2 negative duplication was unfixable via prompt across 8 consecutive rounds (R1–R6 + 2 stress test reruns). Every prompt variant failed — abstract prohibition, mechanical counting self-check, WRONG/RIGHT examples. P1 catches it 100% of the time in code. Similarly, T3/T4 meta-language noun-substitution was unfixable via banned phrases — GPT rotated nouns faster than we could ban them. P8/P11 lookup-set catches work 100% at sentence-start patterns.

**v3.0.0 update:** The T2 `--no` duplication was subsequently **root-cause fixed** in v4.4 — the JSON schema required both an inline `--no` block in the positive field AND a separate `negative` field, causing GPT to process negatives twice. Setting T2's `negative` field to empty string `""` eliminated the duplication (confirmed 4/4 consecutive clean outputs). P1 remains as a safety net but the root cause is now addressed. This is a rare case where what appeared to be an unfixable GPT behaviour was actually a schema design bug.

### Anti-Pattern 3: Scoring before convergence

In Round 1, Claude scored T2 at 55 and ChatGPT scored it at 91. That 36-point gap meant neither score was reliable. Only after convergence (Round 5: gap = 3 points) could scores be trusted.

**Rule:** Don't make architectural decisions based on scores until dual-assessor gap is <10 points.

### Anti-Pattern 4: Optimising the wrong tier

T4 (Plain Language) dropped from 94 to 82 between rounds — not because of a rule problem, but because of GPT temperature variability on a simple output. Spending a round adding rules for T4 would have been wasted effort. The fix was a minimum-quality bar (10-word sentence rule with WRONG/RIGHT example) — 3 lines that directly addressed the failure mode.

**Rule:** Diagnose whether a score drop is a rule gap or GPT variability before building a fix.

### Anti-Pattern 5: Measuring the model when the rule is wrong (v4.0.0)

The T3 `char_count_in_range` harness rule reported high failure rates. The instinct was to tweak the system prompt to make GPT produce longer output. Three runs proved the prompt tweak had zero effect. The actual problem was the rule's threshold — it was penalising sensible 220–279 char outputs that scored well visually. The fix was recalibrating the rule (four-zone split), not the model. See Pattern 8.

**Rule:** When a mechanical scorer reports failures, verify that the rule itself is correct before spending cycles on prompt changes. Data first, then diagnosis, then fix.

---

## 5. System Prompt Evolution — The 30 Rules

**SSoT:** `buildSystemPrompt()` in `src/app/api/generate-tier-prompts/route.ts` (665 lines). The function is dynamic — it adapts to provider context. Always read the code for current rules. **Current version: v4.5** — 6 iterative versions (v4.0→v4.5) stress-tested with three human scenes and three assessors. See §9 for the full fix programme.

**Rule ceiling:** 30 (enforced by `RULE_CEILING` in `harmony-compliance.ts` with test assertion). Raising requires explicit Martin approval.

### Rule Inventory (tracked in `harmony-compliance.ts`)

#### Tier-specific rules (embedded in tier sections)

| ID   | Tier | Rule                                                         | Round added                 | Impact        |
| ---- | ---- | ------------------------------------------------------------ | --------------------------- | ------------- |
| T1-1 | T1   | Parenthetical syntax with concrete examples when no provider | R2 (B1)                     | +23 on T1     |
| T1-2 | T1   | Subject must carry highest weight                            | R2 (B3)                     | +5 on T1      |
| T1-3 | T1   | Never weight-wrap isolated colour words                      | R2 (S4)                     | +3 on T1      |
| T1-4 | T1   | CLIP interprets literally — no metaphorical/sensory language | R3 (S10) + R2 v2            | +3 on T1      |
| T1-5 | T1   | Mandatory composition/camera term                            | R2 (S1)                     | +8 on T1      |
| T1-6 | T1   | Strict ordering + time-of-day MUST be weighted               | R3 (S13) + R3 v2            | +4 on T1      |
| T1-7 | T1   | No sentence-ending punctuation                               | R4 (B7)                     | Caught by P2  |
| T1-8 | T1   | Semantic clustering + concept dedup + interaction merging    | R2 v2 + R4 v2 + ST1 rerun   | +5 on T1      |
| T2-1 | T2   | Subject must carry highest :: weight                         | R2 (B3)                     | +30 on T2     |
| T2-2 | T2   | :: at end of complete clauses (WRONG/RIGHT)                  | R3 (B5)                     | +5 on T2      |
| T2-3 | T2   | --no flag mandatory (CRITICAL warning)                       | R3 (B4)                     | +30 on T2     |
| T2-4 | T2   | Scene-specific negatives, not boilerplate                    | R2 (S8)                     | +5 on T2      |
| T2-5 | T2   | Abstract-to-visual conversion for weighted terms             | R2 (S7) + R3 v2             | +3 on T2      |
| T2-6 | T2   | Mandatory parameters (--ar, --v, --s, --no)                  | R3 (S9)                     | +10 on T2     |
| T3-1 | T3   | Not a paraphraser — add expert value                         | R2 (S5)                     | +30 on T3     |
| T3-2 | T3   | Banned directive phrases (11 phrases)                        | R3 (S11) + R4 (S14) + R4 v2 | +7 on T3      |
| T3-3 | T3   | Mandatory composition + atmosphere additions                 | R2 (S1)                     | +5 on T3      |
| T3-4 | T3   | Mood conversion mandatory                                    | R3 v2                       | +3 on T3      |
| T3-5 | T3   | Opening sentence must restructure, not repeat                | R2 v2                       | +5 on T3      |
| T4-1 | T4   | Explicit primary setting                                     | R3 (S12)                    | +8 on T4      |
| T4-2 | T4   | No self-correction patterns                                  | R1 (B1)                     | Caught by P3  |
| T4-3 | T4   | Meta-language ban                                            | R4 (S18)                    | Caught by P8  |
| T4-4 | T4   | 10-word sentence minimum (WRONG/RIGHT)                       | R5 (S17)                    | Caught by P10 |
| T4-5 | T4   | Mandatory scene depth (motion/depth/atmosphere)              | R2 v2                       | +9 on T4      |

#### Global rules (Rules section)

| #   | Rule                                                      | Purpose                                         |
| --- | --------------------------------------------------------- | ----------------------------------------------- |
| G1  | Preserve creative intent + EMOTIONAL ATMOSPHERE MANDATORY | Balance preservation with transformation + mood |
| G2  | Add expert prompt engineering value (inverted)            | Reformatting is not value-add                   |
| G3  | Each tier must feel native to its platform family         | Prevents reformatting one tier into another     |
| G4  | Weight hierarchy — subject highest                        | Reinforces T1-2/T2-1                            |
| G5  | Provider-specific syntax                                  | The original fix (B1)                           |
| G6  | Convert abstract emotions to visual equivalents           | "Beauty" → "ethereal light"                     |

---

## 6. Post-Processing Layer

Two separate post-processing files exist — one for Call 2, one for Call 3. Both are extracted from their respective route files for testability. A schema normaliser sits upstream of both.

### Schema Normaliser (v4.0.0)

**File:** `src/lib/call-2-normalise-schema.ts` (81 lines) — pre-validation tier-shape fixer.  
**Import:** Both `generate-tier-prompts/route.ts` and `dev/generate-tier-prompts/route.ts` import `normaliseTierBundle()`.

GPT occasionally returns a tier as a flat string (`"tier1": "masterpiece, ..."`) instead of the required object (`"tier1": { "positive": "masterpiece, ...", "negative": "blurry, ..." }`). The v4.5 harness proof-of-life run showed 9/200 samples (4.5%) failing with SCHEMA_ERROR for exactly this pattern. Every failure was a flat string where an object was expected.

The normaliser runs **between** `JSON.parse()` and `Zod.safeParse()`. It inspects each tier value and wraps flat strings into `{ positive: value, negative: "" }`. Genuinely malformed data (null, number, array, deeply broken shapes) is left untouched for Zod to catch properly.

**Design principle:** Deterministic code fix for a measured problem. This does NOT retry, re-prompt, or paper over other schema issues. It fixes exactly one pattern.

### Call 2 Post-Processing

**File:** `src/lib/harmony-post-processing.ts` (624 lines) — extracted from route.ts in v2.0.0.  
**Import:** `generate-tier-prompts/route.ts` imports `postProcessTiers()` from this module.

**Functions (8 active processing functions + 1 orchestrator = 9 exported functions):**

| ID  | Function                     | Tier | What it does                                                                                                                                                                                                                                      | Added      |
| --- | ---------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| P1  | `deduplicateMjParams()`      | T2   | Merges all --no/--ar/--v/--s blocks, deduplicates terms, removes fusions                                                                                                                                                                          | R4         |
| P2  | `stripTrailingPunctuation()` | T1   | Strips trailing `.!?` from CLIP prompts                                                                                                                                                                                                           | R4         |
| P3  | `fixT4SelfCorrection()`      | T4   | Strips "? No, it is" self-correction hallucinations                                                                                                                                                                                               | R2         |
| P8  | `fixT4MetaOpeners()`         | T4   | Strips "The [abstract noun] [meta verb]" openers (23 nouns × 21 verbs)                                                                                                                                                                            | R2/ST2     |
| P10 | `mergeT4ShortSentences()`    | T4   | Merges final sentences under 10 words into previous via em-dash                                                                                                                                                                                   | R3         |
| P14 | `enforceT1WeightWrap()`      | T1   | Regex scan for weight-wrapped phrases >4 words. Auto-split using 2-word-tail heuristic (keeps noun head inside wrapper, ejects prefix words as unweighted comma-separated terms). Skips malformed/nested parens. Returns fix log.                 | Harness v1 |
| P15 | `enforceT3MaxLength()`       | T3   | If T3 positive >420 chars, truncate at last sentence boundary under 420. Fallback: clause boundary (semicolon, dash, comma). Fallback: nearest whitespace. Verifies result still meets 280-char minimum — if not, falls back to comma truncation. | Harness v1 |
| P16 | `enforceT4MaxLength()`       | T4   | If T4 positive >325 chars, truncate at last sentence boundary under 325. Fallback: comma. Fallback: nearest whitespace. No minimum floor needed.                                                                                                  | Harness v1 |
|     | `postProcessTiers()`         | All  | Orchestrator — applies the correct functions per tier in the correct order                                                                                                                                                                        | R4         |

T1 also gets `enforceWeightCap()` from `harmony-compliance.ts`.

**Pipeline per tier (Call 2):**

```
GPT response → JSON.parse → Schema Normaliser → Zod validation → Post-processing:

T1: enforceWeightCap(8) → P2 (strip punctuation) → P14 (weight-wrap enforcement)
T2: P1 (dedup MJ params) → [P5 in compliance gate adds missing params]
T3: P15 (over-length truncation)
T4: P3 (self-correction) → P8 (meta-openers) → P10 (short sentence merge) → P16 (over-length truncation)
```

### Call 3 Post-Processing (v3.0.0)

**File:** `src/lib/optimise-prompts/harmony-post-processing.ts` (439 lines) — separate from Call 2.  
**Import:** `optimise-prompt/route.ts` imports from this module via `resolve-group-prompt.ts`.

**Functions (7 active processing functions + 1 orchestrator = 8 exported functions — includes P11 and P12 which were removed from Call 2):**

| ID  | Function                           | Tier | What it does                                                                 | Catch rate               |
| --- | ---------------------------------- | ---- | ---------------------------------------------------------------------------- | ------------------------ |
| P1  | `deduplicateMjParams()`            | T2   | Merges all --no/--ar/--v/--s blocks, deduplicates terms                      | 100%                     |
| P2  | `stripTrailingPunctuation()`       | T1   | Strips trailing `.!?` from CLIP prompts                                      | 100%                     |
| P3  | `fixT4SelfCorrection()`            | T4   | Strips "? No, it is" self-correction hallucinations                          | 100%                     |
| P8  | `fixT4MetaOpeners()`               | T4   | Strips "The [abstract noun] [meta verb]" openers                             | 100% (start of sentence) |
| P10 | `mergeT4ShortSentences()`          | T4   | Merges final sentences under 10 words into previous via em-dash              | 100%                     |
| P11 | `fixT3MetaOpeners()`               | T3   | Strips "The [abstract noun] [perception verb]" openers (20 nouns × 18 verbs) | 100% (start of sentence) |
| P12 | `stripClipQualitativeAdjectives()` | T1   | Strips CLIP-unfriendly adjectives from unweighted segments only              | 100% (unweighted)        |
|     | `postProcessTiers()`               | All  | Orchestrator                                                                 |                          |

### Compliance gate (shared by both Call 2 and Call 3)

**File:** `src/lib/harmony-compliance.ts` (833 lines) — deterministic syntax validation.

| ID  | Function                         | Tier | Purpose                                            |
| --- | -------------------------------- | ---- | -------------------------------------------------- |
| P4  | `enforceT1Syntax()`              | T1   | Converts wrong weight syntax for selected provider |
| P5  | `enforceMjParameters()`          | T2   | Adds missing --ar/--v/--s/--no params              |
| P6  | `detectT4MetaLanguage()`         | T4   | Flags meta-language (detection only)               |
| P9  | `detectT4ShortSentences()`       | T4   | Flags under-10-word sentences (detection only)     |
|     | `enforceWeightCap()`             | T1   | Caps maximum weight value                          |
|     | `enforceClipKeywordCleanup()`    | T1   | Strips CLIP-unfriendly content                     |
|     | `enforceNegativeContradiction()` | All  | Ensures negatives don't contradict positives       |
|     | `runFullCompliance()`            | All  | Orchestrator for all compliance functions          |
|     | `detectT3BannedPhrases()`        | T3   | Flags banned meta-commentary phrases               |

**Rule ceiling:** `RULE_CEILING = 30`, `CURRENT_RULE_COUNT = 30`. Tracked with test assertion.

### Integration points

```typescript
// Call 2 (generate-tier-prompts/route.ts):
import { normaliseTierBundle } from "@/lib/call-2-normalise-schema";
import { postProcessTiers } from "@/lib/harmony-post-processing";
const normalised = normaliseTierBundle(jsonParsed); // schema repair
const validated = ResponseSchema.safeParse(normalised.data);
const processed = postProcessTiers(validated.data);

// Call 3 (optimise-prompt/route.ts):
// Post-processing imported via resolve-group-prompt.ts
// Compliance gates run after GPT response, before charCount measurement
```

### Non-regression rule

Both `postProcessTiers()` functions MUST run on their respective Call responses. Do not bypass, remove, or make conditional. All functions are permanent safety nets. **No Call 3 builder may import from another builder** — complete isolation prevents cross-platform regressions.

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

**Fixes applied:** S17 (10-word sentence rule), S18 (meta-language ban). P3 + P8 added for T4. P10 for short sentence merge.

| Tier | Score | Change | Key improvement                         |
| ---- | ----- | ------ | --------------------------------------- |
| T1   | 95    | 0      | Stable                                  |
| T2   | 89    | +4     | Steady, P1 cleaning residual duplicates |
| T3   | 95    | +1     | Polish                                  |
| T4   | 92    | +10    | 10-word rule + P8 meta-language strip   |

### Score trajectory (Rounds 1–5)

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

### v2.0.0 — Rounds R1–R6 (25 March 2026)

New test input: "A lone explorer stands at the edge of a vast frozen valley at first light..." (frozen valley scene). Six rounds of refinement with the same dual-assessor methodology.

| Round | T1  | T2 (prod) | T3  | T4  | Average   | Key Fix                                                                     |
| ----- | --- | --------- | --- | --- | --------- | --------------------------------------------------------------------------- |
| R1 v2 | 88  | 93        | 90  | 74  | **86**    | Baseline with 27 rules                                                      |
| R2 v2 | 93  | 94        | 96  | 82  | **91**    | T1-8 clustering, T1-4 sensory, T3-5 opening diversity, T4-5 scene depth, P8 |
| R3 v2 | 95  | 95        | 97  | 93  | **95**    | G1 emotional mandate, T1-6 time-of-day weighting, P10                       |
| R4 v2 | 97  | 95        | 96  | 94  | **95.5**  | T1-8 concept dedup trap, T3 "that feels" ban, T4 limit 200→250              |
| R5 v2 | 97  | 96        | 95  | 95  | **95.75** | P11 broadened, P12 CLIP adjective stripper                                  |
| R6 v2 | 97  | 96        | 95  | 95  | **95.75** | Prompt trim (removed 150-token T3 ban — P11 handles in code)                |

**Assessor gap:** ≤1 point for 4 consecutive rounds (R3–R6). **Formally converged.**

### v2.0.0 — Stress Tests (900-char complex inputs)

Three curated 900-char inputs designed to expose specific weaknesses. Each run through the Prompt Lab and scored by both assessors.

| Test | Scene                                                                       | T1    | T2 prod | T3    | T4    | Avg       | Key Finding                                                                                            |
| ---- | --------------------------------------------------------------------------- | ----- | ------- | ----- | ----- | --------- | ------------------------------------------------------------------------------------------------------ |
| ST1  | Lighthouse: dual lighting, 5 focal planes, storm, abstract emotion          | 92–95 | 95–96   | 96–97 | 88–94 | **93–95** | Dual-lighting interaction gap (not merged), T4 under-compression → triggered P8 broadening             |
| ST2  | Cellist: abstract emotion, fine detail, period interior decay               | 95    | 95–96   | 96–97 | 88–94 | **94–95** | "The room feels" → confirmed P8 needed broadening, T1 over-tokenisation on complex inputs              |
| ST3  | Deep-sea diver: technical photography terms, extreme scale, bioluminescence | 93–94 | 96      | 95–98 | 92–95 | **94–96** | First clean T2 raw output (no dupes!), G2 user-term reformatting gap, "eighty metres depth" non-visual |

### v4.0.0 — Harness Proof-of-Life (10–11 April 2026)

The Call 2 quality harness (16 files, 41 scenes including the cellist addition) ran 5 rounds with mechanical scoring against 27 rules. This is automated structural validation, distinct from the human dual/three-assessor methodology above.

| Run | Samples | Healthy Rules | Key Finding                                                                                     |
| --- | ------- | ------------- | ----------------------------------------------------------------------------------------------- |
| 1   | 200     | 24/27         | T1.weight_wrap_4_words_max, T3.char_count_in_range, T4.char_count_under_325 failing             |
| 2   | 200     | 25/27         | P14 built — T1 weight-wrap fixed. T3/T4 length still failing                                    |
| 3   | 200     | 26/27         | P15 built — T3 over-length fixed. T4 still failing                                              |
| 4   | 200     | 26/27         | P16 built — T4 over-length fixed. Schema normaliser built (9/200 SCHEMA_ERROR rescued)          |
| 5   | 200     | **27/27**     | All rules HEALTHY. 0/200 sample failures. Schema normaliser catching 4.5% of responses silently |

**Cellist scene finding:** Scored 71/100 on T1 — the weakest single-scene score. Failure pattern: colour isolation and orphaned interaction pairs. This is a GPT model behaviour trait under load on 6+ interaction-pair inputs, not fixable by system prompt rules. Deferred to Call 3 platform-specific builders (Leonardo/SD/DreamStudio should restructure fragmented tokens into merged interaction events).

### Known ceiling

**Moderate inputs:** 96/100 average. **Complex inputs:** 94.5/100 average.

The remaining gap on complex scenes is **compositional intelligence** — GPT lists elements side-by-side instead of composing them into unified visual systems (e.g., "copper-orange sunset" + "cold blue mist" as separate tokens instead of one lighting-interaction token). Both assessors independently identified this across all 3 stress tests. This is an architectural limitation, not fixable via prompt rules or post-processing — it would require a pre-processing step that identifies the dominant visual truth before GPT sees the input.

**GPT ceilings (permanent — confirmed v4.5):**

- "reflect" → smear/ripple/shimmer/streak (T3/T4) — unfixable by prompting
- "burn" → glow (T1/T4, cracked in T3/T4 on v4.5)
- Run-to-run variance of 83–92 on identical inputs is expected
- T4 verb softening in plain-language mode is a permanent ceiling
- T1 CLIP interaction fragmentation on 6+ interaction-pair inputs — model behaviour, not prompt-addressable

---

## 9. Call 2 v4.0→v4.5 Fix Programme

**v3.0.0 addition.** After the initial 6 rounds + 3 stress tests reached 96/100, a second fix programme (v4.0→v4.5) was conducted using three-assessor methodology (Claude, ChatGPT, Grok) with three human test scenes: station violinist, Victorian flower seller, sci-fi hangar mechanic.

### Baseline failures (v4.0)

10-scene stress testing of the monolithic v4.0 file established systematic failure patterns:

| Tier | Failure pattern                         | Root cause                                                                        |
| ---- | --------------------------------------- | --------------------------------------------------------------------------------- |
| T1   | Zero interaction tokens                 | No rule requiring element-acts-on-element pairs to merge                          |
| T2   | Near-universal `--no` block duplication | JSON schema required both inline `--no` in positive and separate `negative` field |
| T3   | Detached style tails + verb softening   | Missing verb fidelity rules, "captured" used as standalone ban-dodge              |
| T4   | Signature anchors dropped               | 250-character ceiling below SSOT platform average (idealMax avg 277)              |

### Fix versions

| Version  | Fixes                | Key changes                                                                                                                                                                                         |
| -------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **v4.1** | 6 targeted fixes     | T1 interaction token scanning, T4 anchor triage hierarchy, T4 value-add self-check, T4 anti-paraphrase opening, T3 "captured" standalone ban, T3 verb fidelity with WRONG/RIGHT examples            |
| **v4.2** | 3 strengthened       | T1 interaction scan + 2 more WRONG/RIGHT examples, T3 verb fidelity expanded to 4 WRONG/RIGHT with aggressive rule, T4 value-add bar raised from "one word" to "one visual detail"                  |
| **v4.3** | 2 additions          | T1 deduplication rule (remove standalone when interaction token created), T4 value-add reframed from "add a new element" to "convert one existing element into something richer"                    |
| **v4.4** | 1 root-cause fix     | **T2 `--no` duplication root cause** — T2 `negative` JSON field set to empty string `""`. All negatives go inline after `--no` in the positive field only. Confirmed 4/4 consecutive clean outputs. |
| **v4.5** | 1 SSOT-justified fix | **T4 character ceiling raised 250→325** based on `platform-config.json` (idealMax average 277, 7/15 T4 platforms accept 300+). Eliminated forced anchor drops.                                      |

### Calibrated gains (three-assessor median)

| Tier        | v4.0 baseline | v4.5 final | Gain                    |
| ----------- | ------------- | ---------- | ----------------------- |
| T1          | ~88           | ~95        | **+7**                  |
| T2          | ~87           | ~95        | **+8**                  |
| T3          | ~95           | ~95        | **+0** (already strong) |
| T4          | ~80           | ~93        | **+13**                 |
| **Overall** | ~88           | ~95        | **+7**                  |

**Production status:** v4.5 confirmed as production file. The code in `generate-tier-prompts/route.ts` (665 lines) is the SSoT.

---

## 10. Call 3 — Platform-Specific Optimisation (In Progress)

Call 3 (`POST /api/optimise-prompt`, 651 lines) takes an assembled prompt + provider context and returns a platform-optimised version. The harmony methodology has been applied with these results:

### Architecture (implemented)

**40 independent builder files** in `src/lib/optimise-prompts/group-*.ts` — each platform has its own system prompt with no shared imports between builders. Complete isolation prevents cross-platform regressions.

**Routing:** `platform-groups.ts` (175 lines) maps each provider ID to a group. `resolve-group-prompt.ts` (192 lines) resolves the system prompt, falling back to `generic-fallback.ts` (77 lines).

**Config:** GPT-5.4-mini, temperature 0.4 for prose groups, 0.2 for CLIP groups. proseGroups detection flips primary input for NL platforms (original sentence primary, assembled prompt secondary).

**Post-processing:** `src/lib/optimise-prompts/harmony-post-processing.ts` (439 lines, 8 exported functions). Compliance gates in `harmony-compliance.ts` (833 lines). Server-side charCount measurement after all gates.

### Differences from Call 2

| Aspect          | Call 2 (generic tiers)                                                | Call 3 (platform-specific)                                            |
| --------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Input           | Human text (creative, variable length)                                | Assembled prompt (structured, predictable)                            |
| Output          | 4 tier prompts (4 families)                                           | 1 optimised prompt (1 specific platform)                              |
| Temperature     | 0.5 (creative restructuring)                                          | 0.4 prose / 0.2 CLIP (precision)                                      |
| System prompt   | 30 rules for 4 families (v4.5)                                        | Per-platform rules in 40 independent builders                         |
| Post-processing | 9 exported functions (Call 2 `harmony-post-processing.ts`, 624 lines) | 8 exported functions (Call 3 `harmony-post-processing.ts`, 439 lines) |
| Test matrix     | 3 scenes × 4 outputs × 3 assessors + 41 scenes × 27 rules (harness)   | 1 scene (Lighthouse Keeper) × 40 platforms                            |

### Harmony pass methodology (proven)

1. Send platform facts + blank canvas request to **ChatGPT** → receive improved system prompt
2. Run against **Lighthouse Keeper** test scene in Prompt Lab
3. Score output with dual assessment (Claude + ChatGPT)
4. Bring results back → write builder file
5. Repeat for next platform

### Performance findings

- **CLIP platforms:** Call 3 averages ~2pt gain (85→87) — marginal. T1 CLIP quality is the weakest tier (cellist 71/100). Call 3 builders for CLIP platforms should focus on targeted enrichment (restructuring fragmented tokens into merged interaction events), not generic optimisation
- **NL platforms:** Call 3 averages ~6-8pt gain (88→94) — worth the API cost
- **Current direction:** T1 CLIP interaction fragmentation is a model behaviour trait at Call 2, not fixable by prompt rules. Call 3 platform-specific builders (Leonardo/SD/DreamStudio) are the fix path — they should restructure fragmented tokens into merged interaction events

### Harmony pass status

| Platform      | Score  | Status                                |
| ------------- | ------ | ------------------------------------- |
| Adobe Firefly | 93/100 | ChatGPT-verified system prompt        |
| 123RF         | 91/100 | ChatGPT-verified system prompt        |
| Artbreeder    | —      | In progress (session ended mid-build) |
| Remaining ~37 | —      | Not yet harmony-passed                |

### What carried forward from Call 2

- Every per-platform example includes a complete output (Pattern 1) ✓
- Critical rules go first and last in each platform section (Pattern 2) ✓
- Ban directive language preemptively with 5+ synonyms (Pattern 3) ✓
- Post-processing catches mechanical artefacts (Pattern 4) ✓
- Temperature tuned per group — 0.4 prose, 0.2 CLIP (Pattern 5, refined) ✓

---

## 11. Decision Framework

### When to add a system prompt rule

- GPT produces the wrong output AND the rule would fix it for >70% of cases
- The rule can be expressed as a concrete WRONG/RIGHT example
- The rule doesn't conflict with existing rules

### When to build post-processing instead

- GPT violates the rule >30% of the time despite examples and repositioning
- The artefact is mechanical (duplication, punctuation, over-length) not semantic
- A deterministic string operation catches it reliably

### When to adjust temperature

- Increase: if output is too conservative/paraphrased (T3 was)
- Decrease: if syntax/structural rules are being violated (Call 3 should be 0.2)
- Never above 0.5 for structured output with syntax requirements

### When to question the rule instead of the model

- The harness reports high fail rates but human inspection shows the "failures" are visually reasonable output
- The rule threshold was inherited from early rounds and never re-validated against production data
- The model is producing output at its natural length/shape and the rule penalises it — that's a measurement problem (Pattern 8)

### When to stop iterating

- Dual-assessor gap < 5 points for 2 consecutive rounds (achieved: ≤1 point for 4 consecutive rounds)
- Average score > 90 (achieved: 96 on moderate, 94.5 on complex)
- Remaining improvements are aesthetic, not structural (achieved: compositional intelligence is the only remaining gap)
- The next meaningful jump requires a different approach (confirmed: pre-processing architecture, not prompt rules)

---

## 12. Non-Regression Rules

1. **This methodology is the standard for all GPT system prompt work** — Call 2, Call 3, future Call 2 updates, any new API routes that use GPT
2. **Three-assessor calibration for system-wide changes** — Claude, ChatGPT, Grok. Triangulated median is the standard. Claude scores T3 ~5-6pts and T4 ~3-5pts too high — use external assessors for calibration.
3. **Dual assessment minimum for individual builder harmony passes** — never ship a builder change without testing through both Claude and ChatGPT
4. **Call 2 post-processing cannot be removed** — 9 exported functions in `src/lib/harmony-post-processing.ts` (624 lines) are permanent safety nets. P11 and P12 were removed from Call 2 (28 Mar 2026) and now exist only in Call 3. P14/P15/P16 were added from harness findings (11 Apr 2026). Active processing functions: P1, P2, P3, P8, P10, P14, P15, P16.
5. **Call 3 post-processing cannot be removed** — 8 exported functions in `src/lib/optimise-prompts/harmony-post-processing.ts` (439 lines) are permanent. Compliance gates in `harmony-compliance.ts` (833 lines) are permanent.
6. **No Call 3 builder may import from another builder** — complete isolation prevents cross-platform regressions
7. **Temperature must be documented and justified** — every API route must record its temperature and the rationale in the route file header. Call 2: 0.5. Call 3: 0.4 prose / 0.2 CLIP.
8. **Concrete examples in every system prompt** — no rule without a WRONG/RIGHT pair or a structural example
9. **Martin approves all changes before implementation** — ideas are proposed, not built. "Put it forward but don't implement it until I say so."
10. **Post-processing extraction is permanent** — Call 2 functions live in `src/lib/harmony-post-processing.ts`, Call 3 functions live in `src/lib/optimise-prompts/harmony-post-processing.ts`. Do not move them back into route files.
11. **Rule ceiling is 30** — raising requires explicit approval. Tracked in `harmony-compliance.ts` with test assertion (`RULE_CEILING = 30`, `CURRENT_RULE_COUNT = 30`).
12. **Server-side `charCount` measurement is mandatory** — never trust GPT self-reported counts. `result.charCount = result.optimised.length` after all compliance gates.
13. **`effectiveWasOptimized` must compare text content** (`optimised !== activeTierPromptText`), NOT length — length comparison hides enriched prompts.
14. **Deterministic fixes belong in code, not prompts** — if a bug can be expressed as deterministic logic, it must be a compliance gate or post-processing function, not a prompt rule.
15. **Three-way build review for all deliverables** — Claude proposes → Martin sends to ChatGPT → Claude reviews feedback, accepts genuine structural corrections, rejects incorrect findings → final agreed version.
16. **Measure the rule before fixing the model** — when the harness reports failures, verify the scoring rule's threshold is correct before spending cycles on prompt changes. The four-zone split principle (Pattern 8).
17. **Schema normaliser is permanent** — `call-2-normalise-schema.ts` runs between JSON.parse and Zod validation. Fixes flat-string tier values. Do not remove or bypass.

---

## Changelog

- **11 Apr 2026 (v4.0.0):** **POST-PROCESSING P14/P15/P16 + SCHEMA NORMALISER + HARNESS FINDINGS + PATTERN 8 + THREE-WAY REVIEW.** §1: Builder count 43→40 (verified grep). Added schema normaliser and Pattern 8 references. §2: Added three-way build review workflow (distinct from three-assessor scoring). Updated Key Insight: Call 2 now 9 exported functions / 624 lines (was 5 / 272). Call 3 now 8 exported functions / 439 lines (was 7 / 439). §3 Pattern 4: Table completely corrected — removed P11/P12 from Call 2 rows (were shown as active despite removal note elsewhere), added P14 `enforceT1WeightWrap()`, P15 `enforceT3MaxLength()`, P16 `enforceT4MaxLength()`. File reference updated 272→624 lines, 5→9 exported functions. §3 NEW Pattern 8: "Measure First, Calibrate Second" — the four-zone split principle from T3 harness findings. Includes T3 prompt tweak learning (three runs, zero measurable effect — important negative result). §4: NEW Anti-Pattern 5: "Measuring the model when the rule is wrong." §5: route.ts line count 650→665. §6: Complete rewrite of Call 2 section (624 lines, 9 functions, P14/P15/P16 added to table, pipeline updated with schema normaliser step). NEW Schema Normaliser subsection (81 lines, pre-validation, 4.5% rescue rate). Integration points updated with normaliser code. §8: NEW v4.0.0 Harness Proof-of-Life section (5 runs, 24/27→27/27 HEALTHY, cellist finding, T1 fragmentation ceiling). §10: Builder count 43→40, route lines 406→651, platform-groups 181→175, resolve-group-prompt 205→192, generic-fallback 78→77. Differences table updated (9 vs 8 functions, 624 vs 439 lines, added harness to test matrix). Performance findings reframed: CLIP platforms need targeted enrichment, not skipping. §11: Added "When to question the rule" decision criterion. §12: Rule 4 updated (9 functions, 624 lines, P14/P15/P16 listed). Rule 5 updated (8 functions). NEW rules 15 (three-way build review), 16 (measure rule before fixing model), 17 (schema normaliser permanent). 14→17 rules. Cross-references: added call-2-quality-architecture doc and call-2-normalise-schema.ts.

- **29 Mar 2026 (v3.0.0):** **THREE-ASSESSOR METHODOLOGY + CALL 2 v4.5 + CALL 3 ARCHITECTURE.** §1: Platform count 42→40. Added three-assessor reference. §2: Added three-assessor model (Claude, ChatGPT, Grok) with calibration finding (Claude +5-6pts T3, +3-5pts T4 vs median). Updated post-processing insight — Call 2 now 5 functions (P11/P12 removed 28 Mar), Call 3 has 7 functions. §3: Pattern 4 file reference updated — two files (272 + 439 lines). Pattern 7 implementation updated — P11 now Call 3 only. §4: Anti-Pattern 2 updated with v4.4 T2 root-cause fix (schema bug, not unfixable GPT behaviour). §5: SSoT reference updated — route.ts 650 lines, v4.5 confirmed. §6: Completely rewritten — split into Call 2 (272 lines, 5 functions) and Call 3 (439 lines, 7 functions) subsections. P11/P12 documented as removed from Call 2, migrated to Call 3 only. Pipeline per tier corrected. Compliance gate updated 486→833 lines with full function list including `enforceWeightCap`, `enforceClipKeywordCleanup`, `enforceNegativeContradiction`, `runFullCompliance`, `detectT3BannedPhrases`. §8: Added GPT ceilings section (reflect→smear, burn→glow, 83-92 variance). §9 NEW: Call 2 v4.0→v4.5 fix programme — baseline failures (T1 zero interactions, T2 `--no` duplication, T3 verb softening, T4 anchor drops), 5 fix versions with specific changes per version, calibrated three-assessor gains (T1 +7, T2 +8, T3 +0, T4 +13, overall +7). §10 (was §9): Rewritten from future plan to actual state — 43 independent builder files, routing (platform-groups.ts 181 lines, resolve-group-prompt.ts 205 lines), config (0.4 prose / 0.2 CLIP), harmony pass methodology, performance findings (CLIP ~2pt vs NL ~6-8pt), status table (Firefly 93/100, 123RF 91/100, Artbreeder in progress). §11 (was §10): Renumbered. §12 (was §11): Rewritten — three-assessor calibration (rule 2), dual minimum for builders (rule 3), Call 2/Call 3 post-processing split (rules 4-5), builder isolation (rule 6), temperature documentation (rule 7), server-side charCount (rule 12), effectiveWasOptimized text comparison (rule 13), deterministic-fixes-in-code principle (rule 14). 10→14 rules. Cross-references updated: ai-disguise v4.0.0→v5.0.0, prompt-lab v3.1.0→v4.0.0, added prompt-optimizer v6.0.0, prompt-lab-v4-flow v2.0.0, platform-config SSOT.

- **25 Mar 2026 (v2.0.0):** **HARMONY ENGINEERING v2 + POST-PROCESSING EXTRACTION + TEST LOCKDOWN.** Six additional rounds (R1–R6 v2) with frozen valley test input, converged to ≤1 point dual-assessor gap across all tiers. Three 900-char stress tests (lighthouse, cellist, deep-sea diver) validated system at 94.5–96/100. Rule inventory expanded from 18 to 30: +T1-8 (semantic clustering + interaction merging), +T3-5 (opening diversity), +T4-5 (scene depth), +G1 emotional mandate, +T1-6 time-of-day weighting, +T3 "that feels" ban, +T4 limit 200→250. Post-processing expanded from P1+P2 to 7 functions (P1,P2,P3,P8,P10,P11,P12), all extracted to `harmony-post-processing.ts` (342 lines). P8/P11 broadened with abstract-noun × perception-verb lookup sets to counter GPT noun-substitution evasion (Pattern 7). 115-test lockdown suite: 72 post-processing + 43 compliance tests with drift detection. Added Pattern 7 (noun-substitution evasion), updated Patterns 3–4, expanded Anti-Pattern 2, updated §5 rule inventory, rewrote §6 post-processing, added v2 rounds + stress tests to §8, updated §9 Call 3 table, §10 exit criteria, §11 non-regression rules 7–10.

- **23 Mar 2026 (v1.0.0):** Initial document. Captures the complete methodology from 5 rounds of Call 2 harmony engineering (62→93/100). Documents all 6 proven patterns, 4 anti-patterns, the 18-rule system prompt inventory, the post-processing layer, scoring methodology with per-tier criteria, the round-by-round journey with score trajectory, and the application playbook for Call 3 platform-specific optimisation.

---

_End of document._
