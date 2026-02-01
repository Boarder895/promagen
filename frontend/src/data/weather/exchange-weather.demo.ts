// src/data/weather/exchange-weather.demo.ts
// ============================================================================
// DEMO EXCHANGE WEATHER — Fallback for all 89 catalog exchanges (v2.0.0)
// ============================================================================
// Every exchange in exchanges.catalog.json has a demo weather entry here.
// Pro Promagen shows this immediately; live gateway weather overlays on top.
//
// UPDATED v2.0.0 (01 Feb 2026):
// - Extended from 12 to 89 entries (full catalog coverage).
// - Reason: Pro users can select any exchange. Without demo data, cards for
//   exchanges outside the gateway's current batch show empty weather.
// - Temps are plausible February climate approximations — they're replaced
//   by live data within minutes of gateway refresh.
// - Original 12 entries preserved exactly (same values).
//
// Existing features preserved: Yes
// ============================================================================

export type ExchangeWeatherCondition = 'sunny' | 'cloudy' | 'rain' | 'storm' | 'snow' | 'windy';

export type ExchangeWeather = {
  /**
   * Exchange id, matching exchanges.catalog.json (e.g. "lse-london").
   */
  exchange: string;
  /**
   * Demo temperature in °C shown on the card.
   */
  tempC: number;
  /**
   * Optional "feels like" temperature in °C. If omitted the UI should fall
   * back to tempC without crashing.
   */
  feelsLikeC?: number;
  /**
   * Short text label describing the condition.
   */
  condition: ExchangeWeatherCondition;
  /**
   * Default emoji mapped from the condition.
   */
  emoji: string;
  /**
   * Optional override for the emoji. If present, this wins over the default
   * mapping. Used to prove override behaviour in tests.
   */
  iconOverride?: string;
};

export const DEMO_EXCHANGE_WEATHER: ExchangeWeather[] = [
  // ==========================================================================
  // ASIA–PACIFIC
  // ==========================================================================

  // New Zealand / Australia
  {
    exchange: 'nzx-wellington',
    tempC: 14,
    // feelsLikeC intentionally omitted to prove "no crash" behaviour.
    condition: 'windy',
    emoji: '🌬️',
  },
  {
    exchange: 'xnze-auckland',
    tempC: 20,
    feelsLikeC: 21,
    condition: 'sunny',
    emoji: '☀️',
  },
  {
    exchange: 'asx-sydney',
    tempC: 22,
    feelsLikeC: 23,
    condition: 'sunny',
    emoji: '☀️',
  },

  // Japan
  {
    exchange: 'tse-tokyo',
    tempC: 18,
    feelsLikeC: 17,
    condition: 'cloudy',
    emoji: '⛅',
  },
  {
    exchange: 'xsap-sapporo',
    tempC: -2,
    feelsLikeC: -5,
    condition: 'snow',
    emoji: '❄️',
  },
  {
    exchange: 'xngo-nagoya',
    tempC: 6,
    feelsLikeC: 4,
    condition: 'cloudy',
    emoji: '⛅',
  },
  {
    exchange: 'xfka-fukuoka',
    tempC: 8,
    feelsLikeC: 6,
    condition: 'cloudy',
    emoji: '⛅',
  },

  // China
  {
    exchange: 'sse-shanghai',
    tempC: 5,
    feelsLikeC: 3,
    condition: 'cloudy',
    emoji: '⛅',
  },
  {
    exchange: 'szse-shenzhen',
    tempC: 16,
    feelsLikeC: 17,
    condition: 'cloudy',
    emoji: '⛅',
  },

  // East & South-East Asia
  {
    exchange: 'hkex-hong-kong',
    tempC: 27,
    feelsLikeC: 29,
    condition: 'rain',
    emoji: '🌧',
  },
  {
    exchange: 'twse-taipei',
    tempC: 16,
    feelsLikeC: 15,
    condition: 'rain',
    emoji: '🌧',
  },
  {
    exchange: 'set-bangkok',
    tempC: 30,
    feelsLikeC: 33,
    condition: 'storm',
    emoji: '⛈',
  },
  {
    exchange: 'pse-manila',
    tempC: 28,
    feelsLikeC: 30,
    condition: 'sunny',
    emoji: '☀️',
  },
  {
    exchange: 'idx-jakarta',
    tempC: 29,
    feelsLikeC: 31,
    condition: 'storm',
    emoji: '⛈',
  },
  {
    exchange: 'bursa-kuala-lumpur',
    tempC: 30,
    feelsLikeC: 32,
    condition: 'rain',
    emoji: '🌧',
  },
  {
    exchange: 'xstc-ho-chi-minh-city',
    tempC: 30,
    feelsLikeC: 32,
    condition: 'sunny',
    emoji: '☀️',
  },
  {
    exchange: 'lsx-vientiane',
    tempC: 24,
    feelsLikeC: 25,
    condition: 'sunny',
    emoji: '☀️',
  },
  {
    exchange: 'cse-colombo',
    tempC: 28,
    feelsLikeC: 30,
    condition: 'sunny',
    emoji: '☀️',
  },

  // South Asia
  {
    exchange: 'nse-mumbai',
    tempC: 32,
    feelsLikeC: 35,
    condition: 'sunny',
    emoji: '☀️',
  },
  {
    exchange: 'bse-mumbai',
    tempC: 28,
    feelsLikeC: 30,
    condition: 'sunny',
    emoji: '☀️',
  },
  {
    exchange: 'xbom-mumbai',
    tempC: 28,
    feelsLikeC: 30,
    condition: 'sunny',
    emoji: '☀️',
  },
  {
    exchange: 'xnse-mumbai',
    tempC: 28,
    feelsLikeC: 30,
    condition: 'sunny',
    emoji: '☀️',
  },
  {
    exchange: 'psx-karachi',
    tempC: 20,
    feelsLikeC: 21,
    condition: 'sunny',
    emoji: '☀️',
  },
  {
    exchange: 'dse-dhaka',
    tempC: 20,
    feelsLikeC: 21,
    condition: 'sunny',
    emoji: '☀️',
  },

  // Central Asia / Mongolia
  {
    exchange: 'mse-ulaanbaatar',
    tempC: -18,
    feelsLikeC: -24,
    condition: 'snow',
    emoji: '❄️',
  },
  {
    exchange: 'kase-almaty',
    tempC: -4,
    feelsLikeC: -8,
    condition: 'snow',
    emoji: '❄️',
  },

  // ==========================================================================
  // MIDDLE EAST
  // ==========================================================================
  {
    exchange: 'dfm-dubai',
    tempC: 35,
    feelsLikeC: 39,
    condition: 'sunny',
    emoji: '☀️',
    // Explicit override – test should prove this wins.
    iconOverride: '🔥',
  },
  {
    exchange: 'adx-abu-dhabi',
    tempC: 22,
    feelsLikeC: 23,
    condition: 'sunny',
    emoji: '☀️',
  },
  {
    exchange: 'kse-kuwait',
    tempC: 16,
    feelsLikeC: 15,
    condition: 'sunny',
    emoji: '☀️',
  },
  {
    exchange: 'qse-doha',
    tempC: 19,
    feelsLikeC: 20,
    condition: 'sunny',
    emoji: '☀️',
  },
  {
    exchange: 'xbah-manama',
    tempC: 18,
    feelsLikeC: 19,
    condition: 'sunny',
    emoji: '☀️',
  },
  {
    exchange: 'msm-muscat',
    tempC: 22,
    feelsLikeC: 23,
    condition: 'sunny',
    emoji: '☀️',
  },
  {
    exchange: 'ase-amman',
    tempC: 9,
    feelsLikeC: 7,
    condition: 'cloudy',
    emoji: '⛅',
  },
  {
    exchange: 'bse-beirut',
    tempC: 13,
    feelsLikeC: 12,
    condition: 'rain',
    emoji: '🌧',
  },
  {
    exchange: 'egx-cairo',
    tempC: 16,
    feelsLikeC: 15,
    condition: 'sunny',
    emoji: '☀️',
  },

  // ==========================================================================
  // EUROPE — Northern
  // ==========================================================================
  {
    exchange: 'xice-reykjavik',
    tempC: -1,
    feelsLikeC: -5,
    condition: 'snow',
    emoji: '❄️',
  },
  {
    exchange: 'nasdaq-helsinki',
    tempC: -5,
    feelsLikeC: -9,
    condition: 'snow',
    emoji: '❄️',
  },
  {
    exchange: 'xosl-oslo',
    tempC: -3,
    feelsLikeC: -7,
    condition: 'snow',
    emoji: '❄️',
  },
  {
    exchange: 'xris-riga',
    tempC: -4,
    feelsLikeC: -8,
    condition: 'snow',
    emoji: '❄️',
  },
  {
    exchange: 'nasdaq-copenhagen',
    tempC: 1,
    feelsLikeC: -2,
    condition: 'cloudy',
    emoji: '⛅',
  },

  // Europe — Western
  {
    exchange: 'ise-dublin',
    tempC: 7,
    feelsLikeC: 5,
    condition: 'rain',
    emoji: '🌧',
  },
  {
    exchange: 'lse-london',
    tempC: 9,
    feelsLikeC: 7,
    condition: 'cloudy',
    emoji: '⛅',
  },
  {
    exchange: 'euronext-amsterdam',
    tempC: 4,
    feelsLikeC: 2,
    condition: 'cloudy',
    emoji: '⛅',
  },
  {
    exchange: 'euronext-brussels',
    tempC: 4,
    feelsLikeC: 2,
    condition: 'cloudy',
    emoji: '⛅',
  },
  {
    exchange: 'euronext-paris',
    tempC: 6,
    feelsLikeC: 4,
    condition: 'cloudy',
    emoji: '⛅',
  },
  {
    exchange: 'euronext-lisbon',
    tempC: 12,
    feelsLikeC: 11,
    condition: 'sunny',
    emoji: '☀️',
  },
  {
    exchange: 'luxse-luxembourg',
    tempC: 3,
    feelsLikeC: 1,
    condition: 'cloudy',
    emoji: '⛅',
  },

  // Europe — Central
  {
    exchange: 'xetra-frankfurt',
    tempC: 3,
    feelsLikeC: 1,
    condition: 'cloudy',
    emoji: '⛅',
  },
  {
    exchange: 'xfra-frankfurt',
    tempC: 3,
    feelsLikeC: 1,
    condition: 'cloudy',
    emoji: '⛅',
  },
  {
    exchange: 'xstu-stuttgart',
    tempC: 3,
    feelsLikeC: 1,
    condition: 'cloudy',
    emoji: '⛅',
  },
  {
    exchange: 'six-zurich',
    tempC: 3,
    feelsLikeC: 1,
    condition: 'cloudy',
    emoji: '⛅',
  },
  {
    exchange: 'xswx-zurich',
    tempC: 3,
    feelsLikeC: 1,
    condition: 'cloudy',
    emoji: '⛅',
  },
  {
    exchange: 'wbag-vienna',
    tempC: 2,
    feelsLikeC: 0,
    condition: 'cloudy',
    emoji: '⛅',
  },
  {
    exchange: 'pse-prague',
    tempC: 1,
    feelsLikeC: -1,
    condition: 'cloudy',
    emoji: '⛅',
  },
  {
    exchange: 'bcpb-bratislava',
    tempC: 1,
    feelsLikeC: -1,
    condition: 'cloudy',
    emoji: '⛅',
  },
  {
    exchange: 'budapest-bet',
    tempC: 2,
    feelsLikeC: 0,
    condition: 'cloudy',
    emoji: '⛅',
  },
  {
    exchange: 'borsa-italiana-milan',
    tempC: 5,
    feelsLikeC: 3,
    condition: 'cloudy',
    emoji: '⛅',
  },
  {
    exchange: 'ljse-ljubljana',
    tempC: 3,
    feelsLikeC: 1,
    condition: 'cloudy',
    emoji: '⛅',
  },
  {
    exchange: 'zse-zagreb',
    tempC: 4,
    feelsLikeC: 2,
    condition: 'cloudy',
    emoji: '⛅',
  },

  // Europe — South-Eastern / Eastern
  {
    exchange: 'moex-moscow',
    tempC: -2,
    feelsLikeC: -6,
    condition: 'snow',
    emoji: '❄️',
  },
  {
    exchange: 'misx-moscow',
    tempC: -6,
    feelsLikeC: -10,
    condition: 'snow',
    emoji: '❄️',
  },
  {
    exchange: 'pfts-kyiv',
    tempC: -3,
    feelsLikeC: -7,
    condition: 'snow',
    emoji: '❄️',
  },
  {
    exchange: 'xbel-belgrade',
    tempC: 3,
    feelsLikeC: 1,
    condition: 'cloudy',
    emoji: '⛅',
  },
  {
    exchange: 'sase-sarajevo',
    tempC: 2,
    feelsLikeC: 0,
    condition: 'snow',
    emoji: '❄️',
  },
  {
    exchange: 'mnse-podgorica',
    tempC: 7,
    feelsLikeC: 5,
    condition: 'rain',
    emoji: '🌧',
  },
  {
    exchange: 'mse-skopje',
    tempC: 4,
    feelsLikeC: 2,
    condition: 'cloudy',
    emoji: '⛅',
  },
  {
    exchange: 'bist-istanbul',
    tempC: 7,
    feelsLikeC: 5,
    condition: 'rain',
    emoji: '🌧',
  },
  {
    exchange: 'athex-athens',
    tempC: 10,
    feelsLikeC: 8,
    condition: 'cloudy',
    emoji: '⛅',
  },

  // Europe — Iberian
  {
    exchange: 'bme-madrid',
    tempC: 8,
    feelsLikeC: 6,
    condition: 'sunny',
    emoji: '☀️',
  },

  // ==========================================================================
  // AFRICA
  // ==========================================================================
  {
    exchange: 'cse-casablanca',
    tempC: 14,
    feelsLikeC: 13,
    condition: 'cloudy',
    emoji: '⛅',
  },
  {
    exchange: 'xnsa-lagos',
    tempC: 30,
    feelsLikeC: 32,
    condition: 'sunny',
    emoji: '☀️',
  },
  {
    exchange: 'gse-accra',
    tempC: 29,
    feelsLikeC: 31,
    condition: 'sunny',
    emoji: '☀️',
  },
  {
    exchange: 'nse-nairobi',
    tempC: 22,
    feelsLikeC: 23,
    condition: 'sunny',
    emoji: '☀️',
  },
  {
    exchange: 'dse-dar-es-salaam',
    tempC: 29,
    feelsLikeC: 31,
    condition: 'rain',
    emoji: '🌧',
  },
  {
    exchange: 'sem-port-louis',
    tempC: 27,
    feelsLikeC: 29,
    condition: 'rain',
    emoji: '🌧',
  },
  {
    exchange: 'jse-johannesburg',
    tempC: 20,
    feelsLikeC: 21,
    condition: 'sunny',
    emoji: '☀️',
  },
  {
    exchange: 'nsx-windhoek',
    tempC: 25,
    feelsLikeC: 27,
    condition: 'sunny',
    emoji: '☀️',
  },
  {
    exchange: 'bse-gaborone',
    tempC: 26,
    feelsLikeC: 28,
    condition: 'sunny',
    emoji: '☀️',
  },

  // ==========================================================================
  // AMERICAS
  // ==========================================================================
  {
    exchange: 'tsx-toronto',
    tempC: -5,
    feelsLikeC: -10,
    condition: 'snow',
    emoji: '❄️',
  },
  {
    exchange: 'nyse-new-york',
    tempC: 2,
    feelsLikeC: -2,
    condition: 'cloudy',
    emoji: '⛅',
  },
  {
    exchange: 'cboe-chicago',
    tempC: 10,
    feelsLikeC: 6,
    condition: 'cloudy',
    emoji: '⛅',
  },
  {
    exchange: 'xmex-mexico-city',
    tempC: 16,
    feelsLikeC: 15,
    condition: 'sunny',
    emoji: '☀️',
  },
  {
    exchange: 'bvc-caracas',
    tempC: 24,
    feelsLikeC: 25,
    condition: 'sunny',
    emoji: '☀️',
  },
  {
    exchange: 'xbog-bogota',
    tempC: 14,
    feelsLikeC: 13,
    condition: 'rain',
    emoji: '🌧',
  },
  {
    exchange: 'bvq-quito',
    tempC: 15,
    feelsLikeC: 14,
    condition: 'rain',
    emoji: '🌧',
  },
  {
    exchange: 'b3-sao-paulo',
    tempC: 24,
    feelsLikeC: 25,
    condition: 'rain',
    emoji: '🌧',
  },
  {
    exchange: 'xlim-lima',
    tempC: 24,
    feelsLikeC: 25,
    condition: 'cloudy',
    emoji: '⛅',
  },
  {
    exchange: 'sse-santiago',
    tempC: 22,
    feelsLikeC: 23,
    condition: 'sunny',
    emoji: '☀️',
  },
  {
    exchange: 'bcba-buenos-aires',
    tempC: 26,
    feelsLikeC: 28,
    condition: 'sunny',
    emoji: '☀️',
  },
];

export default DEMO_EXCHANGE_WEATHER;
