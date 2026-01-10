// src/components/pro-promagen/index.ts
// ============================================================================
// PRO PROMAGEN COMPONENTS - Barrel Export
// ============================================================================
// Simplified exports for revised Pro Promagen page.
// Authority: docs/authority/paid_tier.md §5.10
//
// REMOVED (no longer used):
// - PresetCard (dropdowns now in comparison table)
// - SelectionPanel (replaced by inline dropdowns)
// - ProgressBar (removed from design)
// - ComingSoonPanel (Commodities/Crypto removed from display)
// - PerksPanel (Vote Weight/Market Pulse removed from display)
// - PreviewExchangeCard (now uses real ExchangeCard)
// ============================================================================

export { ComparisonTable } from './comparison-table';
export type { ComparisonTableProps, SelectionItem } from './comparison-table';

export { UpgradeCta } from './upgrade-cta';
export type { UpgradeCtaProps } from './upgrade-cta';
