// src/components/market-pulse/market-pulse-provider.tsx
// ============================================================================
// MARKET PULSE PROVIDER - Context provider for market pulse feature
// ============================================================================
// Wraps the homepage and provides refs + state for the pulse overlay.
// NOTE: The overlay is driven by useMarketPulse (Market Pulse v2.0).
// ============================================================================

'use client';

import React, {
  createContext,
  useContext,
  useRef,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import type { Exchange } from '@/data/exchanges/types';
import { useMarketPulse } from '@/hooks/use-market-pulse';
import { MarketPulseOverlay } from './market-pulse-overlay';

// ============================================================================
// Context Types
// ============================================================================

export type MarketPulseContextValue = {
  /** Ref for the left rail scroll container */
  leftRailRef: React.RefObject<HTMLDivElement>;
  /** Ref for the right rail scroll container */
  rightRailRef: React.RefObject<HTMLDivElement>;
  /** Ref for the providers table scroll container */
  providersRef: React.RefObject<HTMLDivElement>;
  /** Ref for the main container */
  containerRef: React.RefObject<HTMLDivElement>;
  /** Register a provider ID as visible */
  registerProvider: (providerId: string) => void;
  /** Unregister a provider ID */
  unregisterProvider: (providerId: string) => void;
  /**
   * Trigger a manual pulse (kept for backwards compatibility; currently a no-op).
   * The overlay is driven by time-based transitions via useMarketPulse.
   */
  triggerPulse: (exchangeId: string, transition: 'opening' | 'closing') => void;
};

const MarketPulseContext = createContext<MarketPulseContextValue | null>(null);

// ============================================================================
// Hook to consume context
// ============================================================================

export function useMarketPulseContext(): MarketPulseContextValue {
  const context = useContext(MarketPulseContext);
  if (!context) {
    throw new Error('useMarketPulseContext must be used within MarketPulseProvider');
  }
  return context;
}

// ============================================================================
// Provider Props
// ============================================================================

export type MarketPulseProviderProps = {
  children: ReactNode;
  /** All exchanges (for both rails) */
  exchanges: ReadonlyArray<Exchange>;
  /** Exchange IDs currently displayed (selected) */
  selectedExchangeIds: string[];
};

// ============================================================================
// Provider Component
// ============================================================================

export function MarketPulseProvider({
  children,
  exchanges,
  selectedExchangeIds,
}: MarketPulseProviderProps) {
  const leftRailRef = useRef<HTMLDivElement>(null);
  const rightRailRef = useRef<HTMLDivElement>(null);
  const providersRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [displayedProviderIds, setDisplayedProviderIds] = useState<string[]>([]);

  // Provider registration
  const registerProvider = useCallback((providerId: string) => {
    setDisplayedProviderIds((prev) => {
      if (prev.includes(providerId)) return prev;
      return [...prev, providerId];
    });
  }, []);

  const unregisterProvider = useCallback((providerId: string) => {
    setDisplayedProviderIds((prev) => prev.filter((id) => id !== providerId));
  }, []);

  // Memoize filtered exchanges to prevent infinite re-renders
  // Use stable string key derived from array contents (avoids reference comparison issues)
  const selectedIdsKey = selectedExchangeIds.join(',');
  const filteredExchanges = useMemo(() => {
    const idsSet = new Set(selectedIdsKey.split(',').filter(Boolean));
    return exchanges.filter((e) => idsSet.has(e.id));
  }, [exchanges, selectedIdsKey]);

  // Market Pulse v2.0 hook - detects ±1 min around opens/closes
  const { pulseContexts, activeExchangeIds } = useMarketPulse({
    exchanges: filteredExchanges,
  });

  const triggerPulse = useCallback((_exchangeId: string, _transition: 'opening' | 'closing') => {
    // Intentionally left as no-op: overlay is driven by time-based transitions.
    // Keeping this API avoids breaking older callers.
  }, []);

  const contextValue: MarketPulseContextValue = {
    leftRailRef,
    rightRailRef,
    providersRef,
    containerRef,
    registerProvider,
    unregisterProvider,
    triggerPulse,
  };

  return (
    <MarketPulseContext.Provider value={contextValue}>
      <div ref={containerRef} className="relative h-full w-full">
        {children}

        <MarketPulseOverlay
          containerRef={containerRef}
          leftRailRef={leftRailRef}
          rightRailRef={rightRailRef}
          providersRef={providersRef}
          selectedExchangeIds={selectedExchangeIds}
          displayedProviderIds={displayedProviderIds}
          pulseContexts={pulseContexts}
          activeExchangeIds={activeExchangeIds}
        />
      </div>
    </MarketPulseContext.Provider>
  );
}

export default MarketPulseProvider;
