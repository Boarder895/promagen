// @/components/LeaderboardMini.tsx
"use client";

import * as React from "react";

export type LeaderboardMiniProps = {
  title?: string;
  items?: Array<{ label: string }>;
  className?: string;
};

const DEFAULT_ITEMS: Array<{ label: string }> = [
  { label: "Strong balance sheet" },
  { label: "Aligned incentives" },
  { label: "Diversification" },
  { label: "Execution track record" },
  { label: "Low cost of capital" },
  { label: "Transparent reporting" },
  { label: "Regulatory compliance" },
];

export const LeaderboardMini: React.FC<LeaderboardMiniProps> = ({
  title = "Providers Board",
  items = DEFAULT_ITEMS,
  className = "",
}) => {
  return (
    <section className={["w-full", className].filter(Boolean).join(" ")}>
      <h2 className="text-sm font-semibold tracking-wide text-muted-foreground mb-2">{title}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {items.map((it, idx) => (
          <div
            key={`${it.label}-${idx}`}
            className="rounded-lg border border-neutral-200/70 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/40 px-3 py-2 flex items-center justify-between"
          >
            <span className="text-[12px] text-neutral-700 dark:text-neutral-300">{it.label}</span>
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/10">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
            </span>
          </div>
        ))}
      </div>
    </section>
  );
};

