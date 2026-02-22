// src/lib/weather/wind-system.ts
// ============================================================================
// BEAUFORT-CALIBRATED WIND SYSTEM (v8.0.0)
// ============================================================================
//
// v9.0.0 (20 Feb 2026):
// - Extracted from weather-prompt-generator.ts (4,311-line monolith)
// - Contains: Beaufort classification, venue-specific wind phrase pools,
//   wind direction, gust handling, wind phrase generation
//
// Existing features preserved: Yes
// ============================================================================

import { pickRandom } from './prng';
import type {
  VenueSetting,
  WindForce,
  ActiveWindForce,
  WeatherContext,
  PrecipState,
} from './prompt-types';

// Re-export types consumers need
export type { WindForce, ActiveWindForce };

export const VENUE_WIND: Record<VenueSetting, Record<ActiveWindForce, string[]>> = {
  waterfront: {
    breeze: [
      'ripples crossing harbour water',
      'moored boats shifting gently at berths',
      'harbour flags lifting from poles',
    ],
    fresh: [
      'small waves forming across the harbour',
      'spray misting lightly over bows',
      'flags extending taut from poles',
    ],
    strong: [
      'whitecaps forming across the harbour',
      'spray lifting off wave crests',
      'moored boats straining at lines',
    ],
    nearGale: [
      'harbour whitecaps and blown spray',
      'waves slapping hard against quayside',
      'rigging cables humming taut',
    ],
    gale: [
      'waves crashing against quayside walls',
      'spray filling the air horizontally',
      'boats slamming against moorings',
    ],
    strongGale: [
      'heavy seas breaking over harbour walls',
      'harbour awash with horizontal spray',
      'smaller vessels heeling dangerously',
    ],
    storm: [
      'waves overtopping harbour walls entirely',
      'massive spray sheets across the quay',
      'harbour infrastructure visibly straining',
    ],
  },
  beach: {
    breeze: [
      'fine sand drifting at ankle height',
      'shallow surf ruffled onshore',
      'beach grass swaying gently',
    ],
    fresh: [
      'sand streaming in low ribbons',
      'surf choppy and breaking unevenly',
      'dune grass bending sideways',
    ],
    strong: [
      'sand stinging at ankle height',
      'rough surf pounding the shore',
      'vegetation flattened sideways',
    ],
    nearGale: [
      'sand streaming at waist height',
      'heavy surf breaking far up the beach',
      'everything bent hard shoreward',
    ],
    gale: [
      'sand airborne in thick clouds',
      'violent surf crashing far inland',
      'beach scoured down to wet sand',
    ],
    strongGale: [
      'sand blasting horizontal across the shore',
      'enormous surf breaking over dunes',
      'coastal debris tumbling inland',
    ],
    storm: [
      'total sand whiteout conditions',
      'surf reaching well beyond the dunes',
      'beach landscape completely reshaped',
    ],
  },
  street: {
    breeze: [
      'awnings swaying gently overhead',
      'litter drifting along gutters',
      'shop banners shifting slowly',
    ],
    fresh: [
      'awnings flapping hard overhead',
      'signage rattling on brackets',
      'loose paper channelling fast between buildings',
    ],
    strong: [
      'awnings straining at fixings',
      'signs swinging hard on posts',
      'debris skittering down the pavement',
    ],
    nearGale: [
      'awnings pulled taut and vibrating',
      'larger signs bending on mountings',
      'bins rolling down the street',
    ],
    gale: [
      'awnings ripping from brackets',
      'signs bent sideways on posts',
      'loose objects tumbling down the road',
    ],
    strongGale: [
      'canopy structures tearing free',
      'signage damaged and hanging loose',
      'lightweight street furniture shifting',
    ],
    storm: [
      'structural debris airborne in the street',
      'signage destroyed and scattered',
      'nothing unsecured remaining upright',
    ],
  },
  narrow: {
    breeze: [
      'noren curtains swaying in doorways',
      'hanging lanterns rotating slowly',
      'alley air funnelling gently',
    ],
    fresh: [
      'noren curtains flapping horizontal',
      'hanging signs clattering on walls',
      'funnelled air pushing through the passage',
    ],
    strong: [
      'noren curtains pinned horizontal',
      'lanterns swinging hard overhead',
      'funnelled gusts whistling through the alley',
    ],
    nearGale: [
      'fabric pinned flat against walls',
      'hanging objects swinging hard',
      'wind howling through the narrow passage',
    ],
    gale: [
      'lightweight objects torn from hooks',
      'alley acting as a violent wind tunnel',
      'debris channelling fast through the gap',
    ],
    strongGale: [
      'everything loose stripped from walls',
      'alley funnelling violent sustained gusts',
      'shutters rattling and straining on hinges',
    ],
    storm: [
      'alley completely scoured by wind',
      'debris blasting through the passage',
      'nothing hanging or mounted remaining',
    ],
  },
  market: {
    breeze: [
      'stall canopies rippling gently',
      'hanging fabric swaying overhead',
      'produce displays shifting slightly',
    ],
    fresh: [
      'stall canopies flapping hard',
      'hanging banners snapping taut',
      'lightweight goods sliding off tables',
    ],
    strong: [
      'canopy frames straining and bending',
      'fabric covers lifting at edges',
      'stall goods scattering across aisles',
    ],
    nearGale: [
      'canopies pulled taut and vibrating',
      'heavier goods sliding on tables',
      'vendors securing remaining stock',
    ],
    gale: [
      'canopy frames bending dangerously',
      'fabric covers tearing loose',
      'goods tumbling from overturned tables',
    ],
    strongGale: [
      'stall canopies ripping free entirely',
      'market goods airborne across the aisles',
      'entire stall frames buckling',
    ],
    storm: [
      'entire market stalls collapsing',
      'everything airborne and scattered',
      'market infrastructure destroyed',
    ],
  },
  plaza: {
    breeze: [
      'dust skittering across flagstones',
      'flags on poles shifting gently',
      'fountain spray drifting sideways',
    ],
    fresh: [
      'flags snapping taut on poles',
      'loose leaves spiralling across stone',
      'fountain spray blown sideways',
    ],
    strong: [
      'flags rigid horizontal on poles',
      'grit sweeping across open stone',
      'fountain spray completely dispersed',
    ],
    nearGale: [
      'flag fabric straining at fastenings',
      'loose objects rolling across the plaza',
      'fountain blown apart into mist',
    ],
    gale: [
      'flag fabric shredding on poles',
      'open plaza scoured by flying grit',
      'temporary structures leaning dangerously',
    ],
    strongGale: [
      'flagpoles bending under sustained force',
      'nothing unsecured remaining in the open',
      'plaza completely scoured clean',
    ],
    storm: [
      'structural elements straining visibly',
      'plaza cleared of all loose material',
      'flagpoles damaged and bent horizontal',
    ],
  },
  park: {
    breeze: [
      'leaves drifting from branches',
      'long grass gently leaning windward',
      'branches swaying gently overhead',
    ],
    fresh: [
      'trees swaying noticeably',
      'leaves scattering across paths',
      'shrubs flattened sideways',
    ],
    strong: [
      'trees leaning noticeably windward',
      'branches creaking overhead',
      'leaves stripped from lower canopy',
    ],
    nearGale: [
      'whole trees swaying heavily',
      'large branches thrashing',
      'leaf litter spiralling in vortices',
    ],
    gale: ['large branches snapping off', 'trees bent hard windward', 'canopy being stripped bare'],
    strongGale: [
      'major limbs breaking with cracks',
      'trees leaning dangerously windward',
      'everything stripped bare overhead',
    ],
    storm: [
      'trees uprooted and toppling',
      'canopy completely destroyed',
      'park landscape totally transformed',
    ],
  },
  elevated: {
    breeze: [
      'exposed shrubs leaning gently',
      'treetops swaying below viewpoint',
      'summit flags shifting on poles',
    ],
    fresh: [
      'treetops thrashing below viewpoint',
      'exposed vegetation bending sideways',
      'summit flags snapping taut',
    ],
    strong: [
      'treetops thrashing below viewpoint',
      'exposed vegetation pressed flat',
      'exposed surfaces swept clean by wind',
    ],
    nearGale: [
      'everything flattened on exposed summit',
      'vegetation pinned flat to the ground',
      'sustained roar across the ridgeline',
    ],
    gale: [
      'summit completely scoured by wind',
      'vegetation stripped from exposed rock',
      'exposed structures visibly straining',
    ],
    strongGale: [
      'nothing upright on the exposed ridge',
      'structural elements vibrating audibly',
      'sustained howl across bare summit',
    ],
    storm: [
      'extreme exposure conditions at summit',
      'everything flattened or stripped away',
      'ridgeline completely impassable',
    ],
  },
  monument: {
    breeze: [
      'entrance flags shifting gently',
      'courtyard dust drifting in eddies',
      'prayer flags swaying on lines',
    ],
    fresh: [
      'entrance flags flapping hard',
      'courtyard grit spiralling upward',
      'loose offering items sliding across stone',
    ],
    strong: [
      'flags rigid and snapping loudly',
      'courtyard swept clean by blowing grit',
      'temporary structures straining at anchors',
    ],
    nearGale: [
      'flags straining hard at poles',
      'courtyard blasted clean of debris',
      'lightweight barriers shifting position',
    ],
    gale: [
      'flags shredding at their poles',
      'everything loose airborne across grounds',
      'temporary structures leaning dangerously',
    ],
    strongGale: [
      'flagpoles bending under the force',
      'monument grounds completely scoured',
      'barriers toppling across courtyards',
    ],
    storm: [
      'structural elements of grounds straining',
      'grounds completely cleared by wind',
      'monument stonework sandblasted by debris',
    ],
  },
};

export function classifyWind(speed: number): WindForce {
  if (speed < 6) return 'calm';
  if (speed < 20) return 'breeze';
  if (speed < 30) return 'fresh';
  if (speed < 50) return 'strong';
  if (speed < 62) return 'nearGale';
  if (speed < 75) return 'gale';
  if (speed < 89) return 'strongGale';
  return 'storm';
}

/** Convert wind degrees (0–360) to cardinal direction word. */
export function getCardinalDirection(degrees: number): string {
  const dirs = [
    'northerly',
    'north-easterly',
    'easterly',
    'south-easterly',
    'southerly',
    'south-westerly',
    'westerly',
    'north-westerly',
  ];
  return dirs[Math.round(degrees / 45) % 8]!;
}

/** Wind noun by Beaufort force — what the whole clause labels itself. */
export function getWindNoun(force: WindForce): string {
  switch (force) {
    case 'calm':
      return 'air';
    case 'breeze':
      return 'breeze';
    case 'fresh':
      return 'breeze';
    case 'strong':
      return 'wind';
    case 'nearGale':
      return 'high wind';
    case 'gale':
      return 'gale';
    case 'strongGale':
      return 'severe gale';
    case 'storm':
      return 'storm';
  }
}

/**
 * v8.0.0: Beaufort-calibrated wind phrase.
 *
 * Output format (single clause, no stacking):
 *   Below 6:   "still air"
 *   6–19:      "{direction} {speed} km/h breeze, {interaction}"
 *   20–29:     "{direction} {speed} km/h breeze, {interaction}"
 *   30–49:     "{direction} {speed} km/h wind, {interaction}"
 *   50–61:     "{direction} {speed} km/h high wind, {interaction}"
 *   62–74:     "{direction} {speed} km/h gale, {interaction}"
 *   75–88:     "{direction} {speed} km/h severe gale, {interaction}"
 *   89+:       "{direction} {speed} km/h storm, {interaction}"
 *
 * New in v8.0.0:
 * - Direction prefix when windDegrees available (e.g. "south-westerly 35 km/h wind")
 * - Gust suffix when gust > sustained * 1.5 (e.g. "gusting to 52 km/h")
 * - Snow+wind interaction: blowing/drifting snow replaces venue interaction
 *   when PrecipState indicates active snow and wind is fresh+
 *
 * The speed number does the intensity work. The noun (breeze/wind/gale/storm)
 * sets the register. The interaction shows what the camera sees.
 */
export function getWindPhrase(
  ctx: WeatherContext,
  seed: number,
  venueSetting?: VenueSetting,
  precip?: PrecipState,
): string {
  const speed = Math.round(ctx.windKmh);

  // Below 6 km/h — Beaufort 0–1, invisible in a still photo
  if (speed < 6) return 'still air';

  const force = classifyWind(speed);
  const noun = getWindNoun(force);
  const setting = venueSetting ?? 'street';

  // Direction prefix — only when OWM provides wind.deg
  const dirPrefix =
    typeof ctx.windDegrees === 'number' ? `${getCardinalDirection(ctx.windDegrees)} ` : '';

  // Gust suffix — only when gust exceeds sustained speed by 50%+
  let gustSuffix = '';
  if (typeof ctx.windGustKmh === 'number' && ctx.windGustKmh > speed * 1.5) {
    gustSuffix = ` gusting to ${Math.round(ctx.windGustKmh)} km/h`;
  }

  // Snow+wind interaction: blowing/drifting snow overrides venue interaction
  // when active snow/sleet and wind is fresh (20+) or above
  if (
    precip &&
    precip.active &&
    (precip.type === 'snow' || precip.type === 'sleet') &&
    speed >= 20
  ) {
    const snowInteraction =
      speed >= 50
        ? 'snow streaming horizontal across the scene'
        : speed >= 30
          ? 'blowing snow reducing visibility'
          : 'snow drifting across surfaces';
    return `${dirPrefix}${speed} km/h ${noun}${gustSuffix}, ${snowInteraction}`;
  }

  // v9.8.0: Wet-precip interaction: rain/drizzle drive spray and splatter,
  // not dry-material interaction. When wet precip is active, filter out
  // dust/grit phrases (wet grit clumps, it doesn't spiral) and substitute
  // with precipitation-wind interaction.
  //
  // Snow at < 20 km/h also routes here (the snow override above only fires
  // at >= 20 km/h for blowing/drifting snow, but even light snow at low wind
  // makes airborne dust/grit physically impossible).
  if (
    precip &&
    precip.active &&
    // Rain, drizzle, mist — always override
    (precip.type === 'rain' || precip.type === 'drizzle' || precip.type === 'mist' ||
    // Snow/sleet at < 20 km/h (above 20 is handled by the snow block above)
    ((precip.type === 'snow' || precip.type === 'sleet') && speed < 20))
  ) {
    let wetInteraction: string;
    if (precip.type === 'snow' || precip.type === 'sleet') {
      // Light snow with gentle wind — settling/falling, not blowing
      wetInteraction = speed >= 10
        ? 'light snow angled by the breeze'
        : 'snow falling gently through still air';
    } else {
      // Rain/drizzle/mist
      wetInteraction =
        speed >= 50
          ? 'rain driving horizontal across the scene'
          : speed >= 30
            ? 'rain gusting sideways, spray lifting off surfaces'
            : speed >= 20
              ? 'rain angled by the breeze, puddles rippling'
              : 'rain drifting on the breeze';
    }
    return `${dirPrefix}${speed} km/h ${noun}${gustSuffix}, ${wetInteraction}`;
  }

  // Standard venue interaction
  const pool = force !== 'calm' ? VENUE_WIND[setting]?.[force as ActiveWindForce] : undefined;
  const interaction = pool?.length ? pickRandom(pool, seed * 2.3) : '';

  const core = `${dirPrefix}${speed} km/h ${noun}${gustSuffix}`;
  return interaction ? `${core}, ${interaction}` : core;
}
