// frontend/src/data/markets/market-holidays.bundle.free(tpl).d.ts

declare module '@/data/markets/market-holidays.bundle.free(tpl).json' {
  /** Bag of per-exchange holiday/template info (currently open-ended). */
  export interface ExchangeHolidayTemplate {
    // We keep this permissive for now; the schema validator will tighten it later.
    [key: string]: unknown;
  }

  export type MarketHolidayBundle = Record<string, ExchangeHolidayTemplate>;

  const bundle: MarketHolidayBundle;
  export default bundle;
}
