# API Call 3 — Prompt Optimisation System

> **Authority document** — Governs the Call 3 optimisation pipeline end-to-end.
> Version 2.0.0 — 31 Mar 2026
> SSOT: `src.zip` — always believe the code over this doc if they conflict.

---

## 1. What Call 3 Does

Call 3 takes a tier prompt (from Call 2) and optimises it for a specific platform. The user has already selected a provider. Call 3 restructures the prompt to match that platform's syntax, length preferences, and capabilities.

Call 1 parses the sentence. Call 2 generates 4 tier prompts (no provider selected). Call 3 refines for the chosen provider.

---

## 2. The Three Numbers

Every platform has three character values in `platform-config.json`. These are the only numbers that matter for Call 3 length control.

| Field      | Purpose                                                                        | Who uses it                        | Shown to GPT? |
| ---------- | ------------------------------------------------------------------------------ | ---------------------------------- | ------------- |
| `idealMin` | Quality floor — prompts shorter than this produce poor images on this platform | Route zone logic (ENRICH detection)| **NO**        |
| `idealMax` | Quality ceiling — optimal range upper bound                                    | Call 2 + standard builder only     | **NO**        |
| `maxChars` | Platform hard limit — the platform rejects or silently truncates above this    | GPT (system prompt) + compliance gate (code) | **YES** |

**v2.0.0 change:** `idealMin` and `idealMax` are NEVER shown to GPT. They are internal-only values. GPT sees one number: `maxChars`.

### 2.1 maxChars Capping Rule

14 platforms had `maxChars` values more than 2.5× their `idealMax`. This creates a "headroom problem" — GPT sees thousands of characters of room and fills it with padding. These platforms have been capped:

**Rule:** If `maxChars > idealMax × 2.5`, set `maxChars = idealMax × 2.5`.

| Platform       | idealMax | Old maxChars | New maxChars |
| -------------- | -------- | ------------ | ------------ |
| bluewillow     | 200      | 6000         | 500          |
| craiyon        | 150      | 500          | 375          |
| dreamlike      | 350      | 1000         | 875          |
| dreamstudio    | 350      | 2000         | 875          |
| flux           | 500      | 2000         | 1250         |
| google-imagen  | 350      | 1024         | 875          |
| kling          | 350      | 2500         | 875          |
| lexica         | 350      | 1000         | 875          |
| luma-ai        | 350      | 5000         | 875          |
| midjourney     | 400      | 6000         | 1000         |
| novelai        | 400      | 2000         | 1000         |
| openai         | 400      | 4000         | 1000         |
| recraft        | 400      | 1500         | 1000         |
| stability      | 350      | 2000         | 875          |

The remaining 26 platforms already had `maxChars ≤ idealMax × 2.5` and are unchanged.

`sweetSpot` remains in the config for Call 2 and the standard builder. Call 3 builders do not use it.

---

## 3. The Zone System

The route computes a zone from the assembled prompt length and the config numbers. The zone is injected into the **user message**, not the system prompt.

```
0 ──── idealMin ──── maxChars ────→
   ENRICH       REFINE       COMPRESS
```

| Zone     | Condition                    | What GPT sees in user message                                                                    |
| -------- | ---------------------------- | ------------------------------------------------------------------------------------------------ |
| ENRICH   | promptLength < idealMin      | "Reference draft: {length} chars. Platform limit: {maxChars} chars. Strategy: ENRICH — Room to add detail." |
| REFINE   | idealMin ≤ promptLength ≤ maxChars | "Reference draft: {length} chars. Platform limit: {maxChars} chars. Strategy: REFINE — Do NOT shorten." |
| COMPRESS | promptLength > maxChars      | "Reference draft: {length} chars. Platform limit: {maxChars} chars. Strategy: COMPRESS — Must fit within platform limit." |

**v2.0.0 change:** The zone block no longer includes "Ideal range: X–Y chars." GPT sees only:
```
OPTIMISATION CONTEXT:
Reference draft: {length} chars. Platform limit: {maxChars} chars.
Strategy: {ZONE} — {zone description}
```

`idealMin` is used internally by the route to detect ENRICH (very short prompts). It is never shown to GPT. `idealMax` is not used by the route at all — it stays in config for Call 2.

---

## 4. Length Discipline — What GPT Sees

### 4.1 System Prompt (in every builder)

Every builder's system prompt contains this block:

```
LENGTH RULES:
HARD: Do not shorten any prompt that is below {maxChars} characters.
SOFT: You may lengthen the prompt up to {maxChars} characters, but only if the added content is a genuine visual anchor — not filler.
Your job is to produce the best possible prompt for this platform. Length is not a goal. Anchor preservation is.
```

`{maxChars}` is interpolated from `ctx.maxChars` (which reflects the capped values for the 14 platforms).

### 4.2 What GPT Does NOT See

- No `idealMin`
- No `idealMax`
- No character range or "sweet spot"
- No target character count
- No "aim for X–Y characters"

### 4.3 Why This Works

GPT treats any character range as a target and compresses to hit it. A system prompt saying "200–400 characters" causes a 319-char prompt to be compressed to ~205 — losing anchors.

With the new rules, GPT sees "don't shorten below 1000 characters" for a 319-char prompt. There's no number pulling it down. The zone block says "REFINE — do NOT shorten." GPT restructures, front-loads, strengthens — but doesn't compress.

### 4.4 Output Floor

There is no character-count output floor. The floor is **anchor preservation**. Every builder's system prompt requires GPT to preserve all named visual elements from the input. A prompt with 12 visual anchors cannot be 40 characters — the anchors themselves enforce length.

For genuinely short inputs ("a cat"), the ENRICH zone fires and tells GPT to add detail.

---

## 5. Architecture — GPT's Job vs Gate's Job

### GPT's Job (via system prompt + user message)

- Produce the best possible prompt for this platform
- Preserve every visual anchor from the scene description
- Restructure for the platform's syntax and style
- Front-load the primary subject
- Use affirmative language only (no "without X" phrasing)
- Follow the zone direction (ENRICH / REFINE / COMPRESS)
- Strip forbidden syntax (weights, flags, CLIP tokens) in the rewrite
- Do not shorten below `maxChars`; may lengthen up to `maxChars` only with genuine anchors
- Return valid JSON with optimised text, changes, charCount

### Gate's Job (compliance function in code)

- Strip unsupported syntax that GPT missed (weights, flags, CLIP tokens)
- Detect negative phrasing — log soft warning, do NOT strip destructively
- Enforce `maxChars` — only trim when the platform hard limit is exceeded
- Comma-preferred boundary trim when trimming is required
- Log diagnostics (above ideal range, below minimum, good density)
- Pass through clean prose untouched when under `maxChars`

The gate does NOT trim to `idealMax`. If GPT returns 450 chars and `maxChars` is 500, the gate passes it through.

---

## 6. Request Flow — Step by Step

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

The builder reads `ctx.maxChars` and `ctx.groupKnowledge` and interpolates them into the system prompt template. No character ranges. No `idealMin`/`idealMax`.

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

### Step 5: Compute zone

The route calculates the zone from `sanitisedPrompt.length` and `ctx.idealMin`:

```typescript
const zone =
  promptLength < idealMin
    ? "ENRICH"
    : promptLength <= hardCeiling
      ? "REFINE"
      : "COMPRESS";
```

`idealMin` is the only config value used here (for ENRICH detection). `idealMax` is not referenced.

### Step 6: Build user message

**Prose groups (31 platforms):**

```
SCENE DESCRIPTION TO OPTIMISE FOR {PLATFORM}:
{originalSentence}

REFERENCE DRAFT (use as structural starting point, but enrich with ALL details from the scene description above):
{assembledTierPrompt}

OPTIMISATION CONTEXT:
Reference draft: {length} chars. Platform limit: {maxChars} chars.
Strategy: {ZONE} — {zone-specific instruction}
```

**CLIP/keyword groups (9 platforms):**

```
ASSEMBLED PROMPT TO OPTIMISE:
{assembledTierPrompt}

ORIGINAL USER DESCRIPTION (for intent reference):
{originalSentence}

OPTIMISATION CONTEXT:
Reference draft: {length} chars. Platform limit: {maxChars} chars.
Strategy: {ZONE} — {zone-specific instruction}
```

No ideal range mentioned in either format.

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
- Logs soft diagnostics if above `idealMax` or below `idealMin` (server-side only, never shown to GPT)

**Gate 2 — Negative contradiction guard:**

- Strips terms from the negative that also appear in the positive
- Prevents CLIP encoder confusion from contradictory signals

**Gate 3 — Generic syntax enforcement** (`enforceT1Syntax`):

- Safety net for any syntax that leaked through Gates 1 and 2
- Strips weight syntax, parameter flags on platforms that don't support them
- Always runs regardless of builder

### Step 10: Return result

Server-side `charCount` override (GPT self-reports are unreliable). Return JSON with `result` object.

---

## 7. Changelog

| Version | Date       | Changes |
| ------- | ---------- | ------- |
| 1.0.0   | 31 Mar 2026| Initial authority doc. Wave 2 deployed. |
| 2.0.0   | 31 Mar 2026| **Length discipline overhaul.** Removed all `idealMin`/`idealMax` character ranges from GPT-visible system prompts and user messages. Replaced with hard/soft rules referencing `maxChars` only. Capped `maxChars` for 14 platforms where `maxChars > idealMax × 2.5`. Updated compliance gate ceilings for Kling (875), Luma-AI (875), Runway (1000) to match new maxChars. Fixed undefined `hardCeiling` variable in 22 NL builders and double-brace bug in 12 NL builders. |
