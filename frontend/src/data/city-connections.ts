// src/data/city-connections.ts
// ============================================================================
// CITY CONNECTIONS - Dynamic Exchange ↔ AI Provider Mapping
// ============================================================================
// Fully dynamic: connections are derived at runtime by matching
// exchange.city === provider.hqCity
//
// NO HARDCODED MAPPINGS — add/remove providers or exchanges in their
// respective JSON files and connections auto-update.
//
// Last updated: January 2026
// ============================================================================

import EXCHANGES from '@/data/exchanges';
import { PROVIDERS } from '@/data/providers';
import type { Provider } from '@/data/providers';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Continent identifier for color theming.
 */
export type Continent =
  | 'asia'
  | 'oceania'
  | 'europe'
  | 'americas'
  | 'africa'
  | 'middle-east';

/**
 * A connection between an exchange and an AI provider.
 */
export type CityConnection = {
  /** Exchange ID from exchanges.catalog.json */
  exchangeId: string;
  /** Provider ID from providers.json */
  providerId: string;
  /** City name (shared by exchange and provider) */
  city: string;
  /** Continent for color theming */
  continent: Continent;
};

// ============================================================================
// CONTINENT COLORS (UI Theming)
// ============================================================================

/**
 * Continent color palette for pulse animations.
 * Each continent has a primary color and a glow variant.
 */
export const CONTINENT_COLORS: Record<Continent, { primary: string; glow: string; name: string }> = {
  asia: {
    primary: '#fbbf24', // amber-400 (gold)
    glow: 'rgba(251, 191, 36, 0.6)',
    name: 'Asia',
  },
  oceania: {
    primary: '#22d3ee', // cyan-400
    glow: 'rgba(34, 211, 238, 0.6)',
    name: 'Oceania',
  },
  europe: {
    primary: '#3b82f6', // blue-500
    glow: 'rgba(59, 130, 246, 0.6)',
    name: 'Europe',
  },
  americas: {
    primary: '#10b981', // emerald-500
    glow: 'rgba(16, 185, 129, 0.6)',
    name: 'Americas',
  },
  africa: {
    primary: '#f97316', // orange-500
    glow: 'rgba(249, 115, 22, 0.6)',
    name: 'Africa',
  },
  'middle-east': {
    primary: '#a855f7', // purple-500
    glow: 'rgba(168, 85, 247, 0.6)',
    name: 'Middle East',
  },
};

// ============================================================================
// COUNTRY → CONTINENT MAPPING
// ============================================================================

/**
 * Maps ISO2 country codes to continents.
 * Used to determine pulse animation colors.
 */
const COUNTRY_TO_CONTINENT: Record<string, Continent> = {
  // Oceania
  AU: 'oceania',
  NZ: 'oceania',
  FJ: 'oceania',
  PG: 'oceania',

  // Asia
  JP: 'asia',
  CN: 'asia',
  HK: 'asia',
  TW: 'asia',
  KR: 'asia',
  SG: 'asia',
  MY: 'asia',
  TH: 'asia',
  VN: 'asia',
  ID: 'asia',
  PH: 'asia',
  IN: 'asia',
  PK: 'asia',
  BD: 'asia',
  NP: 'asia',
  LK: 'asia',
  KZ: 'asia',
  UZ: 'asia',

  // Middle East
  AE: 'middle-east',
  SA: 'middle-east',
  QA: 'middle-east',
  KW: 'middle-east',
  BH: 'middle-east',
  OM: 'middle-east',
  JO: 'middle-east',
  LB: 'middle-east',
  IL: 'middle-east',
  TR: 'middle-east',
  IR: 'middle-east',
  IQ: 'middle-east',

  // Europe
  GB: 'europe',
  DE: 'europe',
  FR: 'europe',
  IT: 'europe',
  ES: 'europe',
  PT: 'europe',
  NL: 'europe',
  BE: 'europe',
  CH: 'europe',
  AT: 'europe',
  SE: 'europe',
  NO: 'europe',
  DK: 'europe',
  FI: 'europe',
  PL: 'europe',
  CZ: 'europe',
  HU: 'europe',
  RO: 'europe',
  GR: 'europe',
  IE: 'europe',
  RU: 'europe',
  UA: 'europe',
  CY: 'europe',

  // Africa
  ZA: 'africa',
  EG: 'africa',
  NG: 'africa',
  KE: 'africa',
  MA: 'africa',
  TN: 'africa',
  GH: 'africa',
  MU: 'africa',

  // Americas
  US: 'americas',
  CA: 'americas',
  MX: 'americas',
  BR: 'americas',
  AR: 'americas',
  CL: 'americas',
  CO: 'americas',
  PE: 'americas',
  VE: 'americas',
  TT: 'americas',
  JM: 'americas',
  PA: 'americas',
};

/**
 * Derive continent from a country code.
 * Falls back to 'europe' if unknown (conservative default).
 */
function getContinentFromCountryCode(iso2: string): Continent {
  return COUNTRY_TO_CONTINENT[iso2] ?? 'europe';
}

// ============================================================================
// CITY NORMALIZATION
// ============================================================================

/**
 * City name aliases to handle variations.
 * Key: variant spelling, Value: canonical name
 *
 * This handles cases where providers and exchanges might use
 * slightly different city names for the same location.
 */
const CITY_ALIASES: Record<string, string> = {
  // Sydney variants
  'Surry Hills': 'Sydney', // Canva uses suburb name

  // Bay Area normalization — all map to San Francisco for matching
  'Mountain View': 'San Francisco', // Google
  'Menlo Park': 'San Francisco', // Meta
  'Palo Alto': 'San Francisco', // Hotpot
  'San Jose': 'San Francisco', // Adobe
  'Redmond': 'Seattle', // Microsoft — keep separate, different exchange region

  // Other normalizations can be added here as needed
};

/**
 * Normalize a city name to its canonical form.
 */
function normalizeCity(city: string | undefined): string {
  if (!city) return '';
  return CITY_ALIASES[city] ?? city;
}

// ============================================================================
// DYNAMIC CONNECTION GENERATOR
// ============================================================================

/**
 * Build a map of normalized city names → providers in that city.
 * Cached on first access.
 */
let providersByCityCache: Map<string, Provider[]> | null = null;

function getProvidersByCity(): Map<string, Provider[]> {
  if (providersByCityCache) return providersByCityCache;

  const map = new Map<string, Provider[]>();
  for (const provider of PROVIDERS) {
    if (!provider.hqCity) continue; // Skip providers without hqCity
    const normalizedCity = normalizeCity(provider.hqCity);
    if (!normalizedCity) continue;
    const existing = map.get(normalizedCity) ?? [];
    existing.push(provider);
    map.set(normalizedCity, existing);
  }
  providersByCityCache = map;
  return map;
}

/**
 * Get all providers headquartered in a city (or its normalized equivalent).
 */
export function getProvidersInCity(city: string): Provider[] {
  const normalizedCity = normalizeCity(city);
  return getProvidersByCity().get(normalizedCity) ?? [];
}

/**
 * Get all connections for a specific exchange.
 * This is the main entry point for the Market Pulse feature.
 *
 * @param exchangeId - Exchange ID from exchanges.catalog.json
 * @returns Array of connections to providers in the same city
 */
export function getConnectionsForExchange(exchangeId: string): CityConnection[] {
  const exchange = EXCHANGES.find((e) => e.id === exchangeId);
  if (!exchange) return [];

  const providers = getProvidersInCity(exchange.city);
  if (providers.length === 0) return [];

  const continent = getContinentFromCountryCode(exchange.iso2);

  return providers.map((provider) => ({
    exchangeId,
    providerId: provider.id,
    city: exchange.city,
    continent,
  }));
}

/**
 * Get all connections for a specific provider.
 *
 * @param providerId - Provider ID from providers.json
 * @returns Array of connections to exchanges in the same city
 */
export function getConnectionsForProvider(providerId: string): CityConnection[] {
  const provider = PROVIDERS.find((p) => p.id === providerId);
  if (!provider || !provider.hqCity) return [];

  const normalizedCity = normalizeCity(provider.hqCity);
  if (!normalizedCity) return [];

  // Find all exchanges in this city (or its canonical equivalent)
  const matchingExchanges = EXCHANGES.filter(
    (e) => normalizeCity(e.city) === normalizedCity
  );

  if (matchingExchanges.length === 0) return [];

  return matchingExchanges.map((exchange) => ({
    exchangeId: exchange.id,
    providerId,
    city: exchange.city,
    continent: getContinentFromCountryCode(exchange.iso2),
  }));
}

/**
 * Check if a provider has any exchange connections.
 * Returns the first connection found, or undefined if none.
 */
export function getProviderConnection(providerId: string): CityConnection | undefined {
  const connections = getConnectionsForProvider(providerId);
  return connections[0];
}

/**
 * Check if a provider is connected to any exchange.
 */
export function isProviderConnected(providerId: string): boolean {
  return getConnectionsForProvider(providerId).length > 0;
}

/**
 * Get connection info for display in provider cell.
 * Returns city name and continent color if connected, undefined otherwise.
 */
export function getProviderConnectionInfo(providerId: string): {
  city: string;
  continent: Continent;
  color: string;
} | undefined {
  const connection = getProviderConnection(providerId);
  if (!connection) return undefined;

  return {
    city: connection.city,
    continent: connection.continent,
    color: CONTINENT_COLORS[connection.continent].primary,
  };
}

/**
 * Check if an exchange has any provider connections.
 */
export function hasConnections(exchangeId: string): boolean {
  return getConnectionsForExchange(exchangeId).length > 0;
}

/**
 * Get all unique exchange IDs that have connections.
 * Note: This iterates all exchanges, use sparingly.
 */
export function getConnectedExchangeIds(): string[] {
  return EXCHANGES.filter((e) => hasConnections(e.id)).map((e) => e.id);
}

/**
 * Get all unique provider IDs that have connections.
 * Note: This iterates all providers, use sparingly.
 */
export function getConnectedProviderIds(): string[] {
  return PROVIDERS.filter((p) => isProviderConnected(p.id)).map((p) => p.id);
}

/**
 * Get all connections grouped by city.
 * Useful for debugging or admin views.
 */
export function getAllConnectionsByCity(): Map<string, CityConnection[]> {
  const map = new Map<string, CityConnection[]>();

  for (const exchange of EXCHANGES) {
    const connections = getConnectionsForExchange(exchange.id);
    if (connections.length > 0) {
      const existing = map.get(exchange.city) ?? [];
      existing.push(...connections);
      map.set(exchange.city, existing);
    }
  }

  return map;
}

/**
 * Get summary statistics.
 * Useful for debugging or admin views.
 */
export function getConnectionStats(): {
  totalConnections: number;
  uniqueCities: number;
  uniqueExchanges: number;
  uniqueProviders: number;
} {
  const allConnections = getAllConnectionsByCity();
  const allConnectionsFlat = Array.from(allConnections.values()).flat();

  return {
    totalConnections: allConnectionsFlat.length,
    uniqueCities: allConnections.size,
    uniqueExchanges: new Set(allConnectionsFlat.map((c) => c.exchangeId)).size,
    uniqueProviders: new Set(allConnectionsFlat.map((c) => c.providerId)).size,
  };
}

// ============================================================================
// LEGACY COMPATIBILITY
// ============================================================================

/**
 * @deprecated Use getConnectionsForExchange() or getConnectionsForProvider() instead.
 *
 * This empty array is kept for backward compatibility with code that
 * might have imported CITY_CONNECTIONS directly. The static array
 * approach is deprecated in favor of dynamic runtime lookups.
 */
export const CITY_CONNECTIONS: CityConnection[] = [];
