// src/data/weather/exchange-weather.demo.ts

export type ExchangeWeatherCondition =
  | 'sunny'
  | 'cloudy'
  | 'rain'
  | 'storm'
  | 'snow'
  | 'windy';

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
  // Asia–Pacific rail (left)
  {
    exchange: 'nzx-wellington',
    tempC: 14,
    // feelsLikeC intentionally omitted to prove "no crash" behaviour.
    condition: 'windy',
    emoji: '🌬️',
  },
  {
    exchange: 'asx-sydney',
    tempC: 22,
    feelsLikeC: 23,
    condition: 'sunny',
    emoji: '☀️',
  },
  {
    exchange: 'tse-tokyo',
    tempC: 18,
    feelsLikeC: 17,
    condition: 'cloudy',
    emoji: '⛅',
  },
  {
    exchange: 'hkex-hong-kong',
    tempC: 27,
    feelsLikeC: 29,
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
    exchange: 'nse-mumbai',
    tempC: 32,
    feelsLikeC: 35,
    condition: 'sunny',
    emoji: '☀️',
  },

  // Europe / Middle East / Africa / Americas rail (right)
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
    exchange: 'moex-moscow',
    tempC: -2,
    feelsLikeC: -6,
    condition: 'snow',
    emoji: '❄️',
  },
  {
    exchange: 'lse-london',
    tempC: 9,
    feelsLikeC: 7,
    condition: 'cloudy',
    emoji: '⛅',
  },
  {
    exchange: 'jse-johannesburg',
    tempC: 20,
    feelsLikeC: 21,
    condition: 'sunny',
    emoji: '☀️',
  },
  {
    exchange: 'b3-sao-paulo',
    tempC: 24,
    feelsLikeC: 25,
    condition: 'rain',
    emoji: '🌧',
  },
  {
    exchange: 'cboe-chicago',
    tempC: 10,
    feelsLikeC: 6,
    condition: 'cloudy',
    emoji: '⛅',
  },
];

export default DEMO_EXCHANGE_WEATHER;
