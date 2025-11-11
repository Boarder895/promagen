import type { Exchange } from "./types";

/**
 * Deterministic numeric seed from an exchange's city.
 * Normalises (trim/lower) so " Tokyo " and "TOKYO" hash the same.
 * Fast, allocation-free loop for longevity.
 */
export function citySeed(exchange: Pick<Exchange, "city">): number {
  const s = (exchange.city ?? "").trim().toLowerCase();
  let acc = 0;
  for (let i = 0; i < s.length; i++) {acc += s.charCodeAt(i);}
  return acc;
}



