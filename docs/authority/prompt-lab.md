# Studio Section Authority Document

**Last updated:** 25 March 2026  
**Version:** 3.2.0  
**Owner:** Promagen  
**Authority:** This document defines the architecture, routes, and component behaviour for the Studio section (`/studio/*`).  
**Cross-reference:** For AI Disguise full specification (including v4.0.0 system prompt, P1–P12 post-processing pipeline, and harmony engineering), see `ai-disguise.md` v4.0.0. For harmony engineering methodology, see `harmonizing-claude-openai.md` v2.0.0. For the v4 four-phase flow (Check→Assess→Decide→Generate), see `prompt-lab-v4-flow.md` v1.3.0. For human sentence conversion UI and term matching, see `human-sentence-conversion.md`. For colour-coded prompt anatomy, see `paid_tier.md` §5.14. For Prompt Lab parity features, see `paid_tier.md` §5.13. For standard builder architecture, see `prompt-builder-page.md`. For optimizer details, see `prompt-optimizer.md`. For human factors, see `human-factors.md`. For button styling standards, see `buttons.md`.

---

## Purpose

The Studio section (`/studio/*`) contains Promagen's creative tool pages. It is **not** a hub page — the `/studio` route itself redirects to the homepage. The two active child routes are:

| Route                | Name       | Purpose                                       | Status |
| -------------------- | ---------- | --------------------------------------------- | ------ |
| `/studio/playground` | Prompt Lab | AI-powered prompt creation (all 42 platforms) | Active |
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

The Prompt Lab is Promagen's AI-powered prompt creation environment. Unlike `/providers/[id]` (where the provider is pre-selected from the URL), the Prompt Lab lets users select any of the 42 platforms from a dropdown and see their prompt reshape in real time.

**v3.0.0 (23 March 2026):** The Prompt Lab now features the AI Disguise system — three targeted API calls to GPT-5.4-mini that generate and optimise prompts directly from human text, disguised as "1,001 proprietary algorithms". See `ai-disguise.md` for full specification.

**Auth gate:** Pro Promagen exclusive — NOT YET GATED (see `paid_tier.md` §5.13). Currently accessible to all users.

**Pro page integration:** Listed as card 6 (🧪 Prompt Lab) in the Feature Control Panel on `/pro-promagen`. Free users see "Pro exclusive" / "Pro only". Paid users see "Full access" / "Open lab →".

---

### AI Disguise Architecture (v3.0.0)

The Prompt Lab uses three API calls to GPT-5.4-mini, presented to the user as algorithmic processing:

| Call                  | Route                             | Purpose                                                                                                    | When fired              | Visual                                      |
| --------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------- | ------------------------------------------- |
| **Call 1** (existing) | `POST /api/parse-sentence`        | Extract human text → 12 category JSON                                                                      | "Generate Prompt" click | 12 category badges cycle in (150ms stagger) |
| **Call 2** (v3.0.0)   | `POST /api/generate-tier-prompts` | Generate 4 tier prompts directly from human text (30-rule system prompt + P1–P12 post-processing pipeline) | In parallel with Call 1 | Tier cards populate with AI text            |
| **Call 3** (new)      | `POST /api/optimise-prompt`       | Optimise assembled prompt for specific provider                                                            | "Optimise" toggle ON    | Algorithm cycling animation (101 names)     |

**Cost:** ~$0.008 per full generate + optimise cycle (GPT-5.4-mini).

**Disguise principle:** The user never sees "AI" or "GPT" in any UI text. The system presents as "Prompt Intelligence Engine" with "101 algorithms". See `ai-disguise.md` §1.

**Harmony engineering (v4.0.0):** Call 2's system prompt was refined through 6+ rounds of iterative testing + 3 stress tests (900-char complex inputs) between Claude (prompt author) and GPT-5.4-mini (executor), scoring 62→96/100 with dual-assessor convergence (≤1 point gap). A post-processing pipeline (7 functions in `harmony-post-processing.ts`, 342 lines) catches GPT mechanical artefacts server-side. A 115-test lockdown suite prevents drift. See `ai-disguise.md` v4.0.0 §6–§8 for full specification, `harmonizing-claude-openai.md` v2.0.0 for the methodology.

#### Data Flow

```
User types human description → clicks "Generate Prompt"
  │
  ├─ Call 1 fires → 12 category badges cycle in → dropdowns populate → DNA score updates
  │
  └─ Call 2 fires (parallel) → 4 tier cards fill with AI prompts
     └─ If provider selected: "Generated for Leonardo AI" badge
     └─ AI text flows into assembled prompt box via activeTierPromptText

User clicks "Optimise" toggle
  │
  └─ Call 3 fires → algorithm cycling animation plays (160ms→deceleration→landing)
     └─ "✓ 97 algorithms applied" → optimised prompt fades in

User switches provider (Leonardo → Midjourney)
  │
  └─ Call 2 auto-re-fires with new provider context
     └─ Tier cards update with Midjourney-tailored AI prompts

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

**v3.0.0→v4.0.0 additions (see `ai-disguise.md` v4.0.0 §6 for full 30-rule system prompt — code is SSoT):**

- **No-provider default:** When no provider selected, Tier 1 MUST use parenthetical syntax `(term:1.3)`. Using `::` without provider context is wrong.
- **`--no` flag mandatory for T2:** All negatives must follow `--no`. Inline negatives without `--no` are treated as positive prompt by Midjourney.
- **`--v 7`:** Midjourney parameter updated from `--v 6`.
- **Weight hierarchy:** Subject must carry highest weight in both T1 and T2. Abstract mood terms get lowest or no weight.
- **Literal language for T1:** CLIP interprets literally — "schools of fish" not "clouds of fish".
- **Expert value-add:** Every tier must include composition, lighting, or style elements the user didn't provide.
- **v4.0.0 additions:** T1-8 semantic clustering + interaction merging, T3-5 opening diversity, T4-5 mandatory scene depth, G1 emotional atmosphere mandate, T1-6 time-of-day weighting, T3 "that feels" ban (11 banned phrases total).
- **Post-processing pipeline:** 7 functions (P1–P12) in `harmony-post-processing.ts` catch GPT artefacts. See `ai-disguise.md` v4.0.0 §7.

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

#### PlaygroundWorkspace: `playground-workspace.tsx` (313 lines) — THE ORCHESTRATOR

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

### Prompt Lab Components (v3.0.0)

#### Core Components

| Component                    | File                                                         | Lines     | Purpose                                                                                                                                                                      |
| ---------------------------- | ------------------------------------------------------------ | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PlaygroundWorkspace`        | `src/components/prompts/playground-workspace.tsx`            | 313       | AI Disguise orchestrator — lifts hooks, auto-re-fires, passes AI state down                                                                                                  |
| `EnhancedEducationalPreview` | `src/components/prompts/enhanced-educational-preview.tsx`    | **2,014** | Lab preview — full-width layout, AI tier display, Call 3 wiring, algorithm animation, footer Clear All cascade via `clearSignal`                                             |
| `FourTierPromptPreview`      | `src/components/prompt-builder/four-tier-prompt-preview.tsx` | **788**   | 4-tier prompt cards, colour-coded text (Pro), "Generated for" badge, **tier provider icons strip**, white tier labels, `providers` prop                                      |
| `DescribeYourImage`          | `src/components/providers/describe-your-image.tsx`           | **722**   | Human text input — textarea, **engine bay gradient Generate button** (pulse + shimmer), **purple gradient Clear All**, `clearSignal` prop, format detection, drift indicator |

#### AI Disguise Components (new in v3.0.0)

| Component          | File                                              | Lines | Purpose                                                                                 |
| ------------------ | ------------------------------------------------- | ----- | --------------------------------------------------------------------------------------- |
| `AlgorithmCycling` | `src/components/prompt-lab/algorithm-cycling.tsx` | 256   | Cycling animation during Call 3 — amber→emerald colour shift, slot-machine deceleration |
| `DriftIndicator`   | `src/components/prompt-lab/drift-indicator.tsx`   | 136   | Amber pulsing "N changes detected" badge — §4 Zeigarnik Effect                          |

#### AI Disguise Hooks (new in v3.0.0)

| Hook                | File                               | Lines | Purpose                                                                                       |
| ------------------- | ---------------------------------- | ----- | --------------------------------------------------------------------------------------------- |
| `useTierGeneration` | `src/hooks/use-tier-generation.ts` | 224   | Call 2 — fires `/api/generate-tier-prompts`, AbortController for provider-switch cancellation |
| `useAiOptimisation` | `src/hooks/use-ai-optimisation.ts` | 335   | Call 3 — fires `/api/optimise-prompt`, orchestrates 3-phase animation timing                  |
| `useDriftDetection` | `src/hooks/use-drift-detection.ts` | 165   | Word-level diff, zero API calls, bag-of-words symmetric difference                            |

#### AI Disguise API Routes (v4.0.0)

| Route                             | File                                         | Lines   | Purpose                                                                                                                                                |
| --------------------------------- | -------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `POST /api/parse-sentence`        | `src/app/api/parse-sentence/route.ts`        | **455** | Call 1 — GPT extracts human text → 12 category JSON + matched phrases for text colouring                                                               |
| `POST /api/generate-tier-prompts` | `src/app/api/generate-tier-prompts/route.ts` | **523** | Call 2 — GPT generates 4 native tier prompts (30-rule system prompt). Imports `postProcessTiers()` from `harmony-post-processing.ts` (P1–P12 pipeline) |
| `POST /api/optimise-prompt`       | `src/app/api/optimise-prompt/route.ts`       | **336** | Call 3 — GPT optimises assembled prompt for specific provider                                                                                          |

#### Post-Processing Module (v4.0.0 — extracted from route.ts)

| File                                                | Lines   | Purpose                                                                                                                  |
| --------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------ |
| `src/lib/harmony-post-processing.ts`                | **342** | 7 active functions (P1, P2, P3, P8, P10, P11, P12) — catches GPT mechanical artefacts server-side. Imported by route.ts. |
| `src/lib/harmony-compliance.ts`                     | **486** | Compliance gate (P4, P5, P6, P9) + rule ceiling tracking (`RULE_CEILING = 30`).                                          |
| `src/lib/__tests__/harmony-post-processing.test.ts` | **601** | 72-test lockdown suite — real GPT fixtures from 6 rounds + 3 stress tests.                                               |
| `src/lib/__tests__/harmony-compliance.test.ts`      | **453** | 43-test compliance suite — drift detection assertions for lookup set sizes.                                              |

#### Data Files (new in v3.0.0)

| File                          | Lines | Purpose                                                                                                    |
| ----------------------------- | ----- | ---------------------------------------------------------------------------------------------------------- |
| `src/data/algorithm-names.ts` | 187   | 101 algorithm display names + 3 finale names + Fisher-Yates shuffle + `getAlgorithmCount()` (87–102 range) |

#### Removed from Prompt Lab (v3.0.0)

| Component           | File                                                   | Status                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `IntelligencePanel` | `src/components/prompt-builder/intelligence-panel.tsx` | **REMOVED from Prompt Lab render.** The panel scored 52/100 for the AI Disguise workflow — it was designed for the dropdown-selection workflow and became a passive sidebar in the human-text-input workflow. DnaBar still receives `conflictCount`, `hasHardConflicts`, `healthScore` from the intelligence engine. **The IntelligencePanel remains fully intact in the standard builder (`/providers/[id]`).** |

---

### Layout (v3.0.0)

**Before (v2.0.0):** 3-column grid (`lg:grid-cols-3`) — left 2 columns for builder content, right 1 column for IntelligencePanel.

**After (v3.0.0):** Single-column full-width layout (`space-y-4`). All builder content stretches to full width — category dropdowns, assembled prompt, 4-tier preview, optimizer output. This gives more breathing room for prompt text display and the algorithm cycling animation.

---

### Prompt Lab Features (v3.0.0)

#### AI Disguise Features (new)

**1. AI Tier Generation (Call 2):** When "Generate Prompt" is clicked, Call 2 fires in parallel with Call 1. The AI generates 4 tier-native prompts directly from the user's human text, preserving poetry, spatial relationships, and creative intent. Template generators (`generators.ts`) are fallback only. `activeTierPromptText` uses `aiTierPrompts ?? generatedPrompts`.

**2. "Generated for" Badge:** When a provider is selected and Call 2 has returned, a violet badge appears in the 4-tier header: "Generated for Leonardo AI". De-selecting the provider keeps the badge visible with the last-generated provider name. Switching providers re-fires Call 2 and updates the badge.

**3. AI Prompt Optimisation (Call 3):** When the optimizer is toggled ON with a provider selected, Call 3 fires. The AI restructures the prompt for the specific provider — reordering by impact priority, applying provider-specific weight syntax, removing filler, strengthening quality anchors. Uses the effective optimised text (`aiOptimiseResult?.optimised ?? optimizedResult.optimized`) throughout.

**4. Algorithm Cycling Animation:** During Call 3, 101 algorithm names cycle at 160–200ms in amber monospace text, decelerating to a slot-machine stop, landing on "✓ {87–102} algorithms applied" in emerald. Minimum 1.8s display time. 12s hard timeout. `prefers-reduced-motion` respected. Human factors: §3 Anticipatory Dopamine, §6 Temporal Compression, §18 Animation as Communication.

**5. Prompt DNA Drift Detection:** Pure client-side word-level diff between current textarea text and last-generated text. Zero API calls. When `isDrifted && changeCount >= 3`, the Generate button pulses amber and changes to "Regenerate". Below 3 changes, only the amber badge appears. Human factor: §4 Zeigarnik Effect.

**6. Clear All Buttons (v3.1.0):** Purple gradient matching Dynamic/Randomise buttons (`border-purple-500/70 bg-gradient-to-r from-purple-600/20 to-pink-600/20 text-white`). Two identical buttons: one next to Generate (visible after generation), one in footer. Both trigger full cascade reset: textarea empties, all 12 category dropdowns reset to `{ selected: [], customValue: '' }`, optimizer toggles OFF, AI tier results clear, AI optimise results clear, aspect ratio resets, scene resets, drift resets. Footer Clear All uses `clearSignal` prop to trigger DescribeYourImage internal reset.

**7. Debounced Call 3 Re-fire:** When the optimizer is already ON and `activeTierPromptText` changes (aspect ratio change, selection change, AI tiers arrive), Call 3 re-fires after 800ms debounce. Ensures the optimised prompt stays in sync with the assembled prompt.

**8. Hint Text:** After generation, when no drift detected: "Edit your description above and click Regenerate to refine your prompts" in subtle slate text. Disappears when drift is detected (drift indicator takes over).

**9. Generate Button — Engine Bay Styling (v3.1.0):** The Generate Prompt button adopts the same visual treatment as the Launch Platform Builder button in the engine bay. When textarea has text: sky→emerald→indigo gradient (`from-sky-400/40 via-emerald-300/40 to-indigo-400/40`), `dyi-generate-pulse` animation (sky/emerald box-shadow 2s infinite), `dyi-generate-shimmer` overlay on hover. When empty: slate disabled. When loading: same gradient, spinner. All animations co-located in `DESCRIBE_STYLES` constant. See `human-sentence-conversion.md` §6.

**10. Tier Provider Icons (v3.1.0):** `FourTierPromptPreview` shows all providers for the active tier as a centered icon strip between the header and tier cards. Icons grouped via `getPlatformTierId()`. Styling matches PotM "Try in" icons: `bg-white/15 ring-1 ring-white/10`, `clamp(30px, 2.3vw, 38px)` squares, `drop-shadow(0 0 3px rgba(255,255,255,0.4))`. Non-clickable (`cursor-default`), hover glow + `scale(1.1)`. Tooltip shows provider name. New `providers` prop passed from `EnhancedEducationalPreview`.

**11. White Tier Labels (v3.1.0):** "Tier X: Name" and "Same scene, different syntaxes" text changed from `text-slate-500` to `text-white font-medium`. No grey text in Prompt Lab per code standard.

**12. `clearSignal` Mechanism (v3.1.0):** Footer Clear All cannot directly access DescribeYourImage's internal state (`inputText`, `hasGenerated`). Solution: `EnhancedEducationalPreview` holds `const [clearSignal, setClearSignal] = useState(0)`. Footer `handleClear()` increments it. DescribeYourImage has a `useEffect` watching `clearSignal` that resets its own internal state + fires `onClear()`. Avoids lifting textarea state to parent.

#### Retained Features (from v2.0.0)

**13. Colour-coded prompts in all 4 tiers:** `FourTierPromptPreview` receives `isPro` and `termIndex` props. When `isPro=true`, each tier card renders prompt text via `parsePromptIntoSegments()` with `CATEGORY_COLOURS`.

**14. Assembled prompt box:** Full-width box showing `activeTierPromptText` (AI tier text when available, template text as fallback). Colour-coded for Pro users. Inline `SaveIcon` + copy icons. `StageBadge` in header. Char count right-aligned.

**15. Dynamic label switching:** When `isOptimizerEnabled && selectedProviderId`: label changes to "Optimized prompt in [Provider] [icon]" (emerald). Uses `effectiveWasOptimized` (AI result takes priority over client-side).

**16. Optimizer neutral mode:** When no provider selected, the optimizer toggle is force-disabled. Tooltip: "Select an AI provider above to enable optimisation."

**17. Green "Within optimal range":** When optimizer ON + provider selected + no trimming needed + not actively optimising: emerald bar "✓ Within optimal range — X chars / No trimming needed".

**18. LabCategoryColourLegend:** Positioned in header between `│` divider and Optimize toggle.

**19. Inline copy + save icons:** Copy + `SaveIcon` inside both assembled and optimized prompt boxes. All copy handlers call `incrementLifetimePrompts()`.

**20. DnaBar:** Still receives `conflictCount`, `hasHardConflicts`, `healthScore` from `useRealIntelligence` (simplified to return only DnaBar data, not full panel data).

---

### Key Difference: Lab vs Standard Builder (v3.0.0)

| Aspect                 | Standard Builder (`/providers/[id]`)             | Prompt Lab (`/studio/playground`)                                 |
| ---------------------- | ------------------------------------------------ | ----------------------------------------------------------------- |
| Header                 | Static: "Midjourney · Prompt builder"            | Dropdown: "[▼ Select Provider...]"                                |
| Provider               | Pre-selected from URL                            | User selects from all 42                                          |
| No provider state      | N/A (always has provider)                        | Shows `EnhancedEducationalPreview` full-width                     |
| AI tier generation     | No — uses template `generators.ts`               | Yes — Call 2 generates AI-native tier prompts                     |
| AI prompt optimisation | No — client-side 4-phase optimizer only          | Yes — Call 3 (AI) + client-side as fallback                       |
| Algorithm cycling      | No                                               | Yes — 101 names, amber→emerald, slot-machine landing              |
| Drift detection        | No                                               | Yes — word-level diff with "Regenerate" pulse                     |
| Intelligence Panel     | Full panel (Conflicts, Suggestions, Market Mood) | **Removed** — DnaBar conflict count retained                      |
| Layout                 | 3-column grid (builder + Intelligence Panel)     | Full-width single column                                          |
| Prompt source          | Template assembly via `assemblePrompt()`         | AI tiers (Call 2) with template fallback                          |
| Selection persistence  | Resets on URL change                             | Persists across provider switches                                 |
| Colour coding          | Pro only (both boxes)                            | Pro only (all 4 tiers + both boxes)                               |
| Generate button        | Standard                                         | Engine bay gradient (pulse + shimmer when text present)           |
| Clear All              | Standard clear                                   | Purple gradient, full cascade, `clearSignal` for external trigger |
| Tier provider icons    | None                                             | All providers for active tier shown as icon strip                 |
| Post-processing        | None                                             | P1 (T2 `--no` dedup) + P2 (T1 period strip)                       |

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
- **Post-processing (`postProcessTiers()`) is mandatory on all Call 2 responses** — 7 functions (P1–P12) in `harmony-post-processing.ts` catch GPT mechanical artefacts. Do not bypass, remove, or make conditional. See `ai-disguise.md` v4.0.0 §7.
- **115-test harmony lockdown suite must pass before shipping** — `harmony-post-processing.test.ts` (72 tests) + `harmony-compliance.test.ts` (43 tests). Any red test = drift. Fix the code, not the test.
- **Rule ceiling is 30** — raising requires explicit Martin approval. Tracked in `harmony-compliance.ts` with test assertion.
- **Post-processing extraction is permanent** — all P1–P12 functions live in `harmony-post-processing.ts`, imported by route.ts. Do not move them back.

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

| Topic                                             | Document                              |
| ------------------------------------------------- | ------------------------------------- |
| AI Disguise full specification                    | `ai-disguise.md` v4.0.0               |
| Harmony engineering playbook                      | `harmonizing-claude-openai.md` v2.0.0 |
| V4 four-phase flow (Check→Assess→Decide→Generate) | `prompt-lab-v4-flow.md` v1.3.0        |
| Human sentence conversion UI + term matching      | `human-sentence-conversion.md`        |
| Prompt builder architecture                       | `prompt-builder-page.md`              |
| Colour-coded prompt anatomy                       | `paid_tier.md` §5.14                  |
| Prompt Lab parity features                        | `paid_tier.md` §5.13                  |
| Pro Gem Badge (lifetime counter)                  | `paid_tier.md` §5.15                  |
| Prompt optimizer (client-side)                    | `prompt-optimizer.md`                 |
| Human factors                                     | `human-factors.md`                    |
| Button styling standards                          | `buttons.md`                          |
| Homepage layout                                   | `homepage.md`                         |
| Mission Control                                   | `mission-control.md`                  |
| Engine Bay                                        | `ignition.md`                         |
| Intelligence system                               | `prompt-intelligence.md` §9           |
| Code standards                                    | `code-standard.md`                    |
| SSOT colour constants                             | `code-standard.md` § 6.14             |
| Master test document                              | `test.md`                             |

---

## Changelog

- **25 Mar 2026 (v3.2.0):** **HARMONY v2 INFRASTRUCTURE SYNC.** Cross-references updated: ai-disguise v3.0.0→v4.0.0, added harmonizing v2.0.0, added prompt-lab-v4-flow v1.3.0. Call 2 description updated: 18→30 system prompt rules, P1+P2→P1–P12 post-processing pipeline. Harmony engineering summary updated: 5→6+ rounds + 3 stress tests, 62→93 changed to 62→96, dual-assessor convergence (≤1 point gap). API Routes section updated to v4.0.0: route.ts 406→523 lines, parse-sentence 243→455 lines, optimise-prompt 315→336 lines. Added Post-Processing Module subsection: harmony-post-processing.ts (342 lines, 7 functions), harmony-compliance.ts (486 lines), 2 test files (601+453 lines, 115-test lockdown suite). Non-regression rules expanded: P1+P2→P1–P12 reference, added 115-test lockdown requirement, rule ceiling 30, extraction permanent. Related Documents: added harmonizing v2.0.0, prompt-lab-v4-flow v1.3.0, test.md.

- **23 Mar 2026 (v3.1.0):** **HARMONY ENGINEERING + UI POLISH.** Call 2 system prompt evolved from 11 rules to 18 rules through 5 rounds of iterative harmony testing (scoring 62→93/100). Post-processing layer added: `deduplicateMjNegatives()` (P1) catches T2 duplicate negatives, `stripTrailingPunctuation()` (P2) catches T1 trailing periods. `route.ts` grew from 319→406 lines. Temperature 0.3→0.5, max_completion_tokens 1500→2000. UI changes: Generate button adopts engine bay gradient+pulse+shimmer when text present (sky→emerald→indigo, matching Launch Platform Builder exactly). Clear All buttons changed from Core Colours gradient to purple gradient with white text (matching Dynamic/Randomise canonical style). `clearSignal` mechanism added for footer→DescribeYourImage cascade reset. `FourTierPromptPreview` updated (684→788 lines): tier provider icons strip showing all providers for active tier (PotM-matching style, non-clickable, hover glow+scale), white tier labels replacing `text-slate-500`. `DescribeYourImage` updated (667→722 lines). `EnhancedEducationalPreview` updated (2,008→2,014 lines). Non-regression rules expanded with UI rules section. Cross-references updated: `human-sentence-conversion.md`, `buttons.md` added. See `ai-disguise.md` v3.0.0 §6–§8 for full system prompt, post-processing, and harmony engineering specification.

- **23 Mar 2026 (v3.0.0):** **AI DISGUISE + INTELLIGENCE PANEL REMOVAL + FULL-WIDTH LAYOUT.** Major architectural update. PlaygroundWorkspace (229→313 lines) rewritten as AI Disguise orchestrator — lifts `useTierGeneration` and `useDriftDetection` hooks so AI state persists across provider switches. Auto-re-fires Call 2 when provider changes. 8 new files added: 2 API routes (`generate-tier-prompts` 319 lines, `optimise-prompt` 315 lines), 3 hooks (`use-tier-generation` 224 lines, `use-ai-optimisation` 335 lines, `use-drift-detection` 165 lines), 2 animation components (`algorithm-cycling` 256 lines, `drift-indicator` 136 lines), 1 data file (`algorithm-names` 187 lines — 101 cycling names + 3 finale + shuffle). EnhancedEducationalPreview (1,899→2,008 lines): Call 3 wiring with debounced 800ms re-fire, `AlgorithmCycling` render, effective optimised values (`aiOptimiseResult` priority over client-side), full cascade clear (12 dropdowns + optimizer OFF + AI clear). `IntelligencePanel` removed from Prompt Lab render (scored 52/100 for AI Disguise workflow — designed for dropdown selection, became passive sidebar in human-text workflow). DnaBar still fed via simplified `useRealIntelligence`. Layout changed from `lg:grid-cols-3` to single-column `space-y-4` full-width. DescribeYourImage (577→667 lines): Clear button with Core Colours gradient + full cascade reset, drift indicator badge, "Regenerate" amber pulse when drift ≥ 3, hint text after generation. FourTierPromptPreview (647→684 lines): "Generated for X" violet badge, "Generating..." amber pulse. Call 2 system prompt: provider-specific weight syntax (Leonardo `::`, SD `()`), 4-word weight wrapping rule, quality suffix. Call 3 system prompt: mandatory provider syntax enforcement, dynamic examples, quality suffix for Tier 1. Comparison table updated: 14 aspects including AI features and layout changes. Non-regression rules: 17 rules across 4 categories (layout, code standards, AI Disguise, existing behaviour).

- **18 Mar 2026 (v2.0.0):** **COMPLETE REWRITE — Studio hub removed, Prompt Lab parity.** Studio hub page (`/studio`) removed and replaced with redirect to homepage. `studio-page-client.tsx` deleted. 4 feature cards (Library, Explore, Learn, Playground) removed — routes now accessed directly. Document scope changed from "Studio hub page" to "Studio section (`/studio/*`)". Added full Prompt Lab (`/studio/playground`) documentation: server component (89 lines), client wrapper (140 lines), `PlaygroundWorkspace` (229 lines), `EnhancedEducationalPreview` (1,899 lines), `FourTierPromptPreview` (647 lines), `IntelligencePanel` (515 lines). Documented all 11 Prompt Lab parity features: colour-coded 4-tier prompts, assembled prompt box with StageBadge, dynamic label switching (assembled → optimized), provider icon on optimized label, optimizer neutral mode, green "Within optimal range" feedback, LabCategoryColourLegend, inline copy + save icons, lifetime counter wiring, cursor-pointer enforcement. Added Lab vs Standard Builder comparison table. Added Layout Contract section. Updated Mission Control integration table. Added 10 non-regression rules. Updated file structure and all related documents.

- **26 Jan 2026 (v1.0.0):** Initial implementation — Studio hub page using HomepageGrid layout. 4 feature cards: Library, Explore, Learn, Playground. Native `<a>` tags for navigation. Integration with Mission Control (`isStudioPage` prop). Live exchange/weather data.

---

_This document is the authority for the Studio section. For individual feature details, see their respective documents._

_**Key principle:** Always update docs FIRST before writing any code. Docs are the single source of truth._
