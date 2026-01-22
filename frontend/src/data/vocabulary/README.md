# Promagen Vocabulary Layer

> **Single Source of Truth** for all creative terminology in Promagen

## Overview

This directory contains all vocabulary data used across Promagen for:
- Weather-driven prompts
- Prompt builder categories
- Prompt intelligence (conflicts, families, moods)
- Shared descriptive terms

## Directory Structure

```
vocabulary/
├── index.ts                    # Re-exports + helper functions
├── README.md                   # This file
│
├── weather/                    # Weather-driven prompt vocabulary
│   ├── temperature.json        # 61 values × 60 phrases = 3,660
│   ├── humidity.json           # 101 values × 10 phrases = 1,010
│   ├── wind.json               # 101 values × 8 phrases = 808
│   ├── time-of-day.json        # 48 slots × 10 phrases = 480
│   ├── conditions.json         # 15 types × 20 phrases = 300
│   └── city-vibes.json         # 60+ cities × 10 vibes = 600+
│
├── prompt-builder/             # 12 prompt builder categories
│   ├── subject.json            # 200+ options
│   ├── action.json             # 200+ options
│   ├── style.json              # 200+ options
│   ├── environment.json        # 200+ options
│   ├── composition.json        # 200+ options
│   ├── camera.json             # 200+ options
│   ├── lighting.json           # 200+ options
│   ├── atmosphere.json         # 200+ options
│   ├── colour.json             # 200+ options
│   ├── materials.json          # 200+ options
│   ├── fidelity.json           # 200+ options
│   └── negative.json           # 400+ options
│
├── intelligence/               # Cross-cutting intelligence data
│   ├── conflicts.json          # Term conflicts (vintage ↔ cyberpunk)
│   ├── families.json           # Style families + members
│   ├── semantic-tags.json      # Categorization metadata
│   ├── market-moods.json       # Market state → mood mappings
│   └── platform-hints.json     # Tier-specific syntax hints
│
└── shared/                     # Reusable across domains
    ├── adjectives.json         # Common descriptive words
    ├── intensifiers.json       # "extremely", "slightly", "very"
    └── connectors.json         # "with", "featuring", "in the style of"
```

## JSON Schema Convention

All vocabulary files follow this structure:

```json
{
  "$schema": "./schemas/{category}.schema.json",
  "version": "1.0.0",
  "meta": {
    "domain": "weather | prompt-builder | intelligence | shared",
    "category": "temperature | humidity | style | etc",
    "totalPhrases": 3660,
    "description": "What this vocabulary is for",
    "updated": "2026-01-21"
  },
  "phrases": {
    // Key → array of phrases
  },
  "contextual": {
    // Optional: context-specific variations
  }
}
```

## Usage

```typescript
import { getWeatherPhrase, getPromptBuilderOption } from '@/data/vocabulary';

// Weather vocabulary
const tempPhrase = getWeatherPhrase('temperature', 25);
const windPhrase = getWeatherPhrase('wind', 15, { isStormy: true });

// Prompt builder vocabulary
const styles = getPromptBuilderOption('style');
const randomStyle = getRandomOption('style');
```

## Contributing

### Adding New Phrases

1. Edit the relevant JSON file
2. Add phrases to the appropriate key
3. Update the `totalPhrases` count in meta
4. Run `pnpm test:vocabulary` to validate

### Phrase Guidelines

- **No emojis** in weather vocabulary (replaced with descriptive text)
- **Evocative language** - phrases should paint a picture
- **Platform-agnostic** - works across all AI platforms
- **Consistent length** - similar word counts within categories
- **No duplication** - unique phrases only

### Quality Standards

| Aspect | Requirement |
|--------|-------------|
| Length | 2-5 words per phrase |
| Tone | Evocative, atmospheric |
| Duplication | None within category |
| Specificity | Descriptive, not generic |

## Version History

- **v1.0.0** (2026-01-21): Initial extraction from weather-prompt-generator.ts with 2× phrase expansion

## Authority

- Docs: `docs/authority/vocabulary-layer.md`
- Weather prompts: `docs/authority/ai_providers.md §4-Tier Prompt System`
