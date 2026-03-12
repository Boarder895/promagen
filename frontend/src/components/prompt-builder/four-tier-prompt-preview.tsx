/**
 * FourTierPromptPreview Component v1.2.0
 * ======================================
 * Displays prompt versions with individual copy buttons.
 * 
 * v1.2.0 (Feb 2026):
 * - NEW: Smart Prompt Length Gauge (Phase 7.9d)
 *   Live character count bar powered by compression intelligence.
 *   Shows green (optimal), amber (diminishing returns), red (too long) zones.
 *   Only renders when compressionLookup data is available.
 * 
 * v1.1.0 (Jan 2026):
 * - NEW: singleTierMode prop - shows only active tier when provider selected
 * - When singleTierMode=true, only the currentTier is displayed
 * - When singleTierMode=false, all 4 tiers are shown (playground neutral mode)
 * 
 * Existing features preserved: Yes.
 * 
 * @version 1.2.0
 * @updated 2026-02-28
 */

'use client';

import React, { useState, useCallback, useMemo } from 'react';
import type { GeneratedPrompts, PlatformTier } from '../../types/prompt-intelligence';
import { TIER_CONFIGS } from '../../types/prompt-intelligence';
import {
  lookupBestOptimalChars,
  lookupOptimalLength,
  type CompressionLookup,
} from '@/lib/learning/compression-lookup';

// ============================================================================
// TYPES
// ============================================================================

interface FourTierPromptPreviewProps {
  prompts: GeneratedPrompts;
  currentTier: PlatformTier;
  onCopy?: (tier: PlatformTier, text: string) => void;
  /** Called when user clicks a tier card to select it */
  onTierSelect?: (tier: PlatformTier) => void;
  compact?: boolean;
  showNegative?: boolean;
  /** When true, only shows the currentTier card (provider selected mode) */
  singleTierMode?: boolean;
  /** Step 7.9d: Compression lookup for Smart Prompt Length Gauge (null = no gauge) */
  compressionLookup?: CompressionLookup | null;
  /** Step 7.9d: Platform slug for platform-aware length blending (null = tier-only) */
  platformId?: string | null;
}

interface TierCardProps {
  tier: PlatformTier;
  positive: string;
  negative: string;
  isActive: boolean;
  onCopy: () => void;
  /** Called when card is clicked to select this tier */
  onClick?: () => void;
  compact?: boolean;
  /** When true, card takes full width */
  fullWidth?: boolean;
  /** Step 7.9d: Compression lookup for length gauge */
  compressionLookup?: CompressionLookup | null;
  /** Step 7.9d: Platform slug for blending */
  platformId?: string | null;
}

// ============================================================================
// SMART PROMPT LENGTH GAUGE (Phase 7.9d)
// ============================================================================
// A live character count bar that shows where the current prompt length
// sits relative to the learned optimal zone.
//
// Zones:
//   Green  (0 → optimal)           — Sweet spot: best performance
//   Amber  (optimal → diminishing) — Still good, diminishing returns
//   Red    (diminishing → max)     — Too long: consider trimming
//
// Powered entirely by compression lookup — zero new API calls.
// Only renders when learned data exists for this tier.
// ============================================================================

/** Fallback max for the gauge scale when no diminishing returns data */
const GAUGE_SCALE_MAX = 600;

interface LengthGaugeProps {
  /** Current prompt character count */
  charCount: number;
  /** Optimal chars from confidence-blended lookup */
  optimalChars: number;
  /** Diminishing returns threshold (chars) */
  diminishingAt: number;
}

function PromptLengthGauge({ charCount, optimalChars, diminishingAt }: LengthGaugeProps) {
  // Scale: max of gauge = 1.4× diminishing (gives visual breathing room beyond red zone)
  const scaleMax = Math.max(diminishingAt * 1.4, optimalChars * 2, GAUGE_SCALE_MAX);

  // Zone boundaries as percentages of the gauge width
  const optimalPct = Math.min((optimalChars / scaleMax) * 100, 100);
  const diminishPct = Math.min((diminishingAt / scaleMax) * 100, 100);

  // Current position as percentage
  const cursorPct = Math.min((charCount / scaleMax) * 100, 100);

  // Determine status label + colour
  let status: string;
  let statusColor: string;
  let cursorColor: string;

  if (charCount <= 0) {
    status = '';
    statusColor = 'text-white/30';
    cursorColor = 'rgba(100,116,139,0.4)';
  } else if (charCount <= optimalChars) {
    status = 'sweet spot';
    statusColor = 'text-emerald-400/80';
    cursorColor = 'rgba(52,211,153,0.9)';
  } else if (charCount <= diminishingAt) {
    status = 'diminishing returns';
    statusColor = 'text-amber-400/80';
    cursorColor = 'rgba(251,191,36,0.9)';
  } else {
    status = 'consider trimming';
    statusColor = 'text-rose-400/80';
    cursorColor = 'rgba(251,113,133,0.9)';
  }

  return (
    <div
      style={{
        marginTop: 'clamp(6px, 0.5vw, 10px)',
        marginBottom: 'clamp(2px, 0.2vw, 4px)',
      }}
    >
      {/* Label row */}
      <div className="flex items-center justify-between" style={{ marginBottom: 'clamp(2px, 0.2vw, 4px)' }}>
        <span
          className="text-white/40 font-medium"
          style={{ fontSize: 'clamp(0.48rem, 0.52vw, 0.6rem)' }}
        >
          Prompt length
        </span>
        <span
          className={`font-medium ${statusColor}`}
          style={{ fontSize: 'clamp(0.48rem, 0.52vw, 0.6rem)' }}
        >
          {charCount > 0 && (
            <>
              {charCount} chars
              {status && <> · {status}</>}
            </>
          )}
        </span>
      </div>

      {/* Gauge bar */}
      <div
        className="relative w-full rounded-full overflow-hidden"
        style={{ height: 'clamp(4px, 0.35vw, 6px)' }}
        role="progressbar"
        aria-valuenow={charCount}
        aria-valuemin={0}
        aria-valuemax={Math.round(scaleMax)}
        aria-label={`Prompt length: ${charCount} characters${status ? `, ${status}` : ''}`}
      >
        {/* Background: three colour zones */}
        <div className="absolute inset-0 flex">
          {/* Green zone: 0 → optimal */}
          <div
            className="h-full"
            style={{
              width: `${optimalPct}%`,
              background: 'linear-gradient(90deg, rgba(52,211,153,0.15), rgba(52,211,153,0.30))',
            }}
          />
          {/* Amber zone: optimal → diminishing */}
          <div
            className="h-full"
            style={{
              width: `${diminishPct - optimalPct}%`,
              background: 'linear-gradient(90deg, rgba(251,191,36,0.15), rgba(251,191,36,0.30))',
            }}
          />
          {/* Red zone: diminishing → max */}
          <div
            className="h-full flex-1"
            style={{
              background: 'linear-gradient(90deg, rgba(251,113,133,0.15), rgba(251,113,133,0.30))',
            }}
          />
        </div>

        {/* Filled portion up to cursor */}
        {charCount > 0 && (
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-all duration-300 ease-out"
            style={{
              width: `${cursorPct}%`,
              background: cursorColor,
            }}
          />
        )}

        {/* Optimal marker: thin white line at sweet-spot boundary */}
        <div
          className="absolute inset-y-0"
          style={{
            left: `${optimalPct}%`,
            width: '1px',
            background: 'rgba(255,255,255,0.25)',
          }}
        />
      </div>

      {/* Tick labels */}
      <div className="relative w-full" style={{ marginTop: 'clamp(1px, 0.1vw, 2px)' }}>
        <span
          className="absolute text-white/20"
          style={{
            left: `${optimalPct}%`,
            transform: 'translateX(-50%)',
            fontSize: 'clamp(0.38rem, 0.42vw, 0.48rem)',
          }}
        >
          {optimalChars}
        </span>
        <span
          className="absolute text-white/20"
          style={{
            left: `${diminishPct}%`,
            transform: 'translateX(-50%)',
            fontSize: 'clamp(0.38rem, 0.42vw, 0.48rem)',
          }}
        >
          {diminishingAt}
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// TIER CARD COMPONENT
// ============================================================================

function TierCard({
  tier,
  positive,
  negative,
  isActive,
  onCopy,
  onClick,
  compact,
  fullWidth,
  compressionLookup,
  platformId,
}: TierCardProps) {
  const [copied, setCopied] = useState(false);
  const config = TIER_CONFIGS[tier];
  
  const handleCopy = useCallback(async () => {
    const text = tier === 2 && negative
      ? `${positive} ${negative}`
      : positive;
    
    await navigator.clipboard.writeText(text);
    setCopied(true);
    onCopy();
    
    setTimeout(() => setCopied(false), 2000);
  }, [positive, negative, tier, onCopy]);

  // Step 7.9d: Compute gauge data from compression lookup
  const gaugeData = useMemo(() => {
    if (!compressionLookup) return null;

    const optimalChars = lookupBestOptimalChars(compressionLookup, tier, platformId ?? null);
    if (optimalChars === null) return null;

    const tierProfile = lookupOptimalLength(compressionLookup, tier);
    const diminishingAt = tierProfile?.diminishingReturnsAt ?? Math.round(optimalChars * 1.5);

    return { optimalChars, diminishingAt };
  }, [compressionLookup, tier, platformId]);

  const charCount = positive.length;
  
  // Tier-specific styling
  const tierColors = {
    1: { bg: 'from-blue-500/20 to-cyan-500/20', border: 'border-blue-500/50', accent: 'text-blue-400' },
    2: { bg: 'from-purple-500/20 to-pink-500/20', border: 'border-purple-500/50', accent: 'text-purple-400' },
    3: { bg: 'from-emerald-500/20 to-teal-500/20', border: 'border-emerald-500/50', accent: 'text-emerald-400' },
    4: { bg: 'from-orange-500/20 to-amber-500/20', border: 'border-orange-500/50', accent: 'text-orange-400' }
  };
  
  const colors = tierColors[tier];
  
  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
      className={`
        relative rounded-xl border-2 transition-all duration-300
        ${isActive ? `${colors.border} bg-gradient-to-br ${colors.bg}` : 'border-white/10 bg-white/5'}
        ${isActive ? 'ring-2 ring-offset-2 ring-offset-black ring-white/20' : ''}
        ${compact ? 'p-3' : 'p-4'}
        ${fullWidth ? 'col-span-full' : ''}
        ${onClick ? 'cursor-pointer hover:border-white/30' : ''}
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`
            inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold
            ${isActive ? 'bg-white text-black' : 'bg-white/10 text-white/60'}
          `}>
            {tier}
          </span>
          <div>
            <h4 className={`font-semibold text-sm ${isActive ? 'text-white' : 'text-white/70'}`}>
              {config.name}
            </h4>
            {!compact && (
              <p className="text-xs text-white/50">
                {config.description}
              </p>
            )}
          </div>
        </div>
        
        {/* Active badge */}
        {isActive && (
          <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs font-medium text-white">
            Active
          </span>
        )}
      </div>
      
      {/* Syntax features */}
      {!compact && (
        <div className="flex flex-wrap gap-1 mb-3">
          {config.syntaxFeatures.slice(0, 3).map((feature, i) => (
            <span
              key={i}
              className={`
                px-2 py-0.5 rounded text-xs font-mono
                ${isActive ? 'bg-white/20 text-white/80' : 'bg-white/5 text-white/40'}
              `}
            >
              {feature}
            </span>
          ))}
        </div>
      )}
      
      {/* Prompt text */}
      <div
        className={`
          relative rounded-lg p-3 font-mono text-sm
          ${isActive ? 'bg-black/30' : 'bg-black/20'}
          ${compact ? 'max-h-20' : fullWidth ? 'max-h-40' : 'max-h-32'} overflow-y-auto
        `}
      >
        <p className={`
          break-words whitespace-pre-wrap
          ${isActive ? 'text-white/90' : 'text-white/60'}
          ${!positive && 'italic text-white/30'}
        `}>
          {positive || 'Select options to generate prompt...'}
        </p>
        
        {/* Negative for tier 2 (inline) */}
        {tier === 2 && negative && (
          <p className="mt-2 text-red-400/80 break-words">
            {negative}
          </p>
        )}
      </div>

      {/* Step 7.9d: Smart Prompt Length Gauge — only when data available */}
      {gaugeData && isActive && (
        <PromptLengthGauge
          charCount={charCount}
          optimalChars={gaugeData.optimalChars}
          diminishingAt={gaugeData.diminishingAt}
        />
      )}
      
      {/* Copy button */}
      <button
        onClick={handleCopy}
        disabled={!positive}
        className={`
          mt-3 w-full py-2 rounded-lg font-medium text-sm
          flex items-center justify-center gap-2
          transition-all duration-200
          ${positive
            ? `${isActive
                ? 'bg-white text-black hover:bg-white/90'
                : 'bg-white/10 text-white hover:bg-white/20'
              }`
            : 'bg-white/5 text-white/30 cursor-not-allowed'
          }
        `}
      >
        {copied ? (
          <>
            <CheckIcon className="w-4 h-4" />
            Copied!
          </>
        ) : (
          <>
            <CopyIcon className="w-4 h-4" />
            Copy Tier {tier}
          </>
        )}
      </button>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function FourTierPromptPreview({
  prompts,
  currentTier,
  onCopy,
  onTierSelect,
  compact = false,
  showNegative = true,
  singleTierMode = false,
  compressionLookup,
  platformId,
}: FourTierPromptPreviewProps) {
  const handleCopy = useCallback((tier: PlatformTier, text: string) => {
    onCopy?.(tier, text);
  }, [onCopy]);
  
  // Single tier mode: only show the current tier
  if (singleTierMode) {
    const tierPromptMap = {
      1: prompts.tier1,
      2: prompts.tier2,
      3: prompts.tier3,
      4: prompts.tier4,
    };
    const tierNegativeMap = {
      1: prompts.negative.tier1,
      2: prompts.negative.tier2,
      3: prompts.negative.tier3,
      4: prompts.negative.tier4,
    };
    
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
            🎯 Prompt Preview
          </h3>
          <span className="text-xs text-slate-500">
            Tier {currentTier}: {TIER_CONFIGS[currentTier].name}
          </span>
        </div>
        
        {/* Single tier card - full width */}
        <TierCard
          tier={currentTier}
          positive={tierPromptMap[currentTier]}
          negative={showNegative ? tierNegativeMap[currentTier] : ''}
          isActive={true}
          onCopy={() => handleCopy(currentTier, tierPromptMap[currentTier])}
          compact={compact}
          fullWidth={true}
          compressionLookup={compressionLookup}
          platformId={platformId}
        />
      </div>
    );
  }
  
  // Multi-tier mode: show all 4 tiers (playground neutral mode)
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
          🎯 4-Tier Prompt Variants
        </h3>
        <p className="text-xs text-slate-500">
          Same scene, different syntaxes
        </p>
      </div>
      
      {/* Grid of tier cards */}
      <div className={`grid gap-3 ${compact ? 'grid-cols-2' : 'grid-cols-1 lg:grid-cols-2'}`}>
        <TierCard
          tier={1}
          positive={prompts.tier1}
          negative={showNegative ? prompts.negative.tier1 : ''}
          isActive={currentTier === 1}
          onCopy={() => handleCopy(1, prompts.tier1)}
          onClick={onTierSelect ? () => onTierSelect(1) : undefined}
          compact={compact}
          compressionLookup={compressionLookup}
          platformId={platformId}
        />
        <TierCard
          tier={2}
          positive={prompts.tier2}
          negative={showNegative ? prompts.negative.tier2 : ''}
          isActive={currentTier === 2}
          onCopy={() => handleCopy(2, prompts.tier2)}
          onClick={onTierSelect ? () => onTierSelect(2) : undefined}
          compact={compact}
          compressionLookup={compressionLookup}
          platformId={platformId}
        />
        <TierCard
          tier={3}
          positive={prompts.tier3}
          negative={showNegative ? prompts.negative.tier3 : ''}
          isActive={currentTier === 3}
          onCopy={() => handleCopy(3, prompts.tier3)}
          onClick={onTierSelect ? () => onTierSelect(3) : undefined}
          compact={compact}
          compressionLookup={compressionLookup}
          platformId={platformId}
        />
        <TierCard
          tier={4}
          positive={prompts.tier4}
          negative={showNegative ? prompts.negative.tier4 : ''}
          isActive={currentTier === 4}
          onCopy={() => handleCopy(4, prompts.tier4)}
          onClick={onTierSelect ? () => onTierSelect(4) : undefined}
          compact={compact}
          compressionLookup={compressionLookup}
          platformId={platformId}
        />
      </div>
      
      {/* Educational note */}
      <div className="p-3 rounded-lg bg-gradient-to-r from-sky-500/10 via-emerald-500/10 to-indigo-500/10 border border-white/10">
        <div className="flex items-start gap-2">
          <span className="text-base">💡</span>
          <div>
            <p className="text-xs text-white/70">
              <strong>Compare:</strong> Each tier formats your prompt differently.
            </p>
            <p className="text-[10px] text-white/50 mt-1">
              T1 uses <code className="text-sky-400">(term:1.2)</code> weights • 
              T2 uses <code className="text-purple-400">--no</code> • 
              T3 uses sentences • 
              T4 keeps it simple
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// ICONS
// ============================================================================

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

// ============================================================================
// EXPORTS
// ============================================================================

export default FourTierPromptPreview;
