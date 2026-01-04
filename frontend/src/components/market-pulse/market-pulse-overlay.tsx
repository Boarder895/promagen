// src/components/market-pulse/market-pulse-overlay.tsx
// ============================================================================
// MARKET PULSE OVERLAY v2.0 - Flowing Energy Stream
// ============================================================================
// "The bridge comes alive when markets move."
//
// Features:
// - Dormant state: Nothing visible (clean interface)
// - Pre-open/close: Curves fade in, slow particles begin flowing
// - Opening/Closing: BURST of particles, curve blazes, row flashes
// - Multi-session support: Fires on ALL opens/closes (lunch breaks too)
// - Continent-specific colors
// ============================================================================

'use client';

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import {
  CITY_CONNECTIONS,
  CONTINENT_COLORS,
  type CityConnection,
} from '@/data/city-connections';
import type { ExchangePulseContext } from '@/hooks/use-market-pulse';

// ============================================================================
// Types
// ============================================================================

type Point = { x: number; y: number };

type ConnectionPath = {
  connection: CityConnection;
  startPoint: Point;
  endPoint: Point;
  pathD: string;
  pathLength: number;
};

type Particle = {
  id: string;
  connectionKey: string;
  progress: number; // 0-1 along the path
  speed: number; // Progress per frame
  size: number;
  opacity: number;
  reverse: boolean; // True for closing (provider → exchange)
};

export type MarketPulseOverlayProps = {
  /** Ref to the container element for position calculations */
  containerRef: React.RefObject<HTMLElement>;
  /** Ref to the left rail element */
  leftRailRef: React.RefObject<HTMLElement>;
  /** Ref to the right rail element */
  rightRailRef: React.RefObject<HTMLElement>;
  /** Ref to the providers table element */
  providersRef: React.RefObject<HTMLElement>;
  /** Currently selected exchange IDs */
  selectedExchangeIds: string[];
  /** Currently displayed provider IDs */
  displayedProviderIds: string[];
  /** Pulse contexts from useMarketPulse hook */
  pulseContexts: Map<string, ExchangePulseContext>;
  /** Active exchange IDs (not dormant) */
  activeExchangeIds: string[];
};

// ============================================================================
// Constants
// ============================================================================

// Particle settings
const IDLE_PARTICLE_INTERVAL = 2000; // One particle every 2 seconds in pre-* states
const BURST_PARTICLE_COUNT = 10; // Particles released during burst
const BURST_PARTICLE_STAGGER = 80; // ms between burst particles

// Particle sizes
const PARTICLE_SIZE_IDLE = 4;
const PARTICLE_SIZE_BURST = 8;

// Particle speeds (progress per ms)
const PARTICLE_SPEED_IDLE = 0.0003; // ~3.3 seconds to traverse
const PARTICLE_SPEED_BURST = 0.001; // ~1 second to traverse

// Line settings
const LINE_WIDTH_IDLE = 2;
const LINE_WIDTH_ACTIVE = 3;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate a smooth bezier curve path between two points.
 */
function generateBezierPath(start: Point, end: Point): string {
  const midX = (start.x + end.x) / 2;
  const cp1x = midX;
  const cp1y = start.y;
  const cp2x = midX;
  const cp2y = end.y;
  return `M ${start.x} ${start.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${end.x} ${end.y}`;
}

/**
 * Get approximate path length for a bezier curve
 */
function approximatePathLength(start: Point, end: Point): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  // Bezier is longer than straight line, approximate with 1.2x
  return Math.sqrt(dx * dx + dy * dy) * 1.2;
}

/**
 * Get position along a bezier curve at parameter t (0-1).
 */
function getPointOnBezier(start: Point, end: Point, t: number): Point {
  const midX = (start.x + end.x) / 2;
  const cp1 = { x: midX, y: start.y };
  const cp2 = { x: midX, y: end.y };

  const t2 = t * t;
  const t3 = t2 * t;
  const mt = 1 - t;
  const mt2 = mt * mt;
  const mt3 = mt2 * mt;

  return {
    x: mt3 * start.x + 3 * mt2 * t * cp1.x + 3 * mt * t2 * cp2.x + t3 * end.x,
    y: mt3 * start.y + 3 * mt2 * t * cp1.y + 3 * mt * t2 * cp2.y + t3 * end.y,
  };
}

/**
 * Create a unique connection key
 */
function connectionKey(c: CityConnection): string {
  return `${c.exchangeId}-${c.providerId}`;
}

// ============================================================================
// Component
// ============================================================================

export function MarketPulseOverlay({
  containerRef,
  leftRailRef,
  rightRailRef,
  providersRef,
  selectedExchangeIds,
  displayedProviderIds,
  pulseContexts,
  activeExchangeIds,
}: MarketPulseOverlayProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [paths, setPaths] = useState<ConnectionPath[]>([]);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [particles, setParticles] = useState<Particle[]>([]);
  
  const lastParticleSpawnRef = useRef<Map<string, number>>(new Map());
  const animationFrameRef = useRef<number>();

  // Filter connections to only those with active exchanges AND visible providers
  const activeConnections = useMemo(() => {
    return CITY_CONNECTIONS.filter(
      (c) =>
        activeExchangeIds.includes(c.exchangeId) &&
        selectedExchangeIds.includes(c.exchangeId) &&
        displayedProviderIds.includes(c.providerId)
    );
  }, [activeExchangeIds, selectedExchangeIds, displayedProviderIds]);

  // Calculate path positions
  const calculatePaths = useCallback(() => {
    if (!containerRef.current || !leftRailRef.current || !rightRailRef.current || !providersRef.current) {
      return;
    }

    const containerRect = containerRef.current.getBoundingClientRect();
    const newPaths: ConnectionPath[] = [];

    for (const connection of activeConnections) {
      const exchangeCard = document.querySelector(
        `[data-exchange-id="${connection.exchangeId}"]`
      ) as HTMLElement | null;

      const providerRow = document.querySelector(
        `[data-provider-id="${connection.providerId}"]`
      ) as HTMLElement | null;

      if (!exchangeCard || !providerRow) continue;

      const exchangeRect = exchangeCard.getBoundingClientRect();
      const providerRect = providerRow.getBoundingClientRect();

      // Calculate positions relative to container
      const startPoint: Point = {
        x: exchangeRect.right - containerRect.left,
        y: exchangeRect.top + exchangeRect.height / 2 - containerRect.top,
      };

      const endPoint: Point = {
        x: providerRect.left - containerRect.left,
        y: providerRect.top + providerRect.height / 2 - containerRect.top,
      };

      // Check if exchange is on left or right rail
      const leftRailRect = leftRailRef.current.getBoundingClientRect();
      const isLeftRail = exchangeRect.left < leftRailRect.right;

      if (isLeftRail) {
        startPoint.x = exchangeRect.right - containerRect.left;
      } else {
        startPoint.x = exchangeRect.left - containerRect.left;
        endPoint.x = providerRect.right - containerRect.left;
      }

      const pathD = generateBezierPath(startPoint, endPoint);
      const pathLength = approximatePathLength(startPoint, endPoint);

      newPaths.push({
        connection,
        startPoint,
        endPoint,
        pathD,
        pathLength,
      });
    }

    setPaths(newPaths);
    setDimensions({
      width: containerRect.width,
      height: containerRect.height,
    });
  }, [activeConnections, containerRef, leftRailRef, rightRailRef, providersRef]);

  // Recalculate paths on layout changes
  useEffect(() => {
    calculatePaths();

    const resizeObserver = new ResizeObserver(() => {
      calculatePaths();
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    window.addEventListener('scroll', calculatePaths, true);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('scroll', calculatePaths, true);
    };
  }, [calculatePaths, containerRef]);

  // Particle spawning and animation
  useEffect(() => {
    const lastSpawn = lastParticleSpawnRef.current;
    let lastFrameTime = performance.now();

    const animate = (currentTime: number) => {
      const deltaMs = currentTime - lastFrameTime;
      lastFrameTime = currentTime;

      setParticles((prev) => {
        const updated: Particle[] = [];

        // Update existing particles
        for (const particle of prev) {
          const newProgress = particle.progress + particle.speed * deltaMs;
          
          // Remove particles that have completed their journey
          if (newProgress > 1) continue;
          if (newProgress < 0) continue;

          updated.push({
            ...particle,
            progress: newProgress,
          });
        }

        // Spawn new particles for active connections
        for (const path of paths) {
          const key = connectionKey(path.connection);
          const context = pulseContexts.get(path.connection.exchangeId);
          
          if (!context || context.state === 'dormant') continue;

          const lastSpawnTime = lastSpawn.get(key) ?? 0;
          const isBurstState = context.state === 'opening' || context.state === 'closing';
          const isReverse = context.state === 'closing' || context.state === 'pre-close';

          if (isBurstState && context.progress < 0.3) {
            // Burst mode: spawn multiple particles rapidly
            const burstInterval = BURST_PARTICLE_STAGGER;
            if (currentTime - lastSpawnTime > burstInterval) {
              const particleCount = Math.min(
                BURST_PARTICLE_COUNT,
                Math.floor((currentTime - lastSpawnTime) / burstInterval)
              );
              
              for (let i = 0; i < particleCount; i++) {
                updated.push({
                  id: `${key}-${currentTime}-${i}`,
                  connectionKey: key,
                  progress: isReverse ? 1 : 0,
                  speed: (isReverse ? -1 : 1) * PARTICLE_SPEED_BURST * (0.8 + Math.random() * 0.4),
                  size: PARTICLE_SIZE_BURST * (0.8 + Math.random() * 0.4),
                  opacity: 0.9 + Math.random() * 0.1,
                  reverse: isReverse,
                });
              }
              lastSpawn.set(key, currentTime);
            }
          } else if (context.state === 'pre-open' || context.state === 'pre-close') {
            // Idle mode: spawn single particles slowly
            if (currentTime - lastSpawnTime > IDLE_PARTICLE_INTERVAL) {
              updated.push({
                id: `${key}-${currentTime}`,
                connectionKey: key,
                progress: isReverse ? 1 : 0,
                speed: (isReverse ? -1 : 1) * PARTICLE_SPEED_IDLE,
                size: PARTICLE_SIZE_IDLE,
                opacity: 0.6,
                reverse: isReverse,
              });
              lastSpawn.set(key, currentTime);
            }
          }
        }

        return updated;
      });

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [paths, pulseContexts]);

  // Apply row glow classes
  useEffect(() => {
    // Remove all existing pulse classes
    document.querySelectorAll('.market-pulse-row-glow').forEach((el) => {
      el.classList.remove(
        'market-pulse-row-glow',
        'market-pulse-row-opening',
        'market-pulse-row-closing',
        'market-pulse-row-breathing'
      );
      (el as HTMLElement).style.removeProperty('--pulse-continent-color');
    });

    // Add classes to active rows
    for (const path of paths) {
      const context = pulseContexts.get(path.connection.exchangeId);
      if (!context || context.state === 'dormant') continue;

      const row = document.querySelector(
        `[data-provider-id="${path.connection.providerId}"]`
      ) as HTMLElement | null;

      if (!row) continue;

      const colors = CONTINENT_COLORS[path.connection.continent];
      row.style.setProperty('--pulse-continent-color', colors.primary);
      row.classList.add('market-pulse-row-glow');

      if (context.state === 'opening') {
        row.classList.add('market-pulse-row-opening');
      } else if (context.state === 'closing') {
        row.classList.add('market-pulse-row-closing');
      } else {
        row.classList.add('market-pulse-row-breathing');
      }
    }

    return () => {
      document.querySelectorAll('.market-pulse-row-glow').forEach((el) => {
        el.classList.remove(
          'market-pulse-row-glow',
          'market-pulse-row-opening',
          'market-pulse-row-closing',
          'market-pulse-row-breathing'
        );
        (el as HTMLElement).style.removeProperty('--pulse-continent-color');
      });
    };
  }, [paths, pulseContexts]);

  // Respect reduced motion
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Nothing to render if no active connections
  if (paths.length === 0) return null;

  return (
    <svg
      ref={svgRef}
      className="pointer-events-none absolute inset-0 z-10"
      width={dimensions.width}
      height={dimensions.height}
      aria-hidden="true"
    >
      <defs>
        {/* Glow filters for each continent */}
        {Object.entries(CONTINENT_COLORS).map(([continent, colors]) => (
          <React.Fragment key={continent}>
            {/* Line glow */}
            <filter
              id={`pulse-line-glow-${continent}`}
              x="-50%"
              y="-50%"
              width="200%"
              height="200%"
            >
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feFlood floodColor={colors.primary} floodOpacity="0.6" />
              <feComposite in2="blur" operator="in" />
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Particle glow */}
            <filter
              id={`pulse-particle-glow-${continent}`}
              x="-200%"
              y="-200%"
              width="500%"
              height="500%"
            >
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feFlood floodColor={colors.primary} floodOpacity="1" />
              <feComposite in2="blur" operator="in" />
              <feMerge>
                <feMergeNode />
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </React.Fragment>
        ))}
      </defs>

      {/* Connection lines */}
      {paths.map((path) => {
        const context = pulseContexts.get(path.connection.exchangeId);
        const state = context?.state ?? 'dormant';
        const colors = CONTINENT_COLORS[path.connection.continent];
        
        const isActive = state === 'opening' || state === 'closing';
        const lineOpacity = isActive ? 0.8 : state !== 'dormant' ? 0.4 + (context?.progress ?? 0) * 0.3 : 0;
        const lineWidth = isActive ? LINE_WIDTH_ACTIVE : LINE_WIDTH_IDLE;

        return (
          <g key={connectionKey(path.connection)}>
            {/* Glow layer */}
            <path
              d={path.pathD}
              fill="none"
              stroke={colors.primary}
              strokeWidth={lineWidth + 2}
              opacity={lineOpacity * 0.5}
              filter={`url(#pulse-line-glow-${path.connection.continent})`}
              strokeLinecap="round"
            />
            {/* Main line */}
            <path
              d={path.pathD}
              fill="none"
              stroke={colors.primary}
              strokeWidth={lineWidth}
              opacity={lineOpacity}
              strokeLinecap="round"
              strokeDasharray={isActive ? 'none' : '8 4'}
              className="transition-all duration-300"
            />
          </g>
        );
      })}

      {/* Particles */}
      {!prefersReducedMotion &&
        particles.map((particle) => {
          const path = paths.find((p) => connectionKey(p.connection) === particle.connectionKey);
          if (!path) return null;

          const position = getPointOnBezier(
            path.startPoint,
            path.endPoint,
            particle.progress
          );
          const colors = CONTINENT_COLORS[path.connection.continent];

          return (
            <g key={particle.id}>
              {/* Outer glow */}
              <circle
                cx={position.x}
                cy={position.y}
                r={particle.size * 2}
                fill={colors.glow}
                opacity={particle.opacity * 0.4}
              />
              {/* Inner core */}
              <circle
                cx={position.x}
                cy={position.y}
                r={particle.size}
                fill={colors.primary}
                opacity={particle.opacity}
                filter={`url(#pulse-particle-glow-${path.connection.continent})`}
              />
              {/* White hot center */}
              <circle
                cx={position.x}
                cy={position.y}
                r={particle.size * 0.3}
                fill="white"
                opacity={particle.opacity}
              />
            </g>
          );
        })}
    </svg>
  );
}

export default MarketPulseOverlay;
