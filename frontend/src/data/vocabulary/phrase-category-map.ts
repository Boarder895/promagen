// src/data/vocabulary/phrase-category-map.ts
// ============================================================================
// PHRASE CATEGORY MAP — MASTER REGISTRY
// ============================================================================
// Maps all ~7,500 vocabulary phrases to prompt builder categories with rich
// tagging metadata for cascading filtering (Phase 5).
//
// ARCHITECTURE:
// - Registry built once at module load (lazy singleton)
// - Each source JSON has a dedicated mapper function
// - Phrases tagged with: commodityId, commodityGroup, mood, weatherEvent,
//   countryCodes, extractionMethod, subSection
// - Deduplication within each category (same text only appears once)
//
// CATEGORY MAPPING RULES (from existing getAllPhrasesForCategory):
//   commodity-vibes vibes[0:3]   → subject
//   commodity-vibes vibes[3:7]   → environment
//   commodity-vibes vibes[7:10]  → atmosphere
//   commodity-vibes vibes[10:]   → lighting
//   commodity-vibes atmosphereLinks → atmosphere
//   commodity-vibes lightingLinks   → lighting
//   transformation-states       → action
//   production-countries         → environment
//   extraction-methods           → action
//   end-use-sectors              → environment
//   trading-culture (traders)    → subject
//   trading-culture (scenes)     → environment
//   trading-culture (language)   → atmosphere
//   price-states (bull)          → atmosphere (mood: bullish)
//   price-states (bear)          → atmosphere (mood: bearish)
//   price-states (sideways/vol)  → atmosphere (mood: neutral)
//   sensory-visual (colors)      → colour
//   sensory-visual (textures)    → materials
//   sensory-visual (appearances) → [varied by sub-type]
//   sensory-smell-taste          → materials
//   sensory-touch-sound          → materials
//   human-stories                → subject
//   weather (visual_states)      → environment
//   weather (seasonal/climate)   → atmosphere
//   weather (commodity_impacts)  → atmosphere
//   weather (market_reactions)   → atmosphere
//   absence (storage/depleted)   → environment
//   absence (market/visual)      → atmosphere
//   absence (light_shadow)       → lighting
//   historical (routes/indust)   → environment
//   historical (crashes/tech)    → atmosphere
//   geopolitical (hotspots/inst) → environment
//   geopolitical (conflicts/etc) → atmosphere
//   containers (bulk/industrial) → environment
//   containers (packaging/trad)  → subject
//   containers (states)          → materials
//   rituals (daily/professional) → action
//   rituals (seasonal/cultural)  → atmosphere
//   night (shift_work)           → environment
//   night (atmospheres/sounds)   → atmosphere
//   night (lighting)             → lighting
//   shared-vocab (subjects)      → subject
//   shared-vocab (actions)       → action
//   shared-vocab (environments)  → environment
//   shared-vocab (atmospheres)   → atmosphere
//   shared-vocab (lighting)      → lighting
//   shared-vocab (states)        → [varied by sub-type]
//   cross-population (bridges)   → style
//   cross-population (trans)     → style
//   cross-population (unifying)  → style
//
// NEW CATEGORIES (not in existing getAllPhrasesForCategory):
//   style        ← cross-population, shared-vocab(quality)
//   colour       ← sensory-visual(colors), sensory-visual(earth_tones)
//   composition  ← sensory-visual(scale_perspective), cross-pop(scaleBridges)
//   camera       ← sensory-visual(scale_perspective subset)
//   fidelity     ← built-in quality boosters (small set)
//   negative     ← built-in exclusion terms (small set)
//
// Authority: go-big-or-go-home-prompt-builder.md v2 §Phase 4
// Existing features preserved: Yes
// ============================================================================

import type { PromptCategory } from '@/types/prompt-builder';
import type {
  IntelligentPhrase,
  PhraseGroup,
  PhraseMood,
  PhraseSource,
  PhraseCategoryRegistry,
  PhraseCategoryStats,
} from '@/data/vocabulary/phrase-category-types';

// ============================================================================
// JSON IMPORTS (all 21 commodity vocabulary files)
// ============================================================================

import commodityVibesJson from '@/data/vocabulary/commodities/commodity-vibes.json';
import transformationStatesJson from '@/data/vocabulary/commodities/transformation-states.json';
import productionCountriesJson from '@/data/vocabulary/commodities/production-countries.json';
import extractionMethodsJson from '@/data/vocabulary/commodities/extraction-methods.json';
import endUseSectorsJson from '@/data/vocabulary/commodities/end-use-sectors.json';
import tradingCultureJson from '@/data/vocabulary/commodities/trading-culture.json';
import priceStatesJson from '@/data/vocabulary/commodities/price-states.json';
import sensoryVisualJson from '@/data/vocabulary/commodities/sensory-visual.json';
import sensorySmellTasteJson from '@/data/vocabulary/commodities/sensory-smell-taste.json';
import sensoryTouchSoundJson from '@/data/vocabulary/commodities/sensory-touch-sound.json';
import humanStoriesWorkersJson from '@/data/vocabulary/commodities/human-stories-workers.json';
import humanStoriesTradersJson from '@/data/vocabulary/commodities/human-stories-traders-consumers.json';
import weatherCommodityLinksJson from '@/data/vocabulary/commodities/weather-commodity-links.json';
import absenceStatesJson from '@/data/vocabulary/commodities/absence-states.json';
import historicalMomentsJson from '@/data/vocabulary/commodities/historical-moments.json';
import geopoliticalJson from '@/data/vocabulary/commodities/geopolitical.json';
import containersJson from '@/data/vocabulary/commodities/containers.json';
import ritualsJson from '@/data/vocabulary/commodities/rituals.json';
import nightOperationsJson from '@/data/vocabulary/commodities/night-operations.json';
import sharedVocabJson from '@/data/vocabulary/commodities/shared-vocab-expansion.json';
import crossPopulationJson from '@/data/vocabulary/commodities/cross-population-merge.json';

// Catalog for commodity→group lookup
import catalogJson from '@/data/commodities/commodities.catalog.json';

// ============================================================================
// VIBES CATEGORY → GROUP MAPPING
// ============================================================================

/**
 * Map commodity-vibes.json category strings to PhraseGroup.
 * Vibes categories: base-metals, energy, food-dairy, grains, industrial,
 *                   livestock, precious-metals, softs
 */
function vibesCategoryToGroup(cat: string): PhraseGroup {
  switch (cat) {
    case 'energy':
      return 'energy';
    case 'grains':
    case 'softs':
    case 'food-dairy':
    case 'livestock':
      return 'agriculture';
    case 'base-metals':
    case 'precious-metals':
    case 'industrial':
      return 'metals';
    default:
      return 'metals'; // Safe fallback
  }
}

// ============================================================================
// CATALOG GROUP INDEX (built once)
// ============================================================================

interface CatalogEntry {
  id: string;
  group: string;
}

const catalogGroupById = new Map<string, PhraseGroup>();
for (const entry of catalogJson as CatalogEntry[]) {
  catalogGroupById.set(entry.id, entry.group as PhraseGroup);
}

/** Look up commodity group from catalog. Falls back to 'metals'. */
function groupForCommodity(commodityId: string): PhraseGroup {
  return catalogGroupById.get(commodityId) ?? 'metals';
}

// ============================================================================
// GENERIC HELPERS
// ============================================================================

/** Safely flatten nested objects into string arrays. */
function flatStrings(obj: unknown): string[] {
  if (Array.isArray(obj)) return obj.filter((x): x is string => typeof x === 'string');
  if (typeof obj === 'object' && obj !== null) {
    return Object.values(obj).flatMap(flatStrings);
  }
  return typeof obj === 'string' ? [obj] : [];
}

/** Create IntelligentPhrase entries from a string array with shared tags. */
function tag(
  texts: string[],
  category: PromptCategory,
  source: PhraseSource,
  tags: Partial<Omit<IntelligentPhrase, 'text' | 'category' | 'source'>> = {},
): IntelligentPhrase[] {
  return texts
    .filter((t) => typeof t === 'string' && t.length > 0)
    .map((text) => ({
      text,
      category,
      source,
      ...tags,
    }));
}

// ============================================================================
// SOURCE MAPPERS
// ============================================================================
// Each function maps a single JSON source into IntelligentPhrase[].
// Category assignments match the existing getAllPhrasesForCategory() rules
// where they exist, and extend to the 6 new categories.
// ============================================================================

// ---------------------------------------------------------------------------
// 1. COMMODITY VIBES → subject / environment / atmosphere / lighting
// ---------------------------------------------------------------------------
function mapCommodityVibes(): IntelligentPhrase[] {
  const phrases: IntelligentPhrase[] = [];
  const data = (commodityVibesJson as any).commodities as Record<string, any> | undefined;
  if (!data) return phrases;

  for (const [id, commodity] of Object.entries(data)) {
    const vibes: string[] = commodity.vibes ?? [];
    const group = vibesCategoryToGroup(commodity.category ?? '');
    const countries: string[] = commodity.primaryCountries ?? [];
    const baseTags = {
      commodityId: id,
      commodityGroup: group,
      mood: 'neutral' as PhraseMood,
      ...(countries.length > 0 ? { countryCodes: countries } : {}),
    };

    // vibes[0:3] → subject
    phrases.push(
      ...tag(vibes.slice(0, 3), 'subject', 'commodity-vibes', baseTags),
    );
    // vibes[3:7] → environment
    phrases.push(
      ...tag(vibes.slice(3, 7), 'environment', 'commodity-vibes', baseTags),
    );
    // vibes[7:10] → atmosphere
    phrases.push(
      ...tag(vibes.slice(7, 10), 'atmosphere', 'commodity-vibes', baseTags),
    );
    // vibes[10:] → lighting
    phrases.push(
      ...tag(vibes.slice(10), 'lighting', 'commodity-vibes', baseTags),
    );

    // atmosphereLinks → atmosphere
    const atmLinks: string[] = commodity.atmosphereLinks ?? [];
    phrases.push(
      ...tag(atmLinks, 'atmosphere', 'commodity-vibes', baseTags),
    );

    // lightingLinks → lighting
    const ltLinks: string[] = commodity.lightingLinks ?? [];
    phrases.push(
      ...tag(ltLinks, 'lighting', 'commodity-vibes', baseTags),
    );
  }
  return phrases;
}

// ---------------------------------------------------------------------------
// 2. TRANSFORMATION STATES → action
// ---------------------------------------------------------------------------
function mapTransformationStates(): IntelligentPhrase[] {
  const data = (transformationStatesJson as any).transformations as Record<string, any> | undefined;
  if (!data) return [];
  const phrases: IntelligentPhrase[] = [];

  for (const [id, entry] of Object.entries(data)) {
    const stages: string[] = entry.stages ?? [];
    phrases.push(
      ...tag(stages, 'action', 'transformation-states', {
        commodityId: id,
        commodityGroup: groupForCommodity(id),
      }),
    );
  }
  return phrases;
}

// ---------------------------------------------------------------------------
// 3. PRODUCTION COUNTRIES → environment
// ---------------------------------------------------------------------------
function mapProductionCountries(): IntelligentPhrase[] {
  const data = (productionCountriesJson as any).production as Record<string, any> | undefined;
  if (!data) return [];
  const phrases: IntelligentPhrase[] = [];

  for (const [id, entry] of Object.entries(data)) {
    const regions: string[] = entry.regionPhrases ?? [];
    const countries: string[] = entry.topProducers ?? [];
    phrases.push(
      ...tag(regions, 'environment', 'production-countries', {
        commodityId: id,
        commodityGroup: groupForCommodity(id),
        ...(countries.length > 0 ? { countryCodes: countries } : {}),
      }),
    );
  }
  return phrases;
}

// ---------------------------------------------------------------------------
// 4. EXTRACTION METHODS → action
// ---------------------------------------------------------------------------
function mapExtractionMethods(): IntelligentPhrase[] {
  const data = (extractionMethodsJson as any).extraction as Record<string, any> | undefined;
  if (!data) return [];
  const phrases: IntelligentPhrase[] = [];

  for (const [id, entry] of Object.entries(data)) {
    const methods: string[] = entry.methods ?? [];
    phrases.push(
      ...tag(methods, 'action', 'extraction-methods', {
        commodityId: id,
        commodityGroup: groupForCommodity(id),
        extractionMethod: id,
      }),
    );
  }
  return phrases;
}

// ---------------------------------------------------------------------------
// 5. END-USE SECTORS → environment
// ---------------------------------------------------------------------------
function mapEndUseSectors(): IntelligentPhrase[] {
  const data = (endUseSectorsJson as any).endUse as Record<string, any> | undefined;
  if (!data) return [];
  const phrases: IntelligentPhrase[] = [];

  for (const [id, entry] of Object.entries(data)) {
    const sectors: string[] = entry.sectors ?? [];
    phrases.push(
      ...tag(sectors, 'environment', 'end-use-sectors', {
        commodityId: id,
        commodityGroup: groupForCommodity(id),
      }),
    );
  }
  return phrases;
}

// ---------------------------------------------------------------------------
// 6. TRADING CULTURE → subject / environment / atmosphere
// ---------------------------------------------------------------------------
function mapTradingCulture(): IntelligentPhrase[] {
  const tc = tradingCultureJson as any;
  const phrases: IntelligentPhrase[] = [];

  // Traders + archetypes → subject
  phrases.push(
    ...tag(flatStrings(tc.traderTypes), 'subject', 'trading-culture', {
      subSection: 'traderTypes',
    }),
  );

  // Scenes + equipment + exchanges → environment
  phrases.push(
    ...tag(flatStrings(tc.tradingFloors), 'environment', 'trading-culture', {
      subSection: 'tradingFloors',
    }),
  );
  phrases.push(
    ...tag(flatStrings(tc.exchangeVenues), 'environment', 'trading-culture', {
      subSection: 'exchangeVenues',
    }),
  );

  // Market language → atmosphere
  phrases.push(
    ...tag(flatStrings(tc.marketLanguage), 'atmosphere', 'trading-culture', {
      subSection: 'marketLanguage',
    }),
  );

  // Rituals → action
  phrases.push(
    ...tag(flatStrings(tc.rituals), 'action', 'trading-culture', {
      subSection: 'rituals',
    }),
  );

  return phrases;
}

// ---------------------------------------------------------------------------
// 7. PRICE STATES → atmosphere (with mood tags)
// ---------------------------------------------------------------------------
function mapPriceStates(): IntelligentPhrase[] {
  const ps = priceStatesJson as any;
  const phrases: IntelligentPhrase[] = [];

  // Bull market → atmosphere, mood: bullish
  phrases.push(
    ...tag(flatStrings(ps.bullMarket), 'atmosphere', 'price-states', {
      mood: 'bullish',
      subSection: 'bullMarket',
    }),
  );

  // Bear market → atmosphere, mood: bearish
  phrases.push(
    ...tag(flatStrings(ps.bearMarket), 'atmosphere', 'price-states', {
      mood: 'bearish',
      subSection: 'bearMarket',
    }),
  );

  // Sideways → atmosphere, mood: neutral
  const sideways = ps.sideways ?? ps.sidewaysMarket ?? {};
  phrases.push(
    ...tag(flatStrings(sideways), 'atmosphere', 'price-states', {
      mood: 'neutral',
      subSection: 'sideways',
    }),
  );

  // Volatility → atmosphere, mood: neutral
  phrases.push(
    ...tag(flatStrings(ps.volatility), 'atmosphere', 'price-states', {
      mood: 'neutral',
      subSection: 'volatility',
    }),
  );

  // Transitions → atmosphere
  phrases.push(
    ...tag(flatStrings(ps.transitions), 'atmosphere', 'price-states', {
      subSection: 'transitions',
    }),
  );

  // Commodity-specific supply/demand shocks → atmosphere
  phrases.push(
    ...tag(flatStrings(ps.commoditySpecific), 'atmosphere', 'price-states', {
      subSection: 'commoditySpecific',
    }),
  );

  return phrases;
}

// ---------------------------------------------------------------------------
// 8. SENSORY VISUAL → colour / materials / composition / camera / lighting
// ---------------------------------------------------------------------------
function mapSensoryVisual(): IntelligentPhrase[] {
  const sv = sensoryVisualJson as any;
  const phrases: IntelligentPhrase[] = [];

  // Colors → colour (NEW category)
  phrases.push(
    ...tag(flatStrings(sv.colors), 'colour', 'sensory-visual', {
      subSection: 'colors',
    }),
  );

  // Textures → materials
  phrases.push(
    ...tag(flatStrings(sv.textures), 'materials', 'sensory-visual', {
      subSection: 'textures',
    }),
  );

  // Appearances — split by sub-type
  // commodity_states → materials
  phrases.push(
    ...tag(flatStrings(sv.appearances?.commodity_states), 'materials', 'sensory-visual', {
      subSection: 'appearances.commodity_states',
    }),
  );

  // light_interaction → lighting
  phrases.push(
    ...tag(flatStrings(sv.appearances?.light_interaction), 'lighting', 'sensory-visual', {
      subSection: 'appearances.light_interaction',
    }),
  );

  // movement_visual → action
  phrases.push(
    ...tag(flatStrings(sv.appearances?.movement_visual), 'action', 'sensory-visual', {
      subSection: 'appearances.movement_visual',
    }),
  );

  // scale_perspective → composition (NEW category) + camera (NEW category)
  const scalePhrases: string[] = flatStrings(sv.appearances?.scale_perspective);
  // First half → composition, second half → camera
  const mid = Math.ceil(scalePhrases.length / 2);
  phrases.push(
    ...tag(scalePhrases.slice(0, mid), 'composition', 'sensory-visual', {
      subSection: 'appearances.scale_perspective',
    }),
  );
  phrases.push(
    ...tag(scalePhrases.slice(mid), 'camera', 'sensory-visual', {
      subSection: 'appearances.scale_perspective',
    }),
  );

  return phrases;
}

// ---------------------------------------------------------------------------
// 9. SENSORY SMELL-TASTE → materials
// ---------------------------------------------------------------------------
function mapSensorySmellTaste(): IntelligentPhrase[] {
  const sst = sensorySmellTasteJson as any;
  return [
    ...tag(flatStrings(sst.aromas), 'materials', 'sensory-smell-taste', {
      subSection: 'aromas',
    }),
    ...tag(flatStrings(sst.flavors), 'materials', 'sensory-smell-taste', {
      subSection: 'flavors',
    }),
  ];
}

// ---------------------------------------------------------------------------
// 10. SENSORY TOUCH-SOUND → materials
// ---------------------------------------------------------------------------
function mapSensoryTouchSound(): IntelligentPhrase[] {
  const sts = sensoryTouchSoundJson as any;
  return [
    ...tag(flatStrings(sts.tactile), 'materials', 'sensory-touch-sound', {
      subSection: 'tactile',
    }),
    ...tag(flatStrings(sts.auditory), 'materials', 'sensory-touch-sound', {
      subSection: 'auditory',
    }),
  ];
}

// ---------------------------------------------------------------------------
// 11. HUMAN STORIES (WORKERS) → subject
// ---------------------------------------------------------------------------
function mapHumanStoriesWorkers(): IntelligentPhrase[] {
  const hsw = humanStoriesWorkersJson as any;
  return [
    ...tag(flatStrings(hsw.worker_archetypes), 'subject', 'human-stories-workers', {
      subSection: 'worker_archetypes',
    }),
    ...tag(flatStrings(hsw.labor_conditions), 'subject', 'human-stories-workers', {
      subSection: 'labor_conditions',
    }),
    ...tag(flatStrings(hsw.human_moments), 'subject', 'human-stories-workers', {
      subSection: 'human_moments',
    }),
  ];
}

// ---------------------------------------------------------------------------
// 12. HUMAN STORIES (TRADERS & CONSUMERS) → subject
// ---------------------------------------------------------------------------
function mapHumanStoriesTraders(): IntelligentPhrase[] {
  const hstc = humanStoriesTradersJson as any;
  return [
    ...tag(flatStrings(hstc.traders_brokers), 'subject', 'human-stories-traders-consumers', {
      subSection: 'traders_brokers',
    }),
    ...tag(flatStrings(hstc.consumers_end_users), 'subject', 'human-stories-traders-consumers', {
      subSection: 'consumers_end_users',
    }),
    ...tag(flatStrings(hstc.families_communities), 'subject', 'human-stories-traders-consumers', {
      subSection: 'families_communities',
    }),
  ];
}

// ---------------------------------------------------------------------------
// 13. WEATHER-COMMODITY LINKS → environment / atmosphere
// ---------------------------------------------------------------------------
function mapWeatherCommodityLinks(): IntelligentPhrase[] {
  const wcl = weatherCommodityLinksJson as any;
  const phrases: IntelligentPhrase[] = [];

  // Weather event types: drought, flood, frost_freeze, heat_wave, storm_hurricane, monsoon
  const events = ['drought', 'flood', 'frost_freeze', 'heat_wave', 'storm_hurricane', 'monsoon'] as const;

  for (const event of events) {
    const section = wcl[event];
    if (!section) continue;

    // visual_states → environment
    phrases.push(
      ...tag(flatStrings(section.visual_states), 'environment', 'weather-commodity-links', {
        weatherEvent: event,
        subSection: `${event}.visual_states`,
      }),
    );

    // commodity_impacts → atmosphere
    phrases.push(
      ...tag(flatStrings(section.commodity_impacts), 'atmosphere', 'weather-commodity-links', {
        weatherEvent: event,
        subSection: `${event}.commodity_impacts`,
      }),
    );

    // market_reactions → atmosphere
    phrases.push(
      ...tag(flatStrings(section.market_reactions), 'atmosphere', 'weather-commodity-links', {
        weatherEvent: event,
        subSection: `${event}.market_reactions`,
      }),
    );
  }

  // Seasonal transitions → atmosphere
  phrases.push(
    ...tag(flatStrings(wcl.seasonal_transitions), 'atmosphere', 'weather-commodity-links', {
      subSection: 'seasonal_transitions',
    }),
  );

  // Climate phenomena → atmosphere
  phrases.push(
    ...tag(flatStrings(wcl.climate_phenomena), 'atmosphere', 'weather-commodity-links', {
      subSection: 'climate_phenomena',
    }),
  );

  return phrases;
}

// ---------------------------------------------------------------------------
// 14. ABSENCE STATES → environment / atmosphere / lighting
// ---------------------------------------------------------------------------
function mapAbsenceStates(): IntelligentPhrase[] {
  const as_ = absenceStatesJson as any;
  const phrases: IntelligentPhrase[] = [];
  const baseTags = { mood: 'bearish' as PhraseMood };

  // empty_storage + depleted_sources → environment
  phrases.push(
    ...tag(flatStrings(as_.empty_storage), 'environment', 'absence-states', {
      ...baseTags,
      subSection: 'empty_storage',
    }),
  );
  phrases.push(
    ...tag(flatStrings(as_.depleted_sources), 'environment', 'absence-states', {
      ...baseTags,
      subSection: 'depleted_sources',
    }),
  );

  // supply_chain_gaps → environment
  phrases.push(
    ...tag(flatStrings(as_.supply_chain_gaps), 'environment', 'absence-states', {
      ...baseTags,
      subSection: 'supply_chain_gaps',
    }),
  );

  // market_absence → atmosphere
  phrases.push(
    ...tag(flatStrings(as_.market_absence), 'atmosphere', 'absence-states', {
      ...baseTags,
      subSection: 'market_absence',
    }),
  );

  // human_absence → atmosphere
  phrases.push(
    ...tag(flatStrings(as_.human_absence), 'atmosphere', 'absence-states', {
      ...baseTags,
      subSection: 'human_absence',
    }),
  );

  // environmental_absence → atmosphere
  phrases.push(
    ...tag(flatStrings(as_.environmental_absence), 'atmosphere', 'absence-states', {
      ...baseTags,
      subSection: 'environmental_absence',
    }),
  );

  // visual_emptiness → atmosphere (most), but light_shadow → lighting
  const ve = as_.visual_emptiness;
  if (ve) {
    // light_shadow specifically → lighting
    phrases.push(
      ...tag(flatStrings(ve.light_shadow), 'lighting', 'absence-states', {
        ...baseTags,
        subSection: 'visual_emptiness.light_shadow',
      }),
    );

    // All other visual_emptiness sub-sections → atmosphere
    for (const [key, val] of Object.entries(ve)) {
      if (key === 'light_shadow') continue;
      phrases.push(
        ...tag(flatStrings(val), 'atmosphere', 'absence-states', {
          ...baseTags,
          subSection: `visual_emptiness.${key}`,
        }),
      );
    }
  }

  return phrases;
}

// ---------------------------------------------------------------------------
// 15. HISTORICAL MOMENTS → environment / atmosphere
// ---------------------------------------------------------------------------
function mapHistoricalMoments(): IntelligentPhrase[] {
  const hm = historicalMomentsJson as any;
  return [
    // Trade routes + industrial revolution → environment
    ...tag(flatStrings(hm.trade_route_eras), 'environment', 'historical-moments', {
      subSection: 'trade_route_eras',
    }),
    ...tag(flatStrings(hm.industrial_revolution), 'environment', 'historical-moments', {
      subSection: 'industrial_revolution',
    }),
    // Crashes + tech shifts + defining moments → atmosphere
    ...tag(flatStrings(hm.market_crashes_crises), 'atmosphere', 'historical-moments', {
      mood: 'bearish',
      subSection: 'market_crashes_crises',
    }),
    ...tag(flatStrings(hm.technological_shifts), 'atmosphere', 'historical-moments', {
      subSection: 'technological_shifts',
    }),
    ...tag(flatStrings(hm.defining_moments), 'atmosphere', 'historical-moments', {
      subSection: 'defining_moments',
    }),
  ];
}

// ---------------------------------------------------------------------------
// 16. GEOPOLITICAL → environment / atmosphere
// ---------------------------------------------------------------------------
function mapGeopolitical(): IntelligentPhrase[] {
  const gp = geopoliticalJson as any;
  return [
    // Hotspots + institutional → environment
    ...tag(flatStrings(gp.regional_hotspots), 'environment', 'geopolitical', {
      subSection: 'regional_hotspots',
    }),
    ...tag(flatStrings(gp.institutional_framework), 'environment', 'geopolitical', {
      subSection: 'institutional_framework',
    }),
    // Conflicts + trade politics + power + future → atmosphere
    ...tag(flatStrings(gp.resource_conflicts), 'atmosphere', 'geopolitical', {
      subSection: 'resource_conflicts',
    }),
    ...tag(flatStrings(gp.trade_politics), 'atmosphere', 'geopolitical', {
      subSection: 'trade_politics',
    }),
    ...tag(flatStrings(gp.power_dynamics), 'atmosphere', 'geopolitical', {
      subSection: 'power_dynamics',
    }),
    ...tag(flatStrings(gp.future_tensions), 'atmosphere', 'geopolitical', {
      subSection: 'future_tensions',
    }),
  ];
}

// ---------------------------------------------------------------------------
// 17. CONTAINERS → subject / environment / materials
// ---------------------------------------------------------------------------
function mapContainers(): IntelligentPhrase[] {
  const c = containersJson as any;
  return [
    // Bulk + industrial → environment
    ...tag(flatStrings(c.bulk_containers), 'environment', 'containers', {
      subSection: 'bulk_containers',
    }),
    ...tag(flatStrings(c.industrial_containers), 'environment', 'containers', {
      subSection: 'industrial_containers',
    }),
    // Packaging + traditional → subject
    ...tag(flatStrings(c.packaging), 'subject', 'containers', {
      subSection: 'packaging',
    }),
    ...tag(flatStrings(c.traditional_containers), 'subject', 'containers', {
      subSection: 'traditional_containers',
    }),
    // Container states → materials
    ...tag(flatStrings(c.container_states), 'materials', 'containers', {
      subSection: 'container_states',
    }),
  ];
}

// ---------------------------------------------------------------------------
// 18. RITUALS → action / atmosphere
// ---------------------------------------------------------------------------
function mapRituals(): IntelligentPhrase[] {
  const r = ritualsJson as any;
  return [
    // Daily + professional → action
    ...tag(flatStrings(r.daily_rituals), 'action', 'rituals', {
      subSection: 'daily_rituals',
    }),
    ...tag(flatStrings(r.professional_rituals), 'action', 'rituals', {
      subSection: 'professional_rituals',
    }),
    // Seasonal + cultural + ceremonial → atmosphere
    ...tag(flatStrings(r.seasonal_rituals), 'atmosphere', 'rituals', {
      subSection: 'seasonal_rituals',
    }),
    ...tag(flatStrings(r.cultural_rituals), 'atmosphere', 'rituals', {
      subSection: 'cultural_rituals',
    }),
    ...tag(flatStrings(r.ceremonial_moments), 'atmosphere', 'rituals', {
      subSection: 'ceremonial_moments',
    }),
  ];
}

// ---------------------------------------------------------------------------
// 19. NIGHT OPERATIONS → environment / atmosphere / lighting
// ---------------------------------------------------------------------------
function mapNightOperations(): IntelligentPhrase[] {
  const no = nightOperationsJson as any;
  return [
    // Shift work → environment
    ...tag(flatStrings(no.night_shift_work), 'environment', 'night-operations', {
      subSection: 'night_shift_work',
    }),
    // 24/7 trading → environment
    ...tag(flatStrings(no['24_7_trading']), 'environment', 'night-operations', {
      subSection: '24_7_trading',
    }),
    // Atmospheres + sounds → atmosphere
    ...tag(flatStrings(no.night_atmospheres), 'atmosphere', 'night-operations', {
      subSection: 'night_atmospheres',
    }),
    ...tag(flatStrings(no.night_sounds), 'atmosphere', 'night-operations', {
      subSection: 'night_sounds',
    }),
    // Night lighting → lighting
    ...tag(flatStrings(no.night_lighting), 'lighting', 'night-operations', {
      subSection: 'night_lighting',
    }),
  ];
}

// ---------------------------------------------------------------------------
// 20. SHARED VOCAB EXPANSION → subject / action / environment / atmosphere / lighting
// ---------------------------------------------------------------------------
function mapSharedVocab(): IntelligentPhrase[] {
  const sve = sharedVocabJson as any;
  const phrases: IntelligentPhrase[] = [];

  // Universal subjects → subject
  phrases.push(
    ...tag(flatStrings(sve.universal_subjects), 'subject', 'shared-vocab-expansion', {
      subSection: 'universal_subjects',
    }),
  );

  // Universal actions → action
  phrases.push(
    ...tag(flatStrings(sve.universal_actions), 'action', 'shared-vocab-expansion', {
      subSection: 'universal_actions',
    }),
  );

  // Universal environments → environment
  phrases.push(
    ...tag(flatStrings(sve.universal_environments), 'environment', 'shared-vocab-expansion', {
      subSection: 'universal_environments',
    }),
  );

  // Universal atmospheres → atmosphere
  phrases.push(
    ...tag(flatStrings(sve.universal_atmospheres), 'atmosphere', 'shared-vocab-expansion', {
      subSection: 'universal_atmospheres',
    }),
  );

  // Universal lighting → lighting
  phrases.push(
    ...tag(flatStrings(sve.universal_lighting), 'lighting', 'shared-vocab-expansion', {
      subSection: 'universal_lighting',
    }),
  );

  // Universal states — split by sub-type
  if (sve.universal_states) {
    // quantity + condition → environment
    phrases.push(
      ...tag(flatStrings(sve.universal_states.quantity), 'environment', 'shared-vocab-expansion', {
        subSection: 'universal_states.quantity',
      }),
    );
    phrases.push(
      ...tag(flatStrings(sve.universal_states.condition), 'environment', 'shared-vocab-expansion', {
        subSection: 'universal_states.condition',
      }),
    );
    // quality → style (NEW)
    phrases.push(
      ...tag(flatStrings(sve.universal_states.quality), 'style', 'shared-vocab-expansion', {
        subSection: 'universal_states.quality',
      }),
    );
    // time → atmosphere
    phrases.push(
      ...tag(flatStrings(sve.universal_states.time), 'atmosphere', 'shared-vocab-expansion', {
        subSection: 'universal_states.time',
      }),
    );
  }

  return phrases;
}

// ---------------------------------------------------------------------------
// 21. CROSS-POPULATION MERGE → style (NEW)
// ---------------------------------------------------------------------------
function mapCrossPopulation(): IntelligentPhrase[] {
  const cpm = crossPopulationJson as any;
  const phrases: IntelligentPhrase[] = [];

  // Category bridges → style
  if (cpm.categoryBridges) {
    for (const [bridgeType, bridge] of Object.entries(cpm.categoryBridges)) {
      phrases.push(
        ...tag(flatStrings((bridge as any).phrases), 'style', 'cross-population-merge', {
          subSection: `categoryBridges.${bridgeType}`,
        }),
      );
    }
  }

  // Transition phrases → style
  if (cpm.transitionPhrases) {
    for (const [transType, trans] of Object.entries(cpm.transitionPhrases)) {
      phrases.push(
        ...tag(flatStrings((trans as any).phrases), 'style', 'cross-population-merge', {
          subSection: `transitionPhrases.${transType}`,
        }),
      );
    }
  }

  // Unifying concepts → style
  if (cpm.unifyingConcepts) {
    for (const [conceptType, concept] of Object.entries(cpm.unifyingConcepts)) {
      phrases.push(
        ...tag(flatStrings((concept as any).phrases), 'style', 'cross-population-merge', {
          subSection: `unifyingConcepts.${conceptType}`,
        }),
      );
    }
  }

  return phrases;
}

// ---------------------------------------------------------------------------
// 22. FIDELITY — built-in quality boosters (NEW)
// ---------------------------------------------------------------------------
function mapFidelityPhrases(): IntelligentPhrase[] {
  const boosters = [
    'masterpiece quality', 'best quality', 'ultra-detailed', 'sharp focus',
    '8K resolution', 'award-winning photograph', 'professionally composed',
    'extremely detailed render', 'photorealistic', 'highly detailed',
    'intricate detail', 'studio quality', 'cinematic quality', 'RAW photo',
    'unreal engine 5', 'octane render', '4K UHD', 'HDR',
    'hyperrealistic', 'fine art photography', 'editorial quality',
    'museum exhibition print', 'large format film', 'medium format quality',
    'commercial photography', 'high dynamic range', 'crystal clear',
    'pixel perfect', 'pristine quality', 'broadcast quality',
  ];
  return tag(boosters, 'fidelity', 'shared-vocab-expansion');
}

// ---------------------------------------------------------------------------
// 23. NEGATIVE — built-in exclusion terms (NEW)
// ---------------------------------------------------------------------------
function mapNegativePhrases(): IntelligentPhrase[] {
  const negatives = [
    'blurry', 'low quality', 'watermark', 'text overlay', 'logo',
    'distorted', 'oversaturated', 'underexposed', 'overexposed',
    'cropped', 'out of frame', 'duplicate', 'morbid', 'mutilated',
    'deformed', 'disfigured', 'bad anatomy', 'bad proportions',
    'extra limbs', 'cloned face', 'gross proportions', 'malformed',
    'missing arms', 'missing legs', 'extra arms', 'extra legs',
    'fused fingers', 'too many fingers', 'long neck', 'username',
    'signature', 'jpeg artifacts', 'low resolution', 'pixelated',
    'noise', 'grain', 'chromatic aberration', 'lens flare',
  ];
  return tag(negatives, 'negative', 'shared-vocab-expansion');
}

// ============================================================================
// REGISTRY BUILDER
// ============================================================================

/** Build the complete registry. Called once (lazy singleton). */
function buildRegistry(): PhraseCategoryRegistry {
  // Collect all phrases from all mappers
  const allPhrases: IntelligentPhrase[] = [
    ...mapCommodityVibes(),
    ...mapTransformationStates(),
    ...mapProductionCountries(),
    ...mapExtractionMethods(),
    ...mapEndUseSectors(),
    ...mapTradingCulture(),
    ...mapPriceStates(),
    ...mapSensoryVisual(),
    ...mapSensorySmellTaste(),
    ...mapSensoryTouchSound(),
    ...mapHumanStoriesWorkers(),
    ...mapHumanStoriesTraders(),
    ...mapWeatherCommodityLinks(),
    ...mapAbsenceStates(),
    ...mapHistoricalMoments(),
    ...mapGeopolitical(),
    ...mapContainers(),
    ...mapRituals(),
    ...mapNightOperations(),
    ...mapSharedVocab(),
    ...mapCrossPopulation(),
    ...mapFidelityPhrases(),
    ...mapNegativePhrases(),
  ];

  // Initialize empty registry
  const registry: PhraseCategoryRegistry = {
    subject: [],
    action: [],
    style: [],
    environment: [],
    composition: [],
    camera: [],
    lighting: [],
    colour: [],
    atmosphere: [],
    materials: [],
    fidelity: [],
    negative: [],
  };

  // Deduplicate within each category (same text only appears once)
  const seenByCategory = new Map<PromptCategory, Set<string>>();
  for (const cat of Object.keys(registry) as PromptCategory[]) {
    seenByCategory.set(cat, new Set());
  }

  for (const phrase of allPhrases) {
    const seen = seenByCategory.get(phrase.category);
    if (!seen) continue;
    if (seen.has(phrase.text)) continue;
    seen.add(phrase.text);
    registry[phrase.category].push(phrase);
  }

  return registry;
}

// ============================================================================
// LAZY SINGLETON
// ============================================================================

let _registry: PhraseCategoryRegistry | null = null;

function getRegistry(): PhraseCategoryRegistry {
  if (!_registry) {
    _registry = buildRegistry();
  }
  return _registry;
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Get all intelligent phrases for a prompt builder category.
 *
 * @example
 * const subjects = getIntelligentPhrases('subject');
 * // → IntelligentPhrase[] with ~2,800 entries
 */
export function getIntelligentPhrases(category: PromptCategory): IntelligentPhrase[] {
  return getRegistry()[category];
}

/**
 * Get intelligent phrases filtered by commodity ID.
 * Returns phrases that are either tagged with this commodity or are universal.
 *
 * @example
 * const goldSubjects = getPhrasesForCommodity('subject', 'gold');
 */
export function getPhrasesForCommodity(
  category: PromptCategory,
  commodityId: string,
): IntelligentPhrase[] {
  return getRegistry()[category].filter(
    (p) => !p.commodityId || p.commodityId === commodityId,
  );
}

/**
 * Get intelligent phrases filtered by commodity group.
 * Returns phrases tagged with this group or universal.
 *
 * @example
 * const metalSubjects = getPhrasesForGroup('subject', 'metals');
 */
export function getPhrasesForGroup(
  category: PromptCategory,
  group: PhraseGroup,
): IntelligentPhrase[] {
  return getRegistry()[category].filter(
    (p) => !p.commodityGroup || p.commodityGroup === group,
  );
}

/**
 * Get intelligent phrases filtered by mood.
 * Returns phrases matching mood or neutral/untagged.
 *
 * @example
 * const bullishAtmos = getPhrasesForMood('atmosphere', 'bullish');
 */
export function getPhrasesForMood(
  category: PromptCategory,
  mood: PhraseMood,
): IntelligentPhrase[] {
  return getRegistry()[category].filter(
    (p) => !p.mood || p.mood === mood || p.mood === 'neutral',
  );
}

/**
 * Get intelligent phrases filtered by weather event.
 *
 * @example
 * const droughtEnvs = getPhrasesForWeather('environment', 'drought');
 */
export function getPhrasesForWeather(
  category: PromptCategory,
  weatherEvent: string,
): IntelligentPhrase[] {
  return getRegistry()[category].filter(
    (p) => !p.weatherEvent || p.weatherEvent === weatherEvent,
  );
}

/**
 * Combined cascading filter — applies all tags simultaneously.
 * Each tag that is provided narrows the results. Tags not provided are ignored.
 *
 * @example
 * const filtered = getCascadingPhrases('atmosphere', {
 *   commodityId: 'gold',
 *   group: 'metals',
 *   mood: 'bullish',
 * });
 */
export function getCascadingPhrases(
  category: PromptCategory,
  filters: {
    commodityId?: string;
    group?: PhraseGroup;
    mood?: PhraseMood;
    weatherEvent?: string;
  },
): IntelligentPhrase[] {
  let results = getRegistry()[category];

  if (filters.commodityId) {
    results = results.filter(
      (p) => !p.commodityId || p.commodityId === filters.commodityId,
    );
  }
  if (filters.group) {
    results = results.filter(
      (p) => !p.commodityGroup || p.commodityGroup === filters.group,
    );
  }
  if (filters.mood) {
    results = results.filter(
      (p) => !p.mood || p.mood === filters.mood || p.mood === 'neutral',
    );
  }
  if (filters.weatherEvent) {
    results = results.filter(
      (p) => !p.weatherEvent || p.weatherEvent === filters.weatherEvent,
    );
  }

  return results;
}

/**
 * Get plain text phrases for a category (backward-compatible with
 * existing getAllPhrasesForCategory).
 *
 * @example
 * const texts = getPlainPhrases('subject');
 * // → string[] with ~2,800 entries
 */
export function getPlainPhrases(category: PromptCategory): string[] {
  return getRegistry()[category].map((p) => p.text);
}

/**
 * Get statistics about the registry.
 */
export function getPhraseCategoryStats(): PhraseCategoryStats {
  const registry = getRegistry();

  // Count unique phrases across all categories
  const allTexts = new Set<string>();
  let totalPlacements = 0;

  const byCategory = {} as Record<PromptCategory, number>;
  const bySource = {} as Record<PhraseSource, number>;
  const byGroup: Record<PhraseGroup | 'universal', number> = {
    energy: 0,
    agriculture: 0,
    metals: 0,
    universal: 0,
  };

  for (const [cat, phrases] of Object.entries(registry)) {
    byCategory[cat as PromptCategory] = phrases.length;
    totalPlacements += phrases.length;

    for (const p of phrases) {
      allTexts.add(p.text);

      // Source count
      bySource[p.source] = (bySource[p.source] ?? 0) + 1;

      // Group count
      if (p.commodityGroup) {
        byGroup[p.commodityGroup]++;
      } else {
        byGroup.universal++;
      }
    }
  }

  return {
    uniquePhrases: allTexts.size,
    totalPlacements: totalPlacements,
    byCategory,
    bySource,
    byGroup,
  };
}
