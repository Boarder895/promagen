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
| **Total** | | **4,319** |

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
├── historical-moments.json           # Phase 8a ← NEW
├── geopolitical.json                 # Phase 8b ← NEW
├── index.ts
└── README.md
```

## Phase 8: Historical Moments + Geopolitical (500 phrases)

### 8a: Historical Moments (250 phrases)

#### Trade Route Eras (40 phrases)
- **Silk Road**: camel caravan silk laden, oasis marketplace, mountain pass treacherous...
- **Spice Trade**: Portuguese carrack, Dutch East India warehouse, pepper worth gold...
- **Triangular Trade**: slave ship cargo, sugar plantation brutal, cotton fields endless...
- **Age of Sail**: clipper ship tea racing, whaling vessel, merchant marine cargo...

#### Industrial Revolution (40 phrases)
- **Coal Era**: coal mine pithead, steam engine pumping, canal barge laden...
- **Steel Age**: Bessemer converter molten, rolling mill thunder, skyscraper rising...
- **Oil Boom**: Drake well gusher, derrick forest, Standard Oil monopoly...
- **Electrification**: power plant dynamo, copper wire stringing, hydroelectric dam...

#### Market Crashes & Crises (40 phrases)
- **Tulip Mania**: tulip bulb auction frenzied, contract trading speculative, crash sudden...
- **Great Depression**: grain elevator full buyers none, farm foreclosure, dust bowl...
- **Oil Shocks**: OPEC embargo, gas station line, price quadrupling overnight...
- **2008 Crisis**: commodity spike collapse, hedge fund unwinding, liquidity evaporating...

#### Technological Shifts (40 phrases)
- **Green Revolution**: hybrid seed yield multiplying, fertilizer application, mechanization...
- **Containerization**: container ship revolution, standardized box global, shipping cost plummeting...
- **Digital Trading**: electronic trading pit replacing, algorithm speed, flash crash...
- **Renewable Transition**: solar panel spreading, wind turbine farm, coal plant closing...

#### Defining Moments (30 phrases)
- **Discoveries**: gold rush Sutter's Mill, diamond Kimberley, oil strike gusher...
- **Disasters**: Deepwater Horizon burning, Bhopal chemical horror, Exxon Valdez spreading...
- **Innovations**: Haber process nitrogen, Bessemer steel, fracking shale unlocking...

### 8b: Geopolitical (250 phrases)

#### Resource Conflicts (40 phrases)
- **Oil Wars**: Persian Gulf tanker escort, pipeline route disputed, embargo weapon...
- **Water Wars**: dam construction downstream fury, aquifer depletion tension, drought migration...
- **Mineral Conflicts**: conflict diamond blood trade, coltan militia control, rare earth monopoly...
- **Food Security**: grain export ban, food riot price spike, land grab foreign...

#### Trade Politics (30 phrases)
- **Tariffs & Sanctions**: tariff announcement reaction, trade war escalation, sanction circumvention...
- **Trade Agreements**: free trade signing ceremony, quota allocation negotiation, market access...
- **Supply Chain Politics**: reshoring initiative, friend-shoring alliance, decoupling rhetoric...

#### Power Dynamics (30 phrases)
- **OPEC Influence**: OPEC meeting speculation, production cut announcement, spare capacity...
- **State-Owned Enterprises**: national oil company dominance, sovereign wealth fund, government subsidy...
- **Multinational Corporations**: supermajor consolidation, trading house influence, mining giant power...

#### Regional Hotspots (50 phrases)
- **Middle East**: Strait of Hormuz chokepoint, Saudi swing producer, Iran sanction...
- **Asia Pacific**: China demand driving, South China Sea risk, Australia export dependency...
- **Americas**: US shale revolution, Venezuela crisis collapse, Brazil pre-salt development...
- **Africa**: Nigeria oil theft, DRC cobalt strategic, Ghana gold cocoa economy...
- **Europe/Russia**: Nord Stream controversy, Russia gas weapon, Ukraine transit vulnerable...

#### Institutional Framework (20 phrases)
- **International Bodies**: IMF commodity forecast, World Bank lending, IEA coordination...
- **Regulatory Environment**: Dodd-Frank limits, carbon border adjustment, ESG reporting...

#### Future Tensions (20 phrases)
- **Emerging Conflicts**: Arctic resource race, deep sea mining jurisdiction, cyber attack vulnerability...
- **Shifting Alliances**: BRICS expansion influence, petrodollar alternative, bilateral swap proliferating...

## Cross-Population Tags

Phase 8 phrases map to prompt categories:

| Source | Target Categories |
|--------|-------------------|
| Trade route eras | Environment, Subject, Atmosphere |
| Industrial revolution | Environment, Atmosphere |
| Market crashes | Atmosphere, Subject |
| Technological shifts | Environment, Subject |
| Defining moments | Environment, Atmosphere, Subject |
| Resource conflicts | Atmosphere, Environment |
| Trade politics | Atmosphere, Subject |
| Power dynamics | Subject, Atmosphere |
| Regional hotspots | Environment, Atmosphere |
| Institutional framework | Environment, Subject |
| Future tensions | Atmosphere, Environment |

## Usage

```typescript
import { 
  // Historical helpers
  getAllTradeRouteEraPhrases,
  getAllIndustrialRevolutionPhrases,
  getAllMarketCrisesPhrases,
  getAllTechnologicalShiftsPhrases,
  getAllDefiningMomentsPhrases,
  getAllHistoricalMomentsPhrases,
  
  // Geopolitical helpers
  getAllResourceConflictsPhrases,
  getAllTradePoliticsPhrases,
  getAllPowerDynamicsPhrases,
  getAllRegionalHotspotsPhrases,
  getAllInstitutionalFrameworkPhrases,
  getAllFutureTensionsPhrases,
  getAllGeopoliticalPhrases,
  
  // Combined
  getAllPhase8Phrases,
  
  // Stats
  getVocabularyStats
} from './index';

// Get all historical phrases (250 phrases)
const historical = getAllHistoricalMomentsPhrases();

// Get all geopolitical phrases (250 phrases)
const geopolitical = getAllGeopoliticalPhrases();

// Get all Phase 8 (500 phrases)
const phase8 = getAllPhase8Phrases();

// Check totals
const stats = getVocabularyStats();
console.log(stats.grandTotal); // 4319
```

## Roadmap

| Phase | Focus | Est. Phrases |
|-------|-------|--------------|
| 9 | Containers, Rituals, Night Operations | ~674 |
| 10 | Shared Vocab Expansion + Cross-Population Merge | ~400 |
