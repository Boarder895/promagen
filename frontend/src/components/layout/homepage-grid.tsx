// src/components/layout/homepage-grid.tsx

import React from 'react';

import RibbonPanel from '@/components/ribbon/ribbon-panel';
import {
  RIBBON_HORIZONTAL_PADDING,
  RIBBON_TOP_PADDING,
  RIBBON_GRID_VERTICAL_PADDING,
  RIBBON_GRID_GAP,
  RIBBON_GRID_COLUMNS,
} from '@/lib/ribbon/ribbon-tokens';
import { cn } from '@/lib/cn';

type HomepageGridProps = {
  /**
   * Accessible label for the main region.
   */
  mainLabel?: string;

  /**
   * Left column content (eastern exchanges rail).
   */
  left: React.ReactNode;

  /**
   * Centre column content (AI providers leaderboard / detail).
   */
  centre: React.ReactNode;

  /**
   * Right column content (western exchanges rail).
   */
  right: React.ReactNode;

  /**
   * FX pair IDs passed through to the Finance Ribbon.
   */
  pairIds: string[];

  /**
   * When true, Finance Ribbon runs in demo mode (no live API calls).
   */
  demo?: boolean;
};

export default function HomepageGrid({
  mainLabel = 'Promagen home',
  left,
  centre,
  right,
  pairIds,
  demo,
}: HomepageGridProps): JSX.Element {
  return (
    <main
      role="main"
      aria-label={mainLabel}
      // Key bits:
      // - w-full      → always match the browser window width
      // - flex-col    → ribbon on top, grid underneath
      // Background gradient is handled globally in globals.css / <body>.
      className="min-h-dvh w-full flex flex-col"
    >
      {/* Ribbon row – full width of the window */}
      <section
        aria-label="Finance ribbon"
        className={cn('w-full', RIBBON_HORIZONTAL_PADDING, RIBBON_TOP_PADDING)}
      >
        <RibbonPanel pairIds={pairIds} demo={demo} />
      </section>

      {/* Three-column layout – also full width of the window */}
      <section
        aria-label="Promagen overview"
        className={cn(
          'w-full flex-1',
          'grid',
          RIBBON_GRID_COLUMNS, // grid-cols-1 md:grid-cols-3
          RIBBON_GRID_GAP, // gap-6
          RIBBON_GRID_VERTICAL_PADDING,
          RIBBON_HORIZONTAL_PADDING, // side padding so cards don’t kiss the edge
        )}
      >
        {left}
        {centre}
        {right}
      </section>
    </main>
  );
}
