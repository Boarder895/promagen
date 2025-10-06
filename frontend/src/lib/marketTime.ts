// src/lib/marketTime.ts
// Region + timing helpers (no re-exports; computeMarket lives in '@/lib/markets').

import { DateTime } from 'luxon';
import type { Market, Region } from '@/lib/markets';

/** Safely coerce optional region to a concrete Region (default 'europe'). */
export const regionOf = (market: Market): Region =>
  (market.region ?? 'europe') as Region;

/** True if dt (UTC by default) is inside the market's open window on a trading day. */
export const isTradingNow = (market: Market, dt: DateTime = DateTime.utc()): boolean => {
  const local = dt.setZone(market.tz);
  const days = market.days ?? [1, 2, 3, 4, 5];
  const weekday0 = local.weekday % 7; // 0=Sun … 6=Sat
  if (!days.includes(weekday0)) return false;

  const holiday = (market.holidays ?? []).some(fn => {
    try { return fn(local); } catch { return false; }
  });
  if (holiday) return false;

  const openAt  = local.set({ hour: market.open[0],  minute: market.open[1],  second: 0, millisecond: 0 });
  const closeAt = local.set({ hour: market.close[0], minute: market.close[1], second: 0, millisecond: 0 });
  return local >= openAt && local <= closeAt;
};

/** e.g., "09:00–16:30" */
export const formatMarketHours = (market: Market): string => {
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  const [oh, om] = market.open;
  const [ch, cm] = market.close;
  return `${pad(oh)}:${pad(om)}–${pad(ch)}:${pad(cm)}`;
};






