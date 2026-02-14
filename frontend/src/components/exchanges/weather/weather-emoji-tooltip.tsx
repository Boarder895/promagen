// src/components/exchanges/weather/weather-emoji-tooltip.tsx
// ============================================================================
// WEATHER EMOJI TOOLTIP — Conditions + Moon Phase + Sun Event
// ============================================================================
// Tooltip on hover over the weather/moon emoji on exchange cards.
// Shows one coherent sentence:
//
//   Daytime:   "Broken clouds over Taipei. Sunset at 17:47."
//   Nighttime: "Light rain over Wellington. Waxing crescent moon. Sunrise at 06:23."
//
// Same visual language as WeatherPromptTooltip (portal, temperature glow,
// dark glass). Copy button in top-right corner (same style as city vibe prompts).
//
// UPDATES (14 Feb 2026):
// - ADDED: Copy button (clipboard icon) in top-right corner of tooltip
// - Copies the tooltip sentence text to clipboard
// - Same CopyIcon style as WeatherPromptTooltip (emerald tick on success)
//
// Sun event uses 2-tier cascade:
//   1. API timestamps (sunriseUtc/sunsetUtc from OWM via gateway)
//   2. Astronomical calculation (lat/lon + NOAA maths, ±5 min)
//
// Existing features preserved: Yes (new file, no modifications)
// ============================================================================

'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { getTemperatureColor } from '@/lib/weather/weather-types';
import { getNextSunEvent } from '@/lib/weather/sun-calculator';
import { getMoonPhase } from '@/lib/weather/weather-prompt-generator';

// ============================================================================
// TYPES
// ============================================================================

export interface WeatherEmojiTooltipProps {
  /** Trigger element (the emoji span) */
  children: React.ReactNode;
  /** City name, e.g. "Wellington" */
  city: string;
  /** IANA timezone, e.g. "Pacific/Auckland" */
  tz: string;
  /** OWM weather description, e.g. "broken clouds" (will be capitalised) */
  description: string | null;
  /** Whether it's currently night at this location */
  isNight: boolean;
  /** Temperature in Celsius (for glow colour) */
  tempC: number | null;
  /** Sunrise UTC timestamp from API (seconds) */
  sunriseUtc?: number | null;
  /** Sunset UTC timestamp from API (seconds) */
  sunsetUtc?: number | null;
  /** Latitude for astronomical fallback */
  latitude?: number | null;
  /** Longitude for astronomical fallback */
  longitude?: number | null;
  /** Which rail — controls tooltip direction */
  tooltipPosition?: 'left' | 'right';
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Delay before tooltip closes after mouse leaves (ms) */
const CLOSE_DELAY_MS = 400;
/** Gap between trigger and tooltip (px) */
const TOOLTIP_GAP = 8;
/** Tooltip width (px) — narrower than prompt tooltip (450px) */
const TOOLTIP_WIDTH = 320;

// ============================================================================
// HELPERS
// ============================================================================

/** Capitalise first letter: "broken clouds" → "Broken clouds" */
function capitalise(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/** Convert hex to rgba */
function hexToRgba(hex: string, alpha: number): string {
  if (hex.startsWith('rgba')) return hex;
  if (hex.startsWith('rgb')) {
    return hex.replace('rgb', 'rgba').replace(')', `, ${alpha})`);
  }
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return `rgba(56, 189, 248, ${alpha})`;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Build the tooltip sentence.
 *
 * Daytime:   "Broken clouds over Taipei. Sunset at 17:47."
 * Nighttime: "Light rain over Wellington. Waxing crescent moon. Sunrise at 06:23."
 */
function buildTooltipText(
  city: string,
  description: string | null,
  isNight: boolean,
  sunEvent: { label: 'Sunrise' | 'Sunset'; time: string } | null,
): string {
  const parts: string[] = [];

  // Weather description + city
  if (description) {
    parts.push(`${capitalise(description)} over ${city}.`);
  } else {
    parts.push(`Weather over ${city}.`);
  }

  // Moon phase (night only)
  if (isNight) {
    const moon = getMoonPhase();
    // Sentence-case: "Waxing Crescent" → "Waxing crescent"
    const moonName = moon.name.charAt(0).toUpperCase() + moon.name.slice(1).toLowerCase();
    // Some phases already include "moon" (e.g. "New Moon", "Full Moon") — don't double it
    const hasMoon = moonName.toLowerCase().includes('moon');
    parts.push(hasMoon ? `${moonName}.` : `${moonName} moon.`);
  }

  // Next sun event
  if (sunEvent) {
    parts.push(`${sunEvent.label} at ${sunEvent.time}.`);
  }

  return parts.join(' ');
}

// ============================================================================
// TOOLTIP CONTENT (rendered via Portal)
// ============================================================================

interface TooltipContentProps {
  text: string;
  tempColor: string;
  position: { top: number; left: number };
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onCopy: () => void;
  copied: boolean;
}

function TooltipContent({
  text,
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
      className="fixed rounded-xl px-5 py-3 text-sm text-slate-100"
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
        minWidth: '200px',
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

      {/* Content — copy button top-right, text below */}
      <div className="relative z-10 flex flex-col gap-2">
        {/* Header row with copy button top-right */}
        <div className="flex items-start justify-end">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onCopy();
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
            title={copied ? 'Copied!' : 'Copy weather info'}
            aria-label={copied ? 'Copied to clipboard' : 'Copy weather info to clipboard'}
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
        </div>

        {/* Tooltip sentence */}
        <p className="text-sm leading-relaxed text-slate-200">{text}</p>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * Weather emoji tooltip with conditions + moon phase + next sun event.
 *
 * Wraps the weather/moon emoji on exchange cards.
 * Same portal + glow + hover-persistence pattern as WeatherPromptTooltip.
 */
export function WeatherEmojiTooltip({
  children,
  city,
  tz,
  description,
  isNight,
  tempC,
  sunriseUtc,
  sunsetUtc,
  latitude,
  longitude,
  tooltipPosition = 'left',
}: WeatherEmojiTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const [tooltipCoords, setTooltipCoords] = useState({ top: 0, left: 0 });
  const [isMounted, setIsMounted] = useState(false);

  const triggerRef = useRef<HTMLSpanElement>(null);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // SSR safety — only render portal after mount
  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    };
  }, []);

  // Reset copied state after timeout
  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [copied]);

  // ── Compute tooltip data ───────────────────────────────────────────
  const sunEvent = getNextSunEvent(isNight, tz, sunriseUtc, sunsetUtc, latitude, longitude);
  const tooltipText = buildTooltipText(city, description, isNight, sunEvent);
  const tempColor = tempC !== null ? getTemperatureColor(tempC) : '#38BDF8';

  // ── Position calculation ───────────────────────────────────────────
  const calculatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();

    const left =
      tooltipPosition === 'left'
        ? rect.right + TOOLTIP_GAP
        : rect.left - TOOLTIP_WIDTH - TOOLTIP_GAP;

    const top = rect.top + rect.height / 2;
    setTooltipCoords({ top, left });
  }, [tooltipPosition]);

  // ── Hover handlers (same 400ms persistence as prompt tooltip) ──────
  const clearCloseTimeout = useCallback(() => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  }, []);

  const startCloseDelay = useCallback(() => {
    clearCloseTimeout();
    closeTimeoutRef.current = setTimeout(() => setIsVisible(false), CLOSE_DELAY_MS);
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

  // Copy handler
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(tooltipText);
      setCopied(true);
    } catch (err) {
      console.error('Failed to copy weather info:', err);
    }
  }, [tooltipText]);

  return (
    <>
      <span
        ref={triggerRef}
        className="relative inline-flex cursor-pointer"
        onMouseEnter={handleTriggerEnter}
        onMouseLeave={handleTriggerLeave}
      >
        {children}
      </span>

      {isMounted &&
        isVisible &&
        createPortal(
          <TooltipContent
            text={tooltipText}
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

export default WeatherEmojiTooltip;
