// src/lib/prompt-intelligence/engines/market-mood-engine.ts
// ============================================================================
// MARKET MOOD ENGINE
// ============================================================================
// Connects live market data to prompt suggestions.
// Authority: docs/authority/prompt-intelligence.md
// ============================================================================

import type { PromptCategory } from '@/types/prompt-builder';
import type { 
  MarketState, 
  MarketStateType,
  SuggestedOption,
} from '../types';
import { getMarketMood, getMarketMoods, getSemanticTags } from '../index';

// ============================================================================
// Types
// ============================================================================

/**
 * FX pair data for market state detection.
 */
export interface FXPairData {
  /** Currency pair (e.g., 'EUR/USD') */
  pair: string;
  
  /** Current rate */
  rate: number;
  
  /** Previous close rate */
  previousClose: number;
  
  /** Percentage change */
  changePercent: number;
}

/**
 * Exchange data for market state detection.
 */
export interface ExchangeData {
  /** Exchange ID (e.g., 'NYSE', 'LSE') */
  exchangeId: string;
  
  /** Whether market is currently open */
  isOpen: boolean;
  
  /** Time until open/close in minutes (negative if past) */
  minutesUntilTransition?: number;
  
  /** Optional volatility index */
  volatilityIndex?: number;
}

/**
 * Commodity data for market state detection.
 */
export interface CommodityData {
  /** Commodity symbol (e.g., 'XAU', 'XAG') */
  symbol: string;
  
  /** Current price */
  price: number;
  
  /** Previous close */
  previousClose: number;
  
  /** Percentage change */
  changePercent: number;
}

/**
 * Crypto data for market state detection.
 */
export interface CryptoData {
  /** Symbol (e.g., 'BTC', 'ETH') */
  symbol: string;
  
  /** Current price */
  price: number;
  
  /** 24h change percent */
  change24hPercent: number;
  
  /** 24h volume */
  volume24h?: number;
}

/**
 * Combined market data input.
 */
export interface MarketDataInput {
  /** FX pairs data */
  fxPairs?: FXPairData[];
  
  /** Exchange data */
  exchanges?: ExchangeData[];
  
  /** Commodity data */
  commodities?: CommodityData[];
  
  /** Crypto data */
  crypto?: CryptoData[];
  
  /** Current timestamp */
  timestamp?: Date;
}

/**
 * Result of market state detection.
 */
export interface MarketStateResult {
  /** Primary detected state */
  state: MarketState;
  
  /** Secondary states (if multiple conditions met) */
  secondaryStates: MarketState[];
  
  /** Confidence level (0-1) */
  confidence: number;
  
  /** Human-readable description */
  description: string;
  
  /** Whether any market is currently open */
  anyMarketOpen: boolean;
}

/**
 * Result of applying market mood boosts.
 */
export interface MarketMoodBoostResult {
  /** Boosted options by category */
  boostedOptions: Partial<Record<PromptCategory, string[]>>;
  
  /** The market state used */
  marketState: MarketState;
  
  /** Total number of boosted options */
  totalBoosted: number;
}

// ============================================================================
// Thresholds (configurable)
// ============================================================================

const THRESHOLDS = {
  /** High volatility threshold (% change) */
  highVolatility: 1.5,
  
  /** Low volatility threshold (% change) */
  lowVolatility: 0.2,
  
  /** Strong currency move threshold (%) */
  currencyStrength: 0.5,
  
  /** Gold significant move threshold (%) */
  goldMove: 0.8,
  
  /** Crypto pump threshold (%) */
  cryptoPump: 5.0,
  
  /** Minutes before/after market open/close to trigger */
  transitionWindow: 30,
};

// ============================================================================
// Detection Helpers
// ============================================================================

/**
 * Calculate average absolute change across FX pairs.
 */
function calculateFXVolatility(pairs: FXPairData[]): number {
  if (pairs.length === 0) return 0;
  
  const totalChange = pairs.reduce((sum, p) => sum + Math.abs(p.changePercent), 0);
  return totalChange / pairs.length;
}

/**
 * Find the strongest currency move.
 */
function findStrongestCurrency(pairs: FXPairData[]): { currency: string; strength: number } | null {
  if (pairs.length === 0) return null;
  
  const currencyStrength: Record<string, number> = {};
  
  for (const pair of pairs) {
    const [base, quote] = pair.pair.split('/');
    if (!base || !quote) continue;
    
    // Positive change = base currency stronger
    currencyStrength[base] = (currencyStrength[base] || 0) + pair.changePercent;
    currencyStrength[quote] = (currencyStrength[quote] || 0) - pair.changePercent;
  }
  
  let strongest: string | null = null;
  let maxStrength = 0;
  
  for (const [currency, strength] of Object.entries(currencyStrength)) {
    if (Math.abs(strength) > Math.abs(maxStrength)) {
      maxStrength = strength;
      strongest = currency;
    }
  }
  
  return strongest ? { currency: strongest, strength: maxStrength } : null;
}

/**
 * Check for market opening/closing conditions.
 */
function checkMarketTransition(exchanges: ExchangeData[]): { type: 'opening' | 'closing'; exchangeId: string } | null {
  for (const exchange of exchanges) {
    const minutes = exchange.minutesUntilTransition ?? 999;
    
    if (Math.abs(minutes) <= THRESHOLDS.transitionWindow) {
      if (!exchange.isOpen && minutes > 0) {
        return { type: 'opening', exchangeId: exchange.exchangeId };
      }
      if (exchange.isOpen && minutes > 0) {
        return { type: 'closing', exchangeId: exchange.exchangeId };
      }
    }
  }
  
  return null;
}

/**
 * Check gold price movement.
 */
function checkGoldMove(commodities: CommodityData[]): 'rising' | 'falling' | null {
  const gold = commodities.find(c => c.symbol === 'XAU' || c.symbol === 'GOLD');
  if (!gold) return null;
  
  if (gold.changePercent >= THRESHOLDS.goldMove) return 'rising';
  if (gold.changePercent <= -THRESHOLDS.goldMove) return 'falling';
  
  return null;
}

/**
 * Check crypto pump conditions.
 */
function checkCryptoPump(crypto: CryptoData[]): boolean {
  if (crypto.length === 0) return false;
  
  // Check if major cryptos are pumping
  const majorCryptos = crypto.filter(c => 
    ['BTC', 'ETH', 'SOL', 'BNB'].includes(c.symbol)
  );
  
  if (majorCryptos.length === 0) return false;
  
  const avgChange = majorCryptos.reduce((sum, c) => sum + c.change24hPercent, 0) / majorCryptos.length;
  return avgChange >= THRESHOLDS.cryptoPump;
}

// ============================================================================
// State Detection
// ============================================================================

/**
 * Detect the current market state from market data.
 * 
 * @example
 * ```ts
 * const result = detectMarketState({
 *   fxPairs: [
 *     { pair: 'EUR/USD', rate: 1.0850, previousClose: 1.0800, changePercent: 0.46 },
 *     { pair: 'GBP/USD', rate: 1.2700, previousClose: 1.2650, changePercent: 0.40 },
 *   ],
 *   exchanges: [
 *     { exchangeId: 'NYSE', isOpen: true, minutesUntilTransition: 120 },
 *   ],
 * });
 * 
 * console.log(result.state.type); // 'neutral' or detected state
 * ```
 */
export function detectMarketState(input: MarketDataInput): MarketStateResult {
  const { 
    fxPairs = [], 
    exchanges = [], 
    commodities = [], 
    crypto = [] 
  } = input;
  
  const detectedStates: MarketState[] = [];
  
  // Check market transitions first (highest priority)
  const transition = checkMarketTransition(exchanges);
  if (transition) {
    detectedStates.push({
      type: transition.type === 'opening' ? 'market_opening' : 'market_closing',
      intensity: 1.0,
      exchangeId: transition.exchangeId,
      isMarketOpen: exchanges.some(e => e.isOpen),
    });
  }
  
  // Check FX volatility
  const fxVolatility = calculateFXVolatility(fxPairs);
  if (fxVolatility >= THRESHOLDS.highVolatility) {
    detectedStates.push({
      type: 'high_volatility',
      intensity: Math.min(1.0, fxVolatility / 3),
      isMarketOpen: exchanges.some(e => e.isOpen),
    });
  } else if (fxVolatility <= THRESHOLDS.lowVolatility && fxPairs.length > 0) {
    detectedStates.push({
      type: 'low_volatility',
      intensity: 1 - (fxVolatility / THRESHOLDS.lowVolatility),
      isMarketOpen: exchanges.some(e => e.isOpen),
    });
  }
  
  // Check currency strength
  const strongestCurrency = findStrongestCurrency(fxPairs);
  if (strongestCurrency && Math.abs(strongestCurrency.strength) >= THRESHOLDS.currencyStrength) {
    const currencyMap: Record<string, MarketStateType> = {
      'USD': 'currency_strength_usd',
      'GBP': 'currency_strength_gbp',
      'EUR': 'currency_strength_eur',
    };
    
    const stateType = currencyMap[strongestCurrency.currency];
    if (stateType) {
      detectedStates.push({
        type: stateType,
        intensity: Math.min(1.0, Math.abs(strongestCurrency.strength) / 2),
        isMarketOpen: exchanges.some(e => e.isOpen),
      });
    }
  }
  
  // Check gold movement
  const goldMove = checkGoldMove(commodities);
  if (goldMove) {
    detectedStates.push({
      type: goldMove === 'rising' ? 'gold_rising' : 'gold_falling',
      intensity: 0.8,
      isMarketOpen: exchanges.some(e => e.isOpen),
    });
  }
  
  // Check crypto pump
  if (checkCryptoPump(crypto)) {
    detectedStates.push({
      type: 'crypto_pumping',
      intensity: 0.9,
      isMarketOpen: true, // Crypto is always open
    });
  }
  
  // Determine primary state
  const anyMarketOpen = exchanges.some(e => e.isOpen) || crypto.length > 0;
  
  if (detectedStates.length === 0) {
    return {
      state: {
        type: 'neutral',
        intensity: 1.0,
        isMarketOpen: anyMarketOpen,
      },
      secondaryStates: [],
      confidence: 1.0,
      description: anyMarketOpen ? 'Markets are calm' : 'Markets are closed',
      anyMarketOpen,
    };
  }
  
  // Sort by intensity (highest first)
  detectedStates.sort((a, b) => b.intensity - a.intensity);
  
  const primaryState = detectedStates[0]!;
  const secondaryStates = detectedStates.slice(1);
  
  // Generate description
  const descriptions: Record<MarketStateType, string> = {
    'market_opening': `Market opening at ${primaryState.exchangeId || 'exchange'}`,
    'market_closing': `Market closing at ${primaryState.exchangeId || 'exchange'}`,
    'high_volatility': 'High market volatility detected',
    'low_volatility': 'Low market volatility - calm conditions',
    'currency_strength_usd': 'US Dollar showing strength',
    'currency_strength_gbp': 'British Pound showing strength',
    'currency_strength_eur': 'Euro showing strength',
    'gold_rising': 'Gold prices rising',
    'gold_falling': 'Gold prices falling',
    'crypto_pumping': 'Crypto markets pumping',
    'neutral': 'Normal market conditions',
  };
  
  return {
    state: primaryState,
    secondaryStates,
    confidence: primaryState.intensity,
    description: descriptions[primaryState.type],
    anyMarketOpen,
  };
}

// ============================================================================
// Mood Boost Application
// ============================================================================

/**
 * Get all options that should be boosted for a market state.
 * 
 * @example
 * ```ts
 * const result = applyMarketMoodBoosts({
 *   type: 'high_volatility',
 *   intensity: 0.8,
 *   isMarketOpen: true,
 * });
 * 
 * console.log(result.boostedOptions.atmosphere);
 * // ['chaotic', 'dynamic', 'turbulent', ...]
 * ```
 */
export function applyMarketMoodBoosts(marketState: MarketState): MarketMoodBoostResult {
  const moodConfig = getMarketMood(marketState.type);
  
  if (!moodConfig) {
    return {
      boostedOptions: {},
      marketState,
      totalBoosted: 0,
    };
  }
  
  const boostedOptions: Partial<Record<PromptCategory, string[]>> = {};
  let totalBoosted = 0;
  
  // Copy boosted options from config
  for (const [category, options] of Object.entries(moodConfig.boost)) {
    if (options && options.length > 0) {
      boostedOptions[category as PromptCategory] = [...options];
      totalBoosted += options.length;
    }
  }
  
  return {
    boostedOptions,
    marketState,
    totalBoosted,
  };
}

/**
 * Get market mood suggestions - options that match the current market state.
 * These can be shown as "trending" or "market inspired" options.
 * 
 * @example
 * ```ts
 * const suggestions = getMarketMoodSuggestions({
 *   type: 'gold_rising',
 *   intensity: 0.9,
 *   isMarketOpen: true,
 * }, { maxPerCategory: 3 });
 * 
 * // Returns options like 'golden tones', 'luxury', 'opulent'
 * ```
 */
export function getMarketMoodSuggestions(
  marketState: MarketState,
  options: { maxPerCategory?: number } = {}
): SuggestedOption[] {
  const { maxPerCategory = 5 } = options;
  
  const boostResult = applyMarketMoodBoosts(marketState);
  const semanticTags = getSemanticTags();
  const suggestions: SuggestedOption[] = [];
  
  const marketMoods = getMarketMoods();
  const moodConfig = marketMoods.moods[marketState.type];
  const trigger = moodConfig?.trigger || marketState.type;
  
  for (const [category, boostTerms] of Object.entries(boostResult.boostedOptions)) {
    let categoryCount = 0;
    
    for (const boostTerm of boostTerms) {
      if (categoryCount >= maxPerCategory) break;
      
      // Find matching options in semantic tags
      for (const [option, tag] of Object.entries(semanticTags.options)) {
        if (tag.category !== category) continue;
        
        // Check if option matches boost term
        const optionLower = option.toLowerCase();
        const boostLower = boostTerm.toLowerCase();
        
        if (optionLower.includes(boostLower) || boostLower.includes(optionLower)) {
          suggestions.push({
            option,
            category: category as PromptCategory,
            score: Math.round(50 + (50 * marketState.intensity)),
            reason: `Market mood: ${trigger}`,
            isMarketBoosted: true,
          });
          categoryCount++;
          break; // Only one match per boost term
        }
      }
    }
  }
  
  // Sort by score
  suggestions.sort((a, b) => b.score - a.score);
  
  return suggestions;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a market state warrants showing market mood UI.
 */
export function shouldShowMarketMood(state: MarketState): boolean {
  // Don't show for neutral state
  if (state.type === 'neutral') return false;
  
  // Show if intensity is above threshold
  return state.intensity >= 0.5;
}

/**
 * Get a color theme for the market state (for UI theming).
 */
export function getMarketMoodTheme(stateType: MarketStateType): {
  primary: string;
  secondary: string;
  accent: string;
} {
  const themes: Record<MarketStateType, { primary: string; secondary: string; accent: string }> = {
    'market_opening': { primary: '#22c55e', secondary: '#16a34a', accent: '#86efac' },
    'market_closing': { primary: '#f97316', secondary: '#ea580c', accent: '#fdba74' },
    'high_volatility': { primary: '#ef4444', secondary: '#dc2626', accent: '#fca5a5' },
    'low_volatility': { primary: '#3b82f6', secondary: '#2563eb', accent: '#93c5fd' },
    'currency_strength_usd': { primary: '#22c55e', secondary: '#16a34a', accent: '#86efac' },
    'currency_strength_gbp': { primary: '#a855f7', secondary: '#9333ea', accent: '#d8b4fe' },
    'currency_strength_eur': { primary: '#3b82f6', secondary: '#2563eb', accent: '#93c5fd' },
    'gold_rising': { primary: '#eab308', secondary: '#ca8a04', accent: '#fde047' },
    'gold_falling': { primary: '#78716c', secondary: '#57534e', accent: '#a8a29e' },
    'crypto_pumping': { primary: '#f97316', secondary: '#ea580c', accent: '#fdba74' },
    'neutral': { primary: '#6b7280', secondary: '#4b5563', accent: '#9ca3af' },
  };
  
  return themes[stateType] || themes.neutral;
}

/**
 * Get an icon name for the market state (for UI).
 */
export function getMarketMoodIcon(stateType: MarketStateType): string {
  const icons: Record<MarketStateType, string> = {
    'market_opening': 'sunrise',
    'market_closing': 'sunset',
    'high_volatility': 'activity',
    'low_volatility': 'minus-circle',
    'currency_strength_usd': 'dollar-sign',
    'currency_strength_gbp': 'pound-sterling',
    'currency_strength_eur': 'euro',
    'gold_rising': 'trending-up',
    'gold_falling': 'trending-down',
    'crypto_pumping': 'zap',
    'neutral': 'circle',
  };
  
  return icons[stateType] || 'circle';
}
