# API Call 3 — Prompt Optimisation System

> **Authority document** — Governs the Call 3 optimisation pipeline end-to-end.
> Version 1.0.0 — 31 Mar 2026
> SSOT: `src.zip` — always believe the code over this doc if they conflict.

---

## 1. What Call 3 Does

Call 3 takes a tier prompt (from Call 2) and optimises it for a specific platform. The user has already selected a provider. Call 3 restructures the prompt to match that platform's syntax, length preferences, and capabilities.

Call 1 parses the sentence. Call 2 generates 4 tier prompts (no provider selected). Call 3 refines for the chosen provider.

---

## 2. The Three Numbers

Every platform has three character values in `platform-config.json`. These are the only numbers that matter for Call 3 length control.

| Field      | Purpose                                                                        | Who uses it                        | Enforcement                 |
| ---------- | ------------------------------------------------------------------------------ | ---------------------------------- | --------------------------- |
| `idealMin` | Quality floor — prompts shorter than this produce poor images on this platform | GPT (system prompt instruction)    | Soft warning in diagnostics |
| `idealMax` | Quality ceiling — prompts should aim for this or below for optimal results     | GPT (system prompt instruction)    | Soft warning in diagnostics |
| `maxChars` | Platform hard limit — the platform rejects or silently truncates above this    | Compliance gate (code enforcement) | Destructive trim            |

`idealMin` and `idealMax` are aspirational. GPT aims for them. Going slightly over `idealMax` is fine — the platform still accepts the prompt.

`maxChars` is the wall. The compliance gate enforces this in code to prevent silent platform-side truncation that the user can't control.

`sweetSpot` remains in the config for Call 2 and the standard builder. Call 3 builders do not use it.

---

## 3. The Zone System

The route computes a zone from the assembled prompt length and the three config numbers. The zone is injected into the **user message**, not the system prompt.

```
0 ──── idealMin ──── idealMax ──── maxChars ────→
   ENRICH       REFINE        PASS-THROUGH    HARD TRIM (gate)
```

| Zone     | Condition                          | What GPT is told                                                                                                                                     |
| -------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| ENRICH   | promptLength < idealMin            | "Output target: {idealMin}–{idealMax} chars. Your reference draft is {length} chars — room to add detail from the scene description."                |
| REFINE   | idealMin ≤ promptLength ≤ idealMax | "Output target: {idealMin}–{idealMax} chars. Your reference draft is {length} chars — focus on quality, restructure, strengthen."                    |
| COMPRESS | promptLength > idealMax            | "Output target: {idealMin}–{idealMax} chars. Your reference draft is {length} chars — tighten phrasing, remove filler, preserve all visual anchors." |

The zone applies to all 40 platforms — prose and CLIP/keyword. The directional signal is universal (too short / just right / too long). The platform-specific interpretation (how to enrich, refine, or compress) comes from each builder's system prompt.

Zone is computed in the route (`optimise-prompt/route.ts`). Builders do not compute zones — they build the fixed system prompt for their platform.

The compliance gate does not know or care about zones. It only enforces `maxChars`.

---

## 4. Architecture — GPT's Job vs Gate's Job

### GPT's Job (via system prompt + user message)

- Aim for `idealMin`–`idealMax` character range
- Preserve visual anchors from the scene description
- Restructure for the platform's syntax and style
- Use affirmative language only (no "without X" phrasing)
- Follow the zone direction (ENRICH / REFINE / COMPRESS)
- Strip forbidden syntax (weights, flags, CLIP tokens) in the rewrite
- Return valid JSON with optimised text, changes, charCount

### Gate's Job (compliance function in code)

- Strip unsupported syntax that GPT missed (weights, flags, CLIP tokens)
- Detect negative phrasing — log soft warning, do NOT strip destructively
- Enforce `maxChars` — only trim when the platform hard limit is exceeded
- Comma-preferred boundary trim when trimming is required
- Log diagnostics (above ideal range, below minimum, good density)
- Pass through clean prose untouched when under `maxChars`

The gate does NOT trim to `idealMax`. If GPT returns 263 chars and `maxChars` is 500, the gate passes it through with a soft diagnostic: `"Above ideal range (263/200 chars) — platform limit is 500"`.

---

## 5. Request Flow — Step by Step

### Step 1: User clicks "Optimise Prompt"

Frontend hook `useAiOptimisation` fires. Algorithm cycling animation starts. POST to `/api/optimise-prompt` with:

- `promptText` — the assembled tier prompt (Call 2 output for the active tier)
- `originalSentence` — the user's raw typed description
- `providerId` — e.g. `"artistly"`
- `providerContext` — full config from `platform-config.json` including `idealMin`, `idealMax`, `maxChars`, `negativeSupport`, `supportsWeighting`, `groupKnowledge`, etc.

**T4 NL platform input swap:** For NL platforms viewing Tier 4, the frontend sends the **T3 tier text** as `promptText` instead of T4. T3 text is richer and gives GPT more material to work with. Falls back to T4 if T3 is empty.

### Step 2: Route validates and rate-limits

Zod schema validates the request body. Rate limit: 30/hour in production, 200/hour in dev.

### Step 3: Build the system prompt

`resolveGroupPrompt(providerId, ctx)` resolves the provider to its builder:

- `platform-groups.ts` maps provider ID → group ID (e.g. `'artistly'` → `'nl-artistly'`)
- `resolve-group-prompt.ts` routes the group ID to the builder function
- Builder returns `{ systemPrompt, groupCompliance }`

The builder reads `ctx.idealMin`, `ctx.idealMax`, `ctx.maxChars`, `ctx.groupKnowledge` and interpolates them into the system prompt template. Zero hardcoded character limits.

### Step 4: Detect prose group

The route checks if the provider's group is prose-based:

- All `nl-*` groups → prose
- `recraft`, `ideogram`, `dalle-api`, `flux-architecture` → prose
- Video dedicated (`runway-dedicated`, `luma-ai-dedicated`, `kling-dedicated`) → prose
- SD CLIP dedicated (`stability-dedicated`, `dreamlike-dedicated`, `dreamstudio-dedicated`, `fotor-dedicated`, `lexica-dedicated`) → NOT prose
- `sd-clip-double-colon` (Leonardo) → NOT prose
- `midjourney` → NOT prose
- `novelai` → NOT prose

31 platforms are prose. 9 are CLIP/keyword.

### Step 5: Compute zone (NEW)

The route calculates the zone from `sanitisedPrompt.length`, `ctx.idealMin`, `ctx.idealMax`:

```typescript
const zone =
  promptLength < ctx.idealMin
    ? "ENRICH"
    : promptLength <= ctx.idealMax
      ? "REFINE"
      : "COMPRESS";
```

The zone and the three numbers are appended to the user message.

### Step 6: Build user message

**Prose groups (31 platforms):**

The original human sentence is the PRIMARY input. The assembled tier prompt is the secondary REFERENCE DRAFT. This prevents GPT from compressing an already-compressed input.

```
SCENE DESCRIPTION TO OPTIMISE FOR {PLATFORM}:
{originalSentence}

REFERENCE DRAFT (use as structural starting point, but enrich with ALL details from the scene description above):
{assembledTierPrompt}

OPTIMISATION CONTEXT:
Output target: {idealMin}–{idealMax} chars. Reference draft: {length} chars. Platform limit: {maxChars} chars.
Strategy: {ZONE} — {zone-specific instruction}
```

**CLIP/keyword groups (9 platforms):**

The assembled prompt is the PRIMARY input (it has correct syntax/weights). The original sentence is for intent reference.

```
ASSEMBLED PROMPT TO OPTIMISE:
{assembledTierPrompt}

ORIGINAL USER DESCRIPTION (for intent reference):
{originalSentence}

OPTIMISATION CONTEXT:
Output target: {idealMin}–{idealMax} chars. Reference draft: {length} chars. Platform limit: {maxChars} chars.
Strategy: {ZONE} — {zone-specific instruction}
```

**No original sentence provided:**

Falls back to assembled prompt only. ENRICH zone instruction omits "pull from scene description" since there's no scene to pull from.

### Step 7: Call GPT

- Model: `gpt-5.4-mini`
- Temperature: `0.4` for prose groups, `0.2` for CLIP/keyword groups
- Max completion tokens: `1200`
- Response format: `json_object`
- Messages: `[system prompt (from builder), user message (from route)]`

### Step 8: Validate GPT response

Parse JSON. Validate against ResponseSchema (Zod). Handles both `optimised` (UK) and `optimized` (US) spellings. Empty responses rejected.

### Step 9: Compliance pipeline

Three gates run in order:

**Gate 1 — Group-specific compliance** (from builder's `groupCompliance` function):

- Strips unsupported weight syntax (`(term:1.3)`, `term::1.3`, `{{{term}}}`)
- Strips MJ parameter flags (`--ar`, `--v`, `--no`, etc.)
- Strips CLIP quality tokens (`masterpiece`, `best quality`, `8K`, etc.)
- Detects negative phrasing — logs soft warning, does NOT destructively strip
- Enforces `maxChars` only — runs the trim pipeline if exceeded
- Logs soft warning if above `idealMax` but below `maxChars`
- Comma-preferred boundary trim when trimming fires

**Gate 2 — Negative contradiction guard:**

If GPT returned a negative prompt, strips terms that appear in both positive and negative. Only relevant for platforms with `negativeSupport: 'separate'` or `'inline'` (18 platforms).

**Gate 3 — Generic syntax enforcement** (`enforceT1Syntax`, always runs):

Safety net. Strips weight syntax that doesn't match the platform. Converts between parenthetical and double-colon formats. For platforms with `supportsWeighting: false`, strips any weights that survived the group gate.

### Step 10: Return result

`result.charCount` set to actual output length. Result returned as JSON. Frontend animation finishes and reveals the optimised prompt.

---

## 6. Compliance Gate Design

### What the gate strips (always)

- Weight syntax the platform doesn't support: `(term:1.3)`, `term::1.3`, `{{{term}}}`
- MJ parameter flags the platform doesn't use: `--ar`, `--v`, `--no`, `--stylize`, etc.
- CLIP quality tokens on platforms that don't benefit from them: `masterpiece`, `best quality`, `8K`, `4K`, `sharp focus`, `highly detailed`, `intricate textures`

### What the gate warns about (soft, non-destructive)

- Negative phrasing ("without X", "no X") on platforms with `negativeSupport: 'none'` — logged as `"Contains negative phrasing — platform does not support negatives"`. Not stripped because the regex is too destructive (e.g. `\bno\s+[^,.;:!?]+` turns "no clouds in the sky" into nothing).
- Output above `idealMax` but below `maxChars` — logged as `"Above ideal range (263/200 chars) — platform limit is 500"`.
- Output below `idealMin` — logged as `"Below ideal minimum (85/100 chars)"`.

### What the gate enforces (destructive, last resort)

- Output above `maxChars` — runs the trim pipeline to bring under the platform hard limit.

### Trim pipeline (only fires above maxChars)

5 stages, each preserving maximum content:

1. **Filler removal** — strips generic filler words (very, really, extremely, scene of, image of, etc.)
2. **Phrase tightening** — general compressions (at first light → at dawn, in the distance → beyond, etc.)
3. **Weak ending removal** — strips trailing low-value clauses (all in cinematic detail, in vivid detail, etc.)
4. **Clause drops** — removes trailing clauses matching generic quality/background/distant patterns. Catastrophe guard: rejects any single drop > 70 chars or any drop below `idealMin`.
5. **Hard boundary trim** — comma-preferred. Cuts at the last comma/semicolon/period before `maxChars`. Falls back to word boundary only if no structural break exists in the back 40%.

Dangling tail pruning runs after every stage — prevents ending on prepositions or conjunctions (and, or, with, of, in, etc.).

---

## 7. Stripping Rules by Config Flag

The compliance gate's behaviour is driven by `platform-config.json` flags, not hardcoded per builder. This is the systematic pattern.

| Config flag         | Value                       | Gate behaviour                                        |
| ------------------- | --------------------------- | ----------------------------------------------------- |
| `supportsWeighting` | `false` (35 platforms)      | Strip all weight syntax                               |
| `supportsWeighting` | `true` (5 platforms)        | Preserve weights in the platform's expected format    |
| `negativeSupport`   | `'none'` (22 platforms)     | Soft warning if negative phrasing detected            |
| `negativeSupport`   | `'separate'` (16 platforms) | Negatives are valid — no warning, no stripping        |
| `negativeSupport`   | `'inline'` (2 platforms)    | Negatives are valid inline — no warning, no stripping |

CLIP quality tokens are stripped on all NL/prose platforms. On CLIP platforms, the builder's system prompt decides whether to include or remove them.

---

## 8. Builder Pattern (SSOT Reference)

Every builder follows this pattern. Artistly (v4.0.0) is the reference implementation.

```typescript
export function buildPlatformPrompt(
  _providerId: string,
  ctx: OptimiseProviderContext,
): GroupPromptResult {
  // Read from config — never hardcode
  const idealMin = ctx.idealMin;
  const idealMax = ctx.idealMax;
  const hardCeiling = ctx.maxChars ?? 5000;
  const platformNote = ctx.groupKnowledge ?? "";

  const systemPrompt = `...
  TARGET OUTPUT RANGE: ${idealMin}–${idealMax} characters.
  ...
  ${platformNote ? `PLATFORM NOTE: ${platformNote}` : ""}
  ...`;

  return {
    systemPrompt,
    groupCompliance: createComplianceGate(idealMin, idealMax, hardCeiling),
  };
}
```

Key principles:

- Character limits interpolated from `ctx`, never hardcoded as constants
- `sweetSpot` not referenced — Call 3 uses `idealMin`, `idealMax`, `maxChars` only
- Compliance gate created via factory function with limits captured by closure
- Gate enforces `maxChars` (hard ceiling), not `idealMax` (quality target)
- System prompt is the platform's fixed rules — same every call for that platform
- Zone/delta is in the user message from the route — variable per call

---

## 9. File Inventory

### Route

| File                                   | Purpose                                                                                      |
| -------------------------------------- | -------------------------------------------------------------------------------------------- |
| `src/app/api/optimise-prompt/route.ts` | POST handler — validates, builds user message with zone, calls GPT, runs compliance pipeline |

### Builder infrastructure

| File                                                  | Purpose                                                                      |
| ----------------------------------------------------- | ---------------------------------------------------------------------------- |
| `src/lib/optimise-prompts/types.ts`                   | Shared types: `OptimiseProviderContext`, `GroupPromptResult`, `GroupBuilder` |
| `src/lib/optimise-prompts/platform-groups.ts`         | Maps 40 provider IDs → 40 group IDs                                          |
| `src/lib/optimise-prompts/resolve-group-prompt.ts`    | Routes group ID → builder function (40 case handlers)                        |
| `src/lib/optimise-prompts/generic-fallback.ts`        | Fallback builder for unknown providers                                       |
| `src/lib/optimise-prompts/index.ts`                   | Barrel export                                                                |
| `src/lib/optimise-prompts/harmony-post-processing.ts` | Call 2 post-processing (not Call 3)                                          |

### Builder files (40 active)

**T1 — CLIP/keyword (5 platforms):**
`group-stability.ts`, `group-dreamlike.ts`, `group-dreamstudio.ts`, `group-fotor.ts`, `group-lexica.ts`

**T1 — Dedicated (3 platforms):**
`group-sd-clip-double-colon.ts` (Leonardo), `group-novelai.ts`, `group-midjourney.ts`

**T2 — Midjourney:** included above

**T3 — NL dedicated (14 platforms):**
`group-nl-bing.ts`, `group-nl-google-imagen.ts`, `group-nl-imagine-meta.ts`, `group-nl-canva.ts`, `group-nl-adobe-firefly.ts`, `group-nl-simplified.ts`, `group-nl-visme.ts`, `group-nl-vistacreate.ts`, `group-nl-123rf.ts`, `group-nl-myedit.ts`, `group-nl-artbreeder.ts`, `group-nl-pixlr.ts`, `group-nl-deepai.ts`, `group-nl-playground.ts`

**T3 — Dedicated (7 platforms):**
`group-dalle-api.ts` (OpenAI), `group-flux-architecture.ts`, `group-ideogram.ts`, `group-recraft.ts`, `group-runway.ts`, `group-luma-ai.ts`, `group-kling.ts`

**T4 — NL dedicated (11 platforms):**
`group-nl-jasper-art.ts`, `group-nl-craiyon.ts`, `group-nl-hotpot.ts`, `group-nl-picsart.ts`, `group-nl-picwish.ts`, `group-nl-photoleap.ts`, `group-nl-microsoft-designer.ts`, `group-nl-artguru.ts`, `group-nl-artistly.ts`, `group-nl-clipdrop.ts`, `group-nl-bluewillow.ts`

### Dead code (to delete)

| File                       | Status                            |
| -------------------------- | --------------------------------- |
| `group-video-cinematic.ts` | No platform routes to it. Delete. |

### Config

| File                                      | Purpose                                                                                                            |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `src/data/providers/platform-config.json` | SSOT for all 40 platforms — idealMin, idealMax, maxChars, negativeSupport, supportsWeighting, groupKnowledge, etc. |
| `src/data/providers/platform-config.ts`   | TypeScript adapter for the JSON config (225 lines)                                                                 |

---

## 10. Platform Reference Table

| Platform           | Tier | Style    | Weighting | Negatives | idealMin | idealMax | maxChars |
| ------------------ | ---- | -------- | --------- | --------- | -------- | -------- | -------- |
| 123rf              | T3   | natural  | N         | none      | 100      | 300      | 500      |
| adobe-firefly      | T3   | natural  | N         | none      | 300      | 750      | 1000     |
| artbreeder         | T3   | natural  | N         | separate  | 50       | 200      | 500      |
| artguru            | T4   | natural  | N         | separate  | 200      | 450      | 500      |
| artistly           | T4   | natural  | N         | none      | 100      | 200      | 500      |
| bing               | T3   | natural  | N         | none      | 100      | 300      | 480      |
| bluewillow         | T4   | natural  | N         | inline    | 50       | 200      | 6000     |
| canva              | T3   | natural  | N         | none      | 50       | 200      | 500      |
| clipdrop           | T4   | natural  | N         | none      | 100      | 500      | 1000     |
| craiyon            | T4   | natural  | N         | separate  | 50       | 150      | 500      |
| deepai             | T3   | natural  | N         | none      | 50       | 200      | 500      |
| dreamlike          | T1   | keywords | N         | separate  | 200      | 350      | 1000     |
| dreamstudio        | T1   | keywords | Y         | separate  | 200      | 350      | 2000     |
| flux               | T3   | keywords | N         | none      | 300      | 500      | 2000     |
| fotor              | T1   | keywords | Y         | separate  | 50       | 400      | 500      |
| google-imagen      | T3   | natural  | N         | none      | 150      | 350      | 1024     |
| hotpot             | T4   | natural  | N         | none      | 100      | 300      | 500      |
| ideogram           | T3   | natural  | N         | separate  | 200      | 400      | 1000     |
| imagine-meta       | T3   | natural  | N         | none      | 200      | 400      | 1000     |
| jasper-art         | T4   | natural  | N         | none      | 200      | 400      | 1000     |
| kling              | T3   | natural  | N         | separate  | 150      | 350      | 2500     |
| leonardo           | T1   | keywords | Y         | separate  | 250      | 400      | 1000     |
| lexica             | T1   | keywords | N         | separate  | 200      | 350      | 1000     |
| luma-ai            | T3   | natural  | N         | none      | 150      | 350      | 5000     |
| microsoft-designer | T4   | natural  | N         | none      | 100      | 300      | 500      |
| midjourney         | T2   | keywords | N         | inline    | 300      | 400      | 6000     |
| myedit             | T3   | natural  | N         | none      | 50       | 200      | 500      |
| novelai            | T1   | keywords | Y         | separate  | 200      | 400      | 2000     |
| openai             | T3   | natural  | N         | none      | 200      | 400      | 4000     |
| photoleap          | T4   | natural  | N         | none      | 100      | 250      | 500      |
| picsart            | T4   | natural  | N         | none      | 100      | 300      | 500      |
| picwish            | T4   | natural  | N         | none      | 50       | 200      | 500      |
| pixlr              | T3   | natural  | N         | separate  | 50       | 200      | 500      |
| playground         | T3   | natural  | N         | separate  | 200      | 500      | 1000     |
| recraft            | T3   | natural  | N         | separate  | 200      | 400      | 1500     |
| runway             | T3   | natural  | N         | none      | 200      | 400      | 1000     |
| simplified         | T3   | natural  | N         | separate  | 100      | 300      | 500      |
| stability          | T1   | keywords | Y         | separate  | 200      | 350      | 2000     |
| visme              | T3   | natural  | N         | none      | 50       | 200      | 500      |
| vistacreate        | T3   | natural  | N         | none      | 50       | 200      | 500      |

---

## 11. Rollout Plan

### Wave 1 — Artistly (COMPLETE)

Reference implementation. v4.0.0 deployed. Reads from ctx. Gate enforces maxChars only. Comma-preferred trim. Soft warning for idealMax overshoot.

### Wave 2 — Top 5 platforms

Recraft, DALL-E (openai), Flux, Leonardo, Midjourney. Mix of prose and CLIP platforms. Validates the pattern works across both syntax types.

Route change (zone injection) ships with Wave 2.

### Wave 3 — Remaining 34 platforms

Batch the rest once Wave 2 is tested and confirmed.

### Dead code cleanup

Ships with Wave 2:

- Delete `group-video-cinematic.ts`
- Clean `'video-cinematic'` from `PlatformGroupId` type union in `platform-groups.ts`

`resolve-group-prompt.ts` dead imports already cleaned (delivered separately).

---

## 12. What Does NOT Change

| Component                                       | Why unchanged                                                               |
| ----------------------------------------------- | --------------------------------------------------------------------------- |
| `platform-config.json`                          | Already has correct idealMin/idealMax/maxChars. sweetSpot stays for Call 2. |
| `sweetSpot` in types/schemas                    | Call 2 and standard builder depend on it. Call 3 ignores it.                |
| Call 2 route (`generate-tier-prompts/route.ts`) | Tier generation is unaffected.                                              |
| `prompt-builder.ts`                             | Standard builder dropdown assembly uses sweetSpot. Untouched.               |
| `harmony-compliance.ts`                         | Generic syntax enforcement. Untouched.                                      |
| `harmony-post-processing.ts`                    | Call 2 post-processing. Not Call 3.                                         |
| Frontend components                             | Consume the result. Don't care about Call 3 internals.                      |
| `use-ai-optimisation.ts`                        | Frontend hook. sweetSpot stays in the type.                                 |

---

## 13. Known Risks and Mitigations

| Risk                                                                             | Impact                                                                               | Mitigation                                                                                                               |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| idealMin/idealMax values may be inaccurate on some platforms                     | GPT aims for wrong range                                                             | Harmony pass per platform — test on actual platform, adjust config                                                       |
| Wide idealMin–idealMax ranges (e.g. Clipdrop 100–500) make REFINE zone too broad | GPT doesn't know whether to compress or expand                                       | Flag ranges wider than 200 chars for review during harmony pass                                                          |
| CLIP platforms may need different zone instructions                              | ENRICH/COMPRESS mean different things for keyword vs prose                           | Builder system prompt handles platform-specific interpretation; zone is directional only                                 |
| `\bno\s+` regex was destructive — now soft warning only                          | GPT may occasionally output "no clouds" on a platform that doesn't support negatives | System prompt instructs affirmative language; soft warning flags it for user; platform handles it gracefully in practice |
| 40 builders rewritten in waves — regression risk                                 | A builder could break on a specific platform                                         | Wave approach isolates risk; test each wave before proceeding                                                            |
| originalSentence missing — ENRICH zone has no source material                    | Can't add detail without the scene description                                       | Skip "pull from scene description" instruction when originalSentence is absent                                           |
| T4 NL platforms use T3 text as reference — zone calculated from T3 length        | Zone says COMPRESS but GPT writes from the scene description                         | Frame zone around output target, not input length                                                                        |

---

## 14. Success Criteria

A correctly optimised prompt should:

1. Be within `idealMin`–`idealMax` characters (GPT's target) or slightly above (acceptable overshoot)
2. Never exceed `maxChars` (gate enforcement)
3. Preserve all named visual anchors from the scene description
4. Use only syntax the platform supports (no stray weights, flags, or CLIP tokens)
5. Read as clean, natural prose (NL platforms) or correctly structured keywords (CLIP platforms)
6. Front-load the primary subject
7. Not contain destructively stripped content (no "black" without "mountains")

The diagnostic `changes` array should show what happened: which anchors were preserved, what syntax was stripped, whether the output is in the ideal range, and any soft warnings.
