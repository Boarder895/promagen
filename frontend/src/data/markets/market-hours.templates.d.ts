// frontend/src/data/markets/market-hours.templates.d.ts

declare module '@/data/markets/market-hours.templates.json' {
  export type MarketSession = {
    /** e.g. "Mon-Fri" */
    days: string;
    /** Local open time, 24h "HH:mm" */
    open: string;
    /** Local close time, 24h "HH:mm" */
    close: string;
  };

  export type MarketHoursTemplate = {
    label: string;
    session: MarketSession[];
    notes?: string;
  };

  export interface MarketHoursTemplateFile {
    $schema: string;
    version: number;
    templates: Record<string, MarketHoursTemplate>;
  }

  const templates: MarketHoursTemplateFile;
  export default templates;
}
