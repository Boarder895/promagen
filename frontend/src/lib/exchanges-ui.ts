// src/lib/exchanges-ui.ts
// UI-friendly layer on top of static exchange data. No helpers here.

import { exchanges, type ExchangeInfo } from "@/data/exchanges";

export type ExchangeUI = ExchangeInfo & {
  code: string;       // short label used in ribbons
  temp?: number;      // UI stub in Stage 1
  localTime?: string; // UI stub in Stage 1
  open?: boolean;     // UI stub (computed later in Stage 2)
};

export const exchangesUI: ExchangeUI[] = exchanges.map((e: ExchangeInfo) => ({
  ...e,
  code: (e as any).code ?? e.exchange,
  temp: typeof (e as any).temp === "number" ? (e as any).temp : 20,
  localTime: (e as any).localTime ?? "",
  open: typeof (e as any).open === "boolean" ? (e as any).open : false,
}));




