// frontend/src/components/exchanges/adapters.ts
// ============================================================================
// Exchange Data Adapters
// ============================================================================
// Converts canonical Exchange type to ExchangeCardData for rendering.
// Now uses a single unified adapter since Exchange type is consolidated.
// ============================================================================

import type { ExchangeCardData, ExchangeWeatherData } from './types';
import type { Exchange } from '@/data/exchanges/types';

/**
 * Convert a canonical Exchange to ExchangeCardData for rendering.
 *
 * This is the single adapter function that replaces the previous
 * `fromUiExchange`, `fromOrderExchange`, and `fromCatalogEntry` functions.
 *
 * @param exchange - Canonical Exchange from @/data/exchanges
 * @param weather - Optional weather data from API
 * @returns ExchangeCardData ready for ExchangeCard component
 *
 * @example
 * ```tsx
 * import { toCardData } from '@/components/exchanges/adapters';
 *
 * <ExchangeCard exchange={toCardData(exchange)} />
 * <ExchangeCard exchange={toCardData(exchange, weatherData)} />
 * ```
 */
export function toCardData(
  exchange: Exchange,
  weather?: ExchangeWeatherData | null
): ExchangeCardData {
  return {
    id: exchange.id,
    // Prefer 'exchange' field (full name), fall back to 'name' alias, then 'id'
    name: exchange.exchange || exchange.name || exchange.id,
    city: exchange.city ?? '',
    // Prefer 'iso2' field, fall back to 'countryCode' alias
    countryCode: (exchange.iso2 || exchange.countryCode || '').toUpperCase(),
    tz: exchange.tz,
    hoursTemplate: exchange.hoursTemplate || undefined,
    weather: weather ?? null,
  };
}

// ============================================================================
// Legacy Adapter Functions (deprecated, kept for backward compatibility)
// ============================================================================

/**
 * @deprecated Use `toCardData` instead.
 * Convert Exchange to ExchangeCardData.
 */
export function fromUiExchange(
  exchange: Exchange,
  weather?: ExchangeWeatherData | null
): ExchangeCardData {
  return toCardData(exchange, weather);
}

/**
 * @deprecated Use `toCardData` instead.
 * Convert Exchange to ExchangeCardData.
 */
export function fromOrderExchange(
  exchange: Exchange,
  weather?: ExchangeWeatherData | null
): ExchangeCardData {
  return toCardData(exchange, weather);
}

/**
 * @deprecated Use `toCardData` instead.
 * Convert raw catalog entry to ExchangeCardData.
 */
export function fromCatalogEntry(
  entry: Record<string, unknown>,
  weather?: ExchangeWeatherData | null
): ExchangeCardData {
  return {
    id: String(entry.id ?? ''),
    name: String(entry.exchange ?? entry.name ?? entry.id ?? ''),
    city: String(entry.city ?? ''),
    countryCode: String(entry.iso2 ?? entry.countryCode ?? '').toUpperCase(),
    tz: String(entry.tz ?? ''),
    hoursTemplate:
      typeof entry.hoursTemplate === 'string' ? entry.hoursTemplate : undefined,
    weather: weather ?? null,
  };
}
