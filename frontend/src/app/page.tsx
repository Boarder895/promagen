import React from "react";
import type { Metadata } from "next";

import ProvidersTable from "@/components/providers/providers-table";
import { getProviders } from "@/lib/providers/api";
import { getRailsForHomepage, type Exchange } from "@/lib/exchange-order";
import { flag } from "@/lib/flags";
import RibbonPanel from "@/components/ribbon/ribbon-panel";

// ───────────────────────────────────────────────────────────────────────────────
// Route metadata (SEO/OG/Twitter/Canonical)
// ───────────────────────────────────────────────────────────────────────────────
export const metadata: Metadata = {
  title: "Promagen — Calm, data-rich market and AI overview",
  description:
    "Promagen’s home: east–west exchange rails, an AI providers leaderboard, and a focused Finance Ribbon. Calm, fast, and accessible.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Promagen — Calm, data-rich overview",
    description:
      "East–west exchanges, AI providers leaderboard, and a focused Finance Ribbon.",
    url: "https://promagen.example/",
    siteName: "Promagen",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Promagen — Calm, data-rich overview",
    description:
      "East–west exchanges, AI providers leaderboard, and a focused Finance Ribbon.",
  },
};

// ───────────────────────────────────────────────────────────────────────────────
// Page (server component): static layout + data fetch; interactive ribbon is
// handled by a small client component with pause/PRM/live status.
// ───────────────────────────────────────────────────────────────────────────────
export default function HomePage(): JSX.Element {
  // Centre leaderboard data (20 items as per spec)
  const providers = getProviders(20);

  // East/West rails split per longitude rule (left = easterly half)
  const { left, right } = getRailsForHomepage();

  return (
    <main
      role="main"
      aria-label="Promagen home"
      className="min-h-dvh bg-gradient-to-b from-slate-50 to-slate-100"
    >
      {/* Finance Ribbon block with pause control, reduced-motion respect, freshness stamp and live region */}
      <div className="max-w-7xl mx-auto px-4 pt-6">
        <RibbonPanel pairIds={["EURUSD", "GBPUSD", "EURGBP"]} demo />
      </div>

      {/* Three-column homepage grid */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 px-4 py-6">
        {/* Eastern exchanges rail */}
        <section
          role="complementary"
          aria-label="Eastern exchanges"
          className="space-y-3"
          data-testid="rail-east"
        >
          {left.length > 0 ? (
            left.map((x: Exchange) => (
              <article
                key={x.id}
                className="flex items-center justify-between rounded-2xl p-3 bg-white/80 shadow-sm ring-1 ring-slate-200"
                aria-label={`${x.name} exchange`}
              >
                <span className="inline-flex items-center">
                  <span className="mr-2" aria-hidden="true">
                    {flag(x.country)}
                  </span>
                  <span className="font-medium">{x.name}</span>
                </span>
                <span className="text-xs text-slate-500 tabular-nums">
                  {x.longitude.toFixed(2)}°
                </span>
              </article>
            ))
          ) : (
            <div
              className="rounded-2xl p-4 bg-white/60 ring-1 ring-slate-200"
              aria-live="polite"
            >
              <p className="text-sm text-slate-600">
                No eastern exchanges selected yet. Choose markets to populate
                this rail.
              </p>
            </div>
          )}
        </section>

        {/* Centre: AI providers leaderboard */}
        <section
          role="region"
          aria-label="AI providers leaderboard"
          className="space-y-3"
          data-testid="rail-centre"
        >
          <header className="mb-2 text-center">
            <h1 className="text-2xl font-semibold">Promagen</h1>
            <p className="text-slate-600">Calm, data-rich overview.</p>
          </header>

          {providers.length > 0 ? (
            <ProvidersTable
              providers={providers}
              title="AI Providers Leaderboard"
              caption="Top providers ranked by Promagen score."
              limit={20}
              showRank
            />
          ) : (
            <div
              className="rounded-2xl p-4 bg-white/60 ring-1 ring-slate-200"
              aria-live="polite"
            >
              <p className="text-sm text-slate-600">
                No providers to display right now. Adjust your filters or check
                back shortly.
              </p>
            </div>
          )}
        </section>

        {/* Western exchanges rail */}
        <section
          role="complementary"
          aria-label="Western exchanges"
          className="space-y-3"
          data-testid="rail-west"
        >
          {right.length > 0 ? (
            right.map((x: Exchange) => (
              <article
                key={x.id}
                className="flex items-center justify-between rounded-2xl p-3 bg-white/80 shadow-sm ring-1 ring-slate-200"
                aria-label={`${x.name} exchange`}
              >
                <span className="inline-flex items-center">
                  <span className="mr-2" aria-hidden="true">
                    {flag(x.country)}
                  </span>
                  <span className="font-medium">{x.name}</span>
                </span>
                <span className="text-xs text-slate-500 tabular-nums">
                  {x.longitude.toFixed(2)}°
                </span>
              </article>
            ))
          ) : (
            <div
              className="rounded-2xl p-4 bg-white/60 ring-1 ring-slate-200"
              aria-live="polite"
            >
              <p className="text-sm text-slate-600">
                No western exchanges selected yet. Choose markets to populate
                this rail.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
