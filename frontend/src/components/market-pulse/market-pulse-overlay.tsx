'use client';

/**
 * Market Pulse Overlay - Option 3+4 Combined
 * 
 * Visual effect showing connections between exchanges and AI providers in the same city.
 * - Option 3: Cards pulse with synchronized glow, indicator dots on edges
 * - Option 4: Glowing balls travel between connected pairs (half speed ~4s crossing)
 * 
 * Triggers during market open/close events (±1 minute window).
 */

import { useEffect, useState, useCallback, useRef, useMemo, type RefObject } from 'react';
import type { ExchangePulseContext } from '@/hooks/use-market-pulse';
import { 
  getConnectionsForExchange, 
  CONTINENT_COLORS,
  type CityConnection 
} from '@/data/city-connections';

// ============================================================================
// Types
// ============================================================================

export type MarketPulseOverlayProps = {
  containerRef: RefObject<HTMLDivElement | null>;
  leftRailRef: RefObject<HTMLDivElement | null>;
  rightRailRef: RefObject<HTMLDivElement | null>;
  providersRef: RefObject<HTMLDivElement | null>;
  selectedExchangeIds: string[];
  displayedProviderIds: string[];
  pulseContexts: Map<string, ExchangePulseContext>;
  activeExchangeIds: string[];
};

interface TravelingDot {
  id: number;
  connectionIndex: number;
  exchangeId: string;
  providerId: string;
  color: string;
  progress: number;
  direction: 1 | -1;
}

interface ConnectionPosition {
  connection: CityConnection;
  color: string;
  exchangeRect: DOMRect | null;
  providerRect: DOMRect | null;
}

// ============================================================================
// Component
// ============================================================================

export function MarketPulseOverlay({
  containerRef: _containerRef,
  leftRailRef: _leftRailRef,
  rightRailRef: _rightRailRef,
  providersRef: _providersRef,
  selectedExchangeIds: _selectedExchangeIds,
  displayedProviderIds: _displayedProviderIds,
  pulseContexts: _pulseContexts,
  activeExchangeIds,
}: MarketPulseOverlayProps) {
  const [dots, setDots] = useState<TravelingDot[]>([]);
  const [positions, setPositions] = useState<ConnectionPosition[]>([]);
  const overlayRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  const spawnIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isActive = activeExchangeIds.length > 0;

  // Stabilize activeExchangeIds to prevent infinite re-renders
  // Only recreate when the actual IDs change, not the array reference
  const stableExchangeIds = useMemo(
    () => activeExchangeIds,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeExchangeIds.join(',')]
  );

  // Build connections list from active exchanges with colors
  const activeConnections = useCallback((): Array<CityConnection & { color: string }> => {
    const connections: Array<CityConnection & { color: string }> = [];
    for (const exchangeId of stableExchangeIds) {
      const exchangeConnections = getConnectionsForExchange(exchangeId);
      for (const conn of exchangeConnections) {
        const color = CONTINENT_COLORS[conn.continent]?.primary ?? '#3b82f6';
        connections.push({ ...conn, color });
      }
    }
    return connections;
  }, [stableExchangeIds]);

  // Update element positions
  const updatePositions = useCallback(() => {
    const connections = activeConnections();
    const newPositions: ConnectionPosition[] = connections.map(conn => {
      const exchangeEl = document.querySelector(`[data-exchange-id="${conn.exchangeId}"]`);
      const providerEl = document.querySelector(`[data-provider-id="${conn.providerId}"]`);
      
      return {
        connection: conn,
        color: conn.color,
        exchangeRect: exchangeEl?.getBoundingClientRect() ?? null,
        providerRect: providerEl?.getBoundingClientRect() ?? null,
      };
    });
    setPositions(newPositions);
  }, [activeConnections]);

  // Apply pulse classes to cards (Option 3: synchronized glow)
  useEffect(() => {
    if (!isActive) return;

    const connections = activeConnections();
    const exchangeIds = new Set(connections.map(c => c.exchangeId));
    const providerIds = new Set(connections.map(c => c.providerId));

    // Add pulse class to exchange cards
    exchangeIds.forEach(id => {
      const el = document.querySelector(`[data-exchange-id="${id}"]`);
      if (el) {
        el.classList.add('market-pulse-active');
        const conn = connections.find(c => c.exchangeId === id);
        if (conn) {
          (el as HTMLElement).style.setProperty('--pulse-color', conn.color);
        }
      }
    });

    // Add pulse class to provider rows
    providerIds.forEach(id => {
      const el = document.querySelector(`[data-provider-id="${id}"]`);
      if (el) {
        el.classList.add('market-pulse-active');
        const conn = connections.find(c => c.providerId === id);
        if (conn) {
          (el as HTMLElement).style.setProperty('--pulse-color', conn.color);
        }
      }
    });

    return () => {
      // Remove classes on cleanup
      exchangeIds.forEach(id => {
        const el = document.querySelector(`[data-exchange-id="${id}"]`);
        el?.classList.remove('market-pulse-active');
      });
      providerIds.forEach(id => {
        const el = document.querySelector(`[data-provider-id="${id}"]`);
        el?.classList.remove('market-pulse-active');
      });
    };
  }, [isActive, activeConnections]);

  // Spawn new dots (Option 4: traveling balls)
  useEffect(() => {
    if (!isActive) {
      setDots([]);
      if (spawnIntervalRef.current) {
        clearInterval(spawnIntervalRef.current);
        spawnIntervalRef.current = null;
      }
      return;
    }

    const connections = activeConnections();
    if (connections.length === 0) return;

    spawnIntervalRef.current = setInterval(() => {
      const connectionIndex = Math.floor(Math.random() * connections.length);
      const conn = connections[connectionIndex];
      if (!conn) return;
      
      const reverse = Math.random() > 0.5;
      
      setDots(prev => [...prev.slice(-20), {
        id: Date.now() + Math.random(),
        connectionIndex,
        exchangeId: conn.exchangeId,
        providerId: conn.providerId,
        color: conn.color,
        progress: reverse ? 1 : 0,
        direction: reverse ? -1 : 1,
      }]);
    }, 400);

    return () => {
      if (spawnIntervalRef.current) {
        clearInterval(spawnIntervalRef.current);
        spawnIntervalRef.current = null;
      }
    };
  }, [isActive, activeConnections]);

  // Animate dots - half speed (0.0125 per frame = ~4s crossing)
  useEffect(() => {
    if (!isActive) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      return;
    }

    let lastTime = performance.now();
    
    const animate = (currentTime: number) => {
      const deltaTime = currentTime - lastTime;
      
      // Update every ~20ms for smooth animation
      if (deltaTime >= 20) {
        lastTime = currentTime;
        setDots(prev => prev
          .map(d => ({ ...d, progress: d.progress + (d.direction * 0.0125) }))
          .filter(d => d.progress >= 0 && d.progress <= 1)
        );
        updatePositions();
      }
      
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [isActive, updatePositions]);

  // Update positions on scroll/resize
  useEffect(() => {
    if (!isActive) return;

    const handleUpdate = () => updatePositions();
    
    window.addEventListener('scroll', handleUpdate, { passive: true });
    window.addEventListener('resize', handleUpdate, { passive: true });
    
    // Initial position update
    updatePositions();

    return () => {
      window.removeEventListener('scroll', handleUpdate);
      window.removeEventListener('resize', handleUpdate);
    };
  }, [isActive, updatePositions]);

  if (!isActive) return null;

  return (
    <div 
      ref={overlayRef}
      className="fixed inset-0 pointer-events-none z-50"
      aria-hidden="true"
    >
      {/* Render traveling dots */}
      {dots.map(dot => {
        const posData = positions.find(p => 
          p.connection.exchangeId === dot.exchangeId && 
          p.connection.providerId === dot.providerId
        );
        
        if (!posData?.exchangeRect || !posData?.providerRect) return null;

        // Calculate start and end positions
        const startX = posData.exchangeRect.right;
        const startY = posData.exchangeRect.top + posData.exchangeRect.height / 2;
        const endX = posData.providerRect.left;
        const endY = posData.providerRect.top + posData.providerRect.height / 2;

        // Interpolate position
        const x = startX + (endX - startX) * dot.progress;
        const y = startY + (endY - startY) * dot.progress;

        // Fade in/out at edges
        const opacity = dot.progress < 0.08 ? dot.progress / 0.08 : 
                       dot.progress > 0.92 ? (1 - dot.progress) / 0.08 : 1;

        return (
          <div
            key={dot.id}
            className="absolute"
            style={{
              left: x,
              top: y,
              transform: 'translate(-50%, -50%)',
              opacity,
            }}
          >
            {/* Outer glow */}
            <div 
              className="absolute -inset-4 rounded-full"
              style={{
                background: `radial-gradient(circle, ${dot.color}60 0%, transparent 70%)`,
              }}
            />
            {/* Trail */}
            <div
              className="absolute top-1/2 -translate-y-1/2 h-2 rounded-full"
              style={{
                width: 30,
                left: dot.direction > 0 ? -28 : 6,
                background: `linear-gradient(${dot.direction > 0 ? '90deg' : '270deg'}, transparent, ${dot.color})`,
              }}
            />
            {/* Ball core */}
            <div 
              className="w-4 h-4 rounded-full"
              style={{
                backgroundColor: dot.color,
                boxShadow: `0 0 8px ${dot.color}, 0 0 16px ${dot.color}`,
              }}
            />
            {/* White hot center */}
            <div 
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white"
              style={{ opacity: 0.8 }}
            />
          </div>
        );
      })}
    </div>
  );
}

export default MarketPulseOverlay;
