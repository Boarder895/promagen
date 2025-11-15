// frontend/src/components/weather/exchange-weather-badge.tsx
"use client";

import * as React from "react";

export type ExchangeWeatherSeverity = "normal" | "warning" | "alert";

export type ExchangeWeatherSummary = {
  /**
   * ISO timestamp of the underlying snapshot.
   */
  asOf: string;
  /**
   * Temperature in Celsius; can be null if provider omits it.
   */
  tempC: number | null;
  /**
   * Short condition label from the provider, e.g. "clear", "rain", "storm".
   */
  condition: string | null;
  /**
   * Emoji representation of the current condition, e.g. "☀️", "🌧️".
   */
  emoji?: string | null;
  /**
   * Optional severity to allow subtle visual emphasis.
   */
  severity?: ExchangeWeatherSeverity;
};

type ExchangeWeatherBadgeProps = {
  summary: ExchangeWeatherSummary | null | undefined;
};

export function ExchangeWeatherBadge({
  summary,
}: ExchangeWeatherBadgeProps): JSX.Element | null {
  if (!summary) {
    return null;
  }

  const { tempC, condition, emoji, severity } = summary;

  const labelParts: string[] = [];

  if (condition && condition.trim().length > 0) {
    labelParts.push(condition.trim());
  }

  if (typeof tempC === "number" && Number.isFinite(tempC)) {
    labelParts.push(`${Math.round(tempC)}°C`);
  }

  const ariaLabel =
    labelParts.length > 0 ? labelParts.join(" · ") : "Weather update";

  const toneClasses =
    severity === "alert"
      ? "bg-rose-500/20 text-rose-50 border-rose-500/40"
      : severity === "warning"
        ? "bg-amber-500/15 text-amber-50 border-amber-500/40"
        : "bg-sky-500/15 text-sky-50 border-sky-500/40";

  return (
    <span
      className={`inline-flex max-w-[8rem] items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium tabular-nums ${toneClasses}`}
      aria-label={ariaLabel}
      data-testid="exchange-weather-badge"
    >
      {emoji ? (
        <span aria-hidden="true" className="shrink-0">
          {emoji}
        </span>
      ) : null}
      <span className="truncate">
        {condition && condition.trim().length > 0 ? condition : "Weather"}
      </span>
    </span>
  );
}
