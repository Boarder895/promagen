// src/__tests__/upgrade-4-venue-singularity.test.ts
// ============================================================================
// UPGRADE 4 — Venue Singularity Tests
// ============================================================================
//
// Validates:
// 1. venueOverride in WeatherPromptInput bypasses getCityVenue()
// 2. Only ONE venue appears in the prompt (no dual-venue bug)
// 3. City name is clean (no venue embedded in subject)
// 4. Composition vocab matches don't overlap with composition text
// ============================================================================

import { generateWeatherPrompt } from '@/lib/weather/weather-prompt-generator';
import { computeCompositionBlueprint, type CompositionInput } from '@/lib/weather/composition-blueprint';
import type { WeatherCategoryMeta } from '@/types/prompt-builder';
import type { ExchangeWeatherFull } from '@/lib/weather/weather-types';

// ── Shared test fixtures ────────────────────────────────────────────────────

const dayStartSec = Math.floor(Date.now() / 86_400_000) * 86_400;

const baseWeather: ExchangeWeatherFull = {
  temperatureC: 28,
  temperatureF: 82,
  humidity: 40,
  windSpeedKmh: 12,
  cloudCover: 30,
  visibility: 10000,
  pressure: 1015,
  conditions: 'Partly Cloudy',
  description: 'partly cloudy',
  emoji: '⛅',
  sunriseUtc: dayStartSec + 6 * 3600,
  sunsetUtc: dayStartSec + 18 * 3600,
  timezoneOffset: 0,
  isDayTime: true,
  rainMm1h: null,
  snowMm1h: null,
  windDegrees: 180,
  windGustKmh: 18,
  weatherId: null,
};

// ============================================================================
// Venue Singularity — venueOverride
// ============================================================================

describe('Venue Singularity — venueOverride', () => {
  it('uses venueOverride when provided, skipping getCityVenue', () => {
    const result = generateWeatherPrompt({
      city: 'Windhoek',
      weather: baseWeather,
      localHour: 12,
      tier: 1,
      venueOverride: { name: 'Craft Market at Old Breweries', setting: 'market' },
    });

    // Venue from override should appear
    expect(result.text).toContain('Craft Market at Old Breweries');

    // City should be clean (no venue embedded)
    expect(result.categoryMap?.selections?.subject).toEqual(['Windhoek']);
  });

  it('does NOT produce two different venues in the prompt', () => {
    const result = generateWeatherPrompt({
      city: 'Windhoek',
      weather: baseWeather,
      localHour: 12,
      tier: 1,
      venueOverride: { name: 'Craft Market at Old Breweries', setting: 'market' },
    });

    // Count how many Windhoek venues appear (city-vibes has 7 venues)
    const windhoekVenues = [
      'Craft Market at Old Breweries',
      'Independence Avenue',
      'Christuskirche',
      "Joe's Beerhouse Garden",
      'Daan Viljoen Nature Reserve',
      'Maerua Mall',
      'Katutura Open Market',
      'Zoo Park',
      'Avis Dam',
    ];

    const venuesFound = windhoekVenues.filter((v) => result.text.includes(v));

    // Should find exactly ONE venue (the override)
    expect(venuesFound).toEqual(['Craft Market at Old Breweries']);
  });

  it('falls back to getCityVenue when no venueOverride provided', () => {
    const result = generateWeatherPrompt({
      city: 'Windhoek',
      weather: baseWeather,
      localHour: 12,
      tier: 1,
      // No venueOverride — getCityVenue picks by seed
    });

    // Should still produce a valid prompt with a venue
    expect(result.text.length).toBeGreaterThan(50);
    expect(result.categoryMap?.meta?.venue).toBeTruthy();
  });

  it('categoryMap.meta.venue matches the override', () => {
    const result = generateWeatherPrompt({
      city: 'Windhoek',
      weather: baseWeather,
      localHour: 12,
      tier: 1,
      venueOverride: { name: 'Zoo Park', setting: 'park' },
    });

    expect(result.categoryMap?.meta?.venue).toBe('Zoo Park');
  });
});

// ============================================================================
// Composition — no vocab/text overlap
// ============================================================================

const baseMeta: WeatherCategoryMeta = {
  city: 'test',
  venue: 'test venue',
  venueSetting: 'street',
  mood: 'mysterious',
  conditions: 'Clear',
  emoji: '☀️',
  tempC: 25,
  localTime: '12:00',
  source: 'weather-intelligence',
};

const baseCompInput: CompositionInput = {
  categoryMap: {
    selections: { subject: ['Test City'], environment: ['Test Venue'] },
    customValues: {},
    negative: [],
    meta: baseMeta,
  },
  camera: {
    full: 'Canon EOS R5, 28mm f/2',
    body: 'Canon EOS R5',
    lensSpec: '28mm f/2',
    lensDescriptor: '28mm wide prime',
  },
  venueSetting: 'park',
  isNight: false,
};

describe('Composition — vocab/text no overlap', () => {
  it('park: selection (deep focus landscape) does not repeat "wide" from text', () => {
    const result = computeCompositionBlueprint({
      ...baseCompInput,
      venueSetting: 'park',
    });

    // Selection should NOT contain "wide" — that's in the compositionText
    expect(result.compositionSelection.toLowerCase()).not.toContain('wide');
    expect(result.compositionSelection).toBe('deep focus landscape');

    // Text should contain venue-specific description
    expect(result.compositionText).toContain('parkland');
  });

  it('street: selection (eye-level composition) does not repeat "street" from text', () => {
    const result = computeCompositionBlueprint({
      ...baseCompInput,
      venueSetting: 'street',
    });

    // Selection should complement, not duplicate the compositionText
    expect(result.compositionSelection).toBe('eye-level composition');
    expect(result.compositionText).toContain('street-level');
  });

  it('monument: selection (upward perspective) does not repeat "architectural" from text', () => {
    const result = computeCompositionBlueprint({
      ...baseCompInput,
      venueSetting: 'monument',
      isNight: false,
    });

    expect(result.compositionSelection).toBe('upward perspective');
    expect(result.compositionText).toContain('architectural');
  });

  it('elevated: selection (high vantage point) does not repeat "panoramic" from text', () => {
    const result = computeCompositionBlueprint({
      ...baseCompInput,
      venueSetting: 'elevated',
    });

    expect(result.compositionSelection).toBe('high vantage point');
    expect(result.compositionText).toContain('panoramic');
  });
});
