// @/lib/exchanges.ts
// Back-compat shim around @/lib/markets.
// Older files sometimes import from "exchanges" and expect legacy names.
// This file re-exports the modern APIs and defines safe aliases.

import {
  MarketList,
  MarketSymbols,
  computeMarket,
  getMarkets,
  getMarketById,
} from './markets';
import type { Market, MarketRow } from './markets';

// Modern surfaces
export { MarketList, MarketSymbols, computeMarket, getMarkets, getMarketById };
export type { Market, MarketRow };

// ---------- Legacy aliases (for older imports) ----------
export const MARKETS = MarketList;   // legacy constant
export const EXCHANGES = MarketList; // legacy constant

// Type aliases so "Exchange" codepaths keep compiling
export type Exchange = Market;
export type ExchangeRow = MarketRow;
export type ExchangeId = Market['id'];


