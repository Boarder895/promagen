// src/components/layout/homepage-grid.tsx

import React, { type ReactNode } from 'react';

import FinanceRibbon from '@/components/ribbon/finance-ribbon.container';

export type HomepageGridProps = {
  /**
   * Main accessible label for the page content.
   * Example: "Promagen home", "Provider details for X".
   */
  mainLabel: string;
  /**
   * Left-hand column – typically the Eastern exchanges rail.
   */
  left: ReactNode;
  /**
   * Centre column – usually the providers leaderboard.
   */
  centre: ReactNode;
  /**
   * Right-hand column – typically the Western exchanges rail.
   */
  right: ReactNode;
  /**
   * Whether to show the FinanceRibbon at the top of the centre column.
   * Defaults to false so non-home pages stay calm.
   */
  showFinanceRibbon?: boolean;
};

export default function HomepageGrid({
  mainLabel,
  left,
  centre,
  right,
  showFinanceRibbon = false,
}: HomepageGridProps) {
  return (
    <main
      aria-labelledby="page-main-heading"
      className="min-h-screen bg-slate-950/95 text-slate-50"
    >
      <h1 id="page-main-heading" className="sr-only">
        {mainLabel}
      </h1>

      {/* Hero: Promagen – a bridge between markets and imagination */}
      <section
        aria-label="Promagen overview"
        className="w-full border-b border-slate-900/70 bg-gradient-to-b from-slate-950 via-slate-950/95 to-slate-950"
      >
        <div className="mx-auto flex w-full max-w-4xl flex-col items-center px-4 pt-8 pb-1 text-center sm:px-6 md:pb-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-sky-400/80">
            Promagen
          </p>
          <h2 className="mt-2 text-xl font-semibold leading-tight sm:text-2xl md:text-3xl">
            <span className="whitespace-nowrap bg-gradient-to-r from-sky-400 via-emerald-300 to-indigo-400 bg-clip-text text-transparent">
              Promagen – a bridge between markets and imagination
            </span>
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-300 sm:text-base">
            <span className="whitespace-nowrap">
              Track what&apos;s happening out there, then turn those movements into prompts, content
              and tools in here.
            </span>
          </p>

          {/* Promagen-centric visual effect: soft market glow under the hero */}
          <div className="pointer-events-none mt-2 flex w-full justify-center">
            <div className="h-14 w-full max-w-md rounded-full bg-gradient-to-r from-sky-500/18 via-emerald-400/14 to-indigo-500/18 blur-2xl" />
          </div>
        </div>
      </section>

      {/* Three-column market layout that snaps to the user's screen */}
      <section
        aria-label="Market overview layout"
        className="mx-auto flex w-full flex-col gap-4 px-4 pb-6 pt-0 md:grid md:grid-cols-[minmax(0,0.9fr)_minmax(0,2.2fr)_minmax(0,0.9fr)] md:gap-6"
      >
        <div className="space-y-3" data-testid="rail-east-wrapper">
          {left}
        </div>

        <div className="space-y-3" data-testid="rail-centre">
          {showFinanceRibbon && <FinanceRibbon />}
          {centre}
        </div>

        <div className="space-y-3" data-testid="rail-west-wrapper">
          {right}
        </div>
      </section>
    </main>
  );
}
