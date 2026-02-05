/**
 * Commodities Vocabulary Domain - Master Index
 *
 * Provides rich, evocative phrases for 95 commodities traded on global markets.
 * Integrates with Gallery Mode, Market Mood Engine, and Standard Prompt Builder.
 *
 * Phases 1-10 Complete
 * Grand Total: ~5,393 phrases
 *
 * @module data/vocabulary/commodities
 * @version 2.0.0
 */

// =============================================================================
// JSON DATA IMPORTS
// =============================================================================

// Phase 1: Vibes (936 phrases)
import commodityVibes from './commodity-vibes.json';

// Phase 2: Transformation States (624 phrases)
import transformationStates from './transformation-states.json';

// Phase 3: Production Countries (390 phrases)
import productionCountries from './production-countries.json';

// Phase 4: Extraction Methods + End-Use Sectors (468 phrases)
import extractionMethods from './extraction-methods.json';
import endUseSectors from './end-use-sectors.json';

// Phase 5: Trading Culture + Price States (245 phrases)
import tradingCulture from './trading-culture.json';
import priceStates from './price-states.json';

// Phase 6: Sensory + Human Stories (556 phrases)
import sensoryVisual from './sensory-visual.json';
import sensorySmellTaste from './sensory-smell-taste.json';
import sensoryTouchSound from './sensory-touch-sound.json';
import humanStoriesWorkers from './human-stories-workers.json';
import humanStoriesTradersConsumers from './human-stories-traders-consumers.json';

// Phase 7: Weather-Commodity Links + Absence States (600 phrases)
import weatherCommodityLinks from './weather-commodity-links.json';
import absenceStates from './absence-states.json';

// Phase 8: Historical Moments + Geopolitical (500 phrases)
import historicalMoments from './historical-moments.json';
import geopolitical from './geopolitical.json';

// Phase 9: Containers, Rituals, Night Operations (674 phrases)
import containers from './containers.json';
import rituals from './rituals.json';
import nightOperations from './night-operations.json';

// Phase 10: Shared Vocab Expansion + Cross-Population Merge (400 phrases)
import sharedVocabExpansion from './shared-vocab-expansion.json';
import crossPopulationMerge from './cross-population-merge.json';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export type CommodityCategory =
  | 'energy'
  | 'precious-metals'
  | 'base-metals'
  | 'grains'
  | 'softs'
  | 'livestock'
  | 'industrial'
  | 'food-dairy';

export type ExtractionMethod =
  | 'drilled-offshore'
  | 'drilled-onshore'
  | 'mined-underground'
  | 'mined-open-pit'
  | 'farmed-plantation'
  | 'farmed-broadacre'
  | 'ranched-livestock'
  | 'harvested-wild'
  | 'refined'
  | 'processed';

export interface PhysicalProperties {
  color: string;
  state: string;
  texture: string;
  form: string;
}

export interface CommodityVibe {
  id: string;
  name: string;
  emoji: string;
  category: CommodityCategory;
  extractionMethod: ExtractionMethod;
  primaryCountries: string[];
  endUseSectors: string[];
  physicalProperties: PhysicalProperties;
  vibes: string[];
  visualIcons: string[];
  atmosphereLinks: string[];
  lightingLinks: string[];
}

// Type for the commodityVibes JSON structure
interface CommodityVibesData {
  version: string;
  meta: Record<string, unknown>;
  commodities: Record<string, CommodityVibe>;
}

// Typed constant for commodityVibes (fixes TS18046: 'commodityVibes' is of type 'unknown')
const typedCommodityVibes = commodityVibes as CommodityVibesData;

// FIXED: TransformationState.stages is string[] in the actual JSON, not object array
export interface TransformationState {
  id: string;
  stages: string[];
}

export interface ProductionCountry {
  id: string;
  topProducers: string[];
  regionPhrases: string[];
}

export interface ExtractionMethodData {
  id: string;
  methods: string[];
}

export interface EndUseSector {
  id: string;
  sectors: string[];
}

export interface VocabularyPhrase {
  phrase: string;
  category: string;
  subcategory?: string;
  tags?: string[];
}

export interface CategoryBridge {
  description: string;
  phrases: string[];
}

export interface CrossPopulationData {
  metadata: {
    phase: string;
    name: string;
    description: string;
    totalPhrases: number;
    version: string;
    createdAt: string;
  };
  categoryBridges: Record<string, CategoryBridge>;
  transitionPhrases: Record<string, CategoryBridge>;
  unifyingConcepts: Record<string, CategoryBridge>;
}

export interface CrossPopulationSummary {
  subject: number;
  environment: number;
  atmosphere: number;
  lighting: number;
  action: number;
  totalPhrases: number;
  grandTotal: number;
}

export interface VocabularyStats {
  phase1_vibes: number;
  phase2_transformations: number;
  phase3_production_countries: number;
  phase4_extraction_end_use: number;
  phase5_trading_price: number;
  phase6_sensory_human: number;
  phase7_weather_absence: number;
  phase8_historical_geopolitical: number;
  phase9_containers_rituals_night: number;
  phase10_shared_cross_population: number;
  grandTotal: number;
}

// =============================================================================
// DATA EXPORTS
// =============================================================================

export {
  commodityVibes,
  transformationStates,
  productionCountries,
  extractionMethods,
  endUseSectors,
  tradingCulture,
  priceStates,
  sensoryVisual,
  sensorySmellTaste,
  sensoryTouchSound,
  humanStoriesWorkers,
  humanStoriesTradersConsumers,
  weatherCommodityLinks,
  absenceStates,
  historicalMoments,
  geopolitical,
  containers,
  rituals,
  nightOperations,
  sharedVocabExpansion,
  crossPopulationMerge,
};

// =============================================================================
// PHASE 1: COMMODITY VIBES HELPERS
// =============================================================================

/**
 * Get all commodity IDs currently loaded
 */
export function getCommodityIds(): string[] {
  return Object.keys(typedCommodityVibes.commodities);
}

/**
 * Get a specific commodity's full data
 */
export function getCommodity(id: string): CommodityVibe | undefined {
  return (typedCommodityVibes.commodities as Record<string, CommodityVibe>)[id];
}

/**
 * Get vibes (evocative phrases) for a specific commodity
 */
export function getVibesForCommodity(commodityId: string): string[] {
  const commodity = (typedCommodityVibes.commodities as Record<string, CommodityVibe>)[commodityId];
  return commodity?.vibes ?? [];
}

/**
 * Get a random vibe for a specific commodity
 */
export function getRandomVibe(commodityId: string, seed?: number): string {
  const vibes = getVibesForCommodity(commodityId);
  if (vibes.length === 0) return '';
  const index = seed !== undefined ? seed % vibes.length : Math.floor(Math.random() * vibes.length);
  return vibes[index] ?? '';
}

/**
 * Get visual icons for a specific commodity
 */
export function getCommodityVisualIcons(id: string): string[] {
  const commodity = (typedCommodityVibes.commodities as Record<string, CommodityVibe>)[id];
  return commodity?.visualIcons ?? [];
}

/**
 * Get atmosphere links for a specific commodity
 */
export function getCommodityAtmosphereLinks(id: string): string[] {
  const commodity = (typedCommodityVibes.commodities as Record<string, CommodityVibe>)[id];
  return commodity?.atmosphereLinks ?? [];
}

/**
 * Get lighting links for a specific commodity
 */
export function getCommodityLightingLinks(id: string): string[] {
  const commodity = (typedCommodityVibes.commodities as Record<string, CommodityVibe>)[id];
  return commodity?.lightingLinks ?? [];
}

/**
 * Get all commodities by category
 */
export function getCommoditiesByCategory(category: CommodityCategory): CommodityVibe[] {
  return Object.values(typedCommodityVibes.commodities as Record<string, CommodityVibe>).filter(
    (c) => c.category === category,
  );
}

/**
 * Get all commodities by extraction method
 */
export function getCommoditiesByExtractionMethod(method: ExtractionMethod): CommodityVibe[] {
  return Object.values(typedCommodityVibes.commodities as Record<string, CommodityVibe>).filter(
    (c) => c.extractionMethod === method,
  );
}

/**
 * Get all commodities for a specific country
 */
export function getCommoditiesByCountry(countryCode: string): CommodityVibe[] {
  return Object.values(typedCommodityVibes.commodities as Record<string, CommodityVibe>).filter(
    (c) => c.primaryCountries.includes(countryCode),
  );
}

/**
 * Get all unique categories
 */
export function getAllCategories(): string[] {
  const categories = new Set<string>();
  Object.values(typedCommodityVibes.commodities as Record<string, CommodityVibe>).forEach((c) =>
    categories.add(c.category),
  );
  return Array.from(categories);
}

/**
 * Get all vibes as flat array
 */
export function getAllVibes(): string[] {
  return Object.values(typedCommodityVibes.commodities as Record<string, CommodityVibe>).flatMap(
    (c) => c.vibes,
  );
}

/**
 * Get vibes suitable for Subject category (workers, people)
 */
export function getVibesForSubjectCategory(): string[] {
  return Object.values(typedCommodityVibes.commodities as Record<string, CommodityVibe>).flatMap(
    (c) => c.vibes.filter((_, i) => i < 3),
  );
}

/**
 * Get vibes suitable for Environment category (locations, settings)
 */
export function getVibesForEnvironmentCategory(): string[] {
  return Object.values(typedCommodityVibes.commodities as Record<string, CommodityVibe>).flatMap(
    (c) => c.vibes.filter((_, i) => i >= 3 && i < 7),
  );
}

/**
 * Get vibes suitable for Atmosphere category (moods, conditions)
 */
export function getVibesForAtmosphereCategory(): string[] {
  return Object.values(typedCommodityVibes.commodities as Record<string, CommodityVibe>).flatMap(
    (c) => c.vibes.filter((_, i) => i >= 7 && i < 10),
  );
}

/**
 * Get vibes suitable for Lighting category
 */
export function getVibesForLightingCategory(): string[] {
  return Object.values(typedCommodityVibes.commodities as Record<string, CommodityVibe>).flatMap(
    (c) => c.vibes.filter((_, i) => i >= 10),
  );
}

/**
 * Get all atmosphere links for Atmosphere category
 */
export function getAllAtmosphereLinks(): string[] {
  const allLinks = Object.values(
    typedCommodityVibes.commodities as Record<string, CommodityVibe>,
  ).flatMap((c) => c.atmosphereLinks);
  return [...new Set(allLinks)];
}

/**
 * Get all lighting links for Lighting category
 */
export function getAllLightingLinks(): string[] {
  const allLinks = Object.values(
    typedCommodityVibes.commodities as Record<string, CommodityVibe>,
  ).flatMap((c) => c.lightingLinks);
  return [...new Set(allLinks)];
}

// =============================================================================
// PHASE 2: TRANSFORMATION STATES HELPERS
// =============================================================================

/**
 * Get transformation stages for a commodity
 * FIXED: stages is string[] in JSON, not object array
 */
export function getStagesForCommodity(commodityId: string): string[] {
  const data = transformationStates as { transformations: Record<string, TransformationState> };
  const transformation = data.transformations?.[commodityId];
  return transformation?.stages ?? [];
}

/**
 * Get all transformation stages as flat array
 */
export function getAllStages(): string[] {
  const data = transformationStates as { transformations: Record<string, TransformationState> };
  return Object.values(data.transformations || {}).flatMap((t) => t.stages ?? []);
}

/**
 * Get transformation stages suitable for Action category
 * NOTE: JSON has simple string stages, returns all stages
 */
export function getStagesForActionCategory(): string[] {
  const data = transformationStates as { transformations: Record<string, TransformationState> };
  return Object.values(data.transformations || {}).flatMap((t) => t.stages ?? []);
}

/**
 * Get all transformation phrases
 */
export function getAllTransformationPhrases(): string[] {
  const data = transformationStates as { transformations: Record<string, TransformationState> };
  return Object.values(data.transformations || {}).flatMap((t) => t.stages ?? []);
}

/**
 * Get random stage for a commodity
 */
export function getRandomStage(commodityId: string): string | undefined {
  const stages = getStagesForCommodity(commodityId);
  if (stages.length === 0) return undefined;
  return stages[Math.floor(Math.random() * stages.length)];
}

// =============================================================================
// PHASE 3: PRODUCTION COUNTRIES HELPERS
// =============================================================================

/**
 * Get production data for a specific commodity
 */
export function getProductionForCommodity(commodityId: string): ProductionCountry | undefined {
  const data = productionCountries as { production: Record<string, ProductionCountry> };
  return data.production?.[commodityId];
}

/**
 * Get region phrases for a specific commodity
 */
export function getRegionPhrasesForCommodity(commodityId: string): string[] {
  const production = getProductionForCommodity(commodityId);
  return production?.regionPhrases ?? [];
}

/**
 * Get top producing countries for a commodity
 */
export function getTopProducers(commodityId: string): string[] {
  const production = getProductionForCommodity(commodityId);
  return production?.topProducers ?? [];
}

/**
 * Get all region phrases
 */
export function getAllRegionPhrases(): string[] {
  const data = productionCountries as { production: Record<string, ProductionCountry> };
  return Object.values(data.production || {}).flatMap((p) => p.regionPhrases ?? []);
}

/**
 * Get region phrases suitable for Environment category
 */
export function getRegionPhrasesForEnvironmentCategory(): string[] {
  return getAllRegionPhrases();
}

// =============================================================================
// PHASE 4: EXTRACTION METHODS & END-USE SECTORS HELPERS
// =============================================================================

/**
 * Get extraction methods for a specific commodity
 */
export function getExtractionMethodsForCommodity(commodityId: string): string[] {
  const data = extractionMethods as { extraction: Record<string, ExtractionMethodData> };
  return data.extraction?.[commodityId]?.methods ?? [];
}

/**
 * Get all extraction methods
 */
export function getAllExtractionMethods(): string[] {
  const data = extractionMethods as { extraction: Record<string, ExtractionMethodData> };
  return Object.values(data.extraction || {}).flatMap((e) => e.methods ?? []);
}

/**
 * Get extraction methods suitable for Action category
 */
export function getExtractionMethodsForActionCategory(): string[] {
  return getAllExtractionMethods();
}

/**
 * Get end-use sectors for a specific commodity
 */
export function getEndUseSectorsForCommodity(commodityId: string): string[] {
  const data = endUseSectors as { endUse: Record<string, EndUseSector> };
  return data.endUse?.[commodityId]?.sectors ?? [];
}

/**
 * Get all end-use sectors
 */
export function getAllEndUseSectors(): string[] {
  const data = endUseSectors as { endUse: Record<string, EndUseSector> };
  return Object.values(data.endUse || {}).flatMap((e) => e.sectors ?? []);
}

/**
 * Get end-use sectors suitable for Environment category
 */
export function getEndUseSectorsForEnvironmentCategory(): string[] {
  return getAllEndUseSectors();
}

// =============================================================================
// PHASE 5: TRADING CULTURE HELPERS
// =============================================================================

export function getTradingFloorScenes(): string[] {
  return (tradingCulture as any).tradingFloors?.scenes ?? [];
}

export function getTradingEquipment(): string[] {
  return (tradingCulture as any).tradingFloors?.equipment ?? [];
}

export function getCommodityTraders(): string[] {
  return (tradingCulture as any).traderTypes?.commoditySpecific ?? [];
}

export function getTraderRoles(): string[] {
  return (tradingCulture as any).traderTypes?.roles ?? [];
}

export function getTraderArchetypes(): string[] {
  return (tradingCulture as any).traderTypes?.archetypes ?? [];
}

export function getMarketLanguage(): string[] {
  return (tradingCulture as any).marketLanguage?.calls ?? [];
}

export function getTradingSlang(): string[] {
  return (tradingCulture as any).marketLanguage?.slang ?? [];
}

export function getAnalysisTerms(): string[] {
  return (tradingCulture as any).marketLanguage?.analysisTerms ?? [];
}

export function getHistoricExchanges(): string[] {
  return (tradingCulture as any).exchangeVenues?.historic ?? [];
}

export function getModernExchanges(): string[] {
  return (tradingCulture as any).exchangeVenues?.modern ?? [];
}

export function getTradingDailyRituals(): string[] {
  return (tradingCulture as any).rituals?.daily ?? [];
}

export function getTradingSeasonalRituals(): string[] {
  return (tradingCulture as any).rituals?.seasonal ?? [];
}

export function getAllTradingCulturePhrases(): string[] {
  const tc = tradingCulture as any;
  return [
    ...(tc.tradingFloors?.scenes ?? []),
    ...(tc.tradingFloors?.equipment ?? []),
    ...(tc.traderTypes?.commoditySpecific ?? []),
    ...(tc.traderTypes?.roles ?? []),
    ...(tc.traderTypes?.archetypes ?? []),
    ...(tc.marketLanguage?.calls ?? []),
    ...(tc.marketLanguage?.slang ?? []),
    ...(tc.marketLanguage?.analysisTerms ?? []),
    ...(tc.exchangeVenues?.historic ?? []),
    ...(tc.exchangeVenues?.modern ?? []),
    ...(tc.rituals?.daily ?? []),
    ...(tc.rituals?.seasonal ?? []),
  ];
}

// =============================================================================
// PHASE 5: PRICE STATES HELPERS
// =============================================================================

export function getBullMarketPhrases(): string[] {
  const ps = priceStates as any;
  return [...(ps.bullMarket?.euphoria ?? []), ...(ps.bullMarket?.confidence ?? [])];
}

export function getBearMarketPhrases(): string[] {
  const ps = priceStates as any;
  return [...(ps.bearMarket?.despair ?? []), ...(ps.bearMarket?.fear ?? [])];
}

export function getSidewaysMarketPhrases(): string[] {
  const ps = priceStates as any;
  return [
    ...(ps.sideways?.consolidation ?? ps.sidewaysMarket?.consolidation ?? []),
    ...(ps.sideways?.uncertainty ?? ps.sidewaysMarket?.uncertainty ?? []),
  ];
}

export function getVolatilityPhrases(): string[] {
  const ps = priceStates as any;
  return [...(ps.volatility?.extreme ?? []), ...(ps.volatility?.elevated ?? [])];
}

export function getTransitionPhrases(): string[] {
  const ps = priceStates as any;
  return [...(ps.transitions?.turningPoints ?? []), ...(ps.transitions?.confirmation ?? [])];
}

export function getSupplyDemandShocks(): string[] {
  const ps = priceStates as any;
  return [
    ...(ps.commoditySpecific?.supplyShocks ?? []),
    ...(ps.commoditySpecific?.demandShocks ?? []),
  ];
}

export function getAllPriceStatePhrases(): string[] {
  return [
    ...getBullMarketPhrases(),
    ...getBearMarketPhrases(),
    ...getSidewaysMarketPhrases(),
    ...getVolatilityPhrases(),
    ...getTransitionPhrases(),
    ...getSupplyDemandShocks(),
  ];
}

// =============================================================================
// PHASE 6: SENSORY HELPERS
// =============================================================================

// Visual
export function getMetallicColors(): string[] {
  return (sensoryVisual as any).colors?.metallic ?? [];
}

export function getOrganicWarmColors(): string[] {
  return (sensoryVisual as any).colors?.organic_warm ?? [];
}

export function getOrganicCoolColors(): string[] {
  return (sensoryVisual as any).colors?.organic_cool ?? [];
}

export function getEarthToneColors(): string[] {
  return (sensoryVisual as any).colors?.earth_tones ?? [];
}

export function getAllColors(): string[] {
  const sv = sensoryVisual as any;
  return [
    ...(sv.colors?.metallic ?? []),
    ...(sv.colors?.organic_warm ?? []),
    ...(sv.colors?.organic_cool ?? []),
    ...(sv.colors?.earth_tones ?? []),
  ];
}

export function getSmoothTextures(): string[] {
  return (sensoryVisual as any).textures?.smooth ?? [];
}

export function getRoughTextures(): string[] {
  return (sensoryVisual as any).textures?.rough ?? [];
}

export function getGranularTextures(): string[] {
  return (sensoryVisual as any).textures?.granular ?? [];
}

export function getFibrousTextures(): string[] {
  return (sensoryVisual as any).textures?.fibrous ?? [];
}

export function getAllTextures(): string[] {
  const sv = sensoryVisual as any;
  return [
    ...(sv.textures?.smooth ?? []),
    ...(sv.textures?.rough ?? []),
    ...(sv.textures?.granular ?? []),
    ...(sv.textures?.fibrous ?? []),
  ];
}

export function getCommodityStateAppearances(): string[] {
  return (sensoryVisual as any).appearances?.commodity_states ?? [];
}

export function getLightInteractionAppearances(): string[] {
  return (sensoryVisual as any).appearances?.light_interaction ?? [];
}

export function getMovementVisualAppearances(): string[] {
  return (sensoryVisual as any).appearances?.movement_visual ?? [];
}

export function getScalePerspectiveAppearances(): string[] {
  return (sensoryVisual as any).appearances?.scale_perspective ?? [];
}

export function getAllAppearances(): string[] {
  const sv = sensoryVisual as any;
  return [
    ...(sv.appearances?.commodity_states ?? []),
    ...(sv.appearances?.light_interaction ?? []),
    ...(sv.appearances?.movement_visual ?? []),
    ...(sv.appearances?.scale_perspective ?? []),
  ];
}

export function getAllVisualSensoryPhrases(): string[] {
  return [...getAllColors(), ...getAllTextures(), ...getAllAppearances()];
}

// Smell & Taste
export function getAllSmellTastePhrases(): string[] {
  const sst = sensorySmellTaste as any;
  return [
    ...Object.values(sst.aromas || {}).flat(),
    ...Object.values(sst.flavors || {}).flat(),
  ] as string[];
}

// Touch & Sound
export function getAllTouchSoundPhrases(): string[] {
  const sts = sensoryTouchSound as any;
  return [
    ...Object.values(sts.tactile || {}).flat(),
    ...Object.values(sts.auditory || {}).flat(),
  ] as string[];
}

export function getAllSensoryPhrases(): string[] {
  return [
    ...getAllVisualSensoryPhrases(),
    ...getAllSmellTastePhrases(),
    ...getAllTouchSoundPhrases(),
  ];
}

// Cross-population helpers for visual sensory
export function getVisualForAtmosphereCategory(): string[] {
  const sv = sensoryVisual as any;
  return [
    ...(sv.colors?.metallic ?? []),
    ...(sv.colors?.organic_warm ?? []),
    ...(sv.colors?.organic_cool ?? []),
    ...(sv.colors?.earth_tones ?? []),
    ...(sv.appearances?.light_interaction ?? []),
  ];
}

export function getVisualForEnvironmentCategory(): string[] {
  const sv = sensoryVisual as any;
  return [
    ...(sv.textures?.rough ?? []),
    ...(sv.textures?.granular ?? []),
    ...(sv.appearances?.commodity_states ?? []),
    ...(sv.appearances?.scale_perspective ?? []),
  ];
}

export function getVisualForLightingCategory(): string[] {
  return (sensoryVisual as any).appearances?.light_interaction ?? [];
}

export function getVisualForActionCategory(): string[] {
  return (sensoryVisual as any).appearances?.movement_visual ?? [];
}

// =============================================================================
// PHASE 6: HUMAN STORIES HELPERS
// =============================================================================

export function getAllWorkerArchetypes(): string[] {
  const hsw = humanStoriesWorkers as any;
  return [
    ...(hsw.worker_archetypes?.agricultural ?? []),
    ...(hsw.worker_archetypes?.industrial ?? []),
    ...(hsw.worker_archetypes?.maritime ?? []),
    ...(hsw.worker_archetypes?.extraction ?? []),
  ];
}

export function getAllLaborConditions(): string[] {
  const hsw = humanStoriesWorkers as any;
  return [
    ...(hsw.labor_conditions?.physical_states ?? []),
    ...(hsw.labor_conditions?.work_rhythms ?? []),
    ...(hsw.labor_conditions?.safety_gear ?? []),
  ];
}

export function getAllHumanMoments(): string[] {
  const hsw = humanStoriesWorkers as any;
  return [
    ...(hsw.human_moments?.solidarity ?? []),
    ...(hsw.human_moments?.personal ?? []),
    ...(hsw.human_moments?.struggle ?? []),
  ];
}

export function getAllWorkerPhrases(): string[] {
  const hsw = humanStoriesWorkers as any;
  return [
    ...Object.values(hsw.worker_archetypes || {}).flat(),
    ...Object.values(hsw.labor_conditions || {}).flat(),
    ...Object.values(hsw.human_moments || {}).flat(),
  ] as string[];
}

export function getAllTradersBrokers(): string[] {
  const hstc = humanStoriesTradersConsumers as any;
  return [
    ...(hstc.traders_brokers?.floor_traders ?? []),
    ...(hstc.traders_brokers?.modern_traders ?? []),
    ...(hstc.traders_brokers?.physical_traders ?? []),
    ...(hstc.traders_brokers?.emotional_states ?? []),
  ];
}

export function getAllConsumersEndUsers(): string[] {
  const hstc = humanStoriesTradersConsumers as any;
  return [
    ...(hstc.consumers_end_users?.retail_consumers ?? []),
    ...(hstc.consumers_end_users?.industrial_users ?? []),
    ...(hstc.consumers_end_users?.artisans_craftspeople ?? []),
  ];
}

export function getAllFamiliesCommunities(): string[] {
  const hstc = humanStoriesTradersConsumers as any;
  return [
    ...(hstc.families_communities?.producer_families ?? []),
    ...(hstc.families_communities?.trading_families ?? []),
    ...(hstc.families_communities?.consumer_families ?? []),
    ...(hstc.families_communities?.community_impact ?? []),
  ];
}

export function getAllTradersConsumersPhrases(): string[] {
  const hstc = humanStoriesTradersConsumers as any;
  return [
    ...Object.values(hstc.traders_brokers || {}).flat(),
    ...Object.values(hstc.consumers_end_users || {}).flat(),
    ...Object.values(hstc.families_communities || {}).flat(),
  ] as string[];
}

export function getAllHumanStoriesPhrases(): string[] {
  return [...getAllWorkerPhrases(), ...getAllTradersConsumersPhrases()];
}

// =============================================================================
// PHASE 7: WEATHER-COMMODITY LINKS HELPERS
// =============================================================================

export function getAllDroughtPhrases(): string[] {
  const wcl = weatherCommodityLinks as any;
  return [
    ...(wcl.drought?.visual_states ?? []),
    ...(wcl.drought?.commodity_impacts ?? []),
    ...(wcl.drought?.market_reactions ?? []),
  ];
}

export function getAllFloodPhrases(): string[] {
  const wcl = weatherCommodityLinks as any;
  return [
    ...(wcl.flood?.visual_states ?? []),
    ...(wcl.flood?.commodity_impacts ?? []),
    ...(wcl.flood?.market_reactions ?? []),
  ];
}

export function getAllFrostFreezePhrases(): string[] {
  const wcl = weatherCommodityLinks as any;
  return [
    ...(wcl.frost_freeze?.visual_states ?? []),
    ...(wcl.frost_freeze?.commodity_impacts ?? []),
    ...(wcl.frost_freeze?.market_reactions ?? []),
  ];
}

export function getAllHeatWavePhrases(): string[] {
  const wcl = weatherCommodityLinks as any;
  return [
    ...(wcl.heat_wave?.visual_states ?? []),
    ...(wcl.heat_wave?.commodity_impacts ?? []),
    ...(wcl.heat_wave?.market_reactions ?? []),
  ];
}

export function getAllStormHurricanePhrases(): string[] {
  const wcl = weatherCommodityLinks as any;
  return [
    ...(wcl.storm_hurricane?.visual_states ?? []),
    ...(wcl.storm_hurricane?.commodity_impacts ?? []),
    ...(wcl.storm_hurricane?.market_reactions ?? []),
  ];
}

export function getAllMonsoonPhrases(): string[] {
  const wcl = weatherCommodityLinks as any;
  return [
    ...(wcl.monsoon?.visual_states ?? []),
    ...(wcl.monsoon?.commodity_impacts ?? []),
    ...(wcl.monsoon?.market_reactions ?? []),
  ];
}

export function getAllSeasonalTransitionsPhrases(): string[] {
  const wcl = weatherCommodityLinks as any;
  return Object.values(wcl.seasonal_transitions || {}).flat() as string[];
}

export function getAllClimatePhenomenaPhrases(): string[] {
  const wcl = weatherCommodityLinks as any;
  return Object.values(wcl.climate_phenomena || {}).flat() as string[];
}

export function getAllWeatherCommodityPhrases(): string[] {
  return [
    ...getAllDroughtPhrases(),
    ...getAllFloodPhrases(),
    ...getAllFrostFreezePhrases(),
    ...getAllHeatWavePhrases(),
    ...getAllStormHurricanePhrases(),
    ...getAllMonsoonPhrases(),
    ...getAllSeasonalTransitionsPhrases(),
    ...getAllClimatePhenomenaPhrases(),
  ];
}

export function getWeatherForEnvironmentCategory(): string[] {
  const wcl = weatherCommodityLinks as any;
  return [
    ...(wcl.drought?.visual_states ?? []),
    ...(wcl.flood?.visual_states ?? []),
    ...(wcl.frost_freeze?.visual_states ?? []),
    ...(wcl.heat_wave?.visual_states ?? []),
    ...(wcl.storm_hurricane?.visual_states ?? []),
  ];
}

export function getWeatherForAtmosphereCategory(): string[] {
  return [...getAllSeasonalTransitionsPhrases(), ...getAllClimatePhenomenaPhrases()];
}

// =============================================================================
// PHASE 7: ABSENCE STATES HELPERS
// =============================================================================

export function getAllEmptyStoragePhrases(): string[] {
  const as = absenceStates as any;
  return Object.values(as.empty_storage || {}).flat() as string[];
}

export function getAllDepletedSourcesPhrases(): string[] {
  const as = absenceStates as any;
  return Object.values(as.depleted_sources || {}).flat() as string[];
}

export function getAllSupplyChainGapsPhrases(): string[] {
  const as = absenceStates as any;
  return Object.values(as.supply_chain_gaps || {}).flat() as string[];
}

export function getAllMarketAbsencePhrases(): string[] {
  const as = absenceStates as any;
  return Object.values(as.market_absence || {}).flat() as string[];
}

export function getAllHumanAbsencePhrases(): string[] {
  const as = absenceStates as any;
  return Object.values(as.human_absence || {}).flat() as string[];
}

export function getAllEnvironmentalAbsencePhrases(): string[] {
  const as = absenceStates as any;
  return Object.values(as.environmental_absence || {}).flat() as string[];
}

export function getAllVisualEmptinessPhrases(): string[] {
  const as = absenceStates as any;
  return Object.values(as.visual_emptiness || {}).flat() as string[];
}

export function getAllAbsenceStatesPhrases(): string[] {
  return [
    ...getAllEmptyStoragePhrases(),
    ...getAllDepletedSourcesPhrases(),
    ...getAllSupplyChainGapsPhrases(),
    ...getAllMarketAbsencePhrases(),
    ...getAllHumanAbsencePhrases(),
    ...getAllEnvironmentalAbsencePhrases(),
    ...getAllVisualEmptinessPhrases(),
  ];
}

export function getAbsenceForEnvironmentCategory(): string[] {
  return [...getAllEmptyStoragePhrases(), ...getAllDepletedSourcesPhrases()];
}

export function getAbsenceForAtmosphereCategory(): string[] {
  return [...getAllMarketAbsencePhrases(), ...getAllVisualEmptinessPhrases()];
}

export function getAbsenceForLightingCategory(): string[] {
  const as = absenceStates as any;
  return as.visual_emptiness?.light_shadow ?? [];
}

// =============================================================================
// PHASE 8: HISTORICAL MOMENTS HELPERS
// =============================================================================

export function getAllTradeRouteEraPhrases(): string[] {
  const hm = historicalMoments as any;
  return Object.values(hm.trade_route_eras || {}).flat() as string[];
}

export function getAllIndustrialRevolutionPhrases(): string[] {
  const hm = historicalMoments as any;
  return Object.values(hm.industrial_revolution || {}).flat() as string[];
}

export function getAllMarketCrisesPhrases(): string[] {
  const hm = historicalMoments as any;
  return Object.values(hm.market_crashes_crises || {}).flat() as string[];
}

export function getAllTechnologicalShiftsPhrases(): string[] {
  const hm = historicalMoments as any;
  return Object.values(hm.technological_shifts || {}).flat() as string[];
}

export function getAllDefiningMomentsPhrases(): string[] {
  const hm = historicalMoments as any;
  return Object.values(hm.defining_moments || {}).flat() as string[];
}

export function getAllHistoricalMomentsPhrases(): string[] {
  return [
    ...getAllTradeRouteEraPhrases(),
    ...getAllIndustrialRevolutionPhrases(),
    ...getAllMarketCrisesPhrases(),
    ...getAllTechnologicalShiftsPhrases(),
    ...getAllDefiningMomentsPhrases(),
  ];
}

export function getHistoricalForEnvironmentCategory(): string[] {
  return [...getAllTradeRouteEraPhrases(), ...getAllIndustrialRevolutionPhrases()];
}

export function getHistoricalForAtmosphereCategory(): string[] {
  return [...getAllMarketCrisesPhrases(), ...getAllTechnologicalShiftsPhrases()];
}

// =============================================================================
// PHASE 8: GEOPOLITICAL HELPERS
// =============================================================================

export function getAllResourceConflictsPhrases(): string[] {
  const gp = geopolitical as any;
  return Object.values(gp.resource_conflicts || {}).flat() as string[];
}

export function getAllTradePoliticsPhrases(): string[] {
  const gp = geopolitical as any;
  return Object.values(gp.trade_politics || {}).flat() as string[];
}

export function getAllPowerDynamicsPhrases(): string[] {
  const gp = geopolitical as any;
  return Object.values(gp.power_dynamics || {}).flat() as string[];
}

export function getAllRegionalHotspotsPhrases(): string[] {
  const gp = geopolitical as any;
  return Object.values(gp.regional_hotspots || {}).flat() as string[];
}

export function getAllInstitutionalFrameworkPhrases(): string[] {
  const gp = geopolitical as any;
  return Object.values(gp.institutional_framework || {}).flat() as string[];
}

export function getAllFutureTensionsPhrases(): string[] {
  const gp = geopolitical as any;
  return Object.values(gp.future_tensions || {}).flat() as string[];
}

export function getAllGeopoliticalPhrases(): string[] {
  return [
    ...getAllResourceConflictsPhrases(),
    ...getAllTradePoliticsPhrases(),
    ...getAllPowerDynamicsPhrases(),
    ...getAllRegionalHotspotsPhrases(),
    ...getAllInstitutionalFrameworkPhrases(),
    ...getAllFutureTensionsPhrases(),
  ];
}

export function getGeopoliticalForAtmosphereCategory(): string[] {
  return [
    ...getAllResourceConflictsPhrases(),
    ...getAllTradePoliticsPhrases(),
    ...getAllPowerDynamicsPhrases(),
    ...getAllFutureTensionsPhrases(),
  ];
}

export function getGeopoliticalForEnvironmentCategory(): string[] {
  return [...getAllRegionalHotspotsPhrases(), ...getAllInstitutionalFrameworkPhrases()];
}

// =============================================================================
// PHASE 9: CONTAINERS HELPERS
// =============================================================================

export function getAllBulkContainersPhrases(): string[] {
  const c = containers as any;
  return Object.values(c.bulk_containers || {}).flat() as string[];
}

export function getAllIndustrialContainersPhrases(): string[] {
  const c = containers as any;
  return Object.values(c.industrial_containers || {}).flat() as string[];
}

export function getAllPackagingPhrases(): string[] {
  const c = containers as any;
  return Object.values(c.packaging || {}).flat() as string[];
}

export function getAllTraditionalContainersPhrases(): string[] {
  const c = containers as any;
  return Object.values(c.traditional_containers || {}).flat() as string[];
}

export function getAllContainerStatesPhrases(): string[] {
  const c = containers as any;
  return Object.values(c.container_states || {}).flat() as string[];
}

export function getAllContainersPhrases(): string[] {
  return [
    ...getAllBulkContainersPhrases(),
    ...getAllIndustrialContainersPhrases(),
    ...getAllPackagingPhrases(),
    ...getAllTraditionalContainersPhrases(),
    ...getAllContainerStatesPhrases(),
  ];
}

export function getContainersForEnvironmentCategory(): string[] {
  return [...getAllBulkContainersPhrases(), ...getAllIndustrialContainersPhrases()];
}

export function getContainersForSubjectCategory(): string[] {
  return [...getAllPackagingPhrases(), ...getAllTraditionalContainersPhrases()];
}

// =============================================================================
// PHASE 9: RITUALS HELPERS
// =============================================================================

export function getAllDailyRitualsPhrases(): string[] {
  const r = rituals as any;
  return Object.values(r.daily_rituals || {}).flat() as string[];
}

export function getAllSeasonalRitualsPhrases(): string[] {
  const r = rituals as any;
  return Object.values(r.seasonal_rituals || {}).flat() as string[];
}

export function getAllProfessionalRitualsPhrases(): string[] {
  const r = rituals as any;
  return Object.values(r.professional_rituals || {}).flat() as string[];
}

export function getAllCulturalRitualsPhrases(): string[] {
  const r = rituals as any;
  return Object.values(r.cultural_rituals || {}).flat() as string[];
}

export function getAllCeremonialMomentsPhrases(): string[] {
  const r = rituals as any;
  return Object.values(r.ceremonial_moments || {}).flat() as string[];
}

export function getAllRitualsPhrases(): string[] {
  return [
    ...getAllDailyRitualsPhrases(),
    ...getAllSeasonalRitualsPhrases(),
    ...getAllProfessionalRitualsPhrases(),
    ...getAllCulturalRitualsPhrases(),
    ...getAllCeremonialMomentsPhrases(),
  ];
}

export function getRitualsForActionCategory(): string[] {
  return [...getAllDailyRitualsPhrases(), ...getAllProfessionalRitualsPhrases()];
}

export function getRitualsForAtmosphereCategory(): string[] {
  return [
    ...getAllSeasonalRitualsPhrases(),
    ...getAllCulturalRitualsPhrases(),
    ...getAllCeremonialMomentsPhrases(),
  ];
}

// =============================================================================
// PHASE 9: NIGHT OPERATIONS HELPERS
// =============================================================================

export function getAllNightShiftWorkPhrases(): string[] {
  const no = nightOperations as any;
  return Object.values(no.night_shift_work || {}).flat() as string[];
}

export function getAll247TradingPhrases(): string[] {
  const no = nightOperations as any;
  return Object.values(no['24_7_trading'] || {}).flat() as string[];
}

export function getAllNightAtmospheresPhrases(): string[] {
  const no = nightOperations as any;
  return Object.values(no.night_atmospheres || {}).flat() as string[];
}

export function getAllNightSoundsPhrases(): string[] {
  const no = nightOperations as any;
  return Object.values(no.night_sounds || {}).flat() as string[];
}

export function getAllNightLightingPhrases(): string[] {
  const no = nightOperations as any;
  return Object.values(no.night_lighting || {}).flat() as string[];
}

export function getAllNightOperationsPhrases(): string[] {
  return [
    ...getAllNightShiftWorkPhrases(),
    ...getAll247TradingPhrases(),
    ...getAllNightAtmospheresPhrases(),
    ...getAllNightSoundsPhrases(),
    ...getAllNightLightingPhrases(),
  ];
}

export function getNightForLightingCategory(): string[] {
  return getAllNightLightingPhrases();
}

export function getNightForAtmosphereCategory(): string[] {
  return [...getAllNightAtmospheresPhrases(), ...getAllNightSoundsPhrases()];
}

export function getNightForEnvironmentCategory(): string[] {
  return getAllNightShiftWorkPhrases();
}

// =============================================================================
// PHASE 10: SHARED VOCAB EXPANSION HELPERS
// =============================================================================

export function getAllUniversalActionsPhrases(): string[] {
  const sve = sharedVocabExpansion as any;
  return Object.values(sve.universal_actions || {}).flat() as string[];
}

export function getAllUniversalStatesPhrases(): string[] {
  const sve = sharedVocabExpansion as any;
  return Object.values(sve.universal_states || {}).flat() as string[];
}

export function getAllUniversalEnvironmentsPhrases(): string[] {
  const sve = sharedVocabExpansion as any;
  return Object.values(sve.universal_environments || {}).flat() as string[];
}

export function getAllUniversalAtmospheresPhrases(): string[] {
  const sve = sharedVocabExpansion as any;
  return Object.values(sve.universal_atmospheres || {}).flat() as string[];
}

export function getAllUniversalLightingPhrases(): string[] {
  const sve = sharedVocabExpansion as any;
  return Object.values(sve.universal_lighting || {}).flat() as string[];
}

export function getAllUniversalSubjectsPhrases(): string[] {
  const sve = sharedVocabExpansion as any;
  return Object.values(sve.universal_subjects || {}).flat() as string[];
}

export function getAllSharedVocabExpansionPhrases(): string[] {
  return [
    ...getAllUniversalActionsPhrases(),
    ...getAllUniversalStatesPhrases(),
    ...getAllUniversalEnvironmentsPhrases(),
    ...getAllUniversalAtmospheresPhrases(),
    ...getAllUniversalLightingPhrases(),
    ...getAllUniversalSubjectsPhrases(),
  ];
}

export function getSharedForActionCategory(): string[] {
  const sve = sharedVocabExpansion as any;
  return [...getAllUniversalActionsPhrases(), ...(sve.universal_subjects?.body_language ?? [])];
}

export function getSharedForSubjectCategory(): string[] {
  return getAllUniversalSubjectsPhrases();
}

export function getSharedForEnvironmentCategory(): string[] {
  const sve = sharedVocabExpansion as any;
  return [
    ...getAllUniversalEnvironmentsPhrases(),
    ...(sve.universal_states?.quantity ?? []),
    ...(sve.universal_states?.condition ?? []),
  ];
}

export function getSharedForAtmosphereCategory(): string[] {
  const sve = sharedVocabExpansion as any;
  return [
    ...getAllUniversalAtmospheresPhrases(),
    ...(sve.universal_states?.quality ?? []),
    ...(sve.universal_states?.time ?? []),
  ];
}

export function getSharedForLightingCategory(): string[] {
  return getAllUniversalLightingPhrases();
}

// =============================================================================
// PHASE 10: CROSS-POPULATION MERGE HELPERS
// =============================================================================

export const getMetalsToEnergyBridges = (): string[] =>
  (crossPopulationMerge as any).categoryBridges?.metalsToEnergy?.phrases ?? [];

export const getEnergyToAgricultureBridges = (): string[] =>
  (crossPopulationMerge as any).categoryBridges?.energyToAgriculture?.phrases ?? [];

export const getAgricultureToMetalsBridges = (): string[] =>
  (crossPopulationMerge as any).categoryBridges?.agricultureToMetals?.phrases ?? [];

export const getSoftsToCurrenciesBridges = (): string[] =>
  (crossPopulationMerge as any).categoryBridges?.softsToCurrencies?.phrases ?? [];

export const getLivestockToGrainsBridges = (): string[] =>
  (crossPopulationMerge as any).categoryBridges?.livestockToGrains?.phrases ?? [];

export const getPreciousToIndustrialBridges = (): string[] =>
  (crossPopulationMerge as any).categoryBridges?.preciousToIndustrial?.phrases ?? [];

export const getTropicalToTemperateBridges = (): string[] =>
  (crossPopulationMerge as any).categoryBridges?.tropicalToTemperate?.phrases ?? [];

export const getBulkToPrecisionBridges = (): string[] =>
  (crossPopulationMerge as any).categoryBridges?.bulkToPrecision?.phrases ?? [];

export const getFossilToRenewableBridges = (): string[] =>
  (crossPopulationMerge as any).categoryBridges?.fossilToRenewable?.phrases ?? [];

export const getLandToSeaBridges = (): string[] =>
  (crossPopulationMerge as any).categoryBridges?.landToSea?.phrases ?? [];

export const getAllCategoryBridges = (): string[] => {
  const cpm = crossPopulationMerge as any;
  const bridges = cpm.categoryBridges || {};
  return Object.values(bridges).flatMap((b: any) => b?.phrases ?? []) as string[];
};

export const getTemporalBridges = (): string[] =>
  (crossPopulationMerge as any).transitionPhrases?.temporalBridges?.phrases ?? [];

export const getScaleBridges = (): string[] =>
  (crossPopulationMerge as any).transitionPhrases?.scaleBridges?.phrases ?? [];

export const getProcessBridges = (): string[] =>
  (crossPopulationMerge as any).transitionPhrases?.processBridges?.phrases ?? [];

export const getGeographicBridges = (): string[] =>
  (crossPopulationMerge as any).transitionPhrases?.geographicBridges?.phrases ?? [];

export const getAllTransitionBridges = (): string[] => {
  const cpm = crossPopulationMerge as any;
  const transitions = cpm.transitionPhrases || {};
  return Object.values(transitions).flatMap((t: any) => t?.phrases ?? []) as string[];
};

export const getUniversalPrinciples = (): string[] =>
  (crossPopulationMerge as any).unifyingConcepts?.universalPrinciples?.phrases ?? [];

export const getSharedVocabulary = (): string[] =>
  (crossPopulationMerge as any).unifyingConcepts?.sharedVocabulary?.phrases ?? [];

export const getAllUnifyingConcepts = (): string[] => {
  const cpm = crossPopulationMerge as any;
  const concepts = cpm.unifyingConcepts || {};
  return Object.values(concepts).flatMap((c: any) => c?.phrases ?? []) as string[];
};

export const getAllCrossPopulationPhrases = (): string[] => [
  ...getAllCategoryBridges(),
  ...getAllTransitionBridges(),
  ...getAllUnifyingConcepts(),
];

type BridgeCommodityCategory =
  | 'metals'
  | 'energy'
  | 'agriculture'
  | 'softs'
  | 'currencies'
  | 'livestock'
  | 'grains'
  | 'precious'
  | 'industrial'
  | 'tropical'
  | 'temperate'
  | 'bulk'
  | 'precision'
  | 'fossil'
  | 'renewable'
  | 'land'
  | 'sea';

const bridgeMap: Record<string, () => string[]> = {
  'metals-energy': getMetalsToEnergyBridges,
  'energy-metals': getMetalsToEnergyBridges,
  'energy-agriculture': getEnergyToAgricultureBridges,
  'agriculture-energy': getEnergyToAgricultureBridges,
  'agriculture-metals': getAgricultureToMetalsBridges,
  'metals-agriculture': getAgricultureToMetalsBridges,
  'softs-currencies': getSoftsToCurrenciesBridges,
  'currencies-softs': getSoftsToCurrenciesBridges,
  'livestock-grains': getLivestockToGrainsBridges,
  'grains-livestock': getLivestockToGrainsBridges,
  'precious-industrial': getPreciousToIndustrialBridges,
  'industrial-precious': getPreciousToIndustrialBridges,
  'tropical-temperate': getTropicalToTemperateBridges,
  'temperate-tropical': getTropicalToTemperateBridges,
  'bulk-precision': getBulkToPrecisionBridges,
  'precision-bulk': getBulkToPrecisionBridges,
  'fossil-renewable': getFossilToRenewableBridges,
  'renewable-fossil': getFossilToRenewableBridges,
  'land-sea': getLandToSeaBridges,
  'sea-land': getLandToSeaBridges,
};

export const getBridgePhrases = (
  categoryA: BridgeCommodityCategory,
  categoryB: BridgeCommodityCategory,
): string[] => {
  const key = `${categoryA}-${categoryB}`;
  const getter = bridgeMap[key];
  return getter ? getter() : [];
};

// FIXED: Added proper undefined handling for randomType and randomPhrase
export const getRandomCategoryBridge = (): { bridgeType: string; phrase: string } => {
  const cpm = crossPopulationMerge as CrossPopulationData;
  const bridgeTypes = Object.keys(cpm.categoryBridges || {});
  if (bridgeTypes.length === 0) return { bridgeType: '', phrase: '' };
  const randomType = bridgeTypes[Math.floor(Math.random() * bridgeTypes.length)] ?? '';
  if (!randomType) return { bridgeType: '', phrase: '' };
  const phrases = cpm.categoryBridges[randomType]?.phrases ?? [];
  const randomPhrase = phrases[Math.floor(Math.random() * phrases.length)] ?? '';
  return { bridgeType: randomType, phrase: randomPhrase };
};

// FIXED: Added proper undefined handling for randomType and randomPhrase
export const getRandomTransitionPhrase = (): { transitionType: string; phrase: string } => {
  const cpm = crossPopulationMerge as CrossPopulationData;
  const transitionTypes = Object.keys(cpm.transitionPhrases || {});
  if (transitionTypes.length === 0) return { transitionType: '', phrase: '' };
  const randomType = transitionTypes[Math.floor(Math.random() * transitionTypes.length)] ?? '';
  if (!randomType) return { transitionType: '', phrase: '' };
  const phrases = cpm.transitionPhrases[randomType]?.phrases ?? [];
  const randomPhrase = phrases[Math.floor(Math.random() * phrases.length)] ?? '';
  return { transitionType: randomType, phrase: randomPhrase };
};

// FIXED: Added proper undefined handling for array access
export const getRandomCrossPopulationPhrase = (): string => {
  const allPhrases = getAllCrossPopulationPhrases();
  if (allPhrases.length === 0) return '';
  return allPhrases[Math.floor(Math.random() * allPhrases.length)] ?? '';
};

// =============================================================================
// PHASE AGGREGATORS
// =============================================================================

export function getAllPhase6Phrases(): string[] {
  return [...getAllSensoryPhrases(), ...getAllHumanStoriesPhrases()];
}

export function getAllPhase7Phrases(): string[] {
  return [...getAllWeatherCommodityPhrases(), ...getAllAbsenceStatesPhrases()];
}

export function getAllPhase8Phrases(): string[] {
  return [...getAllHistoricalMomentsPhrases(), ...getAllGeopoliticalPhrases()];
}

export function getAllPhase9Phrases(): string[] {
  return [
    ...getAllContainersPhrases(),
    ...getAllRitualsPhrases(),
    ...getAllNightOperationsPhrases(),
  ];
}

export function getAllPhase10Phrases(): string[] {
  return [...getAllSharedVocabExpansionPhrases(), ...getAllCrossPopulationPhrases()];
}

// =============================================================================
// MASTER CROSS-POPULATION FOR PROMPT BUILDER
// =============================================================================

/**
 * Get all phrases suitable for a specific Prompt Builder category
 */
export function getAllPhrasesForCategory(category: string): string[] {
  switch (category.toLowerCase()) {
    case 'subject':
      return [
        ...getVibesForSubjectCategory(),
        ...getCommodityTraders(),
        ...getTraderRoles(),
        ...getTraderArchetypes(),
        ...getAllHumanStoriesPhrases(),
        ...getContainersForSubjectCategory(),
        ...getSharedForSubjectCategory(),
      ];
    case 'environment':
      return [
        ...getVibesForEnvironmentCategory(),
        ...getRegionPhrasesForEnvironmentCategory(),
        ...getEndUseSectorsForEnvironmentCategory(),
        ...getVisualForEnvironmentCategory(),
        ...getWeatherForEnvironmentCategory(),
        ...getAbsenceForEnvironmentCategory(),
        ...getHistoricalForEnvironmentCategory(),
        ...getGeopoliticalForEnvironmentCategory(),
        ...getContainersForEnvironmentCategory(),
        ...getNightForEnvironmentCategory(),
        ...getSharedForEnvironmentCategory(),
      ];
    case 'atmosphere':
      return [
        ...getVibesForAtmosphereCategory(),
        ...getAllPriceStatePhrases(),
        ...getVisualForAtmosphereCategory(),
        ...getWeatherForAtmosphereCategory(),
        ...getAbsenceForAtmosphereCategory(),
        ...getHistoricalForAtmosphereCategory(),
        ...getGeopoliticalForAtmosphereCategory(),
        ...getRitualsForAtmosphereCategory(),
        ...getNightForAtmosphereCategory(),
        ...getSharedForAtmosphereCategory(),
      ];
    case 'lighting':
      return [
        ...getVibesForLightingCategory(),
        ...getVisualForLightingCategory(),
        ...getAbsenceForLightingCategory(),
        ...getNightForLightingCategory(),
        ...getSharedForLightingCategory(),
        ...getAllLightingLinks(),
      ];
    case 'action':
      return [
        ...getStagesForActionCategory(),
        ...getExtractionMethodsForActionCategory(),
        ...getVisualForActionCategory(),
        ...getRitualsForActionCategory(),
        ...getSharedForActionCategory(),
      ];
    case 'materials':
      return [...getAllTextures(), ...getAllColors(), ...getAllContainersPhrases()];
    default:
      return [];
  }
}

// =============================================================================
// CROSS-POPULATION SUMMARY
// =============================================================================

/**
 * Get summary of phrases available for each Prompt Builder category
 */
export function getCrossPopulationSummary(): CrossPopulationSummary {
  return {
    subject: getAllPhrasesForCategory('subject').length,
    environment: getAllPhrasesForCategory('environment').length,
    atmosphere: getAllPhrasesForCategory('atmosphere').length,
    lighting: getAllPhrasesForCategory('lighting').length,
    action: getAllPhrasesForCategory('action').length,
    totalPhrases: getAllVibes().length + getAllStages().length + getAllRegionPhrases().length,
    grandTotal: getVocabularyStats().grandTotal,
  };
}

// =============================================================================
// STATISTICS
// =============================================================================

export function getVocabularyStats(): VocabularyStats {
  return {
    phase1_vibes: 936,
    phase2_transformations: 624,
    phase3_production_countries: 390,
    phase4_extraction_end_use: 468,
    phase5_trading_price: 245,
    phase6_sensory_human: 556,
    phase7_weather_absence: 600,
    phase8_historical_geopolitical: 500,
    phase9_containers_rituals_night: 674,
    phase10_shared_cross_population: 400,
    grandTotal: 5393,
  };
}

export function getCrossPopulationStats() {
  const cpm = crossPopulationMerge as any;
  return {
    totalPhrases: cpm.metadata?.totalPhrases ?? 0,
    categoryBridges: {
      count: Object.keys(cpm.categoryBridges || {}).length,
      phrases: getAllCategoryBridges().length,
    },
    transitionPhrases: {
      count: Object.keys(cpm.transitionPhrases || {}).length,
      phrases: getAllTransitionBridges().length,
    },
    unifyingConcepts: {
      count: Object.keys(cpm.unifyingConcepts || {}).length,
      phrases: getAllUnifyingConcepts().length,
    },
  };
}

// =============================================================================
// COMMODITIES METADATA
// =============================================================================

export const COMMODITIES_META = {
  version: (commodityVibes as any).version ?? '2.0.0',
  totalCommodities: Object.keys(typedCommodityVibes.commodities).length,
  phasesComplete: (commodityVibes as any).meta?.phasesComplete ?? [],
  updated: (commodityVibes as any).meta?.updated ?? '2026-02-05',
};

// =============================================================================
// DEFAULT EXPORT
// =============================================================================

export default {
  // Data
  commodityVibes,
  transformationStates,
  productionCountries,
  extractionMethods,
  endUseSectors,
  tradingCulture,
  priceStates,
  sensoryVisual,
  sensorySmellTaste,
  sensoryTouchSound,
  humanStoriesWorkers,
  humanStoriesTradersConsumers,
  weatherCommodityLinks,
  absenceStates,
  historicalMoments,
  geopolitical,
  containers,
  rituals,
  nightOperations,
  sharedVocabExpansion,
  crossPopulationMerge,

  // Phase 1
  getCommodityIds,
  getCommodity,
  getVibesForCommodity,
  getRandomVibe,
  getCommodityVisualIcons,
  getCommodityAtmosphereLinks,
  getCommodityLightingLinks,
  getCommoditiesByCategory,
  getCommoditiesByExtractionMethod,
  getCommoditiesByCountry,
  getAllCategories,
  getAllVibes,
  getVibesForSubjectCategory,
  getVibesForEnvironmentCategory,
  getVibesForAtmosphereCategory,
  getVibesForLightingCategory,
  getAllAtmosphereLinks,
  getAllLightingLinks,

  // Phase 2
  getStagesForCommodity,
  getAllStages,
  getStagesForActionCategory,
  getAllTransformationPhrases,
  getRandomStage,

  // Phase 3
  getProductionForCommodity,
  getRegionPhrasesForCommodity,
  getTopProducers,
  getAllRegionPhrases,
  getRegionPhrasesForEnvironmentCategory,

  // Phase 4
  getExtractionMethodsForCommodity,
  getAllExtractionMethods,
  getExtractionMethodsForActionCategory,
  getEndUseSectorsForCommodity,
  getAllEndUseSectors,
  getEndUseSectorsForEnvironmentCategory,

  // Phase 5
  getAllTradingCulturePhrases,
  getAllPriceStatePhrases,
  getBullMarketPhrases,
  getBearMarketPhrases,
  getSidewaysMarketPhrases,
  getVolatilityPhrases,
  getTransitionPhrases,
  getSupplyDemandShocks,

  // Phase 6
  getAllSensoryPhrases,
  getAllVisualSensoryPhrases,
  getAllSmellTastePhrases,
  getAllTouchSoundPhrases,
  getAllHumanStoriesPhrases,
  getAllWorkerPhrases,
  getAllTradersConsumersPhrases,

  // Phase 7
  getAllWeatherCommodityPhrases,
  getAllAbsenceStatesPhrases,

  // Phase 8
  getAllHistoricalMomentsPhrases,
  getAllGeopoliticalPhrases,

  // Phase 9
  getAllContainersPhrases,
  getAllRitualsPhrases,
  getAllNightOperationsPhrases,

  // Phase 10
  getAllSharedVocabExpansionPhrases,
  getAllCrossPopulationPhrases,
  getAllCategoryBridges,
  getAllTransitionBridges,
  getAllUnifyingConcepts,
  getBridgePhrases,
  getRandomCategoryBridge,
  getRandomTransitionPhrase,
  getRandomCrossPopulationPhrase,

  // Phase aggregators
  getAllPhase6Phrases,
  getAllPhase7Phrases,
  getAllPhase8Phrases,
  getAllPhase9Phrases,
  getAllPhase10Phrases,

  // Cross-population
  getAllPhrasesForCategory,
  getCrossPopulationSummary,

  // Stats
  getVocabularyStats,
  getCrossPopulationStats,
  COMMODITIES_META,
};
