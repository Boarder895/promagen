// UI-friendly adapter over the exchanges catalog for Stage-1.
// No 'any' — just safe defaults so the ribbons render cleanly.

import { EXCHANGES, SELECTED_IDS, type Exchange } from "@/data/exchanges";
import type { ExchangeInfo } from "@/types/ribbon";

export type ExchangeUI = ExchangeInfo & {
  /** Short label shown on cards (defaults to exchange code) */
  code: string;
  /** Temperature °C (stub until weather is wired) */
  temp: number;
  /** Preformatted local time (we also compute on the card; empty is fine) */
  localtime: string;
  /** Market open/closed flag (stub; engine comes later) */
  open: boolean;
};

function getSelectedExchanges(): Exchange[] {
  const byId = new Map(EXCHANGES.map(e => [e.id, e]));
  return SELECTED_IDS.map(id => byId.get(id)!).filter((e): e is Exchange => Boolean(e));
}

export const exchangesUI: ExchangeUI[] = getSelectedExchanges().map((e: Exchange) => ({
  ...e,
  code: e.exchange,
  temp: 20,     // neutral default
  localtime: "",// computed at render if needed
  open: false,  // neutral default
}));







