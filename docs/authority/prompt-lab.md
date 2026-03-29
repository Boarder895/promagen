# Studio Section Authority Document

**Last updated:** 29 March 2026  
**Version:** 4.0.0  
**Owner:** Promagen  
**Authority:** This document defines the architecture, routes, and component behaviour for the Studio section (`/studio/*`).  
**Cross-reference:** For AI Disguise full specification (including v4.0.0 system prompt, P1–P12 post-processing pipeline, and harmony engineering), see `ai-disguise.md` v4.0.0. For harmony engineering methodology, see `harmonizing-claude-openai.md` v2.0.0. For the v4 four-phase flow (Check→Assess→Decide→Generate), see `prompt-lab-v4-flow.md` v1.3.0. For human sentence conversion UI and term matching, see `human-sentence-conversion.md`. For colour-coded prompt anatomy, see `paid_tier.md` §5.14. For Prompt Lab parity features, see `paid_tier.md` §5.13. For standard builder architecture, see `prompt-builder-page.md`. For optimizer details (client-side + Call 3 server-side), see `prompt-optimizer.md` v6.0.0. For human factors, see `human-factors.md`. For button styling standards, see `buttons.md`. For platform SSOT, see `platform-config.json` + `platform-config.ts`.

---

## Purpose

The Studio section (`/studio/*`) contains Promagen's creative tool pages. It is **not** a hub page — the `/studio` route itself redirects to the homepage. The two active child routes are:

| Route                | Name       | Purpose                                       | Status |
| -------------------- | ---------- | --------------------------------------------- | ------ |
| `/studio/playground` | Prompt Lab | AI-powered prompt creation (all 40 platforms) | Active |
| `/studio/library`    | My Prompts | Saved prompts library                         | Active |

**Removed (v6.0.0):** The Studio hub page with 4 feature cards (Library, Explore, Learn, Playground) was removed. `/studio` now redirects to `/`. The Explore page moved to `/prompts/explore`. Learn and Trending are not yet built.

---

## Route Structure

```
src/app/studio/
├── page.tsx                              # /studio → redirect to / (hub removed v6.0.0)
├── library/
│   └── page.tsx                          # /studio/library → Saved prompts (51 lines)
└── playground/
    ├── page.tsx                          # /studio/playground → Prompt Lab server (69 lines)
    └── playground-page-client.tsx        # Client wrapper (135 lines)
```

---

## `/studio/playground` — Prompt Lab

### Overview

The Prompt Lab is Promagen's AI-powered prompt creation environment. Unlike `/providers/[id]` (where the provider is pre-selected from the URL), the Prompt Lab lets users select any of the 40 platforms from a dropdown and see their prompt reshape in real time.

**v3.0.0 (23 March 2026):** The Prompt Lab now features the AI Disguise system — three targeted API calls to GPT-5.4-mini that generate and optimise prompts directly from human text, disguised as "1,001 proprietary algorithms". See `ai-disguise.md` for full specification.

**v4.0.0 (29 March 2026):** Call 2 system prompt advanced to v4.5 (6 targeted fixes from three-assessor stress testing). Call 3 expanded to 43 independent builder files with 406-line route. Negative prompt window added. Five critical bugs fixed (race condition, display bug, charCount, proseGroups, effectiveWasOptimized logic). See §AI Disguise Architecture and §Prompt Lab Features for details.

**Auth gate:** Pro Promagen exclusive — NOT YET GATED (see `paid_tier.md` §5.13). Currently accessible to all users.

**Pro page integration:** Listed as card 6 (🧪 Prompt Lab) in the Feature Control Panel on `/pro-promagen`. Free users see "Pro exclusive" / "Pro only". Paid users see "Full access" / "Open lab →".

---

### AI Disguise Architecture (v3.0.0, updated v4.0.0)

The Prompt Lab uses three API calls to GPT-5.4-mini, presented to the user as algorithmic processing:

| Call                  | Route                             | Purpose                                                                                              | When fired              | Visual                                      |
| --------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------- | ------------------------------------------- |
| **Call 1** (existing) | `POST /api/parse-sentence`        | Extract human text → 12 category JSON                                                                | "Generate Prompt" click | 12 category badges cycle in (150ms stagger) |
| **Call 2** (v3.0.0)   | `POST /api/generate-tier-prompts` | Generate 4 tier prompts directly from human text (**v4.5 system prompt** + post-processing pipeline) | In parallel with Call 1 | Tier cards populate with AI text            |
| **Call 3** (v3.0.0)   | `POST /api/optimise-prompt`       | Optimise assembled prompt for specific provider via **43 independent builder files**                 | "Optimise" toggle ON    | Algorithm cycling animation (101 names)     |

**Cost:** ~$0.008 per full generate + optimise cycle (GPT-5.4-mini).

**Disguise principle:** The user never sees "AI" or "GPT" in any UI text. The system presents as "Prompt Intelligence Engine" with "101 algorithms". See `ai-disguise.md` §1.

**Harmony engineering (v4.0.0):** Call 2's system prompt was refined through v4.0→v4.5 across 6 iterative versions using three human test scenes (station violinist, Victorian flower seller, sci-fi hangar mechanic) and three independent AI assessors (Claude, ChatGPT, Grok). Post-processing runs through 5 active functions in `harmony-post-processing.ts` (272 lines) catching GPT mechanical artefacts server-side. Compliance gates in `harmony-compliance.ts` (833 lines) enforce deterministic syntax rules. See `ai-disguise.md` v4.0.0 §6–§8 for full specification, `harmonizing-claude-openai.md` v2.0.0 for the methodology, `prompt-lab-v4-flow.md` for the v4.0→v4.5 fix programme.

**Calibration finding:** Claude scores T3 approximately 5–6 points too high and T4 approximately 3–5 points too high compared to the ChatGPT/Grok median, under-penalising verb substitutions and anchor drops. Use external assessors for calibration.

#### Data Flow

```
User types human description → clicks "Generate Prompt"
  │
  ├─ Call 1 fires → 12 category badges cycle in → dropdowns populate → DNA score updates
  │
  └─ Call 2 fires (parallel) → 4 tier cards fill with AI prompts (v4.5 system prompt)
     └─ If provider selected: "Generated for Leonardo AI" badge
     └─ AI text flows into assembled prompt box via activeTierPromptText

User clicks "Optimise" toggle
  │
  └─ Call 3 fires → algorithm cycling animation plays (160ms→deceleration→landing)
     └─ "✓ 97 algorithms applied" → optimised prompt fades in
     └─ Negative prompt window appears (if platform has negativeSupport: 'separate')

User switches provider (Leonardo → Midjourney)
  │
  ├─ Call 2 auto-re-fires with new provider context
  │  └─ Tier cards update with Midjourney-tailored AI prompts
  │
  └─ Stale Call 3 result cleared (clearAiOptimise)
     └─ If optimizer still ON: Call 3 re-fires for new provider

User clicks "Clear All"
  │
  └─ Full cascade: textarea empties, 12 dropdowns reset to empty,
     AI tiers clear, AI optimise clears, optimizer toggles OFF,
     aspect ratio resets, scene resets, drift resets
     (Footer Clear All uses clearSignal to trigger DescribeYourImage internal reset)
```

#### Provider-Specific Prompt Syntax

Call 2 and Call 3 system prompts are provider-aware:

- **Leonardo** (Tier 1): Uses `term::1.3` double-colon weight syntax, NOT SD-style `(term:1.3)` parentheses
- **Stable Diffusion** (Tier 1): Uses `(term:1.3)` parenthetical syntax
- **Midjourney** (Tier 2): Uses `::` prose weighting + `--ar`, `--v`, `--no` parameters
- **DALL·E** (Tier 3): Natural language sentences, no weight syntax
- **Canva** (Tier 4): Simple plain language, no jargon

**4-word weight wrapping rule:** Rich phrases longer than 4 words are NOT weight-wrapped. The system breaks them into shorter weighted terms (e.g., "lone woman in crimson coat" → `lone woman::1.3, crimson coat::1.2`).

**Quality suffix:** Tier 1 platforms get `sharp focus, 8K, intricate textures` appended at the end.

**Call 2 system prompt v4.5 (code is SSoT — see `generate-tier-prompts/route.ts`):**

- **v4.0 base:** No-provider default (parenthetical syntax), `--no` flag mandatory for T2, `--v 7` for Midjourney, weight hierarchy (subject highest), literal language for T1, expert value-add, semantic clustering + interaction merging, T3 opening diversity, T4 mandatory scene depth, emotional atmosphere mandate, T1 time-of-day weighting, T3 "that feels" ban (11 banned phrases).
- **v4.1:** T1 interaction token scanning, T4 anchor triage hierarchy, T4 value-add self-check, T4 anti-paraphrase opening, T3 "captured" standalone ban, T3 verb fidelity with WRONG/RIGHT examples.
- **v4.2:** Strengthened 3 weak fixes from v4.1 based on 3-scene retest.
- **v4.3:** T1 deduplication rule (remove standalone when interaction token created). T4 value-add reframed from "add a new element" to "convert one existing element into something richer."
- **v4.4:** **T2 `--no` duplication root-cause fix** — T2 `negative` JSON field set to empty string `""`. All negatives go inline after `--no` in the positive field only.
- **v4.5:** **T4 character ceiling raised 250→325** based on SSOT data (`platform-config.json` idealMax average is 277 characters, 7/15 T4 platforms accept 300+).

**Post-processing pipeline:** 5 active functions + `postProcessTiers()` orchestrator in `harmony-post-processing.ts` (272 lines). See `ai-disguise.md` v4.0.0 §7.

**GPT ceilings (permanent):** "reflect" → smear/ripple/shimmer/streak (T3/T4); "burn" → glow (T1/T4, cracked in T3/T4 on v4.5); run-to-run variance of 83–92 on identical inputs is expected.

---

### Component Architecture

#### Server Component: `page.tsx` (69 lines)

```typescript
export default async function PlaygroundPage() {
  const [providers, allExchanges, weatherIndex] = await Promise.all([
    getProviders(),
    getHomepageExchanges(),
    getWeatherIndex(),
  ]);
  const { left, right } = getRailsRelative(allExchanges, GREENWICH);
  const allOrderedExchanges = [...left, ...right.slice().reverse()];

  return (
    <PlaygroundPageClient
      providers={providers}
      leftExchanges={left}
      rightExchanges={right}
      allOrderedExchanges={allOrderedExchanges}
      weatherIndex={weatherIndex}
    />
  );
}
```

- `export const dynamic = 'force-dynamic'` — needs live weather data
- SEO metadata: "Prompt Lab — Promagen"
- Parallel data fetches (providers, exchanges, weather)
- Exchange ordering relative to Greenwich (server default)

#### Client Wrapper: `playground-page-client.tsx` (135 lines)

Renders `HomepageGrid` with Prompt Lab–specific content:

- **heroTextOverride:** Two states based on provider selection:
  - No provider: "Every platform speaks its own language..." (invitation)
  - Provider selected: "Same selections, different output..." (guidance)
- **headingText:** "Promagen — Prompt Lab"
- **showFinanceRibbon:** `false` (hidden on this route)
- **isStudioSubPage:** `true`
- Tracks `hasProvider` state via callback from `PlaygroundWorkspace`

#### PlaygroundWorkspace: `playground-workspace.tsx` (369 lines) — THE ORCHESTRATOR

**v3.0.0:** This is no longer a simple routing component. It is the AI Disguise orchestrator that lifts all AI hooks so state persists across provider ↔ no-provider component switches.

**Hooks lifted here (not in child components):**

| Hook                           | Purpose                                                                                                                                      |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `useTierGeneration()`          | Call 2 — AI tier prompt generation. Returns `aiTierPrompts`, `isGenerating`, `generatedForProvider`, `generate()`, `clear()`                 |
| `useDriftDetection(humanText)` | Drift detection — tracks word-level changes between current text and last-generated text. Returns `isDrifted`, `changeCount`, `markSynced()` |

**Key callbacks passed to children:**

| Callback                       | What it does                                                              |
| ------------------------------ | ------------------------------------------------------------------------- |
| `onDescribeTextChange(text)`   | Updates `humanText` state so drift detection can track changes            |
| `onDescribeGenerate(sentence)` | Fires Call 2 in parallel with Call 1, syncs drift baseline                |
| `onDescribeClear()`            | Full cascade: `clearTiers()` + `markDriftSynced('')` + `setHumanText('')` |

**Auto-re-fire:** When `selectedProviderId` changes and `humanText` exists, Call 2 automatically re-fires with the new provider context. Uses `prevProviderIdRef` to detect actual changes vs initial mount.

**Routing:**

```
selectedProvider === null → <EnhancedEducationalPreview />  (Lab preview, full-width)
selectedProvider !== null → <PromptBuilder />                (standard builder + AI props)
```

Both paths receive identical AI Disguise props: `aiTierPrompts`, `isTierGenerating`, `generatedForProvider`, `isDrifted`, `driftChangeCount`, `onDescribeTextChange`, `onDescribeGenerate`, `onDescribeClear`.

---

### Prompt Lab Components (v4.0.0)

#### Core Components

| Component                    | File                                                         | Lines     | Purpose                                                                                                                                                                             |
| ---------------------------- | ------------------------------------------------------------ | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PlaygroundWorkspace`        | `src/components/prompts/playground-workspace.tsx`            | **369**   | AI Disguise orchestrator — lifts hooks, auto-re-fires, passes AI state down                                                                                                         |
| `EnhancedEducationalPreview` | `src/components/prompts/enhanced-educational-preview.tsx`    | **1,913** | Lab preview — full-width layout, AI tier display, Call 3 wiring, algorithm animation, **negative prompt window**, race condition guards, footer Clear All cascade via `clearSignal` |
| `FourTierPromptPreview`      | `src/components/prompt-builder/four-tier-prompt-preview.tsx` | **942**   | 4-tier prompt cards, colour-coded text (Pro), "Generated for" badge, **tier provider icons strip**, white tier labels, `providers` prop                                             |
| `DescribeYourImage`          | `src/components/providers/describe-your-image.tsx`           | **1,153** | Human text input — textarea, **engine bay gradient Generate button** (pulse + shimmer), **purple gradient Clear All**, `clearSignal` prop, format detection, drift indicator        |

#### AI Disguise Components (new in v3.0.0)

| Component          | File                                              | Lines | Purpose                                                                                 |
| ------------------ | ------------------------------------------------- | ----- | --------------------------------------------------------------------------------------- |
| `AlgorithmCycling` | `src/components/prompt-lab/algorithm-cycling.tsx` | 256   | Cycling animation during Call 3 — amber→emerald colour shift, slot-machine deceleration |
| `DriftIndicator`   | `src/components/prompt-lab/drift-indicator.tsx`   | 136   | Amber pulsing "N changes detected" badge — §4 Zeigarnik Effect                          |

#### AI Disguise Hooks (v4.0.0)

| Hook                | File                               | Lines   | Purpose                                                                                       |
| ------------------- | ---------------------------------- | ------- | --------------------------------------------------------------------------------------------- |
| `useTierGeneration` | `src/hooks/use-tier-generation.ts` | **239** | Call 2 — fires `/api/generate-tier-prompts`, AbortController for provider-switch cancellation |
| `useAiOptimisation` | `src/hooks/use-ai-optimisation.ts` | **337** | Call 3 — fires `/api/optimise-prompt`, orchestrates 3-phase animation timing, clear cascade   |
| `useDriftDetection` | `src/hooks/use-drift-detection.ts` | 165     | Word-level diff, zero API calls, bag-of-words symmetric difference                            |

#### AI Disguise API Routes (v4.0.0)

| Route                             | File                                         | Lines   | Purpose                                                                                                                                                                                             |
| --------------------------------- | -------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/parse-sentence`        | `src/app/api/parse-sentence/route.ts`        | **455** | Call 1 — GPT extracts human text → 12 category JSON + matched phrases for text colouring                                                                                                            |
| `POST /api/generate-tier-prompts` | `src/app/api/generate-tier-prompts/route.ts` | **650** | Call 2 — GPT generates 4 native tier prompts (**v4.5 system prompt**, temp 0.5, max_completion 2000). Imports `postProcessTiers()` from `harmony-post-processing.ts`                                |
| `POST /api/optimise-prompt`       | `src/app/api/optimise-prompt/route.ts`       | **406** | Call 3 — GPT optimises assembled prompt for specific provider. **43 independent builder files**, proseGroups detection, server-side charCount, compliance gates. Config: temp 0.4 prose / 0.2 CLIP. |

#### Post-Processing Modules (v4.0.0)

Two separate post-processing files exist — one for Call 2, one for Call 3:

**Call 2 post-processing (`src/lib/harmony-post-processing.ts`):**

| File                                 | Lines   | Purpose                                                                                                                                                      |
| ------------------------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/lib/harmony-post-processing.ts` | **272** | 5 active functions + `postProcessTiers()` orchestrator — catches GPT mechanical artefacts on Call 2 responses. Imported by `generate-tier-prompts/route.ts`. |

Active functions: `deduplicateMjParams` (T2 `--no` dedup), `stripTrailingPunctuation` (T1 period strip), `fixT4SelfCorrection`, `fixT4MetaOpeners`, `mergeT4ShortSentences`. T1 also gets `enforceWeightCap` (from harmony-compliance.ts).

**Call 3 post-processing (`src/lib/optimise-prompts/harmony-post-processing.ts`):**

| File                                                  | Lines   | Purpose                                                                                                                                                              |
| ----------------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/optimise-prompts/harmony-post-processing.ts` | **439** | 7 active functions + `postProcessTiers()` — catches GPT artefacts on Call 3 responses. Includes T3-specific `fixT3MetaOpeners` and `stripClipQualitativeAdjectives`. |

**Compliance gate (shared by both Call 2 and Call 3):**

| File                            | Lines   | Purpose                                                                                                                                                                                                                                                                                                      |
| ------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/lib/harmony-compliance.ts` | **833** | Deterministic compliance functions: `enforceT1Syntax`, `enforceNegativeContradiction`, `enforceWeightCap`, `enforceMjParameters`, `enforceClipKeywordCleanup`, `detectT4MetaLanguage`, `detectT3BannedPhrases`, `runFullCompliance`. Rule ceiling tracking (`RULE_CEILING = 30`, `CURRENT_RULE_COUNT = 30`). |

**Test files:** Harmony test files (`harmony-post-processing.test.ts`, `harmony-compliance.test.ts`) were documented at 601+453 lines (115-test lockdown suite) — not present in current src.zip (may be excluded from zip or relocated).

#### Data Files (v4.0.0)

| File                          | Lines   | Purpose                                                                                              |
| ----------------------------- | ------- | ---------------------------------------------------------------------------------------------------- |
| `src/data/algorithm-names.ts` | **484** | Algorithm display names + finale names + Fisher-Yates shuffle + `getAlgorithmCount()` (87–102 range) |

#### Removed from Prompt Lab (v3.0.0)

| Component           | File                                                   | Status                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `IntelligencePanel` | `src/components/prompt-builder/intelligence-panel.tsx` | **REMOVED from Prompt Lab render.** The panel scored 52/100 for the AI Disguise workflow — it was designed for the dropdown-selection workflow and became a passive sidebar in the human-text-input workflow. DnaBar still receives `conflictCount`, `hasHardConflicts`, `healthScore` from the intelligence engine. **The IntelligencePanel remains fully intact in the standard builder (`/providers/[id]`).** |

---

### Layout (v3.0.0)

**Before (v2.0.0):** 3-column grid (`lg:grid-cols-3`) — left 2 columns for builder content, right 1 column for IntelligencePanel.

**After (v3.0.0):** Single-column full-width layout (`space-y-4`). All builder content stretches to full width — category dropdowns, assembled prompt, 4-tier preview, optimizer output. This gives more breathing room for prompt text display and the algorithm cycling animation.

---

### Prompt Lab Features (v4.0.0)

#### AI Disguise Features (new in v3.0.0, updated v4.0.0)

**1. AI Tier Generation (Call 2):** When "Generate Prompt" is clicked, Call 2 fires in parallel with Call 1. The AI generates 4 tier-native prompts directly from the user's human text, preserving poetry, spatial relationships, and creative intent. Template generators (`generators.ts`) are fallback only. `activeTierPromptText` uses `aiTierPrompts ?? generatedPrompts`. **v4.0.0:** System prompt at v4.5 with 6 iterative fixes (T1 interaction tokens, T2 `--no` root cause, T3 verb fidelity, T4 325-char ceiling, T1 dedup, T4 anchor triage).

**2. "Generated for" Badge:** When a provider is selected and Call 2 has returned, a violet badge appears in the 4-tier header: "Generated for Leonardo AI". De-selecting the provider keeps the badge visible with the last-generated provider name. Switching providers re-fires Call 2 and updates the badge.

**3. AI Prompt Optimisation (Call 3):** When the optimizer is toggled ON with a provider selected, Call 3 fires. The AI restructures the prompt for the specific provider — reordering by impact priority, applying provider-specific weight syntax, removing filler, strengthening quality anchors. **v4.0.0:** 43 independent builder files (no shared imports between builders), proseGroups detection for input framing, server-side charCount measurement, compliance gates. Config: temp 0.4 prose / 0.2 CLIP.

**4. Algorithm Cycling Animation:** During Call 3, algorithm names cycle at 160–200ms in amber monospace text, decelerating to a slot-machine stop, landing on "✓ {87–102} algorithms applied" in emerald. Minimum 1.8s display time. 12s hard timeout. `prefers-reduced-motion` respected. Human factors: §3 Anticipatory Dopamine, §6 Temporal Compression, §18 Animation as Communication.

**5. Prompt DNA Drift Detection:** Pure client-side word-level diff between current textarea text and last-generated text. Zero API calls. When `isDrifted && changeCount >= 3`, the Generate button pulses amber and changes to "Regenerate". Below 3 changes, only the amber badge appears. Human factor: §4 Zeigarnik Effect.

**6. Clear All Buttons (v3.1.0):** Purple gradient matching Dynamic/Randomise buttons (`border-purple-500/70 bg-gradient-to-r from-purple-600/20 to-pink-600/20 text-white`). Two identical buttons: one next to Generate (visible after generation), one in footer. Both trigger full cascade reset: textarea empties, all 12 category dropdowns reset to `{ selected: [], customValue: '' }`, optimizer toggles OFF, AI tier results clear, AI optimise results clear, aspect ratio resets, scene resets, drift resets. Footer Clear All uses `clearSignal` prop to trigger DescribeYourImage internal reset.

**7. Debounced Call 3 Re-fire:** When the optimizer is already ON and `activeTierPromptText` changes (aspect ratio change, selection change, AI tiers arrive), Call 3 re-fires after 800ms debounce. Ensures the optimised prompt stays in sync with the assembled prompt.

**8. Hint Text:** After generation, when no drift detected: "Edit your description above and click Regenerate to refine your prompts" in subtle slate text. Disappears when drift is detected (drift indicator takes over).

**9. Generate Button — Engine Bay Styling (v3.1.0):** The Generate Prompt button adopts the same visual treatment as the Launch Platform Builder button in the engine bay. When textarea has text: sky→emerald→indigo gradient (`from-sky-400/40 via-emerald-300/40 to-indigo-400/40`), `dyi-generate-pulse` animation (sky/emerald box-shadow 2s infinite), `dyi-generate-shimmer` overlay on hover. When empty: slate disabled. When loading: same gradient, spinner. All animations co-located in `DESCRIBE_STYLES` constant. See `human-sentence-conversion.md` §6.

**10. Tier Provider Icons (v3.1.0):** `FourTierPromptPreview` shows all providers for the active tier as a centered icon strip between the header and tier cards. Icons grouped via `getPlatformTierId()`. Styling matches PotM "Try in" icons: `bg-white/15 ring-1 ring-white/10`, `clamp(30px, 2.3vw, 38px)` squares, `drop-shadow(0 0 3px rgba(255,255,255,0.4))`. Non-clickable (`cursor-default`), hover glow + `scale(1.1)`. Tooltip shows provider name. New `providers` prop passed from `EnhancedEducationalPreview`.

**11. White Tier Labels (v3.1.0):** "Tier X: Name" and "Same scene, different syntaxes" text changed from `text-slate-500` to `text-white font-medium`. No grey text in Prompt Lab per code standard.

**12. `clearSignal` Mechanism (v3.1.0):** Footer Clear All cannot directly access DescribeYourImage's internal state (`inputText`, `hasGenerated`). Solution: `EnhancedEducationalPreview` holds `const [clearSignal, setClearSignal] = useState(0)`. Footer `handleClear()` increments it. DescribeYourImage has a `useEffect` watching `clearSignal` that resets its own internal state + fires `onClear()`. Avoids lifting textarea state to parent.

**13. Negative Prompt Window (v4.0.0):** For platforms with `negativeSupport: 'separate'`, an amber-styled negative prompt window renders below the optimised positive prompt. Call 3 negative takes priority; Call 2 tier negative is fallback. Shows provider name + icon, character count, inline copy button. Gated on `hasSeparateNegative && effectiveNegativeText`. Included in save handler alongside positive prompt. See `prompt-optimizer.md` v6.0.0 §14.8.

**14. "Optimised but unchanged" State (v4.0.0):** When Call 3 runs but the optimised text is identical to the assembled text (`isOptimisedButUnchanged`), the assembled prompt box still relabels to emerald "Optimised prompt" so the user knows optimisation was attempted — it just had nothing to improve.

**15. Race Condition Guards (v4.0.0):** Three separate `useEffect` hooks in EEP guard against stale Call 3 results: (a) `clearAiOptimise()` when `aiTierPrompts` changes (Call 2 returns new content), (b) `clearAiOptimise()` on provider change, (c) `clearAiOptimise()` in the Clear cascade.

#### Retained Features (from v2.0.0)

**16. Colour-coded prompts in all 4 tiers:** `FourTierPromptPreview` receives `isPro` and `termIndex` props. When `isPro=true`, each tier card renders prompt text via `parsePromptIntoSegments()` with `CATEGORY_COLOURS`.

**17. Assembled prompt box:** Full-width box showing `activeTierPromptText` (AI tier text when available, template text as fallback). Colour-coded for Pro users. Inline `SaveIcon` + copy icons. `StageBadge` in header. Char count right-aligned.

**18. Dynamic label switching:** When `isOptimizerEnabled && selectedProviderId`: label changes to "Optimized prompt in [Provider] [icon]" (emerald). Uses `effectiveWasOptimized` (AI result takes priority over client-side). **v4.0.0:** `effectiveWasOptimized` now compares text content (`aiOptimiseResult.optimised !== activeTierPromptText`), NOT length — fixes display bug where enriched prompts were hidden.

**19. Optimizer neutral mode:** When no provider selected, the optimizer toggle is force-disabled. Tooltip: "Select an AI provider above to enable optimisation."

**20. Green "Within optimal range":** When optimizer ON + provider selected + no trimming needed + not actively optimising: emerald bar "✓ Within optimal range — X chars / No trimming needed".

**21. LabCategoryColourLegend:** Positioned in header between `│` divider and Optimize toggle.

**22. Inline copy + save icons:** Copy + `SaveIcon` inside both assembled and optimized prompt boxes. All copy handlers call `incrementLifetimePrompts()`. **v4.0.0:** Save handler now includes `negativePrompt` field.

**23. DnaBar:** Still receives `conflictCount`, `hasHardConflicts`, `healthScore` from `useRealIntelligence` (simplified to return only DnaBar data, not full panel data).

---

### Key Difference: Lab vs Standard Builder (v4.0.0)

| Aspect                 | Standard Builder (`/providers/[id]`)             | Prompt Lab (`/studio/playground`)                                                    |
| ---------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------ |
| Header                 | Static: "Midjourney · Prompt builder"            | Dropdown: "[▼ Select Provider...]"                                                   |
| Provider               | Pre-selected from URL                            | User selects from all 40                                                             |
| No provider state      | N/A (always has provider)                        | Shows `EnhancedEducationalPreview` full-width                                        |
| AI tier generation     | No — uses template `generators.ts`               | Yes — Call 2 generates AI-native tier prompts (v4.5 system prompt)                   |
| AI prompt optimisation | No — client-side 4-phase optimizer only          | Yes — Call 3 (43 builders, temp 0.4/0.2) + client-side as fallback                   |
| Algorithm cycling      | No                                               | Yes — 101 names, amber→emerald, slot-machine landing                                 |
| Drift detection        | No                                               | Yes — word-level diff with "Regenerate" pulse                                        |
| Intelligence Panel     | Full panel (Conflicts, Suggestions, Market Mood) | **Removed** — DnaBar conflict count retained                                         |
| Layout                 | 3-column grid (builder + Intelligence Panel)     | Full-width single column                                                             |
| Prompt source          | Template assembly via `assemblePrompt()`         | AI tiers (Call 2) with template fallback                                             |
| Selection persistence  | Resets on URL change                             | Persists across provider switches                                                    |
| Colour coding          | Pro only (both boxes)                            | Pro only (all 4 tiers + both boxes)                                                  |
| Generate button        | Standard                                         | Engine bay gradient (pulse + shimmer when text present)                              |
| Clear All              | Standard clear                                   | Purple gradient, full cascade, `clearSignal` for external trigger                    |
| Tier provider icons    | None                                             | All providers for active tier shown as icon strip                                    |
| Post-processing        | None                                             | Call 2: 5 functions (dedup, strip, T4 fixes). Call 3: 7 functions + compliance gates |
| Negative prompt        | None                                             | Amber window for `negativeSupport: 'separate'` platforms (v4.0.0)                    |
| Stale result guards    | None                                             | 3 useEffect hooks clear Call 3 on tier change / provider change / clear (v4.0.0)     |

---

## `/studio/library` — My Prompts

**File:** `src/app/studio/library/page.tsx` (51 lines)

Saved prompts grid. Users can view, search, and reload previously saved prompts. Prompts saved from both the standard builder and the Prompt Lab appear here.

**Data:** Reads from `useSavedPrompts()` hook (localStorage-backed). Pro users will eventually get cross-device sync via Clerk metadata (`paid_tier.md` §5.3).

---

## Layout Contract

All Studio child pages use `HomepageGrid` with these standard props:

```typescript
<HomepageGrid
  mainLabel="..."
  headingText="Promagen — Prompt Lab"
  heroTextOverride={heroText}
  leftContent={<ExchangeList exchanges={left} ... side="left" />}
  centre={centreContent}
  rightContent={<ExchangeList exchanges={right} ... side="right" />}
  showFinanceRibbon={false}
  isStudioSubPage
  showEngineBay
  showMissionControl
/>
```

**Key props:**

- `showFinanceRibbon={false}` — FX ribbon hidden on Studio routes
- `isStudioSubPage` — Mission Control shows "Home" button (not "Studio")
- `showEngineBay` / `showMissionControl` — side panels visible

---

## Mission Control Integration

| Page                              | Mission Control Button | Destination          |
| --------------------------------- | ---------------------- | -------------------- |
| Homepage (`/`)                    | Studio                 | `/studio/playground` |
| Prompt Lab (`/studio/playground`) | Home                   | `/`                  |
| My Prompts (`/studio/library`)    | Home                   | `/`                  |
| Pro Promagen (`/pro-promagen`)    | Home                   | `/`                  |

**Prop:** `isStudioSubPage` on `HomepageGrid` triggers "Home" button in Mission Control.

---

## Non-Regression Rules

### Layout & Routing

- Do NOT restore the Studio hub page — `/studio` is a redirect, not a page
- Do NOT modify `HomepageGrid` unless adding new props (additive only)
- Do NOT change exchange rail components from within Studio pages
- Do NOT add `showFinanceRibbon={true}` — FX ribbon is hidden on Studio routes
- **Prompt Lab route is `/studio/playground` — do NOT use the legacy `/prompts/playground` path**

### Code Standards

- **All sizing via `clamp()` — no fixed px/rem — see `code-standard.md` § 6.0**
- **No opacity-based state dimming — use real colours (`text-slate-300` not `text-white/70`)**
- **`cursor-pointer` on ALL interactive elements — see `code-standard.md` § 6.0.4**
- **Do NOT duplicate CATEGORY_COLOURS — import from `src/lib/prompt-colours.ts`**
- **Animations co-located in `<style dangerouslySetInnerHTML>` — not in `globals.css`**

### AI Disguise

- **AI Disguise hooks (`useTierGeneration`, `useDriftDetection`) must be lifted in `PlaygroundWorkspace`, not in child components** — state must persist across provider switches
- **Call 2 fires in PARALLEL with Call 1 — never sequential**
- **Call 3 re-fires debounced (800ms) when `activeTierPromptText` changes while optimizer is ON**
- **`activeTierPromptText` must use `aiTierPrompts ?? generatedPrompts` — AI text takes priority**
- **Clear must cascade through ALL state: textarea, 12 category dropdowns, optimizer OFF, AI tiers, AI optimise, aspect ratio, scene, drift. Footer Clear All uses `clearSignal` to trigger DescribeYourImage internal reset.**
- **Algorithm names never reference "AI", "GPT", "OpenAI", or "LLM" — see `ai-disguise.md` §1**
- **Weight syntax is provider-specific — Leonardo uses `::`, SD uses `()` — never hardcode one as universal**
- **Post-processing is mandatory on all Call 2 AND Call 3 responses** — Call 2: 5 functions in `src/lib/harmony-post-processing.ts`. Call 3: 7 functions in `src/lib/optimise-prompts/harmony-post-processing.ts`. Do not bypass, remove, or make conditional.
- **Rule ceiling is 30** — raising requires explicit Martin approval. Tracked in `harmony-compliance.ts` with test assertion.
- **Post-processing extraction is permanent** — Call 2 functions live in `src/lib/harmony-post-processing.ts`, Call 3 functions live in `src/lib/optimise-prompts/harmony-post-processing.ts`. Do not move them back into route files.
- **`effectiveWasOptimized` must compare text content** (`optimised !== activeTierPromptText`), NOT length — length comparison hides enriched prompts (v4.0.0 fix)
- **Server-side `charCount` measurement is mandatory** — never trust GPT self-reported counts. `result.charCount = result.optimised.length` after all compliance gates.
- **No Call 3 builder may import from another builder** — complete isolation prevents cross-platform regressions
- **Stale Call 3 must be cleared when Call 2 returns new content** — `clearAiOptimise()` in the `aiTierPrompts` watcher effect

### UI Rules (v3.1.0)

- **Generate button must match engine bay styling exactly when text present** — `dyi-generate-pulse` and `dyi-generate-shimmer` are copied from `engine-bay-pulse` and `engine-bay-shimmer-sweep`. Slate/disabled when empty. Do not diverge from engine bay source.
- **Both Clear All buttons use purple gradient with white text** — `border-purple-500/70 bg-gradient-to-r from-purple-600/20 to-pink-600/20 text-white`. Matches Dynamic/Randomise canonical style from `buttons.md` §2.1. NOT Core Colours (that was v3.0.0, replaced in v3.1.0).
- **`clearSignal` must increment, not reset** — `setClearSignal(s => s + 1)` not `setClearSignal(1)`. The `useEffect` compares previous vs current via ref.
- **Tier labels are white** — "Tier X: Name" and "Same scene, different syntaxes" use `text-white font-medium`, not `text-slate-500`. No grey text in Prompt Lab.
- **Tier provider icons are non-clickable** — `cursor-default`, `div` not `button`. Hover glow + scale only. Do not add click handlers or navigation.

### Existing Behaviour

- **Dynamic label condition is `isOptimizerEnabled && selectedProviderId` — do NOT add `wasOptimized` (uses `effectiveWasOptimized` from AI result)**
- **`incrementLifetimePrompts()` must be called in all copy handlers — do NOT remove**
- **Optimizer neutral mode: when `!selectedProviderId`, force-disable optimizer — do NOT allow enabling without a provider**
- **IntelligencePanel is REMOVED from Prompt Lab — do NOT re-add. It remains in the standard builder only.**
- **DnaBar still receives `conflictCount`, `hasHardConflicts`, `healthScore` — do NOT remove the simplified `useRealIntelligence` hook**

---

## Related Documents

| Topic                                             | Document                                      |
| ------------------------------------------------- | --------------------------------------------- |
| AI Disguise full specification                    | `ai-disguise.md` v4.0.0                       |
| Harmony engineering playbook                      | `harmonizing-claude-openai.md` v2.0.0         |
| V4 four-phase flow (Check→Assess→Decide→Generate) | `prompt-lab-v4-flow.md` v1.3.0                |
| Human sentence conversion UI + term matching      | `human-sentence-conversion.md`                |
| Prompt builder architecture                       | `prompt-builder-page.md`                      |
| Colour-coded prompt anatomy                       | `paid_tier.md` §5.14                          |
| Prompt Lab parity features                        | `paid_tier.md` §5.13                          |
| Pro Gem Badge (lifetime counter)                  | `paid_tier.md` §5.15                          |
| Prompt optimizer (client-side + Call 3)           | `prompt-optimizer.md` v6.0.0                  |
| Platform SSOT                                     | `platform-config.json` + `platform-config.ts` |
| Harmony anti-regression                           | `harmony-anti-regression.md`                  |
| Trend analysis + scoring data                     | `trend-analysis.md` v6.0.0                    |
| Human factors                                     | `human-factors.md`                            |
| Button styling standards                          | `buttons.md`                                  |
| Homepage layout                                   | `homepage.md`                                 |
| Mission Control                                   | `mission-control.md`                          |
| Engine Bay                                        | `ignition.md`                                 |
| Intelligence system                               | `prompt-intelligence.md` §9                   |
| Code standards                                    | `code-standard.md`                            |
| SSOT colour constants                             | `code-standard.md` § 6.14                     |
| Master test document                              | `test.md`                                     |

---

## Changelog

- **29 Mar 2026 (v4.0.0):** **CALL 2 v4.5 + CALL 3 INDEPENDENT BUILDERS + NEGATIVE PROMPT + 5 BUG FIXES.** Updated version from 3.2.0→4.0.0. Platform count corrected from 42→40 throughout. §AI Disguise Architecture: Call 2 description updated to reference v4.5 system prompt (6 iterative versions, three-assessor methodology). Call 3 description updated to reference 43 independent builder files. Added calibration finding (Claude scores T3 ~5-6pts, T4 ~3-5pts too high). Harmony engineering summary rewritten: now references v4.0→v4.5, three test scenes, three assessors, two separate post-processing files. §Data Flow: Added negative prompt window to Optimise flow. Added stale Call 3 clear on provider switch. §Provider-Specific Prompt Syntax: Rewrote as versioned progression v4.0→v4.5 with specific fixes per version (T1 interaction tokens, T2 `--no` root cause, T3 verb fidelity, T4 325-char ceiling, T1 dedup, T4 anchor triage). Added GPT ceilings. Post-processing reference corrected: "7 functions (P1–P12)" → "5 active functions + postProcessTiers()". §Component Architecture: Updated all line counts to match src.zip ground truth — PlaygroundWorkspace 313→369, EEP 2,014→1,913, FourTierPromptPreview 788→942, DescribeYourImage 722→1,153, use-tier-generation 224→239, use-ai-optimisation 335→337, algorithm-names 187→484, generate-tier-prompts 523→650, optimise-prompt 336→406, harmony-post-processing (Call 2) 342→272, harmony-compliance 486→833. §Post-Processing Modules: Rewritten as two separate subsections — Call 2 (272 lines, 5 functions) and Call 3 (439 lines, 7 functions) with separate file paths. Compliance gate updated to 833 lines with full function list. Test files noted as not in current src.zip. §Prompt Lab Features: Added features 13 (negative prompt window), 14 (optimised-but-unchanged state), 15 (race condition guards). Feature 1 updated with v4.5 system prompt. Feature 3 updated with 43 builders and config details. Feature 18 updated with effectiveWasOptimized text comparison fix. Feature 22 updated with negativePrompt in save handler. §Comparison table: Added 3 rows (negative prompt, stale result guards, post-processing split). Updated Call 3 description and post-processing row. §Non-Regression Rules: Added 4 new AI Disguise rules (text comparison for effectiveWasOptimized, server-side charCount, no builder cross-imports, stale Call 3 clearing). Updated post-processing rule to reference both files. §Related Documents: Added platform-config SSOT, harmony-anti-regression, trend-analysis v6.0.0. Updated prompt-optimizer reference to v6.0.0. §Cross-reference header: Added prompt-optimizer v6.0.0, platform-config references.

- **25 Mar 2026 (v3.2.0):** **HARMONY v2 INFRASTRUCTURE SYNC.** Cross-references updated: ai-disguise v3.0.0→v4.0.0, added harmonizing v2.0.0, added prompt-lab-v4-flow v1.3.0. Call 2 description updated: 18→30 system prompt rules, P1+P2→P1–P12 post-processing pipeline. Harmony engineering summary updated: 5→6+ rounds + 3 stress tests, 62→93 changed to 62→96, dual-assessor convergence (≤1 point gap). API Routes section updated to v4.0.0: route.ts 406→523 lines, parse-sentence 243→455 lines, optimise-prompt 315→336 lines. Added Post-Processing Module subsection: harmony-post-processing.ts (342 lines, 7 functions), harmony-compliance.ts (486 lines), 2 test files (601+453 lines, 115-test lockdown suite). Non-regression rules expanded: P1+P2→P1–P12 reference, added 115-test lockdown requirement, rule ceiling 30, extraction permanent. Related Documents: added harmonizing v2.0.0, prompt-lab-v4-flow v1.3.0, test.md.

- **23 Mar 2026 (v3.1.0):** **HARMONY ENGINEERING + UI POLISH.** Call 2 system prompt evolved from 11 rules to 18 rules through 5 rounds of iterative harmony testing (scoring 62→93/100). Post-processing layer added: `deduplicateMjNegatives()` (P1) catches T2 duplicate negatives, `stripTrailingPunctuation()` (P2) catches T1 trailing periods. `route.ts` grew from 319→406 lines. Temperature 0.3→0.5, max_completion_tokens 1500→2000. UI changes: Generate button adopts engine bay gradient+pulse+shimmer when text present (sky→emerald→indigo, matching Launch Platform Builder exactly). Clear All buttons changed from Core Colours gradient to purple gradient with white text (matching Dynamic/Randomise canonical style). `clearSignal` mechanism added for footer→DescribeYourImage cascade reset. `FourTierPromptPreview` updated (684→788 lines): tier provider icons strip showing all providers for active tier (PotM-matching style, non-clickable, hover glow+scale), white tier labels replacing `text-slate-500`. `DescribeYourImage` updated (667→722 lines). `EnhancedEducationalPreview` updated (2,008→2,014 lines). Non-regression rules expanded with UI rules section. Cross-references updated: `human-sentence-conversion.md`, `buttons.md` added. See `ai-disguise.md` v3.0.0 §6–§8 for full system prompt, post-processing, and harmony engineering specification.

- **23 Mar 2026 (v3.0.0):** **AI DISGUISE + INTELLIGENCE PANEL REMOVAL + FULL-WIDTH LAYOUT.** Major architectural update. PlaygroundWorkspace (229→313 lines) rewritten as AI Disguise orchestrator — lifts `useTierGeneration` and `useDriftDetection` hooks so AI state persists across provider switches. Auto-re-fires Call 2 when provider changes. 8 new files added: 2 API routes (`generate-tier-prompts` 319 lines, `optimise-prompt` 315 lines), 3 hooks (`use-tier-generation` 224 lines, `use-ai-optimisation` 335 lines, `use-drift-detection` 165 lines), 2 animation components (`algorithm-cycling` 256 lines, `drift-indicator` 136 lines), 1 data file (`algorithm-names` 187 lines — 101 cycling names + 3 finale + shuffle). EnhancedEducationalPreview (1,899→2,008 lines): Call 3 wiring with debounced 800ms re-fire, `AlgorithmCycling` render, effective optimised values (`aiOptimiseResult` priority over client-side), full cascade clear (12 dropdowns + optimizer OFF + AI clear). `IntelligencePanel` removed from Prompt Lab render (scored 52/100 for AI Disguise workflow — designed for dropdown selection, became passive sidebar in human-text workflow). DnaBar still fed via simplified `useRealIntelligence`. Layout changed from `lg:grid-cols-3` to single-column `space-y-4` full-width. DescribeYourImage (577→667 lines): Clear button with Core Colours gradient + full cascade reset, drift indicator badge, "Regenerate" amber pulse when drift ≥ 3, hint text after generation. FourTierPromptPreview (647→684 lines): "Generated for X" violet badge, "Generating..." amber pulse. Call 2 system prompt: provider-specific weight syntax (Leonardo `::`, SD `()`), 4-word weight wrapping rule, quality suffix. Call 3 system prompt: mandatory provider syntax enforcement, dynamic examples, quality suffix for Tier 1. Comparison table updated: 14 aspects including AI features and layout changes. Non-regression rules: 17 rules across 4 categories (layout, code standards, AI Disguise, existing behaviour).

- **18 Mar 2026 (v2.0.0):** **COMPLETE REWRITE — Studio hub removed, Prompt Lab parity.** Studio hub page (`/studio`) removed and replaced with redirect to homepage. `studio-page-client.tsx` deleted. 4 feature cards (Library, Explore, Learn, Playground) removed — routes now accessed directly. Document scope changed from "Studio hub page" to "Studio section (`/studio/*`)". Added full Prompt Lab (`/studio/playground`) documentation: server component (89 lines), client wrapper (140 lines), `PlaygroundWorkspace` (229 lines), `EnhancedEducationalPreview` (1,899 lines), `FourTierPromptPreview` (647 lines), `IntelligencePanel` (515 lines). Documented all 11 Prompt Lab parity features: colour-coded 4-tier prompts, assembled prompt box with StageBadge, dynamic label switching (assembled → optimized), provider icon on optimized label, optimizer neutral mode, green "Within optimal range" feedback, LabCategoryColourLegend, inline copy + save icons, lifetime counter wiring, cursor-pointer enforcement. Added Lab vs Standard Builder comparison table. Added Layout Contract section. Updated Mission Control integration table. Added 10 non-regression rules. Updated file structure and all related documents.

- **26 Jan 2026 (v1.0.0):** Initial implementation — Studio hub page using HomepageGrid layout. 4 feature cards: Library, Explore, Learn, Playground. Native `<a>` tags for navigation. Integration with Mission Control (`isStudioPage` prop). Live exchange/weather data.

---

_This document is the authority for the Studio section. For individual feature details, see their respective documents._

_**Key principle:** Always update docs FIRST before writing any code. Docs are the single source of truth._
