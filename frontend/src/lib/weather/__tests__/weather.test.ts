// src/lib/weather/__tests__/weather.test.ts

import {
  resolveFeelsLike,
  resolveWeatherIcon,
  projectDemoToMarketWeather,
  type MarketWeather,
} from '../weather';
import type { ExchangeWeather } from '../exchange-weather';

describe('weather helpers', () => {
  test('resolveFeelsLike prefers feelsLikeC when finite', () => {
    expect(resolveFeelsLike(20, 25)).toBe(25);
  });

  test('resolveFeelsLike falls back to tempC when feelsLikeC is missing', () => {
    expect(resolveFeelsLike(20, undefined)).toBe(20);
  });

  test('resolveFeelsLike falls back to tempC when feelsLikeC is NaN', () => {
    // Passing NaN is allowed by the type system – we’re just exercising
    // the defensive branch in the implementation.
    expect(resolveFeelsLike(20, Number.NaN)).toBe(20);
  });

  test('resolveWeatherIcon prefers iconOverride when present', () => {
    const entry = {
      emoji: '☀️',
      iconOverride: '🌈',
    } satisfies Pick<ExchangeWeather, 'emoji' | 'iconOverride'>;

    expect(resolveWeatherIcon(entry)).toBe('🌈');
  });

  test('resolveWeatherIcon falls back to emoji when no override', () => {
    const entry = {
      emoji: '☀️',
      iconOverride: '',
    } satisfies Pick<ExchangeWeather, 'emoji' | 'iconOverride'>;

    expect(resolveWeatherIcon(entry)).toBe('☀️');
  });

  test('projectDemoToMarketWeather maps ExchangeWeather to MarketWeather', () => {
    const demo: ExchangeWeather = {
      exchange: 'lse-london',
      tempC: 16,
      feelsLikeC: 14,
      condition: 'rain',
      emoji: '🌧️',
    };

    const projected: MarketWeather = projectDemoToMarketWeather(demo, 'London');

    expect(projected.id).toBe('lse-london');
    expect(projected.city).toBe('London');
    expect(projected.temperatureC).toBe(16);
    expect(projected.feelsLikeC).toBe(14);
    expect(projected.conditions).toBe('rain');
    expect(new Date(projected.updatedISO).toString()).not.toBe('Invalid Date');
  });
});
