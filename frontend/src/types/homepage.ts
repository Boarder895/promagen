// src/types/homepage.ts
// ============================================================================
// NEW HOMEPAGE TYPES — Authority: docs/authority/homepage.md
// ============================================================================
// TypeScript types for the new homepage components:
// - Prompt of the Moment showcase
// - Community Pulse feed
// - Like system
// - Online users by country
// - Scene Starters preview
//
// v2.0.0 (Phase D): tierSelections now carries WeatherCategoryMap — the full
// structured category data from weather intelligence. Builder reads this to
// populate ALL 12 categories with real physics-computed data.
//
// Existing features preserved: Yes (additive changes only)
// ============================================================================

import type { WeatherCategoryMap } from './prompt-builder';

// ── Prompt of the Moment ────────────────────────────────────────────────────

/** A provider shortcut shown as a "Try in" icon below each tier prompt */
export interface ProviderShortcut {
  /** Provider ID from providers.json SSOT */
  id: string;
  /** Display name (e.g., "Leonardo AI") */
  name: string;
  /** Path to provider icon PNG (e.g., "/icons/providers/leonardo.png") */
  iconPath: string;
}

/** The full Prompt of the Moment response from /api/homepage/prompt-of-the-moment */
export interface PromptOfTheMoment {
  /** City name (e.g., "Tokyo") */
  city: string;
  /** ISO 3166-1 alpha-2 country code (e.g., "JP") */
  countryCode: string;
  /** Formatted local time (e.g., "14:32 JST") */
  localTime: string;
  /** Weather conditions text (e.g., "Light Rain") */
  conditions: string;
  /** Mood derived from weather/time (e.g., "Serene") */
  mood: string;
  /** City venue used for prompt (e.g., "Shibuya Crossing") */
  venue: string;
  /** Four tier prompts */
  prompts: {
    tier1: string;
    tier2: string;
    tier3: string;
    tier4: string;
  };
  /** Top providers for each tier (for "Try in" icons) */
  tierProviders: {
    tier1: ProviderShortcut[];
    tier2: ProviderShortcut[];
    tier3: ProviderShortcut[];
    tier4: ProviderShortcut[];
  };
  /** ISO timestamp when this prompt was generated */
  generatedAt: string;
  /** ISO timestamp when the next rotation will occur */
  nextRotationAt: string;
  /** Current rotation index (0–101) */
  rotationIndex: number;
  /** Weather data for tooltip (matches ProviderWeatherEmojiTooltip props) */
  weather: {
    /** Weather description text (e.g., "broken clouds") */
    description: string;
    /** Weather condition emoji from OWM */
    emoji: string;
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
    /** Visibility in metres */
    visibility: number | null;
    /** Sunrise UTC timestamp (seconds) */
    sunriseUtc: number | null;
    /** Sunset UTC timestamp (seconds) */
    sunsetUtc: number | null;
    /** Whether OWM reports it as daytime */
    isDayTime: boolean | null;
    /** Timezone offset from UTC in seconds */
    timezoneOffset: number | null;
    /** Latitude of the city */
    latitude: number | null;
    /** Longitude of the city */
    longitude: number | null;
    /** IANA timezone string (e.g., "Europe/Berlin") */
    timezone: string;
  };
  /** §4.5 / Phase D: "Try in" payload per tier.
   *  categoryMap — full WeatherCategoryMap from weather intelligence (Phase D, preferred)
   *  promptText  — actual weather-generated prompt for this tier (legacy fallback)
   *  selections  — mood-derived metadata (legacy, superseded by categoryMap)
   *  Builder reads categoryMap first; falls back to promptText+selections for old responses. */
  tierSelections?: {
    tier1: { promptText: string; selections: Record<string, string[]>; categoryMap?: WeatherCategoryMap };
    tier2: { promptText: string; selections: Record<string, string[]>; categoryMap?: WeatherCategoryMap };
    tier3: { promptText: string; selections: Record<string, string[]>; categoryMap?: WeatherCategoryMap };
    tier4: { promptText: string; selections: Record<string, string[]>; categoryMap?: WeatherCategoryMap };
  };
  /** §4.5 #2: "Inspired by" badge metadata — shown in prompt builder when pre-loaded */
  inspiredBy?: {
    /** City name (e.g., "Tokyo") */
    city: string;
    /** Venue name (e.g., "Shibuya Crossing") */
    venue: string;
    /** Weather conditions (e.g., "Light Rain") */
    conditions: string;
    /** Weather emoji */
    emoji: string;
    /** Temperature in Celsius */
    tempC: number | null;
    /** Formatted local time (e.g., "14:32 JST") */
    localTime: string;
    /** Mood (e.g., "Serene") */
    mood: string;
    /**
     * v11.1.0 Upgrade 5: FNV-1a hash of the original categoryMap content.
     * Builder computes its own hash via `hashCategoryMap()` and compares.
     * Match → "Matches original" badge. Diverges → "Modified from original".
     */
    categoryMapHash?: string;
  };
}

// ── Community Pulse ─────────────────────────────────────────────────────────

/** Weather snapshot stored with each pulse entry (same shape as PotM weather) */
export interface PulseWeatherData {
  description: string;
  emoji: string;
  tempC: number | null;
  tempF: number | null;
  windKmh: number | null;
  windDegrees: number | null;
  windGustKmh: number | null;
  humidity: number | null;
  visibility: number | null;
  sunriseUtc: number | null;
  sunsetUtc: number | null;
  isDayTime: boolean | null;
  timezoneOffset: number | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string;
}

/** A single entry in the Community Pulse feed */
export interface CommunityPulseEntry {
  /** Unique entry ID */
  id: string;
  /** Prompt score (0–100) */
  score: number;
  /** Provider display name (city name for weather-seeded, provider name for user) */
  platform: string;
  /** Provider ID (for icon lookup) */
  platformId: string;
  /** Short prompt summary (max 60 chars) */
  description: string;
  /** Which tier the prompt was built for */
  tier: 'tier1' | 'tier2' | 'tier3' | 'tier4';
  /** Total likes on this entry */
  likeCount: number;
  /** ISO timestamp */
  createdAt: string;
  /** ISO 3166-1 alpha-2 country code */
  countryCode: string;
  /** Entry source: 'weather' (auto-seeded) or 'user' (user-created) */
  source: string;
  /** Venue name (weather-seeded entries only) */
  venue: string;
  /** Weather conditions (weather-seeded entries only) */
  conditions: string;
  /** WeatherCategoryMap from weather intelligence — run One Brain pipeline client-side */
  categoryMap: WeatherCategoryMap | null;
  /** Weather snapshot for emoji tooltip (same data as PotM weather object) */
  weather: PulseWeatherData | null;
  /** Full prompt text for tooltip display */
  promptText: string;
}

/** Response from /api/homepage/community-pulse */
export interface CommunityPulseResponse {
  /** Most recent 20 entries */
  entries: CommunityPulseEntry[];
  /** Single most-liked entry from last 24 hours (null if no likes yet) */
  mostLikedToday: CommunityPulseEntry | null;
}

// ── Like System ─────────────────────────────────────────────────────────────

/** Request body for POST /api/prompts/like */
export interface LikeRequest {
  promptId: string;
}

/** Response from POST /api/prompts/like */
export interface LikeResponse {
  success: boolean;
  /** Updated total like count */
  likeCount: number;
  /** True if this session had already liked this prompt */
  alreadyLiked: boolean;
}

/** Response from GET /api/prompts/like/status */
export interface LikeStatusResponse {
  /** Map of promptId → whether current session has liked it */
  liked: Record<string, boolean>;
}

// ── Online Users ────────────────────────────────────────────────────────────

/** A country entry in the online users display */
export interface OnlineCountryEntry {
  /** ISO 3166-1 alpha-2 country code (e.g., "GB") */
  countryCode: string;
  /** Number of concurrent users from this country */
  count: number;
}

/** Response from GET /api/online-users */
export interface OnlineUsersResponse {
  /** Total concurrent users across all countries */
  total: number;
  /** Per-country breakdown, sorted by count descending */
  countries: OnlineCountryEntry[];
}

// ── Scene Starters Preview ──────────────────────────────────────────────────

/**
 * Minimal scene data needed for the homepage preview cards.
 * Full scene data lives in scene-starters.json SSOT and types/scene-starters.ts.
 */
export interface ScenePreviewCard {
  /** Scene ID from SSOT */
  id: string;
  /** Display emoji */
  emoji: string;
  /** Scene name */
  name: string;
  /** World name (e.g., "Portraits & People") */
  world: string;
  /** Number of prefilled categories */
  categoryCount: number;
  /** Tier affinity (for badge display) */
  tier: 'tier1' | 'tier2' | 'tier3' | 'tier4';
  /** Whether this scene requires Pro Promagen */
  isPro: boolean;
}
