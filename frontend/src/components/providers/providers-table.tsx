// src/components/providers/providers-table.tsx
// Updated: January 2026 - Added image quality vote button
// Updated: January 2026 - Replaced Visual Styles with Support column (social icons)
// Updated: 20 Jan 2026 - Added fixed column widths (w-[Xpx] min-w-[Xpx]) to prevent layout shift
//                      - Added table-fixed class for consistent column sizing
// Updated: 22 Jan 2026 - Added vertical grid lines between columns
//                      - Centred header text for all columns
//                      - Removed API/Affiliate column (emojis moved to Provider cell)
//                      - Table now has 5 columns instead of 6
// Updated: 22 Jan 2026 - Switched from fixed px widths to proportional % widths
//                      - Enables fluid auto-scaling on large screens
//                      - Added mobile card view for small screens
// Updated: 22 Jan 2026 - Professional sortable headers with always-visible arrows
//                      - Underline on hover, glow on active
//                      - Bloomberg-style sort indicators
// Updated: 22 Jan 2026 - BUGFIX: Fixed inverted sort direction
//                      - 'desc' now correctly shows highest scores first
//                      - Separate dir calculation for score vs imageQuality
// Updated: 27 Jan 2026 - Replaced "Overall Score" column with "Index Rating"
//                      - Integrated IndexRatingCell component for live ratings
//                      - Added client-side fetching of Index Rating data
//                      - Sorting now uses Index Rating instead of static score
// Updated: 27 Jan 2026 - Added hasRankUp prop to ProviderCell for green arrow display
//                      - Added isUnderdog/isNewcomer calculation from market-power.json
//                      - Imported market power data and MPI calculation

"use client";

import React, { useState, useEffect, useRef } from "react";
import type { Provider } from "@/types/provider";
import type {
  ProviderRating,
  DisplayRating,
  RatingChangeState,
} from "@/types/index-rating";
import { DISPLAY_INFLATION_OFFSET } from "@/types/index-rating";
import { ProviderCell } from "./provider-cell";
import { ImageQualityVoteButton } from "./image-quality-vote-button";
import { SupportIconsCell } from "./support-icons-cell";
import { IndexRatingCell } from "./index-rating-cell";
import { Flag } from "@/components/ui/flag";
import Tooltip from "@/components/ui/tooltip";
import { getPlatformTierId, type PlatformTierId } from "@/data/platform-tiers";
import type { WeatherData } from "@/hooks/use-weather";

// Market power data for MPI calculation
import marketPowerData from "@/data/providers/market-power.json";
import { calculateMPI } from "@/lib/index-rating/calculations";
import type { MarketPowerData, ProviderMarketPower } from "@/lib/index-rating";

// Cast market power data to typed version
const typedMarketPowerData = marketPowerData as MarketPowerData;

export type ProvidersTableProps = {
  providers: ReadonlyArray<Provider>;
  title?: string;
  caption?: string;
  limit?: number;
  showRank?: boolean; // Kept for backwards compatibility (no longer used)
  /** Whether user is authenticated (required for voting) */
  isAuthenticated?: boolean;
  /** Optional callback to register provider IDs for market pulse */
  onProvidersChange?: (providerIds: string[]) => void;
  /** Whether the table is in expanded (full-centre) mode */
  isExpanded?: boolean;
  /** Callback to toggle expanded mode */
  onExpandToggle?: () => void;
  /** Weather data map from useWeather() — enables provider flag weather tooltips */
  weatherMap?: Record<string, WeatherData>;
  /** Whether user is Pro (for tooltip badge) */
  isPro?: boolean;
  /** Active tier from showcase — highlights matching provider rows */
  highlightTierId?: number;
  /** Active tier filter from parent — filters table to show only matching platforms */
  tierFilter?: PlatformTierId | null;
};

type PromagenUsersCountryUsage = {
  countryCode: string;
  count: number;
};

type ProviderWithExtras = Provider & {
  promagenUsers?: ReadonlyArray<PromagenUsersCountryUsage>;
  visibleUsers?: PromagenUsersCountryUsage[];
  visibleFlagCount?: number;
  indexRating?: DisplayRating;
};

type SortColumn = "indexRating" | "imageQuality";
type SortDirection = "asc" | "desc";

// =============================================================================
// MARKET POWER HELPERS
// =============================================================================

/**
 * Calculate if provider is an underdog (MPI < 3.0)
 */
function isProviderUnderdog(providerId: string): boolean {
  const marketPower = typedMarketPowerData.providers || {};
  const providerData = marketPower[providerId] as
    | ProviderMarketPower
    | undefined;

  if (!providerData) {
    // Unknown provider — default MPI is 3.0, so NOT underdog
    return false;
  }

  const mpi = calculateMPI(providerData);
  return mpi < 3.0;
}

/**
 * Calculate if provider is a newcomer (founded < 12 months ago)
 */
function isProviderNewcomer(providerId: string): boolean {
  const marketPower = typedMarketPowerData.providers || {};
  const providerData = marketPower[providerId] as
    | ProviderMarketPower
    | undefined;

  if (!providerData || !providerData.foundingYear) {
    return false;
  }

  const currentYear = new Date().getFullYear();
  const providerAge = currentYear - providerData.foundingYear;

  // Newcomer = less than 1 year old (founded this year or last year within 12 months)
  // For simplicity, we check if founded in current year
  return providerAge < 1;
}

// =============================================================================
// INDEX RATING HELPERS
// =============================================================================

/**
 * Fetch Index Ratings from API for given provider IDs
 */
async function fetchIndexRatings(
  providerIds: string[],
): Promise<Map<string, ProviderRating>> {
  try {
    const response = await fetch("/api/index-rating/ratings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ providerIds }),
    });

    if (!response.ok) {
      console.warn(
        "[ProvidersTable] Failed to fetch index ratings:",
        response.status,
      );
      return new Map();
    }

    const data = await response.json();
    const ratings = new Map<string, ProviderRating>();

    if (data.ratings && typeof data.ratings === "object") {
      for (const [id, rating] of Object.entries(data.ratings)) {
        ratings.set(id, rating as ProviderRating);
      }
    }

    return ratings;
  } catch (error) {
    console.error("[ProvidersTable] Error fetching index ratings:", error);
    return new Map();
  }
}

/**
 * Convert database rating to display rating
 */
function toDisplayRating(
  provider: Provider,
  dbRating: ProviderRating | undefined,
): DisplayRating {
  const providerId = provider.id.toLowerCase();

  if (dbRating) {
    // Determine state from changePercent
    let state: "gain" | "loss" | "flat" | "fallback" = "flat";
    if (dbRating.changePercent > 0.1) {
      state = "gain";
    } else if (dbRating.changePercent < -0.1) {
      state = "loss";
    }

    // Check for recent rank up (within 24 hours)
    const hasRankUp = dbRating.rankChangedAt
      ? Date.now() - new Date(dbRating.rankChangedAt).getTime() <
        24 * 60 * 60 * 1000
      : false;

    // Calculate underdog/newcomer from market power data
    const isUnderdog = isProviderUnderdog(providerId);
    const isNewcomer = isProviderNewcomer(providerId);

    return {
      rating: dbRating.currentRating + DISPLAY_INFLATION_OFFSET,
      change: dbRating.change,
      changePercent: dbRating.changePercent,
      state,
      source: "database",
      rank: dbRating.currentRank,
      hasRankUp,
      isUnderdog,
      isNewcomer,
    };
  }

  // Fallback: use static score × 20 + display inflation (or null if no score)
  return {
    rating:
      typeof provider.score === "number"
        ? provider.score * 20 + DISPLAY_INFLATION_OFFSET
        : null,
    change: null,
    changePercent: null,
    state: "fallback",
    source: "fallback",
    rank: null,
    hasRankUp: false,
    isUnderdog: isProviderUnderdog(providerId),
    isNewcomer: isProviderNewcomer(providerId),
  };
}

// =============================================================================
// EXPAND HEADER COMPONENT (Provider column toggle)
// =============================================================================
// All styles inline — no globals.css dependency.
// To change arrow colour: edit ARROW_COLOUR / ARROW_ACTIVE_COLOUR below.
// To change transition speed: edit TRANSITION_SPEED.
// =============================================================================

const ARROW_COLOUR = "rgba(168, 85, 247, 0.5)"; // idle: dim slate
const ARROW_HOVER_COLOUR = "rgba(148, 163, 184, 0.9)"; // hover: brighter slate
const ARROW_ACTIVE_COLOUR = "rgba(34, 211, 238, 1)"; // expanded: cyan-400
const UNDERLINE_COLOUR = "rgba(34, 211, 238, 0.6)"; // underline sweep
const UNDERLINE_ACTIVE = "rgba(34, 211, 238, 0.8)"; // underline when expanded
const LABEL_GLOW = "rgba(34, 211, 238, 0.3)"; // label text-shadow
const TRANSITION_SPEED = "2s"; // arrow rotation/colour speed

function ExpandHeader({
  isExpanded,
  onToggle,
}: {
  isExpanded: boolean;
  onToggle?: () => void;
}) {
  const [hovered, setHovered] = React.useState(false);

  const buttonStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.5rem",
    width: "100%",
    padding: "0.75rem 1rem",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    fontFamily: "inherit",
    fontSize: "inherit",
    fontWeight: "inherit",
    textTransform: "inherit" as React.CSSProperties["textTransform"],
    letterSpacing: "inherit",
    color: hovered ? "rgba(226, 232, 240, 1)" : "inherit",
    transition: "color 0.2s ease",
    position: "relative",
  };

  const underlineStyle: React.CSSProperties = {
    content: '""',
    position: "absolute",
    bottom: "0.5rem",
    left: "50%",
    transform: "translateX(-50%)",
    width: isExpanded ? "80%" : hovered ? "70%" : "0",
    height: "2px",
    background: `linear-gradient(90deg, transparent, ${isExpanded ? UNDERLINE_ACTIVE : UNDERLINE_COLOUR}, transparent)`,
    borderRadius: "1px",
    transition: "width 0.25s ease",
  };

  const labelStyle: React.CSSProperties = {
    transition: `color 0.2s ease`,
    color: isExpanded ? "rgba(226, 232, 240, 1)" : undefined,
    textShadow: isExpanded ? `0 0 8px ${LABEL_GLOW}` : undefined,
  };

  const arrowStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "1.8em",
    color: isExpanded
      ? ARROW_ACTIVE_COLOUR
      : hovered
        ? ARROW_HOVER_COLOUR
        : ARROW_COLOUR,
    transition: `color ${TRANSITION_SPEED} ease, transform ${TRANSITION_SPEED} ease, filter ${TRANSITION_SPEED} ease`,
    minWidth: "1em",
    transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
    filter: isExpanded
      ? `drop-shadow(0 0 4px rgba(34, 211, 238, 0.5)) drop-shadow(0 0 8px rgba(34, 211, 238, 0.3))`
      : "none",
    animation: "expandArrowPulse 1.5s ease-in-out infinite",
  };

  return (
    <>
      <button
        type="button"
        onClick={onToggle}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={buttonStyle}
        aria-label={
          isExpanded
            ? "Collapse table, show finance ribbon"
            : "Expand table, hide finance ribbon"
        }
        title={isExpanded ? "Show FX & commodities" : "Expand leaderboard"}
      >
        {/* Underline sweep pseudo-element replacement */}
        <span style={underlineStyle} aria-hidden="true" />
        <span style={labelStyle}>Provider</span>
        <span style={arrowStyle}>▼</span>
      </button>
    </>
  );
}

// =============================================================================
// SORTABLE HEADER COMPONENT
// =============================================================================

/**
 * Professional sortable header component.
 * Features:
 * - Always-visible sort arrows (↕ inactive, ▼/▲ active)
 * - Underline on hover
 * - Glow effect when active
 * - Smooth transitions
 */
function SortableHeader({
  label,
  column,
  currentSort,
  currentDirection,
  onSort,
  infoTooltip,
}: {
  label: string;
  column: SortColumn;
  currentSort: SortColumn;
  currentDirection: SortDirection;
  onSort: (col: SortColumn) => void;
  infoTooltip?: string;
}) {
  const isActive = currentSort === column;
  const isAsc = currentDirection === "asc";

  // Determine which arrow to show
  const arrow = isActive ? (isAsc ? "▲" : "▼") : "⇅";

  return (
    <div className="flex items-center justify-center gap-1">
      <button
        type="button"
        onClick={() => onSort(column)}
        className={`sortable-header ${isActive ? "sortable-header-active" : ""}`}
        aria-label={`Sort by ${label}${isActive ? (isAsc ? ", currently ascending" : ", currently descending") : ""}`}
        title={`Click to sort by ${label}`}
      >
        <span className="sortable-header-label">{label}</span>
        <span
          className={`sortable-header-arrow ${isActive ? "sortable-header-arrow-active" : ""}`}
        >
          {arrow}
        </span>
      </button>
      {infoTooltip && (
        <Tooltip text={infoTooltip}>
          <span
            className="text-muted-foreground hover:text-foreground transition-colors cursor-help text-xs"
            aria-label={`${label} information`}
          >
            ℹ
          </span>
        </Tooltip>
      )}
    </div>
  );
}

// =============================================================================
// =============================================================================
// PROMAGEN USERS DEMO v4.0 — Regional Affinity System
// =============================================================================
// 70-country pool with regional affinities, country personalities, phase offsets,
// time-of-day activity curves, dynamic flag counts, bracket floors/ceilings,
// page-level diversity pass, last-slot hysteresis, and damped real-user merge.
//
// Sanctioned demo exception (§2.2 of master doc): This is a declared product
// demo layer for pre-traffic social proof, gated behind NEXT_PUBLIC_DEMO_JITTER
// with a defined cutover path. Real users blend additively with damping taper.
//
// Authority: promagen-users-master-v4.md
// =============================================================================

// ── Tuning Constants (named for post-build adjustment) ──────────────────────
const ACTIVITY_SCALE = 0.85; // Item 3 pending — target 0.85 awaiting ChatGPT confirmation
const MIN_ACTIVITY = 0.1; // Floor: sleeping countries produce tiny counts, not zero
const MAX_VISIBLE_FLAGS = 6; // Item 4 signed off — flat 6 for all providers, no rank ceiling
const DIVERSITY_MAX_APPEARANCES = {
  US: 16,
  GB: 12,
  DE: 12,
  JP: 12,
  _default: 10,
} as const;
const DIVERSITY_SWAP_PROXIMITY = 0.3; // challenger must be within 30% of incumbent
const LAST_SLOT_HYSTERESIS_MARGIN = 0.15; // 15% margin to displace last slot
const REAL_USER_DEMO_DAMPING = [
  { threshold: 25, damping: 1.0 },
  { threshold: 100, damping: 0.75 },
  { threshold: 300, damping: 0.4 },
  { threshold: 500, damping: 0.15 },
] as const;
const RANK_BRACKETS = [
  { maxRank: 4, totalMin: 8, totalMax: 45 },
  { maxRank: 10, totalMin: 5, totalMax: 30 },
  { maxRank: 20, totalMin: 3, totalMax: 18 },
  { maxRank: 30, totalMin: 1, totalMax: 10 },
  { maxRank: 40, totalMin: 1, totalMax: 5 },
] as const;

// ── 70-Country Pool ─────────────────────────────────────────────────────────
// region: AM=Americas, WE=W.Europe, NE=N/E.Europe, MA=ME+Africa, EA=E.Asia, AO=S/SE.Asia+Oceania
type DemoCountry = {
  code: string;
  weight: number;
  offset: number;
  region: string;
};

const DEMO_COUNTRIES: DemoCountry[] = [
  // Americas (13)
  { code: "US", weight: 0.18, offset: -5, region: "AM" },
  { code: "CA", weight: 0.035, offset: -5, region: "AM" },
  { code: "MX", weight: 0.018, offset: -6, region: "AM" },
  { code: "BR", weight: 0.04, offset: -3, region: "AM" },
  { code: "AR", weight: 0.014, offset: -3, region: "AM" },
  { code: "CO", weight: 0.012, offset: -5, region: "AM" },
  { code: "CL", weight: 0.008, offset: -4, region: "AM" },
  { code: "PE", weight: 0.005, offset: -5, region: "AM" },
  { code: "CR", weight: 0.003, offset: -6, region: "AM" },
  { code: "DO", weight: 0.003, offset: -4, region: "AM" },
  { code: "UY", weight: 0.003, offset: -3, region: "AM" },
  { code: "EC", weight: 0.002, offset: -5, region: "AM" },
  { code: "TT", weight: 0.002, offset: -4, region: "AM" },
  // Western Europe (11)
  { code: "GB", weight: 0.09, offset: 0, region: "WE" },
  { code: "DE", weight: 0.065, offset: 1, region: "WE" },
  { code: "FR", weight: 0.04, offset: 1, region: "WE" },
  { code: "NL", weight: 0.022, offset: 1, region: "WE" },
  { code: "ES", weight: 0.02, offset: 1, region: "WE" },
  { code: "IT", weight: 0.018, offset: 1, region: "WE" },
  { code: "BE", weight: 0.008, offset: 1, region: "WE" },
  { code: "CH", weight: 0.008, offset: 1, region: "WE" },
  { code: "AT", weight: 0.008, offset: 1, region: "WE" },
  { code: "IE", weight: 0.007, offset: 0, region: "WE" },
  { code: "PT", weight: 0.007, offset: 0, region: "WE" },
  // Northern + Eastern Europe (17)
  { code: "SE", weight: 0.012, offset: 1, region: "NE" },
  { code: "NO", weight: 0.008, offset: 1, region: "NE" },
  { code: "DK", weight: 0.008, offset: 1, region: "NE" },
  { code: "FI", weight: 0.007, offset: 2, region: "NE" },
  { code: "PL", weight: 0.016, offset: 1, region: "NE" },
  { code: "CZ", weight: 0.006, offset: 1, region: "NE" },
  { code: "RO", weight: 0.005, offset: 2, region: "NE" },
  { code: "UA", weight: 0.006, offset: 2, region: "NE" },
  { code: "HU", weight: 0.004, offset: 1, region: "NE" },
  { code: "HR", weight: 0.003, offset: 1, region: "NE" },
  { code: "BG", weight: 0.003, offset: 2, region: "NE" },
  { code: "SK", weight: 0.003, offset: 1, region: "NE" },
  { code: "LT", weight: 0.003, offset: 2, region: "NE" },
  { code: "LV", weight: 0.002, offset: 2, region: "NE" },
  { code: "EE", weight: 0.003, offset: 2, region: "NE" },
  { code: "IS", weight: 0.002, offset: 0, region: "NE" },
  { code: "GR", weight: 0.004, offset: 2, region: "NE" },
  // Middle East + Africa (13)
  { code: "TR", weight: 0.015, offset: 3, region: "MA" },
  { code: "AE", weight: 0.008, offset: 4, region: "MA" },
  { code: "SA", weight: 0.006, offset: 3, region: "MA" },
  { code: "IL", weight: 0.007, offset: 2, region: "MA" },
  { code: "QA", weight: 0.003, offset: 3, region: "MA" },
  { code: "JO", weight: 0.002, offset: 2, region: "MA" },
  { code: "EG", weight: 0.005, offset: 2, region: "MA" },
  { code: "MA", weight: 0.003, offset: 0, region: "MA" },
  { code: "NG", weight: 0.005, offset: 1, region: "MA" },
  { code: "KE", weight: 0.004, offset: 3, region: "MA" },
  { code: "ZA", weight: 0.005, offset: 2, region: "MA" },
  { code: "GH", weight: 0.002, offset: 0, region: "MA" },
  { code: "TN", weight: 0.002, offset: 1, region: "MA" },
  // East Asia (5)
  { code: "JP", weight: 0.05, offset: 9, region: "EA" },
  { code: "KR", weight: 0.03, offset: 9, region: "EA" },
  { code: "TW", weight: 0.008, offset: 8, region: "EA" },
  { code: "HK", weight: 0.005, offset: 8, region: "EA" },
  { code: "CN", weight: 0.002, offset: 8, region: "EA" },
  // South/SE Asia + Oceania (11)
  { code: "IN", weight: 0.04, offset: 5.5, region: "AO" },
  { code: "AU", weight: 0.035, offset: 10, region: "AO" },
  { code: "NZ", weight: 0.008, offset: 12, region: "AO" },
  { code: "SG", weight: 0.008, offset: 8, region: "AO" },
  { code: "MY", weight: 0.006, offset: 8, region: "AO" },
  { code: "TH", weight: 0.012, offset: 7, region: "AO" },
  { code: "PH", weight: 0.011, offset: 8, region: "AO" },
  { code: "ID", weight: 0.013, offset: 7, region: "AO" },
  { code: "VN", weight: 0.005, offset: 7, region: "AO" },
  { code: "BD", weight: 0.002, offset: 6, region: "AO" },
  { code: "LK", weight: 0.002, offset: 5.5, region: "AO" },
];

// ── Activity Curve (local hour 0-23) ────────────────────────────────────────
const HOUR_ACTIVITY = [
  0.05, 0.03, 0.02, 0.02, 0.03, 0.05, 0.1, 0.2, 0.35, 0.5, 0.6, 0.65, 0.7, 0.65,
  0.55, 0.5, 0.55, 0.65, 0.8, 0.9, 0.95, 0.85, 0.6, 0.3,
];

// ── Regional Affinity Profiles ──────────────────────────────────────────────
type AffinityProfile = {
  primary: string[];
  primaryMult: number;
  otherMult: number;
};

const AFFINITY_PROFILES: {
  range: [number, number];
  profile: AffinityProfile;
}[] = [
  {
    range: [0, 19],
    profile: { primary: ["AM"], primaryMult: 4.0, otherMult: 0.2 },
  },
  {
    range: [20, 37],
    profile: { primary: ["WE", "NE"], primaryMult: 3.5, otherMult: 0.25 },
  },
  {
    range: [38, 51],
    profile: { primary: ["EA", "AO"], primaryMult: 4.0, otherMult: 0.2 },
  },
  {
    range: [52, 64],
    profile: { primary: [], primaryMult: 1.0, otherMult: 1.0 },
  },
  {
    range: [65, 77],
    profile: { primary: ["MA"], primaryMult: 5.0, otherMult: 0.15 },
  },
  {
    range: [78, 87],
    profile: { primary: ["WE"], primaryMult: 3.5, otherMult: 0.2 },
  },
  {
    range: [88, 99],
    profile: { primary: ["AM", "EA", "AO"], primaryMult: 3.0, otherMult: 0.2 },
  },
];

// ── Helpers ─────────────────────────────────────────────────────────────────

function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h % 10000) / 10000;
}

function hashInt(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function getAffinity(providerId: string): AffinityProfile {
  const bucket = hashInt(providerId) % 100;
  for (const a of AFFINITY_PROFILES) {
    if (bucket >= a.range[0] && bucket <= a.range[1]) return a.profile;
  }
  return AFFINITY_PROFILES[3]!.profile; // Global-balanced fallback
}

function getBracket(rank: number) {
  for (const b of RANK_BRACKETS) {
    if (rank <= b.maxRank) return b;
  }
  return RANK_BRACKETS[RANK_BRACKETS.length - 1]!;
}

function getDemoDamping(realUserTotal: number): number {
  for (let i = 0; i < REAL_USER_DEMO_DAMPING.length; i++) {
    const tier = REAL_USER_DEMO_DAMPING[i]!;
    if (realUserTotal <= tier.threshold) return tier.damping;
  }
  return 0; // 500+ real users → demo off
}

function getDiversityCap(code: string): number {
  if (code in DIVERSITY_MAX_APPEARANCES) {
    return DIVERSITY_MAX_APPEARANCES[
      code as keyof typeof DIVERSITY_MAX_APPEARANCES
    ];
  }
  return DIVERSITY_MAX_APPEARANCES._default;
}

// ── Core Generator ──────────────────────────────────────────────────────────

function generateDemoUsers(
  providerId: string,
  rank: number,
  totalProviders: number,
  homeCountry?: string,
): PromagenUsersCountryUsage[] {
  const now = new Date();
  const utcHour = now.getUTCHours();
  const utcMinute = now.getUTCMinutes();

  // Per-provider phase offset (0-59 seconds) → prevents lockstep ticking
  const phaseOffset = hashInt(providerId + "_phase") % 60;
  const effectiveMinute = (utcMinute + phaseOffset) % 60;
  const frac = effectiveMinute / 60;

  // Rank-based base engagement
  const rankFraction = rank / Math.max(totalProviders, 1);
  const providerSeed = hashSeed(providerId);
  const baseEngagement = 28 - rankFraction * 22 + providerSeed * 6; // ~12 to ~34

  // Provider's regional affinity
  const affinity = getAffinity(providerId);
  const bracket = getBracket(rank);

  // Country personality: within provider's primary region, top 3 by hash get anchor boost
  const primaryCountries = DEMO_COUNTRIES.filter((c) =>
    affinity.primary.includes(c.region),
  )
    .map((c) => ({
      code: c.code,
      pref: hashSeed(providerId + c.code + "_pref"),
    }))
    .sort((a, b) => b.pref - a.pref);
  const anchorCodes = new Set(primaryCountries.slice(0, 3).map((c) => c.code));
  const weakCodes = new Set(primaryCountries.slice(-3).map((c) => c.code));

  const entries: PromagenUsersCountryUsage[] = [];

  for (const c of DEMO_COUNTRIES) {
    // Regional affinity multiplier
    let regionMult: number;
    if (affinity.primary.includes(c.region)) {
      regionMult = affinity.primaryMult;
    } else if (affinity.primary.length === 0) {
      regionMult = affinity.otherMult; // Global-balanced
    } else {
      regionMult = affinity.otherMult;
    }

    // Country personality within primary region
    let personalityMult = 1.0;
    if (anchorCodes.has(c.code)) personalityMult = 3.0;
    else if (weakCodes.has(c.code)) personalityMult = 0.5;

    // Per-provider country variance (0.6–1.4)
    const countryVariance = 0.6 + hashSeed(providerId + c.code) * 0.8;

    // Time-of-day activity with minimum floor (sleeping countries don't vanish)
    const localHour = (utcHour + c.offset + 24) % 24;
    const curActivity = HOUR_ACTIVITY[Math.floor(localHour)] ?? 0.05;
    const nextActivity =
      HOUR_ACTIVITY[(Math.floor(localHour) + 1) % 24] ?? 0.05;
    const activity = Math.max(
      MIN_ACTIVITY,
      curActivity + (nextActivity - curActivity) * frac,
    );

    const count = Math.round(
      baseEngagement *
        c.weight *
        regionMult *
        personalityMult *
        countryVariance *
        activity *
        ACTIVITY_SCALE,
    );

    if (count > 0) {
      entries.push({ countryCode: c.code, count });
    }
  }

  // Anchor guarantee: primary-region anchor countries always produce at least 1
  // This ensures EMEA providers always show an African flag, EA providers always
  // show an Asian flag, etc. — even when those countries are sleeping.
  for (const ac of anchorCodes) {
    if (!entries.find((e) => e.countryCode === ac)) {
      entries.push({ countryCode: ac, count: 1 });
    }
  }

  // Home country boost: provider's country of origin gets higher presence
  // Photoleap → IL, Leonardo → AU, Kling → CN, etc.
  if (homeCountry) {
    const homeEntry = entries.find((e) => e.countryCode === homeCountry);
    if (homeEntry) {
      homeEntry.count = Math.max(homeEntry.count, 2) + 1; // Ensure visible presence
    } else {
      entries.push({ countryCode: homeCountry, count: 2 }); // Add if not in pool
    }
  }

  // Sort by count descending — ALL countries returned
  entries.sort((a, b) => b.count - a.count);

  // Clamp total to bracket limits
  const rawTotal = entries.reduce((s, e) => s + e.count, 0);
  if (rawTotal > bracket.totalMax) {
    const scale = bracket.totalMax / rawTotal;
    for (const e of entries) e.count = Math.max(1, Math.round(e.count * scale));
    // Math.max(1,...) can push total over ceiling — trim weakest entries
    let clampedTotal = entries.reduce((s, e) => s + e.count, 0);
    while (clampedTotal > bracket.totalMax && entries.length > 1) {
      entries.pop(); // remove weakest (already sorted desc)
      clampedTotal = entries.reduce((s, e) => s + e.count, 0);
    }
  } else if (rawTotal < bracket.totalMin && entries.length > 0) {
    const deficit = bracket.totalMin - rawTotal;
    entries[0]!.count += deficit;
  }

  return entries;
}

// ── Page-Level Diversity Pass ───────────────────────────────────────────────

function applyDiversityPass(
  allRows: {
    providerId: string;
    visible: PromagenUsersCountryUsage[];
    all: PromagenUsersCountryUsage[];
  }[],
): void {
  // Count flag appearances across all visible sets
  const flagCounts = new Map<string, number>();
  for (const row of allRows) {
    for (const entry of row.visible) {
      flagCounts.set(
        entry.countryCode,
        (flagCounts.get(entry.countryCode) ?? 0) + 1,
      );
    }
  }

  // For over-represented flags, try swapping last-slot entries
  for (const [code, count] of flagCounts) {
    const cap = getDiversityCap(code);
    if (count <= cap) continue;

    let excess = count - cap;
    for (const row of allRows) {
      if (excess <= 0) break;
      const vis = row.visible;
      if (vis.length < 2) continue; // Don't touch single-flag rows

      const lastIdx = vis.length - 1;
      if (vis[lastIdx]!.countryCode !== code) continue;

      // Find best non-visible challenger
      const visibleCodes = new Set(vis.map((v) => v.countryCode));
      const challenger = row.all.find(
        (e) =>
          !visibleCodes.has(e.countryCode) &&
          e.count >= vis[lastIdx]!.count * (1 - DIVERSITY_SWAP_PROXIMITY),
      );

      if (challenger) {
        vis[lastIdx] = challenger;
        excess--;
      }
    }
  }
}

// ── Hysteresis: Apply last-slot stability ───────────────────────────────────

function applyHysteresis(
  currentVisible: PromagenUsersCountryUsage[],
  previousVisible: PromagenUsersCountryUsage[] | undefined,
): PromagenUsersCountryUsage[] {
  if (
    !previousVisible ||
    previousVisible.length === 0 ||
    currentVisible.length === 0
  ) {
    return currentVisible;
  }

  // Only apply to last slot
  const lastIdx = currentVisible.length - 1;
  const prevLastIdx = Math.min(lastIdx, previousVisible.length - 1);
  const prevLastCode = previousVisible[prevLastIdx]?.countryCode;

  if (!prevLastCode) return currentVisible;

  const currentLast = currentVisible[lastIdx]!;

  // If last slot changed, check if new entry exceeds old by > HYSTERESIS margin
  if (currentLast.countryCode !== prevLastCode) {
    const prevEntry = currentVisible.find(
      (e) => e.countryCode === prevLastCode,
    );
    // If previous holder is still in the visible range with reasonable count, keep it
    if (
      prevEntry &&
      prevEntry.count >= currentLast.count * (1 - LAST_SLOT_HYSTERESIS_MARGIN)
    ) {
      // Swap: keep previous holder in last slot
      const result = [...currentVisible];
      const prevIdx = result.findIndex((e) => e.countryCode === prevLastCode);
      if (prevIdx >= 0 && prevIdx !== lastIdx) {
        [result[prevIdx]!, result[lastIdx]!] = [
          result[lastIdx]!,
          result[prevIdx]!,
        ];
      }
      return result;
    }
  }

  return currentVisible;
}

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

function chunkPairs<T>(items: ReadonlyArray<T>): Array<ReadonlyArray<T>> {
  const out: Array<ReadonlyArray<T>> = [];
  for (let i = 0; i < items.length; i += 2) {
    out.push(items.slice(i, i + 2));
  }
  return out;
}

/**
 * Promagen Users cell: total (worldwide) + top N flags with standard numbers
 */
function PromagenUsersCell({
  usage,
  visibleFlags,
}: {
  usage?: ReadonlyArray<PromagenUsersCountryUsage>;
  visibleFlags?: ReadonlyArray<PromagenUsersCountryUsage>;
}) {
  if (!usage || usage.length === 0) {
    return <span className="text-white/70 text-base">—</span>;
  }

  // Total = ALL countries worldwide
  const total = usage.reduce((sum, e) => sum + e.count, 0);
  // Flags = pre-computed visible set (diversity + hysteresis applied), or top 6 fallback
  const flags = visibleFlags ?? usage.slice(0, 6);
  const rows = chunkPairs(flags);

  return (
    <div className="promagen-users-cell flex flex-col items-center gap-1">
      <span
        style={{
          fontSize: "clamp(0.7rem, 0.85vw, 0.95rem)",
          color: "#E2E8F0",
          fontWeight: 600,
        }}
      >
        {total.toLocaleString("en-US")}
      </span>
      {rows.map((row, rowIdx) => (
        <div key={rowIdx} className="flex items-center justify-center gap-3">
          {row.map((item) => (
            <span
              key={item.countryCode}
              className="inline-flex items-center gap-1"
            >
              <Flag countryCode={item.countryCode} size={26} decorative />
              <span
                style={{
                  fontSize: "clamp(0.65rem, 0.8vw, 0.9rem)",
                  color: "#E2E8F0",
                }}
              >
                {item.count}
              </span>
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * Image Quality cell: rank (ordinal), medal emoji (top 3), vote button
 */
function ImageQualityCell({
  rank,
  providerId,
  isAuthenticated,
}: {
  rank?: number | null;
  providerId: string;
  isAuthenticated?: boolean;
}) {
  if (!rank) {
    return <span className="text-white/70 text-xs">—</span>;
  }

  // Medal for top 3
  let medal = "";
  if (rank === 1) medal = "🥇";
  else if (rank === 2) medal = "🥈";
  else if (rank === 3) medal = "🥉";

  // Ordinal suffix
  const ordinal =
    rank === 1 ? "1st" : rank === 2 ? "2nd" : rank === 3 ? "3rd" : `${rank}th`;

  return (
    <div className="flex items-center justify-center gap-2">
      <span className="text-sm">
        {ordinal} {medal}
      </span>
      <ImageQualityVoteButton
        providerId={providerId}
        isAuthenticated={isAuthenticated}
      />
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function ProvidersTable({
  providers,
  title: _title,
  caption: _caption,
  limit,
  isAuthenticated = false,
  onProvidersChange,
  isExpanded = false,
  onExpandToggle,
  weatherMap,
  isPro = false,
  highlightTierId,
  tierFilter,
}: ProvidersTableProps) {
  // Sort state: default to Index Rating descending (highest first)
  const [sortBy, setSortBy] = useState<SortColumn>("indexRating");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // ── Mobile card expand state (Upgrade 2: Tap-to-Discover) ──────────
  const [expandedMobileCard, setExpandedMobileCard] = useState<string | null>(
    null,
  );

  // Tier label + colour maps for row highlighting
  const tierColours: Record<number, string> = {
    1: "#8B5CF6",
    2: "#3B82F6",
    3: "#10B981",
    4: "#F59E0B",
  };

  // Index Rating data from database
  const [indexRatings, setIndexRatings] = useState<Map<string, ProviderRating>>(
    new Map(),
  );
  const [_ratingsLoaded, setRatingsLoaded] = useState(false);

  // Fetch Index Ratings on mount
  useEffect(() => {
    const providerIds = providers.map((p) => p.id);
    if (providerIds.length === 0) {
      setRatingsLoaded(true); // No providers = nothing to wait for
      return;
    }

    // Safety timeout: show table after 2s even if API is slow
    const timeout = setTimeout(() => setRatingsLoaded(true), 2000);

    fetchIndexRatings(providerIds)
      .then((ratings) => {
        setIndexRatings(ratings);
        setRatingsLoaded(true);
      })
      .catch(() => {
        // Ensure table becomes visible even on unexpected errors
        setRatingsLoaded(true);
      })
      .finally(() => clearTimeout(timeout));
  }, [providers]);

  // ── Demo jitter — subtle simulated rating movement ──────────────────
  // Controlled by NEXT_PUBLIC_DEMO_JITTER env var (true = on, false = off).
  // jitterTick=0 on initial render → no jitter (hydration safe).
  const demoEnabled = process.env.NEXT_PUBLIC_DEMO_JITTER === "true";
  const [jitterTick, setJitterTick] = useState(0);

  useEffect(() => {
    if (!demoEnabled) return;
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) return;
    const interval = setInterval(() => setJitterTick((t) => t + 1), 45_000);
    return () => clearInterval(interval);
  }, [demoEnabled]);

  // ── Demo user tick — refreshes time-of-day user counts every 60s ────
  const [demoUserTick, setDemoUserTick] = useState(0);
  // Hysteresis ref: previous visible flag sets per provider
  const prevVisibleRef = useRef<Map<string, PromagenUsersCountryUsage[]>>(
    new Map(),
  );

  useEffect(() => {
    if (!demoEnabled) return;
    if (typeof window === "undefined") return;
    setDemoUserTick(1);
    const interval = setInterval(() => setDemoUserTick((t) => t + 1), 60_000);
    return () => clearInterval(interval);
  }, [demoEnabled]);

  // Handle sort toggle: if same column, flip direction; else switch column with default direction
  const handleSort = (column: SortColumn) => {
    if (sortBy === column) {
      setSortDirection((prev) => (prev === "desc" ? "asc" : "desc"));
    } else {
      setSortBy(column);
      setSortDirection(column === "imageQuality" ? "asc" : "desc");
    }
  };

  const sliced =
    typeof limit === "number" && Number.isFinite(limit) && limit > 0
      ? providers.slice(0, Math.floor(limit))
      : providers;

  // ── Enrich providers: demo + real merge + diversity + hysteresis ────
  const enriched: ProviderWithExtras[] = React.useMemo(() => {
    void demoUserTick; // reactive dependency
    const total = sliced.length;
    const prevMap = prevVisibleRef.current;

    // Step 1: Generate raw data for all providers
    const rows = sliced.map((p, idx) => {
      const rank = idx + 1;
      // Demo base layer (all 70 countries)
      const demoData =
        demoEnabled && demoUserTick > 0
          ? generateDemoUsers(p.id, rank, total, p.countryCode?.toUpperCase())
          : [];
      const realData: ReadonlyArray<PromagenUsersCountryUsage> =
        p.promagenUsers ?? [];

      // Damped merge: demo × damping + real (additive)
      const realTotal = realData.reduce((s, e) => s + e.count, 0);
      const damping = demoEnabled ? getDemoDamping(realTotal) : 0;
      const merged = new Map<string, number>();

      for (const e of demoData) {
        const damped = Math.round(e.count * damping);
        if (damped > 0) merged.set(e.countryCode, damped);
      }
      for (const e of realData) {
        merged.set(e.countryCode, (merged.get(e.countryCode) ?? 0) + e.count);
      }

      const allCountries = Array.from(merged.entries())
        .map(([countryCode, count]) => ({ countryCode, count }))
        .filter((e) => e.count > 0)
        .sort((a, b) => {
          // Primary: count descending
          if (b.count !== a.count) return b.count - a.count;
          // Tie-break: even rank = A→Z, odd rank = Z→A
          return rank % 2 === 0
            ? a.countryCode.localeCompare(b.countryCode)
            : b.countryCode.localeCompare(a.countryCode);
        });

      // Visible flag count = min(MAX_VISIBLE_FLAGS, countries with data)
      // Item 4: flat 6 for all providers — rank controls flag count naturally
      // through lower base engagement producing fewer non-zero countries
      const flagCount = Math.min(MAX_VISIBLE_FLAGS, allCountries.length);

      // Initial visible set (before diversity/hysteresis)
      const visible = allCountries.slice(0, flagCount);

      return {
        providerId: p.id,
        all: allCountries,
        visible,
        rank,
        provider: p,
        flagCount,
      };
    });

    // Step 2: Page-level diversity pass
    if (demoEnabled && demoUserTick > 0) {
      applyDiversityPass(rows);
    }

    // Step 3: Hysteresis on last slot
    for (const row of rows) {
      const prev = prevMap.get(row.providerId);
      row.visible = applyHysteresis(row.visible, prev);
    }

    // Step 4: Update hysteresis ref for next tick
    const newMap = new Map<string, PromagenUsersCountryUsage[]>();
    for (const row of rows) {
      newMap.set(row.providerId, [...row.visible]);
    }
    prevVisibleRef.current = newMap;

    // Step 5: Build final enriched array
    return rows.map((row) => ({
      ...row.provider,
      indexRating: toDisplayRating(
        row.provider,
        indexRatings.get(row.provider.id.toLowerCase()),
      ),
      promagenUsers: row.all,
      visibleUsers: row.visible,
      visibleFlagCount: row.flagCount,
    }));
  }, [sliced, indexRatings, demoEnabled, demoUserTick]);

  // Sort providers based on selected column and direction
  // Sort uses STABLE base ratings — jitter is cosmetic-only, applied AFTER sort
  // so rows never swap position from jitter alone.
  const sorted = React.useMemo(() => {
    void jitterTick; // reactive dependency
    const arr = [...enriched];

    // ── Step 1: Sort on stable base ratings ──
    if (sortBy === "imageQuality") {
      const dir = sortDirection === "asc" ? 1 : -1;
      arr.sort((a, b) => {
        const aRank = a.imageQualityRank ?? 999;
        const bRank = b.imageQualityRank ?? 999;
        return (aRank - bRank) * dir;
      });
    } else {
      const dir = sortDirection === "desc" ? 1 : -1;
      arr.sort((a, b) => {
        const aRating = a.indexRating?.rating ?? 0;
        const bRating = b.indexRating?.rating ?? 0;
        return (bRating - aRating) * dir;
      });
    }

    // ── Step 2: Apply cosmetic jitter AFTER sort (display values only) ──
    // jitterTick=0 → skip (hydration safe). ±1-3 range, subtle breathing.
    // Gated behind NEXT_PUBLIC_DEMO_JITTER env var.
    if (demoEnabled && jitterTick > 0) {
      for (const p of arr) {
        if (p.indexRating && p.indexRating.rating !== null) {
          const jitter =
            (Math.random() * 2 + 1) * (Math.random() > 0.5 ? 1 : -1); // ±1-3
          const base = p.indexRating.rating;
          p.indexRating = {
            ...p.indexRating,
            rating: base + jitter,
            change: jitter,
            changePercent: base > 0 ? (jitter / base) * 100 : 0,
            state: (jitter > 0 ? "gain" : "loss") as RatingChangeState,
          };
        }
      }
    }

    return arr;
  }, [enriched, sortBy, sortDirection, jitterTick, demoEnabled]);

  // Notify parent of displayed provider IDs (for market pulse)
  useEffect(() => {
    if (onProvidersChange) {
      onProvidersChange(sorted.map((p) => p.id));
    }
  }, [sorted, onProvidersChange]);

  // Tier filtering: when active, only show platforms in the selected tier
  const displayed = React.useMemo(() => {
    if (!tierFilter) return sorted;
    return sorted.filter((p) => getPlatformTierId(p.id) === tierFilter);
  }, [sorted, tierFilter]);

  return (
    <div className="providers-table-container leaderboard-glow-frame">
      {/* Desktop table view — hidden on mobile via CSS */}
      <div
        className="providers-table-scroll-wrapper providers-table-desktop"
        data-testid="providers-scroll"
      >
        <table className="providers-table w-full">
          {/* Proportional column widths — auto-scale with viewport */}
          {/* 5 columns: Provider (30%) | Promagen Users (18%) | Image Quality (18%) | Support (18%) | Index Rating (16%) */}
          <thead className="providers-table-header">
            <tr>
              <th className="providers-table-th providers-table-th-sortable px-4 py-3 text-center w-[30%] border-r border-white/5">
                <ExpandHeader
                  isExpanded={isExpanded}
                  onToggle={onExpandToggle}
                />
              </th>
              <th className="providers-table-th px-4 py-3 text-center w-[18%] border-r border-white/5">
                Promagen Users
              </th>
              <th className="providers-table-th providers-table-th-sortable px-4 py-3 text-center w-[18%] border-r border-white/5">
                <SortableHeader
                  label="Image Quality"
                  column="imageQuality"
                  currentSort={sortBy}
                  currentDirection={sortDirection}
                  onSort={handleSort}
                />
              </th>
              <th className="providers-table-th px-4 py-3 text-center w-[18%] border-r border-white/5">
                Support
              </th>
              <th className="providers-table-th providers-table-th-sortable px-4 py-3 text-center w-[16%]">
                <SortableHeader
                  label="Index Rating"
                  column="indexRating"
                  currentSort={sortBy}
                  currentDirection={sortDirection}
                  onSort={handleSort}
                />
              </th>
            </tr>
          </thead>

          <tbody>
            {displayed.map((p, index) => {
              const providerTierId = getPlatformTierId(p.id);
              const isHighlighted =
                highlightTierId &&
                providerTierId === highlightTierId &&
                !tierFilter;
              const highlightBorder = isHighlighted
                ? `3px solid ${tierColours[highlightTierId]}`
                : undefined;
              const highlightBg = isHighlighted
                ? `${tierColours[highlightTierId]}08`
                : undefined;

              return (
                <tr
                  key={p.id}
                  data-provider-id={p.id}
                  className={`providers-table-row border-t border-slate-800 hover:bg-slate-900/30 transition-colors market-pulse-target${
                    p.indexRating?.hasRankUp ? " rank-climber-row" : ""
                  }`}
                  style={{
                    borderLeft: highlightBorder,
                    backgroundColor: highlightBg,
                    transition:
                      "border-left 400ms ease, background-color 400ms ease",
                  }}
                >
                  <td className="providers-table-td px-4 py-3 w-[30%] border-r border-white/5">
                    <ProviderCell
                      provider={p}
                      rank={index + 1}
                      hasRankUp={p.indexRating?.hasRankUp ?? false}
                      weatherMap={weatherMap}
                      isPro={isPro}
                    />
                  </td>

                  <td className="providers-table-td px-4 py-3 w-[18%] text-center border-r border-white/5">
                    <PromagenUsersCell
                      usage={p.promagenUsers}
                      visibleFlags={p.visibleUsers}
                    />
                  </td>

                  <td className="providers-table-td px-4 py-3 w-[18%] text-center border-r border-white/5">
                    <ImageQualityCell
                      rank={p.imageQualityRank}
                      providerId={p.id}
                      isAuthenticated={isAuthenticated}
                    />
                  </td>

                  <td className="providers-table-td px-4 py-3 w-[18%] border-r border-white/5">
                    <SupportIconsCell
                      providerName={p.name}
                      socials={p.socials}
                      providerId={p.id}
                    />
                  </td>

                  <td className="providers-table-td px-4 py-3 text-center w-[16%]">
                    {p.indexRating ? (
                      <IndexRatingCell rating={p.indexRating} />
                    ) : (
                      <span className="text-white/70">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile card view — hidden on desktop, shown on mobile via CSS */}
      {/* Upgrade 2: Tap-to-Discover — cards expand to reveal platform identity + builder link */}
      <div className="providers-mobile-cards" data-testid="providers-mobile">
        {sorted.map((p, index) => {
          const isExpanded = expandedMobileCard === p.id;

          return (
            <div
              key={p.id}
              data-provider-id={p.id}
              className="providers-mobile-card market-pulse-target"
              onClick={() => setExpandedMobileCard(isExpanded ? null : p.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setExpandedMobileCard(isExpanded ? null : p.id);
                }
              }}
              style={{ cursor: "pointer" }}
              aria-expanded={isExpanded}
            >
              {/* Row 1: Rank + Name + Index Rating */}
              <div className="providers-mobile-header">
                <span className="providers-mobile-rank">{index + 1}.</span>
                <a
                  href={`/go/${encodeURIComponent(p.id)}?src=leaderboard_mobile`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="providers-mobile-name"
                  onClick={(e) => e.stopPropagation()}
                >
                  {p.name}
                </a>
                {p.apiAvailable && (
                  <span className="providers-mobile-emoji">🔌</span>
                )}
                {p.affiliateProgramme && (
                  <span className="providers-mobile-emoji">🤝</span>
                )}
                {p.indexRating?.hasRankUp && (
                  <span className="rank-up-arrow">⬆</span>
                )}
                <span className="providers-mobile-score">
                  {p.indexRating?.rating
                    ? Math.round(p.indexRating.rating).toLocaleString()
                    : "—"}
                  {p.indexRating?.state === "gain" && (
                    <span className="text-emerald-400 ml-1">▲</span>
                  )}
                  {p.indexRating?.state === "loss" && (
                    <span className="text-rose-400 ml-1">▼</span>
                  )}
                </span>
              </div>

              {/* Row 2: Location + Quality */}
              <div className="providers-mobile-details">
                {p.countryCode && p.hqCity && (
                  <span className="providers-mobile-location">
                    <Flag countryCode={p.countryCode} size={14} decorative />
                    <span>{p.hqCity}</span>
                  </span>
                )}
                {p.imageQualityRank && (
                  <span className="providers-mobile-quality">
                    {p.imageQualityRank === 1
                      ? "1st 🥇"
                      : p.imageQualityRank === 2
                        ? "2nd 🥈"
                        : p.imageQualityRank === 3
                          ? "3rd 🥉"
                          : `${p.imageQualityRank}th`}
                  </span>
                )}
              </div>

              {/* Row 3: Expanded — tagline + builder CTA (Upgrade 2) */}
              <div
                style={{
                  maxHeight: isExpanded ? "120px" : "0px",
                  opacity: isExpanded ? 1 : 0,
                  overflow: "hidden",
                  transition:
                    "max-height 250ms ease-out, opacity 200ms ease-out",
                }}
              >
                <div
                  style={{
                    paddingTop: "clamp(8px, 2vw, 12px)",
                    paddingLeft: "1.5rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "clamp(6px, 1.5vw, 10px)",
                  }}
                >
                  {p.tagline && (
                    <p
                      className="text-sky-300"
                      style={{
                        fontSize: "clamp(0.75rem, 3vw, 0.85rem)",
                        lineHeight: 1.4,
                      }}
                    >
                      {p.tagline}
                    </p>
                  )}
                  <a
                    href={`/providers/${encodeURIComponent(p.id)}`}
                    className="inline-flex items-center gap-1.5 font-semibold text-purple-300 transition-colors hover:text-purple-200 cursor-pointer"
                    style={{ fontSize: "clamp(0.73rem, 2.8vw, 0.85rem)" }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span>Build prompts for {p.name}</span>
                    <svg
                      style={{
                        width: "clamp(12px, 3vw, 16px)",
                        height: "clamp(12px, 3vw, 16px)",
                      }}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ProvidersTable;
