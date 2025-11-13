// Macro page — static by default (ISR) but still interactive via client components.
export const runtime = "nodejs"; // ensure Node runtime, not Edge
export const dynamic = "force-static"; // opt into SSG
export const revalidate = 3600; // 1 hour ISR, non-negative number, Next-safe

import type { ReactNode } from "react";
import Tabs from "@/components/ui/tabs";

type MacroTabId = "overview" | "metrics" | "notes";

type MacroTab = {
  id: MacroTabId;
  label: string;
  disabled?: boolean;
  panel: ReactNode;
};

const TABS: ReadonlyArray<MacroTab> = [
  {
    id: "overview",
    label: "Overview",
    panel: (
      <section
        aria-labelledby="macro-overview-heading"
        className="space-y-4"
      >
        <h2
          id="macro-overview-heading"
          className="text-lg font-semibold text-white"
        >
          Macro overview
        </h2>
        <p className="text-sm text-white/70">
          This is a placeholder for the Macro Pulse overview. It will summarise
          inflation, policy rates, key releases, and other top-level signals
          once the data plumbing is wired.
        </p>
      </section>
    ),
  },
  {
    id: "metrics",
    label: "Metrics",
    panel: (
      <section
        aria-labelledby="macro-metrics-heading"
        className="space-y-4"
      >
        <h2
          id="macro-metrics-heading"
          className="text-lg font-semibold text-white"
        >
          Metrics
        </h2>
        <p className="text-sm text-white/70">
          This panel will hold core macro metrics: CPI, policy rates, growth
          indicators, and a compact history view. For now it&apos;s a calm stub
          so the tabs and routing can stabilise.
        </p>
      </section>
    ),
  },
  {
    id: "notes",
    label: "Notes",
    disabled: false,
    panel: (
      <section
        aria-labelledby="macro-notes-heading"
        className="space-y-4"
      >
        <h2
          id="macro-notes-heading"
          className="text-lg font-semibold text-white"
        >
          Notes
        </h2>
        <p className="text-sm text-white/70">
          This area is reserved for commentary, release notes, and “what changed
          this week” explanations tying the macro data to the Ribbon and rails.
        </p>
      </section>
    ),
  },
] as const;

export default function MacroPage(): JSX.Element {
  return (
    <main
      role="main"
      aria-labelledby="macro-tabs-heading"
      className="p-6 space-y-6"
    >
      <header className="space-y-2">
        <h1
          id="macro-tabs-heading"
          className="text-xl font-semibold text-white"
        >
          Macro Pulse
        </h1>
        <p className="text-sm text-white/70">
          A calm staging area for Promagen&apos;s macro layer — using the
          standard in-page tabs system, ready for data once the pipelines are
          live.
        </p>
      </header>

      <section aria-label="Macro Pulse tabs">
        {/* SR label for the tablist itself */}
        <h2 id="macro-tabs" className="sr-only">
          Macro Pulse sections
        </h2>

        <Tabs labelledBy="macro-tabs" items={TABS} />
      </section>
    </main>
  );
}
