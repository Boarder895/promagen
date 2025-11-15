// frontend/src/data/exchange-weather.demo.ts

export type ExchangeWeather = {
  /**
   * Short exchange code, matching the `exchange` field in exchanges.catalog.json
   * e.g. "NZX", "ASX", "LSE".
   */
  exchange: string;
  /** Demo temperature in °C */
  tempC: number;
  /** Short text label for the condition */
  condition: 'sunny' | 'cloudy' | 'rain' | 'storm' | 'snow' | 'windy';
  /** Emoji shown on the card */
  emoji: string;
};

/**
 * Demo weather – static, no external API.
 * This keeps Promagen free to run without racking up any bills.
 *
 * You can tweak these numbers / conditions whenever you like.
 */
const DEMO_EXCHANGE_WEATHER: ExchangeWeather[] = [
  // Oceania / Asia-Pacific rail (left side)
  { exchange: 'NZX', tempC: 18, condition: 'cloudy', emoji: '⛅' },      // New Zealand Exchange
  { exchange: 'ASX', tempC: 22, condition: 'sunny', emoji: '☀️' },      // Australian Securities Exchange
  { exchange: 'TSE', tempC: 15, condition: 'rain', emoji: '🌧' },        // Tokyo Stock Exchange
  { exchange: 'HKEX', tempC: 27, condition: 'cloudy', emoji: '⛅' },     // Hong Kong Exchanges & Clearing
  { exchange: 'SET', tempC: 30, condition: 'storm', emoji: '⛈' },       // Stock Exchange of Thailand
  { exchange: 'NSE', tempC: 32, condition: 'sunny', emoji: '☀️' },      // National Stock Exchange of India

  // Europe / Middle East / Africa / Americas rail (right side)
  { exchange: 'CBOE', tempC: 10, condition: 'cloudy', emoji: '⛅' },     // Cboe Global Markets (London hub for now)
  { exchange: 'B3', tempC: 24, condition: 'rain', emoji: '🌧' },         // B3 – Brasil Bolsa Balcão
  { exchange: 'LSE', tempC: 9, condition: 'cloudy', emoji: '⛅' },       // London Stock Exchange
  { exchange: 'JSE', tempC: 20, condition: 'sunny', emoji: '☀️' },      // Johannesburg Stock Exchange
  { exchange: 'MOEX', tempC: -2, condition: 'snow', emoji: '❄️' },      // Moscow Exchange
  { exchange: 'DFM', tempC: 35, condition: 'sunny', emoji: '☀️' },      // Dubai Financial Market
];

export default DEMO_EXCHANGE_WEATHER;
