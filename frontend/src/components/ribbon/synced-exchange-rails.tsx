// src/components/ribbon/synced-exchange-rails.tsx
'use client';

import React, { useRef, useCallback, type ReactNode } from 'react';

export type SyncedExchangeRailsProps = {
  /**
   * Content for the left (Eastern) rail
   */
  leftContent: ReactNode;
  /**
   * Content for the right (Western) rail
   */
  rightContent: ReactNode;
  /**
   * Accessible label for left rail
   */
  leftAriaLabel: string;
  /**
   * Accessible label for right rail
   */
  rightAriaLabel: string;
  /**
   * Test ID for left rail
   */
  leftTestId?: string;
  /**
   * Test ID for right rail
   */
  rightTestId?: string;
};

/**
 * SyncedExchangeRails - Renders left and right exchange rails with synchronized scrolling.
 *
 * When you scroll one rail, the other follows. Both rails:
 * - Fill available height (flex-1)
 * - Have matching card styling
 * - Scroll internally with thin scrollbars
 */
export default function SyncedExchangeRails({
  leftContent,
  rightContent,
  leftAriaLabel,
  rightAriaLabel,
  leftTestId,
  rightTestId,
}: SyncedExchangeRailsProps) {
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const isSyncing = useRef(false);

  /**
   * Synchronize scroll position from source to target.
   * Uses scrollTop percentage to handle different content heights.
   */
  const syncScroll = useCallback((source: HTMLDivElement, target: HTMLDivElement) => {
    if (isSyncing.current) return;
    isSyncing.current = true;

    // Calculate scroll percentage
    const maxScroll = source.scrollHeight - source.clientHeight;
    const scrollPercent = maxScroll > 0 ? source.scrollTop / maxScroll : 0;

    // Apply to target
    const targetMaxScroll = target.scrollHeight - target.clientHeight;
    target.scrollTop = scrollPercent * targetMaxScroll;

    // Reset sync flag after frame
    requestAnimationFrame(() => {
      isSyncing.current = false;
    });
  }, []);

  const handleLeftScroll = useCallback(() => {
    if (leftRef.current && rightRef.current) {
      syncScroll(leftRef.current, rightRef.current);
    }
  }, [syncScroll]);

  const handleRightScroll = useCallback(() => {
    if (rightRef.current && leftRef.current) {
      syncScroll(rightRef.current, leftRef.current);
    }
  }, [syncScroll]);

  return (
    <>
      {/* Left rail (Eastern exchanges) */}
      <section
        role="complementary"
        aria-label={leftAriaLabel}
        className="flex min-h-0 flex-1 flex-col rounded-3xl bg-slate-950/70 p-4 shadow-sm ring-1 ring-white/10"
        data-testid={leftTestId}
      >
        <div
          ref={leftRef}
          onScroll={handleLeftScroll}
          className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/20 hover:scrollbar-thumb-white/30"
        >
          {leftContent}
        </div>
      </section>

      {/* Right rail (Western exchanges) - rendered in its grid position */}
      <section
        role="complementary"
        aria-label={rightAriaLabel}
        className="flex min-h-0 flex-1 flex-col rounded-3xl bg-slate-950/70 p-4 shadow-sm ring-1 ring-white/10"
        data-testid={rightTestId}
      >
        <div
          ref={rightRef}
          onScroll={handleRightScroll}
          className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/20 hover:scrollbar-thumb-white/30"
        >
          {rightContent}
        </div>
      </section>
    </>
  );
}
