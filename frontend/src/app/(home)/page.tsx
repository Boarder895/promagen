// Homepage wired to the exchange-order helper.
// Renders east and west rails dynamically with runtime validation.

import dynamic from "next/dynamic";
import { getRailsForHomepage } from "@/lib/exchange-order";
import { flag } from "@/lib/flags";

const FinanceRibbon = dynamic(() => import("@/components/ribbon/finance-ribbon"), { ssr: false });

export default function HomePage() {
  const { left, right } = getRailsForHomepage();

  return (
    <main
      role="main"
      aria-label="Promagen home"
      className="min-h-dvh bg-gradient-to-b from-slate-50 to-slate-100"
    >
      <div className="max-w-7xl mx-auto">
        <FinanceRibbon demo pairIds={["EURUSD", "GBPUSD", "EURGBP"]} intervalMs={0} />
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 px-4 py-6">
        {/* Left rail – Eastern exchanges */}
        <section
          role="complementary"
          aria-label="Eastern exchanges"
          className="space-y-3"
          data-testid="rail-east"
        >
          {left.map((x) => (
            <article
              key={x.id}
              className="flex items-center justify-between border rounded-xl p-2 bg-white/70 shadow-sm"
              aria-label={`${x.name} exchange`}
            >
              <span>
                <span className="mr-1" aria-hidden="true">
                  {flag(x.country)}
                </span>
                {x.name}
              </span>
              <span className="text-xs text-gray-500 tabular-nums">{x.longitude.toFixed(2)}°</span>
            </article>
          ))}
        </section>

        {/* Centre – Providers leaderboard placeholder */}
        <section
          role="region"
          aria-label="AI providers leaderboard"
          className="space-y-3"
          data-testid="rail-centre"
        >
          <p className="text-sm text-gray-500 text-center">Providers leaderboard goes here</p>
        </section>

        {/* Right rail – Western exchanges (reversed so it reads east→west visually) */}
        <section
          role="complementary"
          aria-label="Western exchanges"
          className="space-y-3"
          data-testid="rail-west"
        >
          {right.map((x) => (
            <article
              key={x.id}
              className="flex items-center justify-between border rounded-xl p-2 bg-white/70 shadow-sm"
              aria-label={`${x.name} exchange`}
            >
              <span>
                <span className="mr-1" aria-hidden="true">
                  {flag(x.country)}
                </span>
                {x.name}
              </span>
              <span className="text-xs text-gray-500 tabular-nums">{x.longitude.toFixed(2)}°</span>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
