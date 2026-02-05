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
| **Total** | | **3,219** |

## Phase 6 Complete Breakdown

| Part | Focus | Phrases | Status |
|------|-------|---------|--------|
| 6.1 | Visual Sensory (colors, textures, appearances) | 120 | ✅ Complete |
| 6.2 | Smell & Taste Sensory (aromas, flavors) | 108 | ✅ Complete |
| 6.3 | Touch & Sound Sensory (tactile, auditory) | 108 | ✅ Complete |
| 6.4 | Human Stories - Workers & Laborers | 110 | ✅ Complete |
| 6.5 | Human Stories - Traders, Consumers, Families | 110 | ✅ Complete |
| **Phase 6 Total** | | **556** | |

## Files

```
frontend/src/data/vocabulary/commodities/
├── commodity-vibes.json           # Phase 1: 78 commodities × 12 vibes
├── transformation-states.json     # Phase 2: 78 commodities × 8 stages
├── production-countries.json      # Phase 3: 78 commodities × 5 regions
├── extraction-methods.json        # Phase 4a: 78 commodities × 3 methods
├── end-use-sectors.json           # Phase 4b: 78 commodities × 3 sectors
├── trading-culture.json           # Phase 5a: Trading floor culture
├── price-states.json              # Phase 5b: Market price states
├── sensory-visual.json            # Phase 6.1: Colors, textures, appearances
├── sensory-smell-taste.json       # Phase 6.2: Aromas, flavors
├── sensory-touch-sound.json       # Phase 6.3: Tactile, auditory
├── human-stories-workers.json     # Phase 6.4: Workers & laborers
├── human-stories-traders-consumers.json  # Phase 6.5: Traders, consumers, families
├── index.ts                       # Exports + helpers
└── README.md
```

## Phase 6.1: Visual Sensory (120 phrases)

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

## Phase 6.2: Smell & Taste Sensory (108 phrases)

### Aromas (50 phrases)
- **Metallic Industrial**: hot metal tang, welding smoke, machine oil...
- **Agricultural Fresh**: fresh cut hay, rain on grain petrichor...
- **Roasted Processed**: coffee roasting, cocoa processing, caramelizing sugar...
- **Spice Exotic**: cinnamon bark warm, vanilla bean intoxicating...
- **Marine Petroleum**: crude oil sweet, tanker hold briny, bunker fuel...

### Flavors (58 phrases)
- **Sweet Profiles**: raw sugar crystalline, molasses deep, honey complex...
- **Bitter Profiles**: dark chocolate intense, raw cocoa astringent...
- **Umami Savory**: soy sauce depth, fermented bean, aged cheese...
- **Acid Fermented**: citrus zest bright, vinegar sharp, wine barrel...
- **Texture Mouthfeel**: oil coating smooth, grain grit, salt burst...

## Phase 6.3: Touch & Sound Sensory (108 phrases)

### Tactile (50 phrases)
- **Temperature**: molten metal searing, cold storage frozen, sun-warmed grain...
- **Weight Density**: lead ingot dense, cotton bale light bulk, gold bar heft...
- **Surface Feel**: raw ore rough, polished bar smooth, burlap coarse...
- **Pressure Resistance**: grain yield soft, metal unyielding, brittle shatter...
- **Moisture**: fresh harvest damp, kiln dried bone, humid warehouse sticky...

### Auditory (58 phrases)
- **Machinery**: conveyor humming, crane whining, compressor pulse...
- **Material Sounds**: grain pouring cascade, metal clanging, liquid sloshing...
- **Human Activity**: workers shouting, radio chatter, footsteps echo...
- **Ambient Environment**: rain on roof, wind through doors, ship horn harbor...
- **Trading Floor**: pit roar chaos, bell opening, ticker chatter...

## Phase 6.4: Human Stories - Workers (110 phrases)

### Worker Archetypes (40 phrases)
- **Agricultural**: weathered farmer, migrant picker, harvest crew...
- **Industrial**: foundry worker, crane operator, forklift driver...
- **Maritime**: longshoreman, ship captain, deck hand...
- **Extraction**: miner headlamp, driller roughneck, geologist sample...

### Labor Conditions (30 phrases)
- **Physical States**: sweat-soaked, dust-covered, calloused hands...
- **Work Rhythms**: pre-dawn shift, overtime hours, seasonal rush...
- **Safety Gear**: hard hat, steel-toe boots, high-vis vest...

### Human Moments (30 phrases)
- **Solidarity**: workers sharing lunch, union meeting, old hand teaching...
- **Personal**: family photo locker, phone call home, wedding ring worn...
- **Struggle**: wages barely enough, dangerous conditions, far from family...

## Phase 6.5: Human Stories - Traders/Consumers (110 phrases)

### Traders & Brokers (40 phrases)
- **Floor Traders**: pit trader signals, market maker, scalper quick...
- **Modern Traders**: algo trader monitoring, quant analyst, risk manager...
- **Physical Traders**: grain merchant handshake, oil trader cargo, metal dealer...
- **Emotional States**: euphoria big win, devastation blown, anxiety overnight...

### Consumers & End Users (30 phrases)
- **Retail Consumers**: shopper comparing, housewife budget, chef selecting...
- **Industrial Users**: factory purchasing, procurement manager, inventory controller...
- **Artisans Craftspeople**: chocolatier tempering, goldsmith crafting, weaver choosing...

### Families & Communities (40 phrases)
- **Producer Families**: farming family generations, mining town dependent...
- **Trading Families**: merchant dynasty centuries, trading house legacy...
- **Consumer Families**: kitchen table price worry, heating bill anxiety...
- **Community Impact**: boom town prosperity, bust town abandoned, port city...

## Cross-Population Tags

All Phase 6 phrases map to prompt categories:

| Source | Target Categories |
|--------|-------------------|
| Visual colors | Lighting, Atmosphere |
| Visual textures | Subject, Environment |
| Visual appearances | Environment, Action, Lighting |
| Aromas | Atmosphere, Environment |
| Flavors | Atmosphere, Subject |
| Tactile | Atmosphere, Subject, Action |
| Auditory | Environment, Atmosphere, Subject |
| Worker archetypes | Subject, Environment |
| Labor conditions | Subject, Atmosphere |
| Human moments | Subject, Atmosphere |
| Traders/brokers | Subject, Environment, Atmosphere |
| Consumers | Subject, Action |
| Families/communities | Subject, Environment, Atmosphere |

## Usage

```typescript
import { 
  // Phase 6.1 Visual
  getAllColors,
  getAllTextures,
  getAllAppearances,
  
  // Phase 6.2 Smell/Taste
  getAllAromas,
  getAllFlavors,
  
  // Phase 6.3 Touch/Sound
  getAllTactilePhrases,
  getAllAuditorySounds,
  
  // Phase 6.4 Workers
  getAllWorkerArchetypes,
  getAllLaborConditions,
  getAllHumanMoments,
  
  // Phase 6.5 Traders/Consumers
  getAllTradersBrokers,
  getAllConsumersEndUsers,
  getAllFamiliesCommunities,
  
  // Combined helpers
  getAllSensoryPhrases,
  getAllHumanStoriesPhrases,
  getAllPhase6Phrases,
  
  // Stats
  getVocabularyStats
} from './index';

// Get all sensory phrases (328 phrases)
const sensory = getAllSensoryPhrases();

// Get all human stories (220 phrases)
const humanStories = getAllHumanStoriesPhrases();

// Check totals
const stats = getVocabularyStats();
console.log(stats.grandTotal); // 3219
```

## Roadmap

| Phase | Focus | Est. Phrases |
|-------|-------|--------------|
| 7 | Weather-Commodity Links + Absence States | ~600 |
| 8 | Historical Moments + Geopolitical | ~500 |
| 9 | Containers, Rituals, Night Operations | ~674 |
| 10 | Shared Vocab Expansion + Cross-Population Merge | ~400 |
