// src/components/prompt-intelligence/market-mood-toggle.tsx
// ============================================================================
// MARKET MOOD TOGGLE
// ============================================================================
// Toggle component for enabling/disabling market-influenced suggestions.
// Authority: docs/authority/prompt-intelligence.md
// ============================================================================

'use client';

import React, { useCallback, useMemo, useState } from 'react';
import type { MarketState, MarketStateType } from '@/lib/prompt-intelligence/types';

// ============================================================================
// Types
// ============================================================================

export interface MarketMoodToggleProps {
  /** Whether market mood is enabled */
  isEnabled: boolean;
  /** Callback when toggled */
  onToggle: (enabled: boolean) => void;
  /** Current market state (if available) */
  marketState?: MarketState | null;
  /** Whether the toggle is disabled */
  disabled?: boolean;
  /** Whether to show compact version */
  compact?: boolean;
  /** Custom class name */
  className?: string;
}

// ============================================================================
// Market State Icons (keyed by MarketStateType)
// ============================================================================

const MARKET_ICONS: Record<MarketStateType, React.ReactNode> = {
  high_volatility: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  low_volatility: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="10" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" strokeLinecap="round" />
      <line x1="9" y1="9" x2="9.01" y2="9" strokeLinecap="round" />
      <line x1="15" y1="9" x2="15.01" y2="9" strokeLinecap="round" />
    </svg>
  ),
  market_opening: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12,6 12,12 16,14" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  market_closing: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12,6 12,12 8,14" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  currency_strength_usd: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  currency_strength_gbp: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M18 5H9.5a3.5 3.5 0 0 0-3 5.5M6 19h12M9 12h6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  currency_strength_eur: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M17.2 7A7.5 7.5 0 0 0 5 12a7.5 7.5 0 0 0 12.2 5M4 10h10M4 14h10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  gold_rising: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <polyline points="23,6 13.5,15.5 8.5,10.5 1,18" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="17,6 23,6 23,12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  gold_falling: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <polyline points="23,18 13.5,8.5 8.5,13.5 1,6" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="17,18 23,18 23,12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  crypto_pumping: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="8" r="6" />
      <path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  neutral: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <line x1="5" y1="12" x2="19" y2="12" strokeLinecap="round" />
      <circle cx="12" cy="12" r="10" />
    </svg>
  ),
};

// ============================================================================
// Market State Colours (keyed by MarketStateType)
// ============================================================================

const MARKET_COLOURS: Record<MarketStateType, { bg: string; text: string; glow: string }> = {
  high_volatility: {
    bg: 'bg-gradient-to-r from-red-500/20 to-orange-500/20',
    text: 'text-red-400',
    glow: 'shadow-red-500/20',
  },
  low_volatility: {
    bg: 'bg-gradient-to-r from-emerald-500/20 to-teal-500/20',
    text: 'text-emerald-400',
    glow: 'shadow-emerald-500/20',
  },
  market_opening: {
    bg: 'bg-gradient-to-r from-sky-500/20 to-blue-500/20',
    text: 'text-sky-400',
    glow: 'shadow-sky-500/20',
  },
  market_closing: {
    bg: 'bg-gradient-to-r from-indigo-500/20 to-purple-500/20',
    text: 'text-indigo-400',
    glow: 'shadow-indigo-500/20',
  },
  currency_strength_usd: {
    bg: 'bg-gradient-to-r from-green-500/20 to-emerald-500/20',
    text: 'text-green-400',
    glow: 'shadow-green-500/20',
  },
  currency_strength_gbp: {
    bg: 'bg-gradient-to-r from-blue-500/20 to-indigo-500/20',
    text: 'text-blue-400',
    glow: 'shadow-blue-500/20',
  },
  currency_strength_eur: {
    bg: 'bg-gradient-to-r from-blue-500/20 to-cyan-500/20',
    text: 'text-cyan-400',
    glow: 'shadow-cyan-500/20',
  },
  gold_rising: {
    bg: 'bg-gradient-to-r from-amber-500/20 to-yellow-500/20',
    text: 'text-amber-400',
    glow: 'shadow-amber-500/20',
  },
  gold_falling: {
    bg: 'bg-gradient-to-r from-amber-600/20 to-orange-600/20',
    text: 'text-orange-400',
    glow: 'shadow-orange-500/20',
  },
  crypto_pumping: {
    bg: 'bg-gradient-to-r from-purple-500/20 to-pink-500/20',
    text: 'text-purple-400',
    glow: 'shadow-purple-500/20',
  },
  neutral: {
    bg: 'bg-slate-700/50',
    text: 'text-slate-400',
    glow: 'shadow-slate-500/10',
  },
};

const DEFAULT_COLOURS = MARKET_COLOURS.neutral;

// ============================================================================
// Display Name Helpers
// ============================================================================

function getDisplayName(type: MarketStateType): string {
  const names: Record<MarketStateType, string> = {
    high_volatility: 'High Volatility',
    low_volatility: 'Low Volatility',
    market_opening: 'Market Opening',
    market_closing: 'Market Closing',
    currency_strength_usd: 'USD Strong',
    currency_strength_gbp: 'GBP Strong',
    currency_strength_eur: 'EUR Strong',
    gold_rising: 'Gold Rising',
    gold_falling: 'Gold Falling',
    crypto_pumping: 'Crypto Pump',
    neutral: 'Neutral',
  };
  return names[type] ?? 'Market';
}

// ============================================================================
// Component
// ============================================================================

export function MarketMoodToggle({
  isEnabled,
  onToggle,
  marketState,
  disabled = false,
  compact = false,
  className = '',
}: MarketMoodToggleProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  
  const handleToggle = useCallback(() => {
    if (!disabled) {
      onToggle(!isEnabled);
    }
  }, [disabled, isEnabled, onToggle]);
  
  // Get colours based on market state
  const colours = useMemo(() => {
    if (!isEnabled || !marketState) return DEFAULT_COLOURS;
    return MARKET_COLOURS[marketState.type] ?? DEFAULT_COLOURS;
  }, [isEnabled, marketState]);
  
  // Get icon based on market state
  const icon = useMemo(() => {
    if (!isEnabled || !marketState) return MARKET_ICONS.neutral;
    return MARKET_ICONS[marketState.type] ?? MARKET_ICONS.neutral;
  }, [isEnabled, marketState]);
  
  // Generate tooltip content
  const tooltipContent = useMemo(() => {
    if (!isEnabled) {
      return 'Enable Market Mood to get suggestions influenced by live market data';
    }
    if (!marketState) {
      return 'Market Mood active - waiting for market data...';
    }
    return `Market Mood: ${getDisplayName(marketState.type)} (${Math.round(marketState.intensity * 100)}% intensity)`;
  }, [isEnabled, marketState]);
  
  if (compact) {
    return (
      <div className={`relative ${className}`}>
        <button
          type="button"
          onClick={handleToggle}
          disabled={disabled}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          className={`
            flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium
            transition-all duration-200 border
            ${isEnabled 
              ? `${colours.bg} ${colours.text} border-current/20 shadow-lg ${colours.glow}` 
              : 'bg-slate-800/50 text-slate-500 border-slate-700/50 hover:bg-slate-700/50 hover:text-slate-400'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
          aria-label={tooltipContent}
          aria-pressed={isEnabled}
        >
          {icon}
          <span className="hidden sm:inline">
            {isEnabled ? (marketState ? getDisplayName(marketState.type) : 'Active') : 'Market'}
          </span>
          
          {/* Activity indicator */}
          {isEnabled && marketState && marketState.intensity > 0.5 && (
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${colours.text.replace('text-', 'bg-')}`} />
              <span className={`relative inline-flex rounded-full h-2 w-2 ${colours.text.replace('text-', 'bg-')}`} />
            </span>
          )}
        </button>
        
        {/* Tooltip */}
        {showTooltip && (
          <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 text-xs text-white bg-slate-900 rounded-lg shadow-xl border border-white/10 whitespace-nowrap">
            {tooltipContent}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
          </div>
        )}
      </div>
    );
  }
  
  // Full version
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        className={`
          relative flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium
          transition-all duration-200 border
          ${isEnabled 
            ? `${colours.bg} ${colours.text} border-current/20 shadow-lg ${colours.glow}` 
            : 'bg-slate-800/50 text-slate-400 border-slate-700/50 hover:bg-slate-700/50'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
        aria-pressed={isEnabled}
      >
        {/* Icon */}
        <span className={`${isEnabled ? colours.text : 'text-slate-500'}`}>
          {icon}
        </span>
        
        {/* Label */}
        <span>
          {isEnabled ? (
            marketState ? (
              <span className="flex items-center gap-1.5">
                <span>{getDisplayName(marketState.type)}</span>
                <span className="text-xs opacity-60">
                  {Math.round(marketState.intensity * 100)}%
                </span>
              </span>
            ) : (
              'Market Mood Active'
            )
          ) : (
            'Market Mood'
          )}
        </span>
        
        {/* Toggle indicator */}
        <span
          className={`
            relative inline-flex h-5 w-9 items-center rounded-full transition-colors
            ${isEnabled ? colours.text.replace('text-', 'bg-').replace('400', '500/30') : 'bg-slate-600/50'}
          `}
        >
          <span
            className={`
              inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform
              ${isEnabled ? 'translate-x-4' : 'translate-x-0.5'}
            `}
          />
        </span>
      </button>
      
      {/* Market info when active */}
      {isEnabled && marketState && marketState.intensity > 0.3 && (
        <span className="text-xs text-slate-500">
          Suggestions tinted by market
        </span>
      )}
    </div>
  );
}

export default MarketMoodToggle;
