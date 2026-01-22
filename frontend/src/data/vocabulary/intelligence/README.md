# Intelligence Layer

> **Cross-cutting intelligence for smart prompt generation**
> 
> Makes prompts context-aware with conflict detection, style families, market moods, and platform optimization.

## Overview

The Intelligence Layer provides the "brain" behind prompt generation - understanding relationships between terms, detecting conflicts, mapping market conditions to visual moods, and optimizing prompts for different AI platforms.

## Files

| File | Purpose | Data Points |
|------|---------|-------------|
| `conflicts.json` | Incompatible term pairs | 85 conflict groups |
| `families.json` | Style families & members | 45 families |
| `semantic-tags.json` | Categorization metadata | 180 tags |
| `market-moods.json` | Market → mood mappings | 60 mappings |
| `platform-hints.json` | AI platform syntax guides | 15 platforms |

## Usage

### Conflict Detection

```typescript
import { checkConflict, findConflicts, getConflictsFor } from '@/data/vocabulary/intelligence';

// Check if two terms conflict
const conflict = checkConflict('vintage', 'cyberpunk');
if (conflict) {
  console.log(`Warning: ${conflict.reason}`);
  console.log(`Severity: ${conflict.severity}`);
}

// Check multiple terms at once
const issues = findConflicts(['photorealistic', 'cartoon', 'anime']);
// Returns array of { term1, term2, conflict }

// Get all terms that conflict with one
const avoid = getConflictsFor('minimalist');
// ['maximalist', 'ornate', 'baroque', 'busy', 'cluttered', ...]
```

### Style Families

```typescript
import { findFamilyFor, getRelatedStyles, getCompatibleStyles } from '@/data/vocabulary/intelligence';

// Find the family a style belongs to
const family = findFamilyFor('monet style');
// { id: 'impressionism', name: 'Impressionism Family', members: [...] }

// Get related styles
const related = getRelatedStyles('oil painting');
// ['acrylic painting', 'watercolor', 'gouache', ...]

// Get styles that work well together
const compatible = getCompatibleStyles('cyberpunk');
// ['neon lighting', 'rain', 'night scenes', 'urban environment', ...]
```

### Market Moods (Promagen-specific)

```typescript
import { getMarketMood, getMoodForChange, getSectorAesthetic } from '@/data/vocabulary/intelligence';

// Get visual mood for market state
const bullish = getMarketMood('bullish');
// {
//   moodSuggestions: { primary: ['triumphant', 'ascending', ...], ... },
//   colorPalette: { dominant: ['gold', 'green', ...], ... },
//   lightingSuggestions: ['golden hour', 'bright sunlight', ...],
//   ...
// }

// Get intensity for percentage change
const mood = getMoodForChange(7.5);
// { intensityLevel: 8, moodIntensifier: ['powerful', 'surging', ...], ... }

// Get sector-specific aesthetics
const techMood = getSectorAesthetic('tech');
// { aestheticLean: ['futuristic', 'digital', ...], colorInfluence: ['electric blue', ...] }
```

### Platform Optimization

```typescript
import { getPlatform, formatPromptForPlatform, getTierOptimization } from '@/data/vocabulary/intelligence';

// Get platform configuration
const mj = getPlatform('midjourney');
// { tier: 'paid', promptStyle: 'natural', syntax: {...}, bestPractices: [...] }

// Transform prompt for platform
const sdPrompt = formatPromptForPlatform(basePrompt, 'stable-diffusion');
// Applies platform-specific term transforms

// Get tier-wide advice
const freeAdvice = getTierOptimization('free');
// { promptStrategy: '...', recommendedTerms: [...], avoidTerms: [...] }
```

## Conflict Severity Levels

| Level | Meaning | Action |
|-------|---------|--------|
| `critical` | Never combine - produces nonsense | Block/Remove |
| `high` | Creates confusion or contradiction | Strong warning |
| `medium` | May work with skill | Soft warning |
| `low` | Fine with intentional contrast | Info only |

## Market States

The market-moods system maps financial conditions to visual suggestions:

- **Bullish** → Triumphant, golden, ascending
- **Bearish** → Dramatic, stormy, descending
- **Volatile** → Chaotic, electric, prismatic
- **Consolidating** → Contemplative, patient, coiled
- **Breakout** → Explosive, liberation, bursting
- **Recovery** → Hopeful, healing, spring
- **Euphoria** → Ecstatic, transcendent, golden palace
- **Capitulation** → Surrender, cleansing fire, transformation
- **Accumulation** → Strategic, gathering, vault
- **Distribution** → Dispersing, autumn, sunset

## Supported AI Platforms

| Platform | Tier | Prompt Style |
|----------|------|--------------|
| Stable Diffusion | Free | Technical |
| ComfyUI | Free | Technical |
| Bing Image Creator | Free | Conversational |
| Craiyon | Free | Simple |
| Leonardo.ai | Freemium | Technical |
| Playground | Freemium | Mixed |
| Ideogram | Freemium | Natural |
| Canva | Freemium | Simple |
| NightCafe | Freemium | Mixed |
| FLUX | Freemium | Technical |
| Midjourney | Paid | Natural |
| DALL·E | Paid | Conversational |
| Adobe Firefly | Paid | Conversational |
| DreamStudio | Paid | Technical |
| Google Imagen | Paid | Conversational |

## Integration Example

```typescript
import { findConflicts, getMarketMood, getPlatform, formatPromptForPlatform } from '@/data/vocabulary/intelligence';

function generateContextualPrompt(
  terms: string[],
  marketState: string,
  platformId: string
) {
  // 1. Check for conflicts
  const conflicts = findConflicts(terms);
  if (conflicts.length > 0) {
    console.warn('Conflicts detected:', conflicts);
  }
  
  // 2. Get market mood
  const mood = getMarketMood(marketState);
  const moodTerms = mood?.moodSuggestions.primary || [];
  
  // 3. Get platform config
  const platform = getPlatform(platformId);
  
  // 4. Build prompt
  let prompt = [...terms, ...moodTerms.slice(0, 2)].join(platform?.syntax.separator || ', ');
  
  // 5. Format for platform
  prompt = formatPromptForPlatform(prompt, platformId);
  
  return prompt;
}
```

## Changelog

### v1.0.0 (2026-01-21)
- Initial intelligence layer with 5 JSON files
- 85 conflict groups with severity levels
- 45 style families with member relationships
- 180 semantic tags for categorization
- 60 market-mood mappings (Promagen-specific)
- 15 AI platform configurations with syntax guides
- TypeScript utilities for all data access
