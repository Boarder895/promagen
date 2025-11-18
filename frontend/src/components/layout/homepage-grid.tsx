// src/components/layout/homepage-grid.tsx

import React from 'react';

import RibbonPanel from '@/components/ribbon/ribbon-panel';
import {
  RIBBON_CONTAINER_MAX_WIDTH,
  RIBBON_HORIZONTAL_PADDING,
  RIBBON_TOP_PADDING,
  RIBBON_GRID_VERTICAL_PADDING,
  RIBBON_GRID_GAP,
  RIBBON_GRID_COLUMNS,
} from '@/lib/ribbon/ribbon-tokens';

type HomepageGridProps = {
  /**
   * Accessible label for the main region.
   * Defaults to "Promagen home" but can be reused by provider detail layouts.
   */
  mainLabel?: string;
  /**
   * Left-hand rail (eastern exchanges on the homepage).
   */
  left: React.ReactNode;
  /**
   * Centre column (AI providers leaderboard on the homepage).
   */
  centre: React.ReactNode;
  /**
   * Right-hand rail (western exchanges on the homepage).
   */
  right: React.ReactNode;
  /**
   * FX pairs used by the Finance Ribbon at the top.
   * Homepage uses the free trio; provider detail can reuse the same or override later.
   */
  pairIds?: string[];
  /**
   * Whether the ribbon is running in demo mode.
   * For now both homepage and provider detail use demo data.
   */
  demo?: boolean;
};

export default function HomepageGrid({
  mainLabel = 'Promagen home',
  left,
  centre,
  right,
  pairIds = ['EURUSD', 'GBPUSD', 'EURGBP'],
  demo = true,
}: HomepageGridProps): JSX.Element {
  return (
    <main
      role="main"
      aria-label={mainLabel}
      className="min-h-dvh bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950"
    >
      {/* Finance Ribbon block with pause control, reduced-motion respect, freshness stamp and live region */}
      <div
        className={`
          mx-auto
          w-full
          max-w-[1440px]
          2xl:max-w-[1600px]
          ${RIBBON_CONTAINER_MAX_WIDTH}
          ${RIBBON_HORIZONTAL_PADDING}
          ${RIBBON_TOP_PADDING}
        `}
      >
        <RibbonPanel pairIds={pairIds} demo={demo} />
      </div>

      {/* Three-column homepage / provider grid */}
      <div
        className={`
          mx-auto
          w-full
          max-w-[1440px]
          2xl:max-w-[1600px]
          ${RIBBON_CONTAINER_MAX_WIDTH}
          ${RIBBON_HORIZONTAL_PADDING}
          ${RIBBON_GRID_VERTICAL_PADDING}
          grid
          ${RIBBON_GRID_COLUMNS}
          ${RIBBON_GRID_GAP}
        `}
      >
        {left}
        {centre}
        {right}
      </div>
    </main>
  );
}
