"use client";

import React from "react";

export type Exchange = {
  id: string;
  name: string;
  country?: string;
  city?: string;
  tz?: string;
  longitude?: number;
};

type Props = {
  exchange: Exchange;
  compact?: boolean;
};

export default function ExchangeCard({ exchange, compact = false }: Props): JSX.Element {
  return (
    <div
      className={compact ? "flex items-center gap-2 text-sm" : "flex items-center gap-3 text-base"}
      role="group"
      aria-label={`${exchange.name} summary`}
      data-testid={`exchange-${exchange.id}`}
    >
      <span className="text-white">{exchange.name}</span>
      {typeof exchange.longitude === "number" ? (
        <span className="text-white/60 [font-variant-numeric:tabular-nums]">
          {Math.round(exchange.longitude)}°
        </span>
      ) : null}
    </div>
  );
}
