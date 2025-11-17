// frontend/src/data/markets/bundle.free+top10.d.ts

declare module '@/data/markets/bundle.free+top10.json' {
  /** Metadata for “free + top10” holiday bundle entries, kept open for now. */
  export interface ExchangeHolidayMeta {
    [key: string]: unknown;
  }

  export type TopHolidayBundle = Record<string, ExchangeHolidayMeta>;

  const bundle: TopHolidayBundle;
  export default bundle;
}
