// src/components/layout/homepage-grid.tsx
// ============================================================================
// HOMEPAGE GRID - Three-column layout with Market Pulse v2.0
// ============================================================================
// Layout: Left rail | Centre (Finance ribbon + Providers) | Right rail
// Synchronized scrolling between exchange rails
// Market Pulse: Flowing energy streams connect exchanges to providers
// Auth: Sign in button in header (right), Home + Studio buttons below
//
// UPDATED: Added Home button to header for navigation back to homepage.
// UPDATED: Added z-index to header to ensure buttons are always clickable.
// UPDATED: Fixed header row height to properly contain absolutely positioned buttons.
// UPDATED: Studio button now links to /studio (was /prompts).
// UPDATED: Removed unused Link import (using native <a> tags for reliability).
// When demoMode=true, renders DemoFinanceRibbon with static data instead of
// live API ribbon.
// ============================================================================

'use client';

import React, { useRef, useCallback, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import FinanceRibbon from '@/components/ribbon/finance-ribbon.container';
import CommoditiesRibbon from '@/components/ribbon/commodities-ribbon.container';
import CryptoRibbon from '@/components/ribbon/crypto-ribbon.container';
import DemoFinanceRibbon from '@/components/ribbon/demo-finance-ribbon';
import ProvenanceFooter from '@/components/core/provenance-footer';
import AuthButton from '@/components/auth/auth-button';
import ReferenceFrameToggle from '@/components/reference-frame-toggle';
import type { Exchange } from '@/data/exchanges/types';
import type { ReferenceFrame } from '@/lib/location';
import type { FxPairCatalogEntry } from '@/lib/pro-promagen/types';
import { useMarketPulse } from '@/hooks/use-market-pulse';
import { MarketPulseOverlay } from '@/components/market-pulse';

// ============================================================================
// ICONS
// ============================================================================

function WandIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672zM12 2.25V4.5m5.834.166l-1.591 1.591M20.25 10.5H18M7.757 14.743l-1.59 1.59M6 10.5H3.75m4.007-4.243l-1.59-1.59"
      />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
      />
    </svg>
  );
}

function ProIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
      />
    </svg>
  );
}

// ============================================================================
// SHARED STYLES
// ============================================================================

const navButtonStyles =
  'inline-flex items-center justify-center gap-2 rounded-full border border-purple-500/70 bg-gradient-to-r from-purple-600/20 to-pink-600/20 px-4 py-1.5 text-sm font-medium text-purple-100 shadow-sm transition-all hover:from-purple-600/30 hover:to-pink-600/30 hover:border-purple-400 focus-visible:outline-none focus-visible:ring focus-visible:ring-purple-400/80';

// ============================================================================
// TYPES
// ============================================================================

export type HomepageGridProps = {
  /**
   * Main accessible label for the page content.
   */
  mainLabel: string;
  /**
   * Content for the left (Eastern) exchange rail.
   */
  leftContent: ReactNode;
  /**
   * Content for the centre column (providers table).
   */
  centre: ReactNode;
  /**
   * Content for the right (Western) exchange rail.
   */
  rightContent: ReactNode;
  /**
   * Whether to show the FinanceRibbon at the top of the centre column.
   */
  showFinanceRibbon?: boolean;
  /**
   * Demo mode: render static DemoFinanceRibbon instead of live API ribbon.
   * Used on /pro-promagen page for preview.
   */
  demoMode?: boolean;
  /**
   * FX pairs with demo data for DemoFinanceRibbon.
   * Only used when demoMode=true.
   */
  demoPairs?: FxPairCatalogEntry[];
  /**
   * All exchanges (left + right rails combined).
   * Required for market pulse feature.
   */
  exchanges?: ReadonlyArray<Exchange>;
  /**
   * Provider IDs currently displayed in the table.
   * Required for market pulse feature.
   */
  displayedProviderIds?: string[];
  /**
   * Whether user is paid tier (for showing reference toggle).
   */
  isPaidUser?: boolean;
  /**
   * Current reference frame for exchange ordering.
   */
  referenceFrame?: ReferenceFrame;
  /**
   * Callback when reference frame changes (paid users only).
   */
  onReferenceFrameChange?: (frame: ReferenceFrame) => void;
  /**
   * Whether location is loading.
   */
  isLocationLoading?: boolean;
  /**
   * User's city name (if detected).
   */
  cityName?: string;
  /**
   * Whether user is authenticated (signed in).
   */
  isAuthenticated?: boolean;
};

/**
 * HomepageGrid - Three-column layout with synchronized exchange rail scrolling.
 *
 * Layout architecture:
 * - Page fills exactly 100dvh — NO page scroll
 * - Header row: Toggle (left, paid only) + PROMAGEN (centred) + Sign In + Home + Studio (right)
 * - Hero section: tagline and subtitle centred
 * - Three-column grid: fills remaining space (flex-1)
 * - Left/right rails: synchronized scrolling (scroll one, both move)
 * - Centre column: providers table scrolls independently
 * - Footer: fixed at bottom
 * - Market Pulse v2.0: Flowing energy streams when markets transition
 * - Auth: Sign in button in header (right), Home + Studio buttons below
 * - Market Pulse: Flowing energy streams connect exchanges to providers
 */
export default function HomepageGrid({
  mainLabel,
  leftContent,
  centre,
  rightContent,
  showFinanceRibbon = false,
  demoMode = false,
  demoPairs = [],
  exchanges = [],
  displayedProviderIds = [],
  isPaidUser = false,
  referenceFrame = 'greenwich',
  onReferenceFrameChange,
  isLocationLoading = false,
  cityName,
  isAuthenticated = false,
}: HomepageGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const providersRef = useRef<HTMLDivElement>(null);
  const isSyncing = useRef(false);

  // Get current pathname to determine if we're on the homepage
  const pathname = usePathname();
  const isHomepage = pathname === '/';

  // Get selected exchange IDs
  const selectedExchangeIds = exchanges.map((e) => e.id);

  // Use Market Pulse v2.0 hook - detects ±1 min around opens/closes
  const { pulseContexts, activeExchangeIds } = useMarketPulse({
    exchanges,
    onBurst: (context) => {
      // Optional: Log burst events for debugging
      if (process.env.NODE_ENV === 'development') {
        console.debug(`[Market Pulse] ${context.exchangeId} is ${context.state}`);
      }
    },
  });

  /**
   * Synchronize scroll position from source to target.
   * Uses scrollTop percentage to handle different content heights.
   */
  const syncScroll = useCallback((source: HTMLDivElement, target: HTMLDivElement) => {
    if (isSyncing.current) return;
    isSyncing.current = true;

    const maxScroll = source.scrollHeight - source.clientHeight;
    const scrollPercent = maxScroll > 0 ? source.scrollTop / maxScroll : 0;

    const targetMaxScroll = target.scrollHeight - target.clientHeight;
    target.scrollTop = scrollPercent * targetMaxScroll;

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

  // Handle reference frame change
  const handleReferenceFrameChange = useCallback(
    (frame: ReferenceFrame) => {
      onReferenceFrameChange?.(frame);
    },
    [onReferenceFrameChange],
  );

  // Render the appropriate finance ribbon based on mode
  const renderFinanceRibbon = () => {
    if (!showFinanceRibbon) return null;

    if (demoMode) {
      return (
        <div className="shrink-0">
          <DemoFinanceRibbon pairs={demoPairs} />
        </div>
      );
    }

    return (
      <div className="shrink-0 space-y-4">
        <FinanceRibbon />
        <CommoditiesRibbon />
        <CryptoRibbon />
      </div>
    );
  };

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-slate-950/95 text-slate-50">
      <main aria-labelledby="page-main-heading" className="flex min-h-0 flex-1 flex-col">
        <h1 id="page-main-heading" className="sr-only">
          {mainLabel}
        </h1>

        {/* Hero: Promagen – a bridge between markets and imagination */}
        <section
          aria-label="Promagen overview"
          className="relative z-20 w-full shrink-0 border-b border-slate-900/70 bg-gradient-to-b from-slate-950 via-slate-950/95 to-slate-950"
        >
          {/* Header row: Toggle (left) + PROMAGEN (centred) + Sign In + Home + Studio (right) */}
          {/* FIXED: Added min-h-[60px] to ensure header row has proper height for buttons */}
          <div className="relative mx-auto flex min-h-[60px] w-full items-start px-4 pt-4">
            {/* Reference frame toggle + Pro Promagen - absolutely positioned to left, stacked vertically */}
            <div className="absolute left-4 top-4 flex flex-col items-start gap-2">
              <ReferenceFrameToggle
                referenceFrame={referenceFrame}
                onReferenceFrameChange={handleReferenceFrameChange}
                isPaidUser={isPaidUser}
                isAuthenticated={isAuthenticated}
                isLocationLoading={isLocationLoading}
                cityName={cityName}
              />
              <a href="/pro-promagen" className={navButtonStyles}>
                <ProIcon />
                Pro Promagen
              </a>
            </div>

            {/* PROMAGEN label - absolutely centred */}
            <div className="flex flex-1 items-center justify-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-sky-400/80">
                Promagen
              </p>
            </div>

            {/* Auth + Home + Studio buttons - absolutely positioned to right, stacked vertically */}
            {/* Using native <a> tags instead of Next.js Link to ensure navigation works */}
            <div className="absolute right-4 top-4 z-30 flex flex-col items-end gap-2">
              <AuthButton />
              {/* Show Home button on all pages EXCEPT the actual homepage */}
              {!isHomepage && (
                <a href="/" className={navButtonStyles}>
                  <HomeIcon />
                  Home
                </a>
              )}
              <a href="/studio" className={navButtonStyles}>
                <WandIcon />
                Studio
              </a>
            </div>
          </div>

          {/* Hero content - centred tagline and subtitle */}
          <div className="mx-auto flex w-full max-w-4xl flex-col items-center px-4 pt-1 pb-1 text-center sm:px-6">
            <h2 className="mt-1 text-xl font-semibold leading-tight sm:text-2xl md:text-3xl">
              <span className="whitespace-nowrap bg-gradient-to-r from-sky-400 via-emerald-300 to-indigo-400 bg-clip-text text-transparent">
                Intelligent Prompt Builder
              </span>
            </h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-300 sm:text-base">
              <span className="whitespace-nowrap">
                Context-driven prompts built from live exchanges, FX, commodities, crypto & weather.
              </span>
            </p>

            {/* Soft market glow - reduced margin */}
            <div className="pointer-events-none mt-1 flex w-full justify-center">
              <div className="h-6 w-full max-w-md rounded-full bg-gradient-to-r from-sky-500/18 via-emerald-400/14 to-indigo-500/18 blur-2xl md:h-8" />
            </div>
          </div>
        </section>

        {/* Three-column market layout — reduced top padding (was pt-4, now pt-2) */}
        <section
          ref={containerRef}
          aria-label="Market overview layout"
          className="relative mx-auto flex min-h-0 w-full flex-1 flex-col gap-4 px-4 pb-2 pt-2 md:grid md:grid-cols-[minmax(0,0.9fr)_minmax(0,2.2fr)_minmax(0,0.9fr)] md:items-stretch md:gap-6 md:pt-2"
        >
          {/* Market Pulse v2.0 SVG Overlay - Flowing energy streams */}
          <MarketPulseOverlay
            containerRef={containerRef}
            leftRailRef={leftRef}
            rightRailRef={rightRef}
            providersRef={providersRef}
            selectedExchangeIds={selectedExchangeIds}
            displayedProviderIds={displayedProviderIds}
            pulseContexts={pulseContexts}
            activeExchangeIds={activeExchangeIds}
          />

          {/* Left rail (Eastern exchanges) — synced scroll */}
          <section
            role="complementary"
            aria-label="Eastern exchanges"
            className="flex min-h-0 flex-col rounded-3xl bg-slate-950/70 p-4 shadow-sm ring-1 ring-white/10"
            data-testid="rail-east-wrapper"
          >
            <div
              ref={leftRef}
              onScroll={handleLeftScroll}
              className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/20 hover:scrollbar-thumb-white/30"
              data-testid="rail-east"
            >
              {leftContent}
            </div>
          </section>

          {/* Centre column (Finance ribbon + Providers table) */}
          <div className="flex min-h-0 flex-1 flex-col gap-3" data-testid="rail-centre">
            {renderFinanceRibbon()}
            <div ref={providersRef} className="min-h-0 flex-1">
              {centre}
            </div>
          </div>

          {/* Right rail (Western exchanges) — synced scroll */}
          <section
            role="complementary"
            aria-label="Western exchanges"
            className="flex min-h-0 flex-col rounded-3xl bg-slate-950/70 p-4 shadow-sm ring-1 ring-white/10"
            data-testid="rail-west-wrapper"
          >
            <div
              ref={rightRef}
              onScroll={handleRightScroll}
              className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/20 hover:scrollbar-thumb-white/30"
              data-testid="rail-west"
            >
              {rightContent}
            </div>
          </section>
        </section>
      </main>

      {/* Footer - fixed height at bottom */}
      <div className="shrink-0 pb-2">
        <ProvenanceFooter />
      </div>
    </div>
  );
}
