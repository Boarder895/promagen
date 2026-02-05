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
| 6 | Sensory + Human Stories | 556 |
| 7 | Weather-Commodity Links + Absence States | 600 |
| 8 | Historical Moments + Geopolitical | 500 |
| 9 | Containers, Rituals, Night Operations | 674 |
| 10a | Shared Vocab Expansion | 200 |
| **Total** | | **5,193** |

## 🎉 MILESTONE: 5,000+ Phrases!

## Files

```
frontend/src/data/vocabulary/commodities/
├── commodity-vibes.json              # Phase 1
├── transformation-states.json        # Phase 2
├── production-countries.json         # Phase 3
├── extraction-methods.json           # Phase 4a
├── end-use-sectors.json              # Phase 4b
├── trading-culture.json              # Phase 5a
├── price-states.json                 # Phase 5b
├── sensory-visual.json               # Phase 6.1
├── sensory-smell-taste.json          # Phase 6.2
├── sensory-touch-sound.json          # Phase 6.3
├── human-stories-workers.json        # Phase 6.4
├── human-stories-traders-consumers.json  # Phase 6.5
├── weather-commodity-links.json      # Phase 7a
├── absence-states.json               # Phase 7b
├── historical-moments.json           # Phase 8a
├── geopolitical.json                 # Phase 8b
├── containers.json                   # Phase 9a
├── rituals.json                      # Phase 9b
├── night-operations.json             # Phase 9c
├── shared-vocab-expansion.json       # Phase 10a ← NEW
├── index.ts
└── README.md
```

## Phase 10a: Shared Vocab Expansion (200 phrases)

Universal vocabulary applicable across ALL commodity types and contexts.

### Universal Actions (40 phrases)

| Category | Examples | Count |
|----------|----------|-------|
| Movement | lifting straining, carrying burden, pushing forward... | 10 |
| Transformation | breaking apart, combining merging, crushing force... | 10 |
| Inspection | examining closely, measuring precise, testing quality... | 10 |
| Communication | signaling gesture, shouting voice, pointing direction... | 10 |

### Universal States (40 phrases)

| Category | Examples | Count |
|----------|----------|-------|
| Quantity | abundant overflow, scarce shortage, depleted exhausted... | 10 |
| Quality | pristine untouched, degraded deteriorated, contaminated impure... | 10 |
| Time | fresh recently, aged matured, expired past prime... | 10 |
| Condition | stable unchanged, volatile fluctuating, critical urgent... | 10 |

### Universal Environments (30 phrases)

| Category | Examples | Count |
|----------|----------|-------|
| Scale | massive overwhelming, intimate small, sprawling expansive... | 10 |
| Condition | pristine maintained, weathered worn, abandoned neglected... | 10 |
| Access | restricted limited, secured protected, hazardous dangerous... | 10 |

### Universal Atmospheres (30 phrases)

| Category | Examples | Count |
|----------|----------|-------|
| Tension | anticipation building, uncertainty doubt, urgency pressure... | 10 |
| Energy | frenetic fast, sluggish slow, explosive sudden... | 10 |
| Mood | optimistic hopeful, pessimistic gloomy, determined resolute... | 10 |

### Universal Lighting (30 phrases)

| Category | Examples | Count |
|----------|----------|-------|
| Quality | harsh bright intense, soft diffused, dramatic contrast... | 10 |
| Direction | overhead downward, side angled, backlit silhouette... | 10 |
| Color Temperature | warm golden orange, cool blue white, fire flame dancing... | 10 |

### Universal Subjects (30 phrases)

| Category | Examples | Count |
|----------|----------|-------|
| Body Language | stance wide stable, posture bent working, gesture expressive... | 10 |
| Interaction | collaboration teamwork, isolation alone, supervision watching... | 10 |
| Attire | protective gear safety, uniform standard, weathered worn... | 10 |

## Cross-Population Tags

Phase 10a phrases map to ALL prompt categories:

| Source | Target Categories |
|--------|-------------------|
| Universal Actions | Action, Subject |
| Universal States | Atmosphere, Environment |
| Universal Environments | Environment, Atmosphere |
| Universal Atmospheres | Atmosphere, Lighting |
| Universal Lighting | Lighting, Atmosphere |
| Universal Subjects | Subject, Action |

## Usage

```typescript
import { 
  // Universal Action helpers
  getMovementActionsPhrases,
  getTransformationActionsPhrases,
  getInspectionActionsPhrases,
  getCommunicationActionsPhrases,
  getAllUniversalActionsPhrases,
  
  // Universal State helpers
  getQuantityStatesPhrases,
  getQualityStatesPhrases,
  getTimeStatesPhrases,
  getConditionStatesPhrases,
  getAllUniversalStatesPhrases,
  
  // Universal Environment helpers
  getScaleEnvironmentsPhrases,
  getConditionEnvironmentsPhrases,
  getAccessEnvironmentsPhrases,
  getAllUniversalEnvironmentsPhrases,
  
  // Universal Atmosphere helpers
  getTensionAtmospheresPhrases,
  getEnergyAtmospheresPhrases,
  getMoodAtmospheresPhrases,
  getAllUniversalAtmospheresPhrases,
  
  // Universal Lighting helpers
  getQualityLightingPhrases,
  getDirectionLightingPhrases,
  getColorTemperatureLightingPhrases,
  getAllUniversalLightingPhrases,
  
  // Universal Subject helpers
  getBodyLanguagePhrases,
  getInteractionPhrases,
  getAttirePhrases,
  getAllUniversalSubjectsPhrases,
  
  // Combined
  getAllSharedVocabExpansionPhrases,
  
  // Cross-population
  getSharedForActionCategory,
  getSharedForSubjectCategory,
  getSharedForEnvironmentCategory,
  getSharedForAtmosphereCategory,
  getSharedForLightingCategory,
  
  // Stats
  getVocabularyStats
} from './index';

// Get all shared vocab phrases (200 phrases)
const shared = getAllSharedVocabExpansionPhrases();

// Get universal phrases for specific category
const actionPhrases = getSharedForActionCategory();

// Check totals
const stats = getVocabularyStats();
console.log(stats.grandTotal); // 5193
```

## Roadmap

| Phase | Focus | Est. Phrases |
|-------|-------|--------------|
| 10b | Cross-Population Merge | ~200 |

## Grand Total: 5,193 Phrases

Phase 10b will finalize the vocabulary system with cross-population optimization and merge utilities.
