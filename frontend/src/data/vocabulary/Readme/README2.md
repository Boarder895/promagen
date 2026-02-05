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
| **Total** | | **4,993** |

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
├── containers.json                   # Phase 9a ← NEW
├── rituals.json                      # Phase 9b ← NEW
├── night-operations.json             # Phase 9c ← NEW
├── index.ts
└── README.md
```

## Phase 9: Containers, Rituals, Night Operations (674 phrases)

### 9a: Containers (250 phrases)

#### Bulk Containers (40 phrases)
- **Maritime**: cargo hold cavernous, tanker hull curved, bulk carrier hatch...
- **Rail**: hopper car grain pouring, tank car cylindrical, boxcar sealed...
- **Road**: tanker truck sloshing, grain trailer pneumatic, flatbed strapped...
- **Fixed Storage**: silo towering concrete, tank farm clustered, warehouse vast...

#### Industrial Containers (30 phrases)
- **Processing**: reactor vessel pressurized, distillation column, fermentation tank...
- **Handling**: hopper bin funnel, conveyor bucket, screw conveyor auger...
- **Specialized**: crucible molten glowing, ladle pouring stream, ingot mold cooling...

#### Packaging (40 phrases)
- **Bags & Sacks**: burlap sack coarse, paper bag multi-wall, bulk bag FIBC...
- **Boxes & Crates**: wooden crate nailed, cardboard corrugated, shipping container steel...
- **Drums & Barrels**: oil drum 55 gallon, steel barrel ribbed, wine barrel oak...
- **Specialty**: gas cylinder pressurized, cryogenic dewar, isotank intermodal...

#### Traditional Containers (20 phrases)
- **Historical**: amphora clay two-handled, barrel cooper-made, chest iron-bound...
- **Regional**: sake barrel cedar, olive oil terracotta, tea caddy tin...

#### Container States (40 phrases)
- **Full**: brimming over capacity, packed tight no space, loaded heavy straining...
- **Empty**: hollow echoing sound, vacant awaiting cargo, drained residue only...
- **Damaged**: dented impact visible, rusted corrosion, leaking drip staining...
- **In Transit**: secured strapped tight, sealed tamper evident, labeled destination...

### 9b: Rituals (224 phrases)

#### Daily Rituals (40 phrases)
- **Market Opening**: bell ringing session start, traders gathering, screens flickering...
- **Market Closing**: final bell echoing, positions squaring, settlement price marking...
- **Shift Changes**: handover briefing overlap, logbook entries, safety briefing...
- **Quality Checks**: sample drawing routine, moisture meter testing, grade inspection...

#### Seasonal Rituals (30 phrases)
- **Planting Season**: soil blessing ceremony, first seed sowing, weather prayers...
- **Harvest Season**: first harvest celebration, thanksgiving feast, vintage celebration...
- **Trading Calendar**: contract rollover ritual, expiration day tension, year-end closing...

#### Professional Rituals (40 phrases)
- **Trading Floor**: jacket donning badge clipping, hand signal practice, lucky charm...
- **Warehouse**: morning walkthrough inspection, forklift pre-check, dock door opening...
- **Production**: machine startup sequence, calibration check, raw material inspection...
- **Shipping**: manifest preparation detailed, container sealing witnessed, bill of lading...

#### Cultural Rituals (30 phrases)
- **Commodity Specific**: coffee cupping ceremony, tea ceremony preparation, wine tasting...
- **Regional Traditions**: sake barrel breaking, olive oil blessing, cattle branding...
- **Superstitions**: lucky trading jacket, never count profits early, green color avoided...

#### Ceremonial Moments (20 phrases)
- **Milestones**: first cargo loading celebrated, millionth ton shipped, anniversary...
- **Memorials**: fallen worker remembered, disaster anniversary observed, pioneer honored...

### 9c: Night Operations (200 phrases)

#### Night Shift Work (40 phrases)
- **Industrial**: night shift skeleton crew, fluorescent hum, machine running unattended...
- **Logistics**: truck loading dock lit, forklift headlights, container yard floodlit...
- **Extraction**: drilling rig lit Christmas tree, mine headframe beacon, refinery flare...
- **Agriculture**: irrigation running overnight, greenhouse lights growing, frost protection...

#### 24/7 Trading (30 phrases)
- **Global Markets**: Asian session opening, European handoff, overnight gap risk...
- **Night Desk**: skeleton staff monitoring, overseas counterpart, position limit watching...
- **Physical Trading**: cargo tracking continuous, vessel position monitoring, weather routing...

#### Night Atmospheres (40 phrases)
- **Industrial Nocturne**: steam rising night air, sparks showering darkness, furnace glow...
- **Port Nocturne**: ship lights harbor reflected, gantry crane towering, container shadows...
- **Rural Nocturne**: grain elevator lit solitary, barn light warm, tractor headlights...
- **Urban Nocturne**: trading floor cleaning crew, office tower lights, delivery truck...

#### Night Sounds (30 phrases)
- **Industrial**: machinery humming constant, alarm distant, compressor cycling...
- **Natural**: crickets chorus constant, owl hunting, wind through structures...
- **Transport**: truck engine idling, train horn distant, ship horn fog...

#### Night Lighting (30 phrases)
- **Artificial**: sodium vapor orange glow, LED bright white, mercury vapor blue...
- **Natural**: moonlight silver casting, starlight faint, dawn light first grey...
- **Shadows**: equipment shadow long stretching, worker silhouette backlit, container canyon...

## Cross-Population Tags

Phase 9 phrases map to prompt categories:

| Source | Target Categories |
|--------|-------------------|
| Bulk containers | Environment, Subject |
| Industrial containers | Environment, Action |
| Packaging | Subject, Environment |
| Traditional containers | Subject, Atmosphere |
| Container states | Atmosphere, Subject |
| Daily rituals | Action, Subject, Atmosphere |
| Seasonal rituals | Atmosphere, Environment |
| Professional rituals | Action, Subject |
| Cultural rituals | Subject, Atmosphere |
| Night shift work | Subject, Environment |
| 24/7 trading | Atmosphere, Subject |
| Night atmospheres | Atmosphere, Lighting, Environment |
| Night sounds | Atmosphere, Environment |
| Night lighting | Lighting, Atmosphere |

## Usage

```typescript
import { 
  // Container helpers
  getAllBulkContainersPhrases,
  getAllIndustrialContainersPhrases,
  getAllPackagingPhrases,
  getAllTraditionalContainersPhrases,
  getAllContainerStatesPhrases,
  getAllContainersPhrases,
  
  // Ritual helpers
  getAllDailyRitualsPhrases,
  getAllSeasonalRitualsPhrases,
  getAllProfessionalRitualsPhrases,
  getAllCulturalRitualsPhrases,
  getAllCeremonialMomentsPhrases,
  getAllRitualsPhrases,
  
  // Night operation helpers
  getAllNightShiftWorkPhrases,
  getAll247TradingPhrases,
  getAllNightAtmospheresPhrases,
  getAllNightSoundsPhrases,
  getAllNightLightingPhrases,
  getAllNightOperationsPhrases,
  
  // Combined
  getAllPhase9Phrases,
  
  // Stats
  getVocabularyStats
} from './index';

// Get all container phrases (250 phrases)
const containers = getAllContainersPhrases();

// Get all ritual phrases (224 phrases)
const rituals = getAllRitualsPhrases();

// Get all night operation phrases (200 phrases)
const night = getAllNightOperationsPhrases();

// Get all Phase 9 (674 phrases)
const phase9 = getAllPhase9Phrases();

// Check totals
const stats = getVocabularyStats();
console.log(stats.grandTotal); // 4993
```

## Roadmap

| Phase | Focus | Est. Phrases |
|-------|-------|--------------|
| 10 | Shared Vocab Expansion + Cross-Population Merge | ~400 |

## Grand Total: 4,993 Phrases

Almost at 5,000 phrases! Phase 10 will complete the vocabulary system with shared vocabulary expansion and cross-population optimization.
