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

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import Image from 'next/image';
import type { GeneratedPrompts, PlatformTier } from '../../types/prompt-intelligence';
import { TIER_CONFIGS } from '../../types/prompt-intelligence';
import { getPlatformTierId } from '@/data/platform-tiers';
import {
  lookupBestOptimalChars,
  lookupOptimalLength,
  type CompressionLookup,
} from '@/lib/learning/compression-lookup';
import {
  CATEGORY_COLOURS,
  parsePromptIntoSegments,
} from '@/lib/prompt-colours';
import type { PromptCategory } from '@/types/prompt-builder';
import { TierGenerationCycling } from '@/components/prompt-lab/tier-generation-cycling';
import { sendTrackEvent, getOrCreateSessionId } from '@/hooks/use-index-rating-events';

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
  /** Pro Promagen: enable colour-coded prompt anatomy */
  isPro?: boolean;
  /** Pro Promagen: term → category lookup for colour coding */
  termIndex?: Map<string, PromptCategory>;
  // ── AI Disguise (ai-disguise.md §7) ───────────────────────────────
  /** Whether AI tier generation is in progress (shows shimmer overlay) */
  isTierGenerating?: boolean;
  /** Provider name the tiers were generated for (shows badge, null = generic) */
  generatedForProvider?: string | null;
  /** All providers — used to show tier-grouped provider icons */
  providers?: { id: string; name: string; localIcon?: string }[];
  /** Category names populated by Call 1 — feeds category-aware algorithm cycling */
  activeCategories?: string[];
  /** Increments on new API generation. Same ID = tab switch → instant text. New ID = typewrite. */
  generationId?: number;
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
  /** Pro Promagen: enable colour-coded prompt anatomy */
  isPro?: boolean;
  /** Pro Promagen: term → category lookup for colour coding */
  termIndex?: Map<string, PromptCategory>;
  /** Increments on new API generation. Same ID = tab switch → show instant. Undefined = always typewrite (standard builder). */
  generationId?: number;
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
    statusColor = 'text-slate-300';
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
          className="text-slate-300 font-medium"
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
  isPro = false,
  termIndex,
  generationId,
}: TierCardProps) {
  const [copied, setCopied] = useState(false);
  const config = TIER_CONFIGS[tier];

  // ── Typewriter reveal ─────────────────────────────────────────────
  // When generationId is provided (Prompt Lab): typewrite ONLY on new
  // API generation (generationId changes). Tab switch = instant.
  // When generationId is undefined (standard builder): typewrite on
  // every text change (original behaviour).
  const [visibleChars, setVisibleChars] = useState(0);
  const prevPositiveRef = useRef('');
  const prevGenIdRef = useRef(generationId);
  const typewriterTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const staggerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const prev = prevPositiveRef.current;
    const prevGenId = prevGenIdRef.current;
    prevPositiveRef.current = positive;
    prevGenIdRef.current = generationId;

    // Clean up any existing timers
    if (typewriterTimerRef.current) { clearInterval(typewriterTimerRef.current); typewriterTimerRef.current = null; }
    if (staggerTimerRef.current) { clearTimeout(staggerTimerRef.current); staggerTimerRef.current = null; }

    // No text → instant reset
    if (!positive) {
      setVisibleChars(0);
      return;
    }

    // Same text → show all (no re-animation)
    if (positive === prev) {
      setVisibleChars(positive.length);
      return;
    }

    // When generationId is provided: only typewrite if it changed (new API call).
    // Same generationId = tab switch → show instantly.
    if (generationId !== undefined && generationId === prevGenId) {
      setVisibleChars(positive.length);
      return;
    }

    // New generation (or standard builder with no generationId) → typewrite
    const isFresh = !prev;
    const speed = isFresh ? 25 : 5;
    const delay = isFresh ? (tier - 1) * 500 : (tier - 1) * 80;

    setVisibleChars(0);

    const startTyping = () => {
      let chars = 0;
      typewriterTimerRef.current = setInterval(() => {
        chars += 1;
        if (chars >= positive.length) {
          setVisibleChars(positive.length);
          if (typewriterTimerRef.current) { clearInterval(typewriterTimerRef.current); typewriterTimerRef.current = null; }
        } else {
          setVisibleChars(chars);
        }
      }, speed);
    };

    if (delay > 0) {
      staggerTimerRef.current = setTimeout(startTyping, delay);
    } else {
      startTyping();
    }

    return () => {
      if (typewriterTimerRef.current) clearInterval(typewriterTimerRef.current);
      if (staggerTimerRef.current) clearTimeout(staggerTimerRef.current);
    };
  }, [positive, tier, generationId]);

  // The text to display — typewriter-sliced
  const displayText = positive.slice(0, visibleChars);
  const isTyping = visibleChars < positive.length && positive.length > 0;

  // ── Negative text typewriter (Tier 2 only) ────────────────────────
  // Starts after positive typewriter completes. Same speed, no stagger.
  const [negVisibleChars, setNegVisibleChars] = useState(0);
  const negTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const negStartedRef = useRef(false);
  const prevNegativeRef = useRef('');

  useEffect(() => {
    const prevNeg = prevNegativeRef.current;
    prevNegativeRef.current = negative ?? '';

    // Clean up
    if (negTimerRef.current) { clearInterval(negTimerRef.current); negTimerRef.current = null; }

    // Reset when no text or negative changed (new generation)
    if (!negative || !positive || negative !== prevNeg) {
      setNegVisibleChars(0);
      negStartedRef.current = false;
    }

    // Also reset when positive is still typing (new generation in progress)
    if (visibleChars < (positive?.length ?? 0)) {
      negStartedRef.current = false;
      setNegVisibleChars(0);
      return;
    }

    // Start negative typing when positive finishes
    if (visibleChars >= positive.length && positive.length > 0 && negative && !negStartedRef.current) {
      negStartedRef.current = true;
      const speed = prevPositiveRef.current === positive ? 25 : 5;
      let chars = 0;

      negTimerRef.current = setInterval(() => {
        chars += 1;
        if (chars >= negative.length) {
          setNegVisibleChars(negative.length);
          if (negTimerRef.current) { clearInterval(negTimerRef.current); negTimerRef.current = null; }
        } else {
          setNegVisibleChars(chars);
        }
      }, speed);
    }

    return () => {
      if (negTimerRef.current) clearInterval(negTimerRef.current);
    };
  }, [visibleChars, positive, negative]);

  const negDisplayText = negative ? negative.slice(0, negVisibleChars) : '';
  const isNegTyping = negative ? negVisibleChars > 0 && negVisibleChars < negative.length : false;
  
  const handleCopy = useCallback(async () => {
    const text = tier === 2 && negative
      ? `${positive} ${negative}`
      : positive;
    
    await navigator.clipboard.writeText(text);
    setCopied(true);
    onCopy();

    // ★ Index Rating: tier prompt copied (6pts, K=24)
    // platformId is 'playground' when no provider selected — skip tracking
    if (platformId && platformId !== 'playground') {
      sendTrackEvent(platformId, 'prompt_lab_copy', `tier_${tier}_copy`, getOrCreateSessionId());
    }
    
    setTimeout(() => setCopied(false), 2000);
  }, [positive, negative, tier, onCopy, platformId]);

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
            ${isActive ? 'bg-white text-black' : 'bg-white/10 text-slate-200'}
          `}>
            {tier}
          </span>
          <div>
            <h4 className={`font-semibold text-sm ${isActive ? 'text-white' : 'text-slate-200'}`}>
              {config.name}
            </h4>
            {!compact && (
              <p className="text-xs text-slate-300">
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
                ${isActive ? 'bg-white/20 text-white' : 'bg-white/5 text-slate-300'}
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
          ${isActive ? 'text-white' : 'text-slate-200'}
          ${!positive && 'italic text-slate-300'}
        `}>
          {!positive
            ? 'Select options to generate prompt...'
            : isPro && termIndex && termIndex.size > 0
              ? (() => {
                  const segments = parsePromptIntoSegments(displayText, termIndex);
                  const hasAnatomy = segments.some((s) => s.category !== 'structural');
                  if (!hasAnatomy) return displayText;
                  return segments.map((seg, i) => {
                    const c = CATEGORY_COLOURS[seg.category] ?? CATEGORY_COLOURS.structural;
                    const isStructural = seg.category === 'structural';
                    return (
                      <span
                        key={i}
                        style={!isStructural ? {
                          color: c,
                          textShadow: seg.weight >= 1.05 ? `0 0 10px ${c}50` : undefined,
                        } : undefined}
                      >
                        {seg.text}
                      </span>
                    );
                  });
                })()
              : displayText
          }
          {/* Typewriter cursor */}
          {isTyping && (
            <span className="animate-pulse" style={{ color: '#94A3B8' }}>▌</span>
          )}
        </p>
        
        {/* Negative for tier 2 — typewriter in after positive completes */}
        {tier === 2 && negative && !isTyping && negVisibleChars > 0 && (
          <p className="mt-2 text-red-400/80 break-words">
            {negDisplayText}
            {isNegTyping && (
              <span className="animate-pulse" style={{ color: '#F87171' }}>▌</span>
            )}
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
            ? `cursor-pointer ${isActive
                ? 'bg-white text-black hover:bg-white/90'
                : 'bg-white/10 text-white hover:bg-white/20'
              }`
            : 'bg-white/5 text-slate-300 cursor-not-allowed'
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
// TIER PROVIDER ICONS — shows all providers for the active tier
// ============================================================================
// Styling matches PotM "Try in" provider icons (prompt-showcase.tsx lines 263-288)
// but non-clickable. Hover: glow + scale-110.

const TIER_PROVIDER_ICON_STYLES = `
  @keyframes tier-icon-glow {
    0%, 100% { box-shadow: 0 0 6px rgba(255,255,255,0.2); }
    50% { box-shadow: 0 0 14px rgba(255,255,255,0.5); }
  }
  .tier-provider-icon:hover {
    transform: scale(1.1);
    box-shadow: 0 0 12px rgba(255,255,255,0.35);
  }
  @media (prefers-reduced-motion: reduce) {
    .tier-provider-icon:hover { transform: none; }
  }
`;

function TierProviderIcons({
  providers,
  activeTier,
}: {
  providers: { id: string; name: string; localIcon?: string }[];
  activeTier: PlatformTier;
}) {
  // Group providers by tier
  const tierProviders = useMemo(() => {
    const grouped: Record<number, { id: string; name: string; localIcon?: string }[]> = {
      1: [], 2: [], 3: [], 4: [],
    };
    for (const p of providers) {
      const tierId = getPlatformTierId(p.id);
      if (tierId && grouped[tierId]) {
        grouped[tierId].push(p);
      }
    }
    return grouped;
  }, [providers]);

  const activeProviders = tierProviders[activeTier] ?? [];
  if (activeProviders.length === 0) return null;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: TIER_PROVIDER_ICON_STYLES }} />
      <div
        className="flex flex-wrap items-center justify-center"
        style={{ gap: 'clamp(5px, 0.4vw, 8px)', padding: 'clamp(4px, 0.3vw, 6px) 0' }}
      >
        {activeProviders.map((p) => (
          <div
            key={p.id}
            className="tier-provider-icon inline-flex shrink-0 cursor-default items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/10 transition-all"
            style={{
              width: 'clamp(30px, 2.3vw, 38px)',
              height: 'clamp(30px, 2.3vw, 38px)',
            }}
            title={p.name}
          >
            {p.localIcon ? (
              <Image
                src={p.localIcon}
                alt={p.name}
                width={24}
                height={24}
                className="rounded-sm"
                style={{
                  width: 'clamp(18px, 1.5vw, 24px)',
                  height: 'clamp(18px, 1.5vw, 24px)',
                  filter: 'drop-shadow(0 0 3px rgba(255,255,255,0.4))',
                }}
              />
            ) : (
              <span
                className="text-slate-200 font-medium"
                style={{ fontSize: 'clamp(0.5rem, 0.55vw, 0.65rem)' }}
              >
                {p.name.slice(0, 2)}
              </span>
            )}
          </div>
        ))}
      </div>
    </>
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
  isPro = false,
  termIndex,
  isTierGenerating = false,
  generatedForProvider = null,
  providers = [],
  activeCategories = [],
  generationId,
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
          <span className="text-xs text-white font-medium">
            Tier {currentTier}: {TIER_CONFIGS[currentTier].name}
          </span>
        </div>

        {/* Tier provider icons — all providers in this tier family */}
        {providers.length > 0 && (
          <TierProviderIcons providers={providers} activeTier={currentTier} />
        )}
        
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
          isPro={isPro}
          termIndex={termIndex}
          generationId={generationId}
        />
      </div>
    );
  }
  
  // Multi-tier mode: show all 4 tiers (playground neutral mode)
  return (
    <div className="space-y-4" style={{ position: 'relative' }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
          🎯 4-Tier Prompt Variants
          {/* AI Disguise: "Generated for X" badge (ai-disguise.md §7) */}
          {generatedForProvider && !isTierGenerating && (
            <span
              style={{
                fontSize: 'clamp(0.56rem, 0.58vw, 0.65rem)',
                padding: 'clamp(1px, 0.15vw, 3px) clamp(6px, 0.5vw, 8px)',
                borderRadius: 'clamp(3px, 0.3vw, 4px)',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                backgroundColor: 'rgba(139, 92, 246, 0.1)',
                color: '#C4B5FD',
                fontWeight: 500,
                whiteSpace: 'nowrap',
              }}
            >
              Generated for {generatedForProvider}
            </span>
          )}
          {/* Loading indicator during AI tier generation */}
          {isTierGenerating && (
            <span
              style={{
                fontSize: 'clamp(0.56rem, 0.58vw, 0.65rem)',
                color: '#FBBF24',
                fontWeight: 500,
              }}
            >
              Processing
            </span>
          )}
        </h3>
        <p className="text-xs text-white font-medium">
          Same scene, different syntaxes
        </p>
      </div>

      {/* AI Disguise: Algorithm cycling during tier generation (Call 2) */}
      {/* 101 algorithm names cycle rapidly in amber monospace — §3 Anticipatory Dopamine */}
      <TierGenerationCycling isActive={isTierGenerating ?? false} activeCategories={activeCategories} />

      {/* Tier provider icons — all providers in the active tier family */}
      {providers.length > 0 && (
        <TierProviderIcons providers={providers} activeTier={currentTier} />
      )}
      
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
          isPro={isPro}
          termIndex={termIndex}
          generationId={generationId}
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
          isPro={isPro}
          termIndex={termIndex}
          generationId={generationId}
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
          isPro={isPro}
          termIndex={termIndex}
          generationId={generationId}
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
          isPro={isPro}
          termIndex={termIndex}
          generationId={generationId}
        />
      </div>
      
      {/* Educational note */}
      <div className="p-3 rounded-lg bg-gradient-to-r from-sky-500/10 via-emerald-500/10 to-indigo-500/10 border border-white/10">
        <div className="flex items-start gap-2">
          <span className="text-base">💡</span>
          <div>
            <p className="text-xs text-white">
              <strong>Compare:</strong> Each tier formats your prompt differently.
            </p>
            <p className="text-[10px] text-slate-300 mt-1">
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
