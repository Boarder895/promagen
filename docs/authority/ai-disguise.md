# AI Disguise — v6.0.0 Update Patch

**Apply these changes to `ai-disguise.md` v5.0.0**

---

## 1. HEADER — Replace lines 1–9

```
# AI Disguise — Prompt Lab Intelligence Engine

**Version:** 6.0.0
**Created:** 22 March 2026
**Updated:** 5 April 2026
**Owner:** Promagen
**Status:** Parts 1–4e BUILT and deployed. Part 4f (Resilience Layer + Lab Gate v3 + Leaderboard Rail) BUILT. Part 5 passive learning pipeline DEFERRED. Part 6 (testing) BUILT — 115-test harmony lockdown suite.
**Scope:** Prompt Lab (`/studio/playground`) ONLY. The standard builder (`/providers/[id]`) is untouched.
**Authority:** This document defines the architecture, API routes, animation system, provider switching behaviour, resilience layer, quota gating, and learning pipeline for the Prompt Lab's AI-powered prompt generation and optimisation system.
```

---

## 2. §1 NAMING CONVENTION TABLE — Replace the table

| Internal (code)                        | User-facing                                                               | Never say                   |
| -------------------------------------- | ------------------------------------------------------------------------- | --------------------------- |
| `generateTierPrompts()`                | "Prompt Intelligence Engine"                                              | "AI generation"             |
| `optimisePrompt()`                     | "Deep Optimisation Pipeline"                                              | "GPT call"                  |
| API route `/api/generate-tier-prompts` | (invisible)                                                               | "API", "OpenAI"             |
| API route `/api/optimise-prompt`       | (invisible)                                                               | "external service"          |
| API route `/api/parse-sentence`        | (invisible)                                                               | "AI analysis"               |
| Algorithm cycling animation            | "Analysing..." / "Processing..."                                          | "Waiting for response"      |
| `✓ 97 algorithms applied`              | Exactly as written                                                        | "AI finished"               |
| Console log `[PromptAlgorithm]`        | (F12 only)                                                                | "[useTierGeneration]"       |
| Console log `[TextAnalysis]`           | (F12 only)                                                                | "[useCategoryAssessment]"   |
| Error: format/parse fail               | "Algorithm hiccup — retrying..."                                          | "Engine error", "API error" |
| Error: unknown fail                    | "Algorithm overload — retrying..."                                        | "AI failed", "GPT error"    |
| Error: Call 1 fail (non-critical)      | "Text highlighting unavailable"                                           | "AI analysis failed"        |
| Error: Call 2 fail with fallback       | "Optimisation unavailable — showing your description as a starting point" | "AI generation failed"      |
| Provider selector label                | "Select Provider..."                                                      | "Select AI Provider..."     |
| Leaderboard column                     | "Provider"                                                                | "AI Provider"               |

---

## 3. NEW SECTION — Add after §18 (Security) as §19

## 19. Resilience Layer (v6.0.0)

### Architecture

The resilience layer protects free-tier users from losing their limited quota on transient failures. It wraps Call 1 (assessment) and Call 2 (tier generation) with auto-retry, validation, and fallback.

### Call 2 — Auto-Retry

| Attempt | Delay | Behaviour                                                                  |
| ------- | ----- | -------------------------------------------------------------------------- |
| 1       | 0     | Normal fetch to `/api/generate-tier-prompts`                               |
| 2       | 1.5s  | Silent retry on transient errors (network, format, rate-limit, validation) |
| —       | —     | Content policy errors are NEVER retried                                    |

Implementation: `attemptGenerate()` extracted as pure function. `generate()` orchestrates two attempts with `wait(1500)` between. Generation ID counter (`generationIdRef`) prevents stale responses from older calls being accepted — definitive fix for the abort race condition.

### Call 1 — Auto-Retry

| Attempt | Delay | Behaviour                               |
| ------- | ----- | --------------------------------------- |
| 1       | 0     | Normal fetch to `/api/parse-sentence`   |
| 2       | 1s    | Silent retry on transient errors        |
| —       | —     | Content policy errors are NEVER retried |

Call 1 is non-critical — its failure only affects text highlighting, not prompt generation. Error messages reflect this: "Text highlighting unavailable — prompts generated successfully."

### Tier Validation

Before accepting Call 2 results, `validateTiers()` checks that at least one of the four tiers has non-empty positive content. Empty/malformed responses are rejected and trigger a retry.

### Template Fallback

When Call 2 fails after both attempts AND the user has text:

| Tier                  | Source                                                                                 |
| --------------------- | -------------------------------------------------------------------------------------- |
| T1 (CLIP)             | Matched phrases from Call 1 `coverageData`, comma-separated + "high quality, detailed" |
| T2 (Midjourney)       | User's raw input text                                                                  |
| T3 (Natural Language) | User's raw input text                                                                  |
| T4 (Plain Language)   | User's raw input text                                                                  |

Fallback prompts are NOT AI-generated — quota is NOT consumed. User sees: "Optimisation unavailable — showing your description as a starting point. Try again for full prompts."

Content policy errors do NOT trigger fallback (the user's content was rejected — showing it back is wrong).

### Quota Protection Rules

| Condition                              | `markUsed()` fires?                | Quota consumed? |
| -------------------------------------- | ---------------------------------- | --------------- |
| Call 2 succeeds, no error              | Yes                                | Yes             |
| Call 2 fails (even after retry)        | No (`aiTierPrompts` null)          | No              |
| Call 2 succeeds but `tierError` exists | No (guard: `!tierError`)           | No              |
| Fallback prompts shown                 | No (separate from `aiTierPrompts`) | No              |
| Call 1 fails, Call 2 succeeds          | Yes (Call 1 non-critical)          | Yes             |
| Content policy rejection               | No                                 | No              |

### Error Type Classification

```typescript
type TierErrorType =
  | "content-policy"
  | "rate-limit"
  | "network"
  | "format"
  | "validation"
  | "unknown";

interface TierGenerationError {
  type: TierErrorType;
  message: string;
  retryable: boolean; // false for content-policy only
}
```

Classification is done by `classifyTierError()` which inspects HTTP status and error codes. Raw API error messages are NEVER passed through to the user — always replaced with disguised messages.

### Generation ID Counter

```
generationIdRef.current += 1;
const thisGenerationId = generationIdRef.current;
```

Every checkpoint after an `await` verifies `generationIdRef.current === thisGenerationId`. If a newer generation has started, the stale response is silently rejected. This eliminates the abort controller race condition where a response arrives in the sub-millisecond window between response receipt and abort signal processing.

---

## 4. NEW SECTION — Add after §19 as §20

## 20. Lab Gate v3 — Quota System (v6.0.0)

### Tier Limits

| User type                 | Daily limit | Storage key                              |
| ------------------------- | ----------- | ---------------------------------------- |
| Anonymous (not signed in) | 1           | `promagen:lab-gen:anon:{YYYY-MM-DD}`     |
| Free (signed in)          | 2           | `promagen:lab-gen:{userId}:{YYYY-MM-DD}` |
| Pro (paid)                | ∞           | N/A                                      |

### Gate Logic

```
canGenerate = isPro || !isExhausted
```

Anonymous users see the workspace immediately — no sign-in wall. The gate overlay only appears AFTER quota is exhausted:

- Anonymous exhausted → sign-in CTA ("Sign in for 2 daily prompts")
- Free exhausted → upgrade CTA ("Unlock unlimited prompts →")

### FreeGenerationBadge

Displays inline in the provider selector header row (same horizontal plane as the dropdown). Text pluralises: "✦ 1 free generation — make it count" / "✦ 2 free generations — make them count".

### Implementation

- `src/hooks/use-lab-gate.ts` — v3.0.0 (173 lines)
- `src/components/prompts/lab-gate-overlay.tsx` — v1.1.0 (221 lines)
- `src/components/prompts/playground-workspace.tsx` — gate wiring, `freeBadge` prop

---

## 5. NEW SECTION — Add after §20 as §21

## 21. Leaderboard Rail (v6.0.0)

Replaces `PlatformMatchRail` (tier-grouped bullet list) with a compact version of the homepage AI Leaderboard in the Prompt Lab left rail.

### Columns

| #   | Column       | Content                                                |
| --- | ------------ | ------------------------------------------------------ |
| 1   | Provider     | Rank + Icon (20×20, fixed) + Name                      |
| 2   | Support      | SupportIconsCell (hidden by default, shows at 1800px+) |
| 3   | Index Rating | IndexRatingCell (rating + change arrow + percentage)   |

### Behaviour

- **Click name** → selects provider for optimisation (`onSelectProvider`)
- **Click icon** → opens provider homepage (new tab, `stopPropagation`)
- **Click row** → no action (deliberate — only name selects)
- **Fixed rank** — `rankMap` computed from default descending sort. Craiyon shows "40." whether the table is sorted ascending or descending.
- **Top 10** default, "Show all 40" expand/collapse
- **Demo jitter** — ±1-3 rating movement every 30s (skipped on initial render for hydration safety, `prefers-reduced-motion` respected)
- **No horizontal scroll** — `overflowX: hidden`, `tableLayout: fixed`

### Hydration Safety

Two sources of hydration mismatch eliminated:

1. `Math.random()` in jitter — skipped when `jitterTick === 0` (initial render)
2. `Date.now()` in `hasRankUp` — deferred via `hasMounted` state, forced `false` until client-side mount

### Implementation

- `src/components/prompt-lab/leaderboard-rail.tsx` — v6.0.0 (549 lines)
- Replaces `src/components/prompt-lab/platform-match-rail.tsx` (still exists, unused)

---

## 6. DECISIONS LOG — Append after D39

| ID  | Decision                                                                  | Rationale                                                                                                                                                                                                          | Date       |
| --- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| D40 | Auto-retry once on transient Call 2 failures (1.5s delay)                 | Anonymous user's single free prompt must not be wasted on a transient error. Silent retry catches ~90% of format/network errors.                                                                                   | 5 Apr 2026 |
| D41 | Auto-retry once on transient Call 1 failures (1s delay)                   | Call 1 is non-critical (text highlighting only) but retrying is cheap and prevents scary red errors.                                                                                                               | 5 Apr 2026 |
| D42 | Template fallback when Call 2 fails completely                            | User sees their own text in tier cards rather than nothing. Not AI-generated, no quota consumed. Better than an empty page.                                                                                        | 5 Apr 2026 |
| D43 | Content policy errors never trigger retry or fallback                     | The user's content was rejected — retrying the same content is pointless, and showing it back as fallback is wrong. Different error messaging: "Try different wording."                                            | 5 Apr 2026 |
| D44 | Generation ID counter replaces abort-only race protection                 | AbortController has a sub-millisecond race window where a response can arrive after abort() but before the signal is checked. Generation ID is a definitive fix — stale responses always rejected.                 | 5 Apr 2026 |
| D45 | Tier validation: at least 1 non-empty positive tier required              | Prevents empty/malformed GPT responses from being accepted as valid and consuming quota. Triggers retry instead.                                                                                                   | 5 Apr 2026 |
| D46 | `markUsed()` guard: `aiTierPrompts && !tierError`                         | Original guard only checked `aiTierPrompts`. If Call 1 failed with a scary error but Call 2 succeeded, quota was consumed AND user saw error. Now quota only consumed when tier data exists AND no tier error.     | 5 Apr 2026 |
| D47 | Lab Gate v3: anon=1, free=2, pro=∞                                        | Anonymous users blocked by sign-in wall = immediate bounce. Giving 1 free prompt lets them experience the product. Sign-in unlocks 2 (anchoring: "I got 1, signing in gives me 2").                                | 5 Apr 2026 |
| D48 | FreeGenerationBadge moved to provider selector header row                 | Was a full-width banner consuming vertical height. Now inline with the provider dropdown — same information, zero vertical cost.                                                                                   | 5 Apr 2026 |
| D49 | Leaderboard Rail replaces Platform Match Rail                             | Bullet list of 40 platforms wasted the left rail. Mini leaderboard with ratings + social icons turns dead space into authority proof. Click-to-select connects ranking to prompt building.                         | 5 Apr 2026 |
| D50 | All error messages sanitised — no AI/API/GPT/Engine passthrough           | Raw API error messages (e.g. "Engine response did not match expected format") were shown to users. Now all messages use fixed disguised text. Console logs relabelled to `[PromptAlgorithm]` and `[TextAnalysis]`. | 5 Apr 2026 |
| D51 | Provider selector label: "Select Provider..." not "Select AI Provider..." | AI Disguise principle — no user-facing string should contain "AI". Changed in both EEP ProviderSelector and workspace Combobox.                                                                                    | 5 Apr 2026 |
| D52 | SEO metadata: Option 2 (Loss Aversion) — "Most prompts lose detail..."    | Intrigue-first description using §8 Loss Aversion. User feels the gap between their vision and the platform's interpretation. Platform count fixed to "40" (was showing "42+" in Google cache).                    | 5 Apr 2026 |

---

## 7. BUILD ORDER — Append after Part 6

### Part 4f — Resilience Layer + Lab Gate v3 + Leaderboard Rail (v6.0.0) ✅ BUILT

57. ✅ `use-tier-generation.ts` rewritten (224→332 lines) — auto-retry, tier validation, error classification, generation ID counter
58. ✅ `use-category-assessment.ts` updated (168→198 lines) — auto-retry on transient errors, sanitised error messages
59. ✅ `use-lab-gate.ts` rewritten (165→173 lines) — v3: anon=1, free=2, pro=∞, browser-keyed anon storage
60. ✅ `playground-workspace.tsx` updated (521→589 lines) — tier error wiring, markUsed guard, template fallback, effectiveTierPrompts, freeBadge prop, gate overlay for anon
61. ✅ `enhanced-educational-preview.tsx` updated (1,964→1,969 lines) — freeBadge prop, "Select Provider..." label
62. ✅ `prompt-builder.tsx` updated — freeBadge prop in header right section
63. ✅ `lab-gate-overlay.tsx` updated (221 lines) — "2 free generations" text, pluralised badge
64. ✅ `leaderboard-rail.tsx` created (549 lines) — mini leaderboard replacing PlatformMatchRail
65. ✅ `playground-page-client.tsx` updated — LeaderboardRail import, left rail swap
66. ✅ `layout.tsx` + `page.tsx` — SEO metadata updated (Option 2 loss aversion)
67. ✅ All error messages sanitised — no AI/API/GPT/Engine in user-facing strings or F12 console

---

## 8. CHANGELOG — Prepend before existing entries

- **5 April 2026 (v6.0.0):** **RESILIENCE LAYER + LAB GATE v3 + LEADERBOARD RAIL.** Call 2 (`use-tier-generation.ts`) rewritten with auto-retry (1 attempt, 1.5s delay), tier validation (`validateTiers` — at least 1 non-empty tier), error type classification (`TierErrorType`: content-policy, rate-limit, network, format, validation, unknown), and generation ID counter (eliminates abort race condition). Call 1 (`use-category-assessment.ts`) updated with auto-retry (1 attempt, 1s delay). Template fallback: when Call 2 fails completely, user's text shown in tier cards (T1 = matched keywords, T2-T4 = raw text) — not AI-generated, no quota consumed. `markUsed()` guard strengthened: `aiTierPrompts && !tierError` (was `aiTierPrompts` only). Lab Gate v3: anonymous users get 1 free generation (no sign-in wall), signed-in free users get 2 (was 1), Pro unlimited. `FreeGenerationBadge` moved from standalone row to inline in provider selector header. Leaderboard Rail replaces Platform Match Rail in left rail — compact version of homepage AI leaderboard with fixed rank, icon-only homepage link, name-only provider selection. All error messages sanitised: raw API messages never passed through, console logs relabelled `[PromptAlgorithm]`/`[TextAnalysis]`, provider selector label changed "Select AI Provider..." → "Select Provider...". SEO metadata updated: title "Promagen: Prompt Builder for 40 Image Platforms", description uses Loss Aversion (§8): "Most prompts lose detail between what you imagine and what the platform receives." Full codebase scan confirmed zero AI/API/GPT violations in Prompt Lab scope. Known violations outside scope: homepage leaderboard title "AI Providers Leaderboard", engine bay "Select AI Platform" — these are marketing pages, not disguise scope. Decisions D40–D52. Build order Part 4f (11 items, all BUILT).

---

## 9. KNOWN VIOLATIONS OUTSIDE PROMPT LAB SCOPE

These "AI" references exist in marketing/homepage pages and are deliberately kept for SEO keyword value. They are NOT in Prompt Lab disguise scope:

| File                                  | Line | Text                                       | Reason kept                         |
| ------------------------------------- | ---- | ------------------------------------------ | ----------------------------------- |
| `homepage-client.tsx`                 | 439  | `aria-label="AI providers leaderboard"`    | SEO + accessibility                 |
| `homepage-client.tsx`                 | 445  | `title="AI Providers Leaderboard"`         | Product name on homepage            |
| `new-homepage-client.tsx`             | 314  | `aria-label="AI providers leaderboard"`    | Same                                |
| `engine-bay.tsx`                      | 288  | `aria-label="Top AI platforms"`            | SEO                                 |
| `engine-bay.tsx`                      | 358  | `label="Select AI Platform"`               | Homepage engine bay, not Prompt Lab |
| `homepage-grid.tsx`                   | 516  | "live AI image prompt" in Listen text      | Marketing copy                      |
| `feedback-invitation.tsx`             | 264  | "Rate how the AI image matched"            | Feedback modal                      |
| `describe-your-image.tsx`             | 259  | "weighted AI prompt" format detection hint | Describes external AI prompt format |
| `optimization-transparency-panel.tsx` | 90   | "the AI literally cannot see these"        | Standard builder, not Prompt Lab    |

---

## 10. FILE MAP — Updated line counts (v6.0.0)

| File                                                      | Lines | Change                                                                   |
| --------------------------------------------------------- | ----- | ------------------------------------------------------------------------ |
| `src/hooks/use-tier-generation.ts`                        | 332   | Rewritten (was 224) — auto-retry, validation, error types, generation ID |
| `src/hooks/use-category-assessment.ts`                    | 198   | Updated (was 168) — auto-retry, sanitised messages                       |
| `src/hooks/use-lab-gate.ts`                               | 173   | Rewritten (was 165) — v3 anon/free/pro                                   |
| `src/components/prompts/playground-workspace.tsx`         | 589   | Updated (was 521) — tier error, fallback, freeBadge                      |
| `src/components/prompts/enhanced-educational-preview.tsx` | 1,969 | Updated (was 1,964) — freeBadge, Select Provider                         |
| `src/components/prompts/lab-gate-overlay.tsx`             | 221   | Updated — 2 free generations, pluralised badge                           |
| `src/components/prompt-lab/leaderboard-rail.tsx`          | 549   | NEW — replaces platform-match-rail.tsx                                   |
| `src/app/layout.tsx`                                      | —     | Updated — SEO metadata v6.0.0                                            |
| `src/app/page.tsx`                                        | —     | Updated — SEO metadata v6.0.0                                            |
