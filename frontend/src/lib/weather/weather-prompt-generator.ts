// src/lib/weather/weather-prompt-generator.ts
// ============================================================================
// WEATHER PROMPT GENERATOR v2.0 - INTELLIGENT 4-TIER SYSTEM
// ============================================================================
// Generates dynamic image prompts from weather data with MASSIVE vocabulary.
//
// VOCABULARY SCALE:
// - Temperature: 61 values (-10°C to 50°C) × 30 options = 1,830 phrases
// - Humidity: 101 values (0-100%) × 5 options = 505 phrases
// - Wind: 101 values (0-100 km/h) × 4 options = 404 phrases
// - Time: 48 slots (30-min intervals) × 5 options = 240 phrases
// - Conditions: 15 emoji types × 10 options = 150 phrases
// - Cities: 50+ cities × 5 vibes = 250+ phrases
// TOTAL: ~3,400 unique phrases
//
// INTELLIGENT SELECTION:
// - Seeded random for consistency within same conditions
// - Best-fit algorithm considers synergy between conditions
// - Context flags: isStormy, isRainy, isCold, isHot, isDry, isHumid, isWindy
//
// NO EMOJI IN OUTPUT: All weather emojis replaced with descriptive text
//
// Authority: docs/authority/ai_providers.md §4-Tier Prompt System
// Existing features preserved: Yes
// ============================================================================

import type { ExchangeWeatherFull } from './weather-types';

// ============================================================================
// TYPES
// ============================================================================

export type PromptTier = 1 | 2 | 3 | 4;

export interface TierInfo {
  tier: PromptTier;
  name: string;
  description: string;
  platforms: string[];
  gradient: string;
}

export interface WeatherPromptInput {
  city: string;
  weather: ExchangeWeatherFull;
  localHour: number;
  tier: PromptTier;
}

interface WeatherContext {
  tempC: number;
  humidity: number;
  windKmh: number;
  hour: number;
  minute: number;
  condition: string;
  description: string;
  emoji: string;
  // Derived flags
  isStormy: boolean;
  isRainy: boolean;
  isCold: boolean;
  isHot: boolean;
  isDry: boolean;
  isHumid: boolean;
  isWindy: boolean;
  isNight: boolean;
  isDawn: boolean;
  isDusk: boolean;
}

// ============================================================================
// TIER METADATA
// ============================================================================

export const TIER_INFO: Record<PromptTier, TierInfo> = {
  1: {
    tier: 1,
    name: 'CLIP-Based',
    description: 'Weighted keywords with emphasis markers',
    platforms: ['Stable Diffusion', 'Leonardo', 'Flux', 'ComfyUI'],
    gradient: 'from-violet-500 to-purple-600',
  },
  2: {
    tier: 2,
    name: 'Midjourney',
    description: 'Natural flow with parameter flags',
    platforms: ['Midjourney', 'BlueWillow', 'Niji'],
    gradient: 'from-blue-500 to-indigo-600',
  },
  3: {
    tier: 3,
    name: 'Natural Language',
    description: 'Full descriptive sentences',
    platforms: ['DALL·E', 'Imagen', 'Adobe Firefly', 'Bing Image Creator'],
    gradient: 'from-emerald-500 to-teal-600',
  },
  4: {
    tier: 4,
    name: 'Plain Language',
    description: 'Simple, minimal prompts',
    platforms: ['Canva', 'Craiyon', 'Artistly', 'Microsoft Designer'],
    gradient: 'from-amber-500 to-orange-600',
  },
};

// ============================================================================
// SEEDED RANDOM FOR CONSISTENT SELECTION
// ============================================================================

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9999) * 10000;
  return x - Math.floor(x);
}

function selectFromPool<T>(pool: T[], seed: number, bestFitIndices?: number[]): T {
  if (pool.length === 0) {
    throw new Error('selectFromPool: pool cannot be empty');
  }

  // 70% chance to use best-fit if available, 30% pure random
  const useBestFit = bestFitIndices && bestFitIndices.length > 0 && seededRandom(seed * 1.5) < 0.7;

  if (useBestFit && bestFitIndices) {
    const bestIdx = bestFitIndices[Math.floor(seededRandom(seed) * bestFitIndices.length)];
    const idx = bestIdx !== undefined ? Math.min(bestIdx, pool.length - 1) : 0;
    return pool[idx]!;
  }

  const idx = Math.floor(seededRandom(seed) * pool.length);
  return pool[idx]!;
}

// ============================================================================
// CONTEXT BUILDER
// ============================================================================

function buildContext(weather: ExchangeWeatherFull, localHour: number): WeatherContext {
  const desc = (weather.description || '').toLowerCase();
  const cond = (weather.conditions || '').toLowerCase();

  return {
    tempC: weather.temperatureC,
    humidity: weather.humidity,
    windKmh: weather.windSpeedKmh,
    hour: localHour,
    minute: 0,
    condition: weather.conditions,
    description: weather.description,
    emoji: weather.emoji,
    // Derived
    isStormy:
      desc.includes('storm') ||
      desc.includes('thunder') ||
      cond.includes('thunder') ||
      cond.includes('storm'),
    isRainy:
      desc.includes('rain') ||
      desc.includes('drizzle') ||
      cond.includes('rain') ||
      cond.includes('drizzle'),
    isCold: weather.temperatureC < 10,
    isHot: weather.temperatureC > 28,
    isDry: weather.humidity < 40,
    isHumid: weather.humidity > 70,
    isWindy: weather.windSpeedKmh > 25,
    isNight: localHour < 5 || localHour >= 22,
    isDawn: localHour >= 5 && localHour < 7,
    isDusk: localHour >= 17 && localHour < 20,
  };
}

// ============================================================================
// TEMPERATURE VOCABULARY (61 values × 30 options each)
// ============================================================================

const TEMP_PHRASES: Record<number, string[]> = {};

// Build temperature phrases for -10°C to 50°C
for (let t = -10; t <= 50; t++) {
  const phrases: string[] = [];

  if (t <= -6) {
    // Extreme freezing
    phrases.push(
      'biting arctic freeze',
      'brutal polar cold',
      'bone-chilling freeze',
      'severe subzero cold',
      'harsh frozen air',
      'piercing glacial cold',
      'numbing deep freeze',
      'extreme winter bite',
      'frigid arctic blast',
      'savage cold front',
      'relentless freezing',
      'punishing ice cold',
      'merciless winter chill',
      'dangerous freezing',
      'life-threatening cold',
      'crystalline frozen air',
      'diamond-hard frost',
      'breath-catching freeze',
      'lung-searing cold',
      'unforgiving arctic',
      'treacherous subzero',
      'extreme polar vortex',
      'deadly winter cold',
      'catastrophic freeze',
      'record-breaking cold',
      'historical freeze',
      'unprecedented chill',
      'apocalyptic winter',
      'survival-testing freeze',
      'dangerous exposure cold',
    );
  } else if (t <= -1) {
    // Freezing
    phrases.push(
      'sharp winter chill',
      'icy grip',
      'frosty cold snap',
      'frozen morning air',
      'crisp freezing bite',
      'sparkling frost cold',
      'winter wonderland chill',
      'snowy cold air',
      'bracing subzero',
      'invigorating freeze',
      'pristine winter cold',
      'refreshing ice air',
      'clean freezing clarity',
      'pure winter atmosphere',
      'crystalline cold morning',
      'frost-kissed air',
      'winter-fresh freeze',
      'snow-scented cold',
      'holiday season chill',
      'festive winter cold',
      'cozy fireplace weather',
      'hot chocolate cold',
      'bundled-up weather',
      'mitten-worthy freeze',
      'scarf-essential cold',
      'boot-weather chill',
      'winter coat cold',
      'layering weather',
      'breath-visible freeze',
      'nostril-tingling cold',
    );
  } else if (t <= 4) {
    // Cold (0-4°C)
    phrases.push(
      'freezing point chill',
      'crisp winter air',
      'bracing cold morning',
      'invigorating chill',
      'fresh winter atmosphere',
      'clean cold clarity',
      'energizing cool air',
      'awakening coldness',
      'stimulating winter feel',
      'refreshing bite',
      'alert-making cold',
      'mind-clearing chill',
      'productive cold weather',
      'focused cool air',
      'sharp clear coldness',
      'pristine cool morning',
      'dew-point chill',
      'grass-frosting cold',
      'puddle-icing weather',
      'car-scraping morning',
      'jacket-zipping cold',
      'hand-pocket weather',
      'quick-walk cold',
      'coffee-warming weather',
      'soup-craving chill',
      'stew-weather cold',
      'comfort-food atmosphere',
      'hearty-meal weather',
      'warming-up cold',
      'indoor-cozy weather',
    );
  } else if (t <= 9) {
    // Cool (5-9°C)
    phrases.push(
      'cool crisp morning',
      'brisk refreshing air',
      'sweater weather cool',
      'light jacket temperature',
      'pleasant cool breeze',
      'autumn-like freshness',
      'spring morning cool',
      'comfortable chill',
      'energizing coolness',
      'hiking-perfect weather',
      'outdoor activity cool',
      'walking weather',
      'cafe terrace cool',
      'window-open fresh',
      'ventilating coolness',
      'sleeping-perfect temp',
      'blanket-cozy weather',
      'long-sleeve cool',
      'cardigan temperature',
      'layering-optional cool',
      'transitional weather',
      'shoulder-season cool',
      'moderate chill',
      'gentle coolness',
      'mild winter feel',
      'early spring air',
      'late autumn cool',
      'temperate chill',
      'balanced cool weather',
      'ideal walking temp',
    );
  } else if (t <= 14) {
    // Mild (10-14°C)
    phrases.push(
      'mild morning air',
      'comfortable coolness',
      'pleasant temperate',
      'ideal outdoor weather',
      'perfect walking temperature',
      'refreshing mildness',
      'spring-like warmth',
      'gentle fresh air',
      'balanced atmosphere',
      'easy-breathing weather',
      'comfortable outdoor temp',
      'activity-perfect mild',
      'garden weather',
      'picnic-suitable mild',
      'terrace-dining weather',
      'al fresco temperature',
      'window-shopping weather',
      'strolling temperature',
      'photography-perfect mild',
      'tourist-ideal weather',
      'sightseeing temperature',
      'exploration-friendly',
      'adventure-ready mild',
      'cycling weather',
      'jogging-perfect temp',
      'exercise-ideal mild',
      'sport-friendly weather',
      'training temperature',
      'productive outdoor mild',
      'meeting-walk weather',
    );
  } else if (t <= 19) {
    // Comfortable (15-19°C)
    phrases.push(
      'comfortable spring air',
      'pleasant warm morning',
      'ideal temperature',
      'perfect weather',
      'balmy fresh atmosphere',
      'delightful mildness',
      'sweet spot temperature',
      'golden weather',
      'paradise-like mild',
      'year-round ideal',
      'California-style weather',
      'Mediterranean comfort',
      'vacation temperature',
      'resort-perfect mild',
      'honeymoon weather',
      'romantic temperature',
      'date-night weather',
      'celebration-worthy',
      'wedding-perfect temp',
      'event-ideal weather',
      'party temperature',
      'gathering-friendly',
      'social weather',
      'community-gathering temp',
      'festival-ready mild',
      'concert-perfect weather',
      'outdoor-event ideal',
      'marathon weather',
      'race-day temperature',
      'competition-ready mild',
    );
  } else if (t <= 24) {
    // Warm (20-24°C)
    phrases.push(
      'warm balmy air',
      'pleasant summer warmth',
      'comfortable heat',
      'gentle warm breeze',
      'inviting warmth',
      'embracing mild heat',
      'soft warm atmosphere',
      'welcoming temperature',
      'beach-teasing warmth',
      'pool-tempting heat',
      'ice-cream weather',
      'cold-drink temperature',
      'shorts-optional warmth',
      't-shirt weather',
      'sandals-ready heat',
      'bare-arms temperature',
      'sun-kissed warmth',
      'golden afternoon heat',
      'lazy summer feel',
      'hammock weather',
      'reading-outdoors warmth',
      'nap-inducing heat',
      'siesta temperature',
      'relaxation weather',
      'sunset-watching warmth',
      'rooftop-bar weather',
      'patio-dining heat',
      'terrace-lounging temp',
      'garden-party warmth',
      'barbecue weather',
    );
  } else if (t <= 29) {
    // Hot (25-29°C)
    phrases.push(
      'hot summer air',
      'warm humid afternoon',
      'tropical warmth',
      'beach-perfect heat',
      'swimming weather',
      'diving-into-pool hot',
      'water-park temperature',
      'sprinkler-running weather',
      'fan-worthy heat',
      'AC-appreciating warmth',
      'shade-seeking hot',
      'sunglasses-essential heat',
      'sunscreen-mandatory',
      'hat-wearing weather',
      'parasol-worthy heat',
      'hydration-critical hot',
      'water-bottle weather',
      'electrolyte temperature',
      'sweat-inducing warmth',
      'perspiration heat',
      'cooling-off weather',
      'refreshment-seeking hot',
      'coconut-water temp',
      'smoothie weather',
      'frozen-treat heat',
      'popsicle temperature',
      'sorbet weather',
      'gelato-craving hot',
      'watermelon-weather heat',
      'summer-fruit temperature',
    );
  } else if (t <= 34) {
    // Scorching (30-34°C)
    phrases.push(
      'scorching hot air',
      'blazing afternoon heat',
      'intense summer warmth',
      'searing temperature',
      'baking hot weather',
      'oven-like heat',
      'furnace-feeling warmth',
      'relentless sun heat',
      'punishing hot afternoon',
      'brutal summer heat',
      'sweltering atmosphere',
      'suffocating warmth',
      'oppressive heat wave',
      'energy-draining hot',
      'exhausting temperature',
      'demanding heat',
      'challenging hot weather',
      'endurance-testing warmth',
      'survival-mode heat',
      'extreme summer hot',
      'dangerous heat advisory',
      'warning-level warmth',
      'health-risk temperature',
      'elderly-warning heat',
      'pet-safety hot',
      'pavement-burning warmth',
      'egg-frying heat',
      'metal-burning temperature',
      'car-interior scorching',
      'steering-wheel hot',
    );
  } else if (t <= 40) {
    // Extreme (35-40°C)
    phrases.push(
      'severe scorching air',
      'brutal afternoon heat',
      'dangerous hot weather',
      'life-threatening warmth',
      'extreme heat emergency',
      'critical temperature',
      'survival-challenging hot',
      'desert-like heat',
      'death-valley warmth',
      'saharan temperature',
      'middle-eastern hot',
      'gulf-state heat',
      'outback-intensity warmth',
      'furnace-blast temperature',
      'volcanic hot air',
      'magma-adjacent heat',
      'record-breaking warmth',
      'historical heat wave',
      'unprecedented temperature',
      'climate-extreme hot',
      'infrastructure-stressing heat',
      'grid-threatening warmth',
      'power-outage temperature',
      'AC-failing hot',
      'emergency-shelter heat',
      'cooling-center weather',
      'hydration-emergency warmth',
      'medical-alert hot',
      'stay-indoors temperature',
      'activity-suspension heat',
    );
  } else {
    // Dangerous (41-50°C)
    phrases.push(
      'extreme furnace air',
      'critical burning heat',
      'unsurvivable outdoor warmth',
      'apocalyptic temperature',
      'record-shattering hot',
      'catastrophic heat wave',
      'civilization-testing warmth',
      'uninhabitable heat',
      'mars-surface temperature',
      'venus-like atmosphere',
      'hellscape warmth',
      'inferno conditions',
      'maximum danger heat',
      'immediate-shelter temperature',
      'emergency-broadcast warmth',
      'evacuation-level hot',
      'mass-casualty heat',
      'hospital-overwhelming warmth',
      'morgue-filling temperature',
      'extinction-event hot',
      'planet-warning heat',
      'climate-collapse warmth',
      'tipping-point temperature',
      'no-return heat',
      'permanent-damage warmth',
      'ecosystem-destroying hot',
      'agriculture-ending heat',
      'water-evaporating warmth',
      'concrete-cracking temperature',
      'steel-warping heat',
    );
  }

  TEMP_PHRASES[t] = phrases;
}

// ============================================================================
// HUMIDITY VOCABULARY (101 values × 5 options each)
// ============================================================================

const HUMIDITY_PHRASES: Record<number, string[]> = {};

for (let h = 0; h <= 100; h++) {
  const phrases: string[] = [];

  if (h < 20) {
    phrases.push(
      'bone-dry parched air',
      'desert-dry atmosphere',
      'arid crisp clarity',
      'dehydrating dryness',
      'static-electric dry',
    );
  } else if (h < 30) {
    phrases.push(
      'very dry crisp air',
      'arid fresh atmosphere',
      'low-humidity clarity',
      'pleasantly dry conditions',
      'skin-tightening dryness',
    );
  } else if (h < 40) {
    phrases.push(
      'dry comfortable air',
      'crisp dry atmosphere',
      'refreshingly dry',
      'optimal low humidity',
      'clear dry conditions',
    );
  } else if (h < 50) {
    phrases.push(
      'comfortable fresh air',
      'balanced atmosphere',
      'ideal humidity level',
      'pleasant moisture balance',
      'perfect breathing conditions',
    );
  } else if (h < 60) {
    phrases.push(
      'comfortable moist air',
      'pleasant humidity',
      'soft atmospheric moisture',
      'gentle humid freshness',
      'breathable moist conditions',
    );
  } else if (h < 70) {
    phrases.push(
      'humid fresh air',
      'moist atmosphere',
      'noticeable humidity',
      'damp-feeling conditions',
      'moisture-laden air',
    );
  } else if (h < 80) {
    phrases.push(
      'humid damp air',
      'heavy moisture',
      'tropical humidity feel',
      'sticky atmospheric moisture',
      'perspiration-inducing damp',
    );
  } else if (h < 90) {
    phrases.push(
      'very humid thick air',
      'tropical heavy moisture',
      'oppressive dampness',
      'sweat-drenching humidity',
      'sauna-like moisture',
    );
  } else {
    phrases.push(
      'extreme humid saturation',
      'monsoon-like moisture',
      'near-rain humidity',
      'fog-forming dampness',
      'visibility-reducing moisture',
    );
  }

  HUMIDITY_PHRASES[h] = phrases;
}

// ============================================================================
// WIND VOCABULARY (101 values × 4 options each)
// ============================================================================

const WIND_PHRASES: Record<number, string[]> = {};

for (let w = 0; w <= 100; w++) {
  const phrases: string[] = [];

  if (w < 5) {
    phrases.push(
      'perfectly still calm',
      'motionless tranquil air',
      'windless serenity',
      'absolute stillness',
    );
  } else if (w < 12) {
    phrases.push(
      'gentle light breeze',
      'soft whisper wind',
      'delicate air movement',
      'subtle rustling',
    );
  } else if (w < 20) {
    phrases.push(
      'moderate steady breeze',
      'pleasant wind flow',
      'comfortable air movement',
      'refreshing gusts',
    );
  } else if (w < 30) {
    phrases.push(
      'brisk gusty wind',
      'energetic breeze',
      'invigorating wind',
      'hair-tousling gusts',
    );
  } else if (w < 40) {
    phrases.push(
      'strong powerful wind',
      'forceful gusting breeze',
      'robust wind energy',
      'flag-snapping gusts',
    );
  } else if (w < 50) {
    phrases.push(
      'very strong fierce wind',
      'intense gusting force',
      'tree-bending breeze',
      'walking-challenging wind',
    );
  } else if (w < 62) {
    phrases.push(
      'gale-force strong wind',
      'severe wind intensity',
      'umbrella-destroying gusts',
      'debris-moving force',
    );
  } else if (w < 75) {
    phrases.push(
      'storm-force violent wind',
      'dangerous wind power',
      'damage-causing gusts',
      'structural-testing force',
    );
  } else if (w < 89) {
    phrases.push(
      'severe storm wind',
      'destructive wind force',
      'hurricane-adjacent gusts',
      'emergency-level power',
    );
  } else {
    phrases.push(
      'hurricane-force extreme wind',
      'catastrophic wind power',
      'life-threatening gusts',
      'apocalyptic wind force',
    );
  }

  WIND_PHRASES[w] = phrases;
}

// ============================================================================
// TIME VOCABULARY (48 slots × 5 mood/lighting combos each)
// ============================================================================

interface TimeMoodLighting {
  mood: string;
  lighting: string;
}

const TIME_PHRASES: Record<number, TimeMoodLighting[]> = {};

for (let slot = 0; slot < 48; slot++) {
  const hour = Math.floor(slot / 2);
  const phrases: TimeMoodLighting[] = [];

  if (hour >= 0 && hour < 5) {
    // Deep night
    phrases.push(
      { mood: 'deep night stillness', lighting: 'soft ambient glow' },
      { mood: 'midnight tranquility', lighting: 'neon-reflected darkness' },
      { mood: 'nocturnal silence', lighting: 'streetlight pools' },
      { mood: 'witching hour calm', lighting: 'moon-silver illumination' },
      { mood: 'pre-dawn darkness', lighting: 'sparse urban lighting' },
    );
  } else if (hour >= 5 && hour < 7) {
    // Dawn
    phrases.push(
      { mood: 'dawn breaking softly', lighting: 'soft golden hour light' },
      { mood: 'sunrise awakening', lighting: 'pink-orange horizon glow' },
      { mood: 'early morning birth', lighting: 'gentle warm illumination' },
      { mood: 'day beginning fresh', lighting: 'pastel sky colors' },
      { mood: 'sunrise promise', lighting: 'golden rim lighting' },
    );
  } else if (hour >= 7 && hour < 11) {
    // Morning
    phrases.push(
      { mood: 'bright morning energy', lighting: 'clear morning light' },
      { mood: 'fresh day beginning', lighting: 'crisp daylight clarity' },
      { mood: 'productive morning buzz', lighting: 'sharp clean illumination' },
      { mood: 'energetic day start', lighting: 'bright natural light' },
      { mood: 'vibrant morning activity', lighting: 'shadow-casting sunlight' },
    );
  } else if (hour >= 11 && hour < 14) {
    // Midday
    phrases.push(
      { mood: 'midday sun peak', lighting: 'harsh overhead light' },
      { mood: 'noon intensity', lighting: 'minimal shadow brightness' },
      { mood: 'high sun moment', lighting: 'flat bright illumination' },
      { mood: 'solar maximum energy', lighting: 'bleaching overhead rays' },
      { mood: 'zenith sun power', lighting: 'contrast-flattening light' },
    );
  } else if (hour >= 14 && hour < 17) {
    // Afternoon
    phrases.push(
      { mood: 'afternoon warmth', lighting: 'warm afternoon light' },
      { mood: 'post-lunch leisure', lighting: 'angled golden rays' },
      { mood: 'lazy afternoon feeling', lighting: 'lengthening shadows' },
      { mood: 'productive afternoon', lighting: 'rich warm illumination' },
      { mood: 'day winding down', lighting: 'honeyed sunlight' },
    );
  } else if (hour >= 17 && hour < 20) {
    // Golden hour / Sunset
    phrases.push(
      { mood: 'golden hour magic', lighting: 'dramatic golden light' },
      { mood: 'sunset splendor', lighting: 'warm orange illumination' },
      { mood: 'evening gold cascade', lighting: 'cinematic warm glow' },
      { mood: 'dusk approaching beauty', lighting: 'rich amber rays' },
      { mood: 'day-end magnificence', lighting: 'spectacular sunset colors' },
    );
  } else if (hour >= 20 && hour < 22) {
    // Twilight
    phrases.push(
      { mood: 'evening twilight', lighting: 'soft blue hour light' },
      { mood: 'dusk descending', lighting: 'purple-blue gradient sky' },
      { mood: 'night approaching', lighting: 'first lights emerging' },
      { mood: 'day-to-night transition', lighting: 'mixed artificial-natural' },
      { mood: 'twilight serenity', lighting: 'deep blue illumination' },
    );
  } else {
    // Night (22-23)
    phrases.push(
      { mood: 'night descending', lighting: 'ambient city lights' },
      { mood: 'evening settling', lighting: 'urban glow patterns' },
      { mood: 'nocturnal awakening', lighting: 'neon and streetlight mix' },
      { mood: 'nightlife beginning', lighting: 'colorful night illumination' },
      { mood: 'darkness embracing', lighting: 'artificial light warmth' },
    );
  }

  TIME_PHRASES[slot] = phrases;
}

// ============================================================================
// CONDITION/EMOJI VOCABULARY (15 types × 10 options each)
// ============================================================================

const CONDITION_PHRASES: Record<string, string[]> = {
  // Clear/Sunny
  '☀️': [
    'brilliant clear blue sky',
    'radiant sunshine',
    'crystal clear atmosphere',
    'pristine sunny conditions',
    'perfect cloudless expanse',
    'dazzling solar brightness',
    'unobstructed sky clarity',
    'vivid blue heavens',
    'luminous clear day',
    'spectacular sunshine display',
  ],
  '🌤️': [
    'scattered white clouds',
    'drifting cloud wisps',
    'partial sunny breaks',
    'intermittent cloud shadows',
    'mostly sunny skies',
    'decorative cloud accents',
    'pleasant partly cloudy',
    'sun-dominated sky',
    'light cloud decoration',
    'fair weather clouds',
  ],
  '⛅': [
    'sun-cloud interplay',
    'mixed sky conditions',
    'alternating light patterns',
    'dynamic cloud movement',
    'variable sky coverage',
    'shifting sun shadows',
    'partly obscured sun',
    'cloud-filtered sunlight',
    'broken cloud layer',
    'patchy cloud coverage',
  ],
  // Overcast
  '☁️': [
    'complete cloud blanket',
    'grey overcast sky',
    'uniform cloud cover',
    'diffused soft light',
    'muted grey atmosphere',
    'flat cloud ceiling',
    'shadowless cloudy day',
    'gentle overcast mood',
    'silver-grey sky dome',
    'soft diffused lighting',
  ],
  // Rain
  '🌧️': [
    'rain-slicked streets',
    'wet glistening surfaces',
    'falling rain curtain',
    'reflective wet pavement',
    'drizzle-misted air',
    'rain-washed atmosphere',
    'puddle-dotted ground',
    'droplet-covered surfaces',
    'precipitation veil',
    'rainy day ambiance',
  ],
  '🌦️': [
    'sun-shower magic',
    'rain with sunshine',
    'golden rain drops',
    'rainbow-potential weather',
    'light rain sparkle',
    'sun-illuminated drizzle',
    'brief shower passing',
    'scattered rain patches',
    'intermittent precipitation',
    'dramatic weather contrast',
  ],
  // Storm
  '⛈️': [
    'dramatic storm clouds',
    'thundering dark sky',
    'lightning-charged atmosphere',
    'turbulent storm front',
    'menacing cloud towers',
    'electric storm energy',
    'powerful thunderstorm',
    'rain-lashed conditions',
    'dramatic weather event',
    'nature-fury display',
  ],
  // Snow
  '🌨️': [
    'gentle snowfall',
    'white snow blanket',
    'floating snowflakes',
    'winter wonderland scene',
    'pristine snow covering',
    'soft snow descent',
    'quiet snowfall magic',
    'crystal snow falling',
    'peaceful white precipitation',
    'enchanting snow shower',
  ],
  '❄️': [
    'heavy snow conditions',
    'blizzard-like snowfall',
    'thick snow blanket',
    'intense winter storm',
    'visibility-reducing snow',
    'accumulating snowfall',
    'serious snow event',
    'winter storm conditions',
    'deep snow coverage',
    'major snow precipitation',
  ],
  // Fog/Mist
  '🌫️': [
    'atmospheric fog veil',
    'thick mist blanket',
    'mysterious haze',
    'visibility-softening fog',
    'ethereal mist atmosphere',
    'dreamlike fog layer',
    'romantic mist covering',
    'soft fog diffusion',
    'haunting fog presence',
    'delicate mist curtain',
  ],
  // Wind
  '💨': [
    'wind-swept atmosphere',
    'blustery conditions',
    'gusting wind energy',
    'air-in-motion feeling',
    'dynamic wind presence',
    'movement-filled air',
    'wind-animated scene',
    'breeze-driven activity',
    'air current visibility',
    'wind-shaped environment',
  ],
  // Extreme
  '🌪️': [
    'tornado-warning conditions',
    'severe rotating storm',
    'dangerous wind event',
    'extreme weather emergency',
    'funnel cloud threat',
    'violent storm system',
    'life-threatening conditions',
    'emergency weather situation',
    'catastrophic storm potential',
    'maximum danger weather',
  ],
  // Default/Unknown
  default: [
    'dynamic sky conditions',
    'changing weather patterns',
    'variable atmosphere',
    'mixed weather elements',
    'transitional sky',
    'evolving conditions',
    'atmospheric variation',
    'weather in flux',
    'shifting sky mood',
    'unpredictable elements',
  ],
};


// ============================================================================
// CITY VIBES (97 cities × 10 vibes each)
// ============================================================================
// All 83 unique catalog cities + 14 bonus cities for broader matching.
// Each city has 10 culturally authentic, visually descriptive phrases
// that feed directly into AI image prompts.
// ============================================================================

const CITY_VIBES: Record<string, string[]> = {
  // ── ASIA-PACIFIC ──────────────────────────────────────────────────────────

  tokyo: [
    'neon-lit streets of Shibuya',
    'towering Shinjuku skyscrapers',
    'serene Senso-ji temple grounds',
    'bustling Ginza district',
    'electric Akihabara energy',
    'Harajuku fashion culture explosion',
    'Tokyo Tower illuminated at night',
    'Meiji Shrine forest serenity',
    'Tsukiji market morning bustle',
    'Roppongi nightlife glow',
  ],
  fukuoka: [
    'Hakata ramen street steam',
    'Canal City waterfront shopping',
    'Ohori Park lakeside calm',
    'Kushida Shrine festival spirit',
    'Nakasu island nightlife glow',
    'Momochi seaside tower views',
    'yatai street food stall warmth',
    'Fukuoka Tower coastal panorama',
    'Tenjin underground shopping maze',
    'Hakata Bay sunset reflections',
  ],
  nagoya: [
    'Nagoya Castle golden shachihoko',
    'Sakae district neon bustle',
    'Atsuta Shrine ancient forest',
    'Osu shopping arcade energy',
    'Toyota industrial heritage',
    'Hisaya Odori Park greenery',
    'Nagoya TV Tower retro charm',
    'Meijo Park cherry blossom walks',
    'Shirotori Garden tranquility',
    'central Japan crossroads spirit',
  ],
  sapporo: [
    'Odori Park snow festival wonder',
    'Susukino neon winter glow',
    'Clock Tower historic charm',
    'Sapporo Beer Museum heritage',
    'Tanukikoji covered arcade warmth',
    'Moerenuma Park sculptural landscape',
    'Hokkaido University ginkgo avenue',
    'Mount Moiwa night panorama',
    'Nijo Market seafood abundance',
    'powder snow capital atmosphere',
  ],
  shanghai: [
    'Pudong skyline drama',
    'Oriental Pearl tower glow',
    'Bund historic contrast',
    'neon river reflections',
    'mega-city ambition rising',
    'Yu Garden classical beauty',
    'Nanjing Road shopping frenzy',
    'French Concession tree-lined charm',
    'Lujiazui financial tower cluster',
    'Huangpu River cruise lights',
  ],
  shenzhen: [
    'tech capital innovation hub',
    'Ping An Finance Centre towering',
    'Shekou waterfront modernity',
    'Dafen Oil Painting Village creativity',
    'OCT Loft art district edge',
    'Shenzhen Bay skyline at dusk',
    'Huaqiangbei electronics market buzz',
    'Lianhua Mountain park overlook',
    'Window of the World miniatures',
    'Silicon Valley of China energy',
  ],
  'hong kong': [
    'dense urban towers rising',
    'Victoria Peak panorama',
    'neon-soaked Mong Kok streets',
    'harbour skyline drama',
    'vertical city energy surging',
    'Star Ferry crossing waters',
    'Temple Street night market glow',
    'Lan Kwai Fong nightlife buzz',
    'Tsim Sha Tsui waterfront promenade',
    'bamboo scaffolding contrast with glass',
  ],
  taipei: [
    'Taipei 101 cityscape icon',
    'night market energy pulsing',
    'mountain-ringed basin setting',
    'modern Asian metropolis blend',
    'temple-tech contrast everywhere',
    'Ximending youth culture streets',
    'Longshan Temple incense haze',
    'Yangmingshan hot spring mist',
    'Dadaocheng historic waterfront',
    'Elephant Mountain hiking vista',
  ],
  seoul: [
    'modern K-city blend',
    'Gangnam district style',
    'palace-meets-skyscraper views',
    'Han River panorama sprawl',
    'neon pop culture energy',
    'Bukchon Hanok Village tradition',
    'Myeongdong shopping frenzy',
    'Namsan Tower romantic overlook',
    'Hongdae street art creativity',
    'Gwanghwamun Gate grandeur',
  ],
  bangkok: [
    'temple spires and towers',
    'Chao Phraya river life',
    'golden Buddha shrines glowing',
    'rooftop bar skyline views',
    'street food energy sizzling',
    'tuk-tuk buzzing through traffic',
    'Khao San Road backpacker pulse',
    'Grand Palace ornate splendor',
    'Chatuchak market maze wandering',
    'Silom financial district hustle',
  ],
  'ho chi minh city': [
    'motorbike river flowing through streets',
    'French colonial architecture fading',
    'District 1 skyscraper contrast',
    'Ben Thanh Market bustle',
    'rooftop bar Saigon skyline',
    'Bui Vien walking street energy',
    'Notre-Dame Cathedral brick warmth',
    'Bitexco Financial Tower lotus shape',
    'Cu Chi history beneath the surface',
    'Pham Ngu Lao backpacker spirit',
  ],
  singapore: [
    'modern cityscape gleaming',
    'Marina Bay splendor reflected',
    'garden city greenery layered',
    'futuristic architecture soaring',
    'tropical urban blend flourishing',
    'Orchard Road shopping boulevard',
    'Clarke Quay riverside nightlife',
    'Supertree Grove light display',
    'Chinatown heritage shophouses',
    'Sentosa island coastal escape',
  ],
  jakarta: [
    'tropical megacity sprawl',
    'modern tower clusters rising',
    'bustling street life everywhere',
    'Indonesian capital energy',
    'diverse urban tapestry woven',
    'Monas monument national pride',
    'Kota Tua colonial heritage',
    'Sudirman business corridor',
    'Ancol waterfront leisure',
    'Menteng tree-lined boulevards',
  ],
  manila: [
    'bay city skyline glow',
    'historic Intramuros walls',
    'tropical urban energy pulsing',
    'Makati district towers gleaming',
    'island capital spirit vibrant',
    'BGC modern grid precision',
    'Rizal Park national heart',
    'Binondo Chinatown heritage',
    'Manila Ocean Park waterfront',
    'jeepney-filled streets colorful',
  ],
  'kuala lumpur': [
    'Petronas Towers icon soaring',
    'modern Islamic architecture blend',
    'tropical city greenery lush',
    'diverse cultural fusion vibrant',
    'Malaysian capital pride rising',
    'Bukit Bintang shopping energy',
    'Batu Caves limestone drama',
    'KL Tower panoramic views',
    'Merdeka Square historic heart',
    'Jalan Alor street food paradise',
  ],
  dhaka: [
    'rickshaw-filled street chaos',
    'Lalbagh Fort Mughal heritage',
    'Buriganga River waterfront life',
    'Hatirjheel lakeside promenade',
    'Ahsan Manzil pink palace glow',
    'densest city on earth energy',
    'Dhakeshwari Temple devotion',
    'Sadarghat river terminal bustle',
    'Gulshan modern district contrast',
    'monsoon season drama overhead',
  ],
  colombo: [
    'Galle Face ocean promenade',
    'Lotus Tower futuristic silhouette',
    'Pettah market maze energy',
    'colonial fort district charm',
    'Beira Lake island temple serenity',
    'Independence Square heritage',
    'Gangaramaya Temple eclectic beauty',
    'Colombo harbour trade hub',
    'Mount Lavinia coastal sunset',
    'tropical garden city atmosphere',
  ],
  karachi: [
    'Clifton Beach Arabian Sea views',
    'Quaid-e-Azam Mausoleum grandeur',
    'Saddar bazaar trading energy',
    'Port Trust colonial architecture',
    'Do Darya seafood strip lights',
    'Mohatta Palace museum elegance',
    'Defence Housing modern skyline',
    'Empress Market heritage bustle',
    'Frere Hall Victorian gardens',
    'megacity port hustle pulsing',
  ],
  mumbai: [
    'bustling streets energy surging',
    'Gateway of India backdrop',
    'Bollywood city spirit electric',
    'Arabian Sea views stretching',
    'colonial architecture mix grand',
    'Marine Drive Queen necklace curve',
    'Dharavi resilience and creativity',
    'Bandra-Worli Sea Link engineering',
    'CST Victorian Gothic station',
    'Colaba Causeway market bustle',
  ],
  ulaanbaatar: [
    'Genghis Khan statue grandeur',
    'Sukhbaatar Square open expanse',
    'Gandantegchinlen Monastery devotion',
    'steppe city edge wilderness',
    'Soviet-era apartment blocks contrast',
    'Zaisan Memorial hilltop panorama',
    'National Museum Mongolian heritage',
    'Chinggis Khaan airport gateway',
    'Bogd Khan Mountain backdrop',
    'nomadic-urban culture collision',
  ],
  vientiane: [
    'Pha That Luang golden stupa',
    'Mekong River sunset promenade',
    'Patuxai victory gate grandeur',
    'French colonial villa charm',
    'Wat Si Saket ancient devotion',
    'sleepy capital gentle pace',
    'COPE Visitor Centre reflection',
    'Chao Anouvong Park riverfront',
    'Night Market fabric and spice',
    'Buddhist temple serenity layered',
  ],
  almaty: [
    'Tien Shan mountain backdrop towering',
    'Medeu skating rink alpine setting',
    'Green Bazaar spice and silk',
    'Panfilov Park cathedral colors',
    'Kok Tobe hill cable car views',
    'apple orchard city heritage',
    'Soviet modernist architecture blocks',
    'Almaty Tower observation deck',
    'Republic Square fountain plaza',
    'Central Asian crossroads energy',
  ],
  sydney: [
    'harbour bridge icon spanning',
    'Opera House curves gleaming',
    'Bondi beach vibes crashing',
    'harbour ferry views passing',
    'coastal city sparkle shimmering',
    'Circular Quay waterfront bustle',
    'Darling Harbour evening lights',
    'Taronga Zoo harbour backdrop',
    'Manly Beach surf culture',
    'Barangaroo modern waterfront dining',
  ],
  auckland: [
    'Sky Tower waterfront landmark',
    'city of sails harbour',
    'volcanic isthmus dramatic setting',
    'Pacific gateway culture blend',
    'Kiwi urban spirit thriving',
    'Viaduct Harbour marina dining',
    'Mount Eden crater viewpoint',
    'Queen Street shopping pulse',
    'Waitemata Harbour sparkling waters',
    'Ponsonby village cafe culture',
  ],
  wellington: [
    'harbour capital beauty sheltered',
    'windy city character defined',
    'film industry creativity flowing',
    'compact waterfront charm intimate',
    'New Zealand governance heart',
    'Cable Car hillside ascent',
    'Te Papa museum waterfront',
    'Cuba Street bohemian spirit',
    'Mount Victoria panoramic lookout',
    'Zealandia eco-sanctuary wilderness',
  ],

  // ── MIDDLE EAST ───────────────────────────────────────────────────────────

  dubai: [
    'futuristic skyscrapers piercing clouds',
    'Burj Khalifa majesty towering',
    'desert luxury towers gleaming',
    'Palm Jumeirah aerial views',
    'gold-touched architecture shining',
    'Dubai Marina yacht-lined waterway',
    'old Deira souk spice trails',
    'Dubai Frame golden portal',
    'Jumeirah Beach Resort coastline',
    'Downtown Boulevard fountain spectacle',
  ],
  'abu dhabi': [
    'desert luxury towers rising',
    'Sheikh Zayed Mosque white marble',
    'Louvre dome architecture floating',
    'oil wealth grandeur displayed',
    'futuristic Arabian city emerging',
    'Corniche waterfront promenade',
    'Yas Island entertainment complex',
    'Saadiyat Island cultural district',
    'Emirates Palace golden opulence',
    'Qasr Al Hosn fort heritage',
  ],
  doha: [
    'Museum of Islamic Art geometric beauty',
    'Pearl Island luxury marina',
    'Souq Waqif traditional market warmth',
    'West Bay skyline futurism',
    'Katara Cultural Village amphitheatre',
    'Corniche crescent waterfront',
    'Aspire Tower torch silhouette',
    'Education City knowledge campus',
    'Msheireb Downtown revival district',
    'desert peninsula capital ambition',
  ],
  'kuwait city': [
    'Kuwait Towers iconic water tanks',
    'Liberation Tower observation deck',
    'Grand Mosque golden dome',
    'Souq Al Mubarakiya heritage trading',
    'Green Island coastal leisure',
    'Al Hamra Tower twisting glass',
    'Scientific Center aquarium wonder',
    'Salmiya seaside promenade',
    'Failaka Island archaeological escape',
    'Arabian Gulf waterfront modernity',
  ],
  manama: [
    'Bahrain World Trade Center twin sails',
    'Bab Al Bahrain gateway arch',
    'Bahrain Fort ancient ruins',
    'Adliya art district creativity',
    'King Fahad Causeway connection',
    'Al Fateh Grand Mosque dome',
    'Pearl Monument roundabout',
    'Seef District shopping modernity',
    'Muharraq island heritage trail',
    'Gulf island kingdom atmosphere',
  ],
  muscat: [
    'Sultan Qaboos Grand Mosque serenity',
    'Mutrah Corniche harbour sweep',
    'Mutrah Souq frankincense trails',
    'Royal Opera House elegance',
    'Al Alam Palace colorful facade',
    'Muttrah fort watchtower views',
    'old town whitewashed charm',
    'Bimmah Sinkhole turquoise jewel',
    'Al Jalali fort harbour guard',
    'Arabian Sea mountain-meets-coast drama',
  ],
  riyadh: [
    'modern Arabian city expanding',
    'Kingdom Tower skyline crown',
    'desert capital ambition rising',
    'Saudi architectural vision bold',
    'tradition-meets-future transformation',
    'Masmak Fort heritage heart',
    'King Abdullah Financial District',
    'Diriyah UNESCO heritage site',
    'Boulevard entertainment district',
    'NEOM future city ambition',
  ],
  istanbul: [
    'minarets and Bosphorus meeting',
    'Blue Mosque silhouette iconic',
    'two-continent city bridging worlds',
    'bazaar maze energy ancient',
    'Ottoman grandeur preserved',
    'Galata Tower romantic overlook',
    'Hagia Sophia dome magnificence',
    'Istiklal Avenue tram and crowd',
    'Bosphorus ferry crossing waters',
    'Karakoy waterfront cafe culture',
  ],
  amman: [
    'Citadel hilltop Roman ruins',
    'Rainbow Street cafe culture',
    'King Abdullah Mosque blue dome',
    'Roman amphitheatre downtown heart',
    'white limestone city terraces',
    'Abdali Boulevard modern development',
    'Jabal Amman art gallery walks',
    'downtown souq spice aromas',
    'seven hills ancient geography',
    'Hashemite Kingdom heritage capital',
  ],
  beirut: [
    'Mediterranean coastline resilience',
    'Pigeon Rocks sea arch drama',
    'Hamra Street cosmopolitan buzz',
    'Raouche clifftop sunset views',
    'reconstructed downtown elegance',
    'Gemmayzeh nightlife spirit',
    'National Museum archaeological treasure',
    'Corniche seaside promenade strolling',
    'Mar Mikhael creative district',
    'Paris of the Middle East heritage',
  ],

  // ── EUROPE ────────────────────────────────────────────────────────────────

  london: [
    'Victorian architecture grandeur',
    'Thames river reflections shimmering',
    'Big Ben silhouette towering',
    'red double-decker charm classic',
    'royal palace backdrop majestic',
    'Tower Bridge opening ceremony',
    'Canary Wharf financial glass towers',
    'Covent Garden street performer energy',
    'Camden Market creative chaos',
    'South Bank cultural riverside walk',
  ],
  paris: [
    'Haussmann boulevards elegant',
    'Eiffel Tower silhouette iconic',
    'Seine riverside beauty flowing',
    'Montmartre artistic spirit bohemian',
    'Champs-Élysées glamour radiating',
    'Louvre pyramid glass reflection',
    'Sacré-Cœur hilltop white dome',
    'Le Marais cobblestone charm',
    'Pont Alexandre III golden bridge',
    'Latin Quarter intellectual cafe warmth',
  ],
  amsterdam: [
    'canal-side streets reflecting light',
    'bicycle city culture flowing',
    'gabled house rows leaning',
    'museum quarter artistic richness',
    'Dutch golden age heritage lasting',
    'Jordaan neighbourhood charm intimate',
    'Vondelpark green escape central',
    'Dam Square royal palace backdrop',
    'Rijksmuseum grand passage cycling',
    'floating flower market colors',
  ],
  brussels: [
    'Grand Place splendor golden',
    'art nouveau treasures hidden',
    'European Union hub diplomatic',
    'chocolate city sweetness rich',
    'Belgian capital charm diverse',
    'Atomium futuristic sphere structure',
    'Manneken Pis irreverent humor',
    'Sablon antiques district elegance',
    'Comic Strip Route murals colorful',
    'Magritte surrealist heritage lingering',
  ],
  luxembourg: [
    'Bock Casemates cliff fortress',
    'Kirchberg European institutions plateau',
    'Grund valley medieval charm',
    'Adolphe Bridge stone arch elegance',
    'Grand Ducal Palace royal facade',
    'Chemin de la Corniche scenic balcony',
    'Pfaffenthal lift modern engineering',
    'Place dArmes cafe square heart',
    'Mudam contemporary art museum',
    'miniature grand duchy sophistication',
  ],
  frankfurt: [
    'financial district towers dominating',
    'Main river skyline reflecting',
    'European banking hub authority',
    'modern glass architecture rising',
    'old town Römer contrast charming',
    'Sachsenhausen apple wine taverns',
    'Palmengarten botanical tranquility',
    'Museumsufer riverbank culture mile',
    'Hauptwache plaza bustling crossroads',
    'Commerzbank Tower engineering pride',
  ],
  stuttgart: [
    'Mercedes-Benz Museum curves flowing',
    'Porsche engineering heritage precision',
    'Schlossplatz palace square elegance',
    'vineyard hillside terraces green',
    'Königstrasse shopping boulevard',
    'Staatsgalerie art collection richness',
    'Wilhelma zoological garden exotic',
    'TV Tower panoramic observation',
    'Bohnenviertel bohemian quarter charm',
    'Swabian automotive capital pride',
  ],
  zurich: [
    'alpine city views breathtaking',
    'pristine lake shores glistening',
    'Swiss precision architecture clean',
    'banking district elegance discreet',
    'mountain backdrop majesty eternal',
    'Bahnhofstrasse luxury shopping mile',
    'Old Town Niederdorf cobblestones',
    'Limmat River church reflections',
    'Kunsthaus art collection depth',
    'Lake Zurich paddle steamer charm',
  ],
  vienna: [
    'imperial baroque streets ornate',
    'Ringstrasse grandeur circling',
    'coffee house culture timeless',
    'classical music heritage resonating',
    'Habsburg elegance preserved',
    'Schönbrunn Palace garden symmetry',
    'Stephansdom cathedral tile roof',
    'Naschmarkt food stall diversity',
    'Prater ferris wheel nostalgia',
    'MuseumsQuartier courtyard creativity',
  ],
  milan: [
    'Duomo cathedral spire forest',
    'Galleria Vittorio Emanuele II arcade',
    'fashion district runway elegance',
    'Navigli canal evening aperitivo',
    'Brera artistic neighbourhood charm',
    'La Scala opera house legacy',
    'Porta Nuova modern skyline rising',
    'Castello Sforzesco fortress gardens',
    'Quadrilatero della Moda luxury',
    'Italian design capital ambition',
  ],
  madrid: [
    'Prado Museum art treasury',
    'Gran Via boulevard cinema lights',
    'Retiro Park rowing lake serenity',
    'Plaza Mayor terracotta arcades',
    'Royal Palace baroque grandeur',
    'Puerta del Sol midnight clock',
    'Mercado de San Miguel tapas feast',
    'Cibeles fountain illuminated night',
    'Malasaña neighbourhood vintage spirit',
    'Spanish capital fiesta energy',
  ],
  lisbon: [
    'hillside tram streets climbing',
    'pastel building facades warming',
    'Tagus river views expansive',
    'fado music spirit soulful',
    'maritime heritage proud',
    'Belém Tower riverfront sentinel',
    'Alfama labyrinth rooftop views',
    'LX Factory creative reuse',
    'Praça do Comércio golden gateway',
    'Time Out Market culinary celebration',
  ],
  barcelona: [
    'Gaudí modernist city dreamlike',
    'Mediterranean beach blend golden',
    'Gothic Quarter maze shadowed',
    'Ramblas promenade energy flowing',
    'Catalan architectural pride soaring',
    'Sagrada Família eternal construction',
    'Park Güell mosaic wonderland',
    'Barceloneta beach volleyball sunset',
    'Boqueria market sensory overload',
    'Montjuïc castle hilltop panorama',
  ],
  rome: [
    'ancient eternal city layered',
    'Colosseum grandeur enduring',
    'Vatican proximity spiritual',
    'fountain-dotted piazzas splashing',
    'empire ruins backdrop monumental',
    'Trastevere cobblestone evening glow',
    'Spanish Steps gathering place',
    'Pantheon dome open oculus light',
    'Via del Corso shopping promenade',
    'Forum ruins sunset photography',
  ],
  athens: [
    'Acropolis backdrop commanding',
    'ancient democracy birthplace sacred',
    'white marble heritage gleaming',
    'Mediterranean light golden',
    'classical civilization foundation',
    'Plaka neighbourhood taverna warmth',
    'Monastiraki flea market treasure hunt',
    'Syntagma Square guard ceremony',
    'Lycabettus Hill panoramic sunset',
    'Piraeus harbour maritime gateway',
  ],
  dublin: [
    'Georgian architecture doorways colorful',
    'Temple Bar spirit lively',
    'Liffey river views bridging',
    'literary city heritage profound',
    'Celtic capital charm enduring',
    'Ha Penny Bridge pedestrian crossing',
    'Trinity College library ancient',
    'Grafton Street busker melodies',
    'Phoenix Park deer roaming',
    'Guinness Storehouse gravity bar views',
  ],
  reykjavik: [
    'Hallgrímskirkja church rocket silhouette',
    'Harpa Concert Hall glass facade',
    'colorful corrugated rooftops',
    'Laugavegur main street wandering',
    'Sun Voyager sculpture bay views',
    'northernmost capital aurora skies',
    'Tjörnin pond city center calm',
    'Perlan observation dome panorama',
    'whale watching harbour departure',
    'midnight sun summer endless light',
  ],
  oslo: [
    'fjord city architecture bold',
    'Nordic modernism clean lines',
    'Viking heritage backdrop ancient',
    'sustainable urban design green',
    'waterfront renewal Barcode district',
    'Vigeland sculpture park expressive',
    'Operaen rooftop walk angular',
    'Aker Brygge harbour dining',
    'Holmenkollen ski jump panorama',
    'Karl Johans Gate royal avenue',
  ],
  stockholm: [
    'Nordic waterfront beauty serene',
    'island city archipelago spread',
    'Scandinavian design minimalist',
    'Gamla Stan cobblestones medieval',
    'Baltic sea views endless',
    'Djurgården green island museums',
    'City Hall Nobel banquet venue',
    'Södermalm hipster hill views',
    'Vasa Museum maritime time capsule',
    'Strandvägen boulevard waterfront elegance',
  ],
  copenhagen: [
    'colorful harbour Nyhavn postcard',
    'Nordic design capital innovative',
    'cycling city spirit sustainable',
    'hygge atmosphere cozy warmth',
    'Scandinavian livability model',
    'Tivoli Gardens fairytale lights',
    'Little Mermaid harbour statue',
    'Christiania freetown alternative spirit',
    'Strøget pedestrian shopping mile',
    'Amager Bakke ski slope rooftop',
  ],
  helsinki: [
    'Nordic design capital white stone',
    'Baltic sea waterfront frozen winter',
    'sauna city culture steaming',
    'art nouveau architecture ornate',
    'Finnish modernism functional beauty',
    'Suomenlinna sea fortress island',
    'Senate Square neoclassical harmony',
    'Market Square harbour fresh catch',
    'Oodi Library contemporary timber',
    'Kallio neighbourhood bohemian bars',
  ],
  riga: [
    'art nouveau facade capital',
    'Old Town UNESCO cobblestones',
    'Central Market zeppelin hangars',
    'House of Blackheads ornate guild',
    'Daugava River bridge panorama',
    'St Peters Church tower observation',
    'Alberta Street sculptural facades',
    'Latvian National Opera elegance',
    'Miera Street hipster quarter',
    'Baltic pearl amber heritage',
  ],
  prague: [
    'gothic spires old town piercing',
    'Charles Bridge romance crossing',
    'castle hill views commanding',
    'astronomical clock square gathering',
    'Bohemian historic beauty layered',
    'Vltava River cruise reflections',
    'Malá Strana baroque charm',
    'Wenceslas Square boulevard bustle',
    'John Lennon Wall color splash',
    'Petřín Hill tower miniature Eiffel',
  ],
  bratislava: [
    'Bratislava Castle hilltop white fortress',
    'Old Town pastel facades compact',
    'Danube River promenade strolling',
    'UFO Bridge observation deck views',
    'St Martins Cathedral coronation heritage',
    'Eurovea waterfront modern dining',
    'Devin Castle cliff ruins dramatic',
    'Main Square cafe terrace charm',
    'Blue Church art nouveau jewel',
    'small capital hidden gem warmth',
  ],
  budapest: [
    'Parliament building Danube reflection',
    'Chain Bridge illuminated span',
    'Buda Castle hilltop fortress',
    'thermal bath steam rising',
    'ruin bar district creative chaos',
    'Fishermans Bastion fairy tale turrets',
    'Heroes Square grand column vista',
    'Great Market Hall iron framework',
    'Gellért Hill liberty statue panorama',
    'Danube Pearl twin city grandeur',
  ],
  warsaw: [
    'modern phoenix city reborn',
    'old town reconstruction meticulous',
    'Vistula river views expanding',
    'communist-era contrast dramatic',
    'resilient capital spirit enduring',
    'Palace of Culture Soviet tower',
    'Łazienki Park palace lake serenity',
    'Nowy Świat elegant boulevard',
    'Praga district raw authenticity',
    'Warsaw Uprising memorial courage',
  ],
  kyiv: [
    'golden-domed monastery skyline',
    'Maidan Nezalezhnosti square heart',
    'Dnipro River wide panorama',
    'St Sophias Cathedral UNESCO splendor',
    'Khreshchatyk boulevard chestnut trees',
    'Pechersk Lavra monastery caves',
    'Podil neighbourhood creative revival',
    'Motherland Monument hilltop sentinel',
    'Andriyivskyy Descent artistic cobblestones',
    'resilient capital spirit unbreakable',
  ],
  belgrade: [
    'Kalemegdan Fortress river confluence',
    'Knez Mihailova pedestrian boulevard',
    'Savamala waterfront creative district',
    'St Sava Temple massive dome',
    'Ada Ciganlija river island beach',
    'Skadarlija bohemian quarter taverns',
    'Belgrade Waterfront modern development',
    'Republic Square gathering point',
    'Danube-Sava confluence panorama',
    'Balkan nightlife capital energy',
  ],
  zagreb: [
    'Upper Town medieval cobblestones',
    'Ban Jelačić Square central pulse',
    'Zagreb Cathedral twin spires',
    'Dolac Market flower and produce',
    'Museum of Broken Relationships quirky',
    'Tkalčićeva Street cafe terrace row',
    'Jarun Lake recreational escape',
    'Art Pavilion golden exhibition hall',
    'funicular railway shortest ride',
    'Croatian capital Austro-Hungarian charm',
  ],
  ljubljana: [
    'Ljubljana Castle hilltop funicular',
    'Triple Bridge Plečnik elegance',
    'Ljubljanica River cafe-lined banks',
    'Prešeren Square poet monument heart',
    'Dragon Bridge guardian sculptures',
    'Metelkova alternative art compound',
    'Tivoli Park forested central escape',
    'Central Market open-air stalls',
    'Art Nouveau facade quarter',
    'green capital European award winner',
  ],
  sarajevo: [
    'Baščaršija Ottoman bazaar copper',
    'Latin Bridge assassination history',
    'Sebilj fountain pigeon square',
    'meeting of civilizations crossroads',
    'Avaz Twist Tower modern spiral',
    'Yellow Fortress sunset viewpoint',
    'Gazi Husrev-beg Mosque heritage',
    'tunnel of hope wartime memory',
    'Vratnik old fortress walls',
    'Bosnian capital resilient beauty',
  ],
  skopje: [
    'Stone Bridge Ottoman crossing',
    'Macedonia Square monumental statues',
    'Kale Fortress hilltop ruins',
    'Old Bazaar artisan quarter',
    'Mother Teresa Memorial House',
    'Matka Canyon boat excursion',
    'City Park Gradski evening strolls',
    'archaeological museum neoclassical facade',
    'Vodno Mountain cross viewpoint',
    'Balkan crossroads emerging identity',
  ],
  podgorica: [
    'Morača River canyon edge city',
    'Millennium Bridge cable-stayed modern',
    'Clock Tower Ottoman remnant',
    'Ribnica River old town confluence',
    'Gorica Hill fortress park overlook',
    'Cathedral of Resurrection golden domes',
    'Skadar Lake gateway excursion',
    'Nemanja Street pedestrian promenade',
    'King Nikolas Palace heritage museum',
    'Montenegrin capital mountain-ringed calm',
  ],

  // ── AFRICA ────────────────────────────────────────────────────────────────

  cairo: [
    'Nile river cityscape flowing',
    'pyramid backdrop eternal wonder',
    'ancient-modern layers coexisting',
    'Islamic architecture richness ornate',
    'pharaonic heritage monumental',
    'Khan el-Khalili bazaar maze',
    'Cairo Tower island observation',
    'Al-Azhar Mosque scholarly tradition',
    'Zamalek island leafy elegance',
    'Coptic quarter ancient churches',
  ],
  johannesburg: [
    'African cityscape gold-mine heritage',
    'Mandela legacy inspiration',
    'urban renewal energy transforming',
    'rainbow nation hub diverse',
    'Maboneng Precinct creative revival',
    'Constitution Hill justice memorial',
    'Sandton City financial towers',
    'Apartheid Museum reflection',
    'Braamfontein street art walls',
    'Ponte Tower cylindrical landmark',
  ],
  'cape town': [
    'Table Mountain backdrop iconic',
    'waterfront beauty harbour dining',
    'Atlantic coast views dramatic',
    'African metropolis charm vibrant',
    'natural wonder setting stunning',
    'Bo-Kaap colorful heritage houses',
    'Kirstenbosch botanical garden slopes',
    'Robben Island history offshore',
    'Long Street nightlife energy',
    'Chapman Peak coastal drive scenic',
  ],
  nairobi: [
    'Nairobi National Park skyline safari',
    'Karen Blixen Museum colonial heritage',
    'Kenyatta International Centre tower',
    'Maasai Market craft colors',
    'David Sheldrick elephant orphanage',
    'Westlands modern development cluster',
    'Uhuru Gardens independence memorial',
    'Karura Forest urban nature escape',
    'railway heritage colonial station',
    'East African tech hub innovation',
  ],
  lagos: [
    'Third Mainland Bridge endless span',
    'Victoria Island skyline ambition',
    'Lekki toll gate modern gateway',
    'Makoko floating community resilience',
    'Tarkwa Bay beach island escape',
    'National Theatre brutalist crown',
    'Eko Atlantic City reclaimed land',
    'Computer Village tech market buzz',
    'Fela Kuti Shrine Afrobeat spirit',
    'West African megacity unstoppable energy',
  ],
  accra: [
    'Independence Square arch monument',
    'Jamestown lighthouse heritage coast',
    'Osu Oxford Street market bustle',
    'Kwame Nkrumah Memorial Park',
    'Labadi Beach weekend energy',
    'Makola Market trading maze',
    'National Theatre modern architecture',
    'W.E.B. Du Bois Center heritage',
    'Arts Centre craft marketplace',
    'Ghanaian capital coastal warmth',
  ],
  casablanca: [
    'Hassan II Mosque ocean-edge grandeur',
    'Corniche beachfront boulevard',
    'Art Deco downtown architecture',
    'Morocco Mall modern commerce',
    'Old Medina narrow alley charm',
    'Habous Quarter neo-Moorish design',
    'Casa Port waterfront renewal',
    'Place Mohammed V civic elegance',
    'Twin Center business towers',
    'Moroccan economic capital bustling',
  ],
  gaborone: [
    'Three Dikgosi Monument national heroes',
    'Gaborone Dam reservoir views',
    'Main Mall shopping avenue',
    'National Museum Botswana heritage',
    'Kgale Hill hiking panorama',
    'Mokolodi Nature Reserve wildlife',
    'Game City shopping complex modern',
    'Tlokweng border gate crossing',
    'Riverwalk Mall leisure precinct',
    'diamond capital quiet prosperity',
  ],
  windhoek: [
    'Christuskirche hilltop church landmark',
    'Independence Avenue main boulevard',
    'Tintenpalast Parliament ink palace',
    'Alte Feste old fortress museum',
    'Maerua Mall modern retail center',
    'Heroes Acre memorial hilltop',
    'Namibian Craft Centre artisan market',
    'Zoo Park city center oasis',
    'Katutura township cultural tours',
    'Namibian capital highland clarity',
  ],
  'dar es salaam': [
    'Kivukoni Fish Market harbour catch',
    'Askari Monument independence landmark',
    'Coco Beach Indian Ocean shore',
    'National Museum Tanzanian heritage',
    'Kariakoo Market trading energy',
    'Msasani Peninsula diplomatic quarter',
    'Slipway waterfront dining sunset',
    'Bongoyo Island offshore escape',
    'Azania Front Lutheran Cathedral',
    'Swahili coast gateway tropical heat',
  ],
  'port louis': [
    'Caudan Waterfront harbour promenade',
    'Aapravasi Ghat UNESCO heritage site',
    'Central Market tropical fruit abundance',
    'Champ de Mars racecourse tradition',
    'Fort Adelaide citadel hilltop views',
    'Blue Penny Museum rare stamp treasure',
    'China Town cultural quarter flavors',
    'Place dArmes palm-lined avenue',
    'Port Louis Theatre colonial elegance',
    'Indian Ocean island capital tropical charm',
  ],

  // ── AMERICAS ──────────────────────────────────────────────────────────────

  'new york': [
    'Manhattan skyline majesty towering',
    'Times Square brilliance pulsing',
    'Central Park serenity green heart',
    'Brooklyn Bridge views spanning',
    'Fifth Avenue elegance shopping',
    'Wall Street financial canyon',
    'Empire State Building art deco crown',
    'High Line elevated park strolling',
    'SoHo cast-iron loft district',
    'Statue of Liberty harbour guardian',
  ],
  chicago: [
    'lakefront skyline dramatic',
    'architectural innovation pioneering',
    'river canyon towers reflecting',
    'Windy City energy bold',
    'Midwest metropolis pride enduring',
    'Millennium Park Bean reflection',
    'Navy Pier lakeside entertainment',
    'Magnificent Mile shopping boulevard',
    'Wrigley Field ivy wall nostalgia',
    'Art Institute lion guardian steps',
  ],
  'los angeles': [
    'palm-lined boulevards stretching',
    'Hollywood hill views iconic',
    'beach city sprawl golden',
    'sunset strip glamour cruising',
    'entertainment capital glow radiating',
    'Griffith Observatory panoramic views',
    'Venice Beach boardwalk eclectic',
    'DTLA Arts District revival',
    'Santa Monica Pier carnival lights',
    'Getty Center hilltop architecture',
  ],
  'san francisco': [
    'Golden Gate vista fog-kissed',
    'cable car charm climbing',
    'bay bridge beauty spanning',
    'Victorian painted ladies row',
    'tech hub innovation disrupting',
    'Fishermans Wharf sea lion colony',
    'Chinatown dragon gate entrance',
    'Alcatraz Island bay prison mystique',
    'Mission District mural alley',
    'Ferry Building market waterfront',
  ],
  toronto: [
    'CN Tower skyline needle piercing',
    'multicultural city energy diverse',
    'lakefront views Ontario horizon',
    'downtown glass towers clustered',
    'diverse urban spirit welcoming',
    'Distillery District Victorian charm',
    'Kensington Market bohemian browsing',
    'St Lawrence Market weekend buzz',
    'Yorkville upscale neighbourhood',
    'PATH underground city network',
  ],
  'mexico city': [
    'Aztec modern fusion layered',
    'Zócalo plaza grandeur vast',
    'Chapultepec green oasis sprawling',
    'vibrant street art colorful',
    'colonial-contemporary mix striking',
    'Palacio de Bellas Artes marble dome',
    'Condesa neighbourhood art deco trees',
    'Coyoacán Frida Kahlo spirit',
    'Reforma Avenue angel monument',
    'Xochimilco floating garden canals',
  ],
  bogota: [
    'La Candelaria colonial cobblestones',
    'Monserrate hilltop church panorama',
    'Zona T nightlife dining triangle',
    'Botero Museum sculpted figures',
    'Usaquén flea market Sunday charm',
    'Graffiti Tour street art corridor',
    'Gold Museum pre-Colombian treasure',
    'Parque de la 93 green social hub',
    'Andean capital mountain-ringed basin',
    'Colombian renaissance cultural energy',
  ],
  lima: [
    'Plaza Mayor colonial grandeur',
    'Miraflores clifftop Pacific views',
    'Barranco bohemian bridge sighs',
    'Larco Museum pre-Inca pottery',
    'Huaca Pucllana pyramid ruins lit',
    'Costa Verde ocean highway drive',
    'San Isidro olive grove park',
    'Central District gastronomy capital',
    'Magic Water Circuit fountain show',
    'Pacific coast desert city drama',
  ],
  santiago: [
    'Andes mountain backdrop snow-capped',
    'Plaza de Armas colonial heart',
    'Sky Costanera tower observation',
    'Cerro San Cristóbal virgin statue',
    'Lastarria neighbourhood cafe culture',
    'Barrio Italia design district charm',
    'La Moneda presidential palace',
    'Mercado Central seafood hall',
    'Providencia modern commercial district',
    'Chilean capital wine country gateway',
  ],
  'buenos aires': [
    'European-style avenues grand',
    'tango city spirit passionate',
    'colorful La Boca houses',
    'Recoleta elegance refined',
    'passionate capital energy vibrant',
    'Plaza de Mayo Casa Rosada',
    'San Telmo antique market Sunday',
    'Puerto Madero docklands modern dining',
    'Palermo green parks bohemian bars',
    'Obelisco Avenida 9 de Julio icon',
  ],
  'sao paulo': [
    'sprawling metropolis endless',
    'Avenida Paulista towers flanking',
    'South American megacity pulsing',
    'cultural melting pot blending',
    'Brazilian economic engine driving',
    'Ibirapuera Park green lung',
    'Vila Madalena street art walls',
    'Pinacoteca art museum classical',
    'Liberdade Japanese quarter lanterns',
    'Edifício Itália observation rooftop',
  ],
  'são paulo': [
    'sprawling metropolis endless',
    'Avenida Paulista towers flanking',
    'South American megacity pulsing',
    'cultural melting pot blending',
    'Brazilian economic engine driving',
    'Ibirapuera Park green lung',
    'Vila Madalena street art walls',
    'Pinacoteca art museum classical',
    'Liberdade Japanese quarter lanterns',
    'Edifício Itália observation rooftop',
  ],
  rio: [
    'Sugarloaf mountain views rising',
    'Copacabana beach curve golden',
    'Christ Redeemer arms outstretched',
    'carnival city spirit explosive',
    'tropical metropolis beauty lush',
    'Ipanema sunset beach silhouettes',
    'Santa Teresa hilltop tram art',
    'Maracanã stadium football cathedral',
    'Lapa arches nightlife district',
    'Tijuca Forest urban rainforest',
  ],
  quito: [
    'Mitad del Mundo equator monument',
    'La Compañía Church golden baroque',
    'Old Town UNESCO heritage center',
    'TelefériQo cable car volcano views',
    'Plaza Grande presidential square',
    'La Ronda street colonial nightlife',
    'Panecillo hilltop virgin statue',
    'Basilica del Voto Nacional gothic spires',
    'Andean highland capital surrounded',
    'two-hemisphere city straddling equator',
  ],
  caracas: [
    'Avila Mountain dramatic green wall',
    'Plaza Bolívar liberation square heart',
    'Parque Central twin tower complex',
    'Teresa Carreño Theatre cultural anchor',
    'Sabana Grande boulevard pedestrian',
    'Teleférico cable car mountain ascent',
    'Panteón Nacional hero resting place',
    'Los Caobos Park museum corridor',
    'El Hatillo colonial village charm',
    'Venezuelan capital mountain valley setting',
  ],

  // ── OTHER / BONUS CITIES ──────────────────────────────────────────────────

  'tel aviv': [
    'Mediterranean beach city sunlit',
    'Bauhaus white city heritage',
    'startup hub energy innovative',
    'beachfront promenade stretching',
    'modern Middle East vibrant',
    'Carmel Market sensory overload',
    'Rothschild Boulevard cafe trees',
    'Jaffa old port ancient harbour',
    'Neve Tzedek first neighbourhood charm',
    'Florentin street art graffiti edge',
  ],
  delhi: [
    'historic monuments layered centuries',
    'India Gate grandeur commanding',
    'old-new city contrast vivid',
    'vibrant market energy overwhelming',
    'Mughal heritage backdrop ornate',
    'Red Fort sandstone fortress',
    'Chandni Chowk spice bazaar maze',
    'Lotus Temple marble petals',
    'Connaught Place colonial circle',
    'Qutub Minar minaret towering',
  ],
  moscow: [
    'Red Square grandeur vast',
    'Kremlin fortress walls ancient',
    'onion dome skyline colorful',
    'Soviet-modern contrast stark',
    'vast city expanse stretching',
    'Bolshoi Theatre neoclassical columns',
    'Arbat Street artist pedestrian',
    'Moscow City skyscraper cluster',
    'GUM department store arcade',
    'Metro stations underground palace',
  ],
};

// ============================================================================
// INTELLIGENT PHRASE SELECTION
// ============================================================================

function getTempPhrase(ctx: WeatherContext, seed: number): string {
  const temp = Math.max(-10, Math.min(50, Math.round(ctx.tempC)));
  const pool = TEMP_PHRASES[temp] ?? TEMP_PHRASES[20] ?? [];
  if (pool.length === 0) return 'mild';

  // Best-fit indices based on context
  let bestFit: number[] = [];
  if (ctx.isDry && ctx.isCold)
    bestFit = [0, 2, 4, 6, 8]; // Crisp, clear phrases
  else if (ctx.isHumid && ctx.isCold)
    bestFit = [1, 3, 5, 7, 9]; // Damp, heavy phrases
  else if (ctx.isStormy)
    bestFit = [10, 12, 14, 16, 18]; // Dramatic phrases
  else if (ctx.isNight) bestFit = [20, 22, 24, 26, 28]; // Quieter phrases

  return selectFromPool(pool, seed, bestFit);
}

function getHumidityPhrase(ctx: WeatherContext, seed: number): string {
  const h = Math.max(0, Math.min(100, Math.round(ctx.humidity)));
  const pool = HUMIDITY_PHRASES[h] ?? HUMIDITY_PHRASES[50] ?? [];
  if (pool.length === 0) return 'moderate humidity';

  let bestFit: number[] = [];
  if (ctx.isRainy)
    bestFit = [3, 4]; // Wet phrases
  else if (ctx.isHot)
    bestFit = [2, 3]; // Oppressive phrases
  else if (ctx.isCold) bestFit = [0, 1]; // Crisp phrases

  return selectFromPool(pool, seed * 1.1, bestFit);
}

function getWindPhrase(ctx: WeatherContext, seed: number): string {
  const w = Math.max(0, Math.min(100, Math.round(ctx.windKmh)));
  const pool = WIND_PHRASES[w] ?? WIND_PHRASES[10] ?? [];
  if (pool.length === 0) return 'gentle breeze';

  let bestFit: number[] = [];
  if (ctx.isStormy)
    bestFit = [2, 3]; // Fierce phrases
  else if (ctx.isRainy) bestFit = [1, 2]; // Moderate phrases

  return selectFromPool(pool, seed * 1.2, bestFit);
}

function getTimePhrase(ctx: WeatherContext, seed: number): TimeMoodLighting {
  const slot = Math.min(47, Math.max(0, ctx.hour * 2 + Math.floor(ctx.minute / 30)));
  const pool = TIME_PHRASES[slot] ?? TIME_PHRASES[24] ?? [];
  if (pool.length === 0) return { mood: 'daytime', lighting: 'natural light' };

  let bestFit: number[] = [];
  if (ctx.isStormy)
    bestFit = [2, 3]; // Dramatic lighting
  else if (ctx.isRainy) bestFit = [1, 4]; // Soft lighting

  return selectFromPool(pool, seed * 1.3, bestFit);
}

function getConditionPhrase(ctx: WeatherContext, seed: number): string {
  const emoji = ctx.emoji || 'default';
  const pool = CONDITION_PHRASES[emoji] ?? CONDITION_PHRASES['default'] ?? [];
  if (pool.length === 0) return 'clear skies';

  let bestFit: number[] = [];
  if (ctx.isWindy)
    bestFit = [5, 6, 7]; // Dynamic phrases
  else if (ctx.isNight) bestFit = [8, 9]; // Atmospheric phrases

  return selectFromPool(pool, seed * 1.4, bestFit);
}

function getCityVibe(city: string, seed: number): string {
  const cityLower = city.toLowerCase();

  for (const [key, vibes] of Object.entries(CITY_VIBES)) {
    if (cityLower.includes(key)) {
      return selectFromPool(vibes, seed * 1.5);
    }
  }

  return '';
}

// ============================================================================
// TIER-SPECIFIC GENERATORS
// ============================================================================

function generateTier1(city: string, weather: ExchangeWeatherFull, hour: number): string {
  const ctx = buildContext(weather, hour);
  const seed = ctx.tempC * 100 + ctx.humidity * 10 + ctx.windKmh + hour;

  const time = getTimePhrase(ctx, seed);
  const temp = getTempPhrase(ctx, seed);
  const condition = getConditionPhrase(ctx, seed);
  const wind = getWindPhrase(ctx, seed);
  const vibe = getCityVibe(city, seed);

  const cityPart = vibe ? `${city} ${vibe}` : city;

  const parts = [
    `${cityPart}::1.3`,
    // Inject real API description verbatim (e.g., "broken clouds", "light rain")
    // Only present for live data — demo has empty string, skipped by filter(Boolean).
    ctx.description || null,
    `${time.mood}::1.2`,
    `(${condition}:1.2)`,
    temp,
    `${wind} atmosphere`,
    time.lighting,
    'masterpiece',
    'best quality',
    '8k',
  ].filter(Boolean);

  return `${parts.join(', ')} --no people text watermarks logos blurry`;
}

function generateTier2(city: string, weather: ExchangeWeatherFull, hour: number): string {
  const ctx = buildContext(weather, hour);
  const seed = ctx.tempC * 100 + ctx.humidity * 10 + ctx.windKmh + hour;

  const time = getTimePhrase(ctx, seed);
  const temp = getTempPhrase(ctx, seed);
  const condition = getConditionPhrase(ctx, seed);
  const wind = getWindPhrase(ctx, seed);
  const vibe = getCityVibe(city, seed);

  const vibeDescription = vibe ? `, ${vibe}` : '';

  const description = [
    `${time.mood} in ${city}${vibeDescription}`,
    // Inject real API description verbatim when present (live data only)
    ctx.description || null,
    time.lighting,
    condition,
    `${temp} ${Math.round(weather.temperatureC)}°C atmosphere`,
    `${wind} energy`,
  ]
    .filter(Boolean)
    .join(', ');

  return `${description} --ar 16:9 --stylize 100 --no people text`;
}

function generateTier3(city: string, weather: ExchangeWeatherFull, hour: number): string {
  const ctx = buildContext(weather, hour);
  const seed = ctx.tempC * 100 + ctx.humidity * 10 + ctx.windKmh + hour;

  const time = getTimePhrase(ctx, seed);
  const temp = getTempPhrase(ctx, seed);
  const humidity = getHumidityPhrase(ctx, seed);
  const condition = getConditionPhrase(ctx, seed);
  const wind = getWindPhrase(ctx, seed);
  const vibe = getCityVibe(city, seed);

  const vibeDescription = vibe ? ` with its ${vibe}` : '';

  // Inject real API description (e.g., "with haze", "with broken clouds") when present
  const apiConditionClause = ctx.description ? ` with ${ctx.description}` : '';

  return [
    `A ${time.mood} scene in ${city}${vibeDescription}${apiConditionClause}, with ${time.lighting} illuminating the cityscape.`,
    `The sky shows ${condition}, creating a ${temp} atmosphere at ${Math.round(weather.temperatureC)} degrees.`,
    `${humidity.charAt(0).toUpperCase() + humidity.slice(1)} with ${wind} movement.`,
    'Photorealistic, highly detailed urban landscape.',
    'No people or text visible.',
  ].join(' ');
}

/**
 * Tier 4: Plain Language - NO EMOJI
 * Rich comma-separated prompt with full atmospheric data
 */
function generateTier4(city: string, weather: ExchangeWeatherFull, hour: number): string {
  const ctx = buildContext(weather, hour);
  const seed = ctx.tempC * 100 + ctx.humidity * 10 + ctx.windKmh + hour;

  const time = getTimePhrase(ctx, seed);
  const _temp = getTempPhrase(ctx, seed);
  const condition = getConditionPhrase(ctx, seed);
  const wind = getWindPhrase(ctx, seed);
  const humidity = getHumidityPhrase(ctx, seed);
  const vibe = getCityVibe(city, seed);

  // Extract short humidity (e.g., "dry comfortable" from "dry comfortable air")
  const humidityShort = humidity.split(' ').slice(0, 2).join(' ');

  // NO EMOJI in output - replaced with condition phrase
  const parts = [
    city,
    vibe || null,
    // Inject real API description verbatim (e.g., "haze", "broken clouds")
    // Only present for live data — demo has empty string, skipped by filter(Boolean).
    ctx.description || null,
    time.mood,
    time.lighting,
    condition,
    `${Math.round(weather.temperatureC)}°C`,
    wind,
    humidityShort,
  ].filter(Boolean);

  return parts.join(', ');
}

// ============================================================================
// MAIN GENERATOR
// ============================================================================

export function generateWeatherPrompt(input: WeatherPromptInput): string {
  const { city, weather, localHour, tier } = input;

  switch (tier) {
    case 1:
      return generateTier1(city, weather, localHour);
    case 2:
      return generateTier2(city, weather, localHour);
    case 3:
      return generateTier3(city, weather, localHour);
    case 4:
    default:
      return generateTier4(city, weather, localHour);
  }
}

export function getDefaultTier(): PromptTier {
  return 4;
}

export function getTierInfo(tier: PromptTier): TierInfo {
  return TIER_INFO[tier];
}

export function getAllTierOptions(): TierInfo[] {
  return [TIER_INFO[1], TIER_INFO[2], TIER_INFO[3], TIER_INFO[4]];
}

// ============================================================================
// LEGACY EXPORTS (backward compatibility)
// ============================================================================

/** @deprecated Use generateWeatherPrompt with full context */
export function getTempFeel(tempC: number): { feel: string; atmosphere: string } {
  const ctx = buildContext(
    {
      temperatureC: tempC,
      humidity: 50,
      windSpeedKmh: 10,
      conditions: 'Clear',
      description: 'clear sky',
      emoji: '☀️',
      temperatureF: tempC * 1.8 + 32,
    },
    12,
  );
  const phrase = getTempPhrase(ctx, tempC);
  return { feel: phrase.split(' ').slice(0, 2).join(' '), atmosphere: phrase };
}

/** @deprecated Use generateWeatherPrompt with full context */
export function getHumidityTexture(humidity: number): string {
  const ctx = buildContext(
    {
      temperatureC: 20,
      humidity,
      windSpeedKmh: 10,
      conditions: 'Clear',
      description: 'clear sky',
      emoji: '☀️',
      temperatureF: 68,
    },
    12,
  );
  return getHumidityPhrase(ctx, humidity);
}

/** @deprecated Use generateWeatherPrompt with full context */
export function getWindEnergy(windKmh: number): string {
  const ctx = buildContext(
    {
      temperatureC: 20,
      humidity: 50,
      windSpeedKmh: windKmh,
      conditions: 'Clear',
      description: 'clear sky',
      emoji: '☀️',
      temperatureF: 68,
    },
    12,
  );
  return getWindPhrase(ctx, windKmh);
}

/** @deprecated Use generateWeatherPrompt with full context */
export function getTimeMood(hour: number): { mood: string; lighting: string } {
  const ctx = buildContext(
    {
      temperatureC: 20,
      humidity: 50,
      windSpeedKmh: 10,
      conditions: 'Clear',
      description: 'clear sky',
      emoji: '☀️',
      temperatureF: 68,
    },
    hour,
  );
  return getTimePhrase(ctx, hour);
}

/** @deprecated Use generateWeatherPrompt with full context */
export function getConditionVisual(condition: string, description: string): string {
  const ctx = buildContext(
    {
      temperatureC: 20,
      humidity: 50,
      windSpeedKmh: 10,
      conditions: condition,
      description,
      emoji: '☀️',
      temperatureF: 68,
    },
    12,
  );
  return getConditionPhrase(ctx, 12);
}
