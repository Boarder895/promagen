# Vocabulary Loader Integration Guide

**Phase 1.3.1 Complete** | Created: 21 January 2026

---

## What's Included

```
src/lib/vocabulary/
└── vocabulary-loader.ts    # NEW - Main vocabulary loader
```

## Installation Steps

### Step 1: Create Directory

```powershell
# Run from: C:\Users\Proma\Projects\promagen\frontend
New-Item -ItemType Directory -Path "src\lib\vocabulary" -Force
```

### Step 2: Copy File

Copy `vocabulary-loader.ts` to `src/lib/vocabulary/`

### Step 3: Verify Imports Work

The loader imports from existing files:
- `@/data/vocabulary/prompt-builder` ✓ (already exists)
- `@/data/vocabulary/intelligence/families.json` ✓ (already exists)

---

## How It Works

### Before (hardcoded ~100 options):
```typescript
// src/lib/prompt-builder.ts
export function getCategoryOptions(category: PromptCategory): string[] {
  return promptOptions.categories[category]?.options ?? [];
}
```

### After (vocabulary-driven, context-aware):
```typescript
import { loadCategoryVocabulary } from '@/lib/vocabulary/vocabulary-loader';

export function getCategoryOptions(category: PromptCategory): string[] {
  const vocab = loadCategoryVocabulary(category as CategoryKey);
  return vocab.dropdownOptions; // Top 100
}

// For chips display (all options)
export function getAllCategoryOptions(category: PromptCategory): string[] {
  const vocab = loadCategoryVocabulary(category as CategoryKey);
  return vocab.allOptions; // Full ~300
}

// For intelligent suggestions
export function getCategorySuggestions(
  category: PromptCategory,
  context: VocabularyContext
): string[] {
  const vocab = loadCategoryVocabulary(category as CategoryKey, context);
  return vocab.suggestionPool; // Top 20 context-aware
}
```

---

## Key Features

### 1. Dropdown Limit (100 options)
```typescript
const vocab = loadCategoryVocabulary('style');
vocab.dropdownOptions.length; // 100 (capped)
vocab.allOptions.length;      // ~300 (full list)
```

### 2. Context-Aware Sorting
```typescript
// Without context - default order
const basic = loadCategoryVocabulary('lighting');

// With context - intelligent sorting
const smart = loadCategoryVocabulary('lighting', {
  selectedTerms: ['cyberpunk', 'neon aesthetic'],
  dominantFamily: 'cyberpunk',  // Auto-detected or explicit
  marketMood: 'bullish',        // From market data
});
// smart.suggestionPool prioritises: neon glow, dramatic lighting, etc.
```

### 3. Family Detection
```typescript
import { detectDominantFamily } from '@/lib/vocabulary/vocabulary-loader';

const family = detectDominantFamily(['cyberpunk', 'neon lights', 'futuristic']);
// Returns: 'cyberpunk'

const family2 = detectDominantFamily(['impressionist', 'golden hour']);
// Returns: 'impressionism'
```

### 4. Chip Display (Performance-Limited)
```typescript
import { getChipDisplayOptions } from '@/lib/vocabulary/vocabulary-loader';

// Get chips excluding already selected, limited to 50
const chips = getChipDisplayOptions('style', ['cyberpunk'], 'neo');
// Returns terms containing 'neo', excluding 'cyberpunk', max 50
```

### 5. Search with Match Types
```typescript
import { searchCategoryVocabulary } from '@/lib/vocabulary/vocabulary-loader';

const results = searchCategoryVocabulary('style', 'cyber');
// Returns: [
//   { term: 'cyberpunk', matchType: 'startsWith' },
//   { term: 'biopunk', matchType: 'contains' },
//   ...
// ]
```

---

## Verification Steps

```powershell
# Run from: C:\Users\Proma\Projects\promagen\frontend

# 1. TypeScript check
npx tsc --noEmit

# 2. Lint
npm run lint

# 3. Build
npm run build
```

### Expected Outcomes
- ✅ No TypeScript errors
- ✅ Import paths resolve correctly
- ✅ Build succeeds

---

## Next Phase

**Phase 1.3.2:** Update `getCategoryConfig()` in `src/lib/prompt-builder.ts` to use the vocabulary loader instead of hardcoded prompt-options.json.

---

## API Reference

### `loadCategoryVocabulary(category, context?)`

| Param | Type | Description |
|-------|------|-------------|
| category | `CategoryKey` | One of: subject, action, style, environment, composition, camera, lighting, atmosphere, colour, materials, fidelity, negative |
| context | `VocabularyContext` | Optional. Contains: selectedTerms, dominantFamily, platformTier, marketMood |

**Returns:** `CategoryVocabulary`
```typescript
{
  dropdownOptions: string[];   // Top 100 for dropdown
  allOptions: string[];        // All ~300 for chips
  suggestionPool: string[];    // Top 20 suggestions
  meta: {
    label: string;
    description: string;
    tooltipGuidance: string;
    totalAvailable: number;
  };
}
```

### `detectDominantFamily(selectedTerms)`

Detects the dominant style family from an array of selected terms.

**Returns:** `string | null` (family ID or null if no match)

### `getChipDisplayOptions(category, selectedTerms, searchQuery?)`

Gets filtered options for chip display, excluding already selected terms.

**Returns:** `string[]` (max 50 items)

### `searchCategoryVocabulary(category, query)`

Searches vocabulary with match type indicators.

**Returns:** `Array<{ term: string; matchType: 'exact' | 'startsWith' | 'contains' }>`

---

**Existing features preserved:** Yes (no changes to existing files yet)
