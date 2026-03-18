# Studio Section Authority Document

**Last updated:** 18 March 2026  
**Version:** 2.0.0  
**Owner:** Promagen  
**Authority:** This document defines the architecture, routes, and component behaviour for the Studio section (`/studio/*`).
**Cross-reference:** For colour-coded prompt anatomy, see `paid_tier.md` §5.14. For Prompt Lab parity features, see `paid_tier.md` §5.13. For prompt builder architecture, see `prompt-builder-page.md`. For optimizer details, see `prompt-optimizer.md`.

---

## Purpose

The Studio section (`/studio/*`) contains Promagen's creative tool pages. It is **not** a hub page — the `/studio` route itself redirects to the homepage. The two active child routes are:

| Route                | Name         | Purpose                                   | Status     |
| -------------------- | ------------ | ----------------------------------------- | ---------- |
| `/studio/playground` | Prompt Lab   | Builder-first prompt creation (all 42 platforms) | Active     |
| `/studio/library`    | My Prompts   | Saved prompts library                     | Active     |

**Removed (v6.0.0):** The Studio hub page with 4 feature cards (Library, Explore, Learn, Playground) was removed. `/studio` now redirects to `/`. The Explore page moved to `/prompts/explore`. Learn and Trending are not yet built.

---

## Route Structure

```
src/app/studio/
├── page.tsx                              # /studio → redirect to / (hub removed v6.0.0)
├── library/
│   └── page.tsx                          # /studio/library → Saved prompts (51 lines)
└── playground/
    ├── page.tsx                          # /studio/playground → Prompt Lab server (89 lines)
    └── playground-page-client.tsx        # Client wrapper (140 lines)
```

---

## `/studio/playground` — Prompt Lab

### Overview

The Prompt Lab is Promagen's builder-first prompt creation environment. Unlike `/providers/[id]` (where the provider is pre-selected from the URL), the Prompt Lab lets users select any of the 42 platforms from a dropdown and see their prompt reshape in real time.

**Auth gate:** Pro Promagen exclusive — NOT YET GATED (see `paid_tier.md` §5.13). Currently accessible to all users.

**Pro page integration:** Listed as card 6 (🧪 Prompt Lab) in the Feature Control Panel on `/pro-promagen`. Free users see "Pro exclusive" / "Pro only". Paid users see "Full access" / "Open lab →".

### Architecture

#### Server Component: `page.tsx` (89 lines)

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

#### Client Wrapper: `playground-page-client.tsx` (140 lines)

Renders `HomepageGrid` with Prompt Lab–specific content:

- **heroTextOverride:** Two states based on provider selection:
  - No provider: "Every platform speaks its own language..." (invitation)
  - Provider selected: "Same selections, different output..." (guidance)
- **headingText:** "Promagen — Prompt Lab"
- **showFinanceRibbon:** `false` (hidden on this route)
- **isStudioSubPage:** `true`
- Tracks `hasProvider` state via callback from `PlaygroundWorkspace`

#### PlaygroundWorkspace: `playground-workspace.tsx` (229 lines)

The routing component that decides what to render:

```
selectedProvider === null → <EnhancedEducationalPreview />  (Lab preview)
selectedProvider !== null → <PromptBuilder />                (standard builder)
```

- **ProviderSelector:** Combobox (`compact`, `singleColumn`) with all 42 providers, A–Z sort (numeric names like "123RF" sorted last)
- **No provider selected:** `EnhancedEducationalPreview` renders the Lab's own 4-tier preview with full intelligence panel, category grid, and educational features
- **Provider selected:** Standard `PromptBuilder` renders with the selected provider's formatting, passed via `providerSelector` prop

### Prompt Lab Components

| Component | File | Lines | Purpose |
| --- | --- | --- | --- |
| `PlaygroundWorkspace` | `src/components/prompts/playground-workspace.tsx` | 229 | Router: no provider → Lab preview, provider → standard builder |
| `EnhancedEducationalPreview` | `src/components/prompts/enhanced-educational-preview.tsx` | 1,899 | Lab preview with 4-tier output, intelligence, colour-coding |
| `FourTierPromptPreview` | `src/components/prompt-builder/four-tier-prompt-preview.tsx` | 647 | 4-tier prompt cards with colour-coded text (Pro) |
| `IntelligencePanel` | `src/components/prompt-builder/intelligence-panel.tsx` | 515 | Conflicts, Suggestions, Market Mood tabs |
| `PromptIntelligenceBuilder` | `src/components/prompt-builder/prompt-intelligence-builder.tsx` | 714 | Intelligence wiring + `colourTermIndex` computation |

### Prompt Lab Parity Features (v5.0.0 — 18 March 2026)

The Lab now has full feature parity with the standard builder for colour-coded prompts and optimizer UX. All implemented in `enhanced-educational-preview.tsx`:

**1. Colour-coded prompts in all 4 tiers:** `FourTierPromptPreview` receives `isPro` and `termIndex` props. When `isPro=true`, each tier card renders prompt text via `parsePromptIntoSegments()` with `CATEGORY_COLOURS` from `src/lib/prompt-colours.ts`. All 5 `TierCard` calls updated (single-tier + 4 multi-tier).

**2. Assembled prompt box:** Full-width box between category grid and 4-tier cards showing `activeTierPromptText`. Colour-coded for Pro users. Inline `SaveIcon` + copy icons (float-right). `StageBadge` in header. Char count right-aligned. States: `copiedAssembled` + `handleCopyAssembled`.

**3. Dynamic label switching:** When `isOptimizerEnabled && selectedProviderId`:
- Label: "Assembled prompt" → "Optimized prompt in [Provider] [icon]" (`text-emerald-300`)
- Border: `border-slate-600` → `border-emerald-600/50 bg-emerald-950/20`
- Text: `text-slate-100` → `text-emerald-100`
- Copy tooltip: "Copy assembled prompt" → "Copy optimized prompt"
- **Note:** Condition does NOT include `wasOptimized` — switches the moment optimizer is enabled with a provider, regardless of whether trimming occurred

**4. Provider icon on optimized label:** 20×20px provider icon next to "Optimized prompt in [ProviderName]". Path: `selectedProvider.localIcon || /icons/providers/${selectedProvider.id}.png`. `onError` hides icon if missing.

**5. StageBadge:** Local component: 📋 Static / ✨ Dynamic / ⚡ Optimized / ✓ Optimal. In assembled prompt box header.

**6. Optimizer disabled in neutral mode:** When no provider selected, the optimizer toggle is force-disabled via `finalOptimizerDisabled = isOptimizerDisabled || !selectedProviderId`. Tooltip: "Select an AI provider above to enable optimisation." When provider selected → real platform tooltip.

**7. Green "Within optimal range":** When optimizer ON + provider selected + no trimming: emerald bar "✓ Within optimal range — X chars / No trimming needed".

**8. LabCategoryColourLegend:** Local component (same restyled design as standard builder's `CategoryColourLegend`). Positioned in header between `│` divider and Optimize toggle. Emoji `clamp(18px, 1.4vw, 22px)`, solid `rgba(15, 23, 42, 0.97)` bg, `rounded-xl`, ethereal glow overlay.

**9. Inline copy + save icons:** Copy + `SaveIcon` inside both assembled and optimized prompt boxes (matching standard builder pattern). Optimized box: `min-h-[60px] max-h-[150px]`.

**10. Lifetime counter wiring:** All 3 copy handlers (`handleCopy`, `handleCopyOptimized`, `handleCopyAssembled`) call `incrementLifetimePrompts()` from `src/lib/lifetime-counter.ts`. Feeds the Pro Gem Badge tier progression (`paid_tier.md` §5.15).

**11. cursor-pointer on all interactive elements:** Copy prompt, Randomise, Clear, Save footer buttons. Intelligence panel Conflicts/Suggestions tabs and weather suggestion buttons. See `code-standard.md` § 6.0.4.

### Key Difference: Lab vs Standard Builder

| Aspect | Standard Builder (`/providers/[id]`) | Prompt Lab (`/studio/playground`) |
| --- | --- | --- |
| Header | Static: "Midjourney · Prompt builder" | Dropdown: "[▼ Select Provider...] · Prompt builder" |
| Provider | Pre-selected from URL | User selects from all 42 |
| No provider state | N/A (always has provider) | Shows `EnhancedEducationalPreview` with 4-tier output |
| Use case | "I want to use Midjourney" | "I want to build a prompt" |
| Switching | Navigate to different URL | Instant dropdown change |
| 4-tier preview | Not shown | Shows all 4 tier prompts |
| Optimizer | Always enabled | Disabled until provider selected (neutral mode) |
| Colour coding | Pro only (both boxes) | Pro only (all 4 tiers + both boxes + category labels) |
| Selection persistence | Resets on URL change | Persists across provider switches |

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

| Page | Mission Control Button | Destination |
| --- | --- | --- |
| Homepage (`/`) | Studio | `/studio/playground` |
| Prompt Lab (`/studio/playground`) | Home | `/` |
| My Prompts (`/studio/library`) | Home | `/` |
| Pro Promagen (`/pro-promagen`) | Home | `/` |

**Prop:** `isStudioSubPage` on `HomepageGrid` triggers "Home" button in Mission Control.

---

## Non-Regression Rules

- Do NOT restore the Studio hub page — `/studio` is a redirect, not a page
- Do NOT modify `HomepageGrid` unless adding new props (additive only)
- Do NOT change exchange rail components from within Studio pages
- Do NOT add `showFinanceRibbon={true}` — FX ribbon is hidden on Studio routes
- **Do NOT duplicate CATEGORY_COLOURS — import from `src/lib/prompt-colours.ts`**
- **Dynamic label condition is `isOptimizerEnabled && selectedProviderId` — do NOT add `wasOptimized`**
- **`incrementLifetimePrompts()` must be called in all 3 Lab copy handlers — do NOT remove**
- **Optimizer neutral mode: when `!selectedProviderId`, force-disable optimizer — do NOT allow enabling without a provider**
- **`cursor-pointer` on ALL interactive elements — see `code-standard.md` § 6.0.4**
- **All sizing via `clamp()` — no fixed px/rem — see `code-standard.md` § 6.0**

---

## Related Documents

| Topic | Document |
| --- | --- |
| Prompt builder architecture | `prompt-builder-page.md` |
| Colour-coded prompt anatomy | `paid_tier.md` §5.14 |
| Prompt Lab parity features | `paid_tier.md` §5.13 |
| Pro Gem Badge (lifetime counter) | `paid_tier.md` §5.15 |
| Prompt optimizer | `prompt-optimizer.md` |
| Homepage layout | `homepage.md` |
| Mission Control | `mission-control.md` |
| Engine Bay | `ignition.md` |
| Intelligence system | `prompt-intelligence.md` §9 |
| Code standards | `code-standard.md` |
| SSOT colour constants | `code-standard.md` § 6.14 |

---

## Changelog

- **18 Mar 2026 (v2.0.0):** **COMPLETE REWRITE — Studio hub removed, Prompt Lab parity.** Studio hub page (`/studio`) removed and replaced with redirect to homepage. `studio-page-client.tsx` deleted. 4 feature cards (Library, Explore, Learn, Playground) removed — routes now accessed directly. Document scope changed from "Studio hub page" to "Studio section (`/studio/*`)". Added full Prompt Lab (`/studio/playground`) documentation: server component (89 lines), client wrapper (140 lines), `PlaygroundWorkspace` (229 lines), `EnhancedEducationalPreview` (1,899 lines), `FourTierPromptPreview` (647 lines), `IntelligencePanel` (515 lines). Documented all 11 Prompt Lab parity features: colour-coded 4-tier prompts, assembled prompt box with StageBadge, dynamic label switching (assembled → optimized), provider icon on optimized label, optimizer neutral mode, green "Within optimal range" feedback, LabCategoryColourLegend, inline copy + save icons, lifetime counter wiring, cursor-pointer enforcement. Added Lab vs Standard Builder comparison table. Added Layout Contract section. Updated Mission Control integration table. Added 10 non-regression rules. Updated file structure and all related documents.

- **26 Jan 2026 (v1.0.0):** Initial implementation — Studio hub page using HomepageGrid layout. 4 feature cards: Library, Explore, Learn, Playground. Native `<a>` tags for navigation. Integration with Mission Control (`isStudioPage` prop). Live exchange/weather data.

---

_This document is the authority for the Studio section. For individual feature details, see their respective documents._

_**Key principle:** Always update docs FIRST before writing any code. Docs are the single source of truth._
