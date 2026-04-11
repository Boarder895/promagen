# Call 3 Quality — Build Plan

**Status:** Build plan, paired with `call-3-quality-architecture-v0.2.0.md` (frozen at 96/100).  
**Author:** Claude (via Martin)  
**Audience:** Implementation. Read in a fresh chat alongside v0.2.0 and `src.zip`.  
**Date:** 11 April 2026  
**Architecture freeze:** v0.2.0 (ChatGPT scored 96/100, "freeze and start building")

---

## 0. How to use this document

This is the implementation companion to `call-3-quality-architecture-v0.2.0.md`. The architecture document is the **what** and the **why**. This document is the **how** and the **in what order**.

**Read order for a fresh Claude chat:**

1. `call-3-quality-architecture-v0.2.0.md` (architecture, frozen)
2. This document (build plan)
3. `src.zip` (extract; ground truth for all existing code)
4. Verify §2 of this document before touching code
5. Start Phase 1

**What this plan is not:**

- Not an architecture revision. Architecture is frozen at v0.2.0.
- Not a rewrite of existing Call 3. The current `/api/optimise-prompt` route is modified incrementally, not replaced.
- Not a one-shot build. Phases are independently shippable. After Phase 5 the system has real quality gains even if Phases 6–11 never ship.

---

## 1. Honest answer to "can you build this without my input?"

**Mostly yes, but five things need Martin:**

| #   | What I need                            | Why I can't fake it                                                                                                                                                                | When it blocks                        |
| --- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| 1   | **2 additional canonical test scenes** | Lighthouse Keeper covers outdoor drama. Martin must provide or approve an indoor/character scene and an abstract/stylised scene for the 3-category mandate (architecture §9.3).    | Phase 6 (Harmony Pass baseline sweep) |
| 2   | **Headroom ceiling estimates**         | Initial ceilings per platform. I can seed from BQI first-batch data (mean 81.97) + assembled baseline scores, but Martin should review before locking for the first harmony cycle. | Phase 6                               |
| 3   | **Builder sign-off**                   | Each refined builder system prompt needs Martin's approval before shipping. Claude writes, ChatGPT verifies, Martin approves.                                                      | Phase 7                               |
| 4   | **Hallucination map seeding**          | I can populate assumed entries from community knowledge, but Martin should review the initial set.                                                                                 | Phase 9                               |
| 5   | **Image generation spot-check**        | The quarterly milestone image test (architecture §13 #8) requires generating actual images on 5 platforms. Martin runs these.                                                      | Post-Phase 11 milestone               |

**Everything else I can build:** DNA profiles, APS gate, AVIS algorithm, all deterministic transforms, Call 3 harness, retry protocol, negative engine, and all test fixtures.

---

## 2. Pre-flight checklist for Martin

Tick before Phase 1 starts.

- [ ] **Architecture doc read.** Confirm `call-3-quality-architecture-v0.2.0.md` is the authority.
- [ ] **src.zip is current.** The zip must contain the latest Call 3 route (`src/app/api/optimise-prompt/route.ts`, 651 lines), all 50 builder files in `src/lib/optimise-prompts/`, and the Call 2 harness infrastructure in `src/lib/call-2-harness/`.
- [ ] **BQI operational.** Confirm `/api/score-prompt` route and `scripts/builder-quality-run.ts` are working. Phase 6 depends on BQI.
- [ ] **Path approval.** Confirm these new directories are acceptable:
  - `src/data/platform-dna/` (Platform DNA profiles)
  - `src/lib/call-3-transforms/` (Deterministic transform functions)
  - `src/lib/call-3-harness/` (Call 3 harness — mirrors Call 2 pattern)
  - `scripts/run-call3-harness.ts` (Call 3 harness runner)
  - `generated/call-3-harness/runs/` (gitignored output)

---

## 3. What already exists (reuse map)

A substantial amount of infrastructure is already built. The build plan extends existing code rather than replacing it.

### 3.1 Call 3 pipeline (all in production)

| File                                                   | Lines  | What it does                                  | Build plan impact                                            |
| ------------------------------------------------------ | ------ | --------------------------------------------- | ------------------------------------------------------------ |
| `src/app/api/optimise-prompt/route.ts`                 | 651    | Call 3 route — preflight, GPT, compliance     | Modified in Phases 2, 8 (APS gate, retry protocol)           |
| `src/lib/optimise-prompts/preflight.ts`                | 464    | Decision engine + anchor extraction + reorder | Extended in Phase 3 (AVIS uses `extractAnchors()`)           |
| `src/lib/optimise-prompts/regression-guard.ts`         | 694    | 8-check regression guard + prose quality      | Kept as secondary safety net. APS becomes primary in Phase 2 |
| `src/lib/optimise-prompts/anchor-diff-gate.ts`         | 188    | Fast anchor-diff rejection                    | Replaced/absorbed by APS gate in Phase 2                     |
| `src/lib/optimise-prompts/midjourney-deterministic.ts` | 402    | MJ parser, validator, normaliser              | Unchanged. Already handles MJ deterministic path             |
| `src/lib/optimise-prompts/resolve-group-prompt.ts`     | 192    | Routes provider → builder                     | Unchanged                                                    |
| `src/lib/optimise-prompts/platform-groups.ts`          | 175    | Provider → group mapping                      | Unchanged                                                    |
| `src/lib/optimise-prompts/harmony-post-processing.ts`  | 439    | Post-processing P1–P12                        | Unchanged                                                    |
| `src/lib/harmony-compliance.ts`                        | 833    | Compliance gates                              | Unchanged                                                    |
| 50 builder files (`group-*.ts`)                        | Varies | Per-platform system prompts                   | Modified in Phase 7 (builder refinement)                     |

### 3.2 Call 2 harness (reusable infrastructure)

| File                                          | What it provides                             | Reuse in Call 3                                    |
| --------------------------------------------- | -------------------------------------------- | -------------------------------------------------- |
| `src/lib/call-2-harness/scene-library.ts`     | Scene loader, holdout gating                 | Reused directly — same scene library               |
| `src/lib/call-2-harness/inventory-writer.ts`  | Inventory schema, write/load/diff-attach     | Adapted — new Call 3 inventory schema extends base |
| `src/lib/call-2-harness/diff.ts`              | Version diffing, significance classification | Reused directly                                    |
| `src/lib/call-2-harness/run-classes.ts`       | Run class taxonomy and config                | Reused directly                                    |
| `src/lib/call-2-harness/rescue-dependency.ts` | Rescue dependency calculation                | Adapted for Call 3 stages (Stage R vs Stage F)     |

### 3.3 BQI infrastructure (operational, 12 parts deployed)

| File                                        | What it provides                                       | Reuse in Call 3                                         |
| ------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------- |
| `scripts/builder-quality-run.ts`            | Batch runner: Call 3 → Score for each platform × scene | Used in Phase 6 (baseline sweep)                        |
| `src/lib/builder-quality/scoring-prompt.ts` | Shared scoring rubric                                  | Used for dual-assessor scoring                          |
| `src/data/scoring/frozen-snapshots.json`    | 32 frozen Call 2 outputs (8 scenes × 4 tiers)          | Input to Call 3 — assembled prompts are the test inputs |
| `src/data/scoring/test-scenes.json`         | 8 core test scenes                                     | Extended in Phase 6 with 2 new scene categories         |

---

## 4. Phased build

Eleven phases. The first five are the core quality spine — measurable gains on CLIP and a stronger safety net for GPT platforms. Phases 6–11 are the harmony pass, builder refinement, and full harness.

| Phase  | Goal                                                                  | Modifies existing code?      | Estimated effort     |
| ------ | --------------------------------------------------------------------- | ---------------------------- | -------------------- |
| **1**  | Platform DNA profiles (data, no code)                                 | No — new data file           | Small (1 session)    |
| **2**  | APS gate + 3 vetoes (primary quality gate)                            | Yes — route.ts               | Medium (1 session)   |
| **3**  | Attention Sequencing Algorithm for CLIP                               | No — new module              | Medium (1 session)   |
| **4**  | Semantic Compression (`T_SEMANTIC_COMPRESS`)                          | No — new module              | Small (1 session)    |
| **5**  | Deterministic Transform Catalogue (all `T_*`)                         | Yes — preflight.ts, route.ts | Medium (2 sessions)  |
| ☆      | **Core quality spine complete. CLIP gains live. APS protecting GPT.** |                              |                      |
| **6**  | Harmony Pass 2.0 — baseline sweep + triage                            | No — uses BQI                | Medium (1 session)   |
| **7**  | Builder refinement for Green platforms                                | Yes — group-\*.ts files      | Large (2–3 sessions) |
| **8**  | Iterative retry protocol (platform-gated)                             | Yes — route.ts               | Small (1 session)    |
| **9**  | Negative Intelligence Engine (Tier A + map)                           | No — new module              | Small (1 session)    |
| **10** | Call 3 harness (dev endpoint + scorer)                                | No — new files               | Medium (2 sessions)  |
| **11** | Full harmony pass — all 40 platforms × 3 scenes                       | Process, not code            | Large (4–6 sessions) |

**Total: 16–22 sessions.**

---

## 5. Phase 1 — Platform DNA profiles

### 5.1 Goal

Create a structured data file containing the Platform DNA profile (architecture §4.1) for all 40 platforms. No code changes — this is the data layer that everything else reads.

### 5.2 Files to create

**`src/data/platform-dna/profiles.json`** — 40 entries matching the `PlatformDNA` schema:

```json
{
  "stability": {
    "encoderFamily": "clip",
    "promptStylePreference": "weighted_keywords",
    "syntaxMode": "double_colon",
    "negativeMode": "separate_field",
    "tokenLimit": 77,
    "charCeiling": 875,
    "processingProfile": {
      "frontLoadImportance": 0.8,
      "rewritesPrompt": false,
      "qualityTagsEffective": true
    },
    "allowedTransforms": [
      "T_QUALITY_POSITION",
      "T_SUBJECT_FRONT",
      "T_ATTENTION_SEQUENCE",
      "T_WEIGHT_REBALANCE",
      "T_TOKEN_MERGE",
      "T_SEMANTIC_COMPRESS",
      "T_REDUNDANCY_STRIP",
      "T_CHAR_ENFORCE"
    ],
    "requiresGPT": false,
    "gptTemperature": null,
    "retryEnabled": false,
    "tokenBudget": {
      "subject": { "min": 5, "max": 14, "priority": 1.0 },
      "style": { "min": 2, "max": 5, "priority": 0.95 },
      "lighting": { "min": 2, "max": 5, "priority": 0.75 },
      "environment": { "min": 2, "max": 5, "priority": 0.7 }
    },
    "knownFailureModes": [
      "interaction_fragmentation",
      "orphaned_colour_weights"
    ],
    "hallucinationMap": null,
    "assembledBaseline": null,
    "optimisedScore": null,
    "availableHeadroom": null,
    "harmonyStatus": "untested"
  }
}
```

**`src/data/platform-dna/types.ts`** — TypeScript types for the DNA schema. Exported for use by transforms and harness.

**`src/data/platform-dna/index.ts`** — Loader: `getDNA(platformId: string): PlatformDNA | null` and `getAllDNA(): Record<string, PlatformDNA>`.

### 5.3 Data sources

Populate from:

- `platform-config.json` — tier, maxChars, idealMin/idealMax, negativeSupport, tokenLimit
- `optimal-prompt-stacking.md` — encoder families, stacking limits, per-platform notes
- `prompt_engineering_specs_40_platforms.md` — encoder architectures, token limits
- `api-3.md` §2 — call3Mode assignments, maxChars capping
- Architecture §4.3 — transform assignments per platform

### 5.4 Verification

```powershell
pnpm run test:util __tests__/platform-dna/profiles.test.ts
```

Tests: all 40 platforms present, every platform has a valid encoderFamily, allowedTransforms is non-empty, charCeiling ≤ maxChars from platform-config, tokenLimit matches platform-config.

### 5.5 What good looks like

`getDNA('stability')` returns a complete profile. `getDNA('nonexistent')` returns null. Every platform in `platform-config.json` has a corresponding DNA entry. TypeScript types compile. No code outside this phase reads the file yet — it's pure data.

### 5.6 Existing features preserved

**Yes.** New data file. No existing code modified.

---

## 6. Phase 2 — APS gate + vetoes

### 6.1 Goal

Implement the Anchor Preservation Score (architecture §6) as the primary quality gate, replacing `anchor-diff-gate.ts` as the first-line rejection mechanism. The existing regression guard stays as the secondary safety net.

### 6.2 Files to create

**`src/lib/optimise-prompts/aps-gate.ts`** — Core implementation:

```typescript
export interface APSResult {
  score: number; // 0.0 – 1.0
  verdict: "ACCEPT" | "ACCEPT_WITH_WARNING" | "RETRY" | "REJECT";
  criticalAnchorVeto: boolean;
  inventedContentVeto: boolean;
  proseQualityVeto: boolean;
  survivingAnchors: AnchorSurvival[];
  droppedAnchors: AnchorSurvival[];
  inventedContent: string[];
}

export interface AnchorSurvival {
  anchor: string;
  severity: "critical" | "important" | "optional";
  weight: 3 | 2 | 1;
  survived: boolean;
}

export function computeAPS(
  inputAnchors: AnchorManifest,
  outputText: string,
  platformDNA: PlatformDNA,
): APSResult;
```

- Imports `extractAnchors()` from existing `preflight.ts` (no modification needed)
- Imports prose quality detectors from existing `regression-guard.ts` (no modification needed)
- Implements the three vetoes (critical anchor loss, invented content, prose quality floor)
- Applies thresholds from architecture §6.2: ≥0.95 accept, 0.88–0.94 accept+checks, 0.78–0.87 retry band, <0.78 reject

**`__tests__/optimise-prompts/aps-gate.test.ts`** — Test fixtures:

- Perfect preservation (APS 1.0, all anchors survived) → ACCEPT
- Minor optional loss (APS 0.92, one optional anchor dropped) → ACCEPT_WITH_WARNING
- Critical anchor missing (APS 0.91 but subject dropped) → REJECT (veto overrides score)
- Invented content present (APS 0.95 but new colour added) → REJECT (veto)
- Prose scaffold detected (APS 0.93 but "foreground/midground/background") → REJECT (veto)
- Retry band (APS 0.82, no vetoes) → RETRY
- Hard reject (APS 0.70) → REJECT

### 6.3 Files to modify

**`src/app/api/optimise-prompt/route.ts`** — Replace the anchor-diff-gate call (lines 554–578) with the APS gate. The regression guard (lines 582–628) stays as secondary. Order becomes:

```
GPT output → APS gate → [if ACCEPT/ACCEPT_WITH_WARNING] → Regression guard (secondary) → Ship
                        [if RETRY + retry enabled] → Retry (Phase 8 — stubbed as fallback for now)
                        [if REJECT] → Fallback to assembled prompt
```

### 6.4 Verification

```powershell
pnpm run test:util __tests__/optimise-prompts/aps-gate.test.ts
pnpm run test:util
pnpm run typecheck
pnpm run build
```

### 6.5 What good looks like

The APS gate catches the same failures the anchor-diff-gate caught (it's a strict superset) plus catches prose quality degradation and invented content. The regression guard still runs but fires less often because APS catches most issues upstream. Route.ts compiles. Existing tests pass.

### 6.6 Existing features preserved

**Yes for all existing behaviour.** The route's response shape is unchanged. The regression guard stays. The anchor-diff-gate import can be removed from route.ts (its logic is absorbed by APS) but the file itself stays in the codebase until confirmed no longer imported elsewhere.

---

## 7. Phase 3 — Attention Sequencing Algorithm

### 7.1 Goal

Implement the AVIS-scored attention sequencing (architecture §5) for CLIP T1 platforms. This is the novel deterministic transform that should deliver 3–5pt gains on 7 platforms with zero GPT cost.

### 7.2 Files to create

**`src/lib/call-3-transforms/attention-sequence.ts`** — Core algorithm:

```typescript
export interface AVISConfig {
  /** Attention weight function: maps token position → weight (0.0–1.0) */
  attentionCurve: (position: number, tokenLimit: number) => number;
  /** Whether to enforce token budget (true for CLIP, false for T5) */
  enforceTokenBudget: boolean;
  /** Token limit (77 for CLIP, 512 for T5, null for unconstrained) */
  tokenLimit: number | null;
}

export interface SequencedResult {
  text: string;
  changes: string[];
  avisScores: { anchor: string; score: number; position: number }[];
  tokensUsed: number;
  anchorsDropped: string[]; // Dropped due to budget (CLIP only)
}

export function sequenceByAVIS(
  assembledPrompt: string,
  anchors: AnchorManifest,
  config: AVISConfig,
  platformDNA: PlatformDNA,
): SequencedResult;
```

**`src/lib/call-3-transforms/cohesion-pairs.ts`** — Cohesion pair detection:

```typescript
export interface CohesionPair {
  anchor1: string;
  anchor2: string;
  relationship: "subject_action" | "colour_object" | "modifier_noun";
  confidence: number; // 0.0–1.0
}

export function detectCohesionPairs(
  text: string,
  anchors: AnchorManifest,
): CohesionPair[];
```

Primary: grammatical/structural coupling (shared verb, shared object). Secondary: semantic-pairs.json lookup. Fallback: no pair.

**`src/lib/call-3-transforms/attention-curves.ts`** — Platform attention curves:

```typescript
/** CLIP: exponential front-decay (working hypothesis §3.2) */
export function clipAttentionCurve(
  position: number,
  tokenLimit: number,
): number;

/** T5: mild linear decay (working hypothesis §3.2) */
export function t5AttentionCurve(position: number, tokenLimit: number): number;

/** LLM: near-uniform */
export function llmAttentionCurve(position: number, tokenLimit: number): number;
```

**`__tests__/call-3-transforms/attention-sequence.test.ts`** — Tests:

- Lighthouse Keeper on CLIP: subject moves to position 0–15, colours and lighting stay coupled, total ≤ 77 tokens
- Same input on T5: first sentence contains scene premise, mild reordering
- Budget overflow on CLIP: lowest-AVIS anchors dropped, highest retained
- Cohesion pair preserved: "waves crash against rocks" stays adjacent
- Empty/short input: returned unchanged

### 7.3 Verification

```powershell
pnpm run test:util __tests__/call-3-transforms/attention-sequence.test.ts
```

### 7.4 What good looks like

`sequenceByAVIS(lighthouseKeeperPrompt, anchors, clipConfig, stabilityDNA)` produces a reordered prompt where the subject leads, critical colour anchors are in the first 30 tokens, interaction pairs stay adjacent, and total tokens ≤ 77.

### 7.5 Existing features preserved

**Yes.** New module. No existing code modified in this phase.

---

## 8. Phase 4 — Semantic Compression

### 8.1 Goal

Implement `T_SEMANTIC_COMPRESS` — within-phrase compression for CLIP platforms. "Weathered old" → "grizzled". Frees tokens without losing visual meaning.

### 8.2 Files to create

**`src/lib/call-3-transforms/semantic-compress.ts`**:

```typescript
export interface CompressionResult {
  text: string;
  changes: string[];
  tokensSaved: number;
  densityBefore: number;
  densityAfter: number;
}

export function semanticCompress(
  text: string,
  anchors: AnchorManifest,
  tokenLimit: number,
): CompressionResult;

export function computeDensity(phrase: string): number;
```

Uses the existing 59-rule compression dictionary (`src/data/providers/compression-dictionary.json`) plus new synonym-based modifier compression rules.

**`src/data/call-3-transforms/modifier-synonyms.json`** — Synonym lookup for redundant modifiers:

```json
{
  "weathered old": "grizzled",
  "ancient old": "ancient",
  "bright vivid": "vivid",
  "dark shadowy": "shadowy",
  "large enormous": "enormous"
}
```

Conservative list — only apply when the synonym is visually equivalent. No creative paraphrasing.

**`__tests__/call-3-transforms/semantic-compress.test.ts`** — Tests with known compression cases.

### 8.3 Existing features preserved

**Yes.** New module. Extends existing compression dictionary concept.

---

## 9. Phase 5 — Deterministic Transform Catalogue

### 9.1 Goal

Wire all deterministic `T_*` transforms into the Call 3 pipeline. Each platform's DNA profile declares which transforms it gets. The route runs exactly those transforms, in order, and nothing else.

### 9.2 Files to create

**`src/lib/call-3-transforms/index.ts`** — Transform coordinator:

```typescript
export type TransformId =
  | "T_SUBJECT_FRONT"
  | "T_ATTENTION_SEQUENCE"
  | "T_WEIGHT_REBALANCE"
  | "T_TOKEN_MERGE"
  | "T_SEMANTIC_COMPRESS"
  | "T_REDUNDANCY_STRIP"
  | "T_QUALITY_POSITION"
  | "T_PARAM_VALIDATE"
  | "T_WEIGHT_VALIDATE"
  | "T_CLAUSE_FRONT"
  | "T_SCENE_PREMISE"
  | "T_CHAR_ENFORCE"
  | "T_SYNTAX_CLEANUP"
  // GPT transforms handled separately by the route
  | "T_PROSE_RESTRUCTURE"
  | "T_NARRATIVE_ARMOUR"
  | "T_NEGATIVE_GENERATE";

export interface TransformResult {
  text: string;
  changes: string[];
  transformsApplied: TransformId[];
}

export function runDeterministicTransforms(
  text: string,
  platformDNA: PlatformDNA,
  anchors: AnchorManifest,
): TransformResult;
```

Each deterministic transform is a pure function imported from its own file. The coordinator runs them in the order declared in `platformDNA.allowedTransforms`, skipping GPT transforms (those are handled by the route).

**Individual transform files** (in `src/lib/call-3-transforms/`):

- `subject-front.ts` — wraps existing `reorderSubjectFirst()` from preflight.ts
- `weight-rebalance.ts` — new, CLIP weight redistribution
- `token-merge.ts` — new, fragment merging
- `quality-position.ts` — new, quality prefix/suffix placement
- `scene-premise.ts` — new, first-sentence scene premise enforcement
- `redundancy-strip.ts` — wraps existing redundancy detection from prompt-optimizer.ts
- `char-enforce.ts` — wraps existing compliance gates
- `syntax-cleanup.ts` — wraps existing harmony-post-processing functions

Transforms already built (Phases 3–4): `attention-sequence.ts`, `semantic-compress.ts`.

### 9.3 Files to modify

**`src/app/api/optimise-prompt/route.ts`** — The deterministic fast path (lines 253–322) is replaced with:

```typescript
// Deterministic path: run platform-specific transforms from DNA profile
const dna = getDNA(parsed.data.providerId);
if (dna && !dna.requiresGPT) {
  const transformResult = runDeterministicTransforms(
    sanitisedPrompt,
    dna,
    anchors,
  );
  // ... group compliance gate, return
}
```

The existing `decision === 'REORDER_ONLY'` / `'FORMAT_ONLY'` / etc. branches are replaced by the DNA-driven transform catalogue. The preflight decision engine still runs to determine GPT vs deterministic, but the deterministic path is now richer — it runs the full transform catalogue instead of just subject reorder or format cleanup.

**`src/lib/optimise-prompts/preflight.ts`** — `analyseOptimisationNeed()` updated to read DNA profiles. If DNA says `requiresGPT: false`, the decision is always deterministic regardless of the old `call3Mode` config. DNA is the new authority; `call3Mode` in platform-config.json becomes a legacy fallback for platforms without DNA profiles.

### 9.4 Verification

```powershell
pnpm run test:util __tests__/call-3-transforms/
pnpm run test:util
pnpm run typecheck
pnpm run build
```

Run the Lighthouse Keeper through the Prompt Lab for each CLIP platform. The optimised prompt should show attention sequencing changes in the change chips.

### 9.5 What good looks like

Stability's Call 3 output has the subject in the first 15 tokens, quality prefix at position 0, interaction pairs adjacent, redundant terms stripped, total ≤ 77 tokens. The change chips show "Attention sequencing: moved [subject] to position 0–5" and "Fragment merge: combined 'purple, sky, copper' → 'purple-copper sky'".

### 9.6 Existing features preserved

**Qualified yes.** The deterministic path behaviour changes (it now runs more transforms) but the route still handles all 40 platforms, GPT platforms still call GPT, and the response shape is unchanged. The existing `call3Mode` config is respected as fallback.

---

## ☆ Core quality spine complete

After Phase 5:

- All 40 platforms have DNA profiles defining exactly which transforms they get
- The APS gate + vetoes protects all GPT platforms from degradation
- 7 CLIP platforms get attention sequencing + semantic compression + fragment merging (deterministic, zero GPT cost)
- The existing regression guard stays as a secondary safety net
- The route is cleaner: DNA-driven instead of scattered `if/else` branches

**This is the right place to pause and measure.** Run the BQI batch for the 7 CLIP platforms before and after. If CLIP platforms don't show ≥2pt gain, something in the attention sequencing needs fixing before proceeding.

---

## 10. Phase 6 — Harmony Pass 2.0 baseline sweep

### 10.1 Goal

Run the BQI batch across all 40 platforms with 3 test scenes from 3 categories. Produce baseline scores. Triage into Green/Amber/Red.

### 10.2 Prerequisites

- **2 new test scenes from Martin** (indoor/character + abstract/stylised) added to `src/data/scoring/test-scenes.json`
- **Frozen snapshots** for the new scenes generated via `scripts/generate-snapshots.ts`
- BQI batch runner operational

### 10.3 Process (not code)

1. Run `scripts/builder-quality-run.ts` with all 40 platforms × 3 scenes × 1 replicate
2. Extract assembled baseline scores vs optimised scores per platform
3. Compute headroom fraction for each platform
4. Triage: Green (≥50% headroom fraction), Amber (20–49%), Red (<20% or negative)
5. Document triage results in `docs/authority/harmony-pass-2-triage.md`

### 10.4 What good looks like

A triage table showing every platform's assembled baseline, optimised score, headroom fraction, and bucket (Green/Amber/Red). Martin reviews and approves before Phase 7.

---

## 11. Phase 7 — Builder refinement for Green platforms

### 11.1 Goal

For each Green platform (GPT path, headroom fraction ≥50%), refine the builder system prompt using the surgical transform approach. The system prompt tells GPT exactly which transforms to perform and bans everything else.

### 11.2 Process per platform (45 mins each)

1. Open builder file (`src/lib/optimise-prompts/group-*.ts`)
2. Rewrite system prompt to reference only the transforms in that platform's DNA profile
3. Add WRONG/RIGHT examples for each allowed transform
4. Ban composition scaffolding, invented content, synonym churn explicitly
5. Test in OpenAI Playground (gpt-5.4-mini, json_object, reasoning effort medium) with 3 scene categories
6. Target: 95+ on all 3 scenes
7. If 95+ achieved: write builder file, submit for Martin's approval
8. If not: tighten constraints, retry, or downgrade to deterministic

### 11.3 Files modified

Each Green platform's `group-*.ts` file gets an updated system prompt. No structural code changes — the builder function signature and compliance gate stay the same.

### 11.4 Existing features preserved

**Yes.** Builder files are isolated by design — no cross-imports between builders. Changing one builder cannot break another.

---

## 12. Phase 8 — Iterative retry protocol

### 12.1 Goal

Implement the platform-gated retry protocol (architecture §8). GPT gets a second chance with tighter constraints when APS is in the retry band.

### 12.2 Files to create

**`src/lib/optimise-prompts/retry-prompt.ts`** — Builds the tighter retry user message:

```typescript
export function buildRetryMessage(
  originalPrompt: string,
  anchors: AnchorManifest,
  apsResult: APSResult,
  platformName: string,
): string;
```

### 12.3 Files to modify

**`src/app/api/optimise-prompt/route.ts`** — After the APS gate returns `RETRY`:

```typescript
if (apsResult.verdict === "RETRY" && dna?.retryEnabled) {
  // Build tighter retry message
  const retryMessage = buildRetryMessage(
    sanitisedPrompt,
    anchors,
    apsResult,
    providerContext.name,
  );
  // Second GPT call with same system prompt + tighter user message
  // APS check on retry output: accept at ≥0.88, otherwise fallback
}
```

### 12.4 Platform gating

Read `retryEnabled` from DNA profile. Initially enabled for: recraft, openai, flux, kling. All others: false.

### 12.5 Existing features preserved

**Yes.** Retry is additive — first-attempt behaviour is unchanged. Retry only fires when APS returns RETRY verdict on a platform with retry enabled. Other platforms fall through to the existing fallback path.

---

## 13. Phase 9 — Negative Intelligence Engine

### 13.1 Goal

Implement Tier A (deterministic) negative generation and the hallucination map data structure.

### 13.2 Files to create

**`src/lib/call-3-transforms/negative-intelligence.ts`**:

```typescript
export function generateNegative(
  platformDNA: PlatformDNA,
  sceneAnchors: AnchorManifest,
): string | null;
```

Returns null for platforms where negatives are `none` or `counterproductive`.

**`src/data/platform-dna/hallucination-map.json`** — Initial seeded entries with `confidence: 'assumed'`. Martin reviews.

### 13.3 Existing features preserved

**Yes.** New module. Existing negative handling in route.ts is extended, not replaced.

---

## 14. Phase 10 — Call 3 harness

### 14.1 Goal

Build a harness for Call 3 equivalent to the Call 2 harness. Dev endpoint returning Call 3 stage artefacts + per-platform mechanical scorer + inventory output.

### 14.2 Files to create

**`src/app/api/dev/optimise-prompt/route.ts`** — Dev-only endpoint. Mirrors production Call 3 route but returns all stages:

```json
{
  "stage_p_preflight": { "decision": "GPT_REWRITE", "anchors": {...} },
  "stage_r_raw_gpt": { "optimised": "...", "negative": "..." },
  "stage_g_compliance": { "optimised": "...", "changes": [...] },
  "stage_a_aps": { "score": 0.94, "verdict": "ACCEPT_WITH_WARNING", ... },
  "stage_x_regression": { "passed": true, "regressions": [] },
  "stage_f_final": { "optimised": "...", "negative": "...", "changes": [...] },
  "metadata": { "model_version": "...", "latency_ms": ..., "platform": "..." }
}
```

Security: same pattern as Call 2 dev endpoint (env-gated, auth-gated, 404 not 401).

**`src/lib/call-3-harness/mechanical-scorer.ts`** — Per-platform mechanical scorer. Rules derived from each platform's `allowedTransforms` in the DNA profile.

**`src/lib/call-3-harness/inventory-writer.ts`** — Extends Call 2 inventory schema with platform-specific fields (APS score distribution, retry rate, rescue dependency at Stage R vs Stage F).

**`scripts/run-call3-harness.ts`** — Runner script. Accepts `--platform` or `--tier` flag.

### 14.3 Existing features preserved

**Yes.** All new files. The production Call 3 route is not modified. The dev endpoint imports from the same modules.

---

## 15. Phase 11 — Full harmony pass

### 15.1 Goal

All 40 platforms verified across 3 scene categories using the Call 3 harness and BQI scoring.

### 15.2 Process

For each platform:

1. Run Call 3 harness (smoke_alarm run)
2. Run BQI batch (3 scenes × 3 replicates)
3. Compute headroom fraction
4. If headroom fraction ≥ 50%: verify with dual assessment, lock builder
5. If headroom fraction < 50%: switch to deterministic or `pass_through`
6. Update DNA profile: `assembledBaseline`, `optimisedScore`, `availableHeadroom`, `harmonyStatus: 'verified'`

### 15.3 Exit criteria

All 40 platforms have `harmonyStatus: 'verified'` with either a measured headroom fraction ≥ 50% or an explicit `pass_through` justification.

---

## 16. Cross-phase notes

### 16.1 Existing features preserved

**Yes, throughout.** The Call 3 route is modified incrementally in Phases 2, 5, 8 but the response shape is unchanged, all 40 platforms continue working, and the AI Disguise principle is maintained. No user-facing strings change.

### 16.2 Verification commands (PowerShell from frontend folder)

After every phase:

```powershell
pnpm run test:util
pnpm run lint
pnpm run typecheck
pnpm run build
```

All four must pass. Cache cleared on deploy: `Remove-Item -Recurse -Force .next`.

### 16.3 Cost discipline

CLIP transforms (Phases 3–5) add zero API cost — all deterministic. The APS gate (Phase 2) adds zero cost — it evaluates GPT's existing output. The retry protocol (Phase 8) adds cost only for retry-enabled platforms on first-attempt rejection (~15–25% of calls on ~4 platforms). Harmony Pass 2.0 (Phase 6) uses BQI batch runner at existing cost (~$0.50–$1.00 per full batch).

### 16.4 What does not get built

Per architecture §14:

- No cross-call (Call 2 → Call 3) end-to-end optimisation
- No automatic builder file generation
- No user-facing quality scores
- No A/B testing in production
- No image generation in the automated pipeline

---

## 17. Quick-start for the new chat

When the new chat opens:

1. Read `call-3-quality-architecture-v0.2.0.md` end to end. Architecture is frozen.
2. Read this build plan end to end.
3. Extract `src.zip` and verify the files in §3 (reuse map) exist as expected.
4. Confirm Martin's pre-flight items from §2.
5. Start Phase 1 (Platform DNA profiles).
6. Pause after each phase. Run verification. Confirm with Martin before advancing.
7. Stop after Phase 5 (core quality spine) and measure CLIP gains before proceeding to Phases 6–11.

**Default behaviour:** be the same Claude that wrote v0.2.0 and v1.0.0. Same voice, same standards, same instinct to flag architectural concerns immediately. Read `code-standard.md` and `best-working-practice.md` before writing code. Desktop-only, no grey text, clamp() sizing on any UI-touching code.

---

## 18. What Martin should expect

Phase 1 is data entry — thorough but mechanical. Phases 2–4 are the novel work — APS gate, attention sequencing, semantic compression. Phase 5 is the wiring that makes it all live. The ☆ milestone after Phase 5 is the first real measurement moment.

Don't be surprised if the first CLIP measurement shows smaller gains than the architecture predicts. The attention curve hypothesis (§3.2) is a working hypothesis — the algorithm might need calibration. That's the point of measuring before proceeding.

The honest expectation: the deterministic transforms (CLIP attention sequencing, semantic compression, fragment merging) will produce a genuine quality gain on CLIP platforms. The APS gate will catch GPT degradation more precisely than the current regression guard. Together, these two improvements address the two biggest problems: CLIP platforms gaining too little, and NL platforms being actively degraded.

End of build plan.
