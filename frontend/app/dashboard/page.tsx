// app/dashboard/page.tsx
// Compact, no-scroll-at-1366x768 layout: 2x10 MIG list + 2x8 Exchanges.

import * as React from "react";
import { MIGBoard } from "@/components/MIGBoard";
import { ExchangeBoard } from "@/components/ExchangeBoard"; // <- singular, named export
import { providers20 } from "@/lib/fixtures"; // exchanges16 not needed; ExchangeBoard fetches its own data

export const metadata = {
  title: "Promagen • MIG + Exchanges",
  description: "Top 20 MIG platforms and 16 global exchanges at a glance.",
};

export default function Page(): JSX.Element {
  return (
    <main className="min-h-screen w-full bg-gradient-to-b from-white to-zinc-50">
      <div className="mx-auto max-w-6xl px-4 py-4 space-y-4">
        {/* Top banner could host your brand/pitch; keep compact */}
        <header className="flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight">Promagen Dashboard</h1>
          <div className="text-xs text-zinc-600">Live • compact view</div>
        </header>

        {/* MIG Top 20 */}
        <MIGBoard data={providers20} compact />

        {/* 16 Stock Exchanges (auto-refresh + chime on open) */}
        <ExchangeBoard />

        {/* Footer is ultra light to preserve no-scroll */}
        <footer className="pt-2 text-[11px] text-zinc-500">
          Built for eye-popping colour, motion, and clarity. API-first; stubs today, live data next.
        </footer>
      </div>
    </main>
  );
}
