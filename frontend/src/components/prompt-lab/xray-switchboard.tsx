// src/components/prompt-lab/xray-switchboard.tsx
// ============================================================================
// XRAY SWITCHBOARD — Phase 2: Tier Generation Bars
// ============================================================================
// 4 horizontal bars (one per tier) that fill when Call 2 returns.
// Each bar fills proportionally to its word count. Split-flap counters
// show the actual word count with a mechanical flip animation.
//
// Human factors:
//   §6 Temporal Compression — four bars filling simultaneously occupies
//       working memory across multiple focal points. 2s wait feels like 0.5s.
//   §2 Variable Reward — different prompts produce different proportions.
//       A terse input makes T4 wider than T3. A rich input reverses it.
//
// Code standards:
//   - All sizing via clamp() — minimum 10px text (§6.0.1)
//   - No opacity dimming (§6.0.3) — colour changes for state
//   - Co-located animations (§6.2)
//   - prefers-reduced-motion: instant fill (§14.1)
//
// Authority: docs/authority/righthand-rail.md v1.2.0 §9
// Existing features preserved: Yes (new file).
// ============================================================================

'use client';

import React, { useState, useEffect, useRef } from 'react';
import type { GeneratedPrompts } from '@/types/prompt-intelligence';
import { XRayTeletype } from './xray-teletype';
import { XRaySplitFlap } from './xray-split-flap';

// ============================================================================
// CONSTANTS
// ============================================================================

const TIER_BARS = [
  { key: 'tier1' as const, label: 'T1', name: 'CLIP-Based', color: '#60a5fa', dimColor: '#4B7BB5' },
  { key: 'tier2' as const, label: 'T2', name: 'Midjourney', color: '#c084fc', dimColor: '#8A60B5' },
  { key: 'tier3' as const, label: 'T3', name: 'Natural Language', color: '#34d399', dimColor: '#2A9B70' },
  { key: 'tier4' as const, label: 'T4', name: 'Plain Language', color: '#fb923c', dimColor: '#B5682A' },
] as const;

/**
 * Darken a hex colour by mixing with dark background.
 * strength 0.0 = pure background, 1.0 = full colour.
 */
function muteColour(hex: string, strength: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const br = 10, bg = 13, bb = 20;
  const mr = Math.round(br + (r - br) * strength);
  const mg = Math.round(bg + (g - bg) * strength);
  const mb = Math.round(bb + (b - bb) * strength);
  return `#${mr.toString(16).padStart(2, '0')}${mg.toString(16).padStart(2, '0')}${mb.toString(16).padStart(2, '0')}`;
}

const COLOURS = {
  headerBrass: '#c084fc',   // Section header — Generate purple
  headerActive: '#FBBF24',
  warmAmber: '#FCD34D',
  lockEmerald: '#34D399',
} as const;

/** Bar fill animation duration (ms) */
const BAR_FILL_MS = 800;

// ============================================================================
// CO-LOCATED STYLES
// ============================================================================

const SWITCHBOARD_STYLES = `
  @keyframes xray-bar-shimmer {
    0% { background-position: -200% center; }
    100% { background-position: 200% center; }
  }
  .xray-bar-generating {
    background: linear-gradient(
      90deg,
      transparent 0%,
      rgba(251, 191, 36, 0.15) 50%,
      transparent 100%
    );
    background-size: 200% 100%;
    animation: xray-bar-shimmer 1.5s linear infinite;
  }
  @media (prefers-reduced-motion: reduce) {
    .xray-bar-generating {
      animation: none !important;
    }
  }
`;

// ============================================================================
// TYPES
// ============================================================================

export interface XRaySwitchboardProps {
  /** Call 2 tier prompts — null when not yet generated */
  tierPrompts: GeneratedPrompts | null;
  /** Whether Call 2 is currently in flight */
  isGenerating: boolean;
  /** Generation ID for cancellation model */
  generationId: number;
}

// ============================================================================
// HELPERS
// ============================================================================

function wordCount(text: string): number {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// ============================================================================
// SINGLE BAR
// ============================================================================

function TierBar({
  tier,
  words,
  maxWords,
  isGenerating,
  isFilled,
}: {
  tier: typeof TIER_BARS[number];
  words: number;
  maxWords: number;
  isGenerating: boolean;
  isFilled: boolean;
}) {
  const fillPercent = maxWords > 0 ? Math.max(15, (words / maxWords) * 100) : 0;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'clamp(6px, 0.5vw, 8px)',
      }}
    >
      {/* Tier label */}
      <span
        style={{
          fontSize: 'clamp(0.65rem, 0.8vw, 0.875rem)',
          fontWeight: 700,
          color: isFilled ? tier.color : tier.dimColor,
          width: 'clamp(18px, 1.5vw, 22px)',
          textAlign: 'right',
          flexShrink: 0,
          userSelect: 'none',
          lineHeight: 1,
          transition: 'color 0.4s ease',
        }}
      >
        {tier.label}
      </span>

      {/* Bar track + fill */}
      <div
        style={{
          flex: 1,
          height: 'clamp(6px, 0.5vw, 8px)',
          borderRadius: 'clamp(3px, 0.2vw, 4px)',
          backgroundColor: muteColour(tier.color, 0.15),
          overflow: 'hidden',
          position: 'relative',
        }}
        aria-label={`Tier ${tier.label}: ${isFilled ? `${words} words` : isGenerating ? 'generating...' : 'waiting'}`}
      >
        {/* Generating shimmer */}
        {isGenerating && !isFilled && (
          <div
            className="xray-bar-generating"
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 'inherit',
            }}
          />
        )}

        {/* Fill bar */}
        {isFilled && (
          <div
            style={{
              height: '100%',
              width: `${fillPercent}%`,
              backgroundColor: tier.color,
              borderRadius: 'inherit',
              transition: `width ${BAR_FILL_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
            }}
          />
        )}
      </div>

      {/* Word count — split-flap counter */}
      <div style={{ width: 'clamp(50px, 4vw, 65px)', textAlign: 'right', flexShrink: 0 }}>
        {isFilled ? (
          <XRaySplitFlap
            value={words}
            digits={3}
            suffix=" words"
            duration={600}
            color={tier.color}
            fontSize="clamp(0.65rem, 0.8vw, 0.875rem)"
          />
        ) : (
          <span
            style={{
              fontSize: 'clamp(0.65rem, 0.8vw, 0.875rem)',
              color: tier.dimColor,
              fontFamily: "'SF Mono', 'Fira Code', monospace",
            }}
          >
            ---
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN SWITCHBOARD COMPONENT
// ============================================================================

export function XRaySwitchboard({ tierPrompts, isGenerating, generationId }: XRaySwitchboardProps) {
  const [isFilled, setIsFilled] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const genRef = useRef(generationId);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Compute word counts from tier prompts
  const wordCounts = {
    tier1: tierPrompts ? wordCount(tierPrompts.tier1) : 0,
    tier2: tierPrompts ? wordCount(tierPrompts.tier2) : 0,
    tier3: tierPrompts ? wordCount(tierPrompts.tier3) : 0,
    tier4: tierPrompts ? wordCount(tierPrompts.tier4) : 0,
  };
  const maxWords = Math.max(wordCounts.tier1, wordCounts.tier2, wordCounts.tier3, wordCounts.tier4, 1);

  // Reset when generating starts
  useEffect(() => {
    if (isGenerating) {
      genRef.current = generationId;
      setIsFilled(false);
      setShowSummary(false);
      if (timerRef.current) clearTimeout(timerRef.current);
    }
  }, [isGenerating, generationId]);

  // Fill bars when tier prompts arrive
  useEffect(() => {
    if (!tierPrompts || isGenerating) return;
    if (genRef.current !== generationId) return;

    // Small delay so the user sees the generating shimmer first
    timerRef.current = setTimeout(() => {
      if (genRef.current !== generationId) return;
      setIsFilled(true);

      // Summary after bars fill
      timerRef.current = setTimeout(() => {
        if (genRef.current !== generationId) return;
        setShowSummary(true);
      }, BAR_FILL_MS + 200);
    }, 150);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [tierPrompts, isGenerating, generationId]);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: SWITCHBOARD_STYLES }} />
      <div
        style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(6px, 0.5vw, 10px)' }}
        role="status"
        aria-live="polite"
        aria-label={
          isGenerating
            ? 'Generating tier prompts...'
            : tierPrompts
              ? '4 tier variants generated'
              : 'Switchboard — waiting for generation'
        }
      >
        {/* Section header */}
        <div
          style={{
            fontSize: 'clamp(0.7rem, 0.9vw, 1rem)',
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase' as const,
            color: isGenerating ? COLOURS.headerActive : COLOURS.headerBrass,
            lineHeight: 1,
            userSelect: 'none',
            transition: 'color 0.4s ease',
            marginBottom: 'clamp(6px, 0.5vw, 10px)',
          }}
          aria-hidden="true"
        >
          § The Switchboard
        </div>

        {/* 4 tier bars */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(4px, 0.3vw, 6px)' }}>
          {TIER_BARS.map((bar) => (
            <TierBar
              key={bar.key}
              tier={bar}
              words={wordCounts[bar.key]}
              maxWords={maxWords}
              isGenerating={isGenerating}
              isFilled={isFilled}
            />
          ))}
        </div>

        {/* Summary teletype */}
        {showSummary && (
          <div style={{ textAlign: 'center' }}>
            <XRayTeletype
              text="4 tier variants generated"
              speed={25}
              color={COLOURS.lockEmerald}
              fontSize="clamp(0.65rem, 0.8vw, 0.875rem)"
              generationId={generationId}
            />
          </div>
        )}
      </div>
    </>
  );
}

export default XRaySwitchboard;
