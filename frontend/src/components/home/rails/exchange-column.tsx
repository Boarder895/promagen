// frontend/src/components/home/rails/exchange-column.tsx
"use client";

import React from "react";
import type { Exchange } from "@/lib/exchanges";
import ExchangeCard from "./exchange-card";

export type ExchangeColumnSide = "left" | "right";

type ExchangeColumnProps = {
  /**
   * Already-sorted list of exchanges for this side of the homepage.
   */
  exchanges: Exchange[];

  /**
   * Used for accessible labelling and analytics hooks.
   */
  side: ExchangeColumnSide;
};

export default function ExchangeColumn({
  exchanges,
  side,
}: ExchangeColumnProps): JSX.Element {
  const ariaLabel =
    side === "left" ? "Eastern exchanges" : "Western exchanges";

  return (
    <div
      className="space-y-3"
      role="list"
      aria-label={ariaLabel}
    >
      {exchanges.map((exchange) => (
        <div key={exchange.id} role="listitem">
          <ExchangeCard exchange={exchange} />
        </div>
      ))}
    </div>
  );
}
