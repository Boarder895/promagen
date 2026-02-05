# Commodities Vocabulary System

## Complete Phase 1-10 Documentation

**Total Phrases: 5,393**  
**Version: 1.0.0**  
**Last Updated: 2025-02-05**

---

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
| 10 | Shared Vocab + Cross-Population Merge | 400 |
| **Total** | | **5,393** |

---

## Phase 10: Shared Vocab + Cross-Population Merge

### Part 10a: Shared Vocab Expansion (200 phrases)

Universal vocabulary applicable across all commodity types:

| Category | Subcategories | Phrases |
|----------|---------------|---------|
| Market Mechanics | Order Flow, Execution, Settlement | 30 |
| Risk Language | Exposure, Hedging, Volatility | 25 |
| Quality Terms | Grades, Standards, Certification | 25 |
| Logistics | Shipping, Storage, Handling | 30 |
| Documentation | Contracts, Invoices, Certificates | 20 |
| Time Expressions | Delivery, Expiry, Rolling | 20 |
| Price Descriptors | Premium, Discount, Spread | 25 |
| Volume Metrics | Tonnage, Lots, Contracts | 25 |
| **Subtotal** | | **200** |

### Part 10b: Cross-Population Merge (200 phrases)

Bridging vocabulary connecting commodity categories:

#### Category Bridges (200 phrases)

| Bridge Type | Connection | Phrases |
|-------------|------------|---------|
| metalsToEnergy | Precious/industrial metals ↔ Energy | 20 |
| energyToAgriculture | Energy ↔ Agricultural products | 20 |
| agricultureToMetals | Agricultural ↔ Metals | 20 |
| softsToCurrencies | Soft commodities ↔ Currency flows | 20 |
| livestockToGrains | Livestock ↔ Grain commodities | 20 |
| preciousToIndustrial | Precious ↔ Industrial metals | 20 |
| tropicalToTemperate | Tropical ↔ Temperate zone | 20 |
| bulkToPrecision | Bulk commodities ↔ Precision materials | 20 |
| fossilToRenewable | Fossil fuels ↔ Renewables | 20 |
| landToSea | Terrestrial ↔ Marine commodities | 20 |
| **Subtotal** | | **200** |

#### Transition Phrases (40 phrases)

| Type | Description | Phrases |
|------|-------------|---------|
| temporalBridges | Different time periods/cycles | 10 |
| scaleBridges | Different scales of operation | 10 |
| processBridges | Stages of transformation | 10 |
| geographicBridges | Geographic zones | 10 |
| **Subtotal** | | **40** |

#### Unifying Concepts (20 phrases)

| Type | Description | Phrases |
|------|-------------|---------|
| universalPrinciples | Concepts across all categories | 10 |
| sharedVocabulary | Terms spanning categories | 10 |
| **Subtotal** | | **20** |

---

## Installation

```bash
frontend/src/data/vocabulary/commodities/
├── vibes-market-energy.json
├── vibes-physical.json
├── vibes-temporal.json
├── vibes-human.json
├── transformations-raw-to-refined.json
├── transformations-state-changes.json
├── transformations-value-chain.json
├── production-countries.json
├── extraction-methods.json
├── end-use-applications.json
├── trading-culture.json
├── price-states.json
├── sensory-visual.json
├── sensory-smell-taste.json
├── sensory-touch-sound.json
├── human-stories-workers.json
├── human-stories-traders-consumers.json
├── weather-commodity-links.json
├── absence-states.json
├── historical-moments.json
├── geopolitical.json
├── containers.json
├── rituals.json
├── night-operations.json
├── shared-vocab-expansion.json      ← Phase 10a
├── cross-population-merge.json      ← Phase 10b (NEW)
├── index.ts
└── README.md
```

---

## Usage Examples

### Get Bridge Phrases Between Categories

```typescript
import { getBridgePhrases } from '@/data/vocabulary/commodities';

// Get phrases linking metals and energy
const bridges = getBridgePhrases('metals', 'energy');
// Returns: ["copper wires carrying electrical current", ...]
```

### Get Random Cross-Population Phrase

```typescript
import { getRandomCrossPopulationPhrase } from '@/data/vocabulary/commodities';

const phrase = getRandomCrossPopulationPhrase();
// Returns: "corn becoming cattle weight"
```

### Get All Category Bridges

```typescript
import { getAllCategoryBridges } from '@/data/vocabulary/commodities';

const allBridges = getAllCategoryBridges();
// Returns: 200 phrases linking all category pairs
```

### Get Statistics

```typescript
import { getCrossPopulationStats, getGrandTotalStats } from '@/data/vocabulary/commodities';

const phase10Stats = getCrossPopulationStats();
// {
//   totalPhrases: 200,
//   categoryBridges: { count: 10, phrases: 200 },
//   transitionPhrases: { count: 4, phrases: 40 },
//   unifyingConcepts: { count: 2, phrases: 20 }
// }

const grandTotal = getGrandTotalStats();
// { grandTotal: 5393, ... }
```

---

## Available Bridge Types

| Bridge Key | Categories Connected |
|------------|---------------------|
| `metals-energy` | Metals ↔ Energy |
| `energy-agriculture` | Energy ↔ Agriculture |
| `agriculture-metals` | Agriculture ↔ Metals |
| `softs-currencies` | Soft Commodities ↔ Currencies |
| `livestock-grains` | Livestock ↔ Grains |
| `precious-industrial` | Precious ↔ Industrial Metals |
| `tropical-temperate` | Tropical ↔ Temperate Zone |
| `bulk-precision` | Bulk ↔ Precision Materials |
| `fossil-renewable` | Fossil Fuels ↔ Renewables |
| `land-sea` | Terrestrial ↔ Marine |

---

## Phase 10b Sample Phrases

### Metals to Energy
- "copper wires carrying electrical current"
- "platinum catalysts refining crude"
- "cobalt cells powering electric futures"

### Energy to Agriculture
- "diesel tractors turning spring soil"
- "natural gas becoming nitrogen fertilizer"
- "ethanol rising from corn fields"

### Fossil to Renewable
- "coal plants yielding to wind farms"
- "pipeline corridors becoming transmission routes"
- "refinery towns becoming battery hubs"

### Tropical to Temperate
- "coffee and wheat sharing breakfast tables"
- "cocoa and dairy merging in chocolate"
- "tropical fruit and temperate grain coexisting"

---

## Vocabulary System Complete

The commodities vocabulary system is now complete with **5,393 phrases** across 10 phases, providing comprehensive coverage for:

- Market dynamics and trading culture
- Physical commodity characteristics
- Geographic and temporal contexts
- Human stories and sensory experiences
- Historical and geopolitical dimensions
- Cross-category relationships and transitions

All phrases are designed for use in AI prompt engineering, commodity market narratives, and professional financial content generation.
