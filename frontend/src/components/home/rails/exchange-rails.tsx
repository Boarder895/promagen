// frontend/src/components/home/rails/exchange-rails.tsx
"use client";

import React from "react";
import { getRailsForHomepage } from "@/lib/exchange-order";
import ExchangeColumn from "./exchange-column";

/**
 * Homepage exchange rails:
 * - Pulls the selected exchanges from config
 * - Sorts them east→west
 * - Splits into left/right rails
 * - Renders via ExchangeColumn
 */
export default function ExchangeRails(): JSX.Element {
  const { left, right } = getRailsForHomepage();

  if (!left.length && !right.length) {
    return (
      <section
        aria-label="Global exchanges"
        className="rounded-md bg-white/5 px-4 py-6 text-xs text-muted-foreground"
      >
        No exchanges are currently selected for the homepage.
      </section>
    );
  }

  return (
    <section
      aria-label="Global exchanges"
      className="grid grid-cols-1 gap-6 md:grid-cols-2"
      data-testid="homepage-exchange-rails"
    >
      <ExchangeColumn side="left" exchanges={left} />
      <ExchangeColumn side="right" exchanges={right} />
    </section>
  );
}
