// src/components/providers/provider-cell.tsx
// ============================================================================
// Provider Cell - Individual provider row in the leaderboard table
// ============================================================================
// Market Pulse v2.0: City connection badges REMOVED.
// Visual connection now shown via flowing energy particles in SVG overlay.
// ============================================================================
// Updated: January 22, 2026
// - Removed prompt builder link (🎨 + "Prompt builder" text)
// - Added API (🔌) and Affiliate (🤝) emoji links in its place
// - 🔌 links to provider's API documentation
// - 🤝 links to provider's affiliate/partner program
// ============================================================================
// Updated: January 27, 2026
// - Added RankUpArrow for providers that climbed in rankings (green ⬆ with glow)
// - Added hasRankUp prop to ProviderCellProps
// ============================================================================
// Updated: February 21, 2026
// - REPLACED custom ProviderWeatherTooltip with proven WeatherPromptTooltip
//   (same component exchange cards use — battle-tested, no silent failures)
// - Weather mapping resolved here, passed as direct props (not internal lookup)
// - Flag size 16 → 20 to match exchange cards
// - Added shrink-0 cursor-pointer + title="" wrapper (matches exchange cards)
// ============================================================================

'use client';

import React from 'react';
import type { Provider } from '@/types/provider';
import { ProviderClock } from './provider-clock';
import { Flag } from '@/components/ui/flag';
import Tooltip from '@/components/ui/tooltip';
import { RankUpArrow } from './index-rating-cell';

// Exchange weather tooltip — the same proven component exchange cards use
import { WeatherPromptTooltip } from '@/components/exchanges/weather/weather-prompt-tooltip';

// Provider weather emoji tooltip — enhanced conditions + TTS
import { ProviderWeatherEmojiTooltip } from './provider-weather-emoji-tooltip';

// Shared day/night detection + moon phase
import { resolveIsNight } from '@/lib/weather/day-night';
import { getMoonPhase } from '@/lib/weather/weather-prompt-generator';

// Provider → weather mapping (resolves provider ID to weather city + coords)
import { getProviderWeatherMapping } from '@/data/providers/provider-weather-map';

// Global prompt tier — user's Pro selection controls ALL flag tooltips
import { useGlobalPromptTier } from '@/hooks/use-global-prompt-tier';

// Types
import type { WeatherData } from '@/hooks/use-weather';
import type { ExchangeWeatherDisplay } from '@/lib/weather/weather-types';

export type ProviderCellProps = {
  provider: Provider;
  /** Display rank (1, 2, 3…) — reflects current sort order */
  rank?: number;
  /** Whether this provider climbed in rank position within last 24h */
  hasRankUp?: boolean;
  /** Weather data map from useWeather() — enables provider flag weather tooltips */
  weatherMap?: Record<string, WeatherData>;
  /** Whether user is Pro (for tooltip badge) */
  isPro?: boolean;
};

/** Fallback icon path if provider icon fails to load */
const FALLBACK_ICON = '/icons/providers/fallback.png';

/** Providers that should use 🏠 emoji instead of icon */
const EMOJI_FALLBACK_PROVIDERS = ['dreamstudio'];

// ============================================================================
// WEATHER DATA CONVERTER
// ============================================================================

/**
 * Convert useWeather() hook data → ExchangeWeatherDisplay.
 * Same shape the exchange WeatherPromptTooltip expects.
 */
function hookWeatherToDisplay(w: WeatherData): ExchangeWeatherDisplay {
  return {
    tempC: w.temperatureC,
    tempF: w.temperatureF,
    emoji: w.emoji,
    condition: w.conditions,
    humidity: w.humidity,
    windKmh: w.windSpeedKmh,
    description: w.description,
    sunriseUtc: w.sunriseUtc ?? null,
    sunsetUtc: w.sunsetUtc ?? null,
    timezoneOffset: w.timezoneOffset ?? null,
    isDayTime: w.isDayTime ?? null,
    cloudCover: null,
    visibility: w.visibility ?? null,
    pressure: null,
    rainMm1h: null,
    snowMm1h: null,
    windDegrees: w.windDegrees ?? null,
    windGustKmh: w.windGustKmh ?? null,
    weatherId: null,
  };
}

// ============================================================================
// INTELLIGENT DEMO WEATHER GENERATOR
// ============================================================================
// When the gateway hasn't fetched a provider's batch yet, generate plausible
// weather from lat/lon + current time so every tooltip has content immediately.
// Replaced automatically when live API data arrives via useWeather().
// ============================================================================

/** Climate band boundaries (absolute latitude) */
const CLIMATE_BANDS = [
  { max: 10, band: 'equatorial' as const },
  { max: 23.5, band: 'tropical' as const },
  { max: 35, band: 'subtropical' as const },
  { max: 55, band: 'temperate' as const },
  { max: 90, band: 'subarctic' as const },
] as const;

type ClimateBand = (typeof CLIMATE_BANDS)[number]['band'];

/** Plausible weather profiles per climate band per season */
const CLIMATE_PROFILES: Record<
  ClimateBand,
  {
    summer: {
      tempRange: [number, number];
      humidity: [number, number];
      conditions: string[];
      emoji: string[];
    };
    winter: {
      tempRange: [number, number];
      humidity: [number, number];
      conditions: string[];
      emoji: string[];
    };
  }
> = {
  equatorial: {
    summer: {
      tempRange: [26, 33],
      humidity: [70, 90],
      conditions: ['Partly Cloudy', 'Scattered Clouds', 'Light Rain'],
      emoji: ['⛅', '🌤️', '🌧️'],
    },
    winter: {
      tempRange: [24, 31],
      humidity: [65, 85],
      conditions: ['Partly Cloudy', 'Humid Haze', 'Thunderstorm'],
      emoji: ['⛅', '🌫️', '⛈️'],
    },
  },
  tropical: {
    summer: {
      tempRange: [28, 36],
      humidity: [55, 80],
      conditions: ['Clear Sky', 'Partly Cloudy', 'Light Rain'],
      emoji: ['☀️', '⛅', '🌦️'],
    },
    winter: {
      tempRange: [18, 27],
      humidity: [40, 65],
      conditions: ['Clear Sky', 'Few Clouds', 'Partly Cloudy'],
      emoji: ['☀️', '🌤️', '⛅'],
    },
  },
  subtropical: {
    summer: {
      tempRange: [25, 35],
      humidity: [45, 70],
      conditions: ['Clear Sky', 'Partly Cloudy', 'Haze'],
      emoji: ['☀️', '⛅', '🌫️'],
    },
    winter: {
      tempRange: [8, 18],
      humidity: [50, 75],
      conditions: ['Overcast', 'Light Rain', 'Partly Cloudy'],
      emoji: ['☁️', '🌧️', '⛅'],
    },
  },
  temperate: {
    summer: {
      tempRange: [18, 28],
      humidity: [40, 65],
      conditions: ['Clear Sky', 'Partly Cloudy', 'Few Clouds'],
      emoji: ['☀️', '⛅', '🌤️'],
    },
    winter: {
      tempRange: [-2, 8],
      humidity: [60, 85],
      conditions: ['Overcast', 'Light Rain', 'Drizzle', 'Light Snow'],
      emoji: ['☁️', '🌧️', '🌦️', '🌨️'],
    },
  },
  subarctic: {
    summer: {
      tempRange: [10, 20],
      humidity: [50, 75],
      conditions: ['Partly Cloudy', 'Overcast', 'Light Rain'],
      emoji: ['⛅', '☁️', '🌧️'],
    },
    winter: {
      tempRange: [-15, -2],
      humidity: [65, 90],
      conditions: ['Overcast', 'Snow', 'Light Snow', 'Blizzard'],
      emoji: ['☁️', '🌨️', '❄️', '🌬️'],
    },
  },
};

/**
 * Generate plausible demo weather from geographic coordinates.
 *
 * Uses latitude for climate band, month + hemisphere for season,
 * longitude for timezone/day-night estimation.
 * Deterministic per provider (seeded by lat+lon) so it doesn't flicker on re-render.
 */
function generateDemoWeather(lat: number, lon: number): ExchangeWeatherDisplay {
  const now = new Date();
  const month = now.getUTCMonth(); // 0-11
  const absLat = Math.abs(lat);

  // ── Climate band ──────────────────────────────────────────────────────
  const band: ClimateBand = CLIMATE_BANDS.find((b) => absLat <= b.max)?.band ?? 'temperate';

  // ── Season (southern hemisphere inverts) ───────────────────────────────
  const isNorthern = lat >= 0;
  const isSummerMonth = month >= 4 && month <= 9; // May-Oct
  const isSummer = isNorthern ? isSummerMonth : !isSummerMonth;
  const season = isSummer ? 'summer' : 'winter';

  // ── Profile selection ─────────────────────────────────────────────────
  const profile = CLIMATE_PROFILES[band][season];

  // ── Deterministic pseudo-random from coordinates ──────────────────────
  // Simple hash so the same provider always gets the same demo weather
  const seed = Math.abs(Math.round(lat * 1000) + Math.round(lon * 1000)) % 100;
  const pick = (arr: readonly string[]) => arr[seed % arr.length];
  const lerp = (min: number, max: number) => min + ((seed % 37) / 37) * (max - min);

  // ── Local time estimation (for day/night) ─────────────────────────────
  const tzOffsetHours = Math.round(lon / 15); // rough timezone from longitude
  const tzOffsetSec = tzOffsetHours * 3600;
  const localHour = (now.getUTCHours() + tzOffsetHours + 24) % 24;
  const isDayTime = localHour >= 6 && localHour < 20;

  // ── Day/night temperature adjustment ──────────────────────────────────
  const nightDrop = isDayTime ? 0 : band === 'subarctic' ? 3 : band === 'temperate' ? 4 : 2;

  const tempC = Math.round(lerp(profile.tempRange[0], profile.tempRange[1]) - nightDrop);
  const tempF = Math.round((tempC * 9) / 5 + 32);
  const humidity = Math.round(lerp(profile.humidity[0], profile.humidity[1]));
  const windKmh = Math.round(lerp(5, 22));
  const condition = pick(profile.conditions) ?? null;
  const emoji = pick(profile.emoji) ?? null;

  // ── Sunrise/sunset estimates (for prompt generator physics) ────────────
  // Approximate: sunrise ~6am local, sunset ~6pm local (varies by season)
  const sunriseLocalH = isSummer ? 5.5 : 7;
  const sunsetLocalH = isSummer ? 20.5 : 17;
  const todayMidnightUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const sunriseUtc = Math.round(
    todayMidnightUtc.getTime() / 1000 + (sunriseLocalH - tzOffsetHours) * 3600,
  );
  const sunsetUtc = Math.round(
    todayMidnightUtc.getTime() / 1000 + (sunsetLocalH - tzOffsetHours) * 3600,
  );

  // ── Demo wind direction, gusts, and visibility ─────────────────────────
  // Deterministic from seed so same provider always gets same values
  const demoWindDeg = (seed * 47) % 360; // 0–359 degrees
  const demoGustKmh = Math.round(windKmh * (1.2 + (seed % 19) / 60)); // 1.2–1.5× sustained
  // Visibility: clear/few clouds → 10000m, overcast/rain → 5000–8000m
  const isGoodVisCondition =
    condition?.toLowerCase().includes('clear') || condition?.toLowerCase().includes('few');
  const demoVisibility = isGoodVisCondition ? 10000 : Math.round(lerp(5000, 8000));

  return {
    tempC,
    tempF,
    emoji,
    condition,
    humidity,
    windKmh,
    description: condition,
    sunriseUtc,
    sunsetUtc,
    timezoneOffset: tzOffsetSec,
    isDayTime,
    cloudCover: null,
    visibility: demoVisibility,
    pressure: null,
    rainMm1h: null,
    snowMm1h: null,
    windDegrees: demoWindDeg,
    windGustKmh: demoGustKmh,
    weatherId: null,
  };
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

/**
 * Renders API and Affiliate emoji links.
 * - 🔌 API: Links to API docs if available, static otherwise
 * - 🤝 Affiliate: Links to affiliate program if available, static otherwise
 */
function ApiAffiliateEmojis({ provider }: { provider: Provider }) {
  const hasApi = provider.apiAvailable;
  const hasAffiliate = provider.affiliateProgramme;

  // Get URLs from provider data
  const apiUrl = provider.apiDocsUrl;
  const affiliateUrl = provider.affiliateUrl;

  // If neither API nor affiliate, render nothing
  if (!hasApi && !hasAffiliate) {
    return null;
  }

  return (
    <span className="provider-api-affiliate-icons">
      {/* API emoji - links to docs if URL available */}
      {hasApi &&
        (apiUrl ? (
          <Tooltip text="API documentation">
            <a
              href={apiUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="provider-api-link"
              aria-label={`${provider.name} API documentation (opens in new tab)`}
            >
              <span aria-hidden="true">🔌</span>
            </a>
          </Tooltip>
        ) : (
          <Tooltip text="API available">
            <span className="provider-api-static" aria-label="API available">
              🔌
            </span>
          </Tooltip>
        ))}

      {/* Affiliate emoji - links to program if URL available */}
      {hasAffiliate &&
        (affiliateUrl ? (
          <Tooltip text="Affiliate programme">
            <a
              href={affiliateUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="provider-affiliate-link"
              aria-label={`${provider.name} affiliate programme (opens in new tab)`}
            >
              <span aria-hidden="true">🤝</span>
            </a>
          </Tooltip>
        ) : (
          <Tooltip text="Affiliate programme available">
            <span className="provider-affiliate-static" aria-label="Affiliate programme available">
              🤝
            </span>
          </Tooltip>
        ))}
    </span>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function ProviderCell({
  provider,
  rank,
  hasRankUp = false,
  weatherMap,
  isPro = false,
}: ProviderCellProps) {
  // Check if this provider should use emoji fallback
  const useEmojiIcon = EMOJI_FALLBACK_PROVIDERS.includes(provider.id);

  // Local icon path: /icons/providers/{id}.png
  const iconPath = provider.localIcon || `/icons/providers/${provider.id}.png`;

  // Homepage URL via redirect
  const homepageUrl = `/go/${encodeURIComponent(provider.id)}?src=leaderboard_homepage`;

  // ── Resolve weather data for this provider ──────────────────────────────
  // Always resolve the mapping (it's a static lookup, doesn't need weather data).
  // If live weather isn't available yet (batch not fetched), use intelligent demo
  // based on lat/lon. Demo is automatically replaced when live data arrives via
  // useWeather() hook refresh cycle.
  const mapping = getProviderWeatherMapping(provider.id);
  const rawWeather = mapping && weatherMap ? weatherMap[mapping.weatherId] : undefined;
  const liveDisplay = rawWeather ? hookWeatherToDisplay(rawWeather) : null;
  const demoDisplay =
    mapping && !liveDisplay ? generateDemoWeather(mapping.lat, mapping.lon) : null;
  const weatherDisplay = liveDisplay ?? demoDisplay;
  const { tier: providerTier } = useGlobalPromptTier();

  // ── Resolve day/night + display emoji ─────────────────────────────────
  // Uses the same 3-tier cascade as exchange cards (shared utility).
  // Night → moon phase emoji, Day → weather condition emoji.
  const isNight =
    weatherDisplay && provider.timezone
      ? resolveIsNight(
          weatherDisplay.isDayTime,
          provider.timezone,
          weatherDisplay.sunriseUtc,
          weatherDisplay.sunsetUtc,
          weatherDisplay.timezoneOffset,
        )
      : false;

  const displayEmoji = weatherDisplay
    ? isNight
      ? getMoonPhase().emoji
      : (weatherDisplay.emoji ?? '🌤️')
    : null;

  // ── BROWSER DIAGNOSTIC: Log tooltip data for specific providers ────
  if (weatherDisplay && mapping && (provider.id === 'midjourney' || provider.id === 'nightcafe' || provider.id === 'artbreeder')) {
    console.debug('[PROVIDER-CELL-DIAG]', provider.id, '→', mapping.weatherId, {
      isLive: !!liveDisplay,
      isDemo: !!demoDisplay,
      windDegrees: weatherDisplay.windDegrees,
      windGustKmh: weatherDisplay.windGustKmh,
      visibility: weatherDisplay.visibility,
      windKmh: weatherDisplay.windKmh,
      windDegreesType: typeof weatherDisplay.windDegrees,
    });
  }
  // ── END DIAGNOSTIC ─────────────────────────────────────────────────

  return (
    <div className="provider-cell-container">
      {/* Line 1: Rank + Provider name (linked) + provider logo icon + API/Affiliate + RankUp arrow */}
      <div className="provider-name-row">
        {typeof rank === 'number' && rank > 0 && <span className="provider-rank">{rank}.</span>}

        {/* Provider name — hyperlinked to homepage */}
        <a
          href={homepageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="provider-name-link"
          style={{ fontSize: 'clamp(0.6rem, 1vw, 1rem)' }}
          aria-label={`Visit ${provider.name} website (opens in new tab)`}
        >
          {provider.name}
        </a>

        {/* Provider logo icon OR 🏠 emoji for specific providers */}
        <a
          href={homepageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="provider-logo-link"
          aria-label={`Visit ${provider.name} website (opens in new tab)`}
        >
          {useEmojiIcon ? (
            <span className="provider-emoji-icon" aria-hidden="true">
              🏠
            </span>
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element -- 
               Using <img> for onError fallback handling which next/image doesn't support well.
               These are small 18x18px icons with minimal LCP impact. */
            <img
              src={iconPath}
              alt=""
              className="provider-logo-icon"
              onError={(e) => {
                // Fallback if icon fails to load
                const target = e.currentTarget;
                if (target.src !== FALLBACK_ICON) {
                  target.src = FALLBACK_ICON;
                }
              }}
            />
          )}
        </a>

        {/* API and Affiliate emoji links */}
        <ApiAffiliateEmojis provider={provider} />

        {/* Green rank-up arrow — shows when provider climbed in rankings (24h) */}
        <RankUpArrow show={hasRankUp} className="rank-up-arrow" />
      </div>

      {/* Line 2 & 3: Location block — Flag + City, then Time below */}
      {provider.countryCode && provider.hqCity && provider.timezone ? (
        <div className="provider-location">
          {/* Flag + City */}
          <div className="provider-city-line">
            {weatherDisplay && mapping ? (
              <WeatherPromptTooltip
                city={mapping.tooltipCity ?? mapping.vibesCity}
                tz={provider.timezone}
                weather={weatherDisplay}
                tier={providerTier}
                isPro={isPro}
                tooltipPosition="left"
                latitude={mapping.lat}
                longitude={mapping.lon}
              >
                {/* title="" suppresses native "United States flag" browser tooltip */}
                <span title="">
                  <Flag
                    countryCode={provider.countryCode}
                    size={20}
                    decorative={false}
                    className="shrink-0 cursor-pointer"
                  />
                </span>
              </WeatherPromptTooltip>
            ) : (
              <Flag countryCode={provider.countryCode} size={20} decorative />
            )}
            <span className="provider-city">
              {provider.hqCity}
              {mapping?.tooltipCity && mapping.tooltipCity !== provider.hqCity && (
                <span style={{ opacity: 0.6 }}>{` (${mapping.tooltipCity})`}</span>
              )}
            </span>
          </div>

          {/* Weather/Moon emoji + Time — same row, emoji beneath flag */}
          <div
            className="inline-flex items-center gap-1.5"
            style={{ paddingLeft: 'clamp(0.05rem, 0.15vw, 0.2rem)' }}
          >
            {displayEmoji && weatherDisplay && mapping && provider.timezone && (
              <ProviderWeatherEmojiTooltip
                city={mapping.tooltipCity ?? mapping.vibesCity}
                tz={provider.timezone}
                description={weatherDisplay.description}
                isNight={isNight}
                tempC={weatherDisplay.tempC}
                tempF={weatherDisplay.tempF}
                windKmh={weatherDisplay.windKmh}
                windDegrees={weatherDisplay.windDegrees}
                windGustKmh={weatherDisplay.windGustKmh}
                humidity={weatherDisplay.humidity}
                visibility={weatherDisplay.visibility}
                sunriseUtc={weatherDisplay.sunriseUtc}
                sunsetUtc={weatherDisplay.sunsetUtc}
                latitude={mapping.lat}
                longitude={mapping.lon}
                tooltipPosition="left"
              >
                <span
                  style={{ fontSize: 'clamp(0.65rem, 0.85vw, 1.1rem)', lineHeight: 1 }}
                  aria-label={isNight ? 'Moon phase' : 'Weather conditions'}
                >
                  {displayEmoji}
                </span>
              </ProviderWeatherEmojiTooltip>
            )}
            <ProviderClock timezone={provider.timezone} supportHours={provider.supportHours} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
