import EXCHANGES, { type Exchange } from "@/data/exchanges";
import selected from "@/data/exchanges.selected.json";

/** Single source of truth — comes from exchanges.selected.json */
type SelectedConfig = { ids: string[] };
export const SELECTED_IDS: string[] = (selected as SelectedConfig).ids;

/** Normalise keys (handles 'asx' and 'asx-sydney' etc.) */
function norm(v: unknown) {
  return String(v ?? "").trim().toLowerCase();
}

/** Flexible lookup:
 *  1) exact match on exchange.id
 *  2) match on the first token before '-' (e.g., 'asx' from 'asx-sydney')
 *  3) match on full slug against `${id}-${city}` if your data uses that form
 */
export function byIdFlexible(id: string): Exchange | undefined {
  const k = norm(id);
  const head = k.split("-")[0];

  // 1) exact id
  let found = EXCHANGES.find((e) => norm(e.id) === k);
  if (found) {return found;}

  // 2) token head against id
  found = EXCHANGES.find((e) => norm(e.id) === head);
  if (found) {return found;}

  // 3) try `${id}-${city}` style
  found = EXCHANGES.find((e) => {
    const slug = `${norm(e.id)}-${norm(e.city)}`;
    return slug === k;
  });
  return found;
}

/** The selected exchanges as typed objects (filters unknown ids). */
export function getSelectedExchanges(): Exchange[] {
  return SELECTED_IDS.map(byIdFlexible).filter(Boolean) as Exchange[];
}

/** Convenience mapper for ribbons/rows. */
export function toRibbonItems(src: Exchange[]) {
  return src.map((e) => ({
    code: String(e.id ?? ""),
    name: String(e.name ?? ""),
    city: e.city,
    tz: e.tz,
  }));
}

/** Back-compat helpers some files expect */
export function exchangesUI(): Exchange[] {
  return getSelectedExchanges();
}
export type ExchangeUI = Exchange;
// Value alias is intentionally not provided (it would be a type error).

/** Dev guard: log any ids that didn’t resolve */
const _unknown = SELECTED_IDS.filter((id) => !byIdFlexible(id));
if (process.env.NODE_ENV !== "production" && _unknown.length) {
  // eslint-disable-next-line no-console
  console.warn("[exchanges-ui] Unknown exchange ids:", _unknown);
}

export default {
  SELECTED_IDS,
  byIdFlexible,
  getSelectedExchanges,
  exchangesUI,
  toRibbonItems,
};

