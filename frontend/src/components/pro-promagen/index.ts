// src/components/pro-promagen/index.ts
// ============================================================================
// PRO PROMAGEN COMPONENT EXPORTS
// ============================================================================

// Exchange Picker
export {
  ExchangePicker,
  type ExchangePickerProps,
} from './exchange-picker';

// Re-export ExchangeOption type from helpers (avoids circular imports)
export type { ExchangeOption } from '@/lib/pro-promagen/exchange-picker-helpers';

// Comparison Table
export {
  ComparisonTable,
  type ComparisonTableProps,
  type SelectionItem,
} from './comparison-table';

// Upgrade CTA
export {
  UpgradeCta,
  type UpgradeCtaProps,
} from './upgrade-cta';
