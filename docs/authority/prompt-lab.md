# Prompt Lab — Authority Document

**Last updated:** 9 April 2026
**Version:** 5.0.0 (merged: Studio section + v4 flow)
**Owner:** Promagen
**Status:** Production — Prompt Lab is the homepage (`/`)
**Merged from:** `prompt-lab.md` v4.0.0 (Studio section) + `prompt-lab-v4-flow.md` v2.0.0 (four-phase flow)

---

# Part 1 — Studio Section Architecture


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

---

# Part 2 — Prompt Lab v4.0 Flow (Check → Assess → Decide → Generate)


**Version:** 2.0.0  
**Created:** 24 March 2026  
**Updated:** 29 March 2026  
**Owner:** Promagen  
**Status:** APPROVED — ready to build. Backend contract (Call 2 gapIntent/categoryDecisions) already deployed. Call 2 system prompt at v4.5 (production-confirmed via three-assessor stress testing). Call 3 expanded to 43 independent builder files. Client-side 4-phase UI not yet built.  
**Scope:** Prompt Lab (`/studio/playground`) ONLY. Standard builder (`/providers/[id]`) is untouched.  
**Authority:** This document defines the agreed architecture for the Prompt Lab's new intelligent flow. No code is written until this doc is approved.

> **Cross-references:**
>
> - `ai-disguise.md` v4.0.0 — Disguise principle, naming conventions, security hardening, post-processing layer (§7)
> - `prompt-lab.md` v4.0.0 — Current Prompt Lab architecture (superseded by this doc on completion)
> - `prompt-optimizer.md` v6.0.0 — Client-side optimizer + Call 3 server-side architecture (43 independent builders, compliance gates, negative rendering)
> - `human-sentence-conversion.md` v2.0.0 — Call 1 current spec (to be rewritten per §3)
> - `harmonizing-claude-openai.md` v2.0.0 — Harmony methodology for system prompt engineering, 30-rule inventory, post-processing pipeline
> - `human-factors.md` v1.1.0 — Curiosity Gap, Cognitive Load, Anticipatory Dopamine, Temporal Compression
> - `code-standard.md` v4.0 — All code standards (clamp, no grey text, co-located animations, cursor-pointer)
> - `best-working-practice.md` — Docs-first gate, SSOT discipline, security-first development, verify-before-modifying, playground-first workflow
> - `prompt-intelligence.md` — 12 category definitions, semantic tags, DNA scoring
> - `platform-config.json` + `platform-config.ts` — Platform SSOT (40 platforms)

---

## Table of Contents

1. [Why This Change](#1-why-this-change)
2. [The Four-Phase Flow](#2-the-four-phase-flow)
3. [Phase 1 — Check](#3-phase-1--check)
4. [Phase 2 — Assess](#4-phase-2--assess)
5. [Phase 3 — Decide](#5-phase-3--decide)
6. [Phase 4 — Generate](#6-phase-4--generate)
7. [Side Notes Architecture](#7-side-notes-architecture)
8. [Call 1 — New Role (Category Assessment)](#8-call-1--new-role-category-assessment)
9. [Call 2 — Updated Input Contract](#9-call-2--updated-input-contract)
10. [Call 3 — Unchanged](#10-call-3--unchanged)
11. [Disguise & Security](#11-disguise--security)
12. [Human Factors Alignment](#12-human-factors-alignment)
13. [Client State Machine & Race Conditions](#13-client-state-machine--race-conditions)
14. [Open Design Questions](#14-open-design-questions)
15. [Tests — Delete & Rebuild](#15-tests--delete--rebuild)
16. [Build Order](#16-build-order)
17. [Files Affected](#17-files-affected)
18. [Non-Regression Rules](#18-non-regression-rules)
19. [Decisions Log](#19-decisions-log)
20. [Phase 2 Parking Lot (Post-Core)](#20-phase-2-parking-lot-post-core)

---

## 1. Why This Change

### The problem with the current flow

The current Prompt Lab fires Call 1 (category extraction) and Call 2 (4-tier generation) in parallel the moment the user clicks Generate. The 12 category dropdowns fill, the 4 tier boxes fill, and the user is hit with a wall of output. There is no conversation between the user and the engine. The engine does not acknowledge the user's input before acting on it.

This creates three problems:

1. **No respect for user intent.** The engine never tells the user "your prompt is strong" or "your prompt is missing lighting." It just processes and outputs. The user never learns what makes a good prompt.
2. **No user agency over gaps.** If the user's prompt covers 8 of 12 categories, the engine silently fills the other 4. The user has no say in whether the engine should handle those gaps, or whether they want to handle them manually, or whether they want to ignore them entirely.
3. **The simultaneous output screams "API call."** Everything appearing at once undermines the Disguise principle. An intelligent engine would check, think, then act — not fetch and dump.

### The fix

Replace the parallel fire with a four-phase sequential flow:

**Check → Assess → Decide → Generate**

Each phase has a purpose. Each phase is visible to the user. Each phase respects the user's creative input before the engine acts on it.

---

## 2. The Four-Phase Flow

```
User types human description → clicks "Generate"
  │
  ├─ PHASE 1: CHECK
  │  Call 1 fires → cycling category animation plays
  │  Engine assesses which of 12 categories the human text covers
  │
  ├─ PHASE 2: ASSESS
  │  Assessment box appears beneath human text box
  │  Shows satisfaction result: "All 12 categories covered" or "9 of 12 — 3 gaps"
  │  User sees which categories are covered and which are missing
  │  THE ENGINE PAUSES HERE — it does not auto-generate
  │
  ├─ PHASE 3: DECIDE (only if gaps exist)
  │  Missing categories appear as a list with Engine/Manual toggles
  │  Default: all toggles on "Engine" (path of least resistance)
  │  Manual: dropdown expands with keyword/phrase choices → becomes side note
  │  User clicks "Generate" to proceed, or "Skip gaps" to ignore
  │  If all 12 satisfied: user still sees the assessment, still clicks to proceed
  │
  └─ PHASE 4: GENERATE
     Call 2 fires with: human text + side notes + engine-fill instructions
     4 tier boxes populate with intelligent prompts
     Call 3 available for provider-specific optimisation (unchanged)
```

### The critical pause

Even when all 12 categories are satisfied, the user sees the assessment result and clicks to proceed. The engine does not silently skip to generation. This pause communicates: "We read what you wrote, we understood it, and we're waiting for your permission." That is the product caring about the user's intent.

---

## 3. Phase 1 — Check

### What happens

1. User types or pastes text into the human text box
2. User clicks "Generate"
3. Call 1 fires to the Prompt Intelligence Engine
4. The cycling category animation plays while Call 1 is processing

### The cycling category animation

The existing category badge animation (12 badges cycling in with 150ms stagger) plays during Phase 1. This is the visual feedback that the engine is reading and assessing the user's input. Each badge represents one of the 12 categories being checked.

### Call 1's new role

Call 1 changes from "extract terms into 12 categories" to "assess which categories are covered." The output changes from arrays of extracted terms to a coverage map with satisfaction status per category. See §8 for the full specification.

### What does NOT happen

- Call 2 does NOT fire during Phase 1 (no parallel firing)
- Dropdowns do NOT populate during Phase 1
- The 4 tier boxes remain empty

---

## 4. Phase 2 — Assess

### What happens

1. Call 1 returns the category coverage assessment
2. An assessment box appears beneath the human text box
3. The user sees: overall satisfaction (e.g., "9 of 12 categories covered") and which categories are covered vs missing

### The assessment box

This is a new UI component. It sits between the human text box and the decision area. It is automatic — the user does not interact with it to make it appear. It appears as soon as Call 1 returns.

**Content when all 12 satisfied:**

- Satisfaction indicator showing full coverage
- Clear signal that the prompt is strong
- A "Generate" button to proceed to Phase 4

**Content when gaps exist:**

- Satisfaction indicator showing partial coverage (e.g., "9 of 12")
- List of covered categories (visual confirmation)
- List of missing categories (leads into Phase 3)

### Visual design (OPEN — to be resolved during build)

The exact visual treatment of the assessment box is an open design question. Options to prototype during build:

- Category pills that illuminate green (covered) or show as gaps (missing)
- A progress-bar style indicator
- A compact text summary with colour-coded category names

See §14 for the full list of open design questions. These are solved during prototyping, not before.

---

## 5. Phase 3 — Decide

### When it appears

Phase 3 only appears if Call 1 identifies missing categories. If all 12 are covered, the user proceeds directly from Phase 2 to Phase 4 via the Generate button (but never automatically — always user-initiated).

### The unified interface

Missing categories appear as a list. Each has a binary toggle: **"Engine"** (default) or **"Manual"**.

| Toggle state         | What happens                                                                                                                                    |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **Engine** (default) | The engine fills this category intelligently when Call 2 fires. The user does nothing.                                                          |
| **Manual**           | A dropdown expands beneath that category showing keyword/phrase choices. The user picks one. It becomes a side note attached to the human text. |

### Actions

At the bottom of the decision area, two actions:

| Action        | Type                  | What it does                                                                                                                                                          |
| ------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Generate**  | Primary button        | Proceeds to Phase 4 with current toggle states. Engine-toggled categories are filled by Call 2. Manual-toggled categories send the user's chosen terms as side notes. |
| **Skip gaps** | Secondary/subtle link | Ignores all missing categories. Call 2 fires with only the human text, no gap-filling instructions.                                                                   |

### How this covers all four user paths

| User intent                                                  | How they achieve it                                                 |
| ------------------------------------------------------------ | ------------------------------------------------------------------- |
| Fill all gaps manually (old Option 1)                        | Flip all toggles to Manual, pick from dropdowns, click Generate     |
| Ignore all gaps (old Option 2)                               | Click "Skip gaps"                                                   |
| Let the engine sort all gaps (old Option 3)                  | Change nothing (all toggles default to Engine), click Generate      |
| Hybrid — engine sorts some, user sorts others (old Option 4) | Flip some toggles to Manual, leave others on Engine, click Generate |

All four paths exist. None need explaining. The interface teaches itself.

### Manual dropdown content

When a toggle is set to Manual, the dropdown shows keyword/phrase choices relevant to that category. These are drawn from the existing vocabulary in `prompt-options.json` — the same terms available in the standard builder's dropdowns. This also serves as education: the user learns what good lighting terms, composition terms, or atmosphere terms look like.

---

## 6. Phase 4 — Generate

### What happens

1. Call 2 fires with the composite input: human text + side notes + engine-fill instructions
2. **Server-side:** GPT response passes through `postProcessTiers()` pipeline before reaching the client — 5 active functions in `harmony-post-processing.ts` (272 lines) catch mechanical artefacts like duplicate negatives, meta-language openers, T4 self-correction. Compliance gates in `harmony-compliance.ts` (833 lines) enforce deterministic syntax rules. See `ai-disguise.md` §7 for the full pipeline.
3. The 4 tier boxes populate with intelligent, post-processed prompts
4. If a provider is selected, Call 3 is available for platform-specific optimisation (unchanged from current behaviour)

### What the engine receives

Call 2's input is richer than before. Instead of just the human text string, it now receives a typed request with explicit intent:

```typescript
{
  sentence: "A lone mermaid glides through crystal-clear tropical water...",
  providerId: "leonardo" | null,
  providerContext: { ... } | null,
  gapIntent: "user-decided",
  categoryDecisions: [
    { category: "lighting", fill: "engine" },
    { category: "composition", fill: "wide shot" },
    { category: "materials", fill: "engine" },
  ]
}
```

Categories not listed in `categoryDecisions` are already covered by the human text. The `gapIntent` field tells Call 2 why it's receiving this particular shape of input — see §9 for the full typed contract.

---

## 7. Side Notes Architecture

### What side notes are

Side notes are metadata attached to the human text. They represent additional category terms the user has chosen via the Manual toggle dropdowns in Phase 3. They are NOT edits to the human text — the user's original text stays untouched.

### Visual representation

Side notes appear as small pills/chips alongside the human text box. Each pill shows the category name and the chosen term (e.g., "Lighting: golden hour"). They are visually distinct from the human text — a different colour, smaller, clearly supplementary.

### Lifecycle

1. Created when user selects a term from a Manual dropdown in Phase 3
2. Visible alongside the human text box after creation
3. Sent to Call 2 as entries in `categoryDecisions` with the user's chosen term as the `fill` value
4. Persist across re-generations (the user doesn't have to re-select)
5. Cleared when the user clicks Clear All (full cascade reset)
6. **Auto-cleared when re-assessment covers the category with HIGH confidence.** If the user edits their human text and Call 1 now reports that category as `covered: true, confidence: "high"`, the side note for that category is automatically removed and the pill disappears with a brief fade-out. This prevents invisible state where a stale side note silently constrains Call 2 after the user has clearly addressed the gap in their text. **If confidence is `"medium"`, the side note is NOT auto-cleared** — the user's deliberate manual choice is stronger than a vague implication. The user sees both the "loosely covered" indicator and their existing side note, and can remove the side note manually if they choose.

### Contradiction handling

Side notes and human text can partially overlap. The rules are:

| Scenario                                                                                        | What happens                                                                                                                                                                                                                                                  |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User adds side note "golden hour" for lighting, then edits text to include "golden hour"        | Call 1 re-assesses → lighting covered with `confidence: "high"` → side note auto-clears                                                                                                                                                                       |
| User adds side note "wide shot" for composition, then edits text to include "panoramic view"    | Call 1 re-assesses → composition covered with `confidence: "high"` (different term but same category, clearly present) → side note auto-clears                                                                                                                |
| User adds side note "hard rim-lit side light" for lighting, then edits text to include "sunset" | Call 1 re-assesses → lighting covered with `confidence: "medium"` (implied, not explicit) → **side note persists**. The user's expert term is stronger than a vague implication. The user sees both the "loosely covered" indicator and their side note pill. |
| User has side note, does NOT edit text, clicks Generate again                                   | No re-assessment (text unchanged). Side note persists. Call 2 receives it.                                                                                                                                                                                    |

### Regeneration behaviour

When the user edits their human text and clicks Generate again:

1. Call 1 re-assesses the human text (ignoring side notes — it only assesses raw human text)
2. If the human text now covers a category with `confidence: "high"` that previously had a side note, that side note auto-clears
3. If the human text now covers a category with `confidence: "medium"` that previously had a side note, the side note persists — user intent is preserved over vague coverage
4. Existing side notes for still-missing categories remain attached
5. The user can modify or remove remaining side notes before clicking Generate again
6. New gaps (categories that were covered before but are no longer after the edit) appear fresh in Phase 3 with default Engine toggles

---

## 8. Call 1 — New Role (Category Assessment)

### Current role (to be replaced)

Call 1 currently extracts terms into 12 category arrays, which then populate dropdowns via fuzzy matching. This is documented in `human-sentence-conversion.md` v2.0.0.

### New role

Call 1 assesses which of the 12 categories the human text covers. It returns a coverage map, not extracted terms.

### New output format

```json
{
  "coverage": {
    "subject": { "covered": true, "confidence": "high" },
    "action": { "covered": true, "confidence": "high" },
    "style": { "covered": false, "confidence": "high" },
    "environment": { "covered": true, "confidence": "high" },
    "composition": { "covered": false, "confidence": "high" },
    "camera": { "covered": false, "confidence": "high" },
    "lighting": { "covered": true, "confidence": "medium" },
    "colour": { "covered": true, "confidence": "high" },
    "atmosphere": { "covered": true, "confidence": "high" },
    "materials": { "covered": true, "confidence": "high" },
    "fidelity": { "covered": false, "confidence": "high" },
    "negative": { "covered": false, "confidence": "high" }
  },
  "coveredCount": 7,
  "totalCategories": 12,
  "allSatisfied": false
}
```

### Confidence field

The `confidence` field indicates how certain the engine is about the assessment. `"high"` = clearly present or clearly absent. `"medium"` = implied but not explicit (e.g., "sunset" implies lighting but doesn't state it). This is used for visual treatment in the assessment UI:

| Confidence | Covered | Visual treatment                                                                                  |
| ---------- | ------- | ------------------------------------------------------------------------------------------------- |
| `"high"`   | `true`  | Strong positive indicator — the category is solidly present                                       |
| `"medium"` | `true`  | Softer positive indicator — the category is implied, user may want to strengthen it               |
| `"high"`   | `false` | Clear gap — the category is genuinely missing                                                     |
| `"medium"` | `false` | Unlikely combination (if the engine isn't sure it's absent, it's probably implied). Treat as gap. |

The covered/not-covered decision remains binary for the flow logic (Phase 3 only shows categories where `covered: false`). The confidence value affects visual weight only — a `"medium"` covered category looks slightly different from a `"high"` covered one, subtly communicating "this could be stronger" without adding another decision step.

### System prompt (to be written)

The system prompt for the new Call 1 needs to be written and harmony-tested. This is simpler than the current extraction prompt because the engine only needs to make a yes/no judgement per category, not extract and return specific terms.

**Harmony requirement:** The new Call 1 system prompt must go through the same iterative testing methodology documented in `harmonizing-claude-openai.md`. Claude writes the prompt, GPT-5.4-mini executes it, both assess independently, scores converge.

### Edge cases (to be resolved during testing)

| Scenario                                                                                         | Expected behaviour                                                                                    |
| ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| User writes 3 words ("a red car")                                                                | Call 1 returns low coverage (2-3 categories). Assessment shows many gaps. User decides how to handle. |
| User writes 1,000 characters covering only 4 categories                                          | Call 1 returns 4 covered. Assessment shows 8 gaps. Long text doesn't mean good coverage.              |
| User writes a prompt that implies but doesn't state a category (e.g., "sunset" implies lighting) | Confidence: `"medium"`. Covered: `true`. The engine recognises implicit content.                      |
| User writes in prompt syntax (CLIP tokens, MJ parameters)                                        | Call 1 must handle structured input, not just natural English. This is a harmony testing item.        |

---

## 9. Call 2 — Updated Input Contract

### Current input

```typescript
{
  sentence: string;
  providerId: string | null;
  providerContext: ProviderContext | null;
}
```

### New input

```typescript
/** The 12 valid category keys — enforced by Zod, no open strings allowed */
type PromptCategory =
  | "subject"
  | "action"
  | "style"
  | "environment"
  | "composition"
  | "camera"
  | "lighting"
  | "colour"
  | "atmosphere"
  | "materials"
  | "fidelity"
  | "negative";

/** One decision per missing category */
interface CategoryDecision {
  /** Must be a valid PromptCategory AND must be a category Call 1 reported as NOT covered */
  category: PromptCategory;
  /**
   * "engine" = the engine fills this.
   * A string value = user's chosen term (side note).
   *
   * String validation (enforced by Zod):
   * - Trimmed (leading/trailing whitespace stripped)
   * - Minimum 1 character after trim
   * - Maximum 100 characters
   * - Not "engine" (reserved keyword)
   */
  fill: "engine" | string;
}

/**
 * DISCRIMINATED UNION — gapIntent determines the shape.
 * Each variant enforces its own constraints so contradictions
 * are structurally impossible.
 */
type GenerateTierRequest =
  | {
      sentence: string;
      providerId: string | null;
      providerContext: ProviderContext | null;
      gapIntent: "all-satisfied";
      categoryDecisions: []; // Must be empty array — enforced by Zod
    }
  | {
      sentence: string;
      providerId: string | null;
      providerContext: ProviderContext | null;
      gapIntent: "skipped";
      categoryDecisions: []; // Must be empty array — enforced by Zod
    }
  | {
      sentence: string;
      providerId: string | null;
      providerContext: ProviderContext | null;
      gapIntent: "user-decided";
      categoryDecisions: CategoryDecision[]; // Non-empty, validated
    };
```

### Zod invariants (server-side enforcement)

The route's Zod schema must enforce these invariants on every request. If any fail, the route returns 400 with a validation error.

| Invariant                                                                      | What it prevents                                                     |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| `gapIntent: "all-satisfied"` or `"skipped"` → `categoryDecisions` must be `[]` | Contradictory state: claiming no gaps while sending decisions        |
| `gapIntent: "user-decided"` → `categoryDecisions` must be non-empty            | Empty decisions with active intent — meaningless request             |
| No duplicate `category` values in the array                                    | Same category decided twice with different fills                     |
| Every `category` must be a valid `PromptCategory`                              | Typos, invented categories, injection attempts                       |
| Every `category` must reference a category Call 1 reported as NOT covered      | Sending decisions for categories already satisfied by the human text |

**Same-cycle integrity:** The uncovered category set used for the last invariant must come from the same Call 1 assessment that produced the current assessment state. The client must pass the assessment's uncovered categories alongside the request (or the server must re-derive them from the same text). A stale uncovered set from a previous assessment cycle must never be used for validation.
| Manual `fill` strings: trimmed, min 1 char, max 100 chars, not the literal `"engine"` | Empty strings, whitespace-only, absurdly long text, reserved word collision |

### Why this contract is strict

The v1.0.0 draft used `Record<string, "engine" | string> | null` which had five problems. The v1.1.0 draft fixed most of them with a typed array and `GapIntent` enum, but still allowed contradictory states (e.g., `gapIntent: "all-satisfied"` with non-empty decisions) and unvalidated fill values.

The discriminated union makes contradictions structurally impossible — the TypeScript compiler catches them at build time, and Zod catches them at the route boundary. The invariants table above defines every server-side check.

### How `gapIntent` and `categoryDecisions` affect the system prompt

The system prompt for Call 2 must be updated to understand the composite input:

- **`gapIntent: "all-satisfied"`:** All 12 categories are present in the human text. `categoryDecisions` is empty. The engine generates from human text alone — same as current behaviour.
- **`gapIntent: "skipped"`:** The user acknowledged gaps but chose to ignore them. `categoryDecisions` is empty. The engine generates from human text alone, but knows gaps exist. This distinction matters for future analytics and potential quality hints.
- **`gapIntent: "user-decided"`:** The user made active decisions about missing categories.
  - Entries with `fill: "engine"` — the engine must add expert-level content for these categories. This is where the engine demonstrates prompt engineering knowledge the user doesn't have.
  - Entries with a string `fill` value (user's choice) — the engine must incorporate this term naturally into all 4 tiers. It is treated as an additional constraint from the user, not a suggestion.

### Harmony requirement

The updated Call 2 system prompt must be harmony-tested with the new input format. The existing 30 rules remain; additional rules for `categoryDecisions` handling may be needed. The rule ceiling is 30 (per `harmony-compliance.ts`, test-enforced). Raising requires explicit Martin approval.

**Current system prompt state (v4.5):** The Call 2 system prompt has been through v4.0→v4.5 with 6 iterative versions, stress-tested using three human test scenes (station violinist, Victorian flower seller, sci-fi hangar mechanic) and three independent AI assessors (Claude, ChatGPT, Grok). Key fixes shipped: T1 interaction token scanning + deduplication, T2 `--no` duplication root-cause fix (negative field set to `""`), T3 verb fidelity with WRONG/RIGHT examples, T4 character ceiling raised 250→325, T4 anchor triage hierarchy. Final externally calibrated gains from v4.0 to v4.5: T1 +7, T2 +8, T3 +0 (already strong), T4 +13, overall +7. Martin confirmed v4.5 as production file.

**Calibration finding:** Claude scores T3 approximately 5–6 points too high and T4 approximately 3–5 points too high compared to the ChatGPT/Grok median, under-penalising verb substitutions and anchor drops. Use external assessors for calibration.

**GPT ceilings (permanent):** "reflect" → smear/ripple/shimmer/streak (T3/T4); "burn" → glow (T1/T4, cracked in T3/T4 on v4.5); run-to-run variance of 83–92 on identical inputs is expected.

**Post-processing note:** Call 2 output passes through `postProcessTiers()` (imported from `src/lib/harmony-post-processing.ts`, 272 lines) before reaching the client. The 5 active post-processing functions (`deduplicateMjParams`, `stripTrailingPunctuation`, `fixT4SelfCorrection`, `fixT4MetaOpeners`, `mergeT4ShortSentences`) handle GPT mechanical artefacts. T1 also gets `enforceWeightCap` from `harmony-compliance.ts`. A separate Call 3 post-processing file exists at `src/lib/optimise-prompts/harmony-post-processing.ts` (439 lines, 7 functions). The v4 flow does not change either pipeline — they run on all Call 2/Call 3 responses regardless of gapIntent.

---

## 10. Call 3 — Expanded (v6.0.0)

Call 3 (`POST /api/optimise-prompt`, 406 lines) has been significantly expanded since this doc was first written. It is still unaffected by the 4-phase flow itself (its input comes from Call 2's output), but the architecture is now much richer:

**43 independent builder files** in `src/lib/optimise-prompts/` — each platform has its own system prompt with no shared imports between builders. Routing via `platform-groups.ts` (181 lines) + `resolve-group-prompt.ts` (205 lines), falling back to `generic-fallback.ts` (78 lines).

**Config:** GPT-5.4-mini, temperature 0.4 for prose groups, 0.2 for CLIP groups.

**Post-processing:** `src/lib/optimise-prompts/harmony-post-processing.ts` (439 lines, 7 functions) runs on all Call 3 responses. Compliance gates in `harmony-compliance.ts` (833 lines) enforce deterministic syntax rules (`enforceT1Syntax`, `enforceNegativeContradiction`).

**Server-side charCount:** GPT self-reported counts are unreliable. Route.ts measures `result.charCount = result.optimised.length` after all compliance gates.

**Dynamic Negative Intelligence:** Call 3 returns a `negative` field which is now rendered in the Prompt Lab UI as an amber negative prompt window for platforms with `negativeSupport: 'separate'`.

**proseGroups detection:** Route.ts flips the primary input for prose-based groups (original sentence primary, assembled prompt secondary). Includes legacy group names + all `nl-*` dedicated builders, excluding SD CLIP dedicated builders.

**Performance findings:** CLIP platforms gain ~2pts from Call 3 (85→87, marginal). NL platforms gain ~6-8pts (88→94). Pending decision: test each CLIP platform individually, retain Call 3 where it adds value, bypass where it doesn't.

**Harmony pass status:** Adobe Firefly 93/100, 123RF 91/100 (ChatGPT-verified system prompts). Artbreeder in progress. Remaining platforms need ChatGPT-verified system prompts.

See `prompt-optimizer.md` v6.0.0 §14.9 for full Call 3 architecture documentation.

---

## 11. Disguise & Security

### Naming (unchanged)

| Internal (code)       | User-facing                      | Never say                |
| --------------------- | -------------------------------- | ------------------------ |
| Call 1 assessment     | "Checking your prompt..."        | "Analysing with AI"      |
| Category coverage map | "Prompt Satisfaction" or similar | "AI assessment"          |
| Engine toggle         | "Engine"                         | "AI", "GPT", "automated" |
| Manual toggle         | "Manual"                         | (this is fine as-is)     |
| Side notes            | "Additional details" or similar  | "AI suggestions"         |

### F12 / DevTools hardening

**Already in place (no changes needed):**

- All API calls are server-side (Next.js API routes execute on Vercel, not in browser)
- The `fetch()` to OpenAI happens inside `route.ts` — the browser never sees the URL, headers, or API key
- All client-facing error messages use "engine" not "OpenAI", "AI", or "GPT"
- `console.error` logs are server-side only (Vercel logs, not browser console)
- Response headers are set by Next.js, not by OpenAI

**New for v4:**

- The `categoryDecisions` object is sent to `/api/generate-tier-prompts` (our own API route, not OpenAI's). The browser's Network tab shows a POST to our domain with a JSON body containing the user's text and their category decisions. Nothing in this request or response reveals the backend engine.
- Error messages for the new Call 1 assessment must follow the same neutral language pattern: "engine", "Prompt Intelligence Engine", never "AI" or "GPT".

### What a user sees in F12

| Tab          | What they see                                                                                          |
| ------------ | ------------------------------------------------------------------------------------------------------ |
| **Network**  | POST to `/api/parse-sentence` and `/api/generate-tier-prompts` (Promagen's own API). No external URLs. |
| **Console**  | Nothing (all logging is server-side).                                                                  |
| **Elements** | Standard React DOM. No data attributes or comments referencing AI/OpenAI/GPT.                          |
| **Sources**  | Minified Next.js bundle. No source maps in production.                                                 |

### Content policy rejection handling

The backend engine (GPT-5.4-mini) enforces content policies. If a user submits explicit, violent, or otherwise policy-violating text, the engine will reject the request. This rejection must be caught server-side and translated into a neutral user-facing message that reveals nothing about the backend.

**How the engine signals rejection (two patterns):**

| Pattern             | HTTP status | How to detect                                                       |
| ------------------- | ----------- | ------------------------------------------------------------------- |
| Explicit rejection  | 400         | Response body contains `error.code === "content_policy_violation"`  |
| Filtered completion | 200         | `choices[0].finish_reason === "content_filter"` instead of `"stop"` |

**Both patterns must be caught before the generic error handler.** The detection order in each route is:

1. Check for content policy rejection (400 with `content_policy_violation` OR 200 with `finish_reason: "content_filter"`)
2. Check for rate limit (429)
3. Check for other API errors (non-200)
4. Generic error fallback

**User-facing message (identical across Call 1 and Call 2):**

> "Your description contains content that our engine cannot process. Please revise your description and try again."

**What this message does NOT say:**

- No mention of "policy", "terms", "content filter", "moderation", or "guidelines"
- No mention of "AI", "GPT", "OpenAI", or any backend reference
- No suggestion of what specifically was wrong (the user knows what they wrote)
- No "try again" without "revise" — retrying the same input will produce the same rejection

**Server-side logging:**

```typescript
console.error(
  "[parse-sentence] Content policy rejection for input length:",
  sanitised.length,
);
```

Log the input LENGTH only, never the input content itself. This protects Vercel logs from containing explicit material while still providing enough information to detect abuse patterns.

**Client state transition:** Content policy rejection uses the existing `failed-check` or `failed-generate` states (see §13) with `error.type: "content-policy"`. No separate error state is needed — the error type determines which message is shown. The text box is NOT cleared — the user should see what they wrote so they can revise it.

**Rate limit consideration:** A user repeatedly submitting policy-violating content still consumes rate limit budget. The existing rate limiter (20/hour prod) handles this naturally — after enough rejections, they hit the rate limit regardless.

**Operational maturity note:** This content policy handling is v1-sufficient for launch. It catches the two known rejection patterns, returns neutral messages, and logs safely. The following are acknowledged as deferred improvements for post-launch hardening:

- **Correlation IDs:** A unique request ID linking Call 1 and Call 2 for the same generation cycle, logged server-side for debugging multi-phase failures. Not needed at current scale.
- **Structured logging:** Replacing `console.error` with a structured logger (e.g., Pino) that outputs JSON with severity levels, timestamps, and correlation IDs. Not needed while Vercel's built-in log viewer is sufficient.
- **Abuse detection beyond rate limiting:** Pattern detection for repeated policy violations from the same IP, potential escalation to temporary block. Premature before launch data shows whether this is a real problem.
- **Provider SDK response shape drift:** If OpenAI changes how they signal content policy rejections, the detection logic may miss new patterns. Mitigation: the generic error handler catches anything the specific checks miss, so the user still gets a (less specific) error message. Monitor Vercel logs for unexpected 400/200 patterns after OpenAI API updates.

**Applies to all three routes:**

| Route                                      | Must handle content rejection?                                                        |
| ------------------------------------------ | ------------------------------------------------------------------------------------- |
| `POST /api/parse-sentence` (Call 1)        | Yes — user text goes directly to the engine                                           |
| `POST /api/generate-tier-prompts` (Call 2) | Yes — user text goes directly to the engine                                           |
| `POST /api/optimise-prompt` (Call 3)       | Yes — assembled prompt could contain policy-violating content carried from human text |

---

## 12. Human Factors Alignment

Every phase of the flow maps to a documented human factor:

| Phase                         | Primary factor                 | How it applies                                                                                                                                                                         |
| ----------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Check** (cycling animation) | Anticipatory Dopamine (§3)     | The animation creates expectation. The user watches categories being checked, building anticipation for the result.                                                                    |
| **Assess** (result display)   | Curiosity Gap (§1)             | "9 of 12 covered" opens a gap — which 3 are missing? The user is pulled forward to find out.                                                                                           |
| **Assess** (the pause)        | Peak-End Rule (§10)            | The pause before generation creates a deliberate moment. The engine respects the user's input before acting.                                                                           |
| **Decide** (toggle interface) | Cognitive Load Theory (§11)    | Binary toggles (Engine/Manual) per category. One decision at a time. Sensible defaults reduce load.                                                                                    |
| **Decide** (manual dropdowns) | Curiosity Gap (§1) + education | Dropdown terms teach the user what expert prompt terms look like. The gap between "I didn't know that term" and "now I do" is educational.                                             |
| **Generate** (tier output)    | Temporal Compression (§6)      | The progressive flow (check → assess → decide → generate) makes the generation feel earned, not instant. The output carries more weight because the user participated in its creation. |

### Anti-patterns to avoid

| Anti-pattern                             | Why it kills the effect                                                | How we avoid it                                                                |
| ---------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Auto-generating on all-12-satisfied      | Closes the Curiosity Gap — user never sees the assessment              | Always show assessment, always require user action to proceed                  |
| Showing too much in the assessment       | Closes all gaps at once — no reason to engage with Phase 3             | Assessment shows coverage count + missing category names only, not suggestions |
| Complex Phase 3 UI with multiple buttons | Cognitive overload — Hick's Law (decision time increases with choices) | One toggle per category + two actions (Generate, Skip gaps)                    |
| Slow Phase 1 with no feedback            | Breaks Anticipatory Dopamine — uncertainty without progress signal     | Cycling category animation provides continuous visual feedback                 |

---

## 13. Client State Machine & Race Conditions

### Valid states

The Prompt Lab client has a finite set of valid states. This state machine must be implemented as an explicit reducer or state object — not scattered across multiple `useState` hooks.

| State               | Description                                                                                                              | What the user sees                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `idle`              | No text entered, or text cleared. Starting state.                                                                        | Empty human text box. No assessment, no tiers.                                                  |
| `checking`          | Call 1 is in flight.                                                                                                     | Cycling category animation. Generate button disabled.                                           |
| `assessed-all-good` | Call 1 returned, all 12 categories covered.                                                                              | Assessment box with full coverage. Generate button active.                                      |
| `deciding`          | Call 1 returned with gaps. User is viewing and optionally interacting with Phase 3 (toggling, selecting from dropdowns). | Assessment box with partial coverage. Decision UI visible. Generate and Skip buttons available. |
| `generating`        | Call 2 is in flight.                                                                                                     | Loading state on tier boxes. All buttons disabled.                                              |
| `generated`         | Call 2 returned, tier boxes populated.                                                                                   | 4 tier prompts visible. Provider optimisation available.                                        |
| `failed-check`      | Call 1 failed (timeout, rate limit, error, or content policy rejection).                                                 | Error message with retry.                                                                       |
| `failed-generate`   | Call 2 failed (timeout, rate limit, error, or content policy rejection).                                                 | Error message with retry.                                                                       |

**Note on `assessed-with-gaps` vs `deciding`:** v1.1.0 had these as separate states, but Phase 3 appears automatically when gaps exist, making `assessed-with-gaps` a transient staging state with no user-visible purpose. They are now collapsed into `deciding` — the state where the user sees the assessment AND the decision interface together. If all 12 are covered, the state is `assessed-all-good` (no decision UI needed).

**Note on error states:** Both `failed-check` and `failed-generate` carry error metadata including an `errorType` field: `"network"`, `"rate-limit"`, `"content-policy"`, or `"unknown"`. The error type determines the user-facing message (see §11 for content policy message). No separate policy-specific state is needed — the existing error states handle all failure types via metadata.

### Valid transitions

```
idle → checking                     (user clicks Generate with text present)
checking → assessed-all-good        (Call 1 returns, all 12 covered)
checking → deciding                 (Call 1 returns, gaps found — Phase 3 appears automatically)
checking → failed-check             (Call 1 fails — any error type)
assessed-all-good → generating      (user clicks Generate to proceed)
assessed-all-good → idle            (user edits text — assessment invalidated, must re-check)
deciding → generating               (user clicks Generate with current toggle states)
deciding → generating               (user clicks Skip gaps — gapIntent set to "skipped")
deciding → idle                     (user edits text — assessment and decisions invalidated)
generating → generated              (Call 2 returns)
generating → failed-generate        (Call 2 fails — any error type)
generated → checking                (user edits text and clicks Generate again)
generated → idle                    (user clicks Clear All)
failed-check → checking             (user edits text and retries)
failed-check → idle                 (user clicks Clear All)
failed-generate → deciding          (user retries — returns to last assessed state with decisions intact)
failed-generate → idle              (user clicks Clear All)
any state → idle                    (Clear All always resets to idle)
```

### Text edit behaviour by state

The user can edit the human text box at any time. What happens depends on the current state:

| State when user edits text         | What happens                                                                                                                                                                                                                                                             |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `idle`                             | Nothing — text box is just accepting input.                                                                                                                                                                                                                              |
| `checking`                         | Text is marked as changed. When Call 1 returns, result is discarded if text differs from what was sent. State returns to `idle`.                                                                                                                                         |
| `assessed-all-good`                | Assessment is invalidated immediately. Assessment box disappears. State returns to `idle`. User must click Generate again to re-check.                                                                                                                                   |
| `deciding`                         | Assessment and all current decisions are invalidated. Assessment box and Phase 3 UI disappear. State returns to `idle`. Side notes from previous decisions persist (they are attached to categories, not to the assessment). User must click Generate again to re-check. |
| `generating`                       | Text is marked as changed. Call 2 completes normally. When it returns, a "text changed since generation" indicator appears (similar to drift detection). The generated tiers are shown but flagged as potentially stale.                                                 |
| `generated`                        | No immediate effect. The text is tracked for drift. User clicks Generate to re-check with new text.                                                                                                                                                                      |
| `failed-check` / `failed-generate` | Text edit is allowed. User can revise (especially relevant for content policy rejections) and retry.                                                                                                                                                                     |

### Race condition handling

| Scenario                                                               | Rule                                                                                                                                                                                                                        |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User edits text while `checking`                                       | When Call 1 returns, compare sent text against current text. If different, discard result and return to `idle`. User must click Generate again.                                                                             |
| User clicks Generate twice                                             | Second click is ignored while state is `checking` or `generating`. Generate button is disabled in both states.                                                                                                              |
| User toggles Manual/Engine while `generating`                          | Impossible — Phase 3 UI is hidden during `generating` state. All buttons disabled.                                                                                                                                          |
| User changes provider between `assessed-*`/`deciding` and `generating` | Provider change does NOT trigger re-assessment (Call 1 assesses content, not provider). Provider context is captured at the moment Generate is clicked and passed to Call 2.                                                |
| User changes provider during `generating`                              | Ignored. Call 2 completes with the provider selected when it fired. User can switch provider after generation and re-fire if needed.                                                                                        |
| User changes provider after `generated` but before Call 3              | No issue — Call 3 is a separate action. Provider context is captured when the user clicks Optimise.                                                                                                                         |
| Call 1 returns after user has clicked Clear All                        | State is `idle` — discard the response.                                                                                                                                                                                     |
| Call 2 returns after user has clicked Clear All                        | State is `idle` — discard the response.                                                                                                                                                                                     |
| Retry after `failed-generate`                                          | State returns to `deciding` (not `generating`). The user's previous assessment and decisions are preserved. They can modify decisions before clicking Generate again, or click immediately to re-fire with the same inputs. |

### Reducer state shape

```typescript
interface PromptLabState {
  phase:
    | "idle"
    | "checking"
    | "assessed-all-good"
    | "deciding"
    | "generating"
    | "generated"
    | "failed-check"
    | "failed-generate";
  /** The text that was sent to Call 1 (for stale-check on return) */
  sentText: string | null;
  /** Call 1 result — null until checking completes */
  assessment: CoverageAssessment | null;
  /** User's category decisions — persists across retry */
  decisions: CategoryDecision[];
  /** Side notes created from manual decisions — persists across re-assessment */
  sideNotes: SideNote[];
  /** Call 2 result — null until generation completes */
  tierPrompts: GeneratedTierPrompts | null;
  /** Error metadata when in failed-* states */
  error: {
    type: "network" | "rate-limit" | "content-policy" | "unknown";
    message: string;
  } | null;
}
```

---

## 14. Open Design Questions

These are solved during prototyping and build, not before. Each will be assessed, built, and refined iteratively.

| #    | Question                                                                                                         | Options to explore                                                                                                                                                           | When resolved                                      |
| ---- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| OD-1 | What does the assessment box look like?                                                                          | Category pills (green/gap), progress bar, compact text summary, or hybrid                                                                                                    | During Phase 2 UI build                            |
| OD-2 | How does the Engine/Manual toggle feel on desktop?                                                               | Toggle switch, segmented control, radio-style buttons, or click-to-flip pill                                                                                                 | During Phase 3 UI build                            |
| OD-3 | How does the Manual dropdown expand?                                                                             | Slide-down with easing, fade-in, inline expansion                                                                                                                            | During Phase 3 UI build                            |
| OD-4 | What does "Skip gaps" look like vs Generate?                                                                     | Subtle text link, ghost button, or secondary button                                                                                                                          | During Phase 3 UI build                            |
| OD-5 | How do side note pills look alongside the human text box?                                                        | Colour-coded by category, monochrome with label, or icon + text                                                                                                              | During side notes UI build                         |
| OD-6 | What happens visually on re-generation with existing side notes?                                                 | Pulse existing pills, fade-and-rebuild, or keep static                                                                                                                       | During regeneration testing                        |
| OD-7 | **BEHAVIOURAL:** 3-word input with 2 categories covered — does Skip warn the user about low coverage?            | Warning tooltip, subtle hint, or no warning (trust the user). This affects completion rate and perceived usefulness — not cosmetic.                                          | During edge case testing — resolve BEFORE shipping |
| OD-8 | **BEHAVIOURAL:** 1,000 chars covering only 4 categories — how does assessment communicate that length ≠ quality? | Same as any partial coverage (no special treatment) vs length-aware hint ("Your description is detailed but focused on 4 areas"). This affects user trust in the assessment. | During edge case testing — resolve BEFORE shipping |

---

## 15. Tests — Delete & Rebuild

### Tests to DELETE now

These tests are written against the old flow (parallel Call 1 + Call 2, dropdown population, term extraction). They will be invalid under the new architecture and must not block the build.

| File                                                          | Lines | What it tests (now invalid)                                    |
| ------------------------------------------------------------- | ----- | -------------------------------------------------------------- |
| `src/app/api/parse-sentence/__tests__/parse-sentence.test.ts` | 275   | Call 1 term extraction + Zod schema for category arrays        |
| `src/hooks/__tests__/use-sentence-conversion.test.ts`         | 107   | Term matching (exact → fuzzy → custom) for dropdown population |
| `src/lib/__tests__/harmony-compliance.test.ts`                | 415   | Post-processing compliance gates for current Call 2 output     |

**Total: 797 lines across 3 files.**

**Note:** The `harmony-compliance.test.ts` tests the compliance _functions_ (`enforceT1Syntax`, `enforceMjParameters`), which may still be valid for Call 2's output. However, the test fixtures use the old input format. Delete now, rebuild with new fixtures once Call 2's updated output is stable.

**Why delete, not quarantine:** The alternative (renaming to `.test.ts.bak` or adding `xfail` markers) was considered during harmony review. The decision is delete for three reasons: (1) these tests will fail on the first build step (Call 1's response schema changes from category arrays to a coverage map), creating CI noise that must be triaged every run; (2) quarantined tests create a false sense of safety — they don't run, so they don't protect anything, but their presence implies coverage exists; (3) the rebuild tests (see table below) are scoped in this doc with explicit "when" triggers, so nothing falls through the cracks. The guardrail during the build period is the harmony testing methodology (dual assessment on every system prompt change), not legacy unit tests written against a different architecture.

### PowerShell delete command (run from `frontend` directory)

```powershell
Remove-Item -Path "src\app\api\parse-sentence\__tests__\parse-sentence.test.ts", "src\hooks\__tests__\use-sentence-conversion.test.ts", "src\lib\__tests__\harmony-compliance.test.ts" -Force
```

### Tests to REBUILD after core flow is working

| Test scope                    | What to test                                                                                                              | When                                         |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Call 1 route (new assessment) | Category coverage assessment, edge cases (short input, long input, implied categories), Zod schema validation             | After Call 1 system prompt is harmony-tested |
| Call 2 route (updated input)  | Discriminated union validation, `categoryDecisions` handling, engine-fill vs user-chosen terms, Zod invariant enforcement | After Call 2 system prompt is harmony-tested |
| Assessment UI component       | Renders correct coverage count, shows missing categories, handles all-satisfied state                                     | After Phase 2 UI is built                    |
| Decision UI component         | Toggle state management, Manual dropdown expansion, side note creation                                                    | After Phase 3 UI is built                    |
| Side notes                    | Creation, persistence, cascade clear, regeneration behaviour                                                              | After side notes architecture is built       |
| Harmony compliance (updated)  | Existing compliance functions with new Call 2 output fixtures                                                             | After Call 2 output is stable                |
| Full flow integration         | Human text → Check → Assess → Decide → Generate end-to-end                                                                | After all phases are working                 |

---

## 16. Build Order

### Part 1 — Call 1 Rewrite (Assessment Engine)

1. Rewrite `parse-sentence/route.ts` — new system prompt for category assessment (not term extraction)
2. New Zod response schema for coverage map output
3. Harmony test Call 1: iterative rounds with dual Claude/ChatGPT assessment
4. Update `use-sentence-conversion.ts` hook to handle new response format (or replace with new hook)

### Part 2 — Assessment UI (Phase 2)

5. New component: assessment box (sits beneath human text box)
6. Visual design resolution for OD-1 (category coverage display)
7. Wire to Call 1 output
8. Generate button in assessment box (proceeds to Phase 4 on all-satisfied, or shows Phase 3 on gaps)

### Part 3 — Decision UI (Phase 3)

9. Missing category list with Engine/Manual toggles
10. Manual dropdown expansion with vocabulary from `prompt-options.json`
11. Side note pill creation when user selects a Manual dropdown term
12. "Skip gaps" secondary action
13. Generate button wiring

### Part 4 — Side Notes

14. Side note data model and state management
15. Side note pills UI alongside human text box
16. Regeneration behaviour (Call 1 re-assesses raw text, side notes persist)
17. Cascade clear integration

### Part 5 — Call 2 Update

18. Update `generate-tier-prompts/route.ts` — add `categoryDecisions` to request schema
19. Update system prompt to handle engine-fill vs user-chosen terms
20. Harmony test Call 2: iterative rounds with new input format
21. Update `use-tier-generation.ts` hook to send `categoryDecisions`

### Part 6 — Integration & Polish

22. Wire all phases together in `playground-workspace.tsx`
23. Update `enhanced-educational-preview.tsx` for new flow
24. Update `describe-your-image.tsx` for side notes display
25. Resolve remaining open design questions (OD-2 through OD-8)
26. Edge case testing and refinement

### Part 7 — Tests (Rebuild)

27. All tests listed in §15 "Tests to REBUILD"
28. Regression suite with real fixture data from harmony rounds

---

## 17. Files Affected

### Modified (existing files)

| File                                                      | Current lines | Change                                                                                     |
| --------------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------ |
| `src/app/api/parse-sentence/route.ts`                     | **455**       | System prompt rewrite, response schema change                                              |
| `src/app/api/generate-tier-prompts/route.ts`              | **650**       | Request schema update (gapIntent/categoryDecisions already deployed), v4.5 system prompt   |
| `src/lib/harmony-post-processing.ts`                      | **272**       | **No change expected** — Call 2 post-processing (5 functions) is independent of v4 flow    |
| `src/lib/optimise-prompts/harmony-post-processing.ts`     | **439**       | **No change expected** — Call 3 post-processing (7 functions) is independent of v4 flow    |
| `src/lib/harmony-compliance.ts`                           | **833**       | **No change expected** — compliance gates are independent of v4 flow                       |
| `src/hooks/use-sentence-conversion.ts`                    | 260           | Rewrite or replace for new Call 1 response format                                          |
| `src/hooks/use-tier-generation.ts`                        | **239**       | Add `categoryDecisions` to generate call                                                   |
| `src/components/providers/describe-your-image.tsx`        | **1,153**     | Side note pills, assessment box integration                                                |
| `src/components/prompts/playground-workspace.tsx`         | **369**       | Orchestrate 4-phase flow, side note state (currently stripped — "Stripped v4 decision UI") |
| `src/components/prompts/enhanced-educational-preview.tsx` | **1,913**     | Wire new flow when no provider selected                                                    |

### New files

| File                                              | Purpose                                             |
| ------------------------------------------------- | --------------------------------------------------- |
| `src/components/prompt-lab/assessment-box.tsx`    | Phase 2 — category coverage display                 |
| `src/components/prompt-lab/category-decision.tsx` | Phase 3 — Engine/Manual toggle per missing category |
| `src/components/prompt-lab/side-note-pills.tsx`   | Side note pill display alongside human text         |

### Deleted (tests — rebuild later)

| File                                                          | Lines | Notes                        |
| ------------------------------------------------------------- | ----- | ---------------------------- |
| `src/app/api/parse-sentence/__tests__/parse-sentence.test.ts` | 275   | Rebuild after Call 1 rewrite |
| `src/hooks/__tests__/use-sentence-conversion.test.ts`         | 107   | Rebuild after hook rewrite   |

> **⚠️ Harmony test files** (`harmony-compliance.test.ts`, `harmony-post-processing.test.ts`) were documented at 453+601 lines (115-test lockdown suite). These are NOT present in the current src.zip — they may have been excluded from the zip or relocated. If they exist in the repo, they are part of the harmony lockdown suite and must NOT be deleted. They test post-processing functions that are independent of the v4 client-side flow.

---

## 18. Non-Regression Rules

### Flow rules

1. **Call 2 NEVER fires during Phase 1** — no parallel firing. The four-phase flow is sequential.
2. **The assessment ALWAYS shows, even on all-12-satisfied** — the engine must acknowledge the user's input before generating.
3. **The user ALWAYS clicks to proceed** — no auto-generation, no silent skipping.
4. **Side notes NEVER modify the human text** — they are supplementary metadata, not edits.
5. **Call 1 only assesses raw human text** — side notes are not included in the assessment input.
6. **"Skip gaps" fires Call 2 with `gapIntent: "skipped"` and empty `categoryDecisions`** — the engine generates from human text alone, but the intent is recorded distinctly from "all-satisfied". Open question OD-7 applies.

### Disguise rules (carried from ai-disguise.md)

7. **No user-facing string may contain "AI", "GPT", "OpenAI", or "LLM"** — use "engine", "Prompt Intelligence Engine", "algorithms".
8. **All API calls are server-side** — browser Network tab shows only Promagen API routes.
9. **All error messages use neutral language** — "engine", not "AI service".
10. **Console output is server-side only** — nothing in browser F12 console.
11. **Content policy rejections return neutral message** — "Your description contains content that our engine cannot process." Never mention policy, filter, moderation, terms, or backend names. Log input length only, never content. Applies to all 3 routes.

### Code standard rules (carried from code-standard.md)

12. **All sizing via `clamp()`** — no fixed px/rem. Per `code-standard.md` §6.0.
13. **No grey text** — no `text-slate-400`, `text-slate-500`, `text-slate-600`, `text-white/30`, `text-white/40`. Bright colours only.
14. **`cursor-pointer` on all interactive elements** — toggles, buttons, dropdowns, pills.
15. **Animations co-located in `<style dangerouslySetInnerHTML>`** — not in `globals.css`.
16. **Minimum font size 10px** — `clamp(10px, ...)` for all sub-12px text.
17. **No `hover:scale` transforms** causing layout reflow.
18. **No question mark icons** on tooltips.

### Harmony rules (carried from harmonizing-claude-openai.md v2.0.0)

19. **Three-assessor methodology mandatory** — no system prompt ships without testing through Claude, ChatGPT, and Grok. Claude scores T3 ~5-6pts and T4 ~3-5pts too high vs ChatGPT/Grok median — use external assessors for calibration.
20. **Concrete examples in every system prompt** — no rule without a WRONG/RIGHT pair.
21. **Call 2 post-processing cannot be removed** — all 5 functions (`deduplicateMjParams`, `stripTrailingPunctuation`, `fixT4SelfCorrection`, `fixT4MetaOpeners`, `mergeT4ShortSentences`) + `enforceWeightCap` in `src/lib/harmony-post-processing.ts` (272 lines) are permanent safety nets. The v4 flow does not change this pipeline.
22. **Call 3 post-processing cannot be removed** — 7 functions in `src/lib/optimise-prompts/harmony-post-processing.ts` (439 lines) + compliance gates in `harmony-compliance.ts` (833 lines) are permanent. The v4 flow does not change this pipeline.
23. **Martin approves all changes before implementation** — ideas proposed, not built.
24. **Post-processing extraction is permanent** — Call 2 functions live in `src/lib/harmony-post-processing.ts`, Call 3 functions live in `src/lib/optimise-prompts/harmony-post-processing.ts`. Do not move them back into route files.
25. **No Call 3 builder may import from another builder** — complete isolation prevents cross-platform regressions.
26. **Rule ceiling is 30** — raising requires explicit approval. Tracked in `harmony-compliance.ts` with test assertion (`RULE_CEILING = 30`, `CURRENT_RULE_COUNT = 30`).
27. **Server-side `charCount` measurement is mandatory** — never trust GPT self-reported counts. `result.charCount = result.optimised.length` after all compliance gates.
28. **`effectiveWasOptimized` must compare text content** (`optimised !== activeTierPromptText`), NOT length — length comparison hides enriched prompts.

---

## 19. Decisions Log

| ID  | Decision                                                                                                                                                        | Rationale                                                                                                                                                                                                                                 | Date        |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| D1  | Replace parallel Call 1 + Call 2 with sequential 4-phase flow                                                                                                   | Current parallel fire produces a wall of output with no user agency. Sequential flow respects user intent and strengthens the Disguise.                                                                                                   | 24 Mar 2026 |
| D2  | Call 1 changes to category assessment (coverage map) instead of term extraction                                                                                 | Assessment is simpler and more useful than extraction. The engine needs to know what's covered, not extract specific terms.                                                                                                               | 24 Mar 2026 |
| D3  | Unified toggle interface instead of 4 separate option buttons                                                                                                   | Hick's Law — binary toggle per category reduces cognitive load vs 4 competing buttons. All 4 user paths still accessible through the same interface.                                                                                      | 24 Mar 2026 |
| D4  | Assessment always shows, even on all-12-satisfied                                                                                                               | The pause between assessment and generation communicates respect for the user's input. Skipping it would feel like the engine doesn't care about the quality of the input.                                                                | 24 Mar 2026 |
| D5  | Side notes as metadata, not text edits                                                                                                                          | User's creative text is sacred (prompt-intelligence.md principle 1). Side notes are supplementary, not modifications.                                                                                                                     | 24 Mar 2026 |
| D6  | Call 1 only assesses raw human text, not human text + side notes                                                                                                | The assessment reflects the user's own writing. Side notes are their decisions about gaps, not part of the creative input being assessed.                                                                                                 | 24 Mar 2026 |
| D7  | Delete all 3 test files (797 lines) and rebuild after core flow is stable                                                                                       | Tests are written against old architecture. Maintaining them during the rewrite would slow the build and require constant updates to fixtures that are changing.                                                                          | 24 Mar 2026 |
| D8  | Open design questions (OD-1 through OD-8) solved during build, not before                                                                                       | Visual design is best resolved by prototyping, not by specification. The architecture is defined; the visuals emerge from building.                                                                                                       | 24 Mar 2026 |
| D9  | Replace `Record<string, "engine" \| string> \| null` with typed `CategoryDecision[]` + `PromptCategory` union + Zod validation                                  | Harmony review identified 5 problems with the loose contract: invalid keys, ambiguous null, no type distinction for manual values, unsafe assumptions about coverage, and lost intent.                                                    | 24 Mar 2026 |
| D10 | Split `null` into explicit `GapIntent` enum: `"all-satisfied"`, `"user-decided"`, `"skipped"`                                                                   | "All 12 satisfied" and "user skipped gaps" are different intents. Collapsing them loses information needed for analytics, debugging, and future quality hints.                                                                            | 24 Mar 2026 |
| D11 | Side notes auto-clear when re-assessment shows category covered with `confidence: "high"` only                                                                  | Prevents invisible stale state constraining Call 2. Medium-confidence coverage preserves the user's manual choice — refined in D20 after harmony review identified over-aggressive deletion risk.                                         | 24 Mar 2026 |
| D12 | Explicit client state machine with finite states and valid transitions                                                                                          | The flow has 9+ states and multiple transition paths. Scattered `useState` hooks will create bugs. A formal reducer or state object prevents invalid states.                                                                              | 24 Mar 2026 |
| D13 | Race condition rules: stale Call 1 results discarded, buttons disabled during in-flight calls, Clear All cancels everything                                     | 7 race conditions identified: text edit during check, double-click, toggle during generate, provider change between phases, and 2 clear-during-flight scenarios. All handled by state machine transitions.                                | 24 Mar 2026 |
| D14 | OD-7 and OD-8 upgraded from visual to behavioural priority                                                                                                      | These affect completion rate and user trust, not just appearance. Must be resolved before shipping, not treated as optional polish.                                                                                                       | 24 Mar 2026 |
| D15 | Confidence field maps to visual treatment: high/covered = strong positive, medium/covered = softer positive ("could be stronger"), high/not-covered = clear gap | Addresses concern that binary coverage is too coarse. Confidence provides nuance without adding complexity to the flow logic — Phase 3 still uses covered/not-covered as the binary gate.                                                 | 24 Mar 2026 |
| D16 | Content policy rejections caught server-side, returned as neutral "engine cannot process" message                                                               | Backend engine enforces content policies on explicit/violent input. Rejection must not leak policy language, filter names, or backend references. Log input length only, never content. Applies to all 3 routes.                          | 24 Mar 2026 |
| D17 | `GenerateTierRequest` is a discriminated union, not a flat interface                                                                                            | Flat interface allowed contradictions (e.g., `gapIntent: "all-satisfied"` with non-empty decisions). Discriminated union makes invalid states structurally impossible — caught by TypeScript at build time and Zod at the route boundary. | 24 Mar 2026 |
| D18 | Manual `fill` values validated: trimmed, min 1 char, max 100 chars, not the reserved word "engine"                                                              | Loose `string` type allowed empty strings, whitespace, absurdly long text, and reserved word collisions. Zod invariants enforce cleanliness at the route boundary.                                                                        | 24 Mar 2026 |
| D19 | No duplicate categories in `categoryDecisions` array; decisions only for categories Call 1 reported as not covered                                              | Prevents same category decided twice with different fills, and prevents sending decisions for already-satisfied categories. Server rejects with 400.                                                                                      | 24 Mar 2026 |
| D20 | Side note auto-clear only fires on `confidence: "high"` — medium-confidence coverage preserves user's manual side note                                          | A vague implication ("sunset" → lighting medium) should not delete a deliberate expert term ("hard rim-lit side light"). User intent is stronger than vague coverage. User can remove the side note manually if they choose.              | 24 Mar 2026 |
| D21 | `assessed-with-gaps` and `deciding` collapsed into single `deciding` state                                                                                      | Phase 3 appears automatically when gaps exist, making `assessed-with-gaps` a transient staging state with no user-visible purpose. One state is cleaner.                                                                                  | 24 Mar 2026 |
| D22 | Content policy errors use existing `failed-check`/`failed-generate` states with `error.type: "content-policy"` metadata — no separate state                     | Adding a separate state increases state machine complexity for no UX benefit. The error type determines the message shown. Operational improvements (correlation IDs, structured logging, abuse detection) deferred to post-launch.       | 24 Mar 2026 |

---

## 20. Phase 2 Parking Lot (Post-Core)

These items are explicitly parked for after the core Check → Assess → Decide → Generate flow is working. They are not forgotten — they are deferred.

| Item                            | Description                                                                                                                                                                                                                                                                                                                                      | Source                                  |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------- |
| **Education loop**              | After generation, show what the engine chose for each engine-filled category. Small preview per category so the user learns what good terms look like.                                                                                                                                                                                           | Conversation 24 Mar 2026                |
| **Learning pipeline**           | Passive data collection from Prompt Lab generations for future system prompt improvement.                                                                                                                                                                                                                                                        | ai-disguise.md §15, Build Order Part 5  |
| **Per-platform system prompts** | ~~Move from generic system prompt to per-platform templates (18 templates: 7 group + 11 dedicated).~~ **DONE (v6.0.0):** 43 independent builder files in `src/lib/optimise-prompts/group-*.ts` with no shared imports. Harmony pass in progress — Adobe Firefly 93/100, 123RF 91/100 (ChatGPT-verified). See `prompt-optimizer.md` v6.0.0 §14.9. | Conversation 24 Mar 2026 (last 3 chats) |
| **Batch conversion**            | User uploads multiple sentences, each parsed as separate prompt.                                                                                                                                                                                                                                                                                 | human-sentence-conversion.md §16.1      |
| **Conversation mode**           | Back-and-forth: "Make it more dramatic" → engine adjusts.                                                                                                                                                                                                                                                                                        | human-sentence-conversion.md §16.2      |

---

## Changelog

- **29 Mar 2026 (v2.0.0):** **CALL 2 v4.5 + CALL 3 ARCHITECTURE + THREE-ASSESSOR METHODOLOGY.** Status updated: backend at v4.5 (production-confirmed), Call 3 at 43 independent builders, client-side 4-phase UI still not built. Cross-references updated: prompt-lab.md v3.1.0→v4.0.0, added prompt-optimizer.md v6.0.0, added platform-config.json SSOT, updated best-working-practice principles. §6 Phase 4: post-processing reference corrected — 5 active functions in 272 lines + compliance gates in 833 lines (was "7 functions P1–P12 in 342 lines"). §9 Harmony requirement: Added Call 2 v4.5 system prompt status documenting 6 iterative versions (v4.0→v4.5), three human test scenes (station violinist, Victorian flower seller, sci-fi hangar mechanic), three independent AI assessors (Claude, ChatGPT, Grok), externally calibrated gains (T1 +7, T2 +8, T3 +0, T4 +13, overall +7). Added calibration finding (Claude +5-6pts T3, +3-5pts T4 vs ChatGPT/Grok median). Added GPT ceilings (reflect→smear, burn→glow, 83-92 variance). Post-processing corrected to 5 functions/272 lines. Added Call 3 post-processing file (439 lines, 7 functions). §10 Call 3: Rewritten from "unchanged" to full section — 43 independent builder files, 406-line route, proseGroups detection, server-side charCount, negative prompt rendering, compliance gates (833 lines), harmony pass status (Firefly 93, 123RF 91), performance findings (CLIP ~2pt vs NL ~6-8pt). §17 Files Affected: All line counts updated to src.zip ground truth — generate-tier-prompts 523→650, harmony-post-processing 342→272, use-tier-generation 224→239, DescribeYourImage 712→1,153, PlaygroundWorkspace 313→369, EEP 2,014→1,913, parse-sentence corrected to 455. Added Call 3 post-processing (439 lines) and harmony-compliance (833 lines) to modified files. Harmony test file warning updated — files noted as not in current src.zip. §18 Non-Regression Rules: Harmony section rewritten — dual→three-assessor with calibration note (rule 19), post-processing split into Call 2 5 functions (rule 21) and Call 3 7 functions + compliance (rule 22), builder isolation (rule 25), server-side charCount mandatory (rule 27), effectiveWasOptimized text comparison (rule 28). Rule count 25→28. §20 Parking Lot: per-platform system prompts marked DONE (43 builders, harmony pass in progress).

- **25 Mar 2026 (v1.3.0):** **HARMONY INFRASTRUCTURE SYNC.** Cross-references updated: ai-disguise.md v3.0.0→v4.0.0, harmonizing-claude-openai.md v1.0.0→v2.0.0. Status clarified: backend contract (gapIntent/categoryDecisions) deployed, client-side 4-phase UI not yet built. §6 Phase 4: added post-processing pipeline step (postProcessTiers runs P1–P12 server-side before client delivery). §9 Harmony requirement: rule count 18→30, rule ceiling 27→30, added post-processing pipeline note and 115-test lockdown requirement. §17 Files Affected: route.ts line count 588→523 (refactored — post-processing extracted), added harmony-post-processing.ts (342 lines) to modified files, removed harmony-compliance.test.ts from delete list (part of 115-test lockdown suite — DO NOT DELETE), added warning about protecting test files. §18 Non-Regression Rules: harmony rules expanded from 4 to 7 — added extraction permanent, 115-test lockdown, rule ceiling 30. Non-regression rule count: 22→25.

- **24 Mar 2026 (v1.2.1):** **POST-HARMONY CLEANUP — BUILD APPROVED.** 3 cleanup items from final ChatGPT 89/100 review. (1) §15: Fixed stale "backward compatibility with null decisions" wording in rebuild tests table — replaced with discriminated union validation. (2) §19: Updated D11 wording to reflect high-confidence-only auto-clear rule (aligned with D20). (3) §9: Added same-cycle integrity note to Zod invariants — uncovered category set must come from the same Call 1 assessment cycle, never a stale snapshot. Status changed from AGREED to APPROVED — ready to build. Dual-assessor harmony complete: Claude 85/100, ChatGPT 89/100.

- **24 Mar 2026 (v1.2.0):** **SECOND HARMONY PASS — CONTRACT + STATE MACHINE + SAFETY.** 6 precision fixes from second dual-assessor review. (1) §9: `GenerateTierRequest` rewritten as discriminated union — `gapIntent` value now determines the shape, making contradictions structurally impossible at both TypeScript compile time and Zod runtime validation. (2) §9: Added Zod invariants table with 6 server-side enforcement rules: no duplicate categories, validated fill strings (trimmed, min 1, max 100, not reserved "engine"), decisions only for categories Call 1 reported as uncovered. (3) §7: Side note auto-clear now only fires on `confidence: "high"`. Medium-confidence coverage preserves user's manual side note — deliberate expert terms are stronger than vague implications. Contradiction handling table updated with new "sunset vs hard rim-lit" scenario. (4) §13: State machine rewritten. Collapsed `assessed-with-gaps` and `deciding` into single `deciding` state. Added text-edit-by-state table defining behaviour for edits in every state. Fixed `failed-generate` retry transition (now returns to `deciding`, not directly to `generating`). Added provider-change-after-generated-before-Call-3 race condition. Added `PromptLabState` reducer interface with error metadata typed as `'network' | 'rate-limit' | 'content-policy' | 'unknown'`. Removed policy-specific sub-state — existing error states handle all failure types via metadata. (5) §11: Removed "new error sub-state" wording. Added "v1-sufficient" framing with explicit deferred list: correlation IDs, structured logging, abuse detection, SDK response shape drift. (6) §15: Strengthened test deletion rationale with three-point justification over quarantine approach. Decisions log expanded from D16 to D22. Non-regression rules unchanged at 22.

- **24 Mar 2026 (v1.1.0):** **HARMONY REVIEW FIXES + CONTENT POLICY HANDLING.** 8 changes from dual Claude/ChatGPT architecture review plus content policy gap analysis. (1) Replaced loose `Record<string, "engine" | string> | null` contract with typed `CategoryDecision[]` array using `PromptCategory` union type and Zod-validated keys — fixes 5 identified contract problems. (2) Split ambiguous `null` into explicit `GapIntent` enum with 3 values: `"all-satisfied"`, `"user-decided"`, `"skipped"` — distinct intent preserved for analytics and debugging. (3) Side notes now auto-clear when re-assessment shows category covered — prevents invisible stale state constraining Call 2. Added Contradiction handling subsection to §7. (4) Added §13 Client State Machine with 9 valid states, transition diagram, and formal reducer requirement. (5) Added 7 race condition rules covering text-edit-during-check, double-click, toggle-during-generate, provider-change-between-phases, and clear-during-flight scenarios. (6) Upgraded OD-7 and OD-8 from visual to behavioural priority with "resolve BEFORE shipping" requirement. (7) Added confidence → visual treatment mapping table to §8 showing how high/medium confidence maps to strong/softer positive indicators. (8) Added content policy rejection handling to §11 — server-side detection of both 400 `content_policy_violation` and 200 `finish_reason: "content_filter"` patterns, neutral user-facing message, input-length-only logging, applies to all 3 routes. Decisions log expanded from D8 to D16. Non-regression rules expanded from 21 to 22. Section count increased from 19 to 20.

- **24 Mar 2026 (v1.0.0):** Initial document. Defines the Check → Assess → Decide → Generate four-phase flow for the Prompt Lab. Replaces parallel Call 1 + Call 2 firing with sequential user-controlled progression. Call 1 role changes from term extraction to category assessment. Call 2 input extended with `categoryDecisions` object. Side notes architecture for user-chosen gap-fill terms. Unified toggle interface (Engine/Manual per missing category) replaces 4 separate option buttons. 8 open design questions documented for resolution during build. 3 test files (797 lines) marked for deletion. 7-part build order. 21 non-regression rules. Phase 2 parking lot with 5 deferred items.

---

_This document is the authority for the Prompt Lab v4 flow. Backend contract (Call 2 gapIntent/categoryDecisions) is deployed. Call 2 system prompt at v4.5 (production-confirmed). Call 3 expanded to 43 independent builders (see `prompt-optimizer.md` v6.0.0). Client-side 4-phase UI is approved and ready to build._

_**Key principle:** The engine cares about the user's intent. Check → Assess → Decide → Generate is a conversation, not a function call._

---

## Changelog (Merged)

| Date | Change |
|------|--------|
| 9 Apr 2026 | v5.0.0: Merged Studio section + v4 flow into single prompt-lab.md. |
| 29 Mar 2026 | prompt-lab.md v4.0.0, prompt-lab-v4-flow.md v2.0.0 |

_This document is the authority for the Prompt Lab. `src.zip` is the SSoT._
