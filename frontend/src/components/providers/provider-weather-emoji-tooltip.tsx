// src/components/providers/provider-weather-emoji-tooltip.tsx
// ============================================================================
// PROVIDER WEATHER EMOJI TOOLTIP — Enhanced Conditions + TTS
// ============================================================================
// Tooltip on hover over the weather/moon emoji beneath the provider flag.
// Shows a detailed meteorological sentence with:
//
//   Day:   "Clear sky over Tokyo with a temperature of 8°C / 46°F,
//           with an easterly wind of 15 km/h with gusts of up to 17 km/h.
//           Humidity is 78%, with visibility at 10 km or 6.2 miles.
//           The First quarter moon is currently below the horizon in the
//           eastern sky at -4°. Sunset at 17:29."
//
//   Night: "Overcast clouds over Paris with a temperature of 8°C / 46°F,
//           with a northerly wind of 15 km/h with gusts of up to 17 km/h.
//           Humidity is 78%. The First quarter moon is currently below the
//           horizon in the north-western sky at -6°. Sunrise at 07:48."
//
// Features:
//   - Copy button (same as exchange card emoji tooltip)
//   - Speaker button (British female TTS, continues after tooltip closes)
//   - Visibility only in daytime tooltip (OWM metres → km/miles or m/yards)
//   - Visibility < 1km → show in metres and yards
//   - Wind degrees → compass direction ("northerly", "south-westerly")
//   - Night normalisation ("sunny" → "Clear", "partly sunny" → "Partly cloudy")
//   - Same portal + temperature glow + 400ms hover persistence
//
// Authority: docs/authority/exchange-card-weather.md §7
// Existing features preserved: Yes (new file)
// ============================================================================

'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { getTemperatureColor } from '@/lib/weather/weather-types';
import { getNextSunEvent, getLunarPosition } from '@/lib/weather/sun-calculator';
import { getMoonPhase } from '@/lib/weather/moon-phase';
import { speakText, stopSpeaking, isSpeechSupported } from '@/lib/speech';

// ============================================================================
// TYPES
// ============================================================================

export interface ProviderWeatherEmojiTooltipProps {
  /** Trigger element (the emoji span) */
  children: React.ReactNode;
  /** City name, e.g. "Tokyo" */
  city: string;
  /** IANA timezone, e.g. "Asia/Tokyo" */
  tz: string;
  /** OWM weather description, e.g. "broken clouds" */
  description: string | null;
  /** Whether it's currently night at this location */
  isNight: boolean;
  /** Temperature in Celsius */
  tempC: number | null;
  /** Temperature in Fahrenheit */
  tempF: number | null;
  /** Wind speed in km/h */
  windKmh: number | null;
  /** Wind direction in degrees (0–360) */
  windDegrees: number | null;
  /** Wind gust speed in km/h */
  windGustKmh: number | null;
  /** Humidity percentage */
  humidity: number | null;
  /** Visibility in metres (0–10000). Shown daytime only. */
  visibility: number | null;
  /** Sunrise UTC timestamp from API (seconds) */
  sunriseUtc?: number | null;
  /** Sunset UTC timestamp from API (seconds) */
  sunsetUtc?: number | null;
  /** Latitude for astronomical calculations */
  latitude?: number | null;
  /** Longitude for astronomical calculations */
  longitude?: number | null;
  /** Which side — controls tooltip direction */
  tooltipPosition?: 'left' | 'right';
}

// ============================================================================
// CONSTANTS
// ============================================================================

const CLOSE_DELAY_MS = 400;
const TOOLTIP_GAP = 8;
const TOOLTIP_WIDTH = 380;

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
 * Convert azimuth adjective to cardinal direction noun.
 * "northern" → "north", "south-western" → "south-west", etc.
 */
function azimuthToDirection(azBin: string): string {
  const map: Record<string, string> = {
    northern: 'north',
    'north-eastern': 'north-east',
    eastern: 'east',
    'south-eastern': 'south-east',
    southern: 'south',
    'south-western': 'south-west',
    western: 'west',
    'north-western': 'north-west',
  };
  return map[azBin] ?? azBin;
}

/**
 * Convert wind degrees (0–360) to compass direction adjective.
 * 0/360 = northerly, 90 = easterly, 180 = southerly, 270 = westerly.
 * Uses 8 sectors of 45° each.
 */
function degreesToCompass(deg: number): string {
  // Normalise to 0–360
  const d = ((deg % 360) + 360) % 360;
  const sectors = [
    'northerly',
    'north-easterly',
    'easterly',
    'south-easterly',
    'southerly',
    'south-westerly',
    'westerly',
    'north-westerly',
  ] as const;
  const index = Math.round(d / 45) % 8;
  return sectors[index] ?? 'northerly';
}

/**
 * Determine correct article: "a" or "an".
 * "an easterly" vs "a northerly".
 */
function windArticle(compassDir: string): string {
  return /^[aeiou]/i.test(compassDir) ? 'an' : 'a';
}

/**
 * Format visibility with smart unit selection.
 * - ≥ 1000m (≥ 1 km) → show km and miles
 * - < 1000m (< 1 km) → show metres and yards
 */
function formatVisibility(metres: number): string {
  if (metres >= 1000) {
    const km = metres >= 10000 ? Math.round(metres / 1000) : (metres / 1000).toFixed(1);
    const miles = (metres / 1609.34).toFixed(1);
    return `${km} km or ${miles} miles`;
  }
  // Below 1 km — show metres and yards
  const yards = Math.round(metres * 1.09361);
  return `${Math.round(metres)} metres or ${yards} yards`;
}

/**
 * Night normalisation — "sunny" → "Clear", etc.
 * Same logic as exchange card tooltip.
 */
function normaliseNightDescription(desc: string): string {
  const lower = desc.toLowerCase().trim();
  if (lower === 'sunny' || lower === 'clear sky') return 'Clear';
  if (lower === 'mostly sunny') return 'Mostly clear';
  if (lower === 'partly sunny') return 'Partly cloudy';
  if (lower.includes('sunny')) {
    return desc.replace(/[Ss]unny/g, (m) => (m.charAt(0) === 'S' ? 'Clear' : 'clear'));
  }
  return desc;
}

/**
 * Build moon position phrase — identical logic to exchange card tooltip.
 *
 * DAYTIME:  "high in the northern sky at +58°"
 * NIGHTTIME: "in the western, mid sky at +15°"
 */
function buildMoonPositionPhrase(
  altitudeBin: string | null,
  azimuthBin: string,
  altitude: number,
  isNight: boolean,
): string {
  const altRounded = Math.round(altitude);
  const altStr = altRounded >= 0 ? `+${altRounded}` : `${altRounded}`;
  const dir = azimuthToDirection(azimuthBin);

  if (altitudeBin === 'near overhead') {
    return `near overhead at ${altStr}°`;
  }

  if (!isNight) {
    if (altitudeBin === 'high in the sky') return `high in the ${azimuthBin} sky at ${altStr}°`;
    if (altitudeBin === 'mid-sky') return `mid-sky in the ${dir} at ${altStr}°`;
    if (altitudeBin === 'low on the horizon')
      return `low on the horizon in the ${dir} at ${altStr}°`;
  } else {
    if (altitudeBin === 'high in the sky') return `in the ${azimuthBin}, high sky at ${altStr}°`;
    if (altitudeBin === 'mid-sky') return `in the ${azimuthBin}, mid sky at ${altStr}°`;
    if (altitudeBin === 'low on the horizon')
      return `in the ${azimuthBin}, low on the horizon at ${altStr}°`;
  }

  return `in the ${azimuthBin} sky at ${altStr}°`;
}

// ============================================================================
// TOOLTIP TEXT BUILDER
// ============================================================================

interface TooltipTextParams {
  city: string;
  description: string | null;
  isNight: boolean;
  tempC: number | null;
  tempF: number | null;
  windKmh: number | null;
  windDegrees: number | null;
  windGustKmh: number | null;
  humidity: number | null;
  visibility: number | null;
  sunEvent: { label: 'Sunrise' | 'Sunset'; time: string } | null;
  latitude?: number | null;
  longitude?: number | null;
}

/**
 * Build the enhanced tooltip sentence.
 *
 * Day example:
 *   "Clear sky over Tokyo with a temperature of 8°C / 46°F,
 *    with an easterly wind of 15 km/h with gusts of up to 17 km/h.
 *    Humidity is 78%, with visibility at 10 km or 6.2 miles.
 *    The First quarter moon is currently below the horizon in the
 *    eastern sky at -4°. Sunset at 17:29."
 *
 * Night example:
 *   "Clear over Paris with a temperature of 8°C / 46°F,
 *    with a northerly wind of 15 km/h with gusts of up to 17 km/h.
 *    Humidity is 78%. The First quarter moon is currently below the
 *    horizon in the north-western sky at -6°. Sunrise at 07:48."
 */
function buildEnhancedTooltipText(params: TooltipTextParams): string {
  const {
    city,
    description,
    isNight,
    tempC,
    tempF,
    windKmh,
    windDegrees,
    windGustKmh,
    humidity,
    visibility,
    sunEvent,
    latitude,
    longitude,
  } = params;

  // ── BROWSER DIAGNOSTIC: Log tooltip inputs ──────────────────────────
  console.debug('[TOOLTIP-BUILD-DIAG]', city, {
    windKmh,
    windDegrees,
    windGustKmh,
    humidity,
    visibility,
    isNight,
    windDegreesType: typeof windDegrees,
    windGustType: typeof windGustKmh,
    visibilityType: typeof visibility,
    windDegreesIsNull: windDegrees === null,
    windDegreesIsUndefined: windDegrees === undefined,
  });
  // ── END DIAGNOSTIC ──────────────────────────────────────────────────

  const parts: string[] = [];

  // ── 1. Weather description + city + temperature ─────────────────────
  let opening = '';
  if (description) {
    const display = isNight ? normaliseNightDescription(description) : description;
    opening = `${capitalise(display)} over ${city}`;
  } else {
    opening = `Weather over ${city}`;
  }

  if (tempC !== null && tempF !== null) {
    opening += ` with a temperature of ${Math.round(tempC)}°C / ${Math.round(tempF)}°F`;
  }

  // ── 2. Wind ─────────────────────────────────────────────────────────
  if (windKmh !== null && windKmh > 0) {
    if (windKmh <= 5) {
      // Calm winds — no compass direction
      opening += `, with calm winds`;
    } else if (windDegrees !== null) {
      const compass = degreesToCompass(windDegrees);
      const article = windArticle(compass);
      opening += `, with ${article} ${compass} wind of ${Math.round(windKmh)} km/h`;
    } else {
      // No wind direction data — omit compass
      opening += `, with winds of ${Math.round(windKmh)} km/h`;
    }

    // Gusts — only if meaningfully higher than sustained (> 1.1×)
    if (windGustKmh !== null && windGustKmh > windKmh * 1.1) {
      opening += ` with gusts of up to ${Math.round(windGustKmh)} km/h`;
    }
  }

  opening += '.';
  parts.push(opening);

  // ── 3. Humidity + Visibility (daytime only) ─────────────────────────
  if (humidity !== null) {
    if (!isNight && visibility !== null && visibility > 0) {
      parts.push(
        `Humidity is ${Math.round(humidity)}%, with visibility at ${formatVisibility(visibility)}.`,
      );
    } else {
      parts.push(`Humidity is ${Math.round(humidity)}%.`);
    }
  }

  // ── 4. Moon phase + position ────────────────────────────────────────
  const moon = getMoonPhase();
  // Ensure "moon" appears in the label
  const moonRaw = moon.name.charAt(0).toUpperCase() + moon.name.slice(1).toLowerCase();
  const moonLabel = moonRaw.toLowerCase().includes('moon') ? moonRaw : `${moonRaw} moon`;

  if (typeof latitude === 'number' && typeof longitude === 'number') {
    const pos = getLunarPosition(latitude, longitude);
    const altRounded = Math.round(pos.altitude);
    const altStr = altRounded >= 0 ? `+${altRounded}` : `${altRounded}`;

    if (pos.altitude > 0) {
      // Above horizon — "Waxing crescent moon, currently located high in the..."
      const phrase = buildMoonPositionPhrase(
        pos.altitudeBin,
        pos.azimuthBin,
        pos.altitude,
        isNight,
      );
      parts.push(`${moonLabel}, currently located ${phrase}.`);
    } else {
      // Below horizon — "The Waxing crescent moon is currently below the horizon..."
      parts.push(
        `The ${moonLabel} is currently below the horizon in the ${pos.azimuthBin} sky at ${altStr}°.`,
      );
    }
  } else {
    // No lat/lon — just phase name
    parts.push(`${moonLabel}.`);
  }

  // ── 5. Next sun event ───────────────────────────────────────────────
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
  onSpeak: () => void;
  speaking: boolean;
  showSpeaker: boolean;
}

function TooltipContent({
  text,
  tempColor,
  position,
  onMouseEnter,
  onMouseLeave,
  onCopy,
  copied,
  onSpeak,
  speaking,
  showSpeaker,
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

      {/* Content — heading + buttons, then text */}
      <div className="relative z-10 flex flex-col gap-2">
        {/* Header row: heading + speaker + copy buttons */}
        <div className="flex items-center justify-between gap-2">
          <span
            className="text-base font-semibold text-white"
            style={{ textShadow: `0 0 12px ${glowRgba}` }}
          >
            Meteorological Data
          </span>
          <div className="flex items-center gap-1">
            {/* Speaker button */}
            {showSpeaker && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSpeak();
                }}
                className={`
                  inline-flex items-center justify-center
                  w-6 h-6 rounded-md
                  transition-all duration-200
                  ${
                    speaking
                      ? 'bg-purple-500/20 text-purple-400'
                      : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200'
                  }
                `}
                title={speaking ? 'Stop' : 'Listen'}
                aria-label={speaking ? 'Stop listening' : 'Listen to weather data'}
              >
                {speaking ? (
                  /* Pause icon (animated bars) — matches hero speaker */
                  <svg
                    className="w-3.5 h-3.5 animate-pulse"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <rect x="6" y="4" width="4" height="16" rx="1" />
                    <rect x="14" y="4" width="4" height="16" rx="1" />
                  </svg>
                ) : (
                  /* Speaker icon */
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                    />
                  </svg>
                )}
              </button>
            )}

            {/* Copy button */}
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
 * Enhanced weather emoji tooltip for the AI provider leaderboard.
 *
 * Shows detailed meteorological data with:
 * - Temperature (°C / °F)
 * - Wind speed + compass direction + gusts
 * - Humidity percentage
 * - Visibility (daytime only, smart unit selection: km/miles or m/yards)
 * - Moon phase + position (day and night)
 * - Next sun event (sunrise / sunset)
 * - Copy button + Speaker button (British female TTS)
 *
 * Same portal + glow + hover-persistence pattern as WeatherEmojiTooltip.
 */
export function ProviderWeatherEmojiTooltip({
  children,
  city,
  tz,
  description,
  isNight,
  tempC,
  tempF,
  windKmh,
  windDegrees,
  windGustKmh,
  humidity,
  visibility,
  sunriseUtc,
  sunsetUtc,
  latitude,
  longitude,
  tooltipPosition = 'left',
}: ProviderWeatherEmojiTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [tooltipCoords, setTooltipCoords] = useState({ top: 0, left: 0 });
  const [isMounted, setIsMounted] = useState(false);
  const [hasSpeech, setHasSpeech] = useState(false);

  const triggerRef = useRef<HTMLSpanElement>(null);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // SSR safety — only render portal after mount + detect TTS support
  useEffect(() => {
    setIsMounted(true);
    setHasSpeech(isSpeechSupported());
    return () => {
      setIsMounted(false);
      // Stop TTS on full component unmount (page navigation) — not on tooltip hide
      stopSpeaking();
    };
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    };
  }, []);

  // TTS continues independently even after tooltip closes.
  // The onEnd callback in speakText() resets the speaking state naturally.

  // Reset copied state after timeout
  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [copied]);

  // ── Compute tooltip data ───────────────────────────────────────────
  const sunEvent = getNextSunEvent(isNight, tz, sunriseUtc, sunsetUtc, latitude, longitude);
  const tooltipText = buildEnhancedTooltipText({
    city,
    description,
    isNight,
    tempC,
    tempF,
    windKmh,
    windDegrees,
    windGustKmh,
    humidity,
    visibility,
    sunEvent,
    latitude,
    longitude,
  });
  const tempColor = tempC !== null ? getTemperatureColor(tempC) : '#38BDF8';

  // ── Position calculation ───────────────────────────────────────────
  const calculatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();

    let left =
      tooltipPosition === 'left'
        ? rect.right + TOOLTIP_GAP
        : rect.left - TOOLTIP_WIDTH - TOOLTIP_GAP;

    const top = rect.top + rect.height / 2;

    // Viewport boundary clamping — prevent overflow
    if (left + TOOLTIP_WIDTH > window.innerWidth - 8) {
      left = rect.left - TOOLTIP_WIDTH - TOOLTIP_GAP;
    }
    if (left < 8) {
      left = rect.right + TOOLTIP_GAP;
    }

    setTooltipCoords({ top, left });
  }, [tooltipPosition]);

  // ── Hover handlers (same 400ms persistence as exchange tooltip) ────
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

  // TTS handler — toggle speak/stop
  const handleSpeak = useCallback(() => {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    speakText(tooltipText, {
      onStart: () => setSpeaking(true),
      onEnd: () => setSpeaking(false),
    });
  }, [speaking, tooltipText]);

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
            onSpeak={handleSpeak}
            speaking={speaking}
            showSpeaker={hasSpeech}
          />,
          document.body,
        )}
    </>
  );
}

export default ProviderWeatherEmojiTooltip;
