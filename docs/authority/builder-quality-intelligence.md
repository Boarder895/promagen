# Builder Quality Intelligence System (formerly Call 4 Scoring)

**Version:** 2.5.0 (FINAL)  
**Created:** 1 April 2026  
**Updated:** 3 April 2026  
**Owner:** Promagen  
**Status:** Architecture finalised. Three ChatGPT reviews incorporated (97/100). Signed off. 10 scenes complete. BUILD APPROVED.  
**Authority:** This document defines the automated quality regression system for Call 3 platform builders.

> **Cross-references:**
>
> - `api-3.md` — Call 3 architecture, 43 independent builders
> - `prompt-optimizer.md` v6.0.0 — Builder inventory, compliance gates
> - `harmonizing-claude-openai.md` v3.0.0 — Three-assessor scoring methodology
> - `platform-config.json` + `platform-config.ts` — Platform SSOT (40 platforms)
> - `human-factors.md` — NOT referenced (this system is internal, no user-facing UI)

---

## 1. Purpose

Call 3 has 43 independent platform builder files. Each builder has a system prompt that GPT-5.4-mini executes at runtime. When a builder is updated, there is currently no automated way to verify that the update improved quality or introduced a regression. Testing is manual, slow, and relies on Martin running prompts through the Playground.

This system automates that. It runs curated test scenes through the full pipeline (Call 2 → Call 3 → Scoring), stores results in Postgres, and surfaces quality trends per platform. Over time, it identifies recurring failure patterns and proposes builder fixes — with a human approval gate before any change ships.

**What this replaces:** The user-facing "§ The Score" section in the right rail Glass Case is **killed**. No score badge, no axis bars, no directives visible to the user. The scoring route (`/api/score-prompt`) is repurposed as an internal quality tool.

**Why the user-facing score was killed:** Call 4 scored Call 3's output, but the only person who could act on the feedback was the user — and their input was already correct. The engine dropped anchors, the score blamed the user. Directives like "restore the original colour" made no sense because the user never changed anything. The calls were fighting each other.

---

## 2. Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                   BUILDER QUALITY INTELLIGENCE                    │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Test Scenes (8 core + 2 holdout)                                 │
│       │                                                           │
│       ▼                                                           │
│  Snapshot Freeze (Call 2 → frozen assembled prompts)              │
│       │                                                           │
│       ▼                                                           │
│  Batch Runner (script or cron)                                    │
│       │                                                           │
│       ├── Call 3: optimise per platform (frozen input) ──────┐    │
│       │                                                      │    │
│       ├── Score (GPT-5.4-mini) ─────────────────────────────┤    │
│       │                                                      │    │
│       ├── Score (Claude — switchable) ──────────────────────┤    │
│       │                                                      │    │
│       ▼                                                      ▼    │
│  Postgres: builder_quality_runs + builder_quality_results         │
│       │                                                           │
│       ▼                                                           │
│  Pattern Detection (human-assisted, Phase 3)                      │
│       │                                                           │
│       ├── Per-platform rolling averages                           │
│       ├── Recurring failure identification                        │
│       ├── Score divergence flags (GPT vs Claude > 8pts)          │
│       │                                                           │
│       ▼                                                           │
│  Admin Dashboard (/admin/builder-quality)                         │
│       │                                                           │
│       ▼                                                           │
│  Human Review → Approve/Reject → Builder Update                   │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

### Key architectural decisions:

1. **Frozen Call 2 inputs.** When testing Call 3 builders, the assembled prompt input is frozen from a prior Call 2 snapshot. This isolates builder quality from Call 2 variance.

2. **3 replicates for decision-grade runs.** A single run is diagnostic only. For "should I ship this builder change" decisions, 3 replicates per scene are required. Store mean, min, max, and standard deviation.

3. **Dual-model scoring is switchable.** Three modes: `gpt_only` (default, day one), `dual_on_flagged` (Claude runs when GPT flags issues), `dual_full` (both models on every run, for release candidates).

4. **Raw vs post-processed scoring.** Store both the raw Call 3 output (before compliance gates) and the post-processed output. This distinguishes "the builder dropped an anchor" from "the compliance gate fixed it."

5. **Phase 3 is human-assisted patch suggestion, not autonomous self-improvement.** The system clusters recurring failures, suggests candidate fixes, and auto-tests them. Martin reviews and approves. No automatic deployment of system prompt changes.

6. **Anchor audit uses three levels, not boolean.** Each expected anchor is classified as `exact`, `approximate`, or `dropped`. Defined by a strict matching policy (§3.2).

7. **Anchors have severity weights.** Each expected anchor is tagged `critical`, `important`, or `optional`. Decision thresholds weight by severity.

8. **2 hidden holdout scenes** are reserved for validation only. Never used during builder tuning. Their purpose is to detect overfitting.

---

## 3. Test Scene Library

8 core scenes + 2 holdout scenes.

Core scenes stored in `src/data/scoring/test-scenes.json`.  
Holdout scenes stored separately in `src/data/scoring/holdout-scenes.json` — never shared with ChatGPT, never used during builder tuning.

### 3.1 Scene Data Structures

```typescript
interface TestScene {
  id: string;
  name: string;
  humanText: string;
  expectedAnchors: AnchorSpec[];
  stressTarget: string;
  categoriesExpected: string[];
  holdout: boolean;
}

interface AnchorSpec {
  term: string;
  severity: 'critical' | 'important' | 'optional';
}

interface AnchorAuditEntry {
  anchor: string;
  severity: 'critical' | 'important' | 'optional';
  status: 'exact' | 'approximate' | 'dropped';
  note?: string;
}
```

### 3.2 Approximate Anchor Matching Policy

The `approximate` status is the most subjective classification. Without strict rules it becomes a fudge bucket. These rules define what counts and what doesn't.

**Counts as `exact`:**
- Literal string match (case-insensitive)
- Match with minor punctuation/whitespace differences

**Counts as `approximate`:**
- Recognised synonym that preserves visual meaning ("crimson" → "deep red")
- Morphological variant ("running" → "runs", "fallen" → "falling")
- Reordered phrase that preserves all content words ("red torii gates" → "torii gates in red")
- Compressed equivalent that keeps the specific noun ("matte-black tactical trench coat" → "black tactical trench coat")

**Counts as `dropped`:**
- Generic abstraction ("Kodak Vision3 500T" → "film stock")
- Colour generalisation ("turquoise" → "blue", "acid-green" → "green")
- Noun class substitution ("torii gates" → "archway", "fox shrine" → "temple")
- Complete omission — anchor term not present in any form
- Meaning inversion ("no smoke" → "smoke rising")
- Flattened to category label ("cinematic wide-angle view" → "wide shot")

**When in doubt:** classify as `dropped`. False negatives (missed problems) are worse than false positives (flagged non-issues) for a regression tool.

**Sub-rule A — Visually distinctive modifier loss:**
If the dropped modifier is the visually distinctive part of the anchor, classify as `dropped`, not `approximate`. Example: "ornate black armor" → "black armor" = `dropped` (ornate is the visual differentiator). "tall blue lamp" → "blue lamp" = `approximate` (tall is not the distinctive element, blue is).

**Sub-rule B — Distinctive-token loss in multi-word anchors:**
If the specific token that makes the anchor unique is lost, the whole anchor is `dropped`. Example: "French New Wave" → "French art film" = `dropped` (New Wave is the distinctive identifier). "rule-of-thirds framing" → "cinematic framing" = `dropped` (rule-of-thirds is the specific technique).

**Sub-rule C — Negative anchors are stricter than positive anchors:**
Negative anchors only count as `approximate` when the absence is stated unambiguously. Implicit absence does not count. Example: "no smoke" → "smokeless chimney" = `approximate`. "no smoke" → "clear chimney" = `dropped` (absence is implied, not stated). "no people" → "empty scene" = `dropped` (implicit).

**Sub-rule D — Proper nouns, model names, and titled references:**
Proper nouns, camera models, film stocks, branded references, and titled works are `exact`-or-`dropped`. There is no `approximate` for these. Example: "Kodak Vision3 500T" → "Kodak film" = `dropped`. "Ghost in the Shell" → "anime cyberpunk" = `dropped`. "Arriflex 35BL" → "vintage Arriflex" = `exact` (brand preserved, model trivially shortened). "Blade Runner 2049" → "Blade Runner" = `dropped` (the sequel is not the original).

**Sub-rule E — Compound anchors with multiple distinctive modifiers:**
When an anchor contains multiple distinctive modifiers, loss of any modifier that materially changes the visual identity classifies the anchor as `dropped`. Example: "matte-black tactical trench coat" → "black trench coat" = `dropped` (matte-black and tactical both carry visual information). "warm amber glow of sodium streetlamps" → "warm streetlights" = `dropped` (amber, glow, and sodium are all visually distinctive). The test: would an image generator produce a noticeably different result without the lost modifier? If yes, the anchor is `dropped`.

---

### Scene 1 — Minimal Input

**Human text:** "A red ball."

**Expected anchors:**

| Anchor | Severity |
|--------|----------|
| red | critical |
| ball | critical |

**Stress target:** Over-embellishment of sparse input. Does Call 3 pad a 2-word input with invented context?

**Categories covered:** 1 (subject only)

---

### Scene 2 — Dense Multi-Anchor (Cyberpunk Courier)

**Human text:** "A cyberpunk courier on a motorcycle weaving through neon-lit rain"

**Expected anchors:**

| Anchor | Severity |
|--------|----------|
| cyberpunk | critical |
| courier | critical |
| motorcycle | critical |
| weaving | important |
| neon | important |
| rain | important |

**Stress target:** Anchor preservation under moderate complexity. Standard benchmark.

**Categories covered:** 5-6 (subject, action, style, lighting, atmosphere, environment)

---

### Scene 3 — Sacred Architecture (Fox Shrine)

**Human text:** "A fox shrine in autumn with red torii gates and falling maple leaves"

**Expected anchors:**

| Anchor | Severity |
|--------|----------|
| fox shrine | critical |
| torii gates | critical |
| red | important |
| autumn | important |
| maple leaves | important |
| falling | optional |

**Stress target:** Cultural noun preservation. "Torii gates" must not become "archway."

**Categories covered:** 5 (subject, environment, colour, materials, atmosphere)

---

### Scene 4 — Colour Saturation

**Human text:** "An explosion of neon colors: a shiny purple sports car parked on a street made of glowing orange bricks, with bright pink palm trees lining the sidewalk, turquoise buildings covered in yellow graffiti, emerald-green streetlights, and a sky swirling with magenta, cyan, and lime clouds all reflecting off a massive rainbow puddle on the ground."

**Expected anchors:**

| Anchor | Severity |
|--------|----------|
| purple | critical |
| orange | critical |
| pink | critical |
| turquoise | critical |
| yellow | important |
| emerald-green | important |
| magenta | important |
| cyan | important |
| lime | important |
| rainbow | optional |

**Stress target:** Colour anchor survival. Every named colour must survive.

**Categories covered:** 6-7 (subject, environment, colour, materials, lighting, atmosphere, style)

---

### Scene 5 — Spatial Relationships

**Human text:** "A wooden desk in the center of the room. On the left side of the desk sits a tall blue lamp. Directly in front of the lamp is a small green notebook. Behind the notebook and slightly to the right is a red coffee mug. Above the entire desk hangs a yellow clock whose hands point toward the mug. A black chair is positioned under the desk, and a white window is visible on the wall behind the chair."

**Expected anchors:**

| Anchor | Severity |
|--------|----------|
| center of the room | critical |
| left side | critical |
| in front of | critical |
| behind | critical |
| slightly to the right | important |
| above | important |
| under | important |
| behind the chair | important |

**Stress target:** Spatial preposition survival. Relative positions define the composition.

**Categories covered:** 7+ (subject, environment, composition, colour, materials, lighting)

---

### Scene 6 — Negative Trigger

**Human text:** "A quiet mountain cabin at dusk with warm lights inside, but no smoke coming from the chimney, no people or animals anywhere, no snow on the roof, no trees near the cabin, and no stars visible in the sky above it."

**Expected anchors:**

| Anchor | Severity |
|--------|----------|
| no smoke | critical |
| no people | critical |
| no animals | critical |
| no snow | important |
| no trees | important |
| no stars | important |
| mountain cabin | critical |
| dusk | important |
| warm lights | important |

**Stress target:** Explicit negative handling across all negative support types.

**Categories covered:** 5+ (subject, environment, lighting, atmosphere, negative)

---

### Scene 7 — Compression Stress Test

**Human text:** "A hyper-detailed nocturnal cyberpunk Tokyo alleyway at 2 AM during a relentless neon-drenched downpour, featuring a solitary female cyber-samurai in a form-fitting matte-black tactical trench coat with glowing crimson circuitry patterns and a katana hilt wrapped in weathered leather, standing on rain-slicked cobblestones between towering holographic billboards displaying animated kanji in electric magenta, cyan, and acid-green, flanked by rusted vending machines overflowing with glowing energy drinks and half-eaten ramen bowls, intricate steam rising from grated manholes under flickering orange sodium streetlamps, distant flying delivery drones with pulsing blue underlights weaving between dense overhead power lines tangled with cherry-blossom petals caught in the wind, foreground puddles reflecting the chaotic scene with perfect mirror-like clarity and subtle oil-slick rainbows, background silhouettes of salarymen in transparent umbrellas hurrying past a dimly lit ramen stall with steaming pots and red paper lanterns, volumetric god rays piercing the thick fog from a massive floating digital billboard advertising futuristic implants in vibrant violet and gold, ultra-realistic textures on every surface including water droplets beading on metallic surfaces, fabric folds, and weathered concrete cracks, cinematic composition with rule-of-thirds framing, extreme depth of field keeping the samurai razor-sharp while the alley recedes into soft atmospheric bokeh, moody low-key lighting with high contrast, intricate details like subtle facial tattoos glowing faintly under her hood, scattered discarded holographic newspapers fluttering in the breeze, and a single ancient torii gate partially visible in the mist at the alley's end, rendered in photorealistic 8K resolution with the combined stylistic influences of Blade Runner 2049, Ghost in the Shell, and Syd Mead's concept art, evoking a tense atmosphere of cyber-noir mystery, melancholy, and quiet resilience."

**Expected anchors:**

| Anchor | Severity |
|--------|----------|
| cyber-samurai | critical |
| matte-black tactical trench coat | critical |
| crimson circuitry | critical |
| ancient torii gate | critical |
| Blade Runner 2049 | important |
| Ghost in the Shell | important |
| Syd Mead | important |
| acid-green | important |
| oil-slick rainbows | important |
| rule-of-thirds | important |
| bokeh | optional |
| facial tattoos | optional |

**Stress target:** Compression under extreme density (~1,800 chars). What does Call 3 sacrifice first?

**Categories covered:** All 12

---

### Scene 8 — Style/Medium Preservation (French New Wave)

**Human text:** "A pristine 35mm film still from an unreleased 1974 French New Wave drama, shot on Kodak Vision3 500T stock with a vintage Arriflex 35BL camera, depicting a solitary woman in a faded red wool coat standing motionless on a rain-slicked Parisian bridge at twilight, her reflection perfectly mirrored in the Seine below, distant Eiffel Tower glowing softly through atmospheric haze, wet cobblestones catching the warm amber glow of sodium streetlamps, scattered autumn leaves drifting in the current, subtle film grain, natural light leaks along the left edge, faint sprocket marks, and gentle vignetting characteristic of analog cinema, captured with shallow depth of field and authentic 1970s color grading, every frame detail preserved exactly as if pulled straight from a developed negative in a Parisian darkroom."

**Expected anchors:**

| Anchor | Severity |
|--------|----------|
| 35mm film still | critical |
| French New Wave | critical |
| Kodak Vision3 500T | critical |
| Arriflex 35BL | critical |
| faded red wool coat | important |
| Seine | important |
| Eiffel Tower | important |
| film grain | important |
| light leaks | important |
| sprocket marks | important |
| vignetting | optional |
| 1970s color grading | important |
| 1974 | optional |

**Stress target:** Analog film terminology, camera model names, and period-specific references that builders love to flatten.

**Categories covered:** 8+ (subject, environment, style, camera, lighting, colour, atmosphere, materials, fidelity)

---

### Scene 9 — Multi-Subject Hierarchy & Temporal (HOLDOUT)

**Human text:** "In the foreground, the primary subject — a lone samurai in ornate black armor — leaps mid-turn from a crumbling temple roof just before impact with the stone courtyard below, katana raised; secondary subjects include two startled monks in saffron robes frozen in the midground; in the background, a violent storm rages as lightning strikes the distant pagoda, wind-whipped cherry blossoms blurring in motion while dramatic god rays slice through the churning clouds."

**Expected anchors:**

| Anchor | Severity |
|--------|----------|
| lone samurai | critical |
| ornate black armor | critical |
| mid-turn | critical |
| just before impact | critical |
| katana raised | important |
| two startled monks | critical |
| saffron robes | important |
| midground | important |
| lightning strikes | important |
| distant pagoda | important |
| cherry blossoms | optional |
| god rays | optional |
| foreground | critical |
| background | critical |

**Stress target:** Two things at once. First: multi-subject hierarchy — primary (samurai), secondary (monks), background (storm/pagoda). Builders must preserve importance order, not just nouns. Second: temporal/motion specificity — "mid-turn", "just before impact", "frozen in the midground". Builders often collapse timing into static description.

**Categories covered:** 8+ (subject, action, environment, composition, lighting, atmosphere, materials, style)

**Holdout:** YES — never used for tuning.

---

### Scene 10 — Typical Real-World User Input (HOLDOUT)

**Human text:** "a cute golden retriever puppy running through a sunny park chasing a red ball, some kids laughing in the background, green grass and trees everywhere, blue sky with a few clouds, make it really happy and bright like a nice summer day"

**Expected anchors:**

| Anchor | Severity |
|--------|----------|
| golden retriever puppy | critical |
| running | important |
| sunny park | critical |
| red ball | critical |
| kids laughing | important |
| background | important |
| green grass | important |
| blue sky | important |
| summer day | optional |

**Stress target:** Normal person input. Not a stress test, not an edge case. Natural, slightly messy, slightly vague. Tests whether builders handle ordinary usage well without over-embellishing or stripping the casual tone. The phrase "make it really happy and bright" is a mood directive, not a visual anchor — builders should translate it into visual terms without dropping the concrete nouns.

**Categories covered:** 4-5 (subject, action, environment, atmosphere, colour)

**Holdout:** YES — never used for tuning.

---

## 4. Frozen Input Snapshots

**Problem:** Call 2 is non-deterministic (temperature 0.5). If the assembled prompt changes between runs, Call 3 score changes can't be attributed to the builder.

**Solution:** Freeze Call 2 outputs.

### Snapshot workflow:

1. **Generate snapshots:** Run all 8 core scenes through Call 2 once per tier. Store the assembled prompts.
2. **Freeze:** These become the fixed input for all Call 3 regression runs.
3. **Refreeze when Call 2 changes.** If the Call 2 system prompt is updated, regenerate all snapshots. Tag with Call 2 version.
4. **Freshness rule:** Snapshots older than 30 days trigger a dashboard warning. Call 2 version change = mandatory refreeze.

### Storage:

```typescript
interface FrozenSnapshot {
  sceneId: string;
  tier: 1 | 2 | 3 | 4;
  call2Version: string;
  assembledPrompt: string;
  snapshotHash: string;          // MD5 of assembledPrompt content
  createdAt: string;
}
```

Stored in `src/data/scoring/frozen-snapshots.json`. Committed to repo.

### When Call 2 IS being tested:

Run in `pipeline` mode. Call 2 runs fresh, output feeds Call 3, whole pipeline scored end-to-end.

### Holdout scene snapshots:

Generated and frozen separately. Stored in `src/data/scoring/holdout-snapshots.json`. Same workflow, same freshness rules.

---

## 5. Scoring Route Changes

The existing `/api/score-prompt/route.ts` (v1.3.0) is **retained and adapted**.

### 5.1 Auth: Internal protection
A server-side API key (`X-Builder-Quality-Key`) protects the route from external access. Core build requirement, not a later hardening item.

### 5.2 System prompt: Reframed
Directives become **builder diagnostic notes** for the developer, not the user.

- ❌ "Restore the original 'cinematic wide-angle view'"
- ✅ "Call 3 dropped 'cinematic' from user anchor 'cinematic wide-angle view' — only camera angle survived"

### 5.3 Response schema: Enhanced anchor audit

```typescript
anchorAudit: Array<{
  anchor: string;
  severity: 'critical' | 'important' | 'optional';
  status: 'exact' | 'approximate' | 'dropped';
  note?: string;
}>
```

Matching follows the strict policy in §3.2. When in doubt, classify as `dropped`.

### 5.4 Scorer mode configuration

```typescript
type ScorerMode = 'gpt_only' | 'dual_on_flagged' | 'dual_full';
```

- `gpt_only`: GPT only. Default. Day one.
- `dual_on_flagged`: GPT scores first. Claude auto-fires when ANY of these triggers hit:
  - GPT score < 70
  - Anchor preservation < 60%
  - Any critical anchor dropped
  - `post_processing_changed` is true AND the delta is substantive (compliance gate touched a critical/important anchor, or changed > 10% of the prompt by character count — trivial cleanup like trailing punctuation does not trigger)
  - Replicate standard deviation > 8 points
- `dual_full`: Both models score every result. For release candidates.

### 5.5 Rate limit
Batch runner (server-side key): 200/hour. Client-side (transition): 30/hour.

---

## 6. Database Schema

Two tables, `CREATE TABLE IF NOT EXISTS` pattern.

### 6.1 Runs table (parent)

```sql
CREATE TABLE IF NOT EXISTS builder_quality_runs (
  id              SERIAL PRIMARY KEY,
  run_id          TEXT NOT NULL UNIQUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ,
  
  -- Configuration
  mode            TEXT NOT NULL,                    -- 'builder' | 'pipeline'
  scope           TEXT NOT NULL,                    -- 'all' | platform ID
  scorer_mode     TEXT NOT NULL DEFAULT 'gpt_only', -- 'gpt_only' | 'dual_on_flagged' | 'dual_full'
  replicate_count SMALLINT NOT NULL DEFAULT 1,
  include_holdout BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Versioning (all mandatory)
  scorer_version  TEXT NOT NULL,
  scorer_prompt_hash TEXT NOT NULL,                 -- MD5 of scoring system prompt content
  gpt_model       TEXT NOT NULL,
  claude_model    TEXT,
  call2_version   TEXT,                             -- null in builder mode
  
  -- Comparison
  baseline_run_id TEXT,
  
  -- Status
  status          TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'running' | 'complete' | 'partial' | 'failed'
  total_expected  SMALLINT,
  total_completed SMALLINT DEFAULT 0,
  error_detail    TEXT,
  
  -- Summary
  mean_gpt_score  NUMERIC(5,2),
  mean_claude_score NUMERIC(5,2),
  flagged_count   SMALLINT DEFAULT 0
);
```

### 6.2 Results table (child)

```sql
CREATE TABLE IF NOT EXISTS builder_quality_results (
  id              SERIAL PRIMARY KEY,
  run_id          TEXT NOT NULL REFERENCES builder_quality_runs(run_id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- What was tested
  platform_id     TEXT NOT NULL,
  platform_name   TEXT NOT NULL,
  scene_id        TEXT NOT NULL,
  scene_name      TEXT NOT NULL,
  tier            SMALLINT NOT NULL,
  call3_mode      TEXT NOT NULL,
  builder_version TEXT NOT NULL,                    -- MD5 hash of builder file
  replicate_index SMALLINT NOT NULL DEFAULT 1,
  
  -- Snapshot provenance (builder mode only)
  snapshot_hash   TEXT,                             -- Hash of frozen assembled prompt used
  
  -- Prompts captured (full text)
  human_text      TEXT NOT NULL,
  assembled_prompt TEXT NOT NULL,
  raw_optimised_prompt TEXT NOT NULL,
  optimised_prompt TEXT NOT NULL,
  negative_prompt  TEXT,
  
  -- Hashes
  input_hash      TEXT NOT NULL,
  output_hash     TEXT NOT NULL,
  
  -- Length metrics
  assembled_char_count    SMALLINT NOT NULL,
  raw_optimised_char_count SMALLINT NOT NULL,
  optimised_char_count    SMALLINT NOT NULL,
  
  -- Post-processing effect
  post_processing_changed BOOLEAN NOT NULL DEFAULT FALSE,
  post_processing_delta   TEXT,
  
  -- GPT scores
  gpt_score       SMALLINT NOT NULL,
  gpt_axes        JSONB NOT NULL,
  gpt_directives  JSONB NOT NULL,
  gpt_summary     TEXT NOT NULL,
  
  -- Claude scores (nullable)
  claude_score    SMALLINT,
  claude_axes     JSONB,
  claude_directives JSONB,
  claude_summary  TEXT,
  
  -- Triangulated result
  median_score    SMALLINT,
  divergence      SMALLINT,
  flagged         BOOLEAN DEFAULT FALSE,
  
  -- Anchor audit
  anchor_audit    JSONB,
  anchors_expected SMALLINT,
  anchors_preserved SMALLINT,
  anchors_dropped SMALLINT,
  critical_anchors_dropped SMALLINT,
  
  -- Source and status
  source          TEXT NOT NULL DEFAULT 'batch',    -- 'batch' | 'user_sample'
  status          TEXT NOT NULL DEFAULT 'complete', -- 'complete' | 'error'
  error_detail    TEXT,
  is_holdout      BOOLEAN NOT NULL DEFAULT FALSE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bqr_platform_created 
  ON builder_quality_results (platform_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bqr_run 
  ON builder_quality_results (run_id);
CREATE INDEX IF NOT EXISTS idx_bqr_flagged 
  ON builder_quality_results (flagged) WHERE flagged = TRUE;
CREATE INDEX IF NOT EXISTS idx_bqr_scene
  ON builder_quality_results (scene_id, platform_id);
CREATE INDEX IF NOT EXISTS idx_bqr_critical_drops
  ON builder_quality_results (critical_anchors_dropped) 
  WHERE critical_anchors_dropped > 0;
CREATE INDEX IF NOT EXISTS idx_bqr_holdout
  ON builder_quality_results (is_holdout) WHERE is_holdout = TRUE;
```

---

## 7. Batch Runner

**Location:** `scripts/builder-quality-run.ts`  
**Execution:** `npx tsx scripts/builder-quality-run.ts` or cron.

### Arguments:

| Flag | Effect |
|------|--------|
| `--platform <id>` | Single platform |
| `--all` | All 40 platforms |
| `--mode builder` | Frozen input (default) — tests Call 3 only |
| `--mode pipeline` | Fresh Call 2 — tests entire pipeline |
| `--replicates 3` | Runs per scene (default: 1 diagnostic, 3 decision-grade) |
| `--scorer gpt_only` | GPT only (default) |
| `--scorer dual_on_flagged` | Claude auto-fires on triggers |
| `--scorer dual_full` | Both models always |
| `--holdout` | Include holdout scenes |
| `--baseline <run_id>` | Link to prior run for comparison |
| `--rerun <run_id>` | Rerun only failed results from a prior run |
| `--resume <run_id>` | Resume a partial/crashed run |

### Pipeline per platform per scene per replicate:

1. **Load input:** `builder` mode = frozen snapshot. `pipeline` mode = fresh Call 2.
2. **Call 3:** Capture raw output (before compliance gates) and post-processed output.
3. **Compute post-processing delta.**
4. **Score (GPT).**
5. **Score (Claude, if mode requires it).**
6. **Anchor audit:** Classify each expected anchor as `exact`, `approximate`, or `dropped` per §3.2 policy.
7. **Store.** Update run `total_completed`.

### Rerun / Resume rules:

- **`--rerun <run_id>`:** Creates a new child run linked to the original. Runs only results with `status: 'error'` from the original run. New results are stored with the new `run_id` but reference the original for comparison.
- **`--resume <run_id>`:** Continues a `running` or `partial` run. Skips scene+platform+replicate combinations that already have `status: 'complete'` results. Updates the original run's `total_completed`.
- **Stale detection:** Dashboard warns for runs with `status: 'running'` older than 1 hour.

### Decision thresholds:

**Regression** (flag for review):
- Mean score drops ≥ 5 points AND any critical anchor previously preserved is now dropped
- OR mean score drops ≥ 8 points regardless of anchor changes

**Improvement** (safe to ship):
- Mean score rises ≥ 3 points AND no previously preserved critical/important anchor is now dropped

### Builder version:

MD5 hash of the builder file content. Computed at runtime. Deterministic.

### Error handling:

- Single failure: log, mark result `error`, continue.
- \> 50% errors: mark run `partial`.
- Crash: run stays `running`. Dashboard warns after 1 hour.

### Holdout cadence:

Holdout scenes run:
- On every release candidate run
- Monthly (scheduled)
- After any patch that targets a weakness found in core scenes
- Never during builder tuning or diagnostic runs

### Cost estimate:

- 8 core scenes × 40 platforms × 1 replicate = 320 runs per full batch
- Builder mode, gpt_only: 2 API calls per run → 640 calls, ~$0.50–$1.00
- With 3 replicates: ~$1.50–$3.00
- With Claude (dual_full): add ~$0.20–$0.50
- Single platform: 8 scenes × 3 replicates = 24 calls, under $0.10
- Holdout addition: +2 scenes × 40 platforms = +80 runs

---

## 8. Dual-Model Scoring

### Launch strategy:

- **Day one:** `gpt_only`.
- **Phase 2:** `dual_on_flagged` for normal, `dual_full` for release candidates.
- **Schema supports all modes from the start.**

### Claude: Anthropic API direct. `claude-haiku-4-5-20251001`. Same rubric.

### Divergence:

| Gap | Action |
|-----|--------|
| 0–4 pts | Agreement. Median. |
| 5–8 pts | Minor. Median. Log. |
| 9+ pts | Flagged. Dashboard. Manual review. |

---

## 9. Admin Dashboard

**Route:** `/admin/builder-quality`  
**Access:** Admin-only.

### Views:

**9.1 Platform Overview:** 40 platforms sorted by median score (lowest first). Columns: name, tier, latest median, 7-day trend, anchor preservation %, critical drops, flagged count, last run.

**9.2 Platform Detail:** Scene results, trend line, recurring directives, anchor audit with severity, raw vs post-processed comparison, post-processing reliance.

**9.3 Flagged Divergences:** GPT vs Claude > 9pts.

**9.4 Run History:** Timestamp, scope, status, scorer mode, replicates, baseline linkage, summary.

**9.5 Replicate Variance:** Mean/min/max/stddev per scene. High variance = unstable builder.

**9.6 Post-Processing Reliance:** Platforms where `post_processing_changed` > 50% of runs.

**9.7 Holdout Results:** Separate view. Never mixed with core scene trend lines. Shows whether builder improvements generalise to unseen input.

**Hard rule:** Builder-mode and pipeline-mode results are never mixed in the same trend line. Separate views, clearly labelled.

---

## 10. Real User Sampling (Phase 2)

After batch system is stable. Sample one per platform per day from Community Pulse copies. Score by active scorer mode. Store with `source = 'user_sample'`. Dashboard shows rolling 7-day average alongside batch scores.

---

## 11. Human-Assisted Patch Suggestion (Phase 3)

**NOT autonomous.** Human-assisted only.

**Prerequisites:** 50+ results per platform. 3+ stable scorer versions. Enough failures to cluster.

**Can do:** Cluster failures, surface weak rules, suggest simple edits, auto-test candidates, show deltas.

**Cannot do:** Infer deep causal issues, rewrite complex builders, guarantee no overfitting.

**Overfitting check:** If a proposed patch improves core scene scores but regresses holdout scene scores, it's overfitting. Reject.

**Timing:** Do not build early. Only after scoring pipeline produces stable, believable signals.

---

## 12. User-Facing Changes

### 12.1 Score section killed

`XRayScore` removed from `pipeline-xray.tsx`. `usePromptScore` removed from `playground-page-client.tsx`. Auto-fire `useEffect` removed. `SectionWire` before Score removed. Right rail: Decoder → Switchboard → Alignment. Three sections.

### 12.2 No replacement UI

No score visible to the user. The product produces good prompts — it doesn't grade its own work in front of the customer.

---

## 13. Build Order

| Part | Scope | Effort |
|------|-------|--------|
| **1** | Test scene JSON (8 core + 2 holdout + anchors with severity) | 1 hr |
| **2** | Kill user-facing score (XRayScore, hook, auto-fire, SectionWire) | 1 hr |
| **3** | DB schema + route hardening (tables, server-side key) | 2 hrs |
| **4** | Reframe scoring prompt (diagnostics, three-level audit, §3.2 policy) | 2–3 hrs |
| **5** | Frozen snapshot generator | 2 hrs |
| **6** | Batch runner (Call 3 → Score, single + full, error handling) | 5–7 hrs |
| **7** | Replicate support + variance + decision thresholds | 2–3 hrs |
| **8** | Admin dashboard (read-only, all views) | 5–7 hrs |
| **9** | Dual-model scoring (Claude, switchable modes, triggers) | 2–3 hrs |
| **10** | Rerun/resume mechanics | 1–2 hrs |
| **11** | User sampling | 2–3 hrs |
| **12** | Human-assisted patch suggestion | 5–7 hrs |

**Parts 1–6: Core. ~13–16 hours.**  
**Parts 7–12: Incremental. ~17–25 hours.**  
**Total: ~30–41 hours.**

---

## 14. What This Replaces

| Before | After |
|--------|-------|
| User sees score | User sees nothing |
| Call 4 fires per optimisation | Batch/cron/on-demand |
| Directives blame user | Directives diagnose builder |
| GPT only | Switchable: gpt_only / dual_on_flagged / dual_full |
| No history | Full Postgres with versioning |
| Manual testing | Automated regression with replicates |
| Boolean anchor audit | Three-level (exact/approximate/dropped) + severity |
| No overfitting check | 2 hidden holdout scenes |
| No rerun capability | Rerun failed / resume partial |

---

## 15. Non-Regression Rules

1. Removing XRayScore must not affect Decoder, Switchboard, or Alignment
2. Removing usePromptScore must not affect Call 1, 2, or 3 wiring
3. `/api/score-prompt` stays deployed — batch runner uses it
4. Batch runner runs offline, never during user sessions
5. Admin dashboard behind admin auth
6. No user-facing string references scoring or quality grades
7. Frozen snapshots committed to repo
8. Raw output stored alongside post-processed — never overwritten
9. Holdout scenes never used for tuning
10. `builder_version` is file hash, never free text
11. Builder-mode and pipeline-mode never mixed in trend lines
12. `approximate` classification follows §3.2 strictly — when in doubt, `dropped`

---

## 16. Acceptance Criteria (Core System Release Gate)

The core system (Parts 1–6) is "done" when:

- [ ] 8 core + 2 holdout scene JSON files pass TypeScript validation
- [ ] User-facing score killed — no XRayScore, no hook, no auto-fire, no SectionWire
- [ ] DB tables create successfully on fresh Postgres
- [ ] Route rejects requests without valid `X-Builder-Quality-Key`
- [ ] Route accepts requests with valid key
- [ ] Frozen snapshots generated for all 8 core scenes × 4 tiers
- [ ] Holdout snapshots generated separately
- [ ] One full batch run completes for all 40 platforms (`status: 'complete'`)
- [ ] One single-platform run completes for a known-weak builder
- [ ] Anchor audit correctly classifies `exact`, `approximate`, and `dropped` on fox shrine scene
- [ ] Anchor audit correctly classifies a borderline `approximate` case per §3.2 policy
- [ ] Dashboard renders platform overview sorted by score
- [ ] Dashboard renders run history with status indicators
- [ ] Dashboard separates builder-mode and pipeline-mode results
- [ ] One builder change shows measurable regression (score drop + critical anchor loss)
- [ ] One builder change shows measurable improvement (score rise, no critical loss)
- [ ] Error handling tested: partial run when Call 3 errors on one platform
- [ ] Raw vs post-processed difference visible in platform detail view
- [ ] Holdout scenes excluded from standard runs, included only with `--holdout` flag
- [ ] Holdout results displayed in separate dashboard view, not mixed with core trends

---

## Changelog

- **3 Apr 2026 (v2.5.0 FINAL):** ChatGPT sign-off: 97/100, "build it." Added Sub-rule E to §3.2: compound anchors with multiple distinctive modifiers — loss of any modifier that materially changes visual identity = `dropped`. Architecture complete. No further review required.
- **3 Apr 2026 (v2.4.0):** Final pre-build revision incorporating ChatGPT review round 3 (95/100, "build it"). Added 4 sub-rules to §3.2 Approximate Anchor Matching Policy: (A) visually distinctive modifier loss, (B) distinctive-token loss in multi-word anchors, (C) stricter negative anchor treatment — implicit absence does not count as approximate, (D) proper nouns and branded references are exact-or-dropped with no approximate middle ground. Refined `dual_on_flagged` post-processing trigger: Claude now fires only when the compliance gate delta is substantive (touched a critical/important anchor or changed > 10% of prompt), not on trivial cleanup like trailing punctuation.
- **3 Apr 2026 (v2.3.0):** All 10 scenes complete. Added Scene 9 (Multi-Subject Hierarchy & Temporal, holdout) and Scene 10 (Typical Real-World User Input, holdout). Added §3.2 Approximate Anchor Matching Policy with strict rules and examples. Added `--rerun` and `--resume` flags to batch runner with explicit rules (§7). Added `scorer_prompt_hash` to runs table. Added `snapshot_hash` to results table. Added `is_holdout` column + index to results table. Added `include_holdout` to runs table. Expanded `dual_on_flagged` triggers: critical anchor drop, post-processing delta, replicate variance (§5.4). Added holdout cadence rules (§7). Dashboard hard rule: builder-mode and pipeline-mode never mixed (§9). Added holdout results view (§9.7). Non-regression rule 11 (mode separation) and 12 (approximate defaults to dropped). Acceptance criteria expanded to 20 items including unhappy-path tests.
- **3 Apr 2026 (v2.2.0):** ChatGPT review round 2. Anchor audit three-level. Severity weighting. Baseline linkage. Length metrics. Post-processing tracking. Scorer modes. Route hardening moved to core.
- **3 Apr 2026 (v2.1.0):** ChatGPT review round 1. Frozen inputs. Replicates. Runs table. Versioning. Raw vs processed. Scene 7 + 8.
- **3 Apr 2026 (v2.0.0):** Pivot to internal system. User-facing score killed.
- **2 Apr 2026 (v1.3.0):** Auth removed, wiring fixed.
- **1 Apr 2026 (v1.0.0):** Initial implementation.
