// src/data/exchanges/exchange-colors.ts
// ============================================================================
// EXCHANGE HOVER COLORS - Quick Reference
// ============================================================================
// Maps exchange IDs to their unique vibrant hover colors.
// Used by exchange-card.tsx for hover state styling.
// Colors are pre-assigned in exchanges.catalog.json (SSOT).
// ============================================================================

/**
 * Exchange hover color map.
 * Each exchange has a unique vibrant color for its hover state.
 *
 * Color palette designed for:
 * - High visibility on dark backgrounds
 * - Visual distinctiveness (no two similar colors)
 * - Brand-neutral vibrancy
 *
 * @example
 * ```ts
 * import { EXCHANGE_HOVER_COLORS } from './exchange-colors';
 * const tokyoColor = EXCHANGE_HOVER_COLORS['tse-tokyo']; // '#FF4500'
 * ```
 */
export const EXCHANGE_HOVER_COLORS: Record<string, string> = {
  // Middle East / Gulf
  'adx-abu-dhabi': '#FFB347',      // Apricot
  'ase-amman': '#D4A574',          // Desert Sand
  'dfm-dubai': '#FFD700',          // Gold
  'qse-doha': '#8B008B',           // Dark Magenta
  'tadawul-riyadh': '#DAA520',     // Goldenrod
  'tase-tel-aviv': '#00BFFF',      // Deep Sky Blue
  'egx-cairo': '#C4A35A',          // Aztec Gold

  // Asia Pacific - East
  'tse-tokyo': '#FF4500',          // Orange Red
  'hkex-hong-kong': '#FF3B5C',     // Cherry Red
  'sse-shanghai': '#FF1493',       // Deep Pink
  'szse-shenzhen': '#FF69B4',      // Hot Pink
  'krx-seoul': '#EC4899',          // Pink
  'twse-taipei': '#9370DB',        // Medium Purple

  // Asia Pacific - Southeast
  'sgx-singapore': '#E879F9',      // Fuchsia Pink
  'set-bangkok': '#D946EF',        // Electric Violet
  'bursa-kuala-lumpur': '#FBBF24', // Amber
  'pse-manila': '#FF7F50',         // Coral
  'idx-jakarta': '#4ADE80',        // Green (SE hemisphere)

  // Asia Pacific - South
  'bse-mumbai': '#F97316',         // Orange
  'nse-mumbai': '#FF8C00',         // Dark Orange
  'cse-colombo': '#FB923C',        // Light Orange

  // Oceania
  'asx-sydney': '#10B981',         // Emerald
  'nzx-wellington': '#00FF7F',     // Spring Green

  // Europe - Western
  'lse-london': '#8B5CF6',         // Violet
  'euronext-paris': '#6366F1',     // Indigo
  'euronext-amsterdam': '#F472B6', // Pink
  'euronext-brussels': '#818CF8',  // Light Indigo
  'euronext-lisbon': '#2DD4BF',    // Teal
  'six-zurich': '#C084FC',         // Purple

  // Europe - Southern
  'bme-madrid': '#FCD34D',         // Yellow
  'borsa-italiana-milan': '#34D399', // Emerald Light
  'athex-athens': '#60A5FA',       // Blue
  'bist-istanbul': '#FF6B6B',      // Light Red

  // Europe - Eastern
  'moex-moscow': '#EF4444',        // Red
  'gpw-warsaw': '#DC2626',         // Dark Red
  'budapest-bet': '#A78BFA',       // Light Violet

  // Europe - Nordic
  'nasdaq-stockholm': '#14B8A6',   // Teal
  'nasdaq-copenhagen': '#38BDF8',  // Sky Blue
  'nasdaq-helsinki': '#0EA5E9',    // Light Blue

  // Americas - North
  'nyse-new-york': '#2563EB',      // Blue
  'nasdaq-new-york': '#06B6D4',    // Cyan
  'nasdaq-san-francisco': '#22D3EE', // Light Cyan
  'cboe-chicago': '#3B82F6',       // Bright Blue
  'tsx-toronto': '#7B68EE',        // Medium Slate Blue

  // Americas - South
  'b3-sao-paulo': '#22C55E',       // Green
  'bcba-buenos-aires': '#87CEEB',  // Sky Blue
  'sse-santiago': '#00CED1',       // Dark Turquoise

  // Africa
  'jse-johannesburg': '#F59E0B',   // Amber
} as const;

/**
 * Get hover color for an exchange by ID.
 * Falls back to a default color if exchange not found.
 */
export function getExchangeHoverColor(id: string): string {
  return EXCHANGE_HOVER_COLORS[id] ?? '#A855F7'; // Default purple
}

/**
 * CSS custom property name for exchange hover color.
 * Used in exchange-card.tsx for dynamic styling.
 */
export const HOVER_COLOR_CSS_VAR = '--exchange-hover-color';
