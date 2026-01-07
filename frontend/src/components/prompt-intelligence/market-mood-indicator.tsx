// src/components/prompt-intelligence/market-mood-indicator.tsx
// ============================================================================
// MARKET MOOD INDICATOR COMPONENT
// ============================================================================
// Visual indicator for current market mood state.
// ============================================================================

'use client';

import {
  Activity,
  Sun,
  Moon,
  Zap,
  DollarSign,
  Coins,
  Gem,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MarketState } from '@/lib/prompt-intelligence/types';
import { Badge } from '@/components/ui/badge';
import { Tooltip } from '@/components/ui/tooltip';

// ============================================================================
// Types
// ============================================================================

export interface MarketMoodIndicatorProps {
  /** Market state */
  state: MarketState | null;
  
  /** Whether market mood is active (sufficient intensity) */
  isActive: boolean;
  
  /** Description text */
  description?: string | null;
  
  /** Theme colors */
  theme?: {
    primary: string;
    secondary: string;
    accent: string;
  } | null;
  
  /** Custom class name */
  className?: string;
  
  /** Display variant */
  variant?: 'badge' | 'pill' | 'icon';
  
  /** Whether to show pulse animation */
  showPulse?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const MOOD_ICONS: Record<string, React.ElementType> = {
  'market_opening': Sun,
  'market_closing': Moon,
  'high_volatility': Activity,
  'low_volatility': Activity,
  'currency_strength_usd': DollarSign,
  'currency_strength_gbp': DollarSign,
  'currency_strength_eur': DollarSign,
  'gold_rising': Gem,
  'gold_falling': Gem,
  'crypto_pumping': Coins,
  'neutral': Zap,
};

const MOOD_LABELS: Record<string, string> = {
  'market_opening': 'Opening',
  'market_closing': 'Closing',
  'high_volatility': 'Volatile',
  'low_volatility': 'Calm',
  'currency_strength_usd': 'USD ↑',
  'currency_strength_gbp': 'GBP ↑',
  'currency_strength_eur': 'EUR ↑',
  'gold_rising': 'Gold ↑',
  'gold_falling': 'Gold ↓',
  'crypto_pumping': 'Crypto ↑',
  'neutral': 'Neutral',
};

// ============================================================================
// Helper Functions
// ============================================================================

function buildTooltipText(state: MarketState, description: string | null | undefined): string {
  const label = MOOD_LABELS[state.type] ?? state.type;
  const intensity = Math.round(state.intensity * 100);
  return `${description || label} | Intensity: ${intensity}% | Suggestions influenced by market conditions`;
}

// ============================================================================
// Component
// ============================================================================

export function MarketMoodIndicator({
  state,
  isActive,
  description,
  theme,
  className,
  variant = 'badge',
  showPulse = true,
}: MarketMoodIndicatorProps) {
  if (!state || !isActive) {
    return null;
  }
  
  const Icon = MOOD_ICONS[state.type] ?? Zap;
  const label = MOOD_LABELS[state.type] ?? state.type;
  const tooltipText = buildTooltipText(state, description);
  
  // Determine colors
  const accentStyle = theme?.accent
    ? { borderColor: theme.accent, color: theme.accent }
    : {};
  
  // Icon variant
  if (variant === 'icon') {
    return (
      <Tooltip text={tooltipText}>
        <div className={cn('relative cursor-help', className)}>
          <Icon
            className="h-4 w-4"
            style={theme?.accent ? { color: theme.accent } : {}}
          />
          {showPulse && (
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          )}
        </div>
      </Tooltip>
    );
  }
  
  // Pill variant
  if (variant === 'pill') {
    return (
      <Tooltip text={tooltipText}>
        <div
          className={cn(
            'flex items-center gap-1.5 px-2 py-0.5 rounded-full',
            'bg-muted/50 text-xs cursor-help',
            className
          )}
          style={accentStyle}
        >
          <Icon className="h-3 w-3" />
          <span>{label}</span>
          {showPulse && (
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          )}
        </div>
      </Tooltip>
    );
  }
  
  // Badge variant (default)
  return (
    <Tooltip text={tooltipText}>
      <Badge
        variant="outline"
        className={cn('gap-1 cursor-help', className)}
        style={accentStyle}
      >
        <Icon className="h-3 w-3" />
        {label}
        {showPulse && (
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
        )}
      </Badge>
    </Tooltip>
  );
}

export default MarketMoodIndicator;
