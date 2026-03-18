// src/components/exchanges/weather/weather-prompt-tooltip.tsx
// ============================================================================
// WEATHER PROMPT TOOLTIP - DYNAMIC IMAGE PROMPT GENERATOR
// ============================================================================
// Tooltip that displays dynamically generated image prompts based on weather.
// Features:
// - Temperature-based glow color (cold=blue, hot=red)
// - Copy icon to copy prompt to clipboard
// - Uses React Portal to render at document.body (escapes all containers)
// - 400ms hover persistence for easy copy access
// - Tier-based prompt format (surface-aware variety for free users)
// - Coloured tier badge (replaces plain text tier indicator)
// - Blurred tier previews for free users (Loss Aversion / Curiosity Gap)
//
// UPDATES (13 Mar 2026):
// - Coloured tier pill badge matching commodity tooltip TIER_META style
// - Free users: blurred preview rows for 3 other tiers with lock icon
// - "Unlock all formats" CTA linking to /pro-promagen
// - Fixed: text-slate-500 (banned §6.0.2) → coloured tier badge
// - Human Factors: Variable Reward (different tiers per surface),
//   Loss Aversion (see what you can't control), Curiosity Gap (blurred)
//
// UPDATES (26 Jan 2026):
// - REMOVED: Country/city name from tooltip header (flag is sufficient)
// - REMOVED: cursor-help (now cursor-pointer per best-working-practice.md)
// - FIXED: Tooltip position comment to match actual behavior
//
// UPDATES (20 Jan 2026):
// - Uses createPortal to render tooltip at document.body level
// - This allows tooltip to overflow into header space (no parent clipping)
// - 400ms close delay (configurable: CLOSE_DELAY_MS)
// - Tooltip stays open when hovering trigger OR tooltip itself
//
// Authority: docs/authority/ai_providers.md §4-Tier Prompt System
// Authority: docs/authority/best-working-practice.md §Tooltip Standards
// Authority: docs/authority/human-factors.md §Variable Reward, §Loss Aversion
// Existing features preserved: Yes
// ============================================================================

'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { SaveIcon } from '@/components/prompts/library/save-icon';
import {
  generateWeatherPrompt,
  getDefaultTier,
  type PromptTier,
} from '@/lib/weather/weather-prompt-generator';
import {
  getTemperatureColor,
  toFullWeather,
  type ExchangeWeatherDisplay,
} from '@/lib/weather/weather-types';

// ============================================================================
// TYPES
// ============================================================================

export interface WeatherPromptTooltipProps {
  /** Trigger element (usually the flag image) */
  children: React.ReactNode;
  /** City name for prompt generation (not displayed in tooltip header) */
  city: string;
  /** Timezone for deriving local hour */
  tz: string;
  /** Weather data for prompt generation */
  weather: ExchangeWeatherDisplay;
  /** Prompt tier (1-4). Defaults to 3 (Natural Language) for free users */
  tier?: PromptTier;
  /** Whether user is Pro (for styling) */
  isPro?: boolean;
  /** Callback to save tier selection (Pro users). Called when user clicks a tier row. */
  onTierChange?: (tier: PromptTier) => void;
  /**
   * Which rail the trigger is on — determines tooltip open direction.
   * - 'left' = trigger is on left rail → tooltip opens to the RIGHT
   * - 'right' = trigger is on right rail → tooltip opens to the LEFT
   */
  tooltipPosition?: 'left' | 'right';
  /**
   * Vertical alignment of tooltip relative to trigger.
   * 'center' = vertically centered on trigger (default)
   * 'below' = positioned below the trigger (auto-flips to center if viewport overflow)
   * 'above' = positioned above the trigger (tooltip bottom aligns with trigger top)
   */
  verticalPosition?: 'center' | 'below' | 'above' | 'top-third';
  /** Latitude for solar/lunar elevation calculation (lighting engine). Optional. */
  latitude?: number | null;
  /** Longitude for solar/lunar elevation calculation (lighting engine). Optional. */
  longitude?: number | null;
  /** Platform ID for save functionality. Optional — defaults to tier-based representative. */
  platformId?: string;
  /** Platform display name for save. Optional — defaults to tier-based name. */
  platformName?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Delay before tooltip closes after mouse leaves (ms).
 * Allows user to move cursor from trigger to tooltip for copy action.
 */
const CLOSE_DELAY_MS = 400;

/** Default platform per tier — used when caller doesn't provide platformId */
const TIER_DEFAULT_PLATFORM: Record<number, { id: string; name: string }> = {
  1: { id: 'leonardo', name: 'Leonardo AI' },
  2: { id: 'midjourney', name: 'Midjourney' },
  3: { id: 'openai', name: 'OpenAI DALL·E' },
  4: { id: 'canva', name: 'Canva' },
};

/** Gap between trigger and tooltip (px) */
const TOOLTIP_GAP = 8;

/** Tooltip dimensions for positioning calculations */
const TOOLTIP_WIDTH = 450;

/**
 * Tier display metadata — colours, labels, representative platforms.
 * Mirrors commodity-prompt-tooltip.tsx TIER_META exactly (compare, don't invent).
 */
interface TierMeta {
  label: string;
  shortLabel: string;
  platforms: string;
  accentClass: string;
  dotClass: string;
  bgClass: string;
  ringClass: string;
}

const TIER_META: Record<number, TierMeta> = {
  1: {
    label: 'CLIP-Based',
    shortLabel: 'CLIP',
    platforms: 'Stable Diffusion · Leonardo · Flux',
    accentClass: 'text-blue-400',
    dotClass: 'bg-blue-400',
    bgClass: 'bg-blue-500/15',
    ringClass: 'ring-blue-500/30',
  },
  2: {
    label: 'Midjourney Family',
    shortLabel: 'MJ',
    platforms: 'Midjourney · BlueWillow',
    accentClass: 'text-purple-400',
    dotClass: 'bg-purple-400',
    bgClass: 'bg-purple-500/15',
    ringClass: 'ring-purple-500/30',
  },
  3: {
    label: 'Natural Language',
    shortLabel: 'NatLang',
    platforms: 'DALL·E · Imagen · Adobe Firefly',
    accentClass: 'text-emerald-400',
    dotClass: 'bg-emerald-400',
    bgClass: 'bg-emerald-500/15',
    ringClass: 'ring-emerald-500/30',
  },
  4: {
    label: 'Plain Language',
    shortLabel: 'Plain',
    platforms: 'Canva · Craiyon · Microsoft Designer',
    accentClass: 'text-orange-400',
    dotClass: 'bg-orange-400',
    bgClass: 'bg-orange-500/15',
    ringClass: 'ring-orange-500/30',
  },
};

/** All 4 tiers for iteration */
const ALL_TIERS: PromptTier[] = [1, 2, 3, 4];

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Get local hour from timezone.
 */
function getLocalHour(tz: string): number {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: 'numeric',
      hour12: false,
    });
    const hour = parseInt(formatter.format(new Date()), 10);
    return isNaN(hour) ? 12 : hour;
  } catch {
    return 12; // Default to noon
  }
}

/**
 * Convert hex colour to rgba with alpha.
 */
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
    return `rgba(56, 189, 248, ${alpha})`;
  }

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ============================================================================
// COPY ICON COMPONENT
// ============================================================================

interface CopyIconProps {
  onClick: () => void;
  copied: boolean;
}

function CopyIcon({ onClick, copied }: CopyIconProps) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`
        inline-flex items-center justify-center
        w-6 h-6 rounded-md cursor-pointer
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
          className="w-3.5 h-3.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg
          className="w-3.5 h-3.5"
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
// LOCK ICON — used on blurred tier preview rows
// ============================================================================

function LockIcon() {
  return (
    <svg
      className="w-3 h-3 text-slate-400"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

// ============================================================================
// BLURRED TIER PREVIEW ROW — teaser for free users (Curiosity Gap)
// ============================================================================

interface BlurredTierRowProps {
  tierNum: PromptTier;
  previewText: string;
}

function BlurredTierRow({ tierNum, previewText }: BlurredTierRowProps) {
  const meta = TIER_META[tierNum];
  if (!meta) return null;

  return (
    <div className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 bg-white/[0.03]">
      {/* Tier colour dot + label */}
      <span className={`w-1.5 h-1.5 rounded-full ${meta.dotClass} shrink-0`} style={{ opacity: 0.5 }} />
      <span
        className={`text-xs font-semibold ${meta.accentClass} shrink-0`}
        style={{ opacity: 0.6, fontSize: 'clamp(0.625rem, 0.8vw, 0.7rem)' }}
      >
        T{tierNum}
      </span>

      {/* Blurred preview text — visible shape, unreadable content */}
      <span
        className="flex-1 text-xs text-slate-400 truncate select-none"
        style={{
          filter: 'blur(4px)',
          WebkitFilter: 'blur(4px)',
          fontSize: 'clamp(0.625rem, 0.8vw, 0.7rem)',
        }}
        aria-hidden="true"
      >
        {previewText.slice(0, 80)}
      </span>

      {/* Lock icon */}
      <LockIcon />
    </div>
  );
}

// ============================================================================
// PRO TIER SELECTOR — clickable tier rows for Pro users
// ============================================================================
// Human factor: Loss Aversion reversal — Pro users gain control they previously
// lacked. The "✓ Selected" badge + save flash use Anticipatory Dopamine (§3):
// the click feels rewarded immediately.
//
// Behaviour:
// - All 4 tiers shown unblurred with full prompt text (truncated to 2 lines)
// - Active/saved tier has "✓ Selected" badge + brighter styling
// - Clicking another tier saves immediately (localStorage + Clerk)
// - CTA area shows "✓ Saved" flash for 1.5s after selection
// - Copy button on each row copies that tier's prompt text

function ProTierSelector({
  previewPrompts,
  activeTier,
  onTierChange,
}: {
  previewPrompts: Record<number, string>;
  activeTier: PromptTier;
  onTierChange?: (tier: PromptTier) => void;
}) {
  const [justSaved, setJustSaved] = useState(false);
  const [copiedTier, setCopiedTier] = useState<number | null>(null);

  const handleSelect = useCallback(
    (t: PromptTier) => {
      if (!onTierChange) return;
      onTierChange(t);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 1500);
    },
    [onTierChange],
  );

  const handleCopyTier = useCallback(
    (t: number, text: string) => {
      navigator.clipboard.writeText(text).catch(() => {});
      setCopiedTier(t);
      setTimeout(() => setCopiedTier(null), 1500);
    },
    [],
  );

  return (
    <div className="flex flex-col gap-1 mt-1 pt-2 border-t border-white/[0.06]">
      <span
        className="text-xs text-amber-400 font-medium mb-0.5"
        style={{ fontSize: 'clamp(0.625rem, 0.8vw, 0.7rem)' }}
      >
        {justSaved ? '✓ Saved — all tooltips updated' : 'Select your prompt format'}
      </span>
      {ALL_TIERS.map((t) => {
        const meta = TIER_META[t];
        if (!meta) return null;
        const text = previewPrompts[t] ?? '';
        const isActive = t === activeTier;
        return (
          <button
            key={t}
            type="button"
            onClick={() => handleSelect(t as PromptTier)}
            className={`flex items-start gap-2 rounded-lg px-2.5 py-1.5 text-left transition-all duration-200 cursor-pointer ${
              isActive
                ? `${meta.bgClass} ring-1 ${meta.ringClass}`
                : 'bg-white/[0.03] hover:bg-white/[0.06]'
            }`}
          >
            {/* Tier colour dot + label */}
            <span className={`w-1.5 h-1.5 rounded-full ${meta.dotClass} shrink-0 mt-1.5`} />
            <span
              className={`text-xs font-semibold ${meta.accentClass} shrink-0`}
              style={{ fontSize: 'clamp(0.625rem, 0.8vw, 0.7rem)', minWidth: 'clamp(18px, 1.5vw, 22px)' }}
            >
              T{t}
            </span>

            {/* Prompt text — unblurred, 2-line clamp */}
            <span
              className={`flex-1 text-xs leading-relaxed ${isActive ? 'text-slate-200' : 'text-slate-400'}`}
              style={{
                fontSize: 'clamp(0.6rem, 0.7vw, 0.7rem)',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {text || 'Generating...'}
            </span>

            {/* Selected badge OR copy button */}
            {isActive ? (
              <span
                className={`shrink-0 text-xs font-medium ${meta.accentClass}`}
                style={{ fontSize: 'clamp(0.55rem, 0.65vw, 0.65rem)' }}
              >
                ✓
              </span>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopyTier(t, text);
                }}
                className="shrink-0 p-0.5 rounded text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                title={copiedTier === t ? 'Copied!' : `Copy T${t} prompt`}
                aria-label={copiedTier === t ? 'Copied to clipboard' : `Copy Tier ${t} prompt`}
              >
                {copiedTier === t ? (
                  <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                )}
              </button>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ============================================================================
// TIER BADGE COMPONENT — coloured pill (replaces banned text-slate-500)
// ============================================================================

function TierBadge({ tier }: { tier: PromptTier }) {
  const meta = TIER_META[tier];
  if (!meta) return null;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-full ${meta.bgClass} ${meta.accentClass} ring-1 ${meta.ringClass}`}
      style={{ fontSize: 'clamp(0.625rem, 0.8vw, 0.7rem)' }}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${meta.dotClass}`} />
      Tier {tier}: {meta.label}
    </span>
  );
}

// ============================================================================
// TOOLTIP CONTENT COMPONENT (rendered via Portal)
// ============================================================================

interface TooltipContentProps {
  prompt: string;
  tier: PromptTier;
  isPro: boolean;
  tempColor: string;
  position: { top: number; left: number };
  verticalPosition: 'center' | 'below' | 'above' | 'top-third';
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onCopy: () => void;
  copied: boolean;
  savePlatformId: string;
  savePlatformName: string;
  /** Preview prompts for other tiers. Map of tierNum → prompt text. */
  previewPrompts: Record<number, string>;
  /** Callback to save tier selection (Pro users). */
  onTierChange?: (tier: PromptTier) => void;
}

function TooltipContent({
  prompt,
  tier,
  isPro,
  tempColor,
  position,
  verticalPosition,
  onMouseEnter,
  onMouseLeave,
  onCopy,
  copied,
  savePlatformId,
  savePlatformName,
  previewPrompts,
  onTierChange,
}: TooltipContentProps) {
  const glowRgba = hexToRgba(tempColor, 0.3);
  const glowBorder = hexToRgba(tempColor, 0.5);
  const glowSoft = hexToRgba(tempColor, 0.15);

  // Other tiers for blurred preview (exclude current active tier)
  const otherTiers = ALL_TIERS.filter((t) => t !== tier);

  return (
    <div
      role="tooltip"
      className="
        fixed
        rounded-xl px-6 py-4
        text-sm text-slate-100
      "
      style={{
        top: position.top,
        left: position.left,
        transform:
          verticalPosition === 'below'
            ? 'none'
            : verticalPosition === 'above'
              ? 'translateY(-100%)'
              : verticalPosition === 'top-third'
              ? 'translateY(-33%)'
              : 'translateY(-50%)',
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
      {/* Ethereal glow overlay - top radial */}
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
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col gap-3">
        {/* Header with Pro badge and copy button in top-right corner */}
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="flex items-center gap-2">
            <span
              className="text-base font-semibold text-white"
              style={{
                textShadow: `0 0 12px ${glowRgba}`,
              }}
            >
              Image Prompt
            </span>
            {isPro && (
              <span className="px-2 py-1 text-xs font-medium rounded bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30">
                PRO
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <SaveIcon
              positivePrompt={prompt}
              platformId={savePlatformId}
              platformName={savePlatformName}
              source="tooltip"
              tier={tier}
              size="sm"
            />
            <CopyIcon onClick={onCopy} copied={copied} />
          </div>
        </div>

        {/* Tier indicator — coloured badge (replaces banned text-slate-500) */}
        <div className="-mt-1">
          <TierBadge tier={tier} />
        </div>

        {/* Prompt text */}
        <p
          className="text-sm leading-relaxed text-slate-200 whitespace-pre-wrap break-words"
          style={{ maxWidth: '420px' }}
        >
          {prompt}
        </p>

        {/* ── Pro users: selectable tier rows (all 4 unblurred) ──────────── */}
        {isPro && Object.keys(previewPrompts).length > 0 && (
          <ProTierSelector
            previewPrompts={previewPrompts}
            activeTier={tier}
            onTierChange={onTierChange}
          />
        )}

        {/* ── Free users: blurred tier previews + upgrade CTA ────────────── */}
        {!isPro && otherTiers.length > 0 && (
          <div className="flex flex-col gap-1 mt-1 pt-2 border-t border-white/[0.06]">
            <span
              className="text-xs text-slate-400 font-medium mb-0.5"
              style={{ fontSize: 'clamp(0.625rem, 0.8vw, 0.7rem)' }}
            >
              Other formats available
            </span>
            {otherTiers.map((t) => (
              <BlurredTierRow
                key={t}
                tierNum={t}
                previewText={previewPrompts[t] ?? 'Prompt preview not available'}
              />
            ))}

            {/* Upgrade CTA */}
            <a
              href="/pro-promagen"
              className="flex items-center justify-center gap-1.5 mt-1.5 px-3 py-1.5 rounded-lg
                bg-gradient-to-r from-amber-600/20 to-orange-600/20
                ring-1 ring-amber-500/25
                text-amber-400 text-xs font-medium
                hover:from-amber-600/30 hover:to-orange-600/30
                transition-all duration-200 cursor-pointer
                no-underline"
              style={{ fontSize: 'clamp(0.625rem, 0.85vw, 0.75rem)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Unlock all formats
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * Weather prompt tooltip with dynamic image prompt generation.
 * Shows on hover over flag with temperature-based glow.
 *
 * IMPORTANT:
 * - Tooltip uses React Portal to render at document.body
 * - This ensures it can overflow into header space (no parent clipping)
 * - 400ms close delay allows user to move cursor into tooltip to copy
 * - Hovering either trigger OR tooltip keeps it open
 * - NO question mark cursor (cursor-pointer only)
 * - NO country/city name in header (flag image is sufficient)
 * - Free users see blurred previews of other tier formats
 */
export function WeatherPromptTooltip({
  children,
  city,
  tz,
  weather,
  tier = getDefaultTier(),
  isPro = false,
  onTierChange,
  tooltipPosition = 'left',
  verticalPosition = 'center',
  latitude,
  longitude,
  platformId: propPlatformId,
  platformName: propPlatformName,
}: WeatherPromptTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const [tooltipCoords, setTooltipCoords] = useState({ top: 0, left: 0 });
  const [isMounted, setIsMounted] = useState(false);
  // Resolved vertical position — may auto-flip from 'below' to 'center' on viewport overflow
  const [resolvedVPos, setResolvedVPos] = useState<'center' | 'below' | 'above' | 'top-third'>(verticalPosition);

  const triggerRef = useRef<HTMLSpanElement>(null);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Track mount state for Portal (SSR safety)
  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  // Convert display weather to full for prompt generation
  const fullWeather = toFullWeather(weather);

  // Derive local hour once (shared across all tier generations)
  const localHour = getLocalHour(tz);

  // Generate prompt for active tier
  // v8.0.0 Chat 5: generateWeatherPrompt returns WeatherPromptResult; extract .text for display.
  const promptResult = fullWeather
    ? generateWeatherPrompt({
        city,
        weather: fullWeather,
        localHour,
        tier,
        latitude,
        longitude,
      })
    : null;
  const prompt = promptResult?.text ?? null;

  // Generate preview prompts for other tiers.
  // Free users: other 3 tiers (blurred previews).
  // Pro users: all 4 tiers (selectable rows — includes active tier for switching).
  // Cost is negligible — the heavy physics computation is shared via module-level
  // caches; only the assembly step runs 3 extra times.
  const previewPrompts = useMemo(() => {
    if (!fullWeather) return {};

    const previews: Record<number, string> = {};
    for (const t of ALL_TIERS) {
      // Free users skip the active tier (it's displayed separately above)
      if (!isPro && t === tier) continue;
      const result = generateWeatherPrompt({
        city,
        weather: fullWeather,
        localHour,
        tier: t,
        latitude,
        longitude,
      });
      if (result?.text) {
        previews[t] = result.text;
      }
    }
    return previews;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPro, city, localHour, tier, latitude, longitude, weather.tempC]);

  // Get temperature-based color for glow
  const tempColor = weather.tempC !== null ? getTemperatureColor(weather.tempC) : '#38BDF8'; // Default cyan

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
   * - Left rail (tooltipPosition='left'): opens to RIGHT of trigger
   * - Right rail (tooltipPosition='right'): opens to LEFT of trigger
   * - verticalPosition='center': vertically centered on trigger
   * - verticalPosition='below': positioned below the trigger (auto-flips to center if overflow)
   * - verticalPosition='above': positioned above the trigger (tooltip bottom at trigger top)
   */
  const calculatePosition = useCallback(() => {
    if (!triggerRef.current) return;

    const rect = triggerRef.current.getBoundingClientRect();
    const viewportH = window.innerHeight;

    let left: number;

    if (tooltipPosition === 'left') {
      // Left rail: tooltip opens to the RIGHT
      left = rect.right + TOOLTIP_GAP;
    } else {
      // Right rail: tooltip opens to the LEFT
      left = rect.left - TOOLTIP_WIDTH - TOOLTIP_GAP;
    }

    // Estimated tooltip height (prompt content + blurred previews + CTA)
    // Conservative estimate — actual height varies by content length
    const ESTIMATED_TOOLTIP_H = 550;

    // Vertical positioning with viewport overflow detection
    let top: number;
    let resolved: 'center' | 'below' | 'above' | 'top-third' = verticalPosition;

    if (verticalPosition === 'below') {
      top = rect.bottom + TOOLTIP_GAP;
      // Auto-flip to center if tooltip would overflow viewport bottom
      if (top + ESTIMATED_TOOLTIP_H > viewportH - 16) {
        top = rect.top + rect.height / 2;
        resolved = 'center';
      }
    } else if (verticalPosition === 'above') {
      // Tooltip bottom aligns with trigger top
      top = rect.top - TOOLTIP_GAP;
      // Auto-flip to center if tooltip would overflow viewport top
      if (top - ESTIMATED_TOOLTIP_H < 16) {
        top = rect.top + rect.height / 2;
        resolved = 'center';
      }
    } else {
      // Center — vertically centered relative to trigger
      top = rect.top + rect.height / 2;
    }

    setTooltipCoords({ top, left });
    setResolvedVPos(resolved);
  }, [tooltipPosition, verticalPosition]);

  /**
   * Clear any pending close timeout.
   */
  const clearCloseTimeout = useCallback(() => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  }, []);

  /**
   * Start the close delay countdown.
   */
  const startCloseDelay = useCallback(() => {
    clearCloseTimeout();
    closeTimeoutRef.current = setTimeout(() => {
      setIsVisible(false);
    }, CLOSE_DELAY_MS);
  }, [clearCloseTimeout]);

  /**
   * Handle mouse entering trigger - show tooltip immediately.
   */
  const handleTriggerEnter = useCallback(() => {
    clearCloseTimeout();
    calculatePosition();
    setIsVisible(true);
  }, [clearCloseTimeout, calculatePosition]);

  /**
   * Handle mouse leaving trigger - start close delay.
   */
  const handleTriggerLeave = useCallback(() => {
    startCloseDelay();
  }, [startCloseDelay]);

  /**
   * Handle mouse entering tooltip - cancel close delay.
   */
  const handleTooltipEnter = useCallback(() => {
    clearCloseTimeout();
  }, [clearCloseTimeout]);

  /**
   * Handle mouse leaving tooltip - start close delay.
   */
  const handleTooltipLeave = useCallback(() => {
    startCloseDelay();
  }, [startCloseDelay]);

  // Copy handler
  const handleCopy = useCallback(async () => {
    if (!prompt) return;

    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
    } catch (err) {
      console.error('Failed to copy prompt:', err);
    }
  }, [prompt]);

  // If no weather data, just render children without tooltip
  if (!prompt || weather.tempC === null) {
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

      {/* Tooltip rendered via Portal at document.body - escapes all parent containers */}
      {isMounted &&
        isVisible &&
        createPortal(
          <TooltipContent
            prompt={prompt}
            tier={tier}
            isPro={isPro}
            tempColor={tempColor}
            position={tooltipCoords}
            verticalPosition={resolvedVPos}
            onMouseEnter={handleTooltipEnter}
            onMouseLeave={handleTooltipLeave}
            onCopy={handleCopy}
            copied={copied}
            savePlatformId={propPlatformId ?? TIER_DEFAULT_PLATFORM[tier]?.id ?? 'openai'}
            savePlatformName={propPlatformName ?? TIER_DEFAULT_PLATFORM[tier]?.name ?? 'OpenAI DALL·E'}
            previewPrompts={previewPrompts}
            onTierChange={onTierChange}
          />,
          document.body,
        )}
    </>
  );
}

export default WeatherPromptTooltip;
