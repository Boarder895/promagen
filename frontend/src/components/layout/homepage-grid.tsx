// src/components/layout/homepage-grid.tsx
// ============================================================================
// HOMEPAGE GRID - Fully unified three-column layout v3.4
// ============================================================================
// EVERYTHING lives inside one three-column CSS grid:
//   Left column:   Engine Bay → Exchange Rail (east) / Scene Starters (homepage)
//   Centre column: Hero Window → FX Ribbon → Providers/Table
//   Right column:  Mission Control → Exchange Rail (west) / Community Pulse (homepage)
//
// One GRID_GAP clamp() value controls ALL spacing — column gaps between
// left/centre/right AND vertical gaps between stacked panels within each
// column. Change any panel height and everything below flows naturally.
//
// UPDATED v3.4: Homepage hero cleanup
// - Listen button + amber intro text hidden on homepage (kept on World Context)
// - LeaderboardIntro exported; only rendered here on World Context
//   (homepage renders it in new-homepage-client.tsx centreRail instead)
// - Authority: docs/authority/homepage.md §3, §9.2
//
// UPDATED v3.2: ControlDock eliminated — components placed directly
// - ReferenceFrameToggle (Greenwich Meridian) imported directly
// - AuthButton (Sign In) imported directly from @/components/auth
// - Both sit in the Hero Window row right edge in a pill wrapper
// - Colour fix wrapper on AuthButton preserved from ControlDock
// - hideControlDock prop removed (was dead — no caller passed it)
// - ControlDock component is now unused by this file
//
// UPDATED v3.1: Hero Window
// - The hero section (heading, Listen, Greenwich Meridian, Sign In, description)
//   is no longer a full-width band outside the grid
// - It's now a styled panel (Hero Window) at the top of the centre column
// - Same visual treatment as Engine Bay and Mission Control
// - Fallback nav buttons sit inside Hero Window when MC is hidden
//
// UPDATED v3.0: Unified Grid Architecture
// - Engine Bay and Mission Control inside the grid (not absolute-positioned)
// - One clamp() gap controls all spacing
//
// UPDATED v2.6: Two FX Ribbons (Crypto Removed)
// UPDATED v2.5: Studio sub-page support
// ============================================================================

'use client';

import React, { useRef, useCallback, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import {
  FinanceRibbonTop,
  FinanceRibbonBottom,
} from '@/components/ribbon/finance-ribbon.container';
import CommoditiesMoversGrid from '@/components/ribbon/commodities-movers-grid.container';
// REMOVED: Crypto ribbon - no longer part of Promagen
import DemoFinanceRibbon from '@/components/ribbon/demo-finance-ribbon';
// ProvenanceFooter removed — build label no longer shown on homepage
import ReferenceFrameToggle from '@/components/reference-frame-toggle';
import { AuthButton } from '@/components/auth';
import type { Exchange } from '@/data/exchanges/types';
import type { ReferenceFrame } from '@/lib/location';
import type { FxPairCatalogEntry } from '@/lib/pro-promagen/types';
import { useMarketPulse } from '@/hooks/use-market-pulse';
import { MarketPulseOverlay } from '@/components/market-pulse';
import type { Provider } from '@/types/providers';
import type { ExchangeWeatherData } from '@/components/exchanges/types';
import { speakText, stopSpeaking } from '@/lib/speech';

// ============================================================================
// Engine Bay & Mission Control — Direct imports (no skeleton flash)
// ============================================================================
// Previously lazy-loaded via dynamic() with ssr:false to save ~60KB on the
// critical path. This caused a visible 2-3s skeleton placeholder before
// content appeared — looked broken on xl+ screens. Direct imports trade a
// small bundle increase for immediate, flicker-free rendering.
// ============================================================================

import EngineBay from '@/components/home/engine-bay';
import MissionControl from '@/components/home/mission-control';
import { ProGemBadge } from '@/components/layout/pro-gem-badge';

// AuthButton: Imported directly from @/components/auth (no longer lazy-loaded separately)

// ============================================================================
// ICONS (for fallback nav only)
// ============================================================================

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

function GlobeIcon(): React.ReactElement {
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
        d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 003 12c0-1.605.42-3.113 1.157-4.418"
      />
    </svg>
  );
}

function BookmarkIcon(): React.ReactElement {
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
        d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z"
      />
    </svg>
  );
}

// ============================================================================
// SHARED STYLES
// ============================================================================

const navButtonStyles =
  'inline-flex items-center justify-center gap-2 rounded-full border border-purple-500/70 bg-gradient-to-r from-purple-600/20 to-pink-600/20 px-4 py-1.5 text-sm font-medium text-purple-100 shadow-sm transition-all hover:from-purple-600/30 hover:to-pink-600/30 hover:border-purple-400 focus-visible:outline-none focus-visible:ring focus-visible:ring-purple-400/80 cursor-pointer';

// ============================================================================
// SHARED GRID GAP — Single source of truth for all grid spacing
// ============================================================================
// One clamp() value controls:
//   • column-gap between left/centre/right columns
//   • vertical gap between Engine Bay/Mission Control and exchanges below
// This ensures perfect symmetry on both sides at every screen width.
// Min 12px (small xl screens) → scales with viewport → max 24px (large screens)
// ============================================================================
const GRID_GAP = 'clamp(12px, 1.25vw, 24px)';

const MOBILE_HOMEPAGE_STYLES = `
  @media (prefers-reduced-motion: no-preference) {
    @keyframes promagenMobileAmberPulse {
      0%, 100% {
        opacity: 0.72;
        filter: brightness(1);
      }
      50% {
        opacity: 1;
        filter: brightness(1.18);
      }
    }

    .promagen-mobile-home-note {
      animation: promagenMobileAmberPulse 1.8s ease-in-out infinite;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .promagen-mobile-home-note {
      animation: none;
    }
  }
`;

/** Stable empty arrays — prevents new reference on every render when props are omitted */
const EMPTY_EXCHANGES: ReadonlyArray<Exchange> = [];
const EMPTY_DEMO_PAIRS: FxPairCatalogEntry[] = [];
const EMPTY_PROVIDER_IDS: string[] = [];
const EMPTY_PROVIDERS: Provider[] = [];

// ============================================================================
// TYPES
// ============================================================================

export type HomepageGridProps = {
  mainLabel: string;
  /** Override the centre heading text (default: "Promagen — Intelligent Prompt Builder") */
  headingText?: string;
  /** Override the Listen button speech text (default: page-specific from pathname detection) */
  heroTextOverride?: string;
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
  /** Whether the providers table is in expanded (full-height) mode */
  isTableExpanded?: boolean;
  /** Callback to toggle table expand/collapse — same handler as Provider column header */
  onExpandToggle?: () => void;
  /** Hide the Commodities movers grid (e.g., library page uses full space for prompts) */
  hideCommodities?: boolean;
  /** When true, Mission Control shows Home button instead of Studio button */
  isStudioPage?: boolean;
  /** When true, Mission Control shows Home button instead of Pro button */
  isProPromagenPage?: boolean;
  /** When true, Mission Control shows 3 buttons: Home | Studio | Pro */
  isStudioSubPage?: boolean;
  /** When true, Mission Control shows 3 buttons: Home | World Context | Pro (no My Prompts self-link) */
  isMyPromptsPage?: boolean;
  /** Controlled provider selection from Engine Bay (lifted state) */
  selectedProvider?: import('@/types/providers').Provider | null;
  /** Callback when user selects/deselects a provider in Engine Bay */
  onProviderChange?: (provider: import('@/types/providers').Provider | null) => void;
  /** Override left rail panel className (default: standard ring-white/10 panel) */
  leftRailClassName?: string;
  /** Override right rail panel className (default: standard ring-white/10 panel) */
  rightRailClassName?: string;
};

// ============================================================================
// LEADERBOARD INTRO — Gradient heading + clickable expand trigger
// ============================================================================
// Replicates ExpandHeader animation from providers-table.tsx:
//   - Arrow colours: idle purple → hover slate → expanded cyan
//   - 2s transition on colour/transform/filter
//   - expandArrowPulse 1.5s infinite (keyframes in globals.css)
//   - rotate(180deg) + cyan drop-shadow when expanded
// Text gradient matches "Promagen — Intelligent Prompt Builder" heading.
// ============================================================================

const INTRO_ARROW_COLOUR = 'rgba(168, 85, 247, 0.5)';
const INTRO_ARROW_HOVER = 'rgba(148, 163, 184, 0.9)';
const INTRO_ARROW_ACTIVE = 'rgba(34, 211, 238, 1)';
const INTRO_TRANSITION = '2s';

export function LeaderboardIntro({
  isExpanded,
  onToggle,
  activeTierId,
  tierFilter,
  onClearFilter,
  highlightCount,
  onActivateFilter,
}: {
  isExpanded: boolean;
  onToggle?: () => void;
  /** Active tier from showcase — drives accent colour (1-4, default 1) */
  activeTierId?: number;
  /** Currently active tier filter (null = showing all 40) */
  tierFilter?: number | null;
  /** Clear the active filter */
  onClearFilter?: () => void;
  /** Number of platforms in the highlighted tier */
  highlightCount?: number;
  /** Activate the filter for the highlighted tier */
  onActivateFilter?: () => void;
}) {
  const [hovered, setHovered] = React.useState(false);
  const [filterHovered, setFilterHovered] = React.useState(false);

  // Tier accent colour for the heading underline
  const tierColours: Record<number, string> = {
    1: '#8B5CF6',
    2: '#3B82F6',
    3: '#10B981',
    4: '#F59E0B',
  };
  const tierLabels: Record<number, string> = {
    1: 'CLIP-Based',
    2: 'Midjourney',
    3: 'Natural Language',
    4: 'Plain Language',
  };
  const accentColour = tierColours[activeTierId ?? 1] ?? tierColours[1];

  const arrowStyle: React.CSSProperties = {
    display: 'inline',
    color: isExpanded ? INTRO_ARROW_ACTIVE : hovered ? INTRO_ARROW_HOVER : INTRO_ARROW_COLOUR,
    transition: `color ${INTRO_TRANSITION} ease, transform ${INTRO_TRANSITION} ease, filter ${INTRO_TRANSITION} ease`,
    transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
    filter: isExpanded
      ? 'drop-shadow(0 0 4px rgba(34, 211, 238, 0.5)) drop-shadow(0 0 8px rgba(34, 211, 238, 0.3))'
      : 'none',
    animation: 'expandArrowPulse 1.5s ease-in-out infinite',
  };

  const isFiltered = tierFilter != null && tierFilter > 0;
  const filterColour = isFiltered ? (tierColours[tierFilter] ?? tierColours[1]) : undefined;
  const filterLabel = isFiltered ? (tierLabels[tierFilter] ?? '') : '';

  return (
    <div
      className="flex shrink-0 flex-col items-center text-center"
      style={{ margin: 'clamp(-6px, -0.625vw, -12px) 0' }}
    >
      {/* Line 1 — Static gradient heading + tier accent */}
      <span
        className="pointer-events-none font-semibold leading-tight"
        style={{ fontSize: 'clamp(0.65rem, 0.9vw, 1.2rem)' }}
      >
        <span className="whitespace-nowrap bg-gradient-to-r from-sky-400 via-emerald-300 to-indigo-400 bg-clip-text text-transparent">
          40 AI Image Generators — Elo-Ranked by the Community
        </span>
      </span>
      {/* Tier accent underline — colour follows active showcase tier */}
      <div
        style={{
          height: '2px',
          width: 'clamp(60px, 8vw, 120px)',
          background: accentColour,
          borderRadius: '1px',
          margin: 'clamp(2px, 0.2vw, 4px) auto 0',
          transition: 'background 400ms ease',
          opacity: 0.7,
        }}
        aria-hidden="true"
      />

      {/* Line 2 — Two states only:
           A) Filter active → filter label + count + Clear
           B) No filter → "Click ▼ Provider to expand" + optional filter prompt */}
      {isFiltered ? (
        /* State A: Active filter — clicking clears it, "Click ▼" returns */
        <button
          type="button"
          onClick={onClearFilter}
          className="mt-0.5 cursor-pointer border-none bg-transparent font-semibold uppercase leading-tight"
          style={{
            fontSize: 'clamp(0.6875rem, 0.9vw, 0.875rem)',
            letterSpacing: '0.05em',
            color: 'rgba(148, 163, 184, 1)',
            transition: 'color 0.2s ease',
          }}
          aria-label={`Clear ${filterLabel} filter, show all 40 platforms`}
        >
          <span className="whitespace-nowrap">
            <span style={{ color: filterColour }}>{filterLabel}</span>
            <span className="text-slate-500"> · </span>
            <span>{highlightCount ?? 0} of 40</span>
            <span className="text-slate-500"> · </span>
            <span className="hover:text-white transition-colors">Clear</span>
          </span>
        </button>
      ) : (
        /* State B: No filter — show expand instruction + optional filter prompt */
        <div
          className="mt-0.5 flex items-center justify-center"
          style={{ gap: 'clamp(4px, 0.4vw, 8px)' }}
        >
          <button
            type="button"
            onClick={onToggle}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            className="cursor-pointer border-none bg-transparent font-semibold uppercase leading-tight"
            style={{
              fontSize: 'clamp(0.6875rem, 0.9vw, 0.875rem)',
              letterSpacing: '0.05em',
              color: hovered ? 'rgba(226, 232, 240, 1)' : 'rgba(148, 163, 184, 1)',
              transition: 'color 0.2s ease',
            }}
            aria-label={
              isExpanded
                ? 'Collapse table, show finance ribbon'
                : 'Expand table, hide finance ribbon'
            }
            title={isExpanded ? 'Show FX & commodities' : 'Expand leaderboard'}
          >
            <span className="whitespace-nowrap">
              Click <span style={arrowStyle}>▼</span> Provider to expand
            </span>
          </button>
          {/* Filter prompt — appears alongside when tier is highlighted */}
          {activeTierId && highlightCount && highlightCount > 0 && (
            <button
              type="button"
              onClick={onActivateFilter}
              onMouseEnter={() => setFilterHovered(true)}
              onMouseLeave={() => setFilterHovered(false)}
              className="cursor-pointer border-none bg-transparent font-semibold uppercase leading-tight"
              style={{
                fontSize: 'clamp(0.6875rem, 0.9vw, 0.875rem)',
                letterSpacing: '0.05em',
                color: 'rgba(148, 163, 184, 1)',
                transition: 'color 0.2s ease, filter 0.2s ease',
              }}
              aria-label={`Filter to ${tierLabels[activeTierId]} platforms`}
            >
              <span className="whitespace-nowrap">
                <span className="text-slate-500">·</span>{' '}
                <span
                  style={{
                    color: tierColours[activeTierId],
                    filter: filterHovered
                      ? `drop-shadow(0 0 4px ${tierColours[activeTierId]}) brightness(1.4)`
                      : 'none',
                    transition: 'filter 0.2s ease',
                  }}
                >
                  Filter: {tierLabels[activeTierId]} ({highlightCount})
                </span>
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function HomepageGrid({
  mainLabel,
  headingText,
  heroTextOverride,
  leftContent,
  centre,
  rightContent,
  showFinanceRibbon = false,
  demoMode = false,
  demoPairs = EMPTY_DEMO_PAIRS,
  exchanges = EMPTY_EXCHANGES,
  displayedProviderIds = EMPTY_PROVIDER_IDS,
  isPaidUser = false,
  referenceFrame = 'greenwich',
  onReferenceFrameChange,
  isLocationLoading = false,
  cityName,
  // countryCode - available in props but unused in this component
  isAuthenticated = false,
  providers = EMPTY_PROVIDERS,
  showEngineBay = false,
  showMissionControl = false,
  weatherIndex,
  nearestExchangeId,
  hideCommodities = false,
  isTableExpanded = false,
  onExpandToggle,
  isStudioPage = false,
  isProPromagenPage = false,
  isStudioSubPage = false,
  isMyPromptsPage = false,
  selectedProvider,
  onProviderChange,
  leftRailClassName,
  rightRailClassName,
}: HomepageGridProps): React.ReactElement {
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const isSyncing = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const providersRef = useRef<HTMLDivElement>(null);

  const pathname = usePathname();
  const isHomepage = pathname === '/';
  const isWorldContext = pathname === '/world-context';
  const isLibrary = pathname === '/studio/library';

  // --------------------------------------------------------------------------
  // SPEECH SYNTHESIS — British female voice (shared utility)
  // --------------------------------------------------------------------------
  const [isSpeaking, setIsSpeaking] = React.useState(false);

  const heroText = heroTextOverride
    ? heroTextOverride
    : isLibrary
      ? "Every prompt you've saved lives right here. Pick one, load it into the builder, reformat it for any platform. This is your collection — the prompts that caught your eye."
      : isWorldContext
        ? "Every country flag on this page hides a surprise — hover over one and you'll see a live AI image prompt, crafted from the real weather happening in that city right now. The commodities tell visual stories too. Everything you see is live, and every prompt works across all 40 AI platforms."
        : isProPromagenPage
          ? "You've seen what the free view can do. Pro gives you the keys — pick your exchanges, choose your tier, make it yours."
          : "That prompt in the centre rewrites itself every few minutes — a new city, real weather, a completely new scene. You'll never see the same one twice. And those colours aren't random.";

  const handleListenClick = useCallback(() => {
    if (isSpeaking) {
      stopSpeaking();
      setIsSpeaking(false);
      return;
    }
    speakText(heroText, {
      onStart: () => setIsSpeaking(true),
      onEnd: () => setIsSpeaking(false),
    });
  }, [isSpeaking, heroText]);

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
    // 1. Top FX ribbon (5 pairs) — with city-vibes tooltips on flags
    // 2. Commodities grid (unless hideCommodities is true)
    // 3. Bottom FX ribbon (5 pairs) — with city-vibes tooltips on flags
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <FinanceRibbonTop weatherIndex={weatherIndex} />
        {!hideCommodities && <CommoditiesMoversGrid />}
        <FinanceRibbonBottom weatherIndex={weatherIndex} />
      </div>
    );
  }, [showFinanceRibbon, demoMode, demoPairs, hideCommodities, weatherIndex]);

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="flex h-full flex-col overflow-hidden bg-slate-950">
      <main className="flex min-h-0 flex-1 flex-col">
        {/* Visually hidden heading for screen readers */}
        <h1 id="page-main-heading" className="sr-only">
          {mainLabel}
        </h1>

        {/* ================================================================
            UNIFIED THREE-COLUMN GRID — Single source of truth
            ================================================================
            Everything lives inside this grid:
              Left column:   Engine Bay → Exchange Rail (east)
              Centre column: Hero Window → FX Ribbon → Providers/Table
              Right column:  Mission Control → Exchange Rail (west)

            One GRID_GAP clamp() value controls ALL spacing — column gaps
            and vertical gaps between stacked panels. Change any panel
            height and everything below flows naturally.
            ================================================================ */}
        <section
          ref={containerRef}
          aria-label="Market overview layout"
          className="relative mx-auto flex min-h-0 w-full flex-1 flex-col px-4 pb-2 pt-2 md:grid md:grid-cols-[minmax(0,0.9fr)_minmax(0,2.2fr)_minmax(0,0.9fr)] md:items-stretch md:pt-2"
          style={{ gap: GRID_GAP }}
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

          {/* ============================================================
              LEFT COLUMN — Engine Bay + Eastern Exchanges
              ============================================================ */}
          <div className="hidden min-h-0 flex-col md:flex" style={{ gap: GRID_GAP }}>
            {/* Engine Bay — xl+ only, inherits exact column width from grid */}
            {showEngineBay && providers.length > 0 && (
              <div className="hidden shrink-0 xl:block">
                <EngineBay
                  providers={providers}
                  selectedProvider={selectedProvider}
                  onProviderChange={onProviderChange}
                />
              </div>
            )}

            {/* Exchange rail */}
            <section
              role="complementary"
              aria-label="Eastern exchanges"
              className={leftRailClassName ?? "flex min-h-0 flex-1 flex-col rounded-3xl bg-slate-950/70 p-4 shadow-sm ring-1 ring-white/10"}
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
          </div>

          {/* ============================================================
              CENTRE COLUMN — Hero Window → FX Ribbon → Providers/Table
              ============================================================ */}
          <div
            className="flex min-h-0 flex-1 flex-col"
            style={{ gap: GRID_GAP }}
            data-testid="rail-centre"
          >
            {/* ----------------------------------------------------------
                HERO WINDOW — Promagen branding, Listen, Greenwich
                Meridian, Sign In. Same panel styling as Engine Bay
                and Mission Control.
                ---------------------------------------------------------- */}
            <div
              className="shrink-0 bg-transparent shadow-none ring-0 md:rounded-3xl md:bg-slate-950/70 md:shadow-sm md:ring-1 md:ring-white/10"
              style={{ padding: 'clamp(8px, 2.8vw, 16px)' }}
              data-testid="hero-window"
            >
              <style dangerouslySetInnerHTML={{ __html: MOBILE_HOMEPAGE_STYLES }} />

              {/* ── MOBILE HEADER — All pages, <768px only ─────────────── */}
              <div className="md:hidden">
                <div className="flex items-center justify-between">
                  <div style={{ width: '1px' }} />
                  <div className="[&_button]:!text-white [&_a]:!text-white [&_svg]:!text-white [&_span]:!text-white">
                    <AuthButton />
                  </div>
                </div>

                <div className="mt-2 text-center">
                  <h2
                    className="font-semibold leading-tight"
                    style={{ fontSize: 'clamp(1.05rem, 4.2vw, 1.4rem)' }}
                  >
                    <span className="bg-gradient-to-r from-sky-400 via-emerald-300 to-indigo-400 bg-clip-text text-transparent">
                      {headingText ?? 'Promagen — Intelligent Prompt Builder'}
                    </span>
                  </h2>
                </div>
              </div>

              {/* ── DESKTOP HEADER — ≥768px only ──────────────────────── */}
              <div className="hidden md:block">
              {/* Row 1: Listen (left edge) | Heading (dead centre) | Greenwich Meridian + Sign In (right edge) */}
              <div className="relative flex w-full items-center">
                {/* Left edge — Listen button (all pages) */}
                <button
                  onClick={handleListenClick}
                  className="inline-flex flex-shrink-0 items-center justify-center gap-1.5 rounded-full border px-3 py-1 text-[clamp(0.4rem,0.5vw,0.8rem)] font-medium shadow-sm transition-all focus-visible:outline-none focus-visible:ring focus-visible:ring-purple-400/80 border-purple-500/70 bg-gradient-to-r from-purple-600/20 to-pink-600/20 text-purple-100 hover:from-purple-600/30 hover:to-pink-600/30 hover:border-purple-400"
                  aria-label={isSpeaking ? 'Stop listening' : 'Listen to description'}
                  title={isSpeaking ? 'Stop' : 'Listen'}
                >
                  {isSpeaking ? (
                    <>
                      <svg
                        className="h-3 w-3 text-purple-300 animate-pulse"
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
                        className="h-3 w-3"
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

                {/* Pro badge — evolving gem for paid users, sits right of Listen */}
                {isPaidUser && <ProGemBadge />}

                {/* Dead centre — Heading (absolute so left/right content can't push it off-centre) */}
                <h2
                  className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-semibold leading-tight text-center"
                  style={{ fontSize: 'clamp(0.75rem, 1.1vw, 2rem)' }}
                >
                  {(headingText ?? 'Promagen — Intelligent Prompt Builder')
                    .split('\n')
                    .map((line, idx, arr) => (
                      <span
                        key={idx}
                        className="bg-gradient-to-r from-sky-400 via-emerald-300 to-indigo-400 bg-clip-text text-transparent"
                        style={
                          arr.length === 1
                            ? { whiteSpace: 'nowrap' }
                            : { display: 'block', whiteSpace: 'nowrap' }
                        }
                      >
                        {line}
                      </span>
                    ))}
                </h2>

                {/* Right edge — Greenwich Meridian + Sign In (same pill styling as former ControlDock) */}
                <div className="ml-auto inline-flex flex-shrink-0 items-center justify-center gap-2 rounded-full border border-purple-500/30 bg-slate-900/40 px-1.5 py-1 shadow-lg shadow-purple-900/10 backdrop-blur-sm">
                  {/* Greenwich Meridian toggle */}
                  <ReferenceFrameToggle
                    referenceFrame={referenceFrame}
                    onReferenceFrameChange={handleReferenceFrameChange}
                    isPaidUser={isPaidUser}
                    isAuthenticated={isAuthenticated}
                    isLocationLoading={isLocationLoading}
                    cityName={cityName}
                  />

                  {/* Sign In / User avatar
                      COLOUR FIX (buttons.md §1.1): body { color: #020617 } causes all
                      children to inherit slate-950. Must force white on every child type:
                      button/a (container), svg (icon via stroke=currentColor), span (text) */}
                  <div className="[&_button]:!text-white [&_a]:!text-white [&_svg]:!text-white [&_span]:!text-white">
                    <AuthButton />
                  </div>
                </div>
              </div>

              {/* Glow accent — matches original */}
              <div className="pointer-events-none mt-1 flex w-full justify-center">
                <div className="h-2 w-full max-w-sm rounded-full bg-gradient-to-r from-sky-500/18 via-emerald-400/14 to-indigo-500/18 blur-xl" />
              </div>

              {/* Fallback nav row — shown when Mission Control is hidden (smaller screens / MC disabled)
                  v5.0.0: Added World Context link (homepage.md §9.2) */}
              {!showMissionControl && (
                <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
                  {!isHomepage && (
                    <a href="/" className={navButtonStyles}>
                      <HomeIcon />
                      Home
                    </a>
                  )}
                  {!isWorldContext && (
                    <a href="/world-context" className={navButtonStyles}>
                      <GlobeIcon />
                      World Context
                    </a>
                  )}
                  {!isMyPromptsPage && (
                    <a href="/studio/library" className={navButtonStyles}>
                      <BookmarkIcon />
                      My Prompts
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
            </div>

            {/* FX Ribbon(s) + Commodities */}
            {renderFinanceRibbon()}

            {/* ============================================================
                LEADERBOARD INTRO — Centred between bottom FX and table
                ============================================================
                Line 1: Static gradient text (matches "Promagen — Intelligent Prompt Builder")
                Line 2: Clickable — fires same onExpandToggle as Provider column header
                Arrow replicates ExpandHeader animation from providers-table.tsx
                Hidden when table is expanded (ribbon is gone, no gap to fill)
                ============================================================ */}
            {!isTableExpanded && isWorldContext && (
              <LeaderboardIntro isExpanded={isTableExpanded} onToggle={onExpandToggle} />
            )}

            {/* Providers table / Comparison table / Centre content */}
            <div ref={providersRef} className="min-h-0 flex-1">
              {centre}
            </div>
          </div>

          {/* ============================================================
              RIGHT COLUMN — Mission Control + Western Exchanges
              ============================================================ */}
          <div className="hidden min-h-0 flex-col md:flex" style={{ gap: GRID_GAP }}>
            {/* Mission Control — xl+ only, inherits exact column width from grid */}
            {showMissionControl && (
              <div className="hidden shrink-0 xl:block">
                <MissionControl
                  providers={providers}
                  exchanges={exchanges}
                  weatherIndex={weatherIndex}
                  nearestExchangeId={nearestExchangeId}
                  isStudioPage={isStudioPage}
                  isProPromagenPage={isProPromagenPage}
                  isStudioSubPage={isStudioSubPage}
                  isMyPromptsPage={isMyPromptsPage}
                  isWorldContextPage={isWorldContext}
                />
              </div>
            )}

            {/* Exchange rail */}
            <section
              role="complementary"
              aria-label="Western exchanges"
              className={rightRailClassName ?? "flex min-h-0 flex-1 flex-col rounded-3xl bg-slate-950/70 p-4 shadow-sm ring-1 ring-white/10"}
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
          </div>
        </section>
      </main>

    </div>
  );
}
