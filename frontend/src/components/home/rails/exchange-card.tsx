// frontend/src/components/home/rails/exchange-card.tsx
"use client";

import * as React from "react";
import type { Exchange } from "@/lib/exchanges";
import { getExchangeShortLabel } from "@/lib/exchanges";
import { flag, flagAriaLabel } from "@/lib/flags";
import { localTime } from "@/lib/time";

type ExchangeCardProps = {
  exchange: Exchange;
};

/**
 * Formats a GMT offset in minutes into a label like "GMT+09:00".
 * Falls back to an empty string if the offset is missing or invalid.
 */
function formatGmtOffset(offsetMinutes?: number | null): string {
  if (typeof offsetMinutes !== "number" || !Number.isFinite(offsetMinutes)) {
    return "";
  }

  const sign = offsetMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;

  const hh = hours.toString().padStart(2, "0");
  const mm = minutes.toString().padStart(2, "0");

  return `GMT${sign}${hh}:${mm}`;
}

/**
 * Canonical ExchangeCard used across the homepage rails.
 *
 * - Uses emoji flags only (no external assets).
 * - Local time derived from GMT offset minutes.
 * - GMT label is purely decorative; safe to omit when data is missing.
 * - Calm, compact, and fully keyboard / screen-reader friendly.
 */
export default function ExchangeCard({ exchange }: ExchangeCardProps) {
  const { name, country, countryCode, offsetMinutes } = exchange;

  const shortLabel = getExchangeShortLabel(exchange);

  const hasOffset =
    typeof offsetMinutes === "number" && Number.isFinite(offsetMinutes);

  const localTimeLabel = hasOffset ? localTime(offsetMinutes!) : "—:—";
  const gmtLabel = hasOffset ? formatGmtOffset(offsetMinutes!) : "";

  const flagEmoji = flag(countryCode);
  const flagLabelText = flagAriaLabel(countryCode);

  const timeAriaLabel = hasOffset
    ? `Local time ${localTimeLabel}`
    : "Local time unavailable";

  return (
    <div
      className="flex items-center justify-between rounded-md bg-white/5 px-3 py-2 text-xs shadow-sm ring-1 ring-white/10"
      role="group"
      aria-label={`${name} stock exchange`}
      data-exchange-id={exchange.id}
      data-testid="exchange-card"
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span aria-label={flagLabelText} role="img" className="shrink-0">
            {flagEmoji}
          </span>
          <span className="truncate font-medium">{name}</span>
        </div>
        <p className="truncate text-[11px] text-muted-foreground">
          {shortLabel} · {country}
        </p>
      </div>

      <div className="flex shrink-0 flex-col items-end text-right">
        <p
          className="text-xs font-semibold text-foreground tabular-nums"
          aria-label={timeAriaLabel}
          data-testid="exchange-local-time"
        >
          {localTimeLabel}
        </p>
        {gmtLabel ? (
          <p
            className="text-[10px] text-muted-foreground tabular-nums"
            aria-hidden="true"
            data-testid="exchange-gmt-offset"
          >
            {gmtLabel}
          </p>
        ) : null}
      </div>
    </div>
  );
}
