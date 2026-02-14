// src/components/ribbon/commodity-prompt-tooltip.tsx
// ============================================================================
// COMMODITY PROMPT TOOLTIP v2.0 — Multi-Tier Pro Display
// ============================================================================
// Tooltip that displays dynamically generated image prompts for commodities.
//
// v2.0: Blueprint-driven prompts. Pro users see all 4 tiers with individual
//       copy buttons. Free users see tier 4 only (unchanged behaviour).
//
// ARCHITECTURE:
// - Mirrors WeatherPromptTooltip exactly (Portal, 400ms hover, copy icon)
// - Glow colour driven by commodity GROUP + sentiment
//     Energy     → amber glow
//     Agriculture → emerald glow
//     Metals     → silver/slate glow
//
// FREE USER:
//   Header → Tier 4 prompt → copy button
//
// PRO USER:
//   Header → Selected tier prompt (expanded) → 4 tier row buttons (each copyable)
//   Active tier highlighted with colour accent. Other tiers show label + copy.
//
// Authority: go-big-or-go-home-prompt-builder.md v2 §Phase 3
// Authority: best-working-practice.md §Tooltip Standards
// Existing features preserved: Yes (all props, glow, portal, timing unchanged)
// ============================================================================

'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  generateCommodityPrompt,
  deriveSentiment,
  getGlowConfig,
} from '@/lib/commodities/commodity-prompt-generator';
import type { PromptTier } from '@/lib/weather/weather-prompt-generator';
import type {
  CommodityGroup,
  CommodityWeatherSlice,
  AllTierPrompts,
} from '@/lib/commodities/commodity-prompt-types';
import type { Season } from '@/lib/commodities/country-weather-resolver';

// ============================================================================
// TYPES
// ============================================================================

export interface CommodityPromptTooltipProps {
  /** Trigger element (usually the Flag component) */
  children: React.ReactNode;
  /** Commodity ID from catalog (e.g., "gold", "brent_crude") */
  commodityId: string;
  /** Display name (e.g., "Gold", "Brent Crude") */
  commodityName: string;
  /** High-level commodity group */
  group: CommodityGroup;
  /** Percentage change from previous close */
  deltaPct: number;
  /** Scene country code for prompt generation */
  sceneCountryCode: string;
  /** Season at the scene country */
  season: Season;
  /** Weather data for scene country (null = skip weather layer) */
  weather?: CommodityWeatherSlice | null;
  /** Current hour at scene country (0-23) */
  localHour?: number;
  /** Prompt tier (1-4). Default: 4 (Plain Language) */
  tier?: PromptTier;
  /** Flag position index on the mover card (0-3) for stage rotation */
  flagIndex?: number;
  /** Whether user is Pro (for multi-tier display) */
  isPro?: boolean;
  /**
   * Which rail the trigger is on — determines tooltip open direction.
   * - 'left' = trigger is on left rail → tooltip opens to the RIGHT
   * - 'right' = trigger is on right rail → tooltip opens to the LEFT
   */
  tooltipPosition?: 'left' | 'right';
  /**
   * Vertical alignment of tooltip relative to trigger.
   * 'center' = vertically centered on trigger (default)
   * 'below' = positioned below the trigger
   */
  verticalPosition?: 'center' | 'below';
  /** Disable the tooltip (renders children only) */
  disabled?: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Delay before tooltip closes after mouse leaves (ms). */
const CLOSE_DELAY_MS = 400;

/** Gap between trigger and tooltip (px). */
const TOOLTIP_GAP = 8;

/** Tooltip width (px). */
const TOOLTIP_WIDTH = 450;

// ============================================================================
// TIER META
// ============================================================================

/** Tier display info for the tooltip */
interface TierMeta {
  label: string;
  shortLabel: string;
  platforms: string;
  accentClass: string;
  dotClass: string;
}

const TIER_META: Record<number, TierMeta> = {
  1: {
    label: 'CLIP-Based',
    shortLabel: 'CLIP',
    platforms: 'Stable Diffusion · Leonardo · Flux',
    accentClass: 'text-blue-400',
    dotClass: 'bg-blue-400',
  },
  2: {
    label: 'Midjourney',
    shortLabel: 'MJ',
    platforms: 'Midjourney · BlueWillow',
    accentClass: 'text-purple-400',
    dotClass: 'bg-purple-400',
  },
  3: {
    label: 'Natural Language',
    shortLabel: 'NatLang',
    platforms: 'DALL·E · Imagen · Adobe Firefly',
    accentClass: 'text-emerald-400',
    dotClass: 'bg-emerald-400',
  },
  4: {
    label: 'Plain Language',
    shortLabel: 'Plain',
    platforms: 'Canva · Craiyon · Microsoft Designer',
    accentClass: 'text-orange-400',
    dotClass: 'bg-orange-400',
  },
};

// ============================================================================
// HELPERS
// ============================================================================

function hexToRgba(hex: string, alpha: number): string {
  if (hex.startsWith('rgba')) return hex;
  if (hex.startsWith('rgb')) {
    return hex.replace('rgb', 'rgba').replace(')', `, ${alpha})`);
  }

  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);

  if (isNaN(r) || isNaN(g) || isNaN(b)) {
    return `rgba(148, 163, 184, ${alpha})`;
  }

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ============================================================================
// COPY ICON COMPONENT
// ============================================================================

interface CopyIconProps {
  onClick: () => void;
  copied: boolean;
  size?: 'sm' | 'md';
}

function CopyIcon({ onClick, copied, size = 'md' }: CopyIconProps) {
  const sizeClasses = size === 'sm' ? 'w-5 h-5' : 'w-6 h-6';
  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5';

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`
        inline-flex items-center justify-center
        ${sizeClasses} rounded-md
        transition-all duration-200
        ${
          copied
            ? 'bg-emerald-500/20 text-emerald-400'
            : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200'
        }
      `}
      title={copied ? 'Copied!' : 'Copy prompt'}
      aria-label={copied ? 'Copied to clipboard' : 'Copy prompt to clipboard'}
    >
      {copied ? (
        <svg
          className={iconSize}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg
          className={iconSize}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        </svg>
      )}
    </button>
  );
}

// ============================================================================
// PRO TIER ROW — compact row for one tier in multi-tier view
// ============================================================================

interface ProTierRowProps {
  tierNum: 1 | 2 | 3 | 4;
  promptText: string;
  isActive: boolean;
  onCopy: (text: string) => void;
}

function ProTierRow({ tierNum, promptText, isActive, onCopy }: ProTierRowProps) {
  const [copied, setCopied] = useState(false);
  const meta = TIER_META[tierNum] ?? {
    dotClass: 'bg-orange-400',
    accentClass: 'text-orange-400',
    label: 'Plain',
    shortLabel: 'Plain',
    platforms: '',
  };

  const handleCopy = useCallback(() => {
    navigator.clipboard
      .writeText(promptText)
      .then(() => {
        setCopied(true);
        onCopy(promptText);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(console.error);
  }, [promptText, onCopy]);

  return (
    <div
      className={`
        group flex items-start gap-2.5 rounded-lg px-3 py-2.5
        transition-all duration-200
        ${isActive ? 'bg-white/8 ring-1 ring-white/15' : 'bg-white/[0.03] hover:bg-white/[0.06]'}
      `}
    >
      {/* Tier colour dot + label */}
      <div className="flex items-center gap-2 shrink-0 pt-0.5">
        <span
          className={`w-2 h-2 rounded-full ${meta.dotClass} ${isActive ? 'opacity-100' : 'opacity-50'}`}
        />
        <span
          className={`text-xs font-semibold w-9 ${isActive ? meta.accentClass : 'text-slate-500'}`}
        >
          T{tierNum}
        </span>
      </div>

      {/* Prompt preview — expanded for active, truncated for inactive */}
      <div className="flex-1 min-w-0">
        {isActive ? (
          <>
            <p className="text-[11px] text-slate-400 mb-1 font-medium">
              {meta.label}
              <span className="text-slate-600 ml-1.5 font-normal">{meta.platforms}</span>
            </p>
            <p className="text-sm leading-relaxed text-slate-200 whitespace-pre-wrap break-words">
              {promptText}
            </p>
          </>
        ) : (
          <p className="text-xs text-slate-400 truncate leading-relaxed pt-0.5">
            <span className={`font-medium ${meta.accentClass} opacity-70`}>{meta.shortLabel}</span>
            <span className="text-slate-600 mx-1.5">·</span>
            <span className="text-slate-500">{promptText.slice(0, 90)}…</span>
          </p>
        )}
      </div>

      {/* Copy button */}
      <div className="shrink-0 pt-0.5">
        <CopyIcon onClick={handleCopy} copied={copied} size="sm" />
      </div>
    </div>
  );
}

// ============================================================================
// TOOLTIP CONTENT — FREE USER (single tier, same as v1.0)
// ============================================================================

interface FreeTooltipContentProps {
  prompt: string;
  tier: PromptTier;
  glowColor: string;
  group: CommodityGroup;
  position: { top: number; left: number };
  verticalPosition: 'center' | 'below';
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onCopy: () => void;
  copied: boolean;
}

/** Group label for the tooltip header */
const GROUP_LABELS: Record<CommodityGroup, string> = {
  energy: 'Energy',
  agriculture: 'Agriculture',
  metals: 'Metals',
};

/** Group badge colours */
const GROUP_BADGE_CLASSES: Record<CommodityGroup, string> = {
  energy: 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30',
  agriculture: 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30',
  metals: 'bg-slate-400/20 text-slate-300 ring-1 ring-slate-400/30',
};

function FreeTooltipContent({
  prompt,
  tier,
  glowColor,
  group,
  position,
  verticalPosition,
  onMouseEnter,
  onMouseLeave,
  onCopy,
  copied,
}: FreeTooltipContentProps) {
  const glowRgba = hexToRgba(glowColor, 0.3);
  const glowBorder = hexToRgba(glowColor, 0.5);
  const glowSoft = hexToRgba(glowColor, 0.15);

  return (
    <div
      role="tooltip"
      className="fixed rounded-xl px-6 py-4 text-sm text-slate-100"
      style={{
        top: position.top,
        left: position.left,
        transform: verticalPosition === 'below' ? 'none' : 'translateY(-50%)',
        zIndex: 99999,
        background: 'rgba(15, 23, 42, 0.97)',
        border: `1px solid ${glowBorder}`,
        boxShadow: `0 0 40px 8px ${glowRgba}, 0 0 80px 16px ${glowSoft}, inset 0 0 25px 3px ${glowRgba}`,
        width: `${TOOLTIP_WIDTH}px`,
        maxWidth: `${TOOLTIP_WIDTH}px`,
        minWidth: '300px',
        pointerEvents: 'auto',
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Ethereal glow overlay — top radial */}
      <div
        className="absolute inset-0 rounded-xl pointer-events-none overflow-hidden"
        style={{
          background: `radial-gradient(ellipse at 50% 0%, ${glowRgba} 0%, transparent 70%)`,
        }}
      />
      {/* Bottom glow accent */}
      <div
        className="absolute inset-0 rounded-xl pointer-events-none overflow-hidden"
        style={{
          background: `radial-gradient(ellipse at 50% 100%, ${glowSoft} 0%, transparent 60%)`,
          opacity: 0.6,
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 mb-1">
          <span
            className="text-base font-semibold text-white"
            style={{ textShadow: `0 0 12px ${glowRgba}` }}
          >
            Image Prompt
          </span>
          <span className={`px-2 py-0.5 text-xs font-medium rounded ${GROUP_BADGE_CLASSES[group]}`}>
            {GROUP_LABELS[group]}
          </span>
        </div>

        {/* Tier indicator */}
        <span className="text-xs text-slate-500 -mt-1">
          Tier {tier}: {TIER_META[tier]?.label ?? 'Plain'}
        </span>

        {/* Prompt text */}
        <p
          className="text-sm leading-relaxed text-slate-200 whitespace-pre-wrap break-words"
          style={{ maxWidth: '420px' }}
        >
          {prompt}
        </p>

        {/* Copy button row */}
        <div className="flex justify-end mt-2 pt-3 border-t border-white/10">
          <CopyIcon onClick={onCopy} copied={copied} />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// TOOLTIP CONTENT — PRO USER (all 4 tiers)
// ============================================================================

interface ProTooltipContentProps {
  allPrompts: AllTierPrompts;
  activeTier: PromptTier;
  glowColor: string;
  group: CommodityGroup;
  position: { top: number; left: number };
  verticalPosition: 'center' | 'below';
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  blueprintUsed: boolean;
}

function ProTooltipContent({
  allPrompts,
  activeTier,
  glowColor,
  group,
  position,
  verticalPosition,
  onMouseEnter,
  onMouseLeave,
  blueprintUsed,
}: ProTooltipContentProps) {
  const glowRgba = hexToRgba(glowColor, 0.3);
  const glowBorder = hexToRgba(glowColor, 0.5);
  const glowSoft = hexToRgba(glowColor, 0.15);

  const handleTierCopy = useCallback((_text: string) => {
    // Could track analytics here in future
  }, []);

  const tiers: Array<{ num: 1 | 2 | 3 | 4; text: string }> = [
    { num: 1, text: allPrompts.tier1 },
    { num: 2, text: allPrompts.tier2 },
    { num: 3, text: allPrompts.tier3 },
    { num: 4, text: allPrompts.tier4 },
  ];

  return (
    <div
      role="tooltip"
      className="fixed rounded-xl px-5 py-4 text-sm text-slate-100"
      style={{
        top: position.top,
        left: position.left,
        transform: verticalPosition === 'below' ? 'none' : 'translateY(-50%)',
        zIndex: 99999,
        background: 'rgba(15, 23, 42, 0.97)',
        border: `1px solid ${glowBorder}`,
        boxShadow: `0 0 40px 8px ${glowRgba}, 0 0 80px 16px ${glowSoft}, inset 0 0 25px 3px ${glowRgba}`,
        width: `${TOOLTIP_WIDTH}px`,
        maxWidth: `${TOOLTIP_WIDTH}px`,
        minWidth: '300px',
        maxHeight: '80vh',
        pointerEvents: 'auto',
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Glow overlays */}
      <div
        className="absolute inset-0 rounded-xl pointer-events-none overflow-hidden"
        style={{
          background: `radial-gradient(ellipse at 50% 0%, ${glowRgba} 0%, transparent 70%)`,
        }}
      />
      <div
        className="absolute inset-0 rounded-xl pointer-events-none overflow-hidden"
        style={{
          background: `radial-gradient(ellipse at 50% 100%, ${glowSoft} 0%, transparent 60%)`,
          opacity: 0.6,
        }}
      />

      {/* Content */}
      <div
        className="relative z-10 flex flex-col gap-3 overflow-y-auto"
        style={{ maxHeight: 'calc(80vh - 32px)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <span
            className="text-base font-semibold text-white"
            style={{ textShadow: `0 0 12px ${glowRgba}` }}
          >
            Image Prompt
          </span>
          <div className="flex items-center gap-2">
            <span
              className={`px-2 py-0.5 text-xs font-medium rounded ${GROUP_BADGE_CLASSES[group]}`}
            >
              {GROUP_LABELS[group]}
            </span>
            <span className="px-2 py-0.5 text-xs font-semibold rounded bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30">
              PRO
            </span>
          </div>
        </div>

        {/* Subtitle */}
        <p className="text-[11px] text-slate-500 -mt-1">
          4 platform-optimised prompts
          {blueprintUsed && <span className="text-slate-600 ml-1">· Blueprint</span>}
        </p>

        {/* Tier rows — active tier expanded, others collapsed */}
        <div className="flex flex-col gap-1.5">
          {tiers.map(({ num, text }) => (
            <ProTierRow
              key={num}
              tierNum={num}
              promptText={text}
              isActive={num === activeTier}
              onCopy={handleTierCopy}
            />
          ))}
        </div>

        {/* Pro tip footer */}
        <div className="flex items-center gap-2 pt-2 border-t border-white/[0.06]">
          <span className="text-[10px] text-slate-600">
            Copy any tier for your preferred AI image generator
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * Commodity prompt tooltip with dynamic image prompt generation.
 * Shows on hover over flag with commodity-group-based glow.
 *
 * BEHAVIOUR (mirrors WeatherPromptTooltip):
 * - React Portal at document.body (escapes all containers)
 * - 400ms close delay allows cursor to reach tooltip for copy
 * - Hovering either trigger OR tooltip keeps it open
 * - cursor-pointer (NOT cursor-help)
 * - NO commodity name in header (flag image is sufficient)
 *
 * FREE: Single tier 4 prompt with copy button
 * PRO:  All 4 tiers displayed, active tier expanded, each copyable
 */
export function CommodityPromptTooltip({
  children,
  commodityId,
  commodityName,
  group,
  deltaPct,
  sceneCountryCode,
  season,
  weather = null,
  localHour = 12,
  tier = 3,
  flagIndex = 0,
  isPro = false,
  tooltipPosition = 'left',
  verticalPosition = 'center',
  disabled = false,
}: CommodityPromptTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const [tooltipCoords, setTooltipCoords] = useState({ top: 0, left: 0 });
  const [isMounted, setIsMounted] = useState(false);

  const triggerRef = useRef<HTMLSpanElement>(null);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Track mount state for Portal (SSR safety)
  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  // Generate prompt — always produces all 4 tiers
  const output = generateCommodityPrompt({
    commodityId,
    commodityName,
    group,
    deltaPct,
    tier,
    sceneCountryCode,
    season,
    weather: weather ?? null,
    localHour,
    flagIndex,
  });

  const prompt = output.prompt;
  const sentiment = deriveSentiment(deltaPct);
  const glow = getGlowConfig(group, sentiment);

  // Reset copied state after timeout
  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [copied]);

  // Cleanup close timeout on unmount
  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  /**
   * Calculate tooltip position based on trigger's viewport position.
   */
  const calculatePosition = useCallback(() => {
    if (!triggerRef.current) return;

    const rect = triggerRef.current.getBoundingClientRect();

    let left: number;
    if (tooltipPosition === 'left') {
      left = rect.right + TOOLTIP_GAP;
    } else {
      left = rect.left - TOOLTIP_WIDTH - TOOLTIP_GAP;
    }

    let top: number;
    if (verticalPosition === 'below') {
      top = rect.bottom + TOOLTIP_GAP;
    } else {
      top = rect.top + rect.height / 2;
    }

    setTooltipCoords({ top, left });
  }, [tooltipPosition, verticalPosition]);

  const clearCloseTimeout = useCallback(() => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  }, []);

  const startCloseDelay = useCallback(() => {
    clearCloseTimeout();
    closeTimeoutRef.current = setTimeout(() => {
      setIsVisible(false);
    }, CLOSE_DELAY_MS);
  }, [clearCloseTimeout]);

  const handleTriggerEnter = useCallback(() => {
    clearCloseTimeout();
    calculatePosition();
    setIsVisible(true);
  }, [clearCloseTimeout, calculatePosition]);

  const handleTriggerLeave = useCallback(() => {
    startCloseDelay();
  }, [startCloseDelay]);

  const handleTooltipEnter = useCallback(() => {
    clearCloseTimeout();
  }, [clearCloseTimeout]);

  const handleTooltipLeave = useCallback(() => {
    startCloseDelay();
  }, [startCloseDelay]);

  const handleCopy = useCallback(async () => {
    if (!prompt) return;
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
    } catch (err) {
      console.error('Failed to copy commodity prompt:', err);
    }
  }, [prompt]);

  // Disabled → render children only
  if (disabled) {
    return <>{children}</>;
  }

  return (
    <>
      {/* Trigger element — cursor-pointer (NOT cursor-help) */}
      <span
        ref={triggerRef}
        className="relative inline-flex cursor-pointer"
        onMouseEnter={handleTriggerEnter}
        onMouseLeave={handleTriggerLeave}
      >
        {children}
      </span>

      {/* Tooltip rendered via Portal at document.body */}
      {isMounted &&
        isVisible &&
        createPortal(
          isPro ? (
            <ProTooltipContent
              allPrompts={output.allPrompts}
              activeTier={tier}
              glowColor={glow.glowColor}
              group={group}
              position={tooltipCoords}
              verticalPosition={verticalPosition}
              onMouseEnter={handleTooltipEnter}
              onMouseLeave={handleTooltipLeave}
              blueprintUsed={output.blueprintUsed}
            />
          ) : (
            <FreeTooltipContent
              prompt={prompt}
              tier={tier}
              glowColor={glow.glowColor}
              group={group}
              position={tooltipCoords}
              verticalPosition={verticalPosition}
              onMouseEnter={handleTooltipEnter}
              onMouseLeave={handleTooltipLeave}
              onCopy={handleCopy}
              copied={copied}
            />
          ),
          document.body,
        )}
    </>
  );
}

export default CommodityPromptTooltip;
