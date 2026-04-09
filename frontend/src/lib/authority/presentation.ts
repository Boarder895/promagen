// src/lib/authority/presentation.ts
// ============================================================================
// AUTHORITY PAGES — SHARED PRESENTATION CONSTANTS
// ============================================================================
// Single source of truth for all colour, badge, and style constants used
// across authority pages (hub, profiles, negative prompt guide, table).
//
// Previously duplicated in:
//   - src/app/platforms/page.tsx (TIER_BADGE, TIER_CARD_BG, NEG_SUPPORT_COLOR)
//   - src/app/platforms/[platformId]/page.tsx (TIER_BADGE, NEG_COLOR)
//   - src/components/authority/platform-hub-table.tsx (TIER_BADGE, NEG_COLOR)
//
// RULES:
//   - Zero presentation logic in the data layer (platform-data.ts)
//   - Components import from here, never define their own colour maps
//   - No Tailwind classes — raw values only (components apply them)
//   - Hex values with alpha suffixes (e.g. #38bdf833) are applied at use site
//
// Authority: code-standard.md §2 (One Truth Rule)
// ============================================================================

import type { NegativeSupportType } from './platform-data';

// ─── Tier badge colours ─────────────────────────────────────────────────────

export interface TierBadge {
  /** Primary fill colour */
  bg: string;
  /** Text / accent colour (lighter variant for contrast) */
  text: string;
  /** Border / highlight colour */
  border: string;
}

export const TIER_BADGE: Record<number, TierBadge> = {
  1: { bg: '#0ea5e9', text: '#e0f2fe', border: '#38bdf8' },
  2: { bg: '#8b5cf6', text: '#ede9fe', border: '#a78bfa' },
  3: { bg: '#10b981', text: '#d1fae5', border: '#34d399' },
  4: { bg: '#f59e0b', text: '#fef3c7', border: '#fbbf24' },
};

export const DEFAULT_TIER_BADGE: TierBadge = {
  bg: '#f59e0b',
  text: '#fef3c7',
  border: '#fbbf24',
};

/** Safe getter — never undefined */
export function getTierBadge(tier: number): TierBadge {
  return TIER_BADGE[tier] ?? DEFAULT_TIER_BADGE;
}

// ─── Tier card backgrounds (low-opacity fills for tier explainer cards) ─────

export const TIER_CARD_BG: Record<number, string> = {
  1: 'rgba(14, 165, 233, 0.12)',
  2: 'rgba(139, 92, 246, 0.12)',
  3: 'rgba(16, 185, 129, 0.12)',
  4: 'rgba(245, 158, 11, 0.12)',
};

// ─── Negative prompt support colours ────────────────────────────────────────

export const NEG_SUPPORT_COLOR: Record<NegativeSupportType, string> = {
  separate: '#34d399',
  inline: '#fbbf24',
  none: '#E2E8F0',
};

export const NEG_SUPPORT_LABEL: Record<NegativeSupportType, string> = {
  separate: 'Separate field',
  inline: 'Inline syntax',
  none: 'Not supported',
};

// ─── Common style constants ─────────────────────────────────────────────────

/** Standard cell padding for authority tables */
export const TABLE_CELL_PAD = `clamp(6px, 0.7vw, 10px) clamp(10px, 1.2vw, 18px)`;

/** Subtle card background */
export const CARD_BG = 'rgba(255,255,255,0.03)';

/** Subtle card border */
export const CARD_BORDER = '1px solid rgba(255,255,255,0.08)';

/** Row stripe (even rows) */
export const ROW_STRIPE = 'rgba(255,255,255,0.02)';

/** Divider line */
export const DIVIDER = '1px solid rgba(255,255,255,0.1)';
