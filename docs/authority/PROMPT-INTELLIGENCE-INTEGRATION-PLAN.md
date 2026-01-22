# Prompt Intelligence Integration Plan

**Created:** 21 January 2026  
**Owner:** Promagen  
**Status:** Ready for Implementation

---

## Executive Summary

This plan integrates expanded vocabulary and intelligence features into Promagen's prompt system across three areas:

1. **Existing Prompt Builder** — Richer dropdowns, clickable free-text suggestions, behind-the-scenes intelligence
2. **Playground Educational Preview** — 4-tier demo when no provider selected
3. **Learn Page** — Contextual intelligence examples per category

**Key Constraint:** Existing prompt builder UI remains unchanged. Intelligence works behind the scenes.

---

## Phase 1: Vocabulary Integration into Existing Builder

### 1.1 Current State Analysis

**Files involved:**

```
src/lib/prompt-builder.ts           # getCategoryConfig() returns options
src/components/providers/prompt-builder.tsx  # Main builder component
src/data/vocabulary/prompt-builder/  # Full vocabulary JSONs (unused currently)
  ├── action.json
  ├── atmosphere.json
  ├── camera.json
  ├── colour.json
  ├── composition.json
  ├── environment.json
  ├── fidelity.json
  ├── lighting.json
  ├── materials.json
  ├── negative.json
  ├── style.json
  ├── subject.json
  └── index.ts
```

**Current behaviour:**

- `getCategoryConfig()` in `prompt-builder.ts` returns hardcoded arrays (~20-40 options per category)
- Dropdowns render these directly via `<Combobox>`

### 1.2 Target State

| Area              | Current          | Target                                                        |
| ----------------- | ---------------- | ------------------------------------------------------------- |
| Dropdown options  | ~20-40 hardcoded | Top 100 from vocabulary JSON                                  |
| Free text area    | Plain input      | Shows ALL vocabulary as clickable chips                       |
| Suggested section | None             | Top of dropdown shows 5-6 context-aware suggestions           |
| Intelligence      | None             | Behind-the-scenes conflict detection affects suggestion order |

### 1.3 Implementation Steps

#### Step 1.3.1: Create Vocabulary Loader

**New file:** `src/lib/vocabulary/vocabulary-loader.ts`

```typescript
// Purpose: Load and process vocabulary from JSON files
// Limit dropdown to 100 items, provide full list for free-text area

import actionData from '@/data/vocabulary/prompt-builder/action.json';
import atmosphereData from '@/data/vocabulary/prompt-builder/atmosphere.json';
// ... all 12 categories

export interface VocabularyEntry {
  term: string;
  tags?: string[];
  families?: string[];
  conflicts?: string[];
}

export interface CategoryVocabulary {
  dropdownOptions: string[]; // Top 100 for dropdown
  allOptions: string[]; // Full list for free-text chips
  suggestionPool: string[]; // Used by intelligence for suggestions
}

export function loadCategoryVocabulary(
  category: PromptCategory,
  context?: PromptContext,
): CategoryVocabulary {
  const raw = getRawVocabulary(category);

  // Score and sort by relevance to context
  const scored = context ? scoreByRelevance(raw, context) : raw;

  return {
    dropdownOptions: scored.slice(0, 100),
    allOptions: raw,
    suggestionPool: scored.slice(0, 20),
  };
}
```

#### Step 1.3.2: Modify getCategoryConfig()

**File:** `src/lib/prompt-builder.ts`

```typescript
// BEFORE (hardcoded):
export function getCategoryConfig(category: PromptCategory): CategoryConfig {
  switch (category) {
    case 'subject':
      return {
        options: ['portrait of a woman', 'fantasy warrior', ...], // ~30 items
        // ...
      };
  }
}

// AFTER (vocabulary-driven):
import { loadCategoryVocabulary } from '@/lib/vocabulary/vocabulary-loader';

export function getCategoryConfig(
  category: PromptCategory,
  context?: PromptContext
): CategoryConfig {
  const vocabulary = loadCategoryVocabulary(category, context);

  return {
    options: vocabulary.dropdownOptions,        // Top 100
    allOptions: vocabulary.allOptions,          // Full list
    suggestions: vocabulary.suggestionPool,     // For chips
    // ... rest unchanged
  };
}
```

#### Step 1.3.3: Update Combobox to Support Click-to-Add Chips

**File:** `src/components/ui/combobox.tsx`

**Current:** Free text input is just a text field

**Add:** Below the dropdown, when user focuses free text area, show clickable chips from `allOptions`

```tsx
// ADD to Combobox props:
interface ComboboxProps {
  // ... existing
  allOptions?: string[]; // NEW: Full vocabulary for chip display
  onChipClick?: (term: string) => void; // NEW: Handler when chip clicked
}

// ADD to Combobox render (inside dropdown area):
{
  showAllOptions && allOptions && (
    <div className="border-t border-white/10 p-2 max-h-40 overflow-y-auto">
      <p className="text-xs text-white/40 mb-2">Click to add:</p>
      <div className="flex flex-wrap gap-1">
        {allOptions
          .filter((opt) => !selected.includes(opt))
          .slice(0, 50) // Show 50 at a time for performance
          .map((opt) => (
            <button
              key={opt}
              onClick={() => onChipClick?.(opt)}
              className="px-2 py-0.5 text-xs bg-white/5 hover:bg-white/10 
                       rounded text-white/60 hover:text-white/80 transition-colors"
            >
              {opt}
            </button>
          ))}
        {allOptions.length > 50 && (
          <span className="text-xs text-white/30">
            +{allOptions.length - 50} more (type to search)
          </span>
        )}
      </div>
    </div>
  );
}
```

#### Step 1.3.4: Add "Suggested for you" Section to Dropdown

**File:** `src/components/ui/combobox.tsx`

At top of dropdown options, before the full list:

```tsx
{
  /* Suggested section */
}
{
  suggestions && suggestions.length > 0 && (
    <div className="border-b border-white/10 p-2">
      <p className="text-xs text-emerald-400/70 mb-1.5 flex items-center gap-1">
        <span>✨</span> Suggested for your style
      </p>
      <div className="flex flex-wrap gap-1">
        {suggestions.slice(0, 6).map((term) => (
          <button
            key={term}
            onClick={() => handleSelect(term)}
            className="px-2 py-1 text-xs bg-emerald-500/20 hover:bg-emerald-500/30 
                     border border-emerald-500/30 rounded-lg text-emerald-300 
                     transition-colors"
          >
            + {term}
          </button>
        ))}
      </div>
    </div>
  );
}

{
  /* Regular options list follows */
}
```

#### Step 1.3.5: Wire Intelligence for Suggestion Ordering

**File:** `src/components/providers/prompt-builder.tsx`

The intelligence already exists in hooks. We just need to use it to order suggestions:

```tsx
// ADD import:
import { usePromptAnalysis } from '@/hooks/prompt-intelligence';

// Inside PromptBuilder component:
const { conflicts, suggestions: intelligenceSuggestions } = usePromptAnalysis(
  assembledPrompt,
  platformId,
);

// Pass context to getCategoryConfig:
const subjectConfig = useMemo(
  () =>
    getCategoryConfig('subject', {
      selectedTerms: allSelectedTerms,
      dominantFamily: intelligenceSuggestions.dominantFamily,
    }),
  [allSelectedTerms, intelligenceSuggestions],
);
```

### 1.4 Files Modified Summary

| File                                          | Change Type | Description                                       |
| --------------------------------------------- | ----------- | ------------------------------------------------- |
| `src/lib/vocabulary/vocabulary-loader.ts`     | NEW         | Load vocabulary, limit to 100, score by context   |
| `src/lib/prompt-builder.ts`                   | MODIFY      | Use vocabulary loader instead of hardcoded arrays |
| `src/components/ui/combobox.tsx`              | MODIFY      | Add chip display, suggested section               |
| `src/components/providers/prompt-builder.tsx` | MODIFY      | Wire intelligence for context-aware suggestions   |

### 1.5 Verification Steps

```powershell
# Run from: C:\Users\Proma\Projects\promagen\frontend

# 1. TypeScript check
npx tsc --noEmit

# 2. Lint
npm run lint

# 3. Build
npm run build

# 4. Manual testing checklist:
# - [ ] Subject dropdown shows ~100 options (not 30)
# - [ ] Typing in search filters the 100 options
# - [ ] "Suggested for you" section appears with 5-6 terms
# - [ ] Click chip → adds to selection
# - [ ] Free text area shows clickable vocabulary chips
# - [ ] Existing UI unchanged (same layout, colours, spacing)
```

**Existing features preserved:** Yes

---

## Phase 2: Playground Educational Preview

### 2.1 Current State

**File:** `src/app/studio/playground/page.tsx`
**Component:** `src/components/prompts/playground-workspace.tsx`

**Current flow:**

```
User visits /studio/playground
  → PlaygroundWorkspace renders
    → No provider selected? → EmptyState (basic message)
    → Provider selected? → PromptBuilder
```

### 2.2 Target State

```
User visits /studio/playground
  → PlaygroundWorkspace renders
    → No provider selected? → EducationalPreview (4-tier interactive demo)
    → Provider selected? → PromptBuilder (unchanged)
```

### 2.3 EducationalPreview Component Spec

**New file:** `src/components/prompts/educational-preview.tsx`

```typescript
// Component that shows when no provider is selected
// Demonstrates 4-tier prompt generation educationally

interface EducationalPreviewProps {
  onSelectProvider: (providerId: string) => void;
}

// Features:
// 1. All 12 category dropdowns (same names, same order as real builder)
// 2. Aspect Ratio selector (13th row)
// 3. 4-Tier Prompt Variants panel (shows all 4 simultaneously)
// 4. Copy button per tier
// 5. Educational notes explaining syntax differences
// 6. "Select a provider to use this prompt" CTA
```

### 2.4 Category Sync Requirement

**Critical:** Educational preview MUST use same category configs as real builder.

```typescript
// SHARED CONFIG (both components import this):
// src/types/prompt-builder.ts

export const CATEGORY_ORDER: PromptCategory[] = [
  'subject',
  'action',
  'style',
  'environment',
  'composition',
  'camera',
  'lighting',
  'colour',
  'atmosphere',
  'materials',
  'fidelity',
  'negative',
];

export const CATEGORY_META: Record<PromptCategory, CategoryMeta> = {
  subject: { label: 'Subject', icon: '👤', ... },
  action: { label: 'Action / Pose', icon: '🏃', ... },
  style: { label: 'Style / Rendering', icon: '🎨', ... },
  environment: { label: 'Environment', icon: '🏙️', ... },
  composition: { label: 'Composition / Framing', icon: '📐', ... },
  camera: { label: 'Camera', icon: '📷', ... },
  lighting: { label: 'Lighting', icon: '💡', ... },
  colour: { label: 'Colour / Grade', icon: '🌈', ... },
  atmosphere: { label: 'Atmosphere', icon: '🌫️', ... },
  materials: { label: 'Materials / Texture', icon: '🧱', ... },
  fidelity: { label: 'Fidelity', icon: '✨', ... },
  negative: { label: 'Constraints / Negative', icon: '🚫', ... },
};
```

### 2.5 4-Tier Generator Integration

```typescript
// Use existing generator from:
// src/lib/prompt-builder/generators.ts

import { generateAllTierPrompts } from '@/lib/prompt-builder/generators';

// In EducationalPreview:
const tierPrompts = useMemo(() => generateAllTierPrompts(selections), [selections]);

// tierPrompts = {
//   tier1: "(subject:1.3), style, (lighting:1.2)...",  // CLIP format
//   tier2: "subject, style, lighting --ar 16:9 --no blurry",  // MJ format
//   tier3: "A detailed description of subject with style...",  // Natural language
//   tier4: "subject, style, lighting",  // Simple
//   negative: { tier1: "...", tier2: "...", tier3: "...", tier4: "..." }
// }
```

### 2.6 Implementation Steps

#### Step 2.6.1: Create EducationalPreview Component

**New file:** `src/components/prompts/educational-preview.tsx`

Structure:

```tsx
export function EducationalPreview({ onSelectProvider }: Props) {
  const [selections, setSelections] = useState<PromptSelections>(EMPTY_SELECTIONS);
  const [aspectRatio, setAspectRatio] = useState<string>('16:9');

  const tierPrompts = useMemo(
    () => generateAllTierPrompts(selections, aspectRatio),
    [selections, aspectRatio],
  );

  return (
    <div className="...">
      {/* Header with provider dropdown */}
      <header>
        <ProviderSelector onSelect={onSelectProvider} />
        <span>or explore prompt formats below</span>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Category dropdowns (2 cols on lg) */}
        <div className="lg:col-span-2">
          <CategoryGrid selections={selections} onChange={setSelections} />
          <AspectRatioSelector value={aspectRatio} onChange={setAspectRatio} />
        </div>

        {/* Right: 4-Tier variants (1 col on lg) */}
        <div className="lg:col-span-1">
          <FourTierDisplay prompts={tierPrompts} />
        </div>
      </div>

      {/* Educational footer */}
      <footer>
        <p>💡 Learn by comparison: See how the same prompt adapts to different platforms</p>
      </footer>
    </div>
  );
}
```

#### Step 2.6.2: Update PlaygroundWorkspace

**File:** `src/components/prompts/playground-workspace.tsx`

```tsx
// REPLACE EmptyState with EducationalPreview

import { EducationalPreview } from './educational-preview';

export default function PlaygroundWorkspace({ providers }: Props) {
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);

  // ... existing logic

  return (
    <div>
      {builderProvider ? (
        // Existing: Real prompt builder
        <PromptBuilder provider={builderProvider} providerSelector={providerSelectorElement} />
      ) : (
        // NEW: Educational preview instead of empty state
        <EducationalPreview onSelectProvider={handleProviderSelect} />
      )}
    </div>
  );
}
```

### 2.7 Files Summary

| File                                              | Change Type | Description                                   |
| ------------------------------------------------- | ----------- | --------------------------------------------- |
| `src/components/prompts/educational-preview.tsx`  | NEW         | 4-tier educational demo                       |
| `src/components/prompts/playground-workspace.tsx` | MODIFY      | Use EducationalPreview instead of EmptyState  |
| `src/types/prompt-builder.ts`                     | VERIFY      | Ensure CATEGORY_ORDER, CATEGORY_META exported |

### 2.8 Verification Steps

```powershell
# Run from: C:\Users\Proma\Projects\promagen\frontend

npm run build

# Manual testing:
# - [ ] Visit /studio/playground with no provider selected
# - [ ] See 12 category dropdowns in correct order
# - [ ] See Aspect Ratio selector
# - [ ] See 4-Tier Prompt Variants panel
# - [ ] All 4 tiers update live as selections change
# - [ ] Copy button works for each tier
# - [ ] Selecting provider transitions to real builder
# - [ ] Real builder works exactly as before
```

**Existing features preserved:** Yes

---

## Phase 3: Learn Page Intelligence Integration

### 3.1 Current State

**File:** `src/app/studio/learn/page.tsx`
**Component:** `src/components/prompts/learn/learn-client.tsx`

Current structure:

- Category-based guide cards
- Quick tips
- Static educational content

### 3.2 Target State

Same layout, but each category guide includes contextual intelligence:

- Conflict examples for that category
- Complement suggestions
- Mini DNA demos

### 3.3 Intelligence Context Component

**New file:** `src/components/prompts/learn/intelligence-context.tsx`

```typescript
interface IntelligenceContextProps {
  category: PromptCategory;
}

export function IntelligenceContext({ category }: Props) {
  // Load conflicts relevant to this category
  const categoryConflicts = useMemo(() =>
    getConflictsForCategory(category),
    [category]
  );

  // Load complement suggestions
  const categoryComplements = useMemo(() =>
    getComplementsForCategory(category),
    [category]
  );

  return (
    <div className="mt-4 p-4 rounded-xl bg-white/5 border border-white/10">
      <h4 className="text-sm font-semibold text-white/80 mb-3">
        🧠 Intelligence Insights
      </h4>

      {/* Conflicts */}
      {categoryConflicts.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-orange-400/70 mb-1">⚠️ Watch out for conflicts:</p>
          <div className="flex flex-wrap gap-2">
            {categoryConflicts.slice(0, 3).map((c, i) => (
              <span key={i} className="text-xs bg-orange-500/20 px-2 py-1 rounded">
                {c.term1} ↔ {c.term2}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Complements */}
      {categoryComplements.length > 0 && (
        <div>
          <p className="text-xs text-emerald-400/70 mb-1">✨ Pairs well with:</p>
          <div className="flex flex-wrap gap-1">
            {categoryComplements.slice(0, 5).map((term, i) => (
              <span key={i} className="text-xs bg-emerald-500/20 px-2 py-1 rounded">
                {term}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

### 3.4 Integration into Guide Cards

**File:** `src/components/prompts/learn/guide-card.tsx`

```tsx
// ADD import:
import { IntelligenceContext } from './intelligence-context';

// ADD to GuideCard render (at bottom of expanded content):
{
  isExpanded && (
    <>
      {/* Existing guide content */}
      {guide.content}

      {/* NEW: Intelligence context */}
      <IntelligenceContext category={guide.category} />
    </>
  );
}
```

### 3.5 Files Summary

| File                                                    | Change Type | Description                                                   |
| ------------------------------------------------------- | ----------- | ------------------------------------------------------------- |
| `src/components/prompts/learn/intelligence-context.tsx` | NEW         | Category-specific intelligence display                        |
| `src/components/prompts/learn/guide-card.tsx`           | MODIFY      | Add IntelligenceContext to expanded view                      |
| `src/lib/prompt-intelligence/index.ts`                  | MODIFY      | Export `getConflictsForCategory`, `getComplementsForCategory` |

### 3.6 Verification Steps

```powershell
# Manual testing:
# - [ ] Visit /studio/learn
# - [ ] Click on "Lighting" guide card
# - [ ] See "Intelligence Insights" section
# - [ ] Shows conflicts like "neon glow ↔ golden hour"
# - [ ] Shows complements like "rim lighting + dramatic shadows"
# - [ ] Layout unchanged from before
# - [ ] All existing guide content preserved
```

**Existing features preserved:** Yes

---

## Implementation Order

### Recommended Sequence

| Order | Phase                                 | Est. Time | Dependencies |
| ----- | ------------------------------------- | --------- | ------------ |
| 1     | Phase 1.3.1: Vocabulary Loader        | 0.5 day   | None         |
| 2     | Phase 1.3.2: Modify getCategoryConfig | 0.5 day   | 1.3.1        |
| 3     | Phase 1.3.3: Combobox chips           | 1 day     | 1.3.2        |
| 4     | Phase 1.3.4: Suggested section        | 0.5 day   | 1.3.3        |
| 5     | Phase 1.3.5: Intelligence wiring      | 1 day     | 1.3.4        |
| 6     | Phase 2: Educational Preview          | 2-3 days  | Phase 1      |
| 7     | Phase 3: Learn Page                   | 1-2 days  | Phase 1      |

**Total estimate:** 7-9 days

---

## Testing Checklist

### Regression Tests

Before marking complete, verify ALL existing features work:

| #   | Feature                         | Test                                               |
| --- | ------------------------------- | -------------------------------------------------- |
| 1   | 12-Category Dropdown System     | All 12 dropdowns render and function               |
| 2   | Platform-Aware Limits           | Tier 1 platforms allow more selections than Tier 4 |
| 3   | Aspect Ratio Selector           | All ratios selectable, affects prompt              |
| 4   | Composition Mode Toggle         | Static/Dynamic modes work                          |
| 5   | Text Length Optimizer           | Compresses long prompts correctly                  |
| 6   | Anonymous 5-Try Feature         | Unauthenticated users limited correctly            |
| 7   | Daily Usage Quotas              | Free users hit limit, pro users unlimited          |
| 8   | 5 Lock States                   | Lock UI appears correctly for each state           |
| 9   | 🎲 Randomise Button             | Fills all categories, respects limits              |
| 10  | Clear All Button                | Clears everything                                  |
| 11  | 42 Platform Adapters            | Each platform formats correctly                    |
| 12  | Negative-to-Positive Conversion | MJ --no format works                               |
| 13  | Custom Entry Support            | Free text accepted in all categories               |
| 14  | Copy Prompt                     | Copies to clipboard                                |
| 15  | Open in Provider                | Link opens correct platform                        |
| 16  | Pro Enhanced Limits             | Pro users get +1 on stackable categories           |
| 17  | Auto-Trim                       | Platform switch trims excess selections            |
| 18  | Length Indicator                | Shows character count correctly                    |

---

## Rollback Plan

If issues arise:

1. **Vocabulary Loader** → Revert to hardcoded arrays in `getCategoryConfig`
2. **Combobox changes** → Remove chip section, revert to original
3. **Educational Preview** → Switch back to `EmptyState` component
4. **Learn Intelligence** → Remove `IntelligenceContext` from guide cards

All changes are isolated and reversible.

---

## Changelog

- **21 Jan 2026 (v1.0.0):** Initial plan created
