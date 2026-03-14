// src/components/pro-promagen/tier-comparison-strip.tsx
// ============================================================================
// TIER COMPARISON STRIP — All 4 Tiers Side by Side
// ============================================================================
// Shows the same scene rendered in all 4 prompt tier formats.
// Free user's current surface tier is highlighted, others are dimmed with lock.
// Human Factor: Contrast Effect — seeing all 4 makes the abstract concrete.
//
// Authority: docs/authority/human-factors.md §Contrast Effect
// Existing features preserved: Yes
// ============================================================================

'use client';

import React from 'react';

// ============================================================================
// TIER DATA
// ============================================================================

const TIERS: Array<{
  id: number;
  label: string;
  shortLabel: string;
  color: string;
  dotClass: string;
  bgClass: string;
  ringClass: string;
  platforms: string;
  excerpt: string;
}> = [
  {
    id: 1,
    label: 'CLIP-Based',
    shortLabel: 'T1',
    color: '#60a5fa',
    dotClass: 'bg-blue-400',
    bgClass: 'bg-blue-500/8',
    ringClass: 'ring-blue-500/20',
    platforms: 'Stability · Leonardo',
    excerpt: '(masterpiece:1.3), Tower Bridge golden hour, (warm amber:1.2), Thames reflection, scattered clouds, cobblestone, sharp focus, 50mm…',
  },
  {
    id: 2,
    label: 'Midjourney',
    shortLabel: 'T2',
    color: '#c084fc',
    dotClass: 'bg-purple-400',
    bgClass: 'bg-purple-500/8',
    ringClass: 'ring-purple-500/20',
    platforms: 'Midjourney · BlueWillow',
    excerpt: 'Tower Bridge at golden hour, Thames reflections, warm amber light --ar 16:9 --v 7 --s 500 --no blur, watermark…',
  },
  {
    id: 3,
    label: 'Natural Language',
    shortLabel: 'T3',
    color: '#34d399',
    dotClass: 'bg-emerald-400',
    bgClass: 'bg-emerald-500/8',
    ringClass: 'ring-emerald-500/20',
    platforms: 'DALL·E · Imagen · Firefly',
    excerpt: 'A professional photograph of Tower Bridge during golden hour with warm amber light reflecting off the Thames…',
  },
  {
    id: 4,
    label: 'Plain Language',
    shortLabel: 'T4',
    color: '#fb923c',
    dotClass: 'bg-orange-400',
    bgClass: 'bg-orange-500/8',
    ringClass: 'ring-orange-500/20',
    platforms: 'Canva · Craiyon · Picsart',
    excerpt: 'Tower Bridge London, golden hour, warm light, Thames river, professional photography…',
  },
];

// ============================================================================
// LOCK ICON
// ============================================================================

function LockBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-white/30 bg-white/[0.05]" style={{ fontSize: 'clamp(0.5rem, 0.6vw, 0.55rem)' }}>
      <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
      Pro
    </span>
  );
}

// ============================================================================
// TIER CARD
// ============================================================================

function TierCard({ tier, isHighlighted }: { tier: typeof TIERS[0]; isHighlighted: boolean }) {
  return (
    <div
      className={`relative flex flex-col gap-1.5 rounded-lg px-3 py-2.5 transition-all duration-300 ring-1 ${
        isHighlighted ? `${tier.bgClass} ${tier.ringClass}` : 'bg-white/[0.02] ring-white/[0.05]'
      }`}
      style={isHighlighted ? {} : { filter: 'saturate(0.3)' }}
    >
      {/* Tier label + lock */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${tier.dotClass}`} style={isHighlighted ? {} : { opacity: 0.4 }} />
          <span
            className="text-xs font-semibold"
            style={{ color: isHighlighted ? tier.color : 'rgba(255,255,255,0.3)', fontSize: 'clamp(0.55rem, 0.7vw, 0.65rem)' }}
          >
            {tier.shortLabel}: {tier.label}
          </span>
        </div>
        {!isHighlighted && <LockBadge />}
      </div>

      {/* Platforms */}
      <span
        className="text-white/25"
        style={{ fontSize: 'clamp(0.5rem, 0.6vw, 0.55rem)' }}
      >
        {tier.platforms}
      </span>

      {/* Prompt excerpt */}
      <p
        className={`leading-relaxed ${isHighlighted ? 'text-white/60' : 'text-white/20'}`}
        style={{ fontSize: 'clamp(0.55rem, 0.65vw, 0.6rem)' }}
      >
        {tier.excerpt}
      </p>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function TierComparisonStrip() {
  // Free users see Tier 3 highlighted (exchange cards default)
  const highlightedTier = 3;

  return (
    <div className="mb-4">
      <h3
        className="text-sm font-semibold text-white/70 mb-2"
        style={{ fontSize: 'clamp(0.7rem, 0.85vw, 0.8rem)' }}
      >
        All 4 prompt formats — same scene
      </h3>
      <div className="grid grid-cols-2 gap-2">
        {TIERS.map((tier) => (
          <TierCard
            key={tier.id}
            tier={tier}
            isHighlighted={tier.id === highlightedTier}
          />
        ))}
      </div>
      <p
        className="text-center mt-2 text-white/30"
        style={{ fontSize: 'clamp(0.55rem, 0.7vw, 0.65rem)' }}
      >
        Pro users choose which format appears on every flag tooltip
      </p>
    </div>
  );
}

export default TierComparisonStrip;
