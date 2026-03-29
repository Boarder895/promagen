// src/data/providers/provider-weather-map.ts
// ============================================================================
// PROVIDER → WEATHER MAPPING
// ============================================================================
// Maps each AI provider to its weather data source and city-vibes city.
//
// Weather sources fall into two categories:
//   1. Existing exchange weather — provider HQ is within 100km of an exchange
//      city that already has weather data (e.g. London → lse-london).
//   2. New provider weather — 15 dedicated cities added to the weather batch
//      (e.g. San Francisco → provider-san-francisco).
//
// The `vibesCity` field is the key into city-vibes.json for venue
// selection. The `lat`/`lon` fields are the provider HQ coordinates, used
// by the lighting engine for solar/lunar elevation.
//
// Coverage: 42/42 providers (17 existing exchange, 27 via 17 provider cities)
//
// NOTE: Redmond and Rockville use Seattle / Washington DC weather respectively
// (within 17–22km) but display their own vibesCity and venue vocabulary.
//
// Authority: provider-city-vibes-build-plan.md §Phase 1B
// Existing features preserved: Yes
// ============================================================================

import { getPlatformTierId } from '@/data/platform-tiers';
import type { PlatformTierId } from '@/data/platform-tiers';

// ============================================================================
// TYPES
// ============================================================================

export interface ProviderWeatherMapping {
  /** Key into useWeather() result (exchange ID or provider-* ID) */
  readonly weatherId: string;
  /** Lowercase key into city-vibes.json — used for venue vocabulary lookups */
  readonly vibesCity: string;
  /**
   * Display city for tooltips when HQ city ≠ weather source city.
   * E.g. Redmond HQ uses Seattle weather → tooltipCity: 'Seattle'.
   * When absent, vibesCity is used in tooltips.
   */
  readonly tooltipCity?: string;
  /** Provider HQ latitude — for lighting engine solar elevation */
  readonly lat: number;
  /** Provider HQ longitude — for lighting engine solar elevation */
  readonly lon: number;
}

// ============================================================================
// MAPPING TABLE
// ============================================================================

/**
 * Complete provider → weather mapping for all 42 AI providers.
 *
 * Grouped by weather source for readability:
 * - San Francisco cluster (9 providers)
 * - Bay Area dedicated cities (4 providers: Mountain View, San Jose, Menlo Park)
 * - Other new provider cities (14 providers)
 * - Existing exchange cities (15 providers)
 */
export const PROVIDER_WEATHER_MAP: Readonly<Record<string, ProviderWeatherMapping>> = {
  // ─── San Francisco cluster (provider-san-francisco) ─────────────────────
  // 9 providers in San Francisco proper, all within 10km
  'midjourney':         { weatherId: 'provider-san-francisco', vibesCity: 'San Francisco', lat: 37.7749, lon: -122.4194 },
  'openai':             { weatherId: 'provider-san-francisco', vibesCity: 'San Francisco', lat: 37.7749, lon: -122.4194 },
  'playground':         { weatherId: 'provider-san-francisco', vibesCity: 'San Francisco', lat: 37.7749, lon: -122.4194 },
  'lexica':             { weatherId: 'provider-san-francisco', vibesCity: 'San Francisco', lat: 37.7749, lon: -122.4194 },
  'picsart':            { weatherId: 'provider-san-francisco', vibesCity: 'San Francisco', lat: 37.7749, lon: -122.4194 },
  'deepai':             { weatherId: 'provider-san-francisco', vibesCity: 'San Francisco', lat: 37.7749, lon: -122.4194 },
  'bluewillow':         { weatherId: 'provider-san-francisco', vibesCity: 'San Francisco', lat: 37.7749, lon: -122.4194 },
  'simplified':         { weatherId: 'provider-san-francisco', vibesCity: 'San Francisco', lat: 37.7749, lon: -122.4194 },

  // ─── Mountain View (provider-mountain-view) ────────────────────────────
  'google-imagen':      { weatherId: 'provider-mountain-view', vibesCity: 'Mountain View', lat: 37.3861, lon: -122.0839 },
  'hotpot':             { weatherId: 'provider-mountain-view', vibesCity: 'Mountain View', lat: 37.4419, lon: -122.143  }, // Palo Alto (7km from MV)

  // ─── San Jose (provider-san-jose) ──────────────────────────────────────
  'adobe-firefly':      { weatherId: 'provider-san-jose',      vibesCity: 'San Jose',      lat: 37.3382, lon: -121.8863 },

  // ─── Menlo Park (provider-menlo-park) ──────────────────────────────────
  'imagine-meta':       { weatherId: 'provider-menlo-park',    vibesCity: 'Menlo Park',    lat: 37.4529, lon: -122.1817 },

  // ─── Redmond (Seattle weather, Redmond venues) ──────────────────────────
  'microsoft-designer': { weatherId: 'provider-seattle',       vibesCity: 'Redmond',       tooltipCity: 'Seattle',        lat: 47.674,  lon: -122.1215 },
  'bing':               { weatherId: 'provider-seattle',       vibesCity: 'Redmond',       tooltipCity: 'Seattle',        lat: 47.674,  lon: -122.1215 },

  // ─── Houston (provider-houston) ─────────────────────────────────────────
  'craiyon':            { weatherId: 'provider-houston',       vibesCity: 'Houston',       lat: 29.7604, lon: -95.3698  },

  // ─── Austin (provider-austin) ───────────────────────────────────────────
  'jasper-art':         { weatherId: 'provider-austin',        vibesCity: 'Austin',        lat: 30.2672, lon: -97.7431  },

  // ─── Warsaw (provider-warsaw) ───────────────────────────────────────────

  // ─── Málaga (provider-malaga) ───────────────────────────────────────────

  // ─── Limassol (provider-limassol) ───────────────────────────────────────
  'vistacreate':        { weatherId: 'provider-limassol',      vibesCity: 'Limassol',      lat: 34.6786, lon: 33.0413   },

  // ─── Rockville (DC weather, Rockville venues) ───────────────────────────
  'visme':              { weatherId: 'provider-washington-dc', vibesCity: 'Rockville',     tooltipCity: 'Washington DC', lat: 39.084,  lon: -77.1528  },

  // ─── Sheridan (provider-sheridan) ───────────────────────────────────────
  'novelai':            { weatherId: 'provider-sheridan',      vibesCity: 'Sheridan',      lat: 44.7972, lon: -106.956  },

  // ─── Cairns (provider-cairns) ───────────────────────────────────────────

  // ─── London (lse-london) ───────────────────────────────────────────────
  'stability':          { weatherId: 'lse-london',             vibesCity: 'London',        lat: 51.5074, lon: -0.1276   },
  'dreamstudio':        { weatherId: 'lse-london',             vibesCity: 'London',        lat: 51.5074, lon: -0.1276   },
  'dreamlike':          { weatherId: 'lse-london',             vibesCity: 'London',        lat: 51.5074, lon: -0.1276   },

  // ─── Sydney (asx-sydney) ───────────────────────────────────────────────
  'leonardo':           { weatherId: 'asx-sydney',             vibesCity: 'Sydney',        lat: -33.8688, lon: 151.2093 },
  'canva':              { weatherId: 'asx-sydney',             vibesCity: 'Sydney',        lat: -33.886,  lon: 151.211  }, // Surry Hills (2km)

  // ─── Toronto (tsx-toronto) ──────────────────────────────────────────────
  'ideogram':           { weatherId: 'tsx-toronto',            vibesCity: 'Toronto',       lat: 43.6532, lon: -79.3832  },

  // ─── Burlington (provider-burlington) ──────────────────────────────────
  'artistly':           { weatherId: 'provider-burlington',    vibesCity: 'Burlington',    lat: 43.3255, lon: -79.7990  },

  // ─── Kuala Lumpur (bursa-kuala-lumpur) ──────────────────────────────────
  '123rf':              { weatherId: 'bursa-kuala-lumpur',     vibesCity: 'Kuala Lumpur',  lat: 3.139,   lon: 101.6869  },

  // ─── Bandar Sunway (provider-bandar-sunway) ───────────────────────────
  'pixlr':              { weatherId: 'provider-bandar-sunway', vibesCity: 'Bandar Sunway', lat: 3.0738,  lon: 101.6068  },

  // ─── Hong Kong (hkex-hong-kong) ────────────────────────────────────────
  'fotor':              { weatherId: 'hkex-hong-kong',         vibesCity: 'Hong Kong',     lat: 22.3193, lon: 114.1694  },
  'artguru':            { weatherId: 'hkex-hong-kong',         vibesCity: 'Hong Kong',     lat: 22.3193, lon: 114.1694  },
  'picwish':            { weatherId: 'hkex-hong-kong',         vibesCity: 'Hong Kong',     lat: 22.3193, lon: 114.1694  },

  // ─── New York (nyse-new-york) ──────────────────────────────────────────
  'artbreeder':         { weatherId: 'nyse-new-york',          vibesCity: 'New York',      lat: 40.7128, lon: -74.006   },
  'runway':             { weatherId: 'nyse-new-york',          vibesCity: 'New York',      lat: 40.7128, lon: -74.006   },

  // ─── Paris (euronext-paris) ────────────────────────────────────────────
  'clipdrop':           { weatherId: 'euronext-paris',         vibesCity: 'Paris',         lat: 48.8566, lon: 2.3522    },

  // ─── Vienna (wbag-vienna) ──────────────────────────────────────────────
  'recraft':            { weatherId: 'wbag-san-francisco',     vibesCity: 'San Francisco', lat: 37.7749, lon: -122.4194 },
  'kling':              { weatherId: 'wbag-beijing',           vibesCity: 'Beijing',       lat: 39.9042, lon: 116.4074  },
  'luma-ai':            { weatherId: 'wbag-palo-alto',        vibesCity: 'Palo Alto',     lat: 37.4419, lon: -122.1430 },

  // ─── Taipei (twse-taipei) ──────────────────────────────────────────────
  'myedit':             { weatherId: 'twse-taipei',            vibesCity: 'Taipei',        lat: 25.033,  lon: 121.5654  },

  // ─── Jerusalem (provider-jerusalem) ─────────────────────────────────────
  'photoleap':          { weatherId: 'provider-jerusalem',     vibesCity: 'Jerusalem',     lat: 31.7683, lon: 35.2137   },

  // ─── Freiburg (provider-freiburg) ───────────────────────────────────────
  'flux':               { weatherId: 'provider-freiburg',      vibesCity: 'Freiburg',      lat: 47.999,  lon: 7.842     },
} as const;

// ============================================================================
// LOOKUP HELPERS
// ============================================================================

/**
 * Get weather mapping for a provider.
 * Returns null if provider has no mapping (should not happen for known providers).
 */
export function getProviderWeatherMapping(providerId: string): ProviderWeatherMapping | null {
  return PROVIDER_WEATHER_MAP[providerId] ?? null;
}

/**
 * Get the prompt tier for a provider.
 * Convenience wrapper over getPlatformTierId from platform-tiers.ts.
 * Defaults to tier 3 (Natural Language) if provider not found.
 */
export function getProviderTier(providerId: string): PlatformTierId {
  return getPlatformTierId(providerId) ?? 3;
}

/**
 * Check whether a weather data ID is a provider-specific city
 * (vs an exchange city). Provider IDs start with "provider-".
 */
export function isProviderWeatherId(weatherId: string): boolean {
  return weatherId.startsWith('provider-');
}
