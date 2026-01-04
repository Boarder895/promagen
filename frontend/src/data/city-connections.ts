// src/data/city-connections.ts
// ============================================================================
// CITY CONNECTIONS - Maps exchanges to AI providers in the same city
// ============================================================================
// This is the Single Source of Truth for market-to-provider connections.
// Used by the Market Pulse feature to draw animated connection lines.
//
// Total: 19 connections across 10 cities (2 cities have multiple exchanges)
// Last updated: January 1, 2026
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
  /** Normalized city name (for display) */
  city: string;
  /** Continent for color theming */
  continent: Continent;
};

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

/**
 * Complete list of city connections.
 *
 * Derived from matching providers.json hqCity to exchanges_catalog.json city.
 *
 * Multi-exchange cities: New York (2), Warsaw (2)
 * When ANY exchange in a city triggers, ALL providers in that city receive pulses.
 *
 * Summary:
 * | City       | Exchange(s)                      | Provider(s)                               |
 * |------------|----------------------------------|-------------------------------------------|
 * | Sydney     | asx-sydney                       | Leonardo AI                               |
 * | London     | lse-london                       | Stability AI, DreamStudio, Dreamlike.art  |
 * | Hong Kong  | hkex-hong-kong                   | Fotor, Artguru, PicWish                   |
 * | Chicago    | cboe-chicago                     | 123RF AI Generator                        |
 * | New York   | nyse-new-york, nasdaq-new-york   | Runway ML, Artbreeder                     |
 * | Paris      | euronext-paris                   | Clipdrop                                  |
 * | Toronto    | tsx-toronto                      | Ideogram                                  |
 * | Taipei     | twse-taipei                      | MyEdit (CyberLink)                        |
 * | Vienna     | wbag-vienna                      | Remove.bg (Kaleido AI)                    |
 * | Warsaw     | gpw-warsaw, wse-warsaw-newconnect| Getimg.ai                                 |
 */
export const CITY_CONNECTIONS: CityConnection[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // OCEANIA
  // ═══════════════════════════════════════════════════════════════════════════

  // Sydney — 1 exchange, 1 provider
  {
    exchangeId: 'asx-sydney',
    providerId: 'leonardo',
    city: 'Sydney',
    continent: 'oceania',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ASIA
  // ═══════════════════════════════════════════════════════════════════════════

  // Hong Kong — 1 exchange, 3 providers
  {
    exchangeId: 'hkex-hong-kong',
    providerId: 'fotor',
    city: 'Hong Kong',
    continent: 'asia',
  },
  {
    exchangeId: 'hkex-hong-kong',
    providerId: 'artguru',
    city: 'Hong Kong',
    continent: 'asia',
  },
  {
    exchangeId: 'hkex-hong-kong',
    providerId: 'picwish',
    city: 'Hong Kong',
    continent: 'asia',
  },

  // Taipei — 1 exchange, 1 provider
  {
    exchangeId: 'twse-taipei',
    providerId: 'myedit',
    city: 'Taipei',
    continent: 'asia',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EUROPE
  // ═══════════════════════════════════════════════════════════════════════════

  // London — 1 exchange, 3 providers
  {
    exchangeId: 'lse-london',
    providerId: 'stability',
    city: 'London',
    continent: 'europe',
  },
  {
    exchangeId: 'lse-london',
    providerId: 'dreamstudio',
    city: 'London',
    continent: 'europe',
  },
  {
    exchangeId: 'lse-london',
    providerId: 'dreamlike',
    city: 'London',
    continent: 'europe',
  },

  // Paris — 1 exchange, 1 provider
  {
    exchangeId: 'euronext-paris',
    providerId: 'clipdrop',
    city: 'Paris',
    continent: 'europe',
  },

  // Vienna — 1 exchange, 1 provider
  {
    exchangeId: 'wbag-vienna',
    providerId: 'remove-bg',
    city: 'Vienna',
    continent: 'europe',
  },

  // Warsaw — 2 exchanges, 1 provider (2 connections)
  {
    exchangeId: 'gpw-warsaw',
    providerId: 'getimg',
    city: 'Warsaw',
    continent: 'europe',
  },
  {
    exchangeId: 'wse-warsaw-newconnect',
    providerId: 'getimg',
    city: 'Warsaw',
    continent: 'europe',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // AMERICAS
  // ═══════════════════════════════════════════════════════════════════════════

  // Chicago — 1 exchange, 1 provider
  {
    exchangeId: 'cboe-chicago',
    providerId: '123rf',
    city: 'Chicago',
    continent: 'americas',
  },

  // New York — 2 exchanges, 2 providers (4 connections)
  {
    exchangeId: 'nyse-new-york',
    providerId: 'runway',
    city: 'New York',
    continent: 'americas',
  },
  {
    exchangeId: 'nyse-new-york',
    providerId: 'artbreeder',
    city: 'New York',
    continent: 'americas',
  },
  {
    exchangeId: 'nasdaq-new-york',
    providerId: 'runway',
    city: 'New York',
    continent: 'americas',
  },
  {
    exchangeId: 'nasdaq-new-york',
    providerId: 'artbreeder',
    city: 'New York',
    continent: 'americas',
  },

  // Toronto — 1 exchange, 1 provider
  {
    exchangeId: 'tsx-toronto',
    providerId: 'ideogram',
    city: 'Toronto',
    continent: 'americas',
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get all connections for a specific exchange.
 */
export function getConnectionsForExchange(exchangeId: string): CityConnection[] {
  return CITY_CONNECTIONS.filter((c) => c.exchangeId === exchangeId);
}

/**
 * Get all connections for a specific provider.
 */
export function getConnectionsForProvider(providerId: string): CityConnection[] {
  return CITY_CONNECTIONS.filter((c) => c.providerId === providerId);
}

/**
 * Check if a provider has any exchange connections.
 * Returns the first connection found, or undefined if none.
 */
export function getProviderConnection(providerId: string): CityConnection | undefined {
  return CITY_CONNECTIONS.find((c) => c.providerId === providerId);
}

/**
 * Check if a provider is connected to any exchange.
 */
export function isProviderConnected(providerId: string): boolean {
  return CITY_CONNECTIONS.some((c) => c.providerId === providerId);
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
 * Get all unique exchange IDs that have connections.
 */
export function getConnectedExchangeIds(): string[] {
  return [...new Set(CITY_CONNECTIONS.map((c) => c.exchangeId))];
}

/**
 * Get all unique provider IDs that have connections.
 */
export function getConnectedProviderIds(): string[] {
  return [...new Set(CITY_CONNECTIONS.map((c) => c.providerId))];
}

/**
 * Check if an exchange has any provider connections.
 */
export function hasConnections(exchangeId: string): boolean {
  return CITY_CONNECTIONS.some((c) => c.exchangeId === exchangeId);
}

/**
 * Get connections grouped by city.
 */
export function getConnectionsByCity(): Map<string, CityConnection[]> {
  const map = new Map<string, CityConnection[]>();
  for (const c of CITY_CONNECTIONS) {
    const existing = map.get(c.city) ?? [];
    existing.push(c);
    map.set(c.city, existing);
  }
  return map;
}

/**
 * Get summary statistics.
 */
export function getConnectionStats(): {
  totalConnections: number;
  uniqueCities: number;
  uniqueExchanges: number;
  uniqueProviders: number;
} {
  return {
    totalConnections: CITY_CONNECTIONS.length,
    uniqueCities: new Set(CITY_CONNECTIONS.map((c) => c.city)).size,
    uniqueExchanges: getConnectedExchangeIds().length,
    uniqueProviders: getConnectedProviderIds().length,
  };
}
