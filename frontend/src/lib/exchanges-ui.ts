// UI-friendly layer on top of static exchange data. No helpers here.

import { exchanges, type ExchangeInfo } from "@/data/exchanges";

/**
 * What the UI wants (adds optional fields that may be present in JSON).
 * IMPORTANT: Do NOT collide with ExchangeInfo.open (string) — use isOpen?: boolean.
 */
export type ExchangeUI = ExchangeInfo & {
  /** short label used in ribbons */
  code: string;
  /** optional UI temp (Stage 1 stub) */
  temp?: number;
  /** optional UI local time (Stage 1 stub) */
  localTime?: string;
  /** UI-friendly flag; separate from ExchangeInfo.open (string) */
  isOpen?: boolean;
};

/** Narrowly-typed “extra” fields that might appear in the JSON */
type Extras = {
  code?: unknown;
  temp?: unknown;
  localTime?: unknown;
  /** some legacy sources may put a boolean here; we map it to isOpen */
  open?: unknown;
};

/** Deterministic mapper with guards (no `any`, no conflicting `open`) */
export const exchangesUI: ExchangeUI[] = (exchanges as ExchangeInfo[]).map((e) => {
  const x = e as ExchangeInfo & Extras;

  const code = typeof x.code === "string" ? x.code : e.exchange;
  const temp = typeof x.temp === "number" ? x.temp : undefined;
  const localTime = typeof x.localTime === "string" ? x.localTime : undefined;
  const maybeBoolOpen = typeof x.open === "boolean" ? (x.open as boolean) : undefined;

  return {
    ...e,
    code,
    ...(temp !== undefined ? { temp } : {}),
    ...(localTime !== undefined ? { localTime } : {}),
    ...(maybeBoolOpen !== undefined ? { isOpen: maybeBoolOpen } : {}),
  };
});







