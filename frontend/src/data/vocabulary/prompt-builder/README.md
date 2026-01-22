# Prompt Builder Vocabulary Layer

> **Phase 2 of Promagen Vocabulary Extraction**
> 
> 12 categories × 300 options = **3,600 total terms** (3× expansion)

## Overview

This vocabulary layer provides a centralized, maintainable source of truth for all prompt builder terms. Instead of embedding thousands of options directly in React components, they're now stored in structured JSON files with full TypeScript support.

## Statistics

| Category | Options | Description |
|----------|---------|-------------|
| `subject` | 300 | Main focus - who/what |
| `action` | 300 | Poses, activities, movements |
| `style` | 300 | Art styles, rendering approaches |
| `environment` | 300 | Locations, settings, backgrounds |
| `composition` | 300 | Framing, perspective, arrangement |
| `camera` | 300 | Angles, lenses, photographic techniques |
| `lighting` | 300 | Light sources, quality, techniques |
| `atmosphere` | 300 | Mood, emotional tone, effects |
| `colour` | 300 | Palettes, schemes, treatments |
| `materials` | 300 | Textures, surfaces, finishes |
| `fidelity` | 300 | Quality, detail, resolution |
| `negative` | 300 | Elements to avoid |
| **TOTAL** | **3,600** | **3× original vocabulary** |

## File Structure

```
src/data/vocabulary/prompt-builder/
├── README.md           # This file
├── index.ts            # TypeScript utilities & exports
├── subject.json        # 300 subject options
├── action.json         # 300 action/pose options
├── style.json          # 300 style options
├── environment.json    # 300 environment options
├── composition.json    # 300 composition options
├── camera.json         # 300 camera options
├── lighting.json       # 300 lighting options
├── atmosphere.json     # 300 atmosphere options
├── colour.json         # 300 colour options
├── materials.json      # 300 materials options
├── fidelity.json       # 300 fidelity options
└── negative.json       # 300 negative prompt options
```

## JSON Schema

Each file follows this structure:

```json
{
  "$schema": "./schemas/prompt-builder.schema.json",
  "version": "1.0.0",
  "meta": {
    "domain": "prompt-builder",
    "category": "subject",
    "label": "Subject",
    "description": "The main focus of the image",
    "tooltipGuidance": "Choose one clear subject...",
    "totalOptions": 300,
    "updated": "2026-01-21"
  },
  "options": ["", "option1", "option2", ...],
  "subcategories": {
    "people_portraits": ["option1", "option2"],
    "fantasy_characters": ["option3", "option4"]
  }
}
```

## Usage

### Basic Import

```typescript
import vocabulary, { 
  getOptions, 
  getRandomOption,
  buildPositivePrompt 
} from '@/data/vocabulary/prompt-builder';

// Get all subject options
const subjects = getOptions('subject');

// Get random style
const randomStyle = getRandomOption('style');

// Build prompt from selections
const prompt = buildPositivePrompt({
  subject: 'portrait of a woman',
  style: 'oil painting',
  lighting: 'golden hour',
  fidelity: 'highly detailed'
});
// Result: "portrait of a woman, oil painting, golden hour, highly detailed"
```

### Get Category Metadata

```typescript
import { getCategoryMeta, getAllCategoryMeta } from '@/data/vocabulary/prompt-builder';

const subjectMeta = getCategoryMeta('subject');
// { key: 'subject', label: 'Subject', description: '...', totalOptions: 300 }

const allMeta = getAllCategoryMeta();
// Array of all 12 category metadata objects
```

### Search Across Categories

```typescript
import { searchOptions } from '@/data/vocabulary/prompt-builder';

const results = searchOptions('dragon');
// [{ category: 'subject', option: 'dragon' }, ...]
```

### Generate Random Prompt

```typescript
import { generateRandomPrompt, buildPositivePrompt } from '@/data/vocabulary/prompt-builder';

const selections = generateRandomPrompt(
  ['subject', 'style', 'lighting', 'atmosphere', 'fidelity'],
  12345 // optional seed for reproducibility
);

const prompt = buildPositivePrompt(selections);
```

### Access Subcategories

```typescript
import { getSubcategories, getSubcategoryOptions } from '@/data/vocabulary/prompt-builder';

const subcats = getSubcategories('subject');
// ['people_portraits', 'fantasy_characters', 'scifi_characters', ...]

const fantasy = getSubcategoryOptions('subject', 'fantasy_characters');
// ['knight in armour', 'wizard', 'dragon', ...]
```

## Integration with Existing Prompt Builder

Replace direct option arrays with vocabulary imports:

```tsx
// BEFORE (in prompt-builder component)
const styleOptions = ['oil painting', 'watercolor', ...]; // 100 items

// AFTER
import { getOptions } from '@/data/vocabulary/prompt-builder';
const styleOptions = getOptions('style'); // 300 items from JSON
```

## Adding New Options

1. Open the relevant JSON file (e.g., `style.json`)
2. Add new options to the `options` array
3. Optionally add to a subcategory
4. Update `totalOptions` in meta
5. Run `npm run typecheck` to verify

## Quality Guidelines

- **No duplicates** within a category
- **No emoji** in option text
- **Consistent formatting**: lowercase, descriptive
- **Meaningful subcategories**: group related options
- **Test with AI**: verify options produce good results

## Changelog

### v1.0.0 (2026-01-21)
- Initial 3× expansion: 3,600 total options
- 12 categories fully populated
- TypeScript utilities for prompt generation
- Subcategory organization for each category
