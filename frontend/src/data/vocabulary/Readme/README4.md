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
| **Total** | | **3,819** |

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
├── weather-commodity-links.json      # Phase 7a ← NEW
├── absence-states.json               # Phase 7b ← NEW
├── index.ts
└── README.md
```

## Phase 7: Weather-Commodity Links + Absence States (600 phrases)

### 7a: Weather-Commodity Links (320 phrases)

#### Drought (30 phrases)
- **Visual States**: cracked earth, withered crops, dust bowl swirling...
- **Commodity Impacts**: grain harvest failure, coffee cherries dropping...
- **Market Reactions**: futures spiking drought premium, crop insurance claims...

#### Flood (30 phrases)
- **Visual States**: fields submerged, warehouse sandbags, mudslide blocked...
- **Commodity Impacts**: grain quality degraded, cotton bales damaged...
- **Market Reactions**: quality spreads widening, delivery delays cascading...

#### Frost/Freeze (30 phrases)
- **Visual States**: orange groves frost blankets, ice crystals damage...
- **Commodity Impacts**: citrus devastation, coffee trees frost damage...
- **Market Reactions**: orange juice futures limit up, import demand emergency...

#### Heat Wave (30 phrases)
- **Visual States**: heat shimmer fields, livestock panting shade...
- **Commodity Impacts**: grain protein dropping, milk production declining...
- **Market Reactions**: electricity prices spiking, protein premiums adjusting...

#### Storm/Hurricane (30 phrases)
- **Visual States**: hurricane eye satellite, waves crashing platforms...
- **Commodity Impacts**: offshore production shut-in, refinery halted...
- **Market Reactions**: crude oil refinery premium, gasoline crack spread...

#### Monsoon (30 phrases)
- **Visual States**: monsoon clouds gathering, first rains celebration...
- **Commodity Impacts**: rice planting window critical, cotton sowing...
- **Market Reactions**: weather premium building, planting progress monitored...

#### Seasonal Transitions (40 phrases)
- **Spring Planting**: fields awakening thaw, tractors preparing seedbed...
- **Summer Growing**: crops knee high, irrigation pivots rotating...
- **Fall Harvest**: combines rolling, grain trucks queuing...
- **Winter Dormancy**: fields snow covered, storage bins full waiting...

#### Climate Phenomena (30 phrases)
- **El Niño**: Pacific warming pattern, Australian drought expected...
- **La Niña**: Pacific cooling pattern, opposite effect preparing...
- **Polar Vortex**: arctic blast descending, extreme cold warning...

### 7b: Absence States (280 phrases)

#### Empty Storage (40 phrases)
- **Warehouses**: warehouse floor empty vast, shelves bare dusty...
- **Silos/Tanks**: silo interior hollow dark, tank gauge empty...
- **Stockpiles**: stockpile footprint bare, where mountains stood flat...
- **Cold Storage**: freezer shelves empty frosted, cooling units running pointless...

#### Depleted Sources (40 phrases)
- **Mines/Quarries**: mine shaft abandoned dark, open pit exhausted...
- **Wells/Reservoirs**: oil well pump dry, pressure gauge zero...
- **Fields/Orchards**: fallow field stubble only, orchard stumps pulled...
- **Fishing Grounds**: harbor boats tied idle, nets hanging pointless...

#### Supply Chain Gaps (30 phrases)
- **Transportation**: trucks parked lot full, ships anchored waiting...
- **Processing**: refinery units idle cold, mill stones stopped...
- **Retail**: supermarket shelves empty, rationing signs posted...

#### Market Absence (30 phrases)
- **Trading Floor**: pit empty traders gone, screens no bids...
- **Price Discovery**: no offers available, bid wanted desperate...
- **Counterparty**: supplier defaulted gone, buyer disappeared bankrupt...

#### Human Absence (30 phrases)
- **Workforce**: factory floor empty machines, shift change no one...
- **Expertise**: retired expert knowledge gone, tribal knowledge lost...
- **Community**: company town emptying out, school enrollment dropping...

#### Environmental Absence (20 phrases)
- **Resource Depletion**: aquifer critical low, topsoil eroded bare...
- **Climate Impact**: glacier retreated exposed, snowpack absent crisis...

#### Visual Emptiness (30 phrases)
- **Light/Shadow**: empty space shadow pooling, single bulb vast darkness...
- **Atmospheric**: dust motes floating still, echo suggesting void...
- **Decay/Neglect**: rust spreading unchecked, paint peeling weathered...

## Cross-Population Tags

Phase 7 phrases map to prompt categories:

| Source | Target Categories |
|--------|-------------------|
| Weather visual states | Environment, Atmosphere |
| Weather commodity impacts | Environment, Subject |
| Weather market reactions | Atmosphere |
| Seasonal transitions | Environment, Atmosphere |
| Climate phenomena | Atmosphere, Environment |
| Empty storage | Environment, Atmosphere |
| Depleted sources | Environment, Atmosphere |
| Supply chain gaps | Environment, Subject |
| Market absence | Atmosphere, Environment |
| Human absence | Subject, Atmosphere |
| Visual emptiness | Lighting, Atmosphere |

## Usage

```typescript
import { 
  // Weather helpers
  getAllDroughtPhrases,
  getAllFloodPhrases,
  getAllFrostFreezePhrases,
  getAllHeatWavePhrases,
  getAllStormHurricanePhrases,
  getAllMonsoonPhrases,
  getAllSeasonalTransitionPhrases,
  getAllClimatePhenomenaPhrases,
  getAllWeatherCommodityPhrases,
  
  // Absence helpers
  getAllEmptyStoragePhrases,
  getAllDepletedSourcesPhrases,
  getAllSupplyChainGapsPhrases,
  getAllMarketAbsencePhrases,
  getAllHumanAbsencePhrases,
  getAllEnvironmentalAbsencePhrases,
  getAllVisualEmptinessPhrases,
  getAllAbsenceStatesPhrases,
  
  // Combined
  getAllPhase7Phrases,
  
  // Stats
  getVocabularyStats
} from './index';

// Get all weather phrases (320 phrases)
const weather = getAllWeatherCommodityPhrases();

// Get all absence phrases (280 phrases)
const absence = getAllAbsenceStatesPhrases();

// Get all Phase 7 (600 phrases)
const phase7 = getAllPhase7Phrases();

// Check totals
const stats = getVocabularyStats();
console.log(stats.grandTotal); // 3819
```

## Roadmap

| Phase | Focus | Est. Phrases |
|-------|-------|--------------|
| 8 | Historical Moments + Geopolitical | ~500 |
| 9 | Containers, Rituals, Night Operations | ~674 |
| 10 | Shared Vocab Expansion + Cross-Population Merge | ~400 |
