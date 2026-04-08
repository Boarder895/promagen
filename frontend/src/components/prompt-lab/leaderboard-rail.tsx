// src/components/prompt-lab/leaderboard-rail.tsx
// ============================================================================
// LEADERBOARD RAIL — Left Rail: AI Leaderboard (v5.3.0)
// ============================================================================
// Three equal columns: Provider | Promagen Users | Index Rating
//
// v5.3.0 (6 Apr 2026):
// - Render rewritten to match providers-table.tsx visual language
// - Uses .providers-table-container + .providers-table-scroll-wrapper classes
//   for rounded container (border-radius: 1rem), dark bg, custom scrollbar
// - Header matches .providers-table-header: sticky, blurred, slate colours
// - Row borders: 1px solid rgba(30,41,59,1) (border-slate-800) — same weight
// - Cell borders: 1px solid rgba(255,255,255,0.05) (border-white/5)
// - No per-row border-radius — rounded corners on container only
// - Hover glow uses outline (not border) to avoid shifting horizontal lines
// - Equal vertical padding in all columns: clamp(0.5rem, 0.6vw, 0.75rem)
// - Provider name clipping fixed: icon reduced to clamp(18px, 1.5vw, 24px)
//
// v5.2.0 (6 Apr 2026):
// - Row height halved to clamp(72px, 6vw, 90px) — balanced visibility
// - Brand-color hover glow (same pattern as community-pulse.tsx):
//   per-provider colour, radial gradient overlays, box-shadow transition
// - Darker row dividers: rgba(255, 255, 255, 0.15)
// - PLATFORM_COLORS map + hexToRgba from community-pulse.tsx
//
// v5.1.0 (6 Apr 2026):
// - Flag sizing follows code-standard §6.0 standard scales:
//   clamp(18px, 1.5vw, 24px) width / clamp(14px, 1.1vw, 18px) height
// - Provider column: rank + icon on line 1, name on line 2
// - Promagen Users: total prominent, flags in rows of 3 below
// - Index Rating: rating + change with generous spacing
// - Breathing room throughout (code-standard §6.3)
//
// v5.0.0 (6 Apr 2026):
// - Switched from <table> to div-based flex for true fixed row heights
// - Dynamic visible count via ResizeObserver (replaces hardcoded 10)
// - Default: overflow hidden, no scroll. Expanded: thin scrollbar (§8.1)
// - Three equal columns (33.33%). Support → Promagen Users.
// - Demo user generation (same rules as providers-table.tsx v4.0)
// - No grey text. No city/exchange/clock data.
//
// Authority: providers-table.tsx (visual source of truth),
//   promagen-users-master-v4.md (demo rules),
//   code-standard.md §6.0 (clamp scales), §6.3 (breathing room),
//   §8.1 (scrollbar), §6.5 (containment)
// Existing features preserved: Yes — same props contract.
//   Provider selection, index rating jitter, rank-up animation all unchanged.
// ============================================================================

'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { Provider } from '@/types/providers';
import type { ProviderRating, SerializableProviderRating, DisplayRating, RatingChangeState } from '@/types/index-rating';
import { DISPLAY_INFLATION_OFFSET } from '@/types/index-rating';
import { IndexRatingCell } from '@/components/providers/index-rating-cell';
import type { PromagenUsersCountryUsage } from '@/types/promagen-users';

// Flag helpers — used by RailFlag for proper clamp() sizing (code-standard §6.0)
import { flagSrc, countryCodeToFlagEmoji, flagAriaLabel } from '@/data/flags/flags';

// Market power data for MPI/underdog/newcomer (same as providers-table)
import marketPowerData from '@/data/providers/market-power.json';
import { calculateMPI } from '@/lib/index-rating/calculations';
import type { MarketPowerData, ProviderMarketPower } from '@/lib/index-rating';

const typedMarketPowerData = marketPowerData as MarketPowerData;

// ============================================================================
// CONSTANTS
// ============================================================================

/** Demo jitter interval for index ratings (ms) */
const DEMO_JITTER_INTERVAL = 45_000;
const DEMO_JITTER_MIN = 1;
const DEMO_JITTER_MAX = 3;

/** Demo user tick interval (ms) — refreshes time-of-day user counts */
const DEMO_USER_TICK_INTERVAL = 60_000;

const FALLBACK_ICON = '/icons/providers/fallback.png';

/** Max visible flags per provider — Item 4 signed off, flat 6 for all */
const MAX_VISIBLE_FLAGS = 6;

// ============================================================================
// TYPES
// ============================================================================

export interface LeaderboardRailProps {
  providers: Provider[];
  selectedProviderId: string | null;
  onSelectProvider: (providerId: string) => void;
  /** Server-prefetched Index Ratings */
  initialRatings?: Record<string, SerializableProviderRating>;
  /** Server-resolved demo toggle — avoids stale client-bundled NEXT_PUBLIC values */
  demoEnabled?: boolean;
}

type SortColumn = 'indexRating';
type SortDirection = 'asc' | 'desc';

type ProviderWithRating = Provider & {
  indexRating?: DisplayRating;
  /** All countries (demo + real merged) — used for total calculation */
  mergedUsers?: PromagenUsersCountryUsage[];
  /** Visible flag set (top MAX_VISIBLE_FLAGS) */
  visibleFlags?: PromagenUsersCountryUsage[];
};

// ============================================================================
// DEMO USER GENERATION (exact copy from providers-table.tsx v4.0)
// Authority: promagen-users-master-v4.md — ChatGPT signed off
// ============================================================================

const ACTIVITY_SCALE = 0.85;
const MIN_ACTIVITY = 0.1;

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

type DemoCountry = { code: string; weight: number; offset: number; region: string };

const DEMO_COUNTRIES: DemoCountry[] = [
  // Americas (13)
  { code: 'US', weight: 0.18, offset: -5, region: 'AM' },
  { code: 'CA', weight: 0.035, offset: -5, region: 'AM' },
  { code: 'MX', weight: 0.018, offset: -6, region: 'AM' },
  { code: 'BR', weight: 0.04, offset: -3, region: 'AM' },
  { code: 'AR', weight: 0.014, offset: -3, region: 'AM' },
  { code: 'CO', weight: 0.012, offset: -5, region: 'AM' },
  { code: 'CL', weight: 0.008, offset: -4, region: 'AM' },
  { code: 'PE', weight: 0.005, offset: -5, region: 'AM' },
  { code: 'CR', weight: 0.003, offset: -6, region: 'AM' },
  { code: 'DO', weight: 0.003, offset: -4, region: 'AM' },
  { code: 'UY', weight: 0.003, offset: -3, region: 'AM' },
  { code: 'EC', weight: 0.002, offset: -5, region: 'AM' },
  { code: 'TT', weight: 0.002, offset: -4, region: 'AM' },
  // Western Europe (11)
  { code: 'GB', weight: 0.09, offset: 0, region: 'WE' },
  { code: 'DE', weight: 0.065, offset: 1, region: 'WE' },
  { code: 'FR', weight: 0.04, offset: 1, region: 'WE' },
  { code: 'NL', weight: 0.022, offset: 1, region: 'WE' },
  { code: 'ES', weight: 0.02, offset: 1, region: 'WE' },
  { code: 'IT', weight: 0.018, offset: 1, region: 'WE' },
  { code: 'BE', weight: 0.008, offset: 1, region: 'WE' },
  { code: 'CH', weight: 0.008, offset: 1, region: 'WE' },
  { code: 'AT', weight: 0.008, offset: 1, region: 'WE' },
  { code: 'IE', weight: 0.007, offset: 0, region: 'WE' },
  { code: 'PT', weight: 0.007, offset: 0, region: 'WE' },
  // Northern + Eastern Europe (17)
  { code: 'SE', weight: 0.012, offset: 1, region: 'NE' },
  { code: 'NO', weight: 0.008, offset: 1, region: 'NE' },
  { code: 'DK', weight: 0.008, offset: 1, region: 'NE' },
  { code: 'FI', weight: 0.007, offset: 2, region: 'NE' },
  { code: 'PL', weight: 0.016, offset: 1, region: 'NE' },
  { code: 'CZ', weight: 0.006, offset: 1, region: 'NE' },
  { code: 'RO', weight: 0.005, offset: 2, region: 'NE' },
  { code: 'UA', weight: 0.006, offset: 2, region: 'NE' },
  { code: 'HU', weight: 0.004, offset: 1, region: 'NE' },
  { code: 'HR', weight: 0.003, offset: 1, region: 'NE' },
  { code: 'BG', weight: 0.003, offset: 2, region: 'NE' },
  { code: 'SK', weight: 0.003, offset: 1, region: 'NE' },
  { code: 'LT', weight: 0.003, offset: 2, region: 'NE' },
  { code: 'LV', weight: 0.002, offset: 2, region: 'NE' },
  { code: 'EE', weight: 0.003, offset: 2, region: 'NE' },
  { code: 'IS', weight: 0.002, offset: 0, region: 'NE' },
  { code: 'GR', weight: 0.004, offset: 2, region: 'NE' },
  // Middle East + Africa (13)
  { code: 'TR', weight: 0.015, offset: 3, region: 'MA' },
  { code: 'AE', weight: 0.008, offset: 4, region: 'MA' },
  { code: 'SA', weight: 0.006, offset: 3, region: 'MA' },
  { code: 'IL', weight: 0.007, offset: 2, region: 'MA' },
  { code: 'QA', weight: 0.003, offset: 3, region: 'MA' },
  { code: 'JO', weight: 0.002, offset: 2, region: 'MA' },
  { code: 'EG', weight: 0.005, offset: 2, region: 'MA' },
  { code: 'MA', weight: 0.003, offset: 0, region: 'MA' },
  { code: 'NG', weight: 0.005, offset: 1, region: 'MA' },
  { code: 'KE', weight: 0.004, offset: 3, region: 'MA' },
  { code: 'ZA', weight: 0.005, offset: 2, region: 'MA' },
  { code: 'GH', weight: 0.002, offset: 0, region: 'MA' },
  { code: 'TN', weight: 0.002, offset: 1, region: 'MA' },
  // East Asia (5)
  { code: 'JP', weight: 0.05, offset: 9, region: 'EA' },
  { code: 'KR', weight: 0.03, offset: 9, region: 'EA' },
  { code: 'TW', weight: 0.008, offset: 8, region: 'EA' },
  { code: 'HK', weight: 0.005, offset: 8, region: 'EA' },
  { code: 'CN', weight: 0.002, offset: 8, region: 'EA' },
  // South/SE Asia + Oceania (11)
  { code: 'IN', weight: 0.04, offset: 5.5, region: 'AO' },
  { code: 'AU', weight: 0.035, offset: 10, region: 'AO' },
  { code: 'NZ', weight: 0.008, offset: 12, region: 'AO' },
  { code: 'SG', weight: 0.008, offset: 8, region: 'AO' },
  { code: 'MY', weight: 0.006, offset: 8, region: 'AO' },
  { code: 'TH', weight: 0.012, offset: 7, region: 'AO' },
  { code: 'PH', weight: 0.011, offset: 8, region: 'AO' },
  { code: 'ID', weight: 0.013, offset: 7, region: 'AO' },
  { code: 'VN', weight: 0.005, offset: 7, region: 'AO' },
  { code: 'BD', weight: 0.002, offset: 6, region: 'AO' },
  { code: 'LK', weight: 0.002, offset: 5.5, region: 'AO' },
];

const HOUR_ACTIVITY = [
  0.05, 0.03, 0.02, 0.02, 0.03, 0.05, 0.1, 0.2, 0.35, 0.5, 0.6, 0.65, 0.7, 0.65,
  0.55, 0.5, 0.55, 0.65, 0.8, 0.9, 0.95, 0.85, 0.6, 0.3,
];

type AffinityProfile = { primary: string[]; primaryMult: number; otherMult: number };

const AFFINITY_PROFILES: { range: [number, number]; profile: AffinityProfile }[] = [
  { range: [0, 19], profile: { primary: ['AM'], primaryMult: 4.0, otherMult: 0.2 } },
  { range: [20, 37], profile: { primary: ['WE', 'NE'], primaryMult: 3.5, otherMult: 0.25 } },
  { range: [38, 51], profile: { primary: ['EA', 'AO'], primaryMult: 4.0, otherMult: 0.2 } },
  { range: [52, 64], profile: { primary: [], primaryMult: 1.0, otherMult: 1.0 } },
  { range: [65, 77], profile: { primary: ['MA'], primaryMult: 5.0, otherMult: 0.15 } },
  { range: [78, 87], profile: { primary: ['WE'], primaryMult: 3.5, otherMult: 0.2 } },
  { range: [88, 99], profile: { primary: ['AM', 'EA', 'AO'], primaryMult: 3.0, otherMult: 0.2 } },
];

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
  return AFFINITY_PROFILES[3]!.profile;
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
  return 0;
}

function generateDemoUsers(
  providerId: string,
  rank: number,
  totalProviders: number,
  homeCountry?: string,
): PromagenUsersCountryUsage[] {
  const now = new Date();
  const utcHour = now.getUTCHours();
  const utcMinute = now.getUTCMinutes();

  const phaseOffset = hashInt(providerId + '_phase') % 60;
  const effectiveMinute = (utcMinute + phaseOffset) % 60;
  const frac = effectiveMinute / 60;

  const rankFraction = rank / Math.max(totalProviders, 1);
  const providerSeed = hashSeed(providerId);
  const baseEngagement = 28 - rankFraction * 22 + providerSeed * 6;

  const affinity = getAffinity(providerId);
  const bracket = getBracket(rank);

  const primaryCountries = DEMO_COUNTRIES.filter((c) =>
    affinity.primary.includes(c.region),
  )
    .map((c) => ({ code: c.code, pref: hashSeed(providerId + c.code + '_pref') }))
    .sort((a, b) => b.pref - a.pref);
  const anchorCodes = new Set(primaryCountries.slice(0, 3).map((c) => c.code));
  const weakCodes = new Set(primaryCountries.slice(-3).map((c) => c.code));

  const entries: PromagenUsersCountryUsage[] = [];

  for (const c of DEMO_COUNTRIES) {
    let regionMult: number;
    if (affinity.primary.includes(c.region)) {
      regionMult = affinity.primaryMult;
    } else if (affinity.primary.length === 0) {
      regionMult = affinity.otherMult;
    } else {
      regionMult = affinity.otherMult;
    }

    let personalityMult = 1.0;
    if (anchorCodes.has(c.code)) personalityMult = 3.0;
    else if (weakCodes.has(c.code)) personalityMult = 0.5;

    const countryVariance = 0.6 + hashSeed(providerId + c.code) * 0.8;

    const localHour = (utcHour + c.offset + 24) % 24;
    const curActivity = HOUR_ACTIVITY[Math.floor(localHour)] ?? 0.05;
    const nextActivity = HOUR_ACTIVITY[(Math.floor(localHour) + 1) % 24] ?? 0.05;
    const activity = Math.max(MIN_ACTIVITY, curActivity + (nextActivity - curActivity) * frac);

    const count = Math.round(
      baseEngagement * c.weight * regionMult * personalityMult * countryVariance * activity * ACTIVITY_SCALE,
    );

    if (count > 0) {
      entries.push({ countryCode: c.code, count });
    }
  }

  for (const ac of anchorCodes) {
    if (!entries.find((e) => e.countryCode === ac)) {
      entries.push({ countryCode: ac, count: 1 });
    }
  }

  if (homeCountry) {
    const homeEntry = entries.find((e) => e.countryCode === homeCountry);
    if (homeEntry) {
      homeEntry.count = Math.max(homeEntry.count, 2) + 1;
    } else {
      entries.push({ countryCode: homeCountry, count: 2 });
    }
  }

  entries.sort((a, b) => b.count - a.count);

  const rawTotal = entries.reduce((s, e) => s + e.count, 0);
  if (rawTotal > bracket.totalMax) {
    const scale = bracket.totalMax / rawTotal;
    for (const e of entries) e.count = Math.max(1, Math.round(e.count * scale));
    let clampedTotal = entries.reduce((s, e) => s + e.count, 0);
    while (clampedTotal > bracket.totalMax && entries.length > 1) {
      entries.pop();
      clampedTotal = entries.reduce((s, e) => s + e.count, 0);
    }
  } else if (rawTotal < bracket.totalMin && entries.length > 0) {
    const deficit = bracket.totalMin - rawTotal;
    entries[0]!.count += deficit;
  }

  return entries;
}

// ============================================================================
// PLATFORM BRAND COLOURS + GLOW HELPER (from community-pulse.tsx)
// ============================================================================

function hexToRgba(hex: string, alpha: number): string {
  const safe = /^#[0-9A-Fa-f]{6}$/.test(hex) ? hex : '#3B82F6';
  const r = parseInt(safe.slice(1, 3), 16);
  const g = parseInt(safe.slice(3, 5), 16);
  const b = parseInt(safe.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const PLATFORM_COLORS: Readonly<Record<string, string>> = {
  midjourney: '#7C3AED',
  openai: '#10B981',
  'google-imagen': '#4285F4',
  leonardo: '#EC4899',
  flux: '#F97316',
  stability: '#8B5CF6',
  'adobe-firefly': '#FF6B35',
  ideogram: '#06B6D4',
  playground: '#3B82F6',
  'microsoft-designer': '#0078D4',
  novelai: '#A855F7',
  lexica: '#14B8A6',
  '123rf': '#EF4444',
  canva: '#00C4CC',
  bing: '#0078D4',
  picsart: '#FF3366',
  artistly: '#8B5CF6',
  fotor: '#22C55E',
  pixlr: '#3B82F6',
  deepai: '#6366F1',
  craiyon: '#FBBF24',
  bluewillow: '#3B82F6',
  dreamstudio: '#A855F7',
  artbreeder: '#10B981',
  'jasper-art': '#F59E0B',
  runway: '#EF4444',
  simplified: '#8B5CF6',
  photoleap: '#EC4899',
  vistacreate: '#F97316',
  artguru: '#06B6D4',
  myedit: '#3B82F6',
  visme: '#7C3AED',
  hotpot: '#F59E0B',
  picwish: '#10B981',
  clipdrop: '#6366F1',
  'imagine-meta': '#0668E1',
  dreamlike: '#D946EF',
  'remove-bg': '#22C55E',
  recraft: '#FF6B35',
  kling: '#6366F1',
  'luma-ai': '#8B5CF6',
};
const DEFAULT_BRAND_COLOR = '#3B82F6';

// ============================================================================
// MARKET POWER HELPERS (identical to providers-table.tsx)
// ============================================================================

function isProviderUnderdog(providerId: string): boolean {
  const marketPower = typedMarketPowerData.providers || {};
  const providerData = marketPower[providerId] as ProviderMarketPower | undefined;
  if (!providerData) return false;
  return calculateMPI(providerData) < 3.0;
}

function isProviderNewcomer(providerId: string): boolean {
  const marketPower = typedMarketPowerData.providers || {};
  const providerData = marketPower[providerId] as ProviderMarketPower | undefined;
  if (!providerData || !providerData.foundingYear) return false;
  return new Date().getFullYear() - providerData.foundingYear < 1;
}

// ============================================================================
// INDEX RATING HELPERS (identical to providers-table.tsx)
// ============================================================================

async function fetchIndexRatings(providerIds: string[]): Promise<Map<string, ProviderRating>> {
  try {
    const response = await fetch('/api/index-rating/ratings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerIds }),
    });
    if (!response.ok) return new Map();
    const data = await response.json();
    const ratings = new Map<string, ProviderRating>();
    if (data.ratings && typeof data.ratings === 'object') {
      for (const [id, rating] of Object.entries(data.ratings)) {
        ratings.set(id, rating as ProviderRating);
      }
    }
    return ratings;
  } catch {
    return new Map();
  }
}

function toDisplayRating(provider: Provider, dbRating: ProviderRating | undefined): DisplayRating {
  const providerId = provider.id.toLowerCase();

  if (dbRating) {
    let state: RatingChangeState = 'flat';
    if (dbRating.changePercent > 0.1) state = 'gain';
    else if (dbRating.changePercent < -0.1) state = 'loss';

    const hasRankUp = dbRating.rankChangedAt
      ? Date.now() - new Date(dbRating.rankChangedAt).getTime() < 24 * 60 * 60 * 1000
      : false;

    return {
      rating: dbRating.currentRating + DISPLAY_INFLATION_OFFSET,
      change: dbRating.change,
      changePercent: dbRating.changePercent,
      state,
      source: 'database',
      rank: dbRating.currentRank,
      hasRankUp,
      isUnderdog: isProviderUnderdog(providerId),
      isNewcomer: isProviderNewcomer(providerId),
    };
  }

  return {
    rating: typeof provider.score === 'number' ? (provider.score * 20) + DISPLAY_INFLATION_OFFSET : null,
    change: null,
    changePercent: null,
    state: 'fallback',
    source: 'fallback',
    rank: null,
    hasRankUp: false,
    isUnderdog: isProviderUnderdog(providerId),
    isNewcomer: isProviderNewcomer(providerId),
  };
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

/** Sortable column header */
function SortableHeader({
  label,
  column,
  currentSort,
  currentDirection,
  onSort,
}: {
  label: string;
  column: SortColumn;
  currentSort: SortColumn;
  currentDirection: SortDirection;
  onSort: (col: SortColumn) => void;
}) {
  const isActive = currentSort === column;
  const isAsc = currentDirection === 'asc';
  const arrow = isActive ? (isAsc ? '▲' : '▼') : '⇅';

  return (
    <button
      type="button"
      onClick={() => onSort(column)}
      className={`sortable-header cursor-pointer ${isActive ? 'sortable-header-active' : ''}`}
      aria-label={`Sort by ${label}${isActive ? (isAsc ? ', currently ascending' : ', currently descending') : ''}`}
      title={`Click to sort by ${label}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'clamp(2px, 0.2vw, 4px)',
        background: 'none',
        border: 'none',
        color: 'inherit',
        font: 'inherit',
        padding: 0,
      }}
    >
      <span className="sortable-header-label">{label}</span>
      <span className="sortable-header-arrow">{arrow}</span>
    </button>
  );
}

/**
 * RailFlag — renders a single flag at code-standard §6.0 clamp() size.
 * Uses flagSrc/emoji directly instead of the Flag component to avoid
 * the Flag's fixed inline style={{ width: size, height: size }} which
 * cannot accept clamp() values.
 */
function RailFlag({ countryCode }: { countryCode: string }) {
  const src = flagSrc(countryCode);
  const emoji = countryCodeToFlagEmoji(countryCode);
  const label = flagAriaLabel(countryCode);

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        title={label}
        aria-hidden="true"
        style={{
          width: 'clamp(18px, 1.5vw, 24px)',
          height: 'clamp(14px, 1.1vw, 18px)',
          objectFit: 'cover',
          borderRadius: 'clamp(1px, 0.1vw, 2px)',
          display: 'block',
        }}
      />
    );
  }

  if (emoji) {
    return (
      <span
        title={label}
        aria-hidden="true"
        style={{
          fontSize: 'clamp(14px, 1.2vw, 18px)',
          lineHeight: 1,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {emoji}
      </span>
    );
  }

  return null;
}

/**
 * Promagen Users cell — total + flags in rows of 3.
 * Designed for the tall rail rows with proper breathing room.
 */
function PromagenUsersRailCell({
  allCountries,
  visibleFlags,
}: {
  allCountries?: PromagenUsersCountryUsage[];
  visibleFlags?: PromagenUsersCountryUsage[];
}) {
  if (!allCountries || allCountries.length === 0) {
    return (
      <span style={{
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: 'clamp(0.7rem, 0.85vw, 0.95rem)',
      }}>
        —
      </span>
    );
  }

  const total = allCountries.reduce((sum, e) => sum + e.count, 0);
  const flags = visibleFlags ?? allCountries.slice(0, MAX_VISIBLE_FLAGS);

  // Split flags into rows of 3
  const flagRows: PromagenUsersCountryUsage[][] = [];
  for (let i = 0; i < flags.length; i += 3) {
    flagRows.push(flags.slice(i, i + 3));
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 'clamp(4px, 0.4vw, 8px)',
    }}>
      {/* Total — prominent, bold */}
      <span style={{
        fontSize: 'clamp(0.75rem, 0.9vw, 1.05rem)',
        color: '#E2E8F0',
        fontWeight: 600,
        letterSpacing: '0.02em',
      }}>
        {total.toLocaleString('en-US')}
      </span>

      {/* Flag rows — 3 per row, standard clamp() size */}
      {flagRows.map((row, rowIdx) => (
        <div
          key={rowIdx}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'clamp(4px, 0.4vw, 8px)',
          }}
        >
          {row.map((item) => (
            <RailFlag key={item.countryCode} countryCode={item.countryCode} />
          ))}
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function LeaderboardRail({
  providers,
  selectedProviderId,
  onSelectProvider,
  initialRatings,
  demoEnabled = false,
}: LeaderboardRailProps) {
  const [indexRatings, setIndexRatings] = useState<Map<string, ProviderRating>>(
    () => {
      if (initialRatings && Object.keys(initialRatings).length > 0) {
        return new Map(Object.entries(initialRatings));
      }
      return new Map();
    },
  );
  const [isExpanded, setIsExpanded] = useState(false);
  const [jitterTick, setJitterTick] = useState(0);
  const [demoUserTick, setDemoUserTick] = useState(0);
  const [sortBy, setSortBy] = useState<SortColumn>('indexRating');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [hasMounted, setHasMounted] = useState(false);

  // Hover glow — tracks which provider row is hovered
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Dynamic visible count — calculated from available height
  const [visibleCount, setVisibleCount] = useState(4);
  const bodyRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  // ── Mark as mounted ─────────────────────────────────────────────────
  useEffect(() => { setHasMounted(true); }, []);

  // ── Fetch index ratings on mount — skip if server prefetched ────────
  useEffect(() => {
    if (initialRatings && Object.keys(initialRatings).length > 0) return;
    const ids = providers.map((p) => p.id);
    if (ids.length === 0) return;
    fetchIndexRatings(ids).then(setIndexRatings);
  }, [providers, initialRatings]);

  // ── Demo jitter & user tick timers ──────────────────────────────────

  useEffect(() => {
    if (!demoEnabled) return;
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq.matches) return;
    const interval = setInterval(() => setJitterTick((t) => t + 1), DEMO_JITTER_INTERVAL);
    return () => clearInterval(interval);
  }, [demoEnabled]);

  useEffect(() => {
    if (!demoEnabled) return;
    if (typeof window === 'undefined') return;
    setDemoUserTick(1);
    const interval = setInterval(() => setDemoUserTick((t) => t + 1), DEMO_USER_TICK_INTERVAL);
    return () => clearInterval(interval);
  }, [demoEnabled]);

  // ── Dynamic visible count via ResizeObserver ────────────────────────
  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;

    const calculate = () => {
      const row = rowRef.current;
      const header = headerRef.current;
      if (!row) return;
      const rowHeight = row.getBoundingClientRect().height;
      if (rowHeight <= 0) return;
      const bodyHeight = body.getBoundingClientRect().height;
      const headerHeight = header ? header.getBoundingClientRect().height : 0;
      const availableHeight = bodyHeight - headerHeight;
      const count = Math.floor(availableHeight / rowHeight);
      setVisibleCount(Math.max(1, count));
    };

    // Double-rAF for reliable measurement after first paint
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(calculate);
    });

    const ro = new ResizeObserver(calculate);
    ro.observe(body);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  // ── Build providers with ratings + demo users ──────────────────────
  const enriched = useMemo<ProviderWithRating[]>(() => {
    void demoUserTick;
    const total = providers.length;

    return providers.map((p, idx) => {
      const rating = toDisplayRating(p, indexRatings.get(p.id));
      if (!hasMounted) rating.hasRankUp = false;

      // Promagen Users: merge demo + real (same algorithm as providers-table)
      const rank = idx + 1;
      const demoData =
        demoEnabled && demoUserTick > 0
          ? generateDemoUsers(p.id, rank, total, p.countryCode?.toUpperCase())
          : [];
      const realData: ReadonlyArray<PromagenUsersCountryUsage> = p.promagenUsers ?? [];

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
          if (b.count !== a.count) return b.count - a.count;
          return rank % 2 === 0
            ? a.countryCode.localeCompare(b.countryCode)
            : b.countryCode.localeCompare(a.countryCode);
        });

      const flagCount = Math.min(MAX_VISIBLE_FLAGS, allCountries.length);
      const visibleFlags = allCountries.slice(0, flagCount);

      return { ...p, indexRating: rating, mergedUsers: allCountries, visibleFlags };
    });
  }, [providers, indexRatings, hasMounted, demoEnabled, demoUserTick]);

  // ── Fixed rank map — rank by rating descending, stable ────────────
  const rankMap = useMemo(() => {
    const byRatingDesc = [...enriched].sort((a, b) => {
      const aVal = a.indexRating?.rating ?? 0;
      const bVal = b.indexRating?.rating ?? 0;
      return bVal - aVal;
    });
    const map = new Map<string, number>();
    byRatingDesc.forEach((p, i) => map.set(p.id, i + 1));
    return map;
  }, [enriched]);

  // ── Sort + cosmetic jitter ────────────────────────────────────────
  const sorted = useMemo(() => {
    void jitterTick;

    const arr = [...enriched];
    arr.sort((a, b) => {
      const aVal = a.indexRating?.rating ?? 0;
      const bVal = b.indexRating?.rating ?? 0;
      return sortDirection === 'desc' ? bVal - aVal : aVal - bVal;
    });

    if (demoEnabled && jitterTick > 0) {
      for (const p of arr) {
        if (p.indexRating && p.indexRating.rating !== null) {
          const jitter =
            (Math.random() * (DEMO_JITTER_MAX - DEMO_JITTER_MIN) + DEMO_JITTER_MIN) *
            (Math.random() > 0.5 ? 1 : -1);
          const base = p.indexRating.rating;
          p.indexRating = {
            ...p.indexRating,
            rating: base + jitter,
            change: jitter,
            changePercent: base > 0 ? (jitter / base) * 100 : 0,
            state: jitter > 0 ? 'gain' : jitter < 0 ? 'loss' : 'flat',
          };
        }
      }
    }

    return arr;
  }, [enriched, jitterTick, sortDirection, demoEnabled]);

  // ── Displayed rows ────────────────────────────────────────────────
  const displayed = isExpanded ? sorted : sorted.slice(0, visibleCount);
  const hiddenCount = sorted.length - visibleCount;

  // ── Sort handler ──────────────────────────────────────────────────
  const handleSort = useCallback(
    (col: SortColumn) => {
      if (sortBy === col) {
        setSortDirection((d) => (d === 'desc' ? 'asc' : 'desc'));
      } else {
        setSortBy(col);
        setSortDirection('desc');
      }
    },
    [sortBy],
  );

  const toggleExpand = useCallback(() => setIsExpanded((v) => !v), []);


  // ============================================================================
  // RENDER — matches providers-table.tsx visual language (globals.css classes)
  // ============================================================================

  return (
    <div
      className="providers-table-container"
      style={{ fontSize: 'clamp(0.8125rem, 1vw, 1rem)', color: 'rgba(226, 232, 240, 1)' }}
    >
      {/* ── Co-located animations ─────────────────────────────────────── */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes leaderboardPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes rankClimberFlash {
          0% { background-color: transparent; }
          50% { background-color: rgba(34, 211, 238, 0.08); }
          100% { background-color: transparent; }
        }
        .rank-climber-rail { animation: rankClimberFlash 2s ease-in-out; }
      `}} />

      {/* ── Scroll wrapper — rounded container, custom scrollbar ────────
           Uses .providers-table-scroll-wrapper from globals.css:
           border-radius: 1rem, border: 1px solid rgba(30,41,59,1),
           background: rgba(2,6,23,0.6), custom webkit scrollbar ──────── */}
      <div
        className="providers-table-scroll-wrapper"
        ref={bodyRef}
        style={{
          overflowY: isExpanded ? 'auto' : 'hidden',
          overflowX: 'hidden',
        }}
      >
        {/* ── Sticky header — matches .providers-table-header ──────────── */}
        <div
          ref={headerRef}
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            background: 'rgba(15, 23, 42, 0.98)',
            backdropFilter: 'blur(8px)',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
            borderBottom: '1px solid rgba(30, 41, 59, 1)',
            fontSize: 'clamp(0.6875rem, 0.9vw, 0.875rem)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'rgba(148, 163, 184, 1)',
            fontWeight: 600,
          }}
        >
          <div style={{
            width: '33.33%',
            textAlign: 'center',
            padding: 'clamp(0.6rem, 0.8vw, 0.75rem) clamp(0.75rem, 1vw, 1rem)',
            borderRight: '1px solid rgba(255, 255, 255, 0.05)',
          }}>
            Provider
          </div>
          <div style={{
            width: '33.33%',
            textAlign: 'center',
            padding: 'clamp(0.6rem, 0.8vw, 0.75rem) clamp(0.75rem, 1vw, 1rem)',
            borderRight: '1px solid rgba(255, 255, 255, 0.05)',
          }}>
            Users (Last Hour)
          </div>
          <div style={{
            width: '33.33%',
            textAlign: 'center',
            padding: 0,
          }}>
            <SortableHeader
              label="Index Rating"
              column="indexRating"
              currentSort={sortBy}
              currentDirection={sortDirection}
              onSort={handleSort}
            />
          </div>
        </div>

        {/* ── Data rows ────────────────────────────────────────────────── */}
        {displayed.map((p, index) => {
          const isSelected = p.id === selectedProviderId;
          const isHovered = hoveredId === p.id;
          const rank = rankMap.get(p.id) ?? (index + 1);
          const iconPath = p.localIcon || `/icons/providers/${p.id}.png`;
          const homepageUrl = `/go/${encodeURIComponent(p.id)}?src=leaderboard_rail`;

          // Brand-color glow (same as community-pulse.tsx)
          const brandHex = PLATFORM_COLORS[p.id] ?? DEFAULT_BRAND_COLOR;
          const glowRgba = hexToRgba(brandHex, 0.3);
          const glowBorder = hexToRgba(brandHex, 0.5);
          const glowSoft = hexToRgba(brandHex, 0.15);

          return (
            <div
              key={p.id}
              ref={index === 0 ? rowRef : undefined}
              data-provider-id={p.id}
              className={p.indexRating?.hasRankUp ? 'rank-climber-rail' : undefined}
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                height: 'clamp(72px, 6vw, 90px)',
                borderTop: '1px solid rgba(30, 41, 59, 1)',
                borderLeft: isSelected
                  ? '3px solid rgba(34, 211, 238, 0.8)'
                  : '3px solid transparent',
                boxShadow: isHovered
                  ? `0 0 20px 4px ${glowRgba}, 0 0 40px 8px ${glowSoft}, inset 0 0 15px 2px ${glowRgba}`
                  : 'none',
                outline: isHovered ? `1px solid ${glowBorder}` : 'none',
                outlineOffset: '-1px',
                backgroundColor: isSelected
                  ? 'rgba(8, 145, 178, 0.12)'
                  : 'transparent',
                transition: 'box-shadow 400ms ease-out, outline-color 400ms ease-out, background-color 300ms ease',
                overflow: 'hidden',
              }}
              onMouseEnter={() => setHoveredId(p.id)}
              onMouseLeave={() => setHoveredId(null)}
              aria-label={`${p.name} — rank ${rank}`}
            >
              {/* ── Hover glow overlays ────────────────────────────────── */}
              <span
                className="pointer-events-none"
                style={{
                  position: 'absolute', inset: 0,
                  background: `radial-gradient(ellipse at 50% 0%, ${glowRgba} 0%, transparent 70%)`,
                  opacity: isHovered ? 1 : 0,
                  transition: 'opacity 400ms ease-out',
                  zIndex: 0,
                }}
                aria-hidden="true"
              />
              <span
                className="pointer-events-none"
                style={{
                  position: 'absolute', inset: 0,
                  background: `radial-gradient(ellipse at 50% 100%, ${glowSoft} 0%, transparent 60%)`,
                  opacity: isHovered ? 0.6 : 0,
                  transition: 'opacity 400ms ease-out',
                  zIndex: 0,
                }}
                aria-hidden="true"
              />

              {/* ── Col 1: Provider ────────────────────────────────────── */}
              <div style={{
                width: '33.33%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'clamp(3px, 0.3vw, 5px)',
                padding: 'clamp(0.5rem, 0.6vw, 0.75rem) clamp(0.75rem, 1vw, 1rem)',
                borderRight: '1px solid rgba(255, 255, 255, 0.05)',
                overflow: 'hidden',
                position: 'relative', zIndex: 1,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(3px, 0.3vw, 6px)' }}>
                  <span style={{
                    fontSize: 'clamp(0.6rem, 0.75vw, 0.85rem)',
                    color: '#CBD5E1', fontWeight: 500, flexShrink: 0,
                  }}>
                    {rank}.
                  </span>
                  <a
                    href={homepageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="cursor-pointer"
                    aria-label={`Visit ${p.name} website (opens in new tab)`}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                    style={{ flexShrink: 0, lineHeight: 0 }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={iconPath}
                      alt=""
                      style={{
                        width: 'clamp(18px, 1.5vw, 24px)',
                        height: 'clamp(18px, 1.5vw, 24px)',
                        padding: 'clamp(1px, 0.1vw, 2px)',
                        borderRadius: 'clamp(3px, 0.25vw, 5px)',
                        background: 'rgba(255, 255, 255, 0.10)',
                        boxShadow: '0 0 0 1px rgba(255, 255, 255, 0.15)',
                      }}
                      onError={(e) => {
                        const target = e.currentTarget;
                        if (target.src !== FALLBACK_ICON) target.src = FALLBACK_ICON;
                      }}
                    />
                  </a>
                  {p.indexRating?.hasRankUp && (
                    <span style={{ fontSize: 'clamp(0.55rem, 0.6vw, 0.75rem)', flexShrink: 0 }} title="Climbed in rankings (24h)">⬆</span>
                  )}
                </div>
                <span
                  className="cursor-pointer"
                  title={`Optimise a prompt for ${p.name}`}
                  style={{
                    fontSize: 'clamp(0.6rem, 0.8vw, 0.95rem)',
                    color: '#F1F5F9', fontWeight: 500,
                    textAlign: 'center',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    maxWidth: '100%',
                  }}
                  onClick={() => onSelectProvider(p.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectProvider(p.id); } }}
                  role="button" tabIndex={0}
                  aria-label={`Select ${p.name} for optimisation`}
                >
                  {p.name}
                </span>
              </div>

              {/* ── Col 2: Promagen Users ──────────────────────────────── */}
              <div style={{
                width: '33.33%', height: '100%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 'clamp(0.5rem, 0.6vw, 0.75rem) clamp(0.75rem, 1vw, 1rem)',
                borderRight: '1px solid rgba(255, 255, 255, 0.05)',
                overflow: 'hidden', position: 'relative', zIndex: 1,
              }}>
                <PromagenUsersRailCell
                  allCountries={p.mergedUsers}
                  visibleFlags={p.visibleFlags}
                />
              </div>

              {/* ── Col 3: Index Rating ────────────────────────────────── */}
              <div style={{
                width: '33.33%', height: '100%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 'clamp(0.5rem, 0.6vw, 0.75rem) clamp(0.75rem, 1vw, 1rem)',
                overflow: 'hidden', position: 'relative', zIndex: 1,
              }}>
                {p.indexRating ? (
                  <IndexRatingCell rating={p.indexRating} />
                ) : (
                  <span style={{ color: 'rgba(255, 255, 255, 0.7)' }}>—</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Show All / Collapse toggle ─────────────────────────────────── */}
      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={toggleExpand}
          className="cursor-pointer"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 'clamp(4px, 0.3vw, 6px)',
            padding: 'clamp(8px, 0.6vw, 12px) 0',
            marginTop: 'clamp(2px, 0.2vw, 4px)',
            border: 'none', background: 'transparent', width: '100%',
            fontSize: 'clamp(0.7rem, 0.85vw, 0.9rem)', fontWeight: 500,
            color: '#22d3ee', letterSpacing: '0.03em',
            transition: 'color 0.15s ease', flexShrink: 0,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#67e8f9'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = '#22d3ee'; }}
          aria-expanded={isExpanded}
        >
          <span style={{
            display: 'inline-block', transition: 'transform 0.25s ease',
            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
          }}>
            ▼
          </span>
          {isExpanded ? `Show Top ${visibleCount}` : `Show all ${sorted.length}`}
        </button>
      )}

      {/* ── Live indicator ─────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center',
        gap: 'clamp(4px, 0.3vw, 6px)',
        padding: 'clamp(6px, 0.5vw, 10px) clamp(8px, 0.7vw, 14px)',
        flexShrink: 0,
      }}>
        <span style={{
          width: 'clamp(6px, 0.5vw, 8px)', height: 'clamp(6px, 0.5vw, 8px)',
          borderRadius: '50%', backgroundColor: '#22c55e',
          boxShadow: '0 0 4px rgba(34, 197, 94, 0.6)',
          animation: 'leaderboardPulse 2s ease-in-out infinite',
        }} />
        <span style={{ fontSize: 'clamp(0.65rem, 0.8vw, 0.85rem)', color: '#22c55e', fontWeight: 500 }}>
          Live
        </span>
        <span style={{ fontSize: 'clamp(0.65rem, 0.8vw, 0.85rem)', color: '#E2E8F0', marginLeft: 'auto' }}>
          {sorted.length} platforms
        </span>
      </div>
    </div>
  );
}

export default LeaderboardRail;
