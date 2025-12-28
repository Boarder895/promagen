// frontend/src/components/exchanges/__tests__/exchange-card.test.tsx
import * as React from 'react';
import { render, screen } from '@testing-library/react';

import { ExchangeCard } from '../exchange-card';
import type { ExchangeCardData } from '../types';

// Mock the clock to avoid timing issues in tests
jest.mock('@/lib/clock', () => ({
  formatClockInTZ: jest.fn(() => '14:23:45'),
}));

describe('ExchangeCard', () => {
  const baseExchange: ExchangeCardData = {
    id: 'nzx-wellington',
    name: 'New Zealand Exchange (NZX)',
    city: 'Wellington',
    countryCode: 'NZ',
    tz: 'Pacific/Auckland',
    hoursTemplate: 'australasia-standard',
  };

  it('renders exchange name and city', () => {
    render(<ExchangeCard exchange={baseExchange} />);

    expect(screen.getByText('New Zealand Exchange (NZX)')).toBeInTheDocument();
    expect(screen.getByText('Wellington')).toBeInTheDocument();
  });

  it('renders with data-testid for testing', () => {
    render(<ExchangeCard exchange={baseExchange} />);

    expect(screen.getByTestId('exchange-card')).toBeInTheDocument();
  });

  it('renders data-exchange-id attribute', () => {
    render(<ExchangeCard exchange={baseExchange} />);

    const card = screen.getByTestId('exchange-card');
    expect(card).toHaveAttribute('data-exchange-id', 'nzx-wellington');
  });

  it('renders clock with correct aria-label', () => {
    render(<ExchangeCard exchange={baseExchange} />);

    expect(screen.getByLabelText(/local time in wellington/i)).toBeInTheDocument();
  });

  it('renders market status indicator', () => {
    render(<ExchangeCard exchange={baseExchange} />);

    // Should show either Open or Closed
    const status = screen.getByRole('status');
    expect(status).toBeInTheDocument();
    expect(status).toHaveAttribute('aria-label');
  });

  it('renders temperature placeholder when no weather data', () => {
    render(<ExchangeCard exchange={baseExchange} />);

    expect(screen.getByLabelText('Temperature unavailable')).toBeInTheDocument();
  });

  it('renders temperature when weather data provided', () => {
    const exchangeWithWeather: ExchangeCardData = {
      ...baseExchange,
      weather: {
        tempC: 18,
        emoji: '☀️',
        condition: 'Sunny',
      },
    };

    render(<ExchangeCard exchange={exchangeWithWeather} />);

    expect(screen.getByLabelText('18°C')).toBeInTheDocument();
  });

  it('renders weather emoji from API when provided', () => {
    const exchangeWithWeather: ExchangeCardData = {
      ...baseExchange,
      weather: {
        tempC: 18,
        emoji: '🌧️',
        condition: 'Rainy',
      },
    };

    render(<ExchangeCard exchange={exchangeWithWeather} />);

    expect(screen.getByRole('img', { name: /rainy/i })).toBeInTheDocument();
  });

  it('renders fallback emoji from SSOT when no weather emoji', () => {
    render(<ExchangeCard exchange={baseExchange} />);

    // Should have a weather condition emoji (from SSOT fallback)
    const weatherEmoji = screen.getByRole('img', { name: /weather condition/i });
    expect(weatherEmoji).toBeInTheDocument();
  });

  it('renders accessible group with exchange name', () => {
    render(<ExchangeCard exchange={baseExchange} />);

    expect(
      screen.getByRole('group', { name: /new zealand exchange \(nzx\) stock exchange/i })
    ).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<ExchangeCard exchange={baseExchange} className="custom-class" />);

    const card = screen.getByTestId('exchange-card');
    expect(card).toHaveClass('custom-class');
  });

  it('handles missing city gracefully', () => {
    const exchangeNoCity: ExchangeCardData = {
      ...baseExchange,
      city: '',
    };

    render(<ExchangeCard exchange={exchangeNoCity} />);

    // Should still render without errors
    expect(screen.getByTestId('exchange-card')).toBeInTheDocument();
  });

  it('handles missing timezone gracefully', () => {
    const exchangeNoTz: ExchangeCardData = {
      ...baseExchange,
      tz: '',
    };

    render(<ExchangeCard exchange={exchangeNoTz} />);

    // Should show placeholder time
    expect(screen.getByText('--:--:--')).toBeInTheDocument();
  });
});

describe('ExchangeCard – weather badge compatibility', () => {
  // This test ensures backwards compatibility with the old weather badge test
  const baseExchange: ExchangeCardData = {
    id: 'lse',
    name: 'London Stock Exchange',
    city: 'London',
    countryCode: 'GB',
    tz: 'Europe/London',
    hoursTemplate: 'europe-uk',
  };

  it('renders weather data when provided (backwards compatible)', () => {
    const exchangeWithWeather: ExchangeCardData = {
      ...baseExchange,
      weather: {
        tempC: 9,
        emoji: '🌧️',
        condition: 'Rain warning',
      },
    };

    render(<ExchangeCard exchange={exchangeWithWeather} />);

    // Temperature should be visible
    expect(screen.getByLabelText('9°C')).toBeInTheDocument();

    // Weather emoji should be visible with condition as aria-label
    expect(screen.getByRole('img', { name: /rain warning/i })).toBeInTheDocument();
  });

  it('does not crash when weather is missing', () => {
    render(<ExchangeCard exchange={baseExchange} />);

    // Should render without errors
    expect(screen.getByTestId('exchange-card')).toBeInTheDocument();
  });
});
