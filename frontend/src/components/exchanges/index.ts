// frontend/src/components/exchanges/index.ts
// ============================================================================
// EXCHANGE COMPONENTS - Barrel Export
// ============================================================================
// UPDATED: Added IndexQuoteData export for index row on cards.
//
// Existing features preserved: Yes
// ============================================================================

// Main card component
export { ExchangeCard, default } from './exchange-card';

// Types
export type {
  ExchangeCardData,
  ExchangeCardProps,
  ExchangeWeatherData,
  IndexQuoteData,
  MarketStatus,
} from './types';

// Time components
export { ExchangeClock } from './time/exchange-clock';
export type { ExchangeClockProps } from './time/exchange-clock';
export { AnalogClock } from './time/analog-clock';
export type { AnalogClockProps } from './time/analog-clock';
export { LedClock } from './time/led-clock';
export type { LedClockProps } from './time/led-clock';
export { MarketStatusIndicator } from './time/market-status';
export type { MarketStatusProps } from './time/market-status';

// Weather components
export { ExchangeTemp } from './weather/exchange-temp';
export type { ExchangeTempProps } from './weather/exchange-temp';
export { ExchangeCondition } from './weather/exchange-condition';
export type { ExchangeConditionProps } from './weather/exchange-condition';
