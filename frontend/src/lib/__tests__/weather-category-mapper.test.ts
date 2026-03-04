// src/lib/__tests__/weather-category-mapper.test.ts
// ============================================================================
// WEATHER CATEGORY MAPPER — Phase B Tests
// ============================================================================
//
// Tests that buildWeatherCategoryMap() correctly maps weather intelligence
// output into all 12 prompt builder categories with both vocabulary matches
// (selections) and rich physics phrases (customValues).
//
// Strategy: Mock all external weather modules to control inputs precisely,
// then verify the mapping logic in isolation.
// ============================================================================

import type { CategoryMapperInput } from '../weather/weather-category-mapper';
import type { ExchangeWeatherFull } from '../weather/weather-types';
import type {
  PromptProfile,
  LightingState,
  VisualTruth,
  VenueResult,
} from '../weather/prompt-types';

// ── Mocks ──────────────────────────────────────────────────────────────

// Mock visual-truth
jest.mock('../weather/visual-truth', () => ({
  getMoisturePhrase: jest.fn(() => 'glistening wet surfaces'),
  getThermalPhrase: jest.fn(() => 'warm thermal updrafts'),
  getSurfaceGrounding: jest.fn(() => 'Rain-slicked cobblestones'),
  composeLightingSentence: jest.fn(() => 'warm golden light casting long shadows'),
  composeSurfaceSentence: jest.fn(() => 'Wet cobblestones reflecting warm lamplight'),
  getLightReflectionNoun: jest.fn(() => 'lamplight'),
}));

// Mock vocabulary-loaders
jest.mock('../weather/vocabulary-loaders', () => ({
  buildContext: jest.fn((weather: ExchangeWeatherFull, hour: number) => ({
    tempC: weather.temperatureC,
    humidity: weather.humidity,
    windKmh: weather.windSpeedKmh,
    hour,
    condition: weather.conditions,
    description: weather.description,
    emoji: '🌤️',
    isStormy: false,
    isRainy: false,
    isSnowy: false,
    isFoggy: false,
    isMisty: false,
    isCold: weather.temperatureC < 5,
    isHot: weather.temperatureC > 30,
    isDry: weather.humidity < 40,
    isHumid: weather.humidity > 70,
    isWindy: weather.windSpeedKmh > 25,
    isNight: hour < 6 || hour > 20,
    isDawn: hour >= 5 && hour <= 7,
    isDusk: hour >= 17 && hour <= 19,
    moonEmoji: '🌙',
    moonPhrase: 'waxing crescent',
    moonName: 'Waxing Crescent',
    cloudCover: weather.cloudCover ?? 50,
    visibility: weather.visibility ?? 10000,
    pressure: weather.pressure ?? 1013,
    windDegrees: null,
    windGustKmh: null,
  })),
  getTempPhrase: jest.fn(() => 'mild temperature'),
  getHumidityPhrase: jest.fn(() => 'comfortable humidity'),
  getTimeDescriptor: jest.fn(() => 'early evening'),
  getSkySourceAware: jest.fn(() => 'partly cloudy'),
}));

// Mock wind-system
jest.mock('../weather/wind-system', () => ({
  getWindPhrase: jest.fn(() => 'gentle breeze rustling through the trees'),
}));

// Mock time-utils
jest.mock('../weather/time-utils', () => ({
  shouldExcludePeople: jest.fn(() => false),
}));

// Mock lighting-engine
jest.mock('../weather/lighting-engine', () => ({
  getUrbanLightFactor: jest.fn(() => 0.7),
}));

// Mock camera-lens
jest.mock('../weather/camera-lens', () => ({
  getCameraLens: jest.fn(() => ({
    full: 'Canon EOS R5, 35mm f/1.4',
    body: 'Canon EOS R5',
    lensSpec: '35mm f/1.4',
    lensDescriptor: '35mm prime',
  })),
  getQualityTagsT1: jest.fn(() => ['highly detailed', 'sharp focus', '8k']),
}));

// Mock tier-generators (only the exported helpers)
jest.mock('../weather/tier-generators', () => ({
  computeSeed: jest.fn(() => 42),
  enhanceSkySource: jest.fn(
    (sky: string | null) => sky ?? 'clear sky',
  ),
  enhanceTimeWithPhase: jest.fn(
    (time: string) => `${time}, golden hour phase`,
  ),
}));

// Mock prng
jest.mock('../weather/prng', () => ({
  capitalize: jest.fn((s: string) => s.charAt(0).toUpperCase() + s.slice(1)),
  hashString: jest.fn(() => 123),
}));

// ── Import after mocks ────────────────────────────────────────────────

import { buildWeatherCategoryMap } from '../weather/weather-category-mapper';
import { shouldExcludePeople } from '../weather/time-utils';

// ── Test Fixtures ──────────────────────────────────────────────────────

function makeWeather(overrides: Partial<ExchangeWeatherFull> = {}): ExchangeWeatherFull {
  return {
    temperatureC: 22,
    humidity: 65,
    windSpeedKmh: 12,
    cloudCover: 40,
    visibility: 10000,
    pressure: 1013,
    conditions: 'Clouds',
    description: 'scattered clouds',
    weatherId: 802,
    ...overrides,
  } as ExchangeWeatherFull;
}

function makeLighting(overrides: Partial<LightingState> = {}): LightingState {
  return {
    fullPhrase: 'warm golden hour glow with soft shadows',
    base: 'golden hour glow',
    shadowModifier: 'soft shadows',
    atmosphereModifier: 'warm haze',
    stabilityModifier: '',
    cloudState: 'scattered',
    encodesCloudState: false,
    colourTempK: 3200,
    moonPositionPhrase: null,
    moonVisible: false,
    nightDominant: null,
    ...overrides,
  } as LightingState;
}

function makeVenue(overrides: Partial<VenueResult> = {}): VenueResult {
  return {
    name: 'Shibuya Crossing',
    setting: 'street',
    ...overrides,
  };
}

function makeProfile(overrides: Partial<PromptProfile> = {}): PromptProfile {
  return {
    verbosity: 'standard',
    style: 'photoreal',
    excludePeople: 'quiet-hours',
    mjAspect: '16:9',
    mjStylize: 250,
    mjVersion: '6.1',
    strictPhysics: false,
    ...overrides,
  };
}

function makeInput(overrides: Partial<CategoryMapperInput> = {}): CategoryMapperInput {
  return {
    city: 'Tokyo',
    weather: makeWeather(),
    hour: 18,
    lighting: makeLighting(),
    observedAtUtc: new Date('2026-03-03T09:00:00Z'),
    visualTruth: null,
    solarElevation: 15,
    venue: makeVenue(),
    profile: makeProfile(),
    ...overrides,
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe('buildWeatherCategoryMap', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Structure ──────────────────────────────────────────────────────

  describe('return structure', () => {
    it('returns all required top-level fields', () => {
      const result = buildWeatherCategoryMap(makeInput());

      expect(result).toHaveProperty('selections');
      expect(result).toHaveProperty('customValues');
      expect(result).toHaveProperty('negative');
      expect(result).toHaveProperty('weightOverrides');
      expect(result).toHaveProperty('meta');
    });

    it('selections and customValues are objects', () => {
      const result = buildWeatherCategoryMap(makeInput());

      expect(typeof result.selections).toBe('object');
      expect(typeof result.customValues).toBe('object');
    });

    it('negative is an array of strings', () => {
      const result = buildWeatherCategoryMap(makeInput());

      expect(Array.isArray(result.negative)).toBe(true);
      result.negative.forEach((term) => {
        expect(typeof term).toBe('string');
      });
    });
  });

  // ── Subject category ───────────────────────────────────────────────

  describe('subject category', () => {
    it('maps city name to subject selections', () => {
      const result = buildWeatherCategoryMap(makeInput({ city: 'London' }));

      expect(result.selections.subject).toEqual(['London']);
    });

    it('sets subject weight override to 1.3', () => {
      const result = buildWeatherCategoryMap(makeInput());

      expect(result.weightOverrides?.subject).toBe(1.3);
    });
  });

  // ── Environment category ───────────────────────────────────────────

  describe('environment category', () => {
    it('maps venue name to environment selections', () => {
      const result = buildWeatherCategoryMap(
        makeInput({ venue: makeVenue({ name: 'Times Square' }) }),
      );

      expect(result.selections.environment).toEqual(['Times Square']);
    });

    it('sets environment weight override to 1.2', () => {
      const result = buildWeatherCategoryMap(makeInput());

      expect(result.weightOverrides?.environment).toBe(1.2);
    });

    it('omits environment when venue is null', () => {
      const result = buildWeatherCategoryMap(makeInput({ venue: null }));

      expect(result.selections.environment).toBeUndefined();
      expect(result.weightOverrides?.environment).toBeUndefined();
    });
  });

  // ── Lighting category ──────────────────────────────────────────────

  describe('lighting category', () => {
    it('maps lighting base to vocabulary match', () => {
      const result = buildWeatherCategoryMap(
        makeInput({ lighting: makeLighting({ base: 'golden hour glow' }) }),
      );

      expect(result.selections.lighting).toEqual(['golden hour']);
    });

    it('sets lighting weight override to 1.3', () => {
      const result = buildWeatherCategoryMap(makeInput());

      expect(result.weightOverrides?.lighting).toBe(1.3);
    });

    it('includes rich lighting sentence as customValue', () => {
      const result = buildWeatherCategoryMap(makeInput());

      expect(result.customValues.lighting).toBeDefined();
      expect(result.customValues.lighting).toContain('Warm golden light');
    });

    it('includes moon clause in lighting customValue when moon visible', () => {
      const result = buildWeatherCategoryMap(
        makeInput({
          lighting: makeLighting({
            base: 'moonlight',
            moonVisible: true,
            moonPositionPhrase: 'low in the eastern sky',
          }),
        }),
      );

      expect(result.customValues.lighting).toContain('waxing crescent');
      expect(result.customValues.lighting).toContain('low in the eastern sky');
    });

    it('includes sky clause in lighting customValue', () => {
      const result = buildWeatherCategoryMap(makeInput());

      // enhanceSkySource mock returns 'partly cloudy' which becomes sky clause
      expect(result.customValues.lighting).toContain('Partly cloudy overhead');
    });
  });

  // ── Atmosphere category ────────────────────────────────────────────

  describe('atmosphere category', () => {
    it('maps weather conditions to atmosphere vocabulary match', () => {
      const result = buildWeatherCategoryMap(makeInput());

      expect(result.selections.atmosphere).toBeDefined();
      expect(result.selections.atmosphere?.length).toBeGreaterThan(0);
    });

    it('includes enriched time + moisture as customValue', () => {
      const result = buildWeatherCategoryMap(makeInput());

      expect(result.customValues.atmosphere).toBeDefined();
      // enrichedTime mock returns "early evening, golden hour phase"
      expect(result.customValues.atmosphere).toContain('early evening');
    });
  });

  // ── Style category ─────────────────────────────────────────────────

  describe('style category', () => {
    it('maps photoreal profile to "photorealistic"', () => {
      const result = buildWeatherCategoryMap(
        makeInput({ profile: makeProfile({ style: 'photoreal' }) }),
      );

      expect(result.selections.style).toEqual(['photorealistic']);
    });

    it('maps cinematic profile to "cinematic"', () => {
      const result = buildWeatherCategoryMap(
        makeInput({ profile: makeProfile({ style: 'cinematic' }) }),
      );

      expect(result.selections.style).toEqual(['cinematic']);
    });

    it('maps documentary profile to "documentary"', () => {
      const result = buildWeatherCategoryMap(
        makeInput({ profile: makeProfile({ style: 'documentary' }) }),
      );

      expect(result.selections.style).toEqual(['documentary']);
    });
  });

  // ── Colour category ────────────────────────────────────────────────

  describe('colour category', () => {
    it('maps warm CCT (3200K) to "warm tones"', () => {
      const result = buildWeatherCategoryMap(
        makeInput({ lighting: makeLighting({ colourTempK: 3200 }) }),
      );

      expect(result.selections.colour).toEqual(['warm tones']);
    });

    it('maps cool CCT (7000K) to "cool tones"', () => {
      const result = buildWeatherCategoryMap(
        makeInput({ lighting: makeLighting({ colourTempK: 7000 }) }),
      );

      expect(result.selections.colour).toEqual(['cool tones']);
    });

    it('maps neutral CCT (5500K) to "vibrant colours"', () => {
      const result = buildWeatherCategoryMap(
        makeInput({ lighting: makeLighting({ colourTempK: 5500 }) }),
      );

      expect(result.selections.colour).toEqual(['vibrant colours']);
    });

    it('maps extreme blue CCT (10000K) to "muted tones"', () => {
      const result = buildWeatherCategoryMap(
        makeInput({ lighting: makeLighting({ colourTempK: 10000 }) }),
      );

      expect(result.selections.colour).toEqual(['muted tones']);
    });

    it('omits colour when CCT is null (night)', () => {
      const result = buildWeatherCategoryMap(
        makeInput({ lighting: makeLighting({ colourTempK: null }) }),
      );

      expect(result.selections.colour).toBeUndefined();
    });
  });

  // ── Fidelity category ──────────────────────────────────────────────

  describe('fidelity category', () => {
    it('includes quality tags from camera system', () => {
      const result = buildWeatherCategoryMap(makeInput());

      expect(result.selections.fidelity).toEqual(['highly detailed', 'sharp focus', '8k']);
    });
  });

  // ── Materials category ─────────────────────────────────────────────

  describe('materials category', () => {
    it('includes surface sentence as customValue', () => {
      const result = buildWeatherCategoryMap(makeInput());

      expect(result.customValues.materials).toBe(
        'Wet cobblestones reflecting warm lamplight',
      );
    });
  });

  // ── Action category ────────────────────────────────────────────────

  describe('action category', () => {
    it('includes wind phrase when wind speed >= 6 km/h', () => {
      const result = buildWeatherCategoryMap(
        makeInput({ weather: makeWeather({ windSpeedKmh: 15 }) }),
      );

      expect(result.customValues.action).toBeDefined();
      expect(result.customValues.action).toContain('Gentle breeze');
    });

    it('omits wind phrase when wind speed < 6 km/h', () => {
      const result = buildWeatherCategoryMap(
        makeInput({ weather: makeWeather({ windSpeedKmh: 3 }) }),
      );

      // Wind speed from buildContext mock uses weather.windSpeedKmh
      // but ctx.windKmh rounds to 3 which is < 6
      // Note: the mock always returns the same wind phrase, but the gate is on ctx.windKmh
      expect(result.customValues.action).toBeUndefined();
    });
  });

  // ── Camera category ────────────────────────────────────────────────

  describe('camera category', () => {
    it('includes camera description as customValue', () => {
      const result = buildWeatherCategoryMap(makeInput());

      expect(result.customValues.camera).toBe('Shot on Canon EOS R5, 35mm f/1.4');
    });
  });

  // ── Negative terms ─────────────────────────────────────────────────

  describe('negative terms', () => {
    it('always includes standard anti-tokens', () => {
      const result = buildWeatherCategoryMap(makeInput());

      expect(result.negative).toContain('blurry');
      expect(result.negative).toContain('watermarks');
      expect(result.negative).toContain('text');
      expect(result.negative).toContain('oversaturated');
    });

    it('includes people exclusion during quiet hours', () => {
      (shouldExcludePeople as jest.Mock).mockReturnValueOnce(true);
      const result = buildWeatherCategoryMap(makeInput());

      expect(result.negative).toContain('people');
      expect(result.negative).toContain('crowds');
      expect(result.negative).toContain('pedestrians');
    });

    it('omits people exclusion outside quiet hours', () => {
      (shouldExcludePeople as jest.Mock).mockReturnValueOnce(false);
      const result = buildWeatherCategoryMap(makeInput());

      expect(result.negative).not.toContain('people');
    });
  });

  // ── Metadata ───────────────────────────────────────────────────────

  describe('metadata', () => {
    it('includes city in meta', () => {
      const result = buildWeatherCategoryMap(makeInput({ city: 'Paris' }));

      expect(result.meta.city).toBe('Paris');
    });

    it('includes venue name in meta', () => {
      const result = buildWeatherCategoryMap(
        makeInput({ venue: makeVenue({ name: 'Eiffel Tower' }) }),
      );

      expect(result.meta.venue).toBe('Eiffel Tower');
    });

    it('falls back to city name when venue is null', () => {
      const result = buildWeatherCategoryMap(
        makeInput({ city: 'Berlin', venue: null }),
      );

      expect(result.meta.venue).toBe('Berlin');
    });

    it('includes venue setting in meta', () => {
      const result = buildWeatherCategoryMap(
        makeInput({ venue: makeVenue({ setting: 'waterfront' }) }),
      );

      expect(result.meta.venueSetting).toBe('waterfront');
    });

    it('includes weather emoji', () => {
      const result = buildWeatherCategoryMap(makeInput());

      expect(result.meta.emoji).toBe('🌤️');
    });

    it('includes temperature', () => {
      const result = buildWeatherCategoryMap(
        makeInput({ weather: makeWeather({ temperatureC: 28 }) }),
      );

      expect(result.meta.tempC).toBe(28);
    });

    it('includes formatted local time', () => {
      const result = buildWeatherCategoryMap(makeInput({ hour: 8 }));

      expect(result.meta.localTime).toBe('08:00');
    });

    it('pads single-digit hours with leading zero', () => {
      const result = buildWeatherCategoryMap(makeInput({ hour: 3 }));

      expect(result.meta.localTime).toBe('03:00');
    });

    it('source is always weather-intelligence', () => {
      const result = buildWeatherCategoryMap(makeInput());

      expect(result.meta.source).toBe('weather-intelligence');
    });

    it('derives mood from conditions', () => {
      const result = buildWeatherCategoryMap(makeInput());

      expect(result.meta.mood).toBeDefined();
      expect(typeof result.meta.mood).toBe('string');
    });

    it('includes weather conditions in meta', () => {
      const result = buildWeatherCategoryMap(
        makeInput({ weather: makeWeather({ description: 'heavy rain' }) }),
      );

      expect(result.meta.conditions).toBe('heavy rain');
    });
  });

  // ── Vocabulary matching ────────────────────────────────────────────

  describe('vocabulary matching', () => {
    it('maps neon lighting to "neon lighting" vocab term', () => {
      const result = buildWeatherCategoryMap(
        makeInput({ lighting: makeLighting({ base: 'neon glow reflecting off wet surfaces' }) }),
      );

      expect(result.selections.lighting).toEqual(['neon lighting']);
    });

    it('maps overcast lighting to "overcast light" vocab term', () => {
      const result = buildWeatherCategoryMap(
        makeInput({ lighting: makeLighting({ base: 'overcast diffused light' }) }),
      );

      expect(result.selections.lighting).toEqual(['overcast light']);
    });

    it('maps blue hour to "blue hour" vocab term', () => {
      const result = buildWeatherCategoryMap(
        makeInput({ lighting: makeLighting({ base: 'blue hour twilight' }) }),
      );

      expect(result.selections.lighting).toEqual(['blue hour']);
    });

    it('maps sodium lighting to "streetlight glow" vocab term', () => {
      const result = buildWeatherCategoryMap(
        makeInput({ lighting: makeLighting({ base: 'sodium-vapour street lighting' }) }),
      );

      expect(result.selections.lighting).toEqual(['streetlight glow']);
    });

    it('falls back to base string for unrecognised lighting', () => {
      const result = buildWeatherCategoryMap(
        makeInput({ lighting: makeLighting({ base: 'unusual ambient glow' }) }),
      );

      expect(result.selections.lighting).toEqual(['unusual ambient glow']);
    });
  });

  // ── Weight overrides ───────────────────────────────────────────────

  describe('weight overrides', () => {
    it('sets subject=1.3, environment=1.2, lighting=1.3', () => {
      const result = buildWeatherCategoryMap(makeInput());

      expect(result.weightOverrides?.subject).toBe(1.3);
      expect(result.weightOverrides?.environment).toBe(1.2);
      expect(result.weightOverrides?.lighting).toBe(1.3);
    });

    it('does not set weight overrides for non-primary categories', () => {
      const result = buildWeatherCategoryMap(makeInput());

      expect(result.weightOverrides?.atmosphere).toBeUndefined();
      expect(result.weightOverrides?.style).toBeUndefined();
      expect(result.weightOverrides?.materials).toBeUndefined();
    });
  });

  // ── Category count verification ────────────────────────────────────

  describe('category coverage', () => {
    it('populates at least 7 categories for a standard city scene', () => {
      const result = buildWeatherCategoryMap(makeInput());

      const populatedSelections = Object.keys(result.selections).length;
      const populatedCustom = Object.keys(result.customValues).length;
      const totalPopulated = new Set([
        ...Object.keys(result.selections),
        ...Object.keys(result.customValues),
      ]).size;

      // Subject, environment, lighting, atmosphere, style, colour, fidelity = 7 selections
      // lighting, atmosphere, materials, action, camera = 5 customValues
      expect(totalPopulated).toBeGreaterThanOrEqual(7);
      expect(populatedSelections).toBeGreaterThanOrEqual(5);
      expect(populatedCustom).toBeGreaterThanOrEqual(3);
    });
  });

  // ── Confidence scores (Extra 2) ────────────────────────────────────

  describe('confidence scores', () => {
    it('includes confidence field in result', () => {
      const result = buildWeatherCategoryMap(makeInput());

      expect(result.confidence).toBeDefined();
    });

    it('subject always has confidence 1.0', () => {
      const result = buildWeatherCategoryMap(makeInput());

      expect(result.confidence?.subject).toBe(1.0);
    });

    it('environment has high confidence when venue present', () => {
      const result = buildWeatherCategoryMap(makeInput({ venue: makeVenue() }));

      expect(result.confidence?.environment).toBe(0.95);
    });

    it('environment has zero confidence when venue absent', () => {
      const result = buildWeatherCategoryMap(makeInput({ venue: null }));

      expect(result.confidence?.environment).toBe(0);
    });

    it('lighting has lower confidence without visual truth', () => {
      const result = buildWeatherCategoryMap(makeInput({ visualTruth: null }));

      expect(result.confidence?.lighting).toBe(0.6);
    });

    it('style has moderate confidence (always heuristic)', () => {
      const result = buildWeatherCategoryMap(makeInput());

      expect(result.confidence?.style).toBe(0.7);
    });

    it('camera has high confidence (deterministic)', () => {
      const result = buildWeatherCategoryMap(makeInput());

      expect(result.confidence?.camera).toBe(0.9);
    });

    it('negative has perfect confidence (rule-based)', () => {
      const result = buildWeatherCategoryMap(makeInput());

      expect(result.confidence?.negative).toBe(1.0);
    });

    it('colour has zero confidence when CCT is null', () => {
      const result = buildWeatherCategoryMap(
        makeInput({ lighting: makeLighting({ colourTempK: null }) }),
      );

      expect(result.confidence?.colour).toBe(0);
    });

    it('colour has good confidence when CCT is available', () => {
      const result = buildWeatherCategoryMap(
        makeInput({ lighting: makeLighting({ colourTempK: 3500 }) }),
      );

      expect(result.confidence?.colour).toBe(0.85);
    });

    it('all confidence values are between 0 and 1', () => {
      const result = buildWeatherCategoryMap(makeInput());

      for (const [_cat, value] of Object.entries(result.confidence ?? {})) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
    });
  });
});
