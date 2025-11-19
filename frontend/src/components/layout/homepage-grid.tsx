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
  mainLabel?: string;
  left: React.ReactNode;
  centre: React.ReactNode;
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
    <main role="main" aria-label={mainLabel} className="min-h-dvh">
      {/* Finance Ribbon block with pause control, reduced-motion respect, freshness stamp and live region */}
      <div
        className={`
          mx-auto
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
