// UI-friendly adapter over the exchange catalog for Stage-1.
// No 'any', just safe defaults so the ribbons render cleanly.

import { EXCHANGE_CATALOG } from '@/data/exchanges';
import type { ExchangeInfo } from "@/types/ribbon";

export type ExchangeUI = ExchangeInfo & {
  /** Short label shown on cards (defaults to exchange code) */
  code: string;
  /** Temperature °C used for the climate tint (stub until weather is wired) */
  temp: number;
  /** Preformatted local time (we also compute on the card; empty is fine) */
  localTime: string;
  /** Market open/closed flag (stub; engine comes later) */
  open: boolean;
};

export const exchangesUI: ExchangeUI[] = EXCHANGE_CATALOG.map((e) => ({
  ...e,
  code: e.exchange,
  temp: 20,       // neutral default
  localTime: "",  // computed at render if needed
  open: false,    // neutral default
}));






