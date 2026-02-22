// src/lib/weather/cloud-types.ts
// ============================================================================
// CLOUD TYPE CLASSIFIER — OWM data → Visual Cloud Type (v9.5.0 Chat 6)
// ============================================================================
//
// PROBLEM:  OWM provides cloud COVERAGE (few/scattered/broken/overcast) but
//           prompts just say "broken clouds" — generic and visually flat.
//           Real clouds have TYPE: cumulus (puffy white towers), stratus
//           (flat grey blankets), cirrus (wispy ice trails), cumulonimbus
//           (towering thunderheads). Each produces distinct light/shadow.
//
// SOLUTION: Infer cloud TYPE from OWM weather.id + description + coverage %.
//           Return visual cloud phrases for tier generators.
//
// OWM weather.id reference (https://openweathermap.org/weather-conditions):
//   800     = Clear sky
//   801     = Few clouds (11-25%) → fair-weather cumulus
//   802     = Scattered (25-50%) → cumulus / stratocumulus
//   803     = Broken (51-84%)    → stratocumulus / altostratus
//   804     = Overcast (85-100%) → stratus / nimbostratus
//   2xx     = Thunderstorm       → cumulonimbus
//   3xx     = Drizzle            → nimbostratus / stratus
//   5xx     = Rain               → nimbostratus (heavy → cumulonimbus)
//   6xx     = Snow               → nimbostratus / stratus
//   7xx     = Atmosphere (fog/mist/haze)
//
// Existing features preserved: Yes (new file, no existing code changed)
// ============================================================================

import { pickRandom } from './prng';

/**
 * Visual cloud type classification.
 * Each type has distinct visual character in photographs.
 */
export type CloudType =
  | 'clear'          // No clouds — open sky
  | 'cirrus'         // High thin wispy ice clouds — delicate streaks
  | 'cirrostratus'   // High thin uniform sheet — halo around sun/moon
  | 'altocumulus'    // Mid-level puffy patches — "mackerel sky"
  | 'altostratus'    // Mid-level uniform grey — sun visible as bright spot
  | 'cumulus'        // Low-mid puffy white towers — fair weather
  | 'stratocumulus'  // Low layered + lumpy — most common worldwide
  | 'stratus'        // Low flat uniform grey — featureless blanket
  | 'nimbostratus'   // Thick dark rain-bearing — grey wall
  | 'cumulonimbus';  // Towering thunderheads — anvil tops, dramatic

export interface CloudClassification {
  /** Classified cloud type */
  type: CloudType;
  /** Visual descriptor phrase for use in prompts */
  phrase: string;
}

// ============================================================================
// VISUAL PHRASE POOLS — 4 phrases per cloud type, seeded selection
// ============================================================================

const CLOUD_PHRASES: Record<CloudType, readonly string[]> = {
  clear: [
    'under an unbroken blue sky',
    'beneath a cloudless expanse',
    'under pristine open sky',
    'beneath a vast clear dome',
  ],
  cirrus: [
    'thin cirrus streaks high above',
    'wispy ice-crystal trails across the sky',
    'delicate high cirrus brushstrokes',
    'feathery cirrus wisps at altitude',
  ],
  cirrostratus: [
    'a thin veil of high cloud diffusing the light',
    'translucent high sheet casting a solar halo',
    'milky cirrostratus film across the sky',
    'high ice-cloud sheet softening the sun',
  ],
  altocumulus: [
    'mid-level cloud patches in a mackerel pattern',
    'rows of altocumulus in a rippled sky',
    'dappled mid-altitude cloud field',
    'textured altocumulus tessellations above',
  ],
  altostratus: [
    'uniform mid-level grey cloud sheet',
    'altostratus layer with the sun a pale disc behind it',
    'featureless mid-altitude cloud blanket',
    'grey altostratus dimming the daylight',
  ],
  cumulus: [
    'fair-weather cumulus dotting the sky',
    'bright white cumulus towers with flat bases',
    'billowing cumulus clouds drifting lazily',
    'puffy cotton-white cumulus formations',
  ],
  stratocumulus: [
    'lumpy stratocumulus layer with light breaks',
    'low rolling stratocumulus blanket',
    'textured grey-white stratocumulus field',
    'patchy stratocumulus with occasional sun breaks',
  ],
  stratus: [
    'flat uniform stratus ceiling',
    'featureless grey stratus blanket overhead',
    'low grey stratus sheet diffusing all shadows',
    'unbroken stratus layer creating even grey light',
  ],
  nimbostratus: [
    'thick dark nimbostratus rain layer',
    'heavy grey nimbostratus obliterating the sky',
    'dense dark cloud mass bearing precipitation',
    'oppressive nimbostratus wall overhead',
  ],
  cumulonimbus: [
    'towering cumulonimbus thunderheads',
    'dramatic cumulonimbus anvil clouds dominating the sky',
    'massive convective cloud towers with dark bases',
    'cumulonimbus pillars rising through the atmosphere',
  ],
} as const;

// ============================================================================
// CLASSIFICATION ENGINE
// ============================================================================

/**
 * Classify cloud type from OWM data.
 *
 * Uses weatherId (most precise) when available, falls back to description
 * parsing + cloud cover inference. Both paths produce the same results for
 * standard OWM responses — weatherId avoids string matching.
 *
 * @param description   OWM weather description (e.g., "broken clouds", "light rain")
 * @param conditions    OWM weather condition label (e.g., "Clouds", "Rain")
 * @param cloudCover    Cloud cover percentage (0-100). null → infer from description.
 * @param weatherId     OWM weather.id numeric code. null → infer from description.
 * @param tempC         Temperature — used for cirrus inference (cold → high clouds).
 * @param precipActive  Whether precipitation is currently falling.
 */
export function classifyCloudType(
  description: string,
  conditions: string,
  cloudCover: number | null,
  weatherId: number | null,
  tempC: number,
  precipActive: boolean,
): CloudType {
  const desc = description.toLowerCase().trim();
  const cloud = cloudCover ?? 0;

  // ── Path 1: weatherId (precise OWM code) ─────────────────────
  if (weatherId !== null) {
    // Thunderstorm group → cumulonimbus
    if (weatherId >= 200 && weatherId < 300) return 'cumulonimbus';
    // Drizzle → nimbostratus (low thick drizzle-bearing cloud)
    if (weatherId >= 300 && weatherId < 400) return 'nimbostratus';
    // Rain group
    if (weatherId >= 500 && weatherId < 600) {
      // Heavy rain (502, 503, 504) or freezing rain → cumulonimbus
      if (weatherId >= 502) return 'cumulonimbus';
      return 'nimbostratus';
    }
    // Snow group → nimbostratus
    if (weatherId >= 600 && weatherId < 700) return 'nimbostratus';
    // Atmosphere group (fog/mist/haze) → stratus (low visibility layer)
    if (weatherId >= 700 && weatherId < 800) return 'stratus';
    // Clear
    if (weatherId === 800) return 'clear';
    // Cloud types by coverage
    if (weatherId === 801) return 'cumulus';        // few clouds → fair weather
    if (weatherId === 802) return 'stratocumulus';  // scattered
    if (weatherId === 803) return 'stratocumulus';  // broken
    if (weatherId === 804) return 'stratus';        // overcast
  }

  // ── Path 2: Description inference (always available) ─────────
  // Thunderstorm → cumulonimbus
  if (desc.includes('thunder') || desc.includes('storm')) return 'cumulonimbus';

  // Heavy rain → cumulonimbus (convective)
  if (desc.includes('heavy') && desc.includes('rain')) return 'cumulonimbus';

  // Any other precipitation → nimbostratus
  if (precipActive) return 'nimbostratus';

  // Drizzle/rain without active precip flag → nimbostratus
  if (desc.includes('drizzle') || desc.includes('rain')) return 'nimbostratus';

  // Snow → nimbostratus
  if (desc.includes('snow') || desc.includes('sleet')) return 'nimbostratus';

  // Fog/mist/haze → stratus
  if (desc.includes('fog') || desc.includes('mist') || desc.includes('haze')) return 'stratus';
  if (desc.includes('smoke') || desc.includes('dust')) return 'stratus';

  // Cloud descriptions from OWM
  if (desc === 'clear sky' || desc === 'clear' || desc === 'sunny') return 'clear';
  if (desc === 'few clouds') return 'cumulus';
  if (desc === 'scattered clouds') return cloud > 35 ? 'stratocumulus' : 'cumulus';
  if (desc === 'broken clouds') return 'stratocumulus';
  if (desc === 'overcast clouds' || desc === 'overcast') return 'stratus';

  // ── Path 3: Cloud cover % inference ──────────────────────────
  if (cloud <= 5) return 'clear';
  if (cloud <= 25) {
    // Few clouds — cirrus more likely in cold air (high altitude)
    return tempC < 5 ? 'cirrus' : 'cumulus';
  }
  if (cloud <= 50) return 'stratocumulus';
  if (cloud <= 75) return 'stratocumulus';
  if (cloud <= 90) return 'altostratus';
  return 'stratus';
}

/**
 * Get a visual cloud type phrase for use in prompts.
 *
 * @param cloudType  Classified cloud type.
 * @param seed       Deterministic seed for phrase rotation.
 */
export function getCloudTypePhrase(cloudType: CloudType, seed: number): string {
  return pickRandom(CLOUD_PHRASES[cloudType], seed * 2.7);
}
