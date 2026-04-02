# Call 4 Scoring Engine — Architecture Review (v4)

**Changes from v3:** All three cleanup items resolved. (1) Axis display contract: raw axes returned as-is, headline score normalised when negatives N/A — clearly documented. (2) `promptStyle` and `call3Mode` now typed as strict unions matching SSOT. (3) `categoryRichness` typed to the 12 known scoring categories. Also: explicit phrase-level directive rule added, 4th calibration example noted for T4/plain.

Review this. Score it out of 100 and tell me if it's build-ready.

## What Call 4 Does

Call 4 scores an optimised prompt and returns 2-3 actionable improvement directives. It does NOT rewrite the prompt — it tells the user what to fix. The user edits, re-optimises (Call 3), re-scores (Call 4). Closed feedback loop.

**Pro Promagen only.** Standard users see a locked placeholder.

## Pipeline Context (Calls 1-3 already exist and work)

- **Call 1** — Parse & Assess: 12 categories, coverage map, richness counts
- **Call 2** — Generate Tier Prompts: 4 tier-specific variants (T1-T4)
- **Call 3** — Optimise: Platform-specific adaptation, returns optimised prompt + changes + charCount + tokenEstimate

## Call 4 — Score Prompt

**Route:** `POST /api/score-prompt`

**When it fires:** Automatically after Call 3 completes. Pro users only. Three-layer duplicate prevention (cache + debounce + rate limit).

**Model:** gpt-5.4-mini | **Cost:** ~$0.002/call | **Response format:** json_object

### Request Body (Zod schema — strict types)

```typescript
{
  // ── Core prompt data ──
  optimisedPrompt: string;
  humanText: string;
  assembledPrompt: string;
  negativePrompt?: string;

  // ── Platform context (from platform-config.json SSOT) ──
  platformId: string;
  platformName: string;
  tier: 1 | 2 | 3 | 4;
  promptStyle: 'keywords' | 'natural';                    // SSOT: only 2 values exist
  maxChars: number;
  idealMin: number;
  idealMax: number;
  negativeSupport: 'separate' | 'inline' | 'none';        // SSOT: only 3 values exist

  // ── Call 3 output context ──
  call3Changes: string[];
  call3Mode: 'reorder_only' | 'format_only' | 'gpt_rewrite' | 'pass_through' | 'mj_deterministic';  // SSOT: only 5 values exist

  // ── Call 1 category richness — typed to the 12 known scoring categories ──
  categoryRichness: {
    subject?: number;
    action?: number;
    style?: number;
    environment?: number;
    composition?: number;
    camera?: number;
    lighting?: number;
    colour?: number;
    atmosphere?: number;
    materials?: number;
    fidelity?: number;
    negative?: number;
  };
  // structural is excluded — it's glue text, not a scoring category
}
```

### Response Body — Axis Display Contract

```typescript
{
  // ── Headline score (normalised to 100) ──
  score: number;               // 0-100, always out of 100
                                // When negativeSupport === 'none': scored out of 90 internally,
                                // then normalised: score = Math.round((rawTotal / 90) * 100)

  // ── Raw axis scores (NOT normalised — always their natural max) ──
  axes: {
    anchorPreservation: number;   // 0-30 raw
    platformFit: number;          // 0-25 raw
    visualSpecificity: number;    // 0-20 raw
    economyClarity: number;       // 0-15 raw
    negativeQuality: number | null; // 0-10 raw, or NULL when negativeSupport === 'none'
  };
  // UI renders: 4 bars always visible + 5th bar only when negativeQuality !== null
  // Headline score is the normalised total — bars show raw component scores

  directives: string[];         // 2-3 specific, phrase-based improvement instructions
  summary: string;              // One-sentence overall assessment
}
```

**Why this contract:** The headline score is always out of 100 (fair comparison across platforms). The axis bars show raw values so each bar means the same thing regardless of platform. When negatives are N/A, the 5th bar disappears and the headline score is normalised upward. No fake 10/10 gifting. No bar totals that don't add up. The user sees 4 bars + an honest total, or 5 bars + an honest total.

### The 5 Scoring Axes (100 points total)

1. **Anchor Preservation (30pts)** — Are the user's original visual anchors from `humanText` still present in `optimisedPrompt`? Compare `humanText` → `assembledPrompt` → `optimisedPrompt` to trace anchor survival. Use `categoryRichness` to weight which categories the user invested in most. If the user specified 3 lighting terms and the optimised prompt has 1, that's a 2-term anchor loss.

2. **Platform-Native Fit (25pts — tier-adjusted)** — Does the prompt match what this platform expects?
   - **T1 (CLIP) / promptStyle 'keywords':** This is a **syntax** problem. Penalise missing `(parenthesised weights)`, wrong weight values, natural language verbosity. Syntax errors directly degrade CLIP image quality.
   - **T2 (Midjourney) / promptStyle 'keywords':** This is a **syntax** problem. Penalise missing `::weight`, wrong `--` parameters, prose where comma-separated tags belong.
   - **T3 (Natural Language) / promptStyle 'natural':** This is a **style/clarity** problem. Penalise ANY weight syntax or parameter tokens. Score positively for scene-description prose, temporal flow, conversational readability.
   - **T4 (Plain) / promptStyle 'natural':** This is a **readability** problem. Penalise complexity, jargon, technical tokens. Score for simplicity, directness, accessibility.

3. **Visual Specificity (20pts)** — Concrete visual detail vs vague language. "A beautiful landscape" = low. "Rain-lashed granite cliffs with salt spray catching amber light" = high. Count visual anchors: materials, colours, light directions, spatial relationships, textures, atmospheric effects. Cross-reference `categoryRichness` — specificity loss from Call 1 → Call 3 is penalised.

4. **Economy & Clarity (15pts)** — Is every word earning its place? Judge against `idealMin`/`idealMax`/`maxChars`. Penalise: duplicated adjectives, filler ("very", "really"), redundant modifiers, exceeding `idealMax` without visual value. Reward: staying in the sweet spot while preserving all anchors.

5. **Negative Quality (10pts | N/A)** — When `negativeSupport` is `'separate'` or `'inline'`: score exclusion quality. Generic ("ugly, bad") = low. Specific ("chromatic aberration, lens flare, text overlay") = high. Check no contradictions with positive prompt. When `negativeSupport` is `'none'`: return `null`, exclude from total, normalise headline score from 90 → 100.

### Directive Rules

**Hard rule: directives must reference specific phrases from the prompt, not abstract categories.**

```
✓ "Front-load 'lighthouse keeper' before the atmosphere clause"
✓ "Remove duplicate 'weathered' — appears twice, wastes tokens"
✓ "Replace generic negative 'ugly, bad quality' with 'chromatic aberration, motion blur'"

✗ "Make the prompt more descriptive"
✗ "Add more lighting detail"
✗ "Move word 23 to position 4"
```

Phrase-level, not position-level. Specific, not vague. The user should be able to Ctrl+F the referenced phrase in their prompt.

### System Prompt Structure

The system prompt receives:
- Full request payload
- 5 scoring rubrics with tier-adjusted fit rules
- Explicit instruction: return raw axis scores, the route normalises the headline
- Explicit instruction: 2-3 directives, phrase-based, Ctrl+F-able
- Explicit instruction: when `negativeSupport === 'none'`, return `negativeQuality: null`
- 4 calibration examples with expected scores and directives:
  - One T1/CLIP prompt (syntax-heavy scoring)
  - One T2/Midjourney prompt (syntax-heavy scoring)
  - One T3/Natural Language prompt (style/clarity scoring)
  - One T4/Plain prompt (readability scoring)

### Auto-Fire + Cache + Debounce

Three layers, each doing a different job:

1. **Exact-match cache (client-side):** Key `${platformId}:${sha256(optimisedPrompt).slice(0, 16)}`. Same prompt + same platform = cached score, zero API cost. Lives in `useRef` map. Invalidated on new Call 3 result or provider change.

2. **Debounce (client-side):** 3 seconds after Call 3 completes before firing Call 4. Absorbs rapid edit→optimise→edit→optimise flurries.

3. **Rate limit (server-side):** 30 requests per hour per user (Clerk auth). Abuse prevention only. Normal use (~10-15 scores/session) never hits this.

No blunt cooldown. Cache handles duplicates. Debounce handles flurries. Rate limit handles abuse.

### UI Location

Right rail, inside the Pipeline X-Ray Glass Case, below the Alignment ticker tape, above the Platform Match Navigator. Part of the X-Ray visualisation — the final readout.

- Circular score badge (emerald 80+, amber 60-79, rose below 60)
- 4 or 5 axis bars (5th hidden when negative N/A)
- 2-3 directive cards
- "Negative: N/A" label when platform doesn't support negatives

## Questions

1. Is this build-ready?
2. Anything else?
