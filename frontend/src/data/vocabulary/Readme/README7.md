# Commodities Vocabulary Module

**Version:** 1.0.0  
**Created:** 2026-02-05  
**Phases Complete:** 1-5 (Vibes, Transformations, Production, Extraction, Trading)

## Summary

| Metric | Count |
|--------|-------|
| Commodities | 78 |
| Vibes per commodity | 12 |
| Transformation stages per commodity | 8 |
| Region phrases per commodity | 5 |
| Extraction methods per commodity | 3 |
| End-use sectors per commodity | 3 |
| Trading culture phrases | 125 |
| Price states phrases | 120 |
| **Total Vibes** | **936** |
| **Total Stages** | **624** |
| **Total Region Phrases** | **390** |
| **Total Extraction Methods** | **234** |
| **Total End-Use Sectors** | **234** |
| **Total Trading Culture** | **125** |
| **Total Price States** | **120** |
| **Grand Total Phrases** | **2,663** |

## Commodity Categories

| Category | Count | Examples |
|----------|-------|----------|
| Energy | 10 | crude_oil, natural_gas, coal, uranium |
| Precious Metals | 5 | gold, silver, platinum, palladium, rhodium |
| Base Metals | 8 | copper, aluminum, zinc, nickel, steel |
| Grains | 6 | wheat, corn, soybeans, rice, oats |
| Softs | 6 | coffee, cocoa, sugar, cotton, rubber |
| Livestock | 4 | live_cattle, lean_hogs, feeder_cattle, pork_bellies |
| Industrial | 10 | lithium, cobalt, rare_earths, graphite, titanium |
| Food | 12 | orange_juice, chicken, turkey, honey, olive_oil |
| Dairy | 4 | milk, cheese, butter, eggs |
| Nuts | 4 | cashews, pistachios, walnuts, hazelnuts |
| Oilseeds | 2 | rapeseed, sunflower_oil |
| Textiles | 1 | silk |
| Vegetables | 1 | potatoes |

## Files

```
src/data/vocabulary/commodities/
├── commodity-vibes.json       # 78 commodities × 12 vibes = 936 phrases
├── transformation-states.json # 78 commodities × 8 stages = 624 phrases
├── production-countries.json  # 78 commodities × 5 regions = 390 phrases
├── extraction-methods.json    # 78 commodities × 3 methods = 234 phrases
├── end-use-sectors.json       # 78 commodities × 3 sectors = 234 phrases
├── trading-culture.json       # Trading floor language = 186 phrases
├── price-states.json          # Market moods & emotions = 180 phrases
├── index.ts                   # TypeScript exports + helper functions
└── README.md                  # This file
```

## Cross-Population to Prompt Builder

The `index.ts` exports helper functions that filter phrases for specific Prompt Builder categories:

| Function | Target Category | Est. Phrases |
|----------|-----------------|--------------|
| `getVibesForSubjectCategory()` | Subject | ~200 |
| `getVibesForEnvironmentCategory()` | Environment | ~300 |
| `getVibesForAtmosphereCategory()` | Atmosphere | ~250 |
| `getVibesForLightingCategory()` | Lighting | ~100 |
| `getStagesForActionCategory()` | Action / Pose | ~200 |
| `getRegionPhrasesForEnvironmentCategory()` | Environment | ~350 |
| `getExtractionMethodsForActionCategory()` | Action / Pose | ~200 |
| `getEndUseSectorsForEnvironmentCategory()` | Environment | ~150 |
| `getTradingCultureForEnvironmentCategory()` | Environment | ~80 |
| `getTradingCultureForSubjectCategory()` | Subject | ~60 |
| `getPriceStatesForAtmosphereCategory()` | Atmosphere | ~120 |

## Usage Examples

```typescript
import {
  getCommodity,
  getVibesForCommodity,
  getStagesForCommodity,
  getRegionPhrasesForCommodity,
  getTopProducers,
  getExtractionMethodsForCommodity,
  getEndUseSectorsForCommodity,
  getAllTradingCulturePhrases,
  getPriceStatesByCondition,
  getTradingCultureBySector,
  getCrossPopulationSummary,
} from '@/data/vocabulary/commodities';

// Get a specific commodity
const gold = getCommodity('gold');
console.log(gold?.vibes[0]); // "prospector panning riverside golden light"

// Get vibes for a commodity
const coffeeVibes = getVibesForCommodity('coffee');
// ["colombian hillside picker harvest", "roasting facility drum turning", ...]

// Get transformation stages
const oilStages = getStagesForCommodity('crude_oil');
// ["underground reservoir pressure trapped millions years", ...]

// Get region phrases for a commodity
const coffeeRegions = getRegionPhrasesForCommodity('coffee');
// ["brazilian minas gerais coffee plantation red earth", ...]

// Get top producing countries
const coffeeProducers = getTopProducers('coffee');
// ["Brazil", "Vietnam", "Colombia", "Indonesia", "Ethiopia"]

// Get extraction methods
const goldMethods = getExtractionMethodsForCommodity('gold');
// ["cyanide heap leaching dissolving fine particles", ...]

// Get end-use sectors
const goldUses = getEndUseSectorsForCommodity('gold');
// ["jewelry manufacturing wedding ring crafting", ...]

// Get trading culture phrases
const tradingPhrases = getAllTradingCulturePhrases();
// ["trading pit pandemonium hand signals flying", ...]

// Get price states by market condition
const bullPhrases = getPriceStatesByCondition('bull');
// ["green candles stacking higher highs euphoria", ...]

// Get trading culture by commodity sector
const oilTrading = getTradingCultureBySector('oil');
// ["nymex crude pit legendary volatility", ...]

// Get summary of cross-population counts
const summary = getCrossPopulationSummary();
// { subject: 260, environment: 880, atmosphere: 370, ... }
```

## Phase Roadmap

| Phase | Focus | Status |
|-------|-------|--------|
| 1 | Commodity Vibes | ✅ Complete |
| 2 | Transformation States | ✅ Complete |
| 3 | Production Countries | ✅ Complete |
| 4 | Extraction Methods + End-Use Sectors | ✅ Complete |
| 5 | Trading Culture + Price States | ✅ Complete |
| 6 | Sensory Vocabulary + Human Stories | 🔜 Next |
| 7 | Weather-Commodity Links | 🔜 Pending |
| 8 | Historical Moments | 🔜 Pending |
| 9 | Containers & Night Ops | 🔜 Pending |
| 10 | Cross-Population Merge | 🔜 Pending |

## Changelog

| Date | Change |
|------|--------|
| 2026-02-05 | Phase 5 complete: 125 trading culture + 120 price states |
| 2026-02-05 | Phase 4 complete: 234 extraction methods + 234 end-use sectors |
| 2026-02-05 | Phase 3 complete: 390 production country region phrases |
| 2026-02-05 | Phase 2 complete: 624 transformation stage phrases |
| 2026-02-05 | Phase 1 complete: 936 commodity vibe phrases |
| 2026-02-05 | Initial structure created |
