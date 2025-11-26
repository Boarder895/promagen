// frontend/src/lib/fx/index.ts
//
// Public entry point for FX helpers used by the finance ribbon and
// any future mini widgets or prompt-builder widgets.
//
// This keeps the rest of the app away from the internal module layout;
// everything should come from here rather than reaching into files under
// src/lib/fx directly.

import { getFxRibbonQuotes, type FxRibbonQuote } from './ribbon-source';
import { getWinningCurrency, type WinningCurrencyResult, type WinningSide } from './calculate';

export type FxQuote = FxRibbonQuote;

export { getFxRibbonQuotes, getWinningCurrency };
export type { WinningCurrencyResult, WinningSide };
