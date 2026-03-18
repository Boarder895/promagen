// src/components/layout/pro-gem-badge.tsx
// ============================================================================
// PRO GEM BADGE — Evolving hexagonal gem for Pro Promagen users
// ============================================================================
// Design 4: The Evolving Gem — colour and glow intensity grow with prompt count.
// Tier thresholds mirror eBay's star system but with gem metaphor:
//   0 → Raw Crystal (purple)
//   100 → Cut Sapphire (blue)
//   500 → Emerald (green)
//   1,000 → Amber (gold)
//   5,000 → Rose Diamond (pink)
//   10,000 → Prismatic (white, all colours)
//
// Human factors:
// - Variable Reward + Achievement Unlocking (prompt counter increments)
// - Loss Aversion (losing the gem tier on cancellation)
// - Endowment Effect (the gem is "theirs", it grows with them)
//
// Rules:
// - All animations co-located in <style dangerouslySetInnerHTML>
// - All sizing via clamp()
// - No opacity-based state dimming
// - Min font 10px
// - cursor-pointer on clickable
// - No globals.css entries
//
// Position: Same slot as the current PRO pill in homepage-grid.tsx header
// ============================================================================

'use client';

import React, { useMemo, useEffect, useState } from 'react';

// ============================================================================
// TIER CONFIGURATION
// ============================================================================

interface GemTier {
  name: string;
  threshold: number;
  /** Primary glow/border colour */
  hex: string;
  /** Inner gem fill (translucent) */
  fill: string;
  /** Text colour */
  text: string;
  /** Box shadow glow */
  glow: string;
  /** Inner facet (only highest tier) */
  hasInnerFacet: boolean;
}

const GEM_TIERS: GemTier[] = [
  {
    name: 'Raw Crystal',
    threshold: 0,
    hex: '#a78bfa',
    fill: 'rgba(91,33,182,0.35)',
    text: '#a78bfa',
    glow: '0 0 8px rgba(167,139,250,0.4), 0 0 20px rgba(167,139,250,0.15)',
    hasInnerFacet: false,
  },
  {
    name: 'Cut Sapphire',
    threshold: 100,
    hex: '#38bdf8',
    fill: 'rgba(3,105,161,0.35)',
    text: '#38bdf8',
    glow: '0 0 10px rgba(56,189,248,0.5), 0 0 24px rgba(56,189,248,0.2)',
    hasInnerFacet: false,
  },
  {
    name: 'Emerald',
    threshold: 500,
    hex: '#34d399',
    fill: 'rgba(4,120,87,0.35)',
    text: '#34d399',
    glow: '0 0 12px rgba(52,211,153,0.5), 0 0 28px rgba(52,211,153,0.2)',
    hasInnerFacet: false,
  },
  {
    name: 'Amber',
    threshold: 1000,
    hex: '#fbbf24',
    fill: 'rgba(180,83,9,0.35)',
    text: '#fbbf24',
    glow: '0 0 14px rgba(251,191,36,0.55), 0 0 32px rgba(251,191,36,0.25)',
    hasInnerFacet: false,
  },
  {
    name: 'Rose Diamond',
    threshold: 5000,
    hex: '#f472b6',
    fill: 'rgba(190,24,93,0.35)',
    text: '#f472b6',
    glow: '0 0 16px rgba(244,114,182,0.6), 0 0 36px rgba(244,114,182,0.25)',
    hasInnerFacet: false,
  },
  {
    name: 'Prismatic',
    threshold: 10000,
    hex: '#ffffff',
    fill: 'rgba(255,255,255,0.15)',
    text: '#ffffff',
    glow: '0 0 18px rgba(255,255,255,0.5), 0 0 40px rgba(167,139,250,0.2), 0 0 40px rgba(56,189,248,0.15)',
    hasInnerFacet: true,
  },
];

function getTier(count: number): GemTier {
  for (let i = GEM_TIERS.length - 1; i >= 0; i--) {
    if (count >= GEM_TIERS[i]!.threshold) return GEM_TIERS[i]!;
  }
  return GEM_TIERS[0]!;
}

function formatCount(n: number): string {
  if (n >= 10000) return `${(n / 1000).toFixed(1)}K`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toLocaleString();
}

// ============================================================================
// READ LIFETIME PROMPT COUNT FROM LOCALSTORAGE
// ============================================================================

const LIFETIME_KEY = 'promagen:lifetime_prompts';
const SAVED_KEY = 'promagen_saved_prompts';

function readLifetimeCount(): number {
  if (typeof window === 'undefined') return 0;
  try {
    // Primary: dedicated lifetime counter
    const lifetime = localStorage.getItem(LIFETIME_KEY);
    if (lifetime) {
      const parsed = parseInt(lifetime, 10);
      if (!isNaN(parsed)) return parsed;
    }
    // Fallback: count saved prompts (always exists)
    const raw = localStorage.getItem(SAVED_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data?.prompts?.length) return data.prompts.length;
    }
    return 0;
  } catch {
    return 0;
  }
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ProGemBadge() {
  const [count, setCount] = useState(0);

  // Read on mount + listen for storage changes (cross-tab)
  useEffect(() => {
    setCount(readLifetimeCount());

    const handleStorage = (e: StorageEvent) => {
      if (e.key === LIFETIME_KEY || e.key === SAVED_KEY) {
        setCount(readLifetimeCount());
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const tier = useMemo(() => getTier(count), [count]);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes proGemPulse {
          0%, 100% { filter: drop-shadow(0 0 4px var(--gem-color)); }
          50% { filter: drop-shadow(0 0 10px var(--gem-color)) drop-shadow(0 0 20px var(--gem-color)); }
        }
        @keyframes proGemShimmer {
          0% { opacity: 0.3; }
          50% { opacity: 0.7; }
          100% { opacity: 0.3; }
        }
        .pro-gem-badge {
          --gem-color: ${tier.hex};
          display: inline-flex;
          align-items: center;
          gap: clamp(4px, 0.4vw, 6px);
          padding: clamp(3px, 0.25vw, 5px) clamp(8px, 0.7vw, 14px);
          border-radius: clamp(14px, 1.2vw, 20px);
          border: 1px solid color-mix(in srgb, var(--gem-color) 50%, transparent);
          background: color-mix(in srgb, var(--gem-color) 8%, rgba(15,23,42,0.9));
          box-shadow: ${tier.glow};
          cursor: default;
          flex-shrink: 0;
          transition: box-shadow 0.3s ease, border-color 0.3s ease;
        }
        .pro-gem-badge:hover {
          box-shadow: ${tier.glow.replace(/[\d.]+px/g, (m) => `${parseFloat(m) * 1.5}px`)};
          border-color: var(--gem-color);
        }
        .pro-gem-svg {
          flex-shrink: 0;
          animation: proGemPulse 3s ease-in-out infinite;
        }
        .pro-gem-shimmer {
          animation: proGemShimmer 2.5s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .pro-gem-svg { animation: none; filter: drop-shadow(0 0 6px var(--gem-color)); }
          .pro-gem-shimmer { animation: none; opacity: 0.5; }
        }
      `}} />
      <span
        className="pro-gem-badge"
        style={{ '--gem-color': tier.hex } as React.CSSProperties}
        title={`Pro Promagen · ${tier.name} · ${formatCount(count)} prompts crafted`}
        aria-label={`Pro Promagen ${tier.name} badge — ${count} prompts crafted`}
      >
        {/* Hexagonal gem SVG */}
        <svg
          className="pro-gem-svg"
          viewBox="0 0 30 26"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{
            width: 'clamp(20px, 1.6vw, 26px)',
            height: 'clamp(18px, 1.4vw, 23px)',
            '--gem-color': tier.hex,
          } as React.CSSProperties}
        >
          {/* Outer gem */}
          <polygon
            points="15,1 28,7 28,19 15,25 2,19 2,7"
            fill={tier.fill}
            stroke={tier.hex}
            strokeWidth="1.5"
          />
          {/* Inner facet (high tiers only for depth) */}
          {tier.hasInnerFacet && (
            <polygon
              className="pro-gem-shimmer"
              points="15,5 24,9 24,17 15,21 6,17 6,9"
              fill="rgba(255,255,255,0.08)"
              stroke="rgba(255,255,255,0.35)"
              strokeWidth="0.5"
            />
          )}
          {/* Centre highlight — bright glow spot */}
          <circle
            cx="15"
            cy="13"
            r="4"
            fill={tier.hex}
            opacity="0.15"
          />
          {/* P mark */}
          <text
            x="15"
            y="14"
            textAnchor="middle"
            dominantBaseline="central"
            fill={tier.hex}
            fontWeight="600"
            style={{ fontSize: 'clamp(10px, 0.8vw, 12px)' }}
          >
            P
          </text>
        </svg>

        {/* Text: "Pro · 847" */}
        <span
          style={{
            color: tier.text,
            fontSize: 'clamp(10px, 0.65vw, 12px)',
            fontWeight: 600,
            letterSpacing: '0.03em',
            whiteSpace: 'nowrap',
          }}
        >
          Pro
        </span>
        {count > 0 && (
          <span
            style={{
              color: tier.text,
              fontSize: 'clamp(10px, 0.55vw, 11px)',
              fontWeight: 400,
              opacity: 0.75,
              whiteSpace: 'nowrap',
            }}
          >
            · {formatCount(count)}
          </span>
        )}
      </span>
    </>
  );
}

export default ProGemBadge;
