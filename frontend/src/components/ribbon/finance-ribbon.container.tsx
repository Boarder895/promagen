// frontend/src/components/ribbon/finance-ribbon.container.tsx
//
// Container/orchestrator only (API Brain compliant):
// - Calls the centralised FX hook (polling is client-only; authority remains server-side).
// - Joins SSOT pair metadata + API payload into presentational chips.
// - Preserves SSOT order end-to-end (no re-sorting).
// - No freshness inference, no "helpful" refresh logic, no upstream/provider knowledge.
//
// v3.0: City-Vibes Tooltips on FX Flags
// - Each flag can show a WeatherPromptTooltip with city-vibes image prompt
// - Currency → city mapping via fx-currency-city-map.ts
// - Weather data looked up from weatherIndex (keyed by exchange ID)
// - Independent tier selection for FX ribbon (separate from exchange cards)
// - USD flags alternate between New York (NYSE) and Chicago (CBOE)
//
// v2.0: Two Separate Ribbon Components
// - FinanceRibbonTop: 5 pairs (0-4) - EUR/USD, GBP/USD, GBP/ZAR, USD/CAD, USD/CNY
// - FinanceRibbonBottom: 5 pairs (5-9) - USD/INR, USD/BRL, AUD/USD, USD/NOK, USD/MYR
//
// Spec anchors:
// - SSOT order must be preserved end-to-end. (See Ribbon_Homepage.md)
// - UI is a renderer; it must not decide TTL/A-B/providers/costs. (See API Brain v2)
//
// Existing features preserved: Yes

'use client';

import React, { useMemo } from 'react';

import FinanceRibbon from '@/components/ribbon/finance-ribbon';
import FxPairLabel from '@/components/ribbon/fx-pair-label';
import type { FxFlagTooltipData } from '@/components/ribbon/fx-pair-label';

import { useFxQuotes, type FxTickDirection } from '@/hooks/use-fx-quotes';
import { useGlobalPromptTier } from '@/hooks/use-global-prompt-tier';
import { assertFxPairsSsotValid, getFxRibbonPairs } from '@/lib/finance/fx-pairs';
import { getCurrencyCityInfo } from '@/lib/fx/fx-currency-city-map';

import type { ExchangeWeatherData } from '@/components/exchanges/types';
import type { ExchangeWeatherDisplay } from '@/lib/weather/weather-types';
import type { FxApiMode, FxApiQuote } from '@/types/finance-ribbon';

export interface FinanceRibbonChip {
  id: string;
  label: React.ReactNode;
  priceText: string;

  // Presentational "alive" language inputs
  tick: FxTickDirection;
  isNeutral: boolean;
}

/** Row split configuration - matches gateway scheduler */
const FX_ROW_CONFIG = {
  topRowSize: 5,    // Pairs 0-4
  bottomRowSize: 5, // Pairs 5-9
} as const;

const POLL_INTERVAL_MS = 300_000; // 5 minutes - prevents API quota exhaustion

// ============================================================================
// HELPERS
// ============================================================================

function safeFiniteNumber(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function formatPrice(price: number | null, precision?: number): string {
  if (price === null) return '—';

  const p = safeFiniteNumber(precision);
  const digits = p === null ? 2 : Math.max(0, Math.min(8, Math.floor(p)));

  return price.toLocaleString('en-GB', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/**
 * Convert ExchangeWeatherData (optional fields) → ExchangeWeatherDisplay (null fields).
 * Same pattern used in mission-control.tsx.
 */
function toWeatherDisplay(data: ExchangeWeatherData): ExchangeWeatherDisplay {
  return {
    tempC: data.tempC,
    tempF: data.tempF ?? null,
    emoji: data.emoji,
    condition: data.condition ?? null,
    humidity: data.humidity ?? null,
    windKmh: data.windKmh ?? data.windSpeedKmh ?? null,
    description: data.description ?? null,
    sunriseUtc: data.sunriseUtc ?? null,
    sunsetUtc: data.sunsetUtc ?? null,
    timezoneOffset: data.timezoneOffset ?? null,
    isDayTime: data.isDayTime ?? null,
    cloudCover: data.cloudCover ?? null,
    visibility: data.visibility ?? null,
    pressure: data.pressure ?? null,
    rainMm1h: data.rainMm1h ?? null,
    snowMm1h: data.snowMm1h ?? null,
    windDegrees: data.windDegrees ?? null,
    windGustKmh: data.windGustKmh ?? null,
    weatherId: data.weatherId ?? null,
  };
}

// ============================================================================
// SHARED FX DATA HOOK
// ============================================================================

interface UseFxRibbonDataOptions {
  weatherIndex?: Map<string, ExchangeWeatherData>;
}

/**
 * Shared hook for FX data - used by both Top and Bottom ribbons.
 * Now resolves weather data per currency for city-vibes tooltips.
 */
function useFxRibbonData(options: UseFxRibbonDataOptions = {}) {
  const { weatherIndex } = options;

  const { payload, quotesById, movementById } = useFxQuotes({
    enabled: true,
    intervalMs: POLL_INTERVAL_MS,
  });

  // Global prompt tier — unified across ALL flag tooltips (v3.0.0)
  // Surface-aware: free users see Tier 1 (CLIP) on FX ribbon for variety
  const { tier: fxTier, isPro: isProUser } = useGlobalPromptTier('fx-ribbon');

  // SSOT: validate once (dev/build feedback), then use SSOT order as-is.
  const pairs = useMemo(() => {
    assertFxPairsSsotValid();
    return getFxRibbonPairs({ order: 'ssot' });
  }, []);

  const buildId = payload?.meta?.buildId ?? 'unknown';
  const mode: FxApiMode = payload?.meta?.mode ?? 'cached';

  // Build all chips from pairs — with optional tooltip data per flag
  const allChips: FinanceRibbonChip[] = useMemo(() => {
    return pairs.map((p, pairIndex) => {
      const q: FxApiQuote | undefined = quotesById.get(p.id);
      const mv = movementById.get(p.id);

      const winnerSide = mv?.winnerSide ?? 'neutral';
      const tick: FxTickDirection = mv?.tick ?? 'flat';
      const isNeutral = winnerSide === 'neutral';

      // ── Resolve tooltip data for base flag ──
      let baseTooltip: FxFlagTooltipData | null = null;
      const baseCityInfo = getCurrencyCityInfo(p.base, pairIndex, 'base');
      if (baseCityInfo && weatherIndex) {
        const wd = weatherIndex.get(baseCityInfo.exchangeId);
        if (wd && wd.tempC !== null) {
          baseTooltip = {
            city: baseCityInfo.city,
            tz: baseCityInfo.tz,
            weather: toWeatherDisplay(wd),
            latitude: baseCityInfo.latitude,
            longitude: baseCityInfo.longitude,
            tier: fxTier,
            isPro: isProUser,
          };
        }
      }

      // ── Resolve tooltip data for quote flag ──
      let quoteTooltip: FxFlagTooltipData | null = null;
      const quoteCityInfo = getCurrencyCityInfo(p.quote, pairIndex, 'quote');
      if (quoteCityInfo && weatherIndex) {
        const wd = weatherIndex.get(quoteCityInfo.exchangeId);
        if (wd && wd.tempC !== null) {
          quoteTooltip = {
            city: quoteCityInfo.city,
            tz: quoteCityInfo.tz,
            weather: toWeatherDisplay(wd),
            latitude: quoteCityInfo.latitude,
            longitude: quoteCityInfo.longitude,
            tier: fxTier,
            isPro: isProUser,
          };
        }
      }

      return {
        id: p.id,
        label: (
          <FxPairLabel
            base={p.base}
            baseCountryCode={p.baseCountryCode ?? null}
            quote={p.quote}
            quoteCountryCode={p.quoteCountryCode ?? null}
            baseTooltip={baseTooltip}
            quoteTooltip={quoteTooltip}
          />
        ),
        priceText: formatPrice(q?.price ?? null, p.precision),
        tick,
        isNeutral,
      };
    });
  }, [pairs, quotesById, movementById, weatherIndex, fxTier, isProUser]);

  return { buildId, mode, allChips };
}

// ============================================================================
// PUBLIC RIBBON COMPONENTS
// ============================================================================

export interface FinanceRibbonRowProps {
  /** Weather data keyed by exchange ID — for city-vibes tooltips */
  weatherIndex?: Map<string, ExchangeWeatherData>;
}

/**
 * TOP FX RIBBON - 5 pairs (positions 0-4)
 * EUR/USD, GBP/USD, GBP/ZAR, USD/CAD, USD/CNY
 */
export function FinanceRibbonTop({ weatherIndex }: FinanceRibbonRowProps = {}) {
  const { buildId, mode, allChips } = useFxRibbonData({ weatherIndex });

  const chips = useMemo(
    () => allChips.slice(0, FX_ROW_CONFIG.topRowSize),
    [allChips],
  );

  return (
    <FinanceRibbon
      buildId={buildId}
      mode={mode}
      chips={chips}
      rowLabel="FX pairs - majors and commodity currencies"
      testId="fx-ribbon-top"
    />
  );
}

/**
 * BOTTOM FX RIBBON - 5 pairs (positions 5-9)
 * USD/INR, USD/BRL, AUD/USD, USD/NOK, USD/MYR
 */
export function FinanceRibbonBottom({ weatherIndex }: FinanceRibbonRowProps = {}) {
  const { buildId, mode, allChips } = useFxRibbonData({ weatherIndex });

  const chips = useMemo(
    () => allChips.slice(FX_ROW_CONFIG.topRowSize, FX_ROW_CONFIG.topRowSize + FX_ROW_CONFIG.bottomRowSize),
    [allChips],
  );

  return (
    <FinanceRibbon
      buildId={buildId}
      mode={mode}
      chips={chips}
      rowLabel="FX pairs - emerging market currencies"
      testId="fx-ribbon-bottom"
    />
  );
}

/**
 * Legacy default export - renders both rows stacked
 * @deprecated Use FinanceRibbonTop and FinanceRibbonBottom separately
 */
export function FinanceRibbonContainer() {
  return (
    <>
      <FinanceRibbonTop />
      <FinanceRibbonBottom />
    </>
  );
}

export default FinanceRibbonContainer;
