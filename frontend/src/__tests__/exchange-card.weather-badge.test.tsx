// frontend/src/__tests__/exchange-card.weather-badge.test.tsx
import * as React from "react";
import { render, screen } from "@testing-library/react";

import ExchangeCard from "../components/home/rails/exchange-card";
import type { Exchange } from "@/lib/exchanges";
import type { ExchangeWeatherSummary } from "@/components/weather/exchange-weather-badge";

describe("ExchangeCard – weather badge", () => {
  const baseExchange: Exchange = {
    // Minimal but valid shape for the card.
    id: "lse",
    code: "LSE",
    name: "London Stock Exchange",
    city: "London",
    country: "United Kingdom",
    countryCode: "GB",
    longitude: -0.1,
    tz: "Europe/London",
    timezone: "Europe/London",
    hours: {
      open: "08:00",
      close: "16:30",
    },
    offsetMinutes: 0,
  } as Exchange;

  const baseSummary: ExchangeWeatherSummary = {
    asOf: "2025-11-14T09:00:00Z",
    tempC: 9.5,
    condition: "Rain warning",
    emoji: "🌧️",
    severity: "warning",
  };

  it("renders a weather badge when weatherSummary is provided", () => {
    render(<ExchangeCard exchange={baseExchange} weatherSummary={baseSummary} />);

    const badge = screen.getByTestId("exchange-weather-badge");

    expect(badge).toBeInTheDocument();
    // The badge text comes from `condition`, so this should appear.
    expect(badge).toHaveTextContent(/rain warning/i);
  });

  it("does not render a weather badge when weatherSummary is missing", () => {
    render(<ExchangeCard exchange={baseExchange} />);

    expect(
      screen.queryByTestId("exchange-weather-badge"),
    ).not.toBeInTheDocument();
  });
});
