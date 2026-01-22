// src/components/exchanges/weather/weather-prompt-tooltip.tsx
// ============================================================================
// WEATHER PROMPT TOOLTIP - DYNAMIC IMAGE PROMPT GENERATOR
// ============================================================================
// Tooltip that displays dynamically generated image prompts based on weather.
// Features:
// - Temperature-based glow color (cold=blue, hot=red)
// - Copy icon to copy prompt to clipboard
// - Uses React Portal to render at document.body (escapes all containers)
// - 1-second hover persistence for easy copy access
// - Tier-based prompt format (Free: Tier 4, Pro: Selectable 1-4)
//
// UPDATES (20 Jan 2026):
// - Uses createPortal to render tooltip at document.body level
// - This allows tooltip to overflow into header space (no parent clipping)
// - 1000ms close delay (configurable at line 65: CLOSE_DELAY_MS)
// - Tooltip stays open when hovering trigger OR tooltip itself
//
// Authority: docs/authority/ai_providers.md §4-Tier Prompt System
// Existing features preserved: Yes
// ============================================================================

'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
  /** Trigger element (usually the weather emoji) */
  children: React.ReactNode;
  /** City name for prompt context */
  city: string;
  /** Timezone for deriving local hour */
  tz: string;
  /** Weather data for prompt generation */
  weather: ExchangeWeatherDisplay;
  /** Prompt tier (1-4). Defaults to 4 (Artistly) for free users */
  tier?: PromptTier;
  /** Whether user is Pro (for styling) */
  isPro?: boolean;
  /**
   * Which side the tooltip should appear on.
   * Note: Both 'left' and 'right' now result in LEFT-opening tooltip.
   * This prop is kept for API compatibility but both values open LEFT.
   */
  tooltipPosition?: 'left' | 'right';
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Delay before tooltip closes after mouse leaves (ms).
 * LINE 65 - Change this value to adjust hover persistence.
 */
const CLOSE_DELAY_MS = 400;

/** Gap between trigger and tooltip (px) */
const TOOLTIP_GAP = 8;

/** Tooltip dimensions for positioning calculations */
const TOOLTIP_WIDTH = 280;

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
        w-6 h-6 rounded-md
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
// TOOLTIP CONTENT COMPONENT (rendered via Portal)
// ============================================================================

interface TooltipContentProps {
  city: string;
  prompt: string;
  tier: PromptTier;
  isPro: boolean;
  tempColor: string;
  position: { top: number; left: number };
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onCopy: () => void;
  copied: boolean;
}

function TooltipContent({
  city,
  prompt,
  tier,
  isPro,
  tempColor,
  position,
  onMouseEnter,
  onMouseLeave,
  onCopy,
  copied,
}: TooltipContentProps) {
  const glowRgba = hexToRgba(tempColor, 0.3);
  const glowBorder = hexToRgba(tempColor, 0.5);
  const glowSoft = hexToRgba(tempColor, 0.15);

  return (
    <div
      role="tooltip"
      className="
        fixed
        rounded-xl px-4 py-3
        text-xs text-slate-100
      "
      style={{
        top: position.top,
        left: position.left,
        transform: 'translateY(-50%)',
        zIndex: 99999,
        background: 'rgba(15, 23, 42, 0.97)',
        border: `1px solid ${glowBorder}`,
        boxShadow: `0 0 40px 8px ${glowRgba}, 0 0 80px 16px ${glowSoft}, inset 0 0 25px 3px ${glowRgba}`,
        width: `${TOOLTIP_WIDTH}px`,
        maxWidth: `${TOOLTIP_WIDTH}px`,
        minWidth: '220px',
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
          opacity: 0.6,
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col gap-2">
        {/* Header with Pro badge */}
        <div className="flex items-center justify-between gap-2 mb-1">
          <span
            className="text-xs font-semibold text-white"
            style={{
              textShadow: `0 0 12px ${glowRgba}`,
            }}
          >
            {city} • Image Prompt
          </span>
          {isPro && (
            <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30">
              PRO
            </span>
          )}
        </div>

        {/* Tier indicator */}
        <span className="text-[10px] text-slate-500 -mt-1">
          Tier {tier}:{' '}
          {tier === 1 ? 'CLIP' : tier === 2 ? 'Midjourney' : tier === 3 ? 'DALL·E' : 'Plain'}
        </span>

        {/* Prompt text */}
        <p
          className="text-[11px] leading-relaxed text-slate-200 whitespace-pre-wrap break-words"
          style={{ maxWidth: '260px' }}
        >
          {prompt}
        </p>

        {/* Copy button row */}
        <div className="flex justify-end mt-1 pt-2 border-t border-white/10">
          <CopyIcon onClick={onCopy} copied={copied} />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * Weather prompt tooltip with dynamic image prompt generation.
 * Shows on hover over weather emoji with temperature-based glow.
 *
 * IMPORTANT:
 * - Tooltip uses React Portal to render at document.body
 * - This ensures it can overflow into header space (no parent clipping)
 * - 1-second close delay allows user to move cursor into tooltip to copy
 * - Hovering either trigger OR tooltip keeps it open
 */
export function WeatherPromptTooltip({
  children,
  city,
  tz,
  weather,
  tier = getDefaultTier(),
  isPro = false,
  tooltipPosition: _tooltipPosition = 'left',
}: WeatherPromptTooltipProps) {
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

  // Convert display weather to full for prompt generation
  const fullWeather = toFullWeather(weather);

  // Generate prompt if weather data available
  const prompt = fullWeather
    ? generateWeatherPrompt({
        city,
        weather: fullWeather,
        localHour: getLocalHour(tz),
        tier,
      })
    : null;

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
   * Positions tooltip to the LEFT of the trigger, vertically centered.
   */
  const calculatePosition = useCallback(() => {
    if (!triggerRef.current) return;

    const rect = triggerRef.current.getBoundingClientRect();

    // Position to the LEFT of trigger
    const left = rect.left - TOOLTIP_WIDTH - TOOLTIP_GAP;

    // Vertically center relative to trigger
    const top = rect.top + rect.height / 2;

    setTooltipCoords({ top, left });
  }, []);

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
      {/* Trigger element */}
      <span
        ref={triggerRef}
        className="relative inline-flex cursor-help"
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
            city={city}
            prompt={prompt}
            tier={tier}
            isPro={isPro}
            tempColor={tempColor}
            position={tooltipCoords}
            onMouseEnter={handleTooltipEnter}
            onMouseLeave={handleTooltipLeave}
            onCopy={handleCopy}
            copied={copied}
          />,
          document.body,
        )}
    </>
  );
}

export default WeatherPromptTooltip;
