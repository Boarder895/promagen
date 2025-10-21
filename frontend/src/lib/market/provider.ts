// src/lib/market/provider.ts
import type { Exchange, MarketState, MarketStatus } from '../market/types';

/**
 * Stage-1 heuristic provider:
 * - "open" if local time (in the exchange tz) is between 09:00–17:00 on a weekday.
 * - otherwise "closed".
 * No holidays yet (Stage-3 will add real calendars).
 */
export function getMarketState(exchange: Exchange): MarketState {
  try {
    const now = new Date();

    // Pull hour + weekday in the exchange time zone
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat('en-GB', {
        timeZone: exchange.tz,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        weekday: 'short',
      })
        .formatToParts(now)
        .map(p => [p.type, p.value])
    );

    const hour = Number(parts.hour);
    const weekday = (parts.weekday || '').toLowerCase(); // mon/tue/...

    const isWeekend = ['sat', 'sun'].some(w => weekday.startsWith(w));
    const isOpenHours = hour >= 9 && hour < 17;
    const status: MarketStatus = !isWeekend && isOpenHours ? 'open' : 'closed';

    // Next change: if open -> 17:00 today in that tz; else -> next 09:00 weekday in that tz
    let nextChange = new Date(now);
    if (status === 'open') {
      // set to 17:00 local in that tz by taking today's date and setting hours (approx using system clock)
      nextChange.setHours(17, 0, 0, 0);
    } else {
      // find next weekday and set 09:00
      for (let i = 0; i < 7; i++) {
        const probe = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
        const probeWeekday = new Intl.DateTimeFormat('en-GB', { timeZone: exchange.tz, weekday: 'short' })
          .format(probe)
          .toLowerCase();
        const weekend = ['sat', 'sun'].some(w => probeWeekday.startsWith(w));
        if (!weekend) {
          const nextLocal = new Date(probe);
          nextLocal.setHours(9, 0, 0, 0);
          nextChange = nextLocal;
          break;
        }
      }
    }

    return { id: exchange.id, status, nextChangeISO: nextChange.toISOString() };
  } catch {
    return { id: exchange.id, status: 'unknown', nextChangeISO: null };
  }
}

/** Keep for UI parity; identity mapping for now. */
export function metaToNeutralStatus(state: MarketState): MarketStatus {
  return state.status ?? 'unknown';
}

