// src/__tests__/upgrade-5-prompt-fingerprint.test.ts
// ============================================================================
// UPGRADE 5 — Prompt Fingerprint Verification Tests
// ============================================================================
//
// Validates:
// 1. hashCategoryMap() produces stable, deterministic hashes
// 2. Same content → same hash (regardless of object order)
// 3. Different content → different hash
// 4. Hash is platform-independent (ignores weightOverrides, negative, meta)
// 5. generateWeatherPrompt() attaches categoryMapHash to result
// 6. Builder can verify symmetry by recomputing hash
// ============================================================================

import { hashCategoryMap, fnv1a32, normaliseTerm } from '@/lib/prompt-dna';
import { generateWeatherPrompt } from '@/lib/weather/weather-prompt-generator';
import type { WeatherCategoryMap, WeatherCategoryMeta } from '@/types/prompt-builder';
import type { ExchangeWeatherFull } from '@/lib/weather/weather-types';

// ── Shared fixtures ─────────────────────────────────────────────────────────

const baseMeta: WeatherCategoryMeta = {
  city: 'Zurich',
  venue: 'Grossmünster Square',
  venueSetting: 'plaza',
  mood: 'mysterious',
  conditions: 'Partly Cloudy',
  emoji: '⛅',
  tempC: 18,
  localTime: '11:00',
  source: 'weather-intelligence',
};

const baseMap: WeatherCategoryMap = {
  selections: {
    subject: ['Zurich'],
    environment: ['Grossmünster Square'],
    lighting: ['bright daylight'],
    atmosphere: ['mysterious'],
    composition: ['deep focus landscape'],
    camera: ['Canon EOS R5'],
  },
  customValues: {
    lighting: 'Bright daylight with passing cumulus cloud shadows with soft intermittent shadows',
    action: 'Southerly 12 km/h breeze, fountain spray drifting sideways',
    camera: 'Shot on Canon EOS R5, 35mm f/1.4',
    materials: 'Cold dry plaza stone underfoot',
    composition: 'wide open-square scene, pavement-to-facade depth',
  },
  negative: ['worst quality', 'low quality', 'blurry'],
  meta: baseMeta,
};

const dayStartSec = Math.floor(Date.now() / 86_400_000) * 86_400;

const baseWeather: ExchangeWeatherFull = {
  temperatureC: 18,
  temperatureF: 64,
  humidity: 55,
  windSpeedKmh: 12,
  cloudCover: 40,
  visibility: 10000,
  pressure: 1013,
  conditions: 'Partly Cloudy',
  description: 'partly cloudy',
  emoji: '⛅',
  sunriseUtc: dayStartSec + 6 * 3600,
  sunsetUtc: dayStartSec + 18 * 3600,
  timezoneOffset: 3600,
  isDayTime: true,
  rainMm1h: null,
  snowMm1h: null,
  windDegrees: 180,
  windGustKmh: 18,
  weatherId: null,
};

// ============================================================================
// hashCategoryMap — Determinism & Stability
// ============================================================================

describe('hashCategoryMap', () => {
  it('produces a stable 8-char hex hash', () => {
    const hash = hashCategoryMap(baseMap);
    expect(hash).toMatch(/^[0-9a-f]{8}$/);
  });

  it('same input → same hash (deterministic)', () => {
    const hash1 = hashCategoryMap(baseMap);
    const hash2 = hashCategoryMap(baseMap);
    expect(hash1).toBe(hash2);
  });

  it('different selections → different hash', () => {
    const modified: WeatherCategoryMap = {
      ...baseMap,
      selections: {
        ...baseMap.selections,
        subject: ['Tokyo'],
      },
    };
    expect(hashCategoryMap(modified)).not.toBe(hashCategoryMap(baseMap));
  });

  it('different customValues → different hash', () => {
    const modified: WeatherCategoryMap = {
      ...baseMap,
      customValues: {
        ...baseMap.customValues,
        lighting: 'Deep moonlight through thin clouds',
      },
    };
    expect(hashCategoryMap(modified)).not.toBe(hashCategoryMap(baseMap));
  });

  it('ignores weightOverrides (platform-specific)', () => {
    const withWeights: WeatherCategoryMap = {
      ...baseMap,
      weightOverrides: { subject: 1.3, lighting: 1.5 },
    };
    const withoutWeights: WeatherCategoryMap = {
      ...baseMap,
      weightOverrides: undefined,
    };
    expect(hashCategoryMap(withWeights)).toBe(hashCategoryMap(withoutWeights));
  });

  it('ignores negative terms (same across all tiers)', () => {
    const morNeg: WeatherCategoryMap = {
      ...baseMap,
      negative: ['worst quality', 'low quality', 'blurry', 'extra term'],
    };
    expect(hashCategoryMap(morNeg)).toBe(hashCategoryMap(baseMap));
  });

  it('ignores meta fields (informational, not content)', () => {
    const diffMeta: WeatherCategoryMap = {
      ...baseMap,
      meta: { ...baseMeta, city: 'Different', mood: 'joyful' },
    };
    expect(hashCategoryMap(diffMeta)).toBe(hashCategoryMap(baseMap));
  });

  it('is case-insensitive (normalises before hashing)', () => {
    const upperCase: WeatherCategoryMap = {
      ...baseMap,
      selections: {
        ...baseMap.selections,
        lighting: ['BRIGHT DAYLIGHT'],
      },
    };
    const lowerCase: WeatherCategoryMap = {
      ...baseMap,
      selections: {
        ...baseMap.selections,
        lighting: ['bright daylight'],
      },
    };
    expect(hashCategoryMap(upperCase)).toBe(hashCategoryMap(lowerCase));
  });
});

// ============================================================================
// generateWeatherPrompt — categoryMapHash attachment
// ============================================================================

describe('generateWeatherPrompt categoryMapHash', () => {
  it('attaches categoryMapHash to result', () => {
    const result = generateWeatherPrompt({
      city: 'Zurich',
      weather: baseWeather,
      localHour: 11,
      tier: 1,
      venueOverride: { name: 'Grossmünster Square', setting: 'plaza' },
    });

    expect(result.categoryMapHash).toBeDefined();
    expect(result.categoryMapHash).toMatch(/^[0-9a-f]{8}$/);
  });

  it('hash matches recomputed hash from categoryMap', () => {
    const result = generateWeatherPrompt({
      city: 'Zurich',
      weather: baseWeather,
      localHour: 11,
      tier: 1,
      venueOverride: { name: 'Grossmünster Square', setting: 'plaza' },
    });

    // Builder verification: recompute hash from the attached categoryMap
    const recomputed = hashCategoryMap(result.categoryMap!);
    expect(result.categoryMapHash).toBe(recomputed);
  });

  it('same weather/city/venue across tiers → same hash (platform-independent)', () => {
    const tier1 = generateWeatherPrompt({
      city: 'Zurich',
      weather: baseWeather,
      localHour: 11,
      tier: 1,
      venueOverride: { name: 'Grossmünster Square', setting: 'plaza' },
    });

    const tier3 = generateWeatherPrompt({
      city: 'Zurich',
      weather: baseWeather,
      localHour: 11,
      tier: 3,
      venueOverride: { name: 'Grossmünster Square', setting: 'plaza' },
    });

    // Same categoryMap → same hash, regardless of tier
    expect(tier1.categoryMapHash).toBe(tier3.categoryMapHash);
  });
});

// ============================================================================
// fnv1a32 utility — basic correctness
// ============================================================================

describe('fnv1a32', () => {
  it('returns 8-char hex string', () => {
    expect(fnv1a32('hello')).toMatch(/^[0-9a-f]{8}$/);
  });

  it('same input → same output', () => {
    expect(fnv1a32('test string')).toBe(fnv1a32('test string'));
  });

  it('different input → different output', () => {
    expect(fnv1a32('alpha')).not.toBe(fnv1a32('beta'));
  });

  it('empty string returns valid hash', () => {
    expect(fnv1a32('')).toMatch(/^[0-9a-f]{8}$/);
  });
});

// ============================================================================
// normaliseTerm — correctness
// ============================================================================

describe('normaliseTerm', () => {
  it('lowercases input', () => {
    expect(normaliseTerm('GOLDEN HOUR')).toBe('golden hour');
  });

  it('trims whitespace', () => {
    expect(normaliseTerm('  moonlight  ')).toBe('moonlight');
  });

  it('collapses multiple spaces', () => {
    expect(normaliseTerm('deep   focus   landscape')).toBe('deep focus landscape');
  });
});
