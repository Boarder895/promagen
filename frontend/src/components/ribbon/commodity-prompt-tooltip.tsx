// src/components/ribbon/commodity-prompt-tooltip.tsx
// ============================================================================
// COMMODITY PROMPT TOOLTIP v2.3 — Prod Layout Fix + Clickable Tier Selection
// ============================================================================
// Tooltip that displays dynamically generated image prompts for commodities.
//
// v2.3: PROD LAYOUT FIX — all Tailwind opacity values converted from bare
//       integers (bg-white/8, ring-white/15) to bracket syntax
//       (bg-white/[0.08], ring-white/[0.15]) to survive Tailwind v4 prod
//       scanner inside ternary template literals.
//       INLINE FLEX FALLBACKS — all flex containers in BlurredTierRow,
//       ProTierRow, and ProTooltipContent use inline styles as belt-and-braces
//       so layout never breaks even if a Tailwind class is purged.
//       CLICKABLE TIER SELECTION — Pro tier rows now have onClick + keyboard
//       support. Clicking a collapsed tier expands it and collapses the
//       previous one. Local selectedTier state lives in ProTooltipContent.
//       Save icon tracks the currently selected tier.
//       Existing features preserved: Yes
//
// v2.2: Coloured TierBadge pill replaces plain text tier indicator.
//       Free users see blurred preview rows for other 3 tiers with lock icon.
//       "Unlock all formats" CTA linking to /pro-promagen.
//       Human Factors: Loss Aversion (see what you can't control),
//       Curiosity Gap (blurred text entices upgrade).
//       Existing features preserved: Yes
//
// v2.1: Added 💾 save icon next to copy in both Free and Pro tooltip headers.
//       Fires saveToLibrary() + triggerQuickSaveToast() for one-click save.
//       Authority: saved-page.md §7.1
//       Existing features preserved: Yes
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
import { SaveIcon } from '@/components/prompts/library/save-icon';

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
   * 'below' = positioned below the trigger (auto-flips to center if viewport overflow)
   * 'above' = positioned above the trigger (tooltip bottom aligns with trigger top)
   */
  verticalPosition?: 'center' | 'below' | 'above' | 'top-third';
  /** Disable the tooltip (renders children only) */
  disabled?: boolean;
  /** Callback when tooltip visibility changes (for pausing flag rotation) */
  onVisibilityChange?: (visible: boolean) => void;
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
    label: 'Midjourney Family',
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

/** Map tier number to a reference platform for save icon */
const TIER_PLATFORM: Record<number, { id: string; name: string }> = {
  1: { id: 'leonardo', name: 'Leonardo' },
  2: { id: 'midjourney', name: 'Midjourney' },
  3: { id: 'openai', name: 'DALL·E 3' },
  4: { id: 'canva', name: 'Canva' },
};

/** All 4 tiers for iteration */
const ALL_TIERS: (1 | 2 | 3 | 4)[] = [1, 2, 3, 4];

/** Background + ring classes per tier for TierBadge pill */
const TIER_BADGE_STYLES: Record<number, { bgClass: string; ringClass: string }> = {
  1: { bgClass: 'bg-blue-500/[0.15]', ringClass: 'ring-blue-500/[0.30]' },
  2: { bgClass: 'bg-purple-500/[0.15]', ringClass: 'ring-purple-500/[0.30]' },
  3: { bgClass: 'bg-emerald-500/[0.15]', ringClass: 'ring-emerald-500/[0.30]' },
  4: { bgClass: 'bg-orange-500/[0.15]', ringClass: 'ring-orange-500/[0.30]' },
};

// ============================================================================
// LOCK ICON — used on blurred tier preview rows
// ============================================================================

function LockIcon() {
  return (
    <svg
      className="w-3 h-3 text-slate-300"
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
  tierNum: 1 | 2 | 3 | 4;
  previewText: string;
}

function BlurredTierRow({ tierNum, previewText }: BlurredTierRowProps) {
  const meta = TIER_META[tierNum];
  if (!meta) return null;

  return (
    <div
      className="rounded-lg px-2.5 py-1.5 bg-white/[0.03]"
      style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${meta.dotClass} shrink-0`} style={{ opacity: 0.5 }} />
      <span
        className={`text-xs font-semibold ${meta.accentClass} shrink-0`}
        style={{ opacity: 0.6, fontSize: 'clamp(0.625rem, 0.8vw, 0.7rem)' }}
      >
        T{tierNum}
      </span>
      <span
        className="text-xs text-slate-300 select-none"
        style={{
          flex: '1 1 0%',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          filter: 'blur(4px)',
          WebkitFilter: 'blur(4px)',
          fontSize: 'clamp(0.625rem, 0.8vw, 0.7rem)',
        }}
        aria-hidden="true"
      >
        {previewText.slice(0, 80)}
      </span>
      <LockIcon />
    </div>
  );
}

// ============================================================================
// TIER BADGE — coloured pill (replaces plain text tier indicator)
// ============================================================================

function TierBadge({ tier }: { tier: number }) {
  const meta = TIER_META[tier];
  const badge = TIER_BADGE_STYLES[tier];
  if (!meta || !badge) return null;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-full ${badge.bgClass} ${meta.accentClass} ring-1 ${badge.ringClass}`}
      style={{ fontSize: 'clamp(0.625rem, 0.8vw, 0.7rem)' }}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${meta.dotClass}`} />
      Tier {tier}: {meta.label}
    </span>
  );
}

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
      className={`inline-flex items-center justify-center ${sizeClasses} rounded-md transition-all duration-200 ${copied ? 'bg-emerald-500/[0.20] text-emerald-400' : 'bg-white/[0.05] text-slate-300 hover:bg-white/[0.10] hover:text-slate-200'}`}
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
  /** Click row to select this tier as active */
  onSelect: (tierNum: 1 | 2 | 3 | 4) => void;
}

function ProTierRow({ tierNum, promptText, isActive, onCopy, onSelect }: ProTierRowProps) {
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

  const handleRowClick = useCallback(() => {
    if (!isActive) onSelect(tierNum);
  }, [isActive, tierNum, onSelect]);

  // Inline flex fallback guarantees layout in prod even if Tailwind purges
  // a dynamic opacity class and disrupts the cascade.
  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.625rem',
    cursor: isActive ? 'default' : 'pointer',
  };

  return (
    <div
      className={`group rounded-lg px-3 py-2.5 transition-all duration-200 ${isActive ? 'bg-white/[0.08] ring-1 ring-white/[0.15]' : 'bg-white/[0.03] hover:bg-white/[0.06]'}`}
      style={rowStyle}
      onClick={handleRowClick}
      role="button"
      tabIndex={0}
      aria-pressed={isActive}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleRowClick(); } }}
    >
      {/* Tier colour dot + label */}
      <div className="shrink-0 pt-0.5" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span
          className={`w-2 h-2 rounded-full ${meta.dotClass}`}
          style={{ opacity: isActive ? 1 : 0.5 }}
        />
        <span
          className={`text-xs font-semibold ${isActive ? meta.accentClass : 'text-slate-300'}`}
          style={{ width: '2.25rem' }}
        >
          T{tierNum}
        </span>
      </div>

      {/* Prompt preview — expanded for active, truncated for inactive */}
      <div style={{ flex: '1 1 0%', minWidth: 0 }}>
        {isActive ? (
          <>
            <p className="text-[11px] text-slate-300 mb-1 font-medium">
              {meta.label}
              <span className="text-slate-300 ml-1.5 font-normal" style={{ opacity: 0.7 }}>{meta.platforms}</span>
            </p>
            <p className="text-sm leading-relaxed text-slate-200 whitespace-pre-wrap break-words">
              {promptText}
            </p>
          </>
        ) : (
          <p className="text-xs text-slate-300 leading-relaxed pt-0.5" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <span className={`font-medium ${meta.accentClass}`} style={{ opacity: 0.7 }}>{meta.shortLabel}</span>
            <span className="text-slate-300 mx-1.5" style={{ opacity: 0.6 }}>·</span>
            <span className="text-slate-300" style={{ opacity: 0.7 }}>{promptText.slice(0, 90)}…</span>
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
  verticalPosition: 'center' | 'below' | 'above' | 'top-third';
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onCopy: () => void;
  copied: boolean;
  /** All 4 tier prompts for blurred preview rows */
  allPrompts: AllTierPrompts;
}

function FreeTooltipContent({
  prompt,
  tier,
  glowColor,
  group: _group,
  position,
  verticalPosition,
  onMouseEnter,
  onMouseLeave,
  onCopy,
  copied,
  allPrompts,
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
        transform: verticalPosition === 'below' ? 'none' : verticalPosition === 'above' ? 'translateY(-100%)' : verticalPosition === 'top-third' ? 'translateY(-33%)' : 'translateY(-50%)',
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
      <div className="relative z-10" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {/* Header — title + save/copy (top-right) */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.25rem' }}>
          <span
            className="text-base font-semibold text-white"
            style={{ textShadow: `0 0 12px ${glowRgba}` }}
          >
            Image Prompt
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <SaveIcon
              positivePrompt={prompt}
              platformId={TIER_PLATFORM[tier]?.id ?? 'canva'}
              platformName={TIER_PLATFORM[tier]?.name ?? 'Canva'}
              source="tooltip"
              tier={tier}
              size="md"
            />
            <CopyIcon onClick={onCopy} copied={copied} />
          </div>
        </div>

        {/* Tier indicator — coloured badge (replaces plain text) */}
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

        {/* ── Blurred tier previews (free users — Curiosity Gap) ─────── */}
        {(() => {
          const otherTiers = ALL_TIERS.filter((t) => t !== tier);
          const promptMap: Record<number, string> = {
            1: allPrompts.tier1,
            2: allPrompts.tier2,
            3: allPrompts.tier3,
            4: allPrompts.tier4,
          };
          return otherTiers.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.25rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <span
                className="text-xs text-slate-300 font-medium mb-0.5"
                style={{ fontSize: 'clamp(0.625rem, 0.8vw, 0.7rem)' }}
              >
                Other formats available
              </span>
              {otherTiers.map((t) => (
                <BlurredTierRow
                  key={t}
                  tierNum={t}
                  previewText={promptMap[t] ?? 'Prompt preview not available'}
                />
              ))}

              {/* Upgrade CTA */}
              <a
                href="/pro-promagen"
                className="mt-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-600/[0.20] to-orange-600/[0.20] ring-1 ring-amber-500/[0.25] text-amber-400 text-xs font-medium hover:from-amber-600/[0.30] hover:to-orange-600/[0.30] transition-all duration-200 cursor-pointer no-underline"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem', fontSize: 'clamp(0.625rem, 0.85vw, 0.75rem)' }}
                onClick={(e) => e.stopPropagation()}
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Unlock all formats
              </a>
            </div>
          ) : null;
        })()}
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
  verticalPosition: 'center' | 'below' | 'above' | 'top-third';
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  blueprintUsed: boolean;
}

function ProTooltipContent({
  allPrompts,
  activeTier,
  glowColor,
  group: _group,
  position,
  verticalPosition,
  onMouseEnter,
  onMouseLeave,
  blueprintUsed,
}: ProTooltipContentProps) {
  // Local state: which tier is currently expanded (starts with the global tier)
  const [selectedTier, setSelectedTier] = useState<1 | 2 | 3 | 4>(activeTier as 1 | 2 | 3 | 4);

  const glowRgba = hexToRgba(glowColor, 0.3);
  const glowBorder = hexToRgba(glowColor, 0.5);
  const glowSoft = hexToRgba(glowColor, 0.15);

  const handleTierCopy = useCallback((_text: string) => {
    // Could track analytics here in future
  }, []);

  const handleTierSelect = useCallback((tierNum: 1 | 2 | 3 | 4) => {
    setSelectedTier(tierNum);
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
        transform: verticalPosition === 'below' ? 'none' : verticalPosition === 'above' ? 'translateY(-100%)' : verticalPosition === 'top-third' ? 'translateY(-33%)' : 'translateY(-50%)',
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
        className="relative z-10 overflow-y-auto"
        style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: 'calc(80vh - 32px)' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
          <span
            className="text-base font-semibold text-white"
            style={{ textShadow: `0 0 12px ${glowRgba}` }}
          >
            Image Prompt
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <span className="px-2 py-0.5 text-xs font-semibold rounded bg-amber-500/[0.20] text-amber-400 ring-1 ring-amber-500/[0.30]">
              PRO
            </span>
            <SaveIcon
              positivePrompt={allPrompts[`tier${selectedTier}` as keyof typeof allPrompts] ?? ''}
              platformId={TIER_PLATFORM[selectedTier]?.id ?? 'canva'}
              platformName={TIER_PLATFORM[selectedTier]?.name ?? 'Canva'}
              source="tooltip"
              tier={selectedTier}
              size="md"
            />
          </div>
        </div>

        {/* Subtitle */}
        <p className="text-[11px] text-slate-300 -mt-1">
          4 platform-optimised prompts — click a tier to expand
          {blueprintUsed && <span className="text-slate-300 ml-1" style={{ opacity: 0.6 }}>· Blueprint</span>}
        </p>

        {/* Tier rows — selected tier expanded, others collapsed. Click to select. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
          {tiers.map(({ num, text }) => (
            <ProTierRow
              key={num}
              tierNum={num}
              promptText={text}
              isActive={num === selectedTier}
              onCopy={handleTierCopy}
              onSelect={handleTierSelect}
            />
          ))}
        </div>

        {/* Pro tip footer */}
        <div className="pt-2" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
          <span className="text-[10px] text-slate-300">
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
  onVisibilityChange,
}: CommodityPromptTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const [tooltipCoords, setTooltipCoords] = useState({ top: 0, left: 0 });
  const [isMounted, setIsMounted] = useState(false);
  // Resolved vertical position — may auto-flip from 'below'/'above' to 'center' on overflow
  const [resolvedVPos, setResolvedVPos] = useState<'center' | 'below' | 'above' | 'top-third'>(verticalPosition);

  const triggerRef = useRef<HTMLSpanElement>(null);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Grace period: after a click inside the tooltip, suppress close for 1.5s
  const graceUntilRef = useRef<number>(0);

  // Fire visibility callback so parent can pause flag rotation
  useEffect(() => {
    onVisibilityChange?.(isVisible);
  }, [isVisible, onVisibilityChange]);

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
   * Supports 'above', 'below', and 'center' with auto-flip on overflow.
   */
  const calculatePosition = useCallback(() => {
    if (!triggerRef.current) return;

    const rect = triggerRef.current.getBoundingClientRect();
    const viewportH = window.innerHeight;

    let left: number;
    if (tooltipPosition === 'left') {
      left = rect.right + TOOLTIP_GAP;
    } else {
      left = rect.left - TOOLTIP_WIDTH - TOOLTIP_GAP;
    }

    const ESTIMATED_TOOLTIP_H = 550;

    let top: number;
    let resolved: 'center' | 'below' | 'above' | 'top-third' = verticalPosition;

    if (verticalPosition === 'below') {
      top = rect.bottom + TOOLTIP_GAP;
      if (top + ESTIMATED_TOOLTIP_H > viewportH - 16) {
        top = rect.top + rect.height / 2;
        resolved = 'center';
      }
    } else if (verticalPosition === 'above') {
      top = rect.top - TOOLTIP_GAP;
      if (top - ESTIMATED_TOOLTIP_H < 16) {
        top = rect.top + rect.height / 2;
        resolved = 'center';
      }
    } else {
      top = rect.top + rect.height / 2;
    }

    setTooltipCoords({ top, left });
    setResolvedVPos(resolved);
  }, [tooltipPosition, verticalPosition]);

  const clearCloseTimeout = useCallback(() => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  }, []);

  const startCloseDelay = useCallback(() => {
    clearCloseTimeout();
    // If in grace period (after click inside tooltip), use 1.5s delay
    const now = Date.now();
    const delay = now < graceUntilRef.current ? 1500 : CLOSE_DELAY_MS;
    closeTimeoutRef.current = setTimeout(() => {
      setIsVisible(false);
    }, delay);
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

  // Grace period handler: any click inside tooltip extends close delay to 1.5s
  const handleGraceClick = useCallback(() => {
    graceUntilRef.current = Date.now() + 1500;
    clearCloseTimeout();
  }, [clearCloseTimeout]);

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
          <div role="presentation" onClickCapture={handleGraceClick}>
          {isPro ? (
            <ProTooltipContent
              allPrompts={output.allPrompts}
              activeTier={tier}
              glowColor={glow.glowColor}
              group={group}
              position={tooltipCoords}
              verticalPosition={resolvedVPos}
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
              verticalPosition={resolvedVPos}
              onMouseEnter={handleTooltipEnter}
              onMouseLeave={handleTooltipLeave}
              onCopy={handleCopy}
              copied={copied}
              allPrompts={output.allPrompts}
            />
          )}
          </div>,
          document.body,
        )}
    </>
  );
}

export default CommodityPromptTooltip;
