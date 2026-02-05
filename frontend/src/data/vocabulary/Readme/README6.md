# Commodity Vocabulary System

Comprehensive phrase library for commodity-related image generation prompts.

## Phase Summary

| Phase | Focus | Phrases |
|-------|-------|---------|
| 1 | Vibes | 936 |
| 2 | Transformations | 624 |
| 3 | Production Countries | 390 |
| 4 | Extraction + End-Use | 468 |
| 5 | Trading Culture + Price States | 245 |
| 6.1 | Visual Sensory | 120 |
| **Total** | | **2,783** |

## Phase 6 Breakdown (Sensory + Human Stories)

| Part | Focus | Phrases | Status |
|------|-------|---------|--------|
| 6.1 | Visual Sensory (colors, textures, appearances) | 120 | ✅ Complete |
| 6.2 | Smell & Taste Sensory (aromas, flavors) | ~108 | Pending |
| 6.3 | Touch & Sound Sensory (tactile, auditory) | ~108 | Pending |
| 6.4 | Human Stories - Workers & Laborers | ~108 | Pending |
| 6.5 | Human Stories - Traders, Consumers, Families | ~108 | Pending |

## Files

```
frontend/src/data/vocabulary/commodities/
├── commodity-vibes.json        # Phase 1: 78 commodities × 12 vibes
├── transformation-states.json  # Phase 2: 78 commodities × 8 stages
├── production-countries.json   # Phase 3: 78 commodities × 5 regions
├── extraction-methods.json     # Phase 4a: 78 commodities × 3 methods
├── end-use-sectors.json        # Phase 4b: 78 commodities × 3 sectors
├── trading-culture.json        # Phase 5a: Trading floor culture
├── price-states.json           # Phase 5b: Market price states
├── sensory-visual.json         # Phase 6.1: Colors, textures, appearances
├── index.ts                    # Exports + helpers
└── README.md
```

## Phase 6.1: Visual Sensory

### Colors (40 phrases)
- **Metallic**: molten gold, oxidized copper, brushed silver...
- **Organic Warm**: amber honey, caramel sugar, cinnamon bark...
- **Organic Cool**: olive oil jade, cotton boll cream, rice grain pearl...
- **Earth Tones**: crude oil obsidian, coal anthracite, iron ore russet...

### Textures (40 phrases)
- **Smooth**: polished ingot, liquid mercury, refined oil slick...
- **Rough**: raw ore jagged, unprocessed bark, natural fiber coarse...
- **Granular**: sugar sand fine, coffee ground, grain dust suspended...
- **Fibrous**: cotton strand, wool fiber, silk thread lustrous...

### Appearances (40 phrases)
- **Commodity States**: raw bulk, refined stacked, bagged palletized...
- **Light Interaction**: warehouse light, shadow pooling, dust motes...
- **Movement Visual**: conveyor flowing, crane swinging, chute cascading...
- **Scale Perspective**: macro detail, aerial view, industrial magnitude...

## Cross-Population Tags

Phase 6.1 phrases map to prompt categories:

| Source | Target Categories |
|--------|-------------------|
| colors.metallic | Lighting, Atmosphere |
| colors.organic_warm | Atmosphere, Environment |
| colors.organic_cool | Environment, Atmosphere |
| colors.earth_tones | Environment, Atmosphere |
| textures.smooth | Subject, Environment |
| textures.rough | Environment, Atmosphere |
| textures.granular | Atmosphere, Environment |
| textures.fibrous | Subject, Environment |
| appearances.commodity_states | Environment, Subject |
| appearances.light_interaction | Lighting, Atmosphere |
| appearances.movement_visual | Action, Environment |
| appearances.scale_perspective | Environment, Atmosphere |

## Usage

```typescript
import { 
  getAllColors,
  getAllTextures,
  getAllAppearances,
  getAllVisualSensoryPhrases,
  getVisualForAtmosphereCategory,
  getVisualForEnvironmentCategory,
  getVocabularyStats
} from './index';

// Get all 40 color phrases
const colors = getAllColors();

// Get visual phrases for Atmosphere prompts
const atmospherePhrases = getVisualForAtmosphereCategory();

// Check totals
const stats = getVocabularyStats();
console.log(stats.grandTotal); // 2783
```

## Roadmap

| Phase | Focus | Est. Phrases |
|-------|-------|--------------|
| 6.2-6.5 | Remaining Sensory + Human Stories | ~432 |
| 7 | Weather-Commodity Links + Absence States | ~600 |
| 8 | Historical Moments + Geopolitical | ~500 |
| 9 | Containers, Rituals, Night Operations | ~674 |
| 10 | Shared Vocab Expansion + Cross-Population Merge | ~400 |
