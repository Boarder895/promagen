# Build Plan — API Call 1 (Category Assessment) Improvements

**Authority:** `prompt-lab-api-architecture-v1.1.md` §5.1 (Phase A)
**Scope:** Call 1 assess mode only. Extract mode (standard builder) unchanged.
**Date:** 13 April 2026

---

## 1. What Call 1 does today

**Route:** `POST /api/parse-sentence` (455 lines)
**Hook:** `src/hooks/use-category-assessment.ts` (198 lines)
**Model:** `gpt-4.5-mini`, temp 0.2

Two modes:

- `extract` — returns 12-category term arrays for standard builder dropdown population. **Not changing.**
- `assess` — returns coverage map with matched phrases from user's text. **This is what we're fixing.**

Assess mode takes the user's raw text and returns:

```json
{
  "coverage": {
    "subject": { "covered": true, "matchedPhrases": ["samurai"] },
    "action": { "covered": false, "matchedPhrases": [] },
    "lighting": { "covered": true, "matchedPhrases": ["golden hour"] },
    ...
  },
  "coveredCount": 6,
  "totalCategories": 12,
  "allSatisfied": false
}
```

---

## 2. What's wrong with it

### 2.1 Engine auto-fill exists

The gap-fill UI currently offers "Let the engine decide" as an option for uncovered categories. When selected, Call 2 receives `fill: "engine"` and is instructed to "add expert-level content for these." This violates P1 (user is the only source of creative intent).

**Fix:** Remove the engine-fill option from the UI. Users either type their own addition or leave the category empty.

### 2.2 Categorisation accuracy is inconsistent

The assess mode system prompt sometimes:

- Over-detects categories (marks atmosphere as covered when the user only implied it)
- Under-detects categories (misses explicit lighting references)
- Splits phrases that should stay together
- Returns matchedPhrases that don't exactly match the user's text

**Fix:** Tighten the assess system prompt with stricter rules and more WRONG/RIGHT examples.

### 2.3 matchedPhrases don't connect to downstream colour coding

Call 1 returns `matchedPhrases` which the XRay Decoder uses for text colouring on the input side. But these phrases don't carry through to the assembled/optimised prompt colour coding. They're a dead end.

**Fix:** Store Call 1's matchedPhrases client-side and pass them to Call 2/Call T2 as part of the user message, so GPT knows which phrases map to which categories. This seeds the anatomy array.

---

## 3. What to change

### 3.1 Remove engine auto-fill (UI change)

**Files:**

- `src/components/prompts/enhanced-educational-preview.tsx` — find the gap-fill UI that offers "Let engine decide" and remove that option
- `src/hooks/use-tier-generation.ts` — remove `fill: "engine"` handling from the hook
- `src/app/api/generate-tier-prompts/route.ts` — remove engine-fill handling from the user message construction (lines ~417–420)

**What the user sees after:** Gap categories show "Type your own term" input field only. No engine-fill option. If they leave it empty, it stays empty.

### 3.2 Improve assess mode system prompt

**File:** `src/app/api/parse-sentence/route.ts` — the `ASSESS_SYSTEM_PROMPT` constant

**Changes needed:**

- Strengthen rule 6 (over-inference): add more examples of what does NOT count as coverage
- Add WRONG/RIGHT examples for edge cases (implied vs explicit, compound phrases)
- Tighten matchedPhrase extraction: must be exact substrings, not paraphrased

**Approach:** Draft improved prompt → test against 10 diverse human descriptions → compare category accuracy before/after → iterate if needed.

### 3.3 Store matchedPhrases for downstream use

**Files:**

- `src/hooks/use-category-assessment.ts` — ensure matchedPhrases are stored in state and accessible to Call 2/Call T2 hooks
- `src/components/prompts/playground-workspace.tsx` — pass coverage data to the tier generation and optimisation hooks

**This is preparation for anatomy array.** Call 2 and Call T2 will use this data to produce accurate anatomy segments.

---

## 4. Files touched (complete list)

| File                                                      | Lines  | Change                                       |
| --------------------------------------------------------- | ------ | -------------------------------------------- |
| `src/app/api/parse-sentence/route.ts`                     | 455    | Assess system prompt improvements            |
| `src/hooks/use-category-assessment.ts`                    | 198    | Ensure matchedPhrases stored and accessible  |
| `src/components/prompts/enhanced-educational-preview.tsx` | ~2,008 | Remove engine-fill UI option                 |
| `src/hooks/use-tier-generation.ts`                        | 332    | Remove engine-fill handling                  |
| `src/app/api/generate-tier-prompts/route.ts`              | 665    | Remove engine-fill user message construction |
| `src/components/prompts/playground-workspace.tsx`         | 603    | Pass coverage data downstream                |

---

## 5. Success criteria

- [ ] Engine-fill option removed from gap-fill UI
- [ ] Assess mode categorisation tested on 10 diverse descriptions
- [ ] matchedPhrases exactly match user's text (no paraphrasing)
- [ ] matchedPhrases stored client-side and available to downstream hooks
- [ ] No changes to extract mode (standard builder unaffected)
- [ ] No changes to XRay Decoder visual behaviour
- [ ] Typecheck passes
- [ ] Build passes

---

## 6. What to bring to the new chat

Upload to the new chat:

1. `src.zip` (fresh)
2. `scripts.zip` (fresh)
3. `prompt-lab-api-architecture-v1.1.md` (the signed-off architecture doc)
4. This build plan

Tell Claude: "We're building Phase A from the architecture doc. Here's the build plan. Start with the assess system prompt improvements."

---

## 7. Dependencies

- No dependency on Phase B, C, or D — Call 1 improvements are self-contained
- The matchedPhrases downstream wiring (§3.3) is preparation for Phase B (anatomy array) but doesn't block it
- Extract mode is completely untouched — standard builder continues to work

---

## 8. Risk assessment

**Risk: Low.** This is system prompt refinement + UI simplification. No architectural change. No new routes. No new hooks. The engine-fill removal is a subtraction, not an addition. The assess prompt improvements are testable against known inputs before shipping.

The only risk is that removing engine-fill makes sparse prompts feel "emptier" to users. That's by design (P1: put rubbish in, get rubbish out). The product communicates this through the gap display — the user can see exactly what they haven't filled.
