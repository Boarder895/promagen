// src/components/layout/homepage-grid.tsx
// ============================================================================
// HOMEPAGE GRID - Three-column layout with Market Pulse v2.5
// ============================================================================
// Layout: Left rail | Centre (Finance ribbon + Providers) | Right rail
// Synchronized scrolling between exchange rails
// Market Pulse: Flowing energy streams connect exchanges to providers
// Auth: Sign in button in header (right), Home + Studio buttons below
//
// UPDATED v2.6: Two FX Ribbons (Crypto Removed)
// - Top FX ribbon: 5 pairs (EUR/USD, GBP/USD, GBP/ZAR, USD/CAD, USD/CNY)
// - Bottom FX ribbon: 5 pairs (USD/INR, USD/BRL, AUD/USD, USD/NOK, USD/MYR)
// - Crypto completely removed from codebase
//
// UPDATED v2.5: Studio sub-page support
// - Added isStudioSubPage prop to pass to Mission Control
// - Mission Control shows 4 buttons (Home | Studio | Pro | Sign in) on Studio sub-pages
// - All other functionality unchanged
// ============================================================================

'use client';

import React, { useRef, useCallback, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  FinanceRibbonTop,
  FinanceRibbonBottom,
} from '@/components/ribbon/finance-ribbon.container';
import CommoditiesMoversGrid from '@/components/ribbon/commodities-movers-grid.container';
// REMOVED: Crypto ribbon - no longer part of Promagen
import DemoFinanceRibbon from '@/components/ribbon/demo-finance-ribbon';
import ProvenanceFooter from '@/components/core/provenance-footer';
import ControlDock from '@/components/home/control-dock';
import type { Exchange } from '@/data/exchanges/types';
import type { ReferenceFrame } from '@/lib/location';
import type { FxPairCatalogEntry } from '@/lib/pro-promagen/types';
import { useMarketPulse } from '@/hooks/use-market-pulse';
import { MarketPulseOverlay } from '@/components/market-pulse';
import type { Provider } from '@/types/providers';
import type { ExchangeWeatherData } from '@/components/exchanges/types';

// ============================================================================
// PERF: Dynamic imports — defer heavy panels until JS idle
// ============================================================================
// EngineBay (30KB) and MissionControl (29KB) are absolutely positioned panels
// visible only on xl+ screens. Lazy-loading them removes ~60KB from the
// critical path and cuts ~80ms off TBT.
// ============================================================================

/** Skeleton matching EngineBay's approximate dimensions */
function EngineBaySkeleton(): JSX.Element {
  return (
    <div
      className="rounded-3xl bg-slate-950/70 ring-1 ring-white/10"
      style={{ height: '260px' }}
      aria-hidden="true"
    />
  );
}

/** Skeleton matching MissionControl's approximate dimensions */
function MissionControlSkeleton(): JSX.Element {
  return (
    <div
      className="rounded-3xl bg-slate-950/70 ring-1 ring-white/10"
      style={{ height: '320px' }}
      aria-hidden="true"
    />
  );
}

const EngineBay = dynamic(() => import('@/components/home/engine-bay'), {
  ssr: false,
  loading: () => <EngineBaySkeleton />,
});

const MissionControl = dynamic(() => import('@/components/home/mission-control'), {
  ssr: false,
  loading: () => <MissionControlSkeleton />,
});

// PERF (Phase 3): Lazy-load AuthButton to defer Clerk's SDK (~45KB)
// from the critical JS bundle. Most visitors are signed-out so this
// code only needs to run after initial paint.
const AuthButton = dynamic(() => import('@/components/auth/auth-button'), {
  ssr: false,
  loading: () => (
    <div
      className="h-[32px] w-[32px] rounded-full bg-slate-800/50 animate-pulse"
      aria-hidden="true"
    />
  ),
});

// ============================================================================
// ICONS (for fallback nav only)
// ============================================================================

function WandIcon(): React.ReactElement {
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

function HomeIcon(): React.ReactElement {
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

function ProIcon(): React.ReactElement {
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
  mainLabel: string;
  leftContent: ReactNode;
  centre: ReactNode;
  rightContent: ReactNode;
  showFinanceRibbon?: boolean;
  demoMode?: boolean;
  demoPairs?: FxPairCatalogEntry[];
  exchanges?: ReadonlyArray<Exchange>;
  displayedProviderIds?: string[];
  isPaidUser?: boolean;
  referenceFrame?: ReferenceFrame;
  onReferenceFrameChange?: (frame: ReferenceFrame) => void;
  isLocationLoading?: boolean;
  cityName?: string;
  countryCode?: string;
  isAuthenticated?: boolean;
  providers?: Provider[];
  showEngineBay?: boolean;
  showMissionControl?: boolean;
  weatherIndex?: Map<string, ExchangeWeatherData>;
  nearestExchangeId?: string;
  /** Hide the Control Dock (e.g., for pages that don't need it) */
  hideControlDock?: boolean;
  /** Hide the Commodities movers grid (e.g., library page uses full space for prompts) */
  hideCommodities?: boolean;
  /** When true, Mission Control shows Home button instead of Studio button */
  isStudioPage?: boolean;
  /** When true, Mission Control shows Home button instead of Pro button */
  isProPromagenPage?: boolean;
  /** When true, Mission Control shows 4 buttons: Home | Studio | Pro | Sign in */
  isStudioSubPage?: boolean;
};

// ============================================================================
// COMPONENT
// ============================================================================

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
  // countryCode - available in props but unused in this component
  isAuthenticated = false,
  providers = [],
  showEngineBay = false,
  showMissionControl = false,
  weatherIndex,
  nearestExchangeId,
  hideControlDock = false,
  hideCommodities = false,
  isStudioPage = false,
  isProPromagenPage = false,
  isStudioSubPage = false,
}: HomepageGridProps): React.ReactElement {
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const isSyncing = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const providersRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const isHomepage = pathname === '/';

  // --------------------------------------------------------------------------
  // SPEECH SYNTHESIS — British female voice with priority fallback
  // --------------------------------------------------------------------------
  const [isSpeaking, setIsSpeaking] = React.useState(false);

  const heroText =
    'Real context for real-world prompts. Explore cities around the world before you get there. Hover over any flag to reveal an intelligent prompt that evolves with live financial and environmental conditions. See which AI platform brings it to life best — ranked by the community in our live leaderboard. Or build your own prompts from a vast library of curated words and phrases, tailored instantly to your chosen AI platform.';

  const handleListenClick = useCallback(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    // If already speaking, stop
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(heroText);
    utterance.rate = 0.95;
    utterance.pitch = 1.0;

    // British female voice priority list
    const preferredVoices = [
      'Google UK English Female',
      'Martha',
      'Kate',
      'Microsoft Hazel',
      'Microsoft Susan',
      'Serena',
      'Daniel',
      'Google UK English Male',
    ];

    const pickVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      for (const name of preferredVoices) {
        const match = voices.find((v) => v.name.includes(name));
        if (match) return match;
      }
      // Fallback: any en-GB voice
      const gbVoice = voices.find((v) => v.lang.startsWith('en-GB'));
      if (gbVoice) return gbVoice;
      // Last resort: any English voice
      return voices.find((v) => v.lang.startsWith('en')) || null;
    };

    const setVoiceAndSpeak = () => {
      const voice = pickVoice();
      if (voice) utterance.voice = voice;
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      setIsSpeaking(true);
      window.speechSynthesis.speak(utterance);
    };

    // Voices may load async — handle both cases
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      setVoiceAndSpeak();
    } else {
      window.speechSynthesis.onvoiceschanged = () => {
        setVoiceAndSpeak();
        window.speechSynthesis.onvoiceschanged = null;
      };
    }
  }, [isSpeaking]);

  // Memoize onBurst to prevent infinite re-renders in useMarketPulse
  const handleMarketBurst = useCallback(
    (context: import('@/hooks/use-market-pulse').ExchangePulseContext) => {
      if (process.env.NODE_ENV === 'development') {
        console.debug('[market-pulse] Event:', context);
      }
    },
    [],
  );

  const { activeExchangeIds, pulseContexts } = useMarketPulse({
    exchanges: exchanges as Exchange[],
    onBurst: handleMarketBurst,
  });

  // Selected exchanges derived from active ones for now
  const selectedExchangeIds = activeExchangeIds;

  // ============================================================================
  // SYNCHRONIZED SCROLLING
  // ============================================================================

  const handleLeftScroll = useCallback(() => {
    if (isSyncing.current || !leftRef.current || !rightRef.current) return;

    isSyncing.current = true;
    const left = leftRef.current;
    const right = rightRef.current;

    const leftRatio = left.scrollTop / (left.scrollHeight - left.clientHeight || 1);
    right.scrollTop = leftRatio * (right.scrollHeight - right.clientHeight);

    requestAnimationFrame(() => {
      isSyncing.current = false;
    });
  }, []);

  const handleRightScroll = useCallback(() => {
    if (isSyncing.current || !leftRef.current || !rightRef.current) return;

    isSyncing.current = true;
    const left = leftRef.current;
    const right = rightRef.current;

    const rightRatio = right.scrollTop / (right.scrollHeight - right.clientHeight || 1);
    left.scrollTop = rightRatio * (left.scrollHeight - left.clientHeight);

    requestAnimationFrame(() => {
      isSyncing.current = false;
    });
  }, []);

  // ============================================================================
  // REFERENCE FRAME CHANGE HANDLER
  // ============================================================================

  const handleReferenceFrameChange = useCallback(
    (frame: ReferenceFrame) => {
      onReferenceFrameChange?.(frame);
    },
    [onReferenceFrameChange],
  );

  // ============================================================================
  // FINANCE RIBBON RENDERING
  // ============================================================================
  // v2.6: Two separate FX ribbons with commodities in between

  const renderFinanceRibbon = useCallback(() => {
    if (!showFinanceRibbon) return null;

    if (demoMode && demoPairs.length > 0) {
      return <DemoFinanceRibbon pairs={demoPairs} />;
    }

    // Layout order:
    // 1. Top FX ribbon (5 pairs)
    // 2. Commodities grid (unless hideCommodities is true)
    // 3. Bottom FX ribbon (5 pairs)
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <FinanceRibbonTop />
        {!hideCommodities && <CommoditiesMoversGrid />}
        <FinanceRibbonBottom />
      </div>
    );
  }, [showFinanceRibbon, demoMode, demoPairs, hideCommodities]);

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-slate-950">
      <main className="flex min-h-0 flex-1 flex-col">
        {/* Visually hidden heading for screen readers */}
        <h1 id="page-main-heading" className="sr-only">
          {mainLabel}
        </h1>

        {/* Hero section */}
        <section
          aria-label="Promagen overview"
          className="relative z-20 w-full shrink-0 border-b border-slate-900/70 bg-gradient-to-b from-slate-950 via-slate-950/95 to-slate-950"
        >
          {/* Header row */}
          <div className="relative mx-auto flex min-h-[30px] w-full items-start px-4 pt-1">
            {/* 
              ENGINE BAY v4.2.0 - Width LOCKED to exchange rail OUTER width
              Uses shared CSS variables for panel synchronization
            */}
            {showEngineBay && providers.length > 0 && (
              <div
                className="absolute left-4 top-4 z-20 hidden xl:block"
                style={{
                  width: 'calc((100vw - 80px) * 0.225)',
                }}
              >
                <EngineBay providers={providers} />
              </div>
            )}

            {/* PROMAGEN label removed — brand now in heading */}

            {/* 
              MISSION CONTROL v3.5.0 - Width LOCKED to exchange rail OUTER width
              Uses shared CSS variables for panel synchronization
              Now contains nav buttons (Studio/Home, Pro/Home, Sign in)
              NEW v2.3: isStudioPage prop swaps Studio button for Home button
              NEW v2.4: isProPromagenPage prop swaps Pro button for Home button
              NEW v2.5: isStudioSubPage prop enables 4-button layout
            */}
            {showMissionControl && (
              <div
                className="absolute right-4 top-4 z-20 hidden xl:block"
                style={{
                  width: 'calc((100vw - 80px) * 0.225)',
                }}
              >
                <MissionControl
                  providers={providers}
                  exchanges={exchanges}
                  weatherIndex={weatherIndex}
                  nearestExchangeId={nearestExchangeId}
                  isStudioPage={isStudioPage}
                  isProPromagenPage={isProPromagenPage}
                  isStudioSubPage={isStudioSubPage}
                />
              </div>
            )}

            {/* 
              Fallback nav buttons - ONLY shown when Mission Control is hidden
              This covers: mobile view, and when showMissionControl=false
              v2.4: Conditionally show Pro Promagen button (hidden on /pro-promagen page)
            */}
            {!showMissionControl && (
              <div className="absolute right-4 top-4 z-30 flex flex-col items-end gap-2">
                <AuthButton />
                {!isHomepage && (
                  <a href="/" className={navButtonStyles}>
                    <HomeIcon />
                    Home
                  </a>
                )}
                {!isStudioPage && !isStudioSubPage && (
                  <a href="/studio" className={navButtonStyles}>
                    <WandIcon />
                    Studio
                  </a>
                )}
                {!isProPromagenPage && (
                  <a href="/pro-promagen" className={navButtonStyles}>
                    <ProIcon />
                    Pro Promagen
                  </a>
                )}
              </div>
            )}
          </div>

          {/* 
            Hero content - Layout order:
            1. [Listen] Promagen — Intelligent Prompt Builder [Greenwich Meridian] (one row)
            2. Description text (amber, 4 sentences, centred below)
          */}
          <div className="mx-auto flex w-full flex-col items-center px-4 pt-1 pb-1.5 text-center">
            {/* Heading row — padded to align with Engine Bay + Mission Control inner edges */}
            <div
              className="flex w-full items-center"
              style={{
                paddingLeft: 'calc(16px + (100vw - 80px) * 0.225)',
                paddingRight: 'calc(16px + (100vw - 80px) * 0.225)',
              }}
            >
              {/* Left section — Listen button centered in this half */}
              <div className="flex flex-1 items-center justify-center">
                <button
                  onClick={handleListenClick}
                  className="inline-flex flex-shrink-0 items-center justify-center gap-1.5 rounded-full border px-3 py-1 text-[clamp(0.65rem,0.8vw,0.875rem)] font-medium shadow-sm transition-all focus-visible:outline-none focus-visible:ring focus-visible:ring-purple-400/80 border-purple-500/70 bg-gradient-to-r from-purple-600/20 to-pink-600/20 text-purple-100 hover:from-purple-600/30 hover:to-pink-600/30 hover:border-purple-400"
                  aria-label={isSpeaking ? 'Stop listening' : 'Listen to description'}
                  title={isSpeaking ? 'Stop' : 'Listen'}
                >
                  {isSpeaking ? (
                    <>
                      <svg
                        className="h-3.5 w-3.5 text-purple-300 animate-pulse"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <rect x="6" y="4" width="4" height="16" rx="1" />
                        <rect x="14" y="4" width="4" height="16" rx="1" />
                      </svg>
                      <span>Stop</span>
                    </>
                  ) : (
                    <>
                      <svg
                        className="h-3.5 w-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                        />
                      </svg>
                      <span>Listen</span>
                    </>
                  )}
                </button>
              </div>

              {/* Centre section — Heading */}
              <h2
                className="flex-shrink-0 font-semibold leading-tight"
                style={{ fontSize: 'clamp(0.9rem, 1.3vw, 2rem)' }}
              >
                <span className="whitespace-nowrap bg-gradient-to-r from-sky-400 via-emerald-300 to-indigo-400 bg-clip-text text-transparent">
                  Promagen — Intelligent Prompt Builder
                </span>
              </h2>

              {/* Right section — Greenwich Meridian centered in this half */}
              <div className="flex flex-1 items-center justify-center">
                {!hideControlDock ? (
                  <ControlDock
                    referenceFrame={referenceFrame}
                    onReferenceFrameChange={handleReferenceFrameChange}
                    isPaidUser={isPaidUser}
                    isAuthenticated={isAuthenticated}
                    isLocationLoading={isLocationLoading}
                    cityName={cityName}
                  />
                ) : (
                  <div />
                )}
              </div>
            </div>

            {/* Amber description — centred below heading row */}
            <p
              className="mt-2 max-w-2xl italic leading-relaxed text-amber-400/80"
              style={{ fontSize: 'clamp(0.8rem, 1vw, 1rem)' }}
            >
              Real context for real-world prompts. Explore cities around the world before you get
              there. Hover over any flag to reveal an intelligent prompt that evolves with live
              financial and environmental conditions. See which AI platform brings it to life best —
              ranked by the community in our live leaderboard. Or build your own prompts from a vast
              library of curated words and phrases, tailored instantly to your chosen AI platform.
            </p>
            <div className="pointer-events-none mt-0.5 flex w-full justify-center">
              <div className="h-3 w-full max-w-md rounded-full bg-gradient-to-r from-sky-500/18 via-emerald-400/14 to-indigo-500/18 blur-2xl md:h-4" />
            </div>
          </div>
        </section>

        {/* Three-column grid */}
        <section
          ref={containerRef}
          aria-label="Market overview layout"
          className="relative mx-auto flex min-h-0 w-full flex-1 flex-col gap-4 px-4 pb-2 pt-1 md:grid md:grid-cols-[minmax(0,0.9fr)_minmax(0,2.2fr)_minmax(0,0.9fr)] md:items-stretch md:gap-6 md:pt-1"
        >
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

          {/* Left rail */}
          <section
            role="complementary"
            aria-label="Eastern exchanges"
            className="flex min-h-0 flex-col rounded-3xl bg-slate-950/70 p-4 shadow-sm ring-1 ring-white/10 mt-16"
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

          {/* Centre column */}
          <div className="flex min-h-0 flex-1 flex-col gap-3" data-testid="rail-centre">
            {renderFinanceRibbon()}
            <div ref={providersRef} className="min-h-0 flex-1">
              {centre}
            </div>
          </div>

          {/* Right rail */}
          <section
            role="complementary"
            aria-label="Western exchanges"
            className="flex min-h-0 flex-col rounded-3xl bg-slate-950/70 p-4 shadow-sm ring-1 ring-white/10 mt-16"
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

      {/* Footer */}
      <div className="shrink-0 pb-2">
        <ProvenanceFooter />
      </div>
    </div>
  );
}
