// src/lib/__tests__/exchange-weather.test.ts

import {
  getExchangeWeather,
  listExchangeWeather,
} from '../weather/exchange-weather';
import { resolveWeatherIcon, resolveFeelsLike } from '../weather/weather';

describe('getExchangeWeather', () => {
  it('returns null for an unknown exchangeId', () => {
    const result = getExchangeWeather('totally-unknown-exchange-id');
    expect(result).toBeNull();
  });

  it('returns a stable object for a known exchange with the expected emoji', () => {
    const result = getExchangeWeather('lse-london');

    expect(result).not.toBeNull();

    // Treat this as a mini snapshot: if the data changes, this test will fail
    // and you will consciously update it.
    expect(result).toMatchObject({
      exchange: 'lse-london',
      condition: 'cloudy',
      emoji: '⛅',
    });
  });

  it('handles an entry where feelsLikeC is absent without crashing', () => {
    const result = getExchangeWeather('nzx-wellington');

    expect(result).not.toBeNull();

    // By construction, the demo data for NZX omits feelsLikeC.
    expect(result?.feelsLikeC).toBeUndefined();

    // And resolveFeelsLike must fall back to tempC.
    const displayed = resolveFeelsLike(
      result!.tempC,
      result!.feelsLikeC,
    );

    expect(displayed).toBe(result!.tempC);
  });

  it('uses iconOverride when present instead of the default emoji', () => {
    const result = getExchangeWeather('dfm-dubai');

    expect(result).not.toBeNull();

    const icon = resolveWeatherIcon({
      emoji: result!.emoji,
      iconOverride: result!.iconOverride,
    });

    // The demo data gives DFM an explicit "🔥" override.
    expect(icon).toBe('🔥');
    expect(icon).not.toBe(result!.emoji);
  });
});

describe('listExchangeWeather', () => {
  it('returns all demo entries in a stable order', () => {
    const list = listExchangeWeather();
    const exchanges = list.map((entry) => entry.exchange);

    // This is intentionally strict: if you re-order the rails you’ll get a
    // failing test that forces you to think about the UX.
    expect(exchanges).toEqual([
      'nzx-wellington',
      'asx-sydney',
      'tse-tokyo',
      'hkex-hong-kong',
      'set-bangkok',
      'nse-mumbai',
      'dfm-dubai',
      'moex-moscow',
      'lse-london',
      'jse-johannesburg',
      'b3-sao-paulo',
      'cboe-chicago',
    ]);
  });
});
