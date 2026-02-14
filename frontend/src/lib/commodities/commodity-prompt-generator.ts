// src/lib/commodities/commodity-prompt-generator.ts
// ============================================================================
// COMMODITY PROMPT GENERATOR v4.0 — Blueprint-Driven
// ============================================================================
//
// v4.0: Blueprint integration. Authored prompts from JSON blueprints
//       (78 commodities, 336 stages, 1,222 environments) replace the
//       generic weather-phrase system. All 4 tiers always generated.
//       No temperature numbers in any output.
//
// v3.0: Same engine as city system (getTempFeel, getWindEnergy, getTimeMood).
//       Retained as LEGACY FALLBACK if no blueprint exists.
//
// DATA FLOW:
//   input → resolveBlueprint() → ResolvedBlueprint → assemble 4 tiers
//   input → (no blueprint?) → legacy assemblePhrases() → assemble 4 tiers
//
// BLUEPRINT OUTPUT EXAMPLE (Tier 4 — Plain):
//   "Steel offshore oil production platform rising from a grey churning sea,
//    multiple deck levels with derrick tower above, gas flare burning orange
//    at the boom tip. Norwegian Continental Shelf, massive concrete gravity-base
//    platform in deep water. Overcast clouds. Warm golden-hour light with long
//    dramatic shadows, sun low on the western horizon"
//
// LEGACY OUTPUT EXAMPLE (Tier 4 — Plain):
//   "Brent Crude in Norway, overcast clouds, deep night stillness,
//    soft ambient glow, sharp winter chill, comfortable air movement"
//
// Existing features preserved: Yes (all exports, glow, sentiment, selectSceneCountry)
// ============================================================================

import type {
  CommodityPromptInput,
  CommodityPromptOutput,
  CommodityGroup,
  SentimentLevel,
  GlowConfig,
  AllTierPrompts,
} from './commodity-prompt-types';

import type { ResolvedBlueprint } from './prompt-blueprint-types';
import { resolveBlueprint } from './prompt-blueprint-resolver';

import {
  getTempFeel,
  getWindEnergy,
  getTimeMood,
} from '@/lib/weather/weather-prompt-generator';

// ============================================================================
// COUNTRY NAME LOOKUP
// ============================================================================

const COUNTRY_NAMES: Record<string, string> = {
  AE: 'UAE', AR: 'Argentina', AT: 'Austria', AU: 'Australia',
  BD: 'Bangladesh', BE: 'Belgium', BG: 'Bulgaria', BM: 'Bermuda',
  BR: 'Brazil', CA: 'Canada', CH: 'Switzerland', CI: "Côte d'Ivoire",
  CL: 'Chile', CM: 'Cameroon', CN: 'China', CO: 'Colombia',
  CZ: 'Czechia', DE: 'Germany', DK: 'Denmark', EE: 'Estonia',
  EG: 'Egypt', ES: 'Spain', FI: 'Finland', FR: 'France',
  GB: 'United Kingdom', GR: 'Greece', HK: 'Hong Kong', HU: 'Hungary',
  ID: 'Indonesia', IE: 'Ireland', IL: 'Israel', IN: 'India',
  IR: 'Iran', IS: 'Iceland', IT: 'Italy', JM: 'Jamaica',
  JP: 'Japan', KE: 'Kenya', KR: 'South Korea', LK: 'Sri Lanka',
  LT: 'Lithuania', LV: 'Latvia', MA: 'Morocco', MX: 'Mexico',
  MY: 'Malaysia', NG: 'Nigeria', NL: 'Netherlands', NO: 'Norway',
  NZ: 'New Zealand', PA: 'Panama', PE: 'Peru', PH: 'Philippines',
  PK: 'Pakistan', PL: 'Poland', PY: 'Paraguay', RO: 'Romania',
  RU: 'Russia', SA: 'Saudi Arabia', SE: 'Sweden', SG: 'Singapore',
  TH: 'Thailand', TN: 'Tunisia', TR: 'Türkiye', TT: 'Trinidad',
  TW: 'Taiwan', US: 'United States', UY: 'Uruguay', VN: 'Vietnam',
  ZA: 'South Africa', EU: 'Europe',
};

function getCountryName(code: string): string {
  return COUNTRY_NAMES[code.toUpperCase()] ?? code;
}

// ============================================================================
// SEEDED RANDOM
// ============================================================================

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9999) * 10000;
  return x - Math.floor(x);
}

function buildSeed(commodityId: string, sceneCountryCode: string, deltaPct: number): number {
  let hash = 0;
  const str = `${commodityId}:${sceneCountryCode}:${Math.round(deltaPct * 100)}`;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

// ============================================================================
// SENTIMENT (glow only — NOT in prompt text)
// ============================================================================
// 3-level positive-only scale matching SentimentLevel type.

export function deriveSentiment(deltaPct: number): SentimentLevel {
  if (deltaPct > 2) return 'confident';
  if (deltaPct > 0) return 'optimistic';
  return 'neutral';
}

// ============================================================================
// BLUEPRINT-BASED TIER ASSEMBLY
// ============================================================================
// Assembles the 4 tier prompts from a ResolvedBlueprint.
// Each tier formats the same data differently for its target platform.
// No temperature numbers anywhere.

/**
 * Tier 1: CLIP-Based (Stable Diffusion, Leonardo, Flux, ComfyUI)
 * Weighted tokens, negative prompt suffix.
 * Focused: subject + environment + time lighting. No lens/enhancer (too verbose for CLIP).
 */
function blueprintTier1(r: ResolvedBlueprint): string {
  const parts: string[] = [
    `(${r.subject}:1.4)`,
    `(${r.environment}:1.2)`,
    r.weatherDescription,
    `(${r.timeLighting}:1.2)`,
    'photorealistic',
    'cinematic lighting',
    '8k',
  ].filter(Boolean) as string[];

  return `${parts.join(', ')} --no people text watermarks logos blurry`;
}

/**
 * Tier 2: Midjourney / BlueWillow
 * Comma-separated with MJ flags. Handles long prompts well.
 * Includes enhancer for rich physical detail.
 */
function blueprintTier2(r: ResolvedBlueprint): string {
  const parts: string[] = [
    r.subject,
    r.environment,
    r.enhancer,
    r.weatherDescription,
    r.timeLighting,
  ].filter(Boolean) as string[];

  return `${parts.join(', ')} --ar 16:9 --stylize 100 --no people text`;
}

/**
 * Tier 3: Natural Language (DALL·E, Imagen, Adobe Firefly)
 * Flowing prose with full detail including enhancer and time modifier.
 */
function blueprintTier3(r: ResolvedBlueprint): string {
  const sentences: string[] = [];

  // Core scene
  sentences.push(`${r.subject}.`);

  // Location
  sentences.push(`Set in ${r.environment}.`);

  // Physical detail
  sentences.push(r.enhancer + '.');

  // Weather
  if (r.weatherDescription) {
    sentences.push(`The sky shows ${r.weatherDescription}.`);
  }

  // Time-of-day atmosphere
  sentences.push(r.timeLighting + '.');

  // Quality suffix
  sentences.push('Photorealistic, highly detailed, cinematic composition. No people or text visible.');

  return sentences.join(' ');
}

/**
 * Tier 4: Plain Language (Canva, Craiyon, Microsoft Designer)
 * Simplest format. Core scene + location + weather + time.
 * No enhancer, no lens, no modifier (keep it digestible for simple generators).
 */
function blueprintTier4(r: ResolvedBlueprint): string {
  const parts: string[] = [
    r.subject,
    r.environment,
    r.weatherDescription,
    r.timeLighting,
  ].filter(Boolean) as string[];

  return parts.join('. ');
}

/**
 * Generate all 4 tiers from a resolved blueprint.
 */
function assembleAllBlueprintTiers(r: ResolvedBlueprint): AllTierPrompts {
  return {
    tier1: blueprintTier1(r),
    tier2: blueprintTier2(r),
    tier3: blueprintTier3(r),
    tier4: blueprintTier4(r),
  };
}

// ============================================================================
// LEGACY TIER ASSEMBLY (fallback when no blueprint exists)
// ============================================================================
// Retained from v3.0. Uses weather phrase engine (getTempFeel, getWindEnergy,
// getTimeMood). No temperature numbers — removed from output.

interface LegacyPhrases {
  subject: string;
  description: string | null;
  mood: string;
  lighting: string;
  tempFeel: string;
  wind: string;
}

function assembleLegacyPhrases(input: CommodityPromptInput): LegacyPhrases {
  const country = getCountryName(input.sceneCountryCode);
  const subject = `${input.commodityName} in ${country}`;

  if (input.weather) {
    const timeMood = getTimeMood(input.localHour);
    const tempData = getTempFeel(input.weather.temperatureC);
    const windPhrase = getWindEnergy(input.weather.windSpeedKmh ?? 10);

    return {
      subject,
      description: input.weather.description || null,
      mood: timeMood.mood,
      lighting: timeMood.lighting,
      tempFeel: tempData.atmosphere,
      wind: windPhrase,
    };
  }

  const timeMood = getTimeMood(input.localHour);
  return {
    subject,
    description: null,
    mood: timeMood.mood,
    lighting: timeMood.lighting,
    tempFeel: input.season,
    wind: '',
  };
}

function legacyTier1(p: LegacyPhrases): string {
  const parts: string[] = [
    `(${p.subject}:1.4)`,
    p.description,
    `(${p.mood}:1.2)`,
    `(${p.lighting}:1.2)`,
    p.tempFeel,
    p.wind,
    'masterpiece',
    'best quality',
    '8k',
    'photorealistic',
  ].filter(Boolean) as string[];

  return `${parts.join(', ')} --no people text watermarks logos blurry`;
}

function legacyTier2(p: LegacyPhrases): string {
  const parts: string[] = [
    p.subject,
    p.description,
    p.mood,
    p.lighting,
    p.tempFeel,
    p.wind,
  ].filter(Boolean) as string[];

  return `${parts.join(', ')} --ar 16:9 --stylize 100 --no people text`;
}

function legacyTier3(p: LegacyPhrases): string {
  const descClause = p.description ? ` with ${p.description}` : '';
  const windClause = p.wind ? ` ${p.wind} in the air.` : '';

  return [
    `A ${p.mood} scene of ${p.subject}${descClause}, with ${p.lighting} illuminating the landscape.`,
    `The atmosphere is ${p.tempFeel}.${windClause}`,
    'Photorealistic, highly detailed, cinematic composition. No people or text visible.',
  ].join(' ');
}

function legacyTier4(p: LegacyPhrases): string {
  const parts: string[] = [
    p.subject,
    p.description,
    p.mood,
    p.lighting,
    p.tempFeel,
    p.wind,
  ].filter(Boolean) as string[];

  return parts.join(', ');
}

function assembleAllLegacyTiers(input: CommodityPromptInput): AllTierPrompts {
  const p = assembleLegacyPhrases(input);
  return {
    tier1: legacyTier1(p),
    tier2: legacyTier2(p),
    tier3: legacyTier3(p),
    tier4: legacyTier4(p),
  };
}

// ============================================================================
// MAIN GENERATOR
// ============================================================================

/**
 * Generate commodity prompt with all 4 tier variants.
 *
 * Flow:
 *   1. Try blueprint resolver (78 commodities covered)
 *   2. If blueprint found → assemble from authored data (rich, unique prompts)
 *   3. If no blueprint → fall back to legacy weather-phrase system
 *   4. Always returns all 4 tiers + the displayed tier's prompt
 *
 * @param input - Standard commodity prompt input
 * @returns Full output including all 4 tiers, glow data, and metadata
 */
export function generateCommodityPrompt(input: CommodityPromptInput): CommodityPromptOutput {
  const seed = buildSeed(input.commodityId, input.sceneCountryCode, input.deltaPct);
  const sentiment = deriveSentiment(input.deltaPct);

  // Try blueprint-driven generation first
  const resolved = resolveBlueprint(input);

  let allPrompts: AllTierPrompts;
  let blueprintUsed: boolean;

  if (resolved) {
    // Blueprint found — use authored content
    allPrompts = assembleAllBlueprintTiers(resolved);
    blueprintUsed = true;
  } else {
    // No blueprint — fall back to legacy weather-phrase system
    allPrompts = assembleAllLegacyTiers(input);
    blueprintUsed = false;
  }

  // Select the displayed prompt based on requested tier
  let prompt: string;
  switch (input.tier) {
    case 1:  prompt = allPrompts.tier1; break;
    case 2:  prompt = allPrompts.tier2; break;
    case 3:  prompt = allPrompts.tier3; break;
    case 4:
    default: prompt = allPrompts.tier4; break;
  }

  return {
    prompt,
    allPrompts,
    tier: input.tier,
    group: input.group,
    sentiment,
    sceneCountryCode: input.sceneCountryCode,
    season: input.season,
    weatherUsed: input.weather !== null,
    seed,
    blueprintUsed,
  };
}

// ============================================================================
// GLOW CONFIGURATION
// ============================================================================
// Uses 3-level sentiment: confident (warm), optimistic (warm), neutral (cool).

export function getGlowConfig(group: CommodityGroup, sentiment: SentimentLevel): GlowConfig {
  const isWarm = sentiment === 'confident' || sentiment === 'optimistic';

  switch (group) {
    case 'energy':
      return isWarm
        ? { borderClass: 'border-amber-400/70', shadowClass: 'shadow-amber-400/40', glowColor: '#fbbf24' }
        : { borderClass: 'border-amber-600/50', shadowClass: 'shadow-amber-600/20', glowColor: '#d97706' };
    case 'agriculture':
      return isWarm
        ? { borderClass: 'border-emerald-400/70', shadowClass: 'shadow-emerald-400/40', glowColor: '#34d399' }
        : { borderClass: 'border-emerald-600/50', shadowClass: 'shadow-emerald-600/20', glowColor: '#059669' };
    case 'metals':
      return isWarm
        ? { borderClass: 'border-slate-300/70', shadowClass: 'shadow-slate-300/40', glowColor: '#cbd5e1' }
        : { borderClass: 'border-slate-500/50', shadowClass: 'shadow-slate-500/20', glowColor: '#64748b' };
    default:
      return { borderClass: 'border-slate-400/50', shadowClass: 'shadow-slate-400/20', glowColor: '#94a3b8' };
  }
}

// ============================================================================
// SCENE COUNTRY SELECTOR
// ============================================================================

export function selectSceneCountry(
  pool: readonly string[],
  commodityId: string,
  deltaPct: number,
): string {
  if (pool.length === 0) return 'US';
  if (pool.length === 1) return pool[0]!;
  const seed = buildSeed(commodityId, 'SCENE', deltaPct);
  const idx = Math.floor(seededRandom(seed) * pool.length);
  return pool[idx]!;
}

// ============================================================================
// RE-EXPORTS
// ============================================================================

export { TIER_INFO, type TierInfo } from '@/lib/weather/weather-prompt-generator';
export type { PromptTier } from '@/lib/weather/weather-prompt-generator';
