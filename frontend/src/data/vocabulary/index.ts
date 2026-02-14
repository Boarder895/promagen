// src/data/vocabulary/index.ts
// ============================================================================
// VOCABULARY LAYER - Central Entry Point
// ============================================================================
// Single source of truth for all Promagen creative terminology.
// Provides type-safe access to weather, prompt builder, and intelligence data.
//
// Usage:
//   import { getWeatherPhrase, getTemperaturePhrase } from '@/data/vocabulary';
//   const phrase = getTemperaturePhrase(25, { isStormy: true });
//
// Authority: docs/authority/vocabulary-layer.md
// ============================================================================

// Type definitions
export interface WeatherContext {
  isStormy?: boolean;
  isRainy?: boolean;
  isCold?: boolean;
  isHot?: boolean;
  isDry?: boolean;
  isHumid?: boolean;
  isWindy?: boolean;
  isNight?: boolean;
  isDawn?: boolean;
  isDusk?: boolean;
}

export interface TimeMoodLighting {
  mood: string;
  lighting: string;
}

export interface TemperatureRange {
  min: number;
  max: number;
  label: string;
  phrases: string[];
}

export interface HumidityRange {
  min: number;
  max: number;
  label: string;
  phrases: string[];
}

export interface WindRange {
  min: number;
  max: number;
  label: string;
  phrases: string[];
}

export interface TimePeriod {
  hours: number[];
  label: string;
  phrases: TimeMoodLighting[];
}

export interface ConditionType {
  emoji: string;
  label: string;
  phrases: string[];
}

export interface CityVenue {
  name: string;
  activities: string[];
}

export interface CityVibes {
  country: string;
  venues: CityVenue[];
}

// JSON imports
import temperatureData from './weather/temperature.json';
import humidityData from './weather/humidity.json';
import windData from './weather/wind.json';
import timeOfDayData from './weather/time-of-day.json';
import conditionsData from './weather/conditions.json';
import cityVibesData from './weather/city-vibes.json';

// ============================================================================
// SEEDED RANDOM FOR CONSISTENT SELECTION
// ============================================================================

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9999) * 10000;
  return x - Math.floor(x);
}

/**
 * Select from pool with optional best-fit weighting
 * 70% chance to use best-fit if available, 30% pure random
 */
function selectFromPool<T>(pool: T[], seed: number, bestFitIndices?: number[]): T {
  // Guard against empty pool - should never happen but satisfies TS
  if (pool.length === 0) {
    throw new Error('selectFromPool called with empty pool');
  }

  const useBestFit = bestFitIndices && bestFitIndices.length > 0 && seededRandom(seed * 1.5) < 0.7;

  if (useBestFit && bestFitIndices) {
    const bestIdx = bestFitIndices[Math.floor(seededRandom(seed) * bestFitIndices.length)] ?? 0;
    const idx = Math.min(bestIdx, pool.length - 1);
    return pool[idx]!;
  }

  const idx = Math.floor(seededRandom(seed) * pool.length);
  return pool[idx]!;
}

// ============================================================================
// TEMPERATURE VOCABULARY
// ============================================================================

const temperatureRanges = temperatureData.ranges as Record<string, TemperatureRange>;

/**
 * Get temperature range key for a given temperature
 */
function getTemperatureRangeKey(tempC: number): string {
  if (tempC <= -6) return 'extreme_freezing';
  if (tempC <= -1) return 'freezing';
  if (tempC <= 4) return 'cold';
  if (tempC <= 9) return 'cool';
  if (tempC <= 14) return 'mild';
  if (tempC <= 19) return 'comfortable';
  if (tempC <= 24) return 'warm';
  if (tempC <= 29) return 'hot';
  if (tempC <= 34) return 'scorching';
  if (tempC <= 40) return 'extreme';
  return 'dangerous';
}

/**
 * Get a temperature phrase based on temperature and optional context
 */
export function getTemperaturePhrase(
  tempC: number,
  context?: WeatherContext,
  seed?: number,
): string {
  const rangeKey = getTemperatureRangeKey(tempC);
  const range = temperatureRanges[rangeKey];
  const fallback = temperatureRanges['comfortable'];
  const pool = range?.phrases ?? fallback?.phrases ?? ['ambient temperature'];

  const effectiveSeed = seed ?? tempC * 100;

  // Determine best-fit indices based on context
  let bestFit: number[] = [];
  if (context?.isDry && context?.isCold) bestFit = [0, 2, 4, 6, 8, 10, 12, 14];
  else if (context?.isHumid && context?.isCold) bestFit = [1, 3, 5, 7, 9, 11, 13, 15];
  else if (context?.isStormy) bestFit = [20, 22, 24, 26, 28, 30, 32, 34];
  else if (context?.isNight) bestFit = [40, 42, 44, 46, 48, 50, 52, 54];

  return selectFromPool(pool, effectiveSeed, bestFit);
}

/**
 * Get contextual temperature phrase (for specific weather conditions)
 */
export function getContextualTemperaturePhrase(contextKey: string, seed?: number): string {
  const contextual = (
    (temperatureData as Record<string, unknown>).contextual as Record<string, string[]> | undefined
  )?.[contextKey];
  if (!contextual || contextual.length === 0) return '';
  return selectFromPool(contextual, seed ?? Date.now());
}

// ============================================================================
// HUMIDITY VOCABULARY
// ============================================================================

const humidityRanges = humidityData.ranges as Record<string, HumidityRange>;

/**
 * Get humidity range key for a given humidity percentage
 */
function getHumidityRangeKey(humidity: number): string {
  if (humidity < 20) return 'bone_dry';
  if (humidity < 30) return 'very_dry';
  if (humidity < 40) return 'dry';
  if (humidity < 50) return 'comfortable';
  if (humidity < 60) return 'pleasant';
  if (humidity < 70) return 'humid';
  if (humidity < 80) return 'very_humid';
  if (humidity < 90) return 'oppressive';
  return 'saturated';
}

/**
 * Get a humidity phrase based on humidity percentage and optional context
 */
export function getHumidityPhrase(
  humidity: number,
  context?: WeatherContext,
  seed?: number,
): string {
  const rangeKey = getHumidityRangeKey(humidity);
  const range = humidityRanges[rangeKey];
  const fallback = humidityRanges['comfortable'];
  const pool = range?.phrases ?? fallback?.phrases ?? ['moderate humidity'];

  const effectiveSeed = seed ?? humidity * 10;

  let bestFit: number[] = [];
  if (context?.isRainy) bestFit = [6, 7, 8, 9];
  else if (context?.isHot) bestFit = [4, 5, 6, 7];
  else if (context?.isCold) bestFit = [0, 1, 2, 3];

  return selectFromPool(pool, effectiveSeed * 1.1, bestFit);
}

/**
 * Get contextual humidity phrase
 */
export function getContextualHumidityPhrase(contextKey: string, seed?: number): string {
  const contextual = (
    (humidityData as Record<string, unknown>).contextual as Record<string, string[]> | undefined
  )?.[contextKey];
  if (!contextual || contextual.length === 0) return '';
  return selectFromPool(contextual, seed ?? Date.now());
}

// ============================================================================
// WIND VOCABULARY
// ============================================================================

const windRanges = windData.ranges as Record<string, WindRange>;

/**
 * Get wind range key for a given wind speed
 */
function getWindRangeKey(windKmh: number): string {
  if (windKmh < 5) return 'calm';
  if (windKmh < 12) return 'light_air';
  if (windKmh < 20) return 'light_breeze';
  if (windKmh < 30) return 'gentle_breeze';
  if (windKmh < 40) return 'moderate_breeze';
  if (windKmh < 50) return 'fresh_breeze';
  if (windKmh < 62) return 'strong_breeze';
  if (windKmh < 75) return 'near_gale';
  if (windKmh < 89) return 'gale';
  return 'hurricane';
}

/**
 * Get a wind phrase based on wind speed and optional context
 */
export function getWindPhrase(windKmh: number, context?: WeatherContext, seed?: number): string {
  const rangeKey = getWindRangeKey(windKmh);
  const range = windRanges[rangeKey];
  const fallback = windRanges['light_breeze'];
  const pool = range?.phrases ?? fallback?.phrases ?? ['gentle breeze'];

  const effectiveSeed = seed ?? windKmh * 5;

  let bestFit: number[] = [];
  if (context?.isStormy) bestFit = [4, 5, 6, 7];
  else if (context?.isRainy) bestFit = [2, 3, 4, 5];

  return selectFromPool(pool, effectiveSeed * 1.2, bestFit);
}

/**
 * Get contextual wind phrase
 */
export function getContextualWindPhrase(contextKey: string, seed?: number): string {
  const contextual = (
    (windData as Record<string, unknown>).contextual as Record<string, string[]> | undefined
  )?.[contextKey];
  if (!contextual || contextual.length === 0) return '';
  return selectFromPool(contextual, seed ?? Date.now());
}

// ============================================================================
// TIME OF DAY VOCABULARY
// ============================================================================

const timePeriods =
  ((timeOfDayData as Record<string, unknown>).periods as Record<string, TimePeriod> | undefined) ??
  {};

/**
 * Get time period key for a given hour
 */
function getTimePeriodKey(hour: number): string {
  if (hour >= 0 && hour < 5) return 'deep_night';
  if (hour >= 5 && hour < 7) return 'dawn';
  if (hour >= 7 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 14) return 'midday';
  if (hour >= 14 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 20) return 'golden_hour';
  if (hour >= 20 && hour < 22) return 'twilight';
  return 'night';
}

/**
 * Get a time-based mood and lighting phrase
 */
export function getTimePhrase(
  hour: number,
  context?: WeatherContext,
  seed?: number,
): TimeMoodLighting {
  const periodKey = getTimePeriodKey(hour);
  const period = timePeriods[periodKey];
  const fallback = timePeriods['morning'];
  const pool = period?.phrases ?? fallback?.phrases ?? [{ mood: 'calm', lighting: 'soft light' }];

  const effectiveSeed = seed ?? hour * 10;

  let bestFit: number[] = [];
  if (context?.isStormy) bestFit = [4, 5, 6, 7];
  else if (context?.isRainy) bestFit = [2, 3, 8, 9];

  return selectFromPool(pool, effectiveSeed * 1.3, bestFit);
}

/**
 * Get contextual time phrase
 */
export function getContextualTimePhrase(
  contextKey: string,
  seed?: number,
): TimeMoodLighting | null {
  const contextual = (
    (timeOfDayData as Record<string, unknown>).contextual as
      | Record<string, TimeMoodLighting[]>
      | undefined
  )?.[contextKey];
  if (!contextual || contextual.length === 0) return null;
  return selectFromPool(contextual, seed ?? Date.now());
}

// ============================================================================
// CONDITIONS VOCABULARY
// ============================================================================

const conditionTypes = conditionsData.conditions as Record<string, ConditionType>;

/**
 * Get condition key from emoji
 */
function getConditionKey(emoji: string): string {
  for (const [key, value] of Object.entries(conditionTypes)) {
    if (value.emoji === emoji) return key;
  }
  return 'default';
}

/**
 * Get a condition/weather phrase based on emoji
 */
export function getConditionPhrase(emoji: string, context?: WeatherContext, seed?: number): string {
  const conditionKey = getConditionKey(emoji);
  const condition = conditionTypes[conditionKey];
  const fallback = conditionTypes['default'];
  const pool = condition?.phrases ?? fallback?.phrases ?? ['standard conditions'];

  const effectiveSeed = seed ?? emoji.charCodeAt(0);

  let bestFit: number[] = [];
  if (context?.isWindy) bestFit = [10, 11, 12, 13, 14, 15];
  else if (context?.isNight) bestFit = [16, 17, 18, 19];

  return selectFromPool(pool, effectiveSeed * 1.4, bestFit);
}

/**
 * Get all available condition types
 */
export function getAllConditionTypes(): string[] {
  return Object.keys(conditionTypes);
}

// ============================================================================
// CITY VIBES VOCABULARY
// ============================================================================

const cityVibes = (cityVibesData as Record<string, unknown>).cities as Record<string, CityVibes>;

/**
 * Get city vibes for a given city name
 */
export function getCityVibe(city: string, seed?: number): string {
  const cityLower = city.toLowerCase();

  for (const [key, value] of Object.entries(cityVibes)) {
    if (cityLower.includes(key)) {
      const venueNames = value.venues?.map((v) => v.name) ?? [];
      if (venueNames.length === 0) return '';
      return selectFromPool(venueNames, seed ?? cityLower.charCodeAt(0) * 1.5);
    }
  }

  return '';
}

/**
 * Get all city vibes for a city
 */
export function getAllCityVibes(city: string): string[] {
  const cityLower = city.toLowerCase();

  for (const [key, value] of Object.entries(cityVibes)) {
    if (cityLower.includes(key)) {
      return value.venues?.map((v) => v.name) ?? [];
    }
  }

  return [];
}

/**
 * Get list of all supported cities
 */
export function getSupportedCities(): string[] {
  return Object.keys(cityVibes);
}

/**
 * Get contextual city phrase
 */
export function getContextualCityPhrase(contextKey: string, seed?: number): string {
  const contextual = (
    (cityVibesData as Record<string, unknown>).contextual as Record<string, string[]> | undefined
  )?.[contextKey];
  if (!contextual || contextual.length === 0) return '';
  return selectFromPool(contextual, seed ?? Date.now());
}

// ============================================================================
// COMBINED WEATHER PHRASE GENERATOR
// ============================================================================

export interface WeatherPhraseInput {
  tempC: number;
  humidity: number;
  windKmh: number;
  hour: number;
  emoji: string;
  city: string;
}

export interface WeatherPhraseOutput {
  temperature: string;
  humidity: string;
  wind: string;
  time: TimeMoodLighting;
  condition: string;
  cityVibe: string;
}

/**
 * Generate all weather phrases from a single input
 */
export function generateWeatherPhrases(
  input: WeatherPhraseInput,
  context?: WeatherContext,
): WeatherPhraseOutput {
  const seed = input.tempC * 100 + input.humidity * 10 + input.windKmh + input.hour;

  return {
    temperature: getTemperaturePhrase(input.tempC, context, seed),
    humidity: getHumidityPhrase(input.humidity, context, seed),
    wind: getWindPhrase(input.windKmh, context, seed),
    time: getTimePhrase(input.hour, context, seed),
    condition: getConditionPhrase(input.emoji, context, seed),
    cityVibe: getCityVibe(input.city, seed),
  };
}

// ============================================================================
// VOCABULARY STATISTICS
// ============================================================================

export interface VocabularyStats {
  temperature: number;
  humidity: number;
  wind: number;
  timeOfDay: number;
  conditions: number;
  cityVibes: number;
  total: number;
}

/**
 * Get vocabulary statistics
 */
export function getVocabularyStats(): VocabularyStats {
  const tempCount = Object.values(temperatureRanges).reduce((sum, r) => sum + r.phrases.length, 0);
  const humidityCount = Object.values(humidityRanges).reduce((sum, r) => sum + r.phrases.length, 0);
  const windCount = Object.values(windRanges).reduce((sum, r) => sum + r.phrases.length, 0);
  const timeCount = Object.values(timePeriods).reduce((sum, p) => sum + p.phrases.length, 0);
  const conditionCount = Object.values(conditionTypes).reduce(
    (sum, c) => sum + c.phrases.length,
    0,
  );
  const cityCount = Object.values(cityVibes).reduce((sum, c) => sum + (c.venues?.length ?? 0), 0);

  return {
    temperature: tempCount,
    humidity: humidityCount,
    wind: windCount,
    timeOfDay: timeCount,
    conditions: conditionCount,
    cityVibes: cityCount,
    total: tempCount + humidityCount + windCount + timeCount + conditionCount + cityCount,
  };
}
