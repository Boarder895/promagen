# Prompt Builder Page

**Last updated:** 28 December 2025  
**Owner:** Promagen  
**Authority:** This document defines the architecture and behaviour for the provider-specific prompt builder page (`/providers/[id]`).

## Purpose

When a user clicks a provider row in the Leaderboard, they navigate to a dedicated page for that provider. This page reuses the Homepage layout (exchange rails + finance ribbon) but replaces the centre leaderboard with a **two-row prompt workspace**.

The design philosophy: Promagen is a bridge between markets and imagination. The prompt builder page is where users craft prompts before launching into the AI provider platform.

## Page architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Finance Ribbon (FX/Crypto)                      │
├────────────────┬────────────────────────────────┬───────────────────┤
│                │           TOP HALF              │                   │
│   Exchange     │   PromptBuilder component       │    Exchange       │
│   Rail         │   - Provider name + tagline     │    Rail           │
│   (East)       │   - Textarea (image prompt)     │    (West)         │
│                │   - Copy prompt button          │                   │
│                ├────────────────────────────────┤                   │
│                │          BOTTOM HALF            │                   │
│                │   LaunchPanel component         │                   │
│                │   - Large branded button        │                   │
│                │   - "Open [Provider] ↗"         │                   │
│                │   - Affiliate disclosure        │                   │
└────────────────┴────────────────────────────────┴───────────────────┘
```

## Route structure

**Primary route:** `/providers/[id]`

- Dynamic segment `[id]` matches provider slug from `providers.json` (e.g., `midjourney`, `leonardo`, `openai`)
- Invalid slugs render a "Provider not found" state (do not 404 — show helpful UI)

**File location:** `frontend/src/app/providers/[id]/page.tsx`

## Layout contract

The page MUST use `HomepageGrid` to maintain visual consistency with the homepage:

```typescript
<HomepageGrid
  mainLabel={`Prompt builder for ${provider.name}`}
  left={<ExchangeRail ... />}
  centre={<ProviderWorkspace provider={provider} />}
  right={<ExchangeRail ... />}
  showFinanceRibbon  // Optional: show FX ribbon at top
/>
```

**Centre panel structure:**

The centre panel is split into two vertically stacked sections:

1. **Top half (60%):** PromptBuilder component
2. **Bottom half (40%):** LaunchPanel component

Both sections are wrapped in the standard card container (rounded, dark fill, hairline border).

## Component specifications

### PromptBuilder (top half)

**File:** `frontend/src/components/providers/prompt-builder.tsx`

**Purpose:** Allow users to craft an image generation prompt before copying/launching.

**Required elements:**

1. **Header**
   - Provider name (h2)
   - Provider tagline (if available)
   - Provider tags (pills, if available)

2. **Prompt editor**
   - Accessible textarea with label "Image prompt editor"
   - Placeholder: "Write a prompt to run on [Provider]…"
   - Minimum 6 rows visible
   - ARIA: `aria-label="Prompt editor"` on the containing section

3. **Copy prompt button**
   - Label: "Copy prompt"
   - Copies textarea content to clipboard
   - Toast feedback on success (optional)

4. **Future enhancements (not MVP)**
   - Preset templates
   - Prompt history

### LaunchPanel (bottom half)

**File:** `frontend/src/components/providers/launch-panel.tsx` (NEW)

**Purpose:** Provide a clear, branded call-to-action to open the provider's platform.

**Required elements:**

1. **Launch button**
   - Large, prominent button (full width or centred)
   - Label: "Open [Provider] ↗" or "Launch [Provider] ↗"
   - Opens `/go/[id]?src=prompt_builder` in new tab
   - Uses provider brand colour if available (future)

2. **Affiliate disclosure**
   - Render `AffiliateBadge` if `provider.requiresDisclosure === true`
   - Position: below the button, muted styling

3. **Provider info (optional)**
   - One-liner about what makes this provider special
   - Link to provider's official site (via `/go/[id]`)

**Button routing rules (non-negotiable):**

- All outbound links go through `/go/[id]?src=prompt_builder`
- Never link directly to external URLs
- Authority: `docs/authority/ai providers affiliate & links.md`

## Workflow (user journey)

1. User clicks provider row in Leaderboard → navigates to `/providers/[id]`
2. Page renders with exchange rails (familiar context) + prompt workspace (new focus)
3. User writes prompt in textarea
4. User clicks "Copy prompt" → prompt copied to clipboard
5. User clicks "Open [Provider]" → new tab opens to provider platform
6. User pastes prompt into provider UI

**Future (API-enabled providers):**

1. User writes prompt
2. User clicks "Generate" (instead of Copy + Launch)
3. Image generates directly on Promagen (no tab switch)
4. Image appears in result panel (replaces LaunchPanel)

## Styling contract

Follow the card-only design language (authority: `docs/authority/best-working-practice.md`):

- Outer container: rounded card (large radius)
- Inner sections (PromptBuilder, LaunchPanel): rounded cards (medium radius)
- Spacing: consistent padding (use existing spacing scale)
- Typography: match existing provider detail styles

**Colour guidance:**

- Background: slate-950/60 (dark, translucent)
- Border: slate-700 or slate-800 (hairline, low-contrast)
- Text: slate-50 (headings), slate-300 (body)
- Accent: sky-500/sky-600 for interactive elements

## Analytics events

Track these events via the centralised analytics layer (`@/lib/analytics`):

| Event | Trigger | Properties |
|-------|---------|------------|
| `prompt_builder_open` | Page mount | `providerId`, `location: 'providers_page'` |
| `prompt_copy` | Copy button clicked | `providerId`, `promptLength` |
| `provider_launch` | Launch button clicked | `providerId`, `src: 'prompt_builder'` |

Authority: `docs/authority/ai providers.md` § Event taxonomy

## Accessibility requirements

- Textarea must have an associated `<label>`
- Copy button must have clear focus states
- Launch button must indicate external link (↗ icon + `aria-label`)
- Live region for copy confirmation (optional but recommended)
- Keyboard navigation: Tab through all interactive elements

## Testing requirements

### Smoke tests

- Page renders for valid provider ID
- Page renders "not found" state for invalid ID
- PromptBuilder section present with textarea
- LaunchPanel section present with button

### Interaction tests

- Copy button copies textarea value to clipboard
- Launch button href matches `/go/[id]?src=prompt_builder`

### Accessibility tests

- All interactive elements keyboard accessible
- Proper ARIA roles and labels

**Test file:** `frontend/src/app/providers/[id]/__tests__/page.test.tsx`

## Implementation checklist

- [ ] Create `LaunchPanel` component
- [ ] Update `/providers/[id]/page.tsx` to use two-row centre layout
- [ ] Wire analytics events
- [ ] Add smoke tests
- [ ] Update this doc with any deviations

## Non-regression rule

When implementing the prompt builder page:

- Do not modify the Leaderboard page layout or behaviour
- Do not modify `HomepageGrid` unless adding new props (additive only)
- Do not modify exchange rail components
- Preserve all existing provider detail functionality

**Existing features preserved:** Yes (required for every change)
