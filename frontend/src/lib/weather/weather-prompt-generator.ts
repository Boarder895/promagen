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
    isStormy: desc.includes('storm') || desc.includes('thunder') || cond.includes('thunder'),
    isRainy: desc.includes('rain') || desc.includes('drizzle') || cond.includes('rain'),
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
      'biting arctic freeze', 'brutal polar cold', 'bone-chilling freeze', 'severe subzero cold',
      'harsh frozen air', 'piercing glacial cold', 'numbing deep freeze', 'extreme winter bite',
      'frigid arctic blast', 'savage cold front', 'relentless freezing', 'punishing ice cold',
      'merciless winter chill', 'dangerous freezing', 'life-threatening cold', 'crystalline frozen air',
      'diamond-hard frost', 'breath-catching freeze', 'lung-searing cold', 'unforgiving arctic',
      'treacherous subzero', 'extreme polar vortex', 'deadly winter cold', 'catastrophic freeze',
      'record-breaking cold', 'historical freeze', 'unprecedented chill', 'apocalyptic winter',
      'survival-testing freeze', 'dangerous exposure cold'
    );
  } else if (t <= -1) {
    // Freezing
    phrases.push(
      'sharp winter chill', 'icy grip', 'frosty cold snap', 'frozen morning air',
      'crisp freezing bite', 'sparkling frost cold', 'winter wonderland chill', 'snowy cold air',
      'bracing subzero', 'invigorating freeze', 'pristine winter cold', 'refreshing ice air',
      'clean freezing clarity', 'pure winter atmosphere', 'crystalline cold morning', 'frost-kissed air',
      'winter-fresh freeze', 'snow-scented cold', 'holiday season chill', 'festive winter cold',
      'cozy fireplace weather', 'hot chocolate cold', 'bundled-up weather', 'mitten-worthy freeze',
      'scarf-essential cold', 'boot-weather chill', 'winter coat cold', 'layering weather',
      'breath-visible freeze', 'nostril-tingling cold'
    );
  } else if (t <= 4) {
    // Cold (0-4°C)
    phrases.push(
      'freezing point chill', 'crisp winter air', 'bracing cold morning', 'invigorating chill',
      'fresh winter atmosphere', 'clean cold clarity', 'energizing cool air', 'awakening coldness',
      'stimulating winter feel', 'refreshing bite', 'alert-making cold', 'mind-clearing chill',
      'productive cold weather', 'focused cool air', 'sharp clear coldness', 'pristine cool morning',
      'dew-point chill', 'grass-frosting cold', 'puddle-icing weather', 'car-scraping morning',
      'jacket-zipping cold', 'hand-pocket weather', 'quick-walk cold', 'coffee-warming weather',
      'soup-craving chill', 'stew-weather cold', 'comfort-food atmosphere', 'hearty-meal weather',
      'warming-up cold', 'indoor-cozy weather'
    );
  } else if (t <= 9) {
    // Cool (5-9°C)
    phrases.push(
      'cool crisp morning', 'brisk refreshing air', 'sweater weather cool', 'light jacket temperature',
      'pleasant cool breeze', 'autumn-like freshness', 'spring morning cool', 'comfortable chill',
      'energizing coolness', 'hiking-perfect weather', 'outdoor activity cool', 'walking weather',
      'cafe terrace cool', 'window-open fresh', 'ventilating coolness', 'sleeping-perfect temp',
      'blanket-cozy weather', 'long-sleeve cool', 'cardigan temperature', 'layering-optional cool',
      'transitional weather', 'shoulder-season cool', 'moderate chill', 'gentle coolness',
      'mild winter feel', 'early spring air', 'late autumn cool', 'temperate chill',
      'balanced cool weather', 'ideal walking temp'
    );
  } else if (t <= 14) {
    // Mild (10-14°C)
    phrases.push(
      'mild morning air', 'comfortable coolness', 'pleasant temperate', 'ideal outdoor weather',
      'perfect walking temperature', 'refreshing mildness', 'spring-like warmth', 'gentle fresh air',
      'balanced atmosphere', 'easy-breathing weather', 'comfortable outdoor temp', 'activity-perfect mild',
      'garden weather', 'picnic-suitable mild', 'terrace-dining weather', 'al fresco temperature',
      'window-shopping weather', 'strolling temperature', 'photography-perfect mild', 'tourist-ideal weather',
      'sightseeing temperature', 'exploration-friendly', 'adventure-ready mild', 'cycling weather',
      'jogging-perfect temp', 'exercise-ideal mild', 'sport-friendly weather', 'training temperature',
      'productive outdoor mild', 'meeting-walk weather'
    );
  } else if (t <= 19) {
    // Comfortable (15-19°C)
    phrases.push(
      'comfortable spring air', 'pleasant warm morning', 'ideal temperature', 'perfect weather',
      'balmy fresh atmosphere', 'delightful mildness', 'sweet spot temperature', 'golden weather',
      'paradise-like mild', 'year-round ideal', 'California-style weather', 'Mediterranean comfort',
      'vacation temperature', 'resort-perfect mild', 'honeymoon weather', 'romantic temperature',
      'date-night weather', 'celebration-worthy', 'wedding-perfect temp', 'event-ideal weather',
      'party temperature', 'gathering-friendly', 'social weather', 'community-gathering temp',
      'festival-ready mild', 'concert-perfect weather', 'outdoor-event ideal', 'marathon weather',
      'race-day temperature', 'competition-ready mild'
    );
  } else if (t <= 24) {
    // Warm (20-24°C)
    phrases.push(
      'warm balmy air', 'pleasant summer warmth', 'comfortable heat', 'gentle warm breeze',
      'inviting warmth', 'embracing mild heat', 'soft warm atmosphere', 'welcoming temperature',
      'beach-teasing warmth', 'pool-tempting heat', 'ice-cream weather', 'cold-drink temperature',
      'shorts-optional warmth', 't-shirt weather', 'sandals-ready heat', 'bare-arms temperature',
      'sun-kissed warmth', 'golden afternoon heat', 'lazy summer feel', 'hammock weather',
      'reading-outdoors warmth', 'nap-inducing heat', 'siesta temperature', 'relaxation weather',
      'sunset-watching warmth', 'rooftop-bar weather', 'patio-dining heat', 'terrace-lounging temp',
      'garden-party warmth', 'barbecue weather'
    );
  } else if (t <= 29) {
    // Hot (25-29°C)
    phrases.push(
      'hot summer air', 'warm humid afternoon', 'tropical warmth', 'beach-perfect heat',
      'swimming weather', 'diving-into-pool hot', 'water-park temperature', 'sprinkler-running weather',
      'fan-worthy heat', 'AC-appreciating warmth', 'shade-seeking hot', 'sunglasses-essential heat',
      'sunscreen-mandatory', 'hat-wearing weather', 'parasol-worthy heat', 'hydration-critical hot',
      'water-bottle weather', 'electrolyte temperature', 'sweat-inducing warmth', 'perspiration heat',
      'cooling-off weather', 'refreshment-seeking hot', 'coconut-water temp', 'smoothie weather',
      'frozen-treat heat', 'popsicle temperature', 'sorbet weather', 'gelato-craving hot',
      'watermelon-weather heat', 'summer-fruit temperature'
    );
  } else if (t <= 34) {
    // Scorching (30-34°C)
    phrases.push(
      'scorching hot air', 'blazing afternoon heat', 'intense summer warmth', 'searing temperature',
      'baking hot weather', 'oven-like heat', 'furnace-feeling warmth', 'relentless sun heat',
      'punishing hot afternoon', 'brutal summer heat', 'sweltering atmosphere', 'suffocating warmth',
      'oppressive heat wave', 'energy-draining hot', 'exhausting temperature', 'demanding heat',
      'challenging hot weather', 'endurance-testing warmth', 'survival-mode heat', 'extreme summer hot',
      'dangerous heat advisory', 'warning-level warmth', 'health-risk temperature', 'elderly-warning heat',
      'pet-safety hot', 'pavement-burning warmth', 'egg-frying heat', 'metal-burning temperature',
      'car-interior scorching', 'steering-wheel hot'
    );
  } else if (t <= 40) {
    // Extreme (35-40°C)
    phrases.push(
      'severe scorching air', 'brutal afternoon heat', 'dangerous hot weather', 'life-threatening warmth',
      'extreme heat emergency', 'critical temperature', 'survival-challenging hot', 'desert-like heat',
      'death-valley warmth', 'saharan temperature', 'middle-eastern hot', 'gulf-state heat',
      'outback-intensity warmth', 'furnace-blast temperature', 'volcanic hot air', 'magma-adjacent heat',
      'record-breaking warmth', 'historical heat wave', 'unprecedented temperature', 'climate-extreme hot',
      'infrastructure-stressing heat', 'grid-threatening warmth', 'power-outage temperature', 'AC-failing hot',
      'emergency-shelter heat', 'cooling-center weather', 'hydration-emergency warmth', 'medical-alert hot',
      'stay-indoors temperature', 'activity-suspension heat'
    );
  } else {
    // Dangerous (41-50°C)
    phrases.push(
      'extreme furnace air', 'critical burning heat', 'unsurvivable outdoor warmth', 'apocalyptic temperature',
      'record-shattering hot', 'catastrophic heat wave', 'civilization-testing warmth', 'uninhabitable heat',
      'mars-surface temperature', 'venus-like atmosphere', 'hellscape warmth', 'inferno conditions',
      'maximum danger heat', 'immediate-shelter temperature', 'emergency-broadcast warmth', 'evacuation-level hot',
      'mass-casualty heat', 'hospital-overwhelming warmth', 'morgue-filling temperature', 'extinction-event hot',
      'planet-warning heat', 'climate-collapse warmth', 'tipping-point temperature', 'no-return heat',
      'permanent-damage warmth', 'ecosystem-destroying hot', 'agriculture-ending heat', 'water-evaporating warmth',
      'concrete-cracking temperature', 'steel-warping heat'
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
      'bone-dry parched air', 'desert-dry atmosphere', 'arid crisp clarity', 
      'dehydrating dryness', 'static-electric dry'
    );
  } else if (h < 30) {
    phrases.push(
      'very dry crisp air', 'arid fresh atmosphere', 'low-humidity clarity',
      'pleasantly dry conditions', 'skin-tightening dryness'
    );
  } else if (h < 40) {
    phrases.push(
      'dry comfortable air', 'crisp dry atmosphere', 'refreshingly dry',
      'optimal low humidity', 'clear dry conditions'
    );
  } else if (h < 50) {
    phrases.push(
      'comfortable fresh air', 'balanced atmosphere', 'ideal humidity level',
      'pleasant moisture balance', 'perfect breathing conditions'
    );
  } else if (h < 60) {
    phrases.push(
      'comfortable moist air', 'pleasant humidity', 'soft atmospheric moisture',
      'gentle humid freshness', 'breathable moist conditions'
    );
  } else if (h < 70) {
    phrases.push(
      'humid fresh air', 'moist atmosphere', 'noticeable humidity',
      'damp-feeling conditions', 'moisture-laden air'
    );
  } else if (h < 80) {
    phrases.push(
      'humid damp air', 'heavy moisture', 'tropical humidity feel',
      'sticky atmospheric moisture', 'perspiration-inducing damp'
    );
  } else if (h < 90) {
    phrases.push(
      'very humid thick air', 'tropical heavy moisture', 'oppressive dampness',
      'sweat-drenching humidity', 'sauna-like moisture'
    );
  } else {
    phrases.push(
      'extreme humid saturation', 'monsoon-like moisture', 'near-rain humidity',
      'fog-forming dampness', 'visibility-reducing moisture'
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
    phrases.push('perfectly still calm', 'motionless tranquil air', 'windless serenity', 'absolute stillness');
  } else if (w < 12) {
    phrases.push('gentle light breeze', 'soft whisper wind', 'delicate air movement', 'subtle rustling');
  } else if (w < 20) {
    phrases.push('moderate steady breeze', 'pleasant wind flow', 'comfortable air movement', 'refreshing gusts');
  } else if (w < 30) {
    phrases.push('brisk gusty wind', 'energetic breeze', 'invigorating wind', 'hair-tousling gusts');
  } else if (w < 40) {
    phrases.push('strong powerful wind', 'forceful gusting breeze', 'robust wind energy', 'flag-snapping gusts');
  } else if (w < 50) {
    phrases.push('very strong fierce wind', 'intense gusting force', 'tree-bending breeze', 'walking-challenging wind');
  } else if (w < 62) {
    phrases.push('gale-force strong wind', 'severe wind intensity', 'umbrella-destroying gusts', 'debris-moving force');
  } else if (w < 75) {
    phrases.push('storm-force violent wind', 'dangerous wind power', 'damage-causing gusts', 'structural-testing force');
  } else if (w < 89) {
    phrases.push('severe storm wind', 'destructive wind force', 'hurricane-adjacent gusts', 'emergency-level power');
  } else {
    phrases.push('hurricane-force extreme wind', 'catastrophic wind power', 'life-threatening gusts', 'apocalyptic wind force');
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
      { mood: 'pre-dawn darkness', lighting: 'sparse urban lighting' }
    );
  } else if (hour >= 5 && hour < 7) {
    // Dawn
    phrases.push(
      { mood: 'dawn breaking softly', lighting: 'soft golden hour light' },
      { mood: 'sunrise awakening', lighting: 'pink-orange horizon glow' },
      { mood: 'early morning birth', lighting: 'gentle warm illumination' },
      { mood: 'day beginning fresh', lighting: 'pastel sky colors' },
      { mood: 'sunrise promise', lighting: 'golden rim lighting' }
    );
  } else if (hour >= 7 && hour < 11) {
    // Morning
    phrases.push(
      { mood: 'bright morning energy', lighting: 'clear morning light' },
      { mood: 'fresh day beginning', lighting: 'crisp daylight clarity' },
      { mood: 'productive morning buzz', lighting: 'sharp clean illumination' },
      { mood: 'energetic day start', lighting: 'bright natural light' },
      { mood: 'vibrant morning activity', lighting: 'shadow-casting sunlight' }
    );
  } else if (hour >= 11 && hour < 14) {
    // Midday
    phrases.push(
      { mood: 'midday sun peak', lighting: 'harsh overhead light' },
      { mood: 'noon intensity', lighting: 'minimal shadow brightness' },
      { mood: 'high sun moment', lighting: 'flat bright illumination' },
      { mood: 'solar maximum energy', lighting: 'bleaching overhead rays' },
      { mood: 'zenith sun power', lighting: 'contrast-flattening light' }
    );
  } else if (hour >= 14 && hour < 17) {
    // Afternoon
    phrases.push(
      { mood: 'afternoon warmth', lighting: 'warm afternoon light' },
      { mood: 'post-lunch leisure', lighting: 'angled golden rays' },
      { mood: 'lazy afternoon feeling', lighting: 'lengthening shadows' },
      { mood: 'productive afternoon', lighting: 'rich warm illumination' },
      { mood: 'day winding down', lighting: 'honeyed sunlight' }
    );
  } else if (hour >= 17 && hour < 20) {
    // Golden hour / Sunset
    phrases.push(
      { mood: 'golden hour magic', lighting: 'dramatic golden light' },
      { mood: 'sunset splendor', lighting: 'warm orange illumination' },
      { mood: 'evening gold cascade', lighting: 'cinematic warm glow' },
      { mood: 'dusk approaching beauty', lighting: 'rich amber rays' },
      { mood: 'day-end magnificence', lighting: 'spectacular sunset colors' }
    );
  } else if (hour >= 20 && hour < 22) {
    // Twilight
    phrases.push(
      { mood: 'evening twilight', lighting: 'soft blue hour light' },
      { mood: 'dusk descending', lighting: 'purple-blue gradient sky' },
      { mood: 'night approaching', lighting: 'first lights emerging' },
      { mood: 'day-to-night transition', lighting: 'mixed artificial-natural' },
      { mood: 'twilight serenity', lighting: 'deep blue illumination' }
    );
  } else {
    // Night (22-23)
    phrases.push(
      { mood: 'night descending', lighting: 'ambient city lights' },
      { mood: 'evening settling', lighting: 'urban glow patterns' },
      { mood: 'nocturnal awakening', lighting: 'neon and streetlight mix' },
      { mood: 'nightlife beginning', lighting: 'colorful night illumination' },
      { mood: 'darkness embracing', lighting: 'artificial light warmth' }
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
    'brilliant clear blue sky', 'radiant sunshine', 'crystal clear atmosphere',
    'pristine sunny conditions', 'perfect cloudless expanse', 'dazzling solar brightness',
    'unobstructed sky clarity', 'vivid blue heavens', 'luminous clear day',
    'spectacular sunshine display'
  ],
  '🌤️': [
    'scattered white clouds', 'drifting cloud wisps', 'partial sunny breaks',
    'intermittent cloud shadows', 'mostly sunny skies', 'decorative cloud accents',
    'pleasant partly cloudy', 'sun-dominated sky', 'light cloud decoration',
    'fair weather clouds'
  ],
  '⛅': [
    'sun-cloud interplay', 'mixed sky conditions', 'alternating light patterns',
    'dynamic cloud movement', 'variable sky coverage', 'shifting sun shadows',
    'partly obscured sun', 'cloud-filtered sunlight', 'broken cloud layer',
    'patchy cloud coverage'
  ],
  // Overcast
  '☁️': [
    'complete cloud blanket', 'grey overcast sky', 'uniform cloud cover',
    'diffused soft light', 'muted grey atmosphere', 'flat cloud ceiling',
    'shadowless cloudy day', 'gentle overcast mood', 'silver-grey sky dome',
    'soft diffused lighting'
  ],
  // Rain
  '🌧️': [
    'rain-slicked streets', 'wet glistening surfaces', 'falling rain curtain',
    'reflective wet pavement', 'drizzle-misted air', 'rain-washed atmosphere',
    'puddle-dotted ground', 'droplet-covered surfaces', 'precipitation veil',
    'rainy day ambiance'
  ],
  '🌦️': [
    'sun-shower magic', 'rain with sunshine', 'golden rain drops',
    'rainbow-potential weather', 'light rain sparkle', 'sun-illuminated drizzle',
    'brief shower passing', 'scattered rain patches', 'intermittent precipitation',
    'dramatic weather contrast'
  ],
  // Storm
  '⛈️': [
    'dramatic storm clouds', 'thundering dark sky', 'lightning-charged atmosphere',
    'turbulent storm front', 'menacing cloud towers', 'electric storm energy',
    'powerful thunderstorm', 'rain-lashed conditions', 'dramatic weather event',
    'nature-fury display'
  ],
  // Snow
  '🌨️': [
    'gentle snowfall', 'white snow blanket', 'floating snowflakes',
    'winter wonderland scene', 'pristine snow covering', 'soft snow descent',
    'quiet snowfall magic', 'crystal snow falling', 'peaceful white precipitation',
    'enchanting snow shower'
  ],
  '❄️': [
    'heavy snow conditions', 'blizzard-like snowfall', 'thick snow blanket',
    'intense winter storm', 'visibility-reducing snow', 'accumulating snowfall',
    'serious snow event', 'winter storm conditions', 'deep snow coverage',
    'major snow precipitation'
  ],
  // Fog/Mist
  '🌫️': [
    'atmospheric fog veil', 'thick mist blanket', 'mysterious haze',
    'visibility-softening fog', 'ethereal mist atmosphere', 'dreamlike fog layer',
    'romantic mist covering', 'soft fog diffusion', 'haunting fog presence',
    'delicate mist curtain'
  ],
  // Wind
  '💨': [
    'wind-swept atmosphere', 'blustery conditions', 'gusting wind energy',
    'air-in-motion feeling', 'dynamic wind presence', 'movement-filled air',
    'wind-animated scene', 'breeze-driven activity', 'air current visibility',
    'wind-shaped environment'
  ],
  // Extreme
  '🌪️': [
    'tornado-warning conditions', 'severe rotating storm', 'dangerous wind event',
    'extreme weather emergency', 'funnel cloud threat', 'violent storm system',
    'life-threatening conditions', 'emergency weather situation', 'catastrophic storm potential',
    'maximum danger weather'
  ],
  // Default/Unknown
  'default': [
    'dynamic sky conditions', 'changing weather patterns', 'variable atmosphere',
    'mixed weather elements', 'transitional sky', 'evolving conditions',
    'atmospheric variation', 'weather in flux', 'shifting sky mood',
    'unpredictable elements'
  ]
};

// ============================================================================
// CITY VIBES (50+ cities × 5 vibes each)
// ============================================================================

const CITY_VIBES: Record<string, string[]> = {
  tokyo: [
    'neon-lit streets of Shibuya', 'towering Shinjuku skyscrapers', 'serene Senso-ji temple grounds',
    'bustling Ginza district', 'electric Akihabara energy'
  ],
  'new york': [
    'Manhattan skyline majesty', 'Times Square brilliance', 'Central Park serenity',
    'Brooklyn bridge views', 'Fifth Avenue elegance'
  ],
  london: [
    'Victorian architecture grandeur', 'Thames river reflections', 'Big Ben silhouette',
    'red double-decker charm', 'royal palace backdrop'
  ],
  paris: [
    'Haussmann boulevards', 'Eiffel Tower silhouette', 'Seine riverside beauty',
    'Montmartre artistic spirit', 'Champs-Élysées glamour'
  ],
  sydney: [
    'harbour bridge icon', 'Opera House curves', 'Bondi beach vibes',
    'harbour ferry views', 'coastal city sparkle'
  ],
  'hong kong': [
    'dense urban towers', 'Victoria Peak panorama', 'neon-soaked streets',
    'harbor skyline drama', 'vertical city energy'
  ],
  singapore: [
    'modern cityscape', 'Marina Bay splendor', 'garden city greenery',
    'futuristic architecture', 'tropical urban blend'
  ],
  dubai: [
    'futuristic skyscrapers', 'Burj Khalifa majesty', 'desert luxury towers',
    'Palm Jumeirah views', 'gold-touched architecture'
  ],
  shanghai: [
    'Pudong skyline drama', 'Oriental Pearl tower', 'Bund historic contrast',
    'neon river reflections', 'mega-city ambition'
  ],
  mumbai: [
    'bustling streets energy', 'Gateway of India backdrop', 'Bollywood city spirit',
    'Arabian Sea views', 'colonial architecture mix'
  ],
  delhi: [
    'historic monuments', 'India Gate grandeur', 'old-new city contrast',
    'vibrant market energy', 'Mughal heritage backdrop'
  ],
  frankfurt: [
    'financial district towers', 'Main river skyline', 'European banking hub',
    'modern glass architecture', 'old town contrast'
  ],
  zurich: [
    'alpine city views', 'pristine lake shores', 'Swiss precision architecture',
    'banking district elegance', 'mountain backdrop majesty'
  ],
  seoul: [
    'modern K-city blend', 'Gangnam district style', 'palace-meets-skyscraper',
    'Han River panorama', 'neon pop culture energy'
  ],
  toronto: [
    'CN Tower skyline', 'multicultural city energy', 'lakefront views',
    'downtown glass towers', 'diverse urban spirit'
  ],
  bangkok: [
    'temple spires and towers', 'Chao Phraya river life', 'golden Buddha shrines',
    'rooftop bar skyline', 'street food energy'
  ],
  jakarta: [
    'tropical megacity', 'modern tower clusters', 'bustling street life',
    'Indonesian capital energy', 'diverse urban tapestry'
  ],
  taipei: [
    'Taipei 101 cityscape', 'night market energy', 'mountain-ringed basin',
    'modern Asian metropolis', 'temple-tech contrast'
  ],
  manila: [
    'bay city skyline', 'historic Intramuros', 'tropical urban energy',
    'Makati district towers', 'island capital spirit'
  ],
  'kuala lumpur': [
    'Petronas Towers icon', 'modern Islamic architecture', 'tropical city greenery',
    'diverse cultural blend', 'Malaysian capital pride'
  ],
  istanbul: [
    'minarets and Bosphorus', 'Blue Mosque silhouette', 'two-continent city',
    'bazaar maze energy', 'Ottoman grandeur'
  ],
  moscow: [
    'Red Square grandeur', 'Kremlin fortress walls', 'onion dome skyline',
    'Soviet-modern contrast', 'vast city expanse'
  ],
  chicago: [
    'lakefront skyline', 'architectural innovation', 'river canyon towers',
    'Windy City energy', 'Midwest metropolis pride'
  ],
  'los angeles': [
    'palm-lined boulevards', 'Hollywood hill views', 'beach city sprawl',
    'sunset strip glamour', 'entertainment capital glow'
  ],
  'san francisco': [
    'Golden Gate vista', 'cable car charm', 'bay bridge beauty',
    'Victorian painted ladies', 'tech hub innovation'
  ],
  'mexico city': [
    'aztec modern fusion', 'Zócalo plaza grandeur', 'Chapultepec green oasis',
    'vibrant street art', 'colonial-contemporary mix'
  ],
  'buenos aires': [
    'European-style avenues', 'tango city spirit', 'colorful La Boca',
    'Recoleta elegance', 'passionate capital energy'
  ],
  rio: [
    'Sugarloaf mountain views', 'Copacabana beach curve', 'Christ Redeemer watch',
    'carnival city spirit', 'tropical metropolis beauty'
  ],
  cairo: [
    'Nile river cityscape', 'pyramid backdrop', 'ancient-modern layers',
    'Islamic architecture richness', 'pharaonic heritage'
  ],
  'cape town': [
    'Table Mountain backdrop', 'waterfront beauty', 'Atlantic coast views',
    'African metropolis charm', 'natural wonder setting'
  ],
  'abu dhabi': [
    'desert luxury towers', 'Sheikh Zayed Mosque', 'Louvre dome architecture',
    'oil wealth grandeur', 'futuristic Arabian city'
  ],
  riyadh: [
    'modern Arabian city', 'Kingdom Tower skyline', 'desert capital ambition',
    'Saudi architectural vision', 'tradition-meets-future'
  ],
  'tel aviv': [
    'Mediterranean beach city', 'Bauhaus white city', 'startup hub energy',
    'beachfront promenade', 'modern Middle East'
  ],
  vienna: [
    'imperial baroque streets', 'Ringstrasse grandeur', 'coffee house culture',
    'classical music heritage', 'Habsburg elegance'
  ],
  prague: [
    'gothic spires old town', 'Charles Bridge romance', 'castle hill views',
    'astronomical clock square', 'Bohemian historic beauty'
  ],
  warsaw: [
    'modern phoenix city', 'old town reconstruction', 'Vistula river views',
    'communist-era contrast', 'resilient capital spirit'
  ],
  stockholm: [
    'Nordic waterfront beauty', 'island city archipelago', 'Scandinavian design',
    'Gamla Stan cobblestones', 'Baltic sea views'
  ],
  oslo: [
    'fjord city architecture', 'Nordic modernism', 'Viking heritage backdrop',
    'sustainable urban design', 'waterfront renewal'
  ],
  copenhagen: [
    'colorful harbour Nyhavn', 'Nordic design capital', 'cycling city spirit',
    'hygge atmosphere', 'Scandinavian livability'
  ],
  helsinki: [
    'Nordic design capital', 'Baltic sea waterfront', 'sauna city culture',
    'art nouveau architecture', 'Finnish modernism'
  ],
  dublin: [
    'Georgian architecture', 'Temple Bar spirit', 'Liffey river views',
    'literary city heritage', 'Celtic capital charm'
  ],
  lisbon: [
    'hillside tram streets', 'pastel building facades', 'Tagus river views',
    'fado music spirit', 'maritime heritage'
  ],
  barcelona: [
    'Gaudí modernist city', 'Mediterranean beach blend', 'Gothic Quarter maze',
    'Ramblas promenade energy', 'Catalan architectural pride'
  ],
  rome: [
    'ancient eternal city', 'Colosseum grandeur', 'Vatican proximity',
    'fountain-dotted piazzas', 'empire ruins backdrop'
  ],
  athens: [
    'Acropolis backdrop', 'ancient democracy birthplace', 'white marble heritage',
    'Mediterranean light', 'classical civilization'
  ],
  brussels: [
    'Grand Place splendor', 'art nouveau treasures', 'European Union hub',
    'chocolate city sweetness', 'Belgian capital charm'
  ],
  amsterdam: [
    'canal-side streets', 'bicycle city culture', 'gabled house rows',
    'museum quarter richness', 'Dutch golden age heritage'
  ],
  'sao paulo': [
    'sprawling metropolis', 'Avenida Paulista towers', 'South American megacity',
    'cultural melting pot', 'Brazilian economic engine'
  ],
  johannesburg: [
    'African cityscape', 'gold mining heritage', 'Mandela legacy',
    'urban renewal energy', 'rainbow nation hub'
  ],
  wellington: [
    'harbour capital beauty', 'windy city character', 'film industry creativity',
    'compact waterfront', 'New Zealand governance'
  ],
  auckland: [
    'Sky Tower waterfront', 'city of sails', 'volcanic isthmus setting',
    'Pacific gateway', 'Kiwi urban spirit'
  ]
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
  if (ctx.isDry && ctx.isCold) bestFit = [0, 2, 4, 6, 8]; // Crisp, clear phrases
  else if (ctx.isHumid && ctx.isCold) bestFit = [1, 3, 5, 7, 9]; // Damp, heavy phrases
  else if (ctx.isStormy) bestFit = [10, 12, 14, 16, 18]; // Dramatic phrases
  else if (ctx.isNight) bestFit = [20, 22, 24, 26, 28]; // Quieter phrases
  
  return selectFromPool(pool, seed, bestFit);
}

function getHumidityPhrase(ctx: WeatherContext, seed: number): string {
  const h = Math.max(0, Math.min(100, Math.round(ctx.humidity)));
  const pool = HUMIDITY_PHRASES[h] ?? HUMIDITY_PHRASES[50] ?? [];
  if (pool.length === 0) return 'moderate humidity';
  
  let bestFit: number[] = [];
  if (ctx.isRainy) bestFit = [3, 4]; // Wet phrases
  else if (ctx.isHot) bestFit = [2, 3]; // Oppressive phrases
  else if (ctx.isCold) bestFit = [0, 1]; // Crisp phrases
  
  return selectFromPool(pool, seed * 1.1, bestFit);
}

function getWindPhrase(ctx: WeatherContext, seed: number): string {
  const w = Math.max(0, Math.min(100, Math.round(ctx.windKmh)));
  const pool = WIND_PHRASES[w] ?? WIND_PHRASES[10] ?? [];
  if (pool.length === 0) return 'gentle breeze';
  
  let bestFit: number[] = [];
  if (ctx.isStormy) bestFit = [2, 3]; // Fierce phrases
  else if (ctx.isRainy) bestFit = [1, 2]; // Moderate phrases
  
  return selectFromPool(pool, seed * 1.2, bestFit);
}

function getTimePhrase(ctx: WeatherContext, seed: number): TimeMoodLighting {
  const slot = Math.min(47, Math.max(0, ctx.hour * 2 + Math.floor(ctx.minute / 30)));
  const pool = TIME_PHRASES[slot] ?? TIME_PHRASES[24] ?? [];
  if (pool.length === 0) return { mood: 'daytime', lighting: 'natural light' };
  
  let bestFit: number[] = [];
  if (ctx.isStormy) bestFit = [2, 3]; // Dramatic lighting
  else if (ctx.isRainy) bestFit = [1, 4]; // Soft lighting
  
  return selectFromPool(pool, seed * 1.3, bestFit);
}

function getConditionPhrase(ctx: WeatherContext, seed: number): string {
  const emoji = ctx.emoji || 'default';
  const pool = CONDITION_PHRASES[emoji] ?? CONDITION_PHRASES['default'] ?? [];
  if (pool.length === 0) return 'clear skies';
  
  let bestFit: number[] = [];
  if (ctx.isWindy) bestFit = [5, 6, 7]; // Dynamic phrases
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
    `${time.mood}::1.2`,
    `(${condition}:1.2)`,
    temp,
    `${wind} atmosphere`,
    time.lighting,
    'masterpiece',
    'best quality',
    '8k',
  ];
  
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
    time.lighting,
    condition,
    `${temp} ${Math.round(weather.temperatureC)}°C atmosphere`,
    `${wind} energy`,
  ].join(', ');
  
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
  
  return [
    `A ${time.mood} scene in ${city}${vibeDescription}, with ${time.lighting} illuminating the cityscape.`,
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
  const ctx = buildContext({ temperatureC: tempC, humidity: 50, windSpeedKmh: 10, conditions: 'Clear', description: 'clear sky', emoji: '☀️', temperatureF: tempC * 1.8 + 32 }, 12);
  const phrase = getTempPhrase(ctx, tempC);
  return { feel: phrase.split(' ').slice(0, 2).join(' '), atmosphere: phrase };
}

/** @deprecated Use generateWeatherPrompt with full context */
export function getHumidityTexture(humidity: number): string {
  const ctx = buildContext({ temperatureC: 20, humidity, windSpeedKmh: 10, conditions: 'Clear', description: 'clear sky', emoji: '☀️', temperatureF: 68 }, 12);
  return getHumidityPhrase(ctx, humidity);
}

/** @deprecated Use generateWeatherPrompt with full context */
export function getWindEnergy(windKmh: number): string {
  const ctx = buildContext({ temperatureC: 20, humidity: 50, windSpeedKmh: windKmh, conditions: 'Clear', description: 'clear sky', emoji: '☀️', temperatureF: 68 }, 12);
  return getWindPhrase(ctx, windKmh);
}

/** @deprecated Use generateWeatherPrompt with full context */
export function getTimeMood(hour: number): { mood: string; lighting: string } {
  const ctx = buildContext({ temperatureC: 20, humidity: 50, windSpeedKmh: 10, conditions: 'Clear', description: 'clear sky', emoji: '☀️', temperatureF: 68 }, hour);
  return getTimePhrase(ctx, hour);
}

/** @deprecated Use generateWeatherPrompt with full context */
export function getConditionVisual(condition: string, description: string): string {
  const ctx = buildContext({ temperatureC: 20, humidity: 50, windSpeedKmh: 10, conditions: condition, description, emoji: '☀️', temperatureF: 68 }, 12);
  return getConditionPhrase(ctx, 12);
}
