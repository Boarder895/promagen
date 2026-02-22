// src/lib/weather/day-night.ts
// ============================================================================
// DAY / NIGHT DETECTION — Shared 3-Tier Cascade
// ============================================================================
// Extracted from exchange-card.tsx so both exchange cards AND provider cells
// (and any future consumer) use the same deterministic resolution logic.
//
// 3-Tier cascade (most accurate → least):
//   1. OWM sunrise/sunset UTC timestamps + timezone offset → local time-of-day
//   2. IANA timezone string → local hour check (< 6 or ≥ 19)
//   3. Gateway isDayTime boolean flag (snapshot, up to 4 hours stale)
//   4. Fallback: assume daytime (safest default — shows weather emoji, not moon)
//
// Authority: docs/authority/exchange-card-weather.md §6.3
// Existing features preserved: Yes (extracted, not modified)
// ============================================================================

/**
 * Determine whether it's currently night at a given location.
 *
 * Uses a 3-tier cascade with the most accurate data source available:
 *
 * **Tier 1 — Sunrise/sunset timestamps (exact)**
 * OWM provides precise sunrise/sunset for each city. We extract the
 * time-of-day portion (seconds since local midnight) so it doesn't
 * matter what *date* the data was fetched on — sunrise and sunset
 * times shift by only seconds day-to-day.
 *
 * **Tier 2 — IANA timezone (±30 min)**
 * If sunrise/sunset data is missing, use the IANA timezone string
 * to determine the local hour. Before 6am or after 7pm → night.
 *
 * **Tier 3 — Gateway isDayTime flag (stale snapshot)**
 * Last resort. This is a snapshot from when OWM was queried,
 * which could be up to 4 hours ago.
 *
 * **Fallback:** Assume daytime (safest default — shows weather emoji).
 *
 * @param isDayTime  - Gateway isDayTime flag (boolean | null)
 * @param tz         - IANA timezone string (e.g. "Pacific/Auckland")
 * @param sunriseUtc - Sunrise UTC timestamp in seconds (from OWM)
 * @param sunsetUtc  - Sunset UTC timestamp in seconds (from OWM)
 * @param timezoneOffset - City timezone offset from UTC in seconds
 * @returns true if it's currently night at this location
 */
export function resolveIsNight(
  isDayTime: boolean | null,
  tz: string,
  sunriseUtc: number | null,
  sunsetUtc: number | null,
  timezoneOffset: number | null,
): boolean {
  // ── Tier 1: Sunrise/sunset → local time-of-day ────────────────────
  if (
    typeof sunriseUtc === 'number' &&
    typeof sunsetUtc === 'number' &&
    typeof timezoneOffset === 'number'
  ) {
    const SECONDS_PER_DAY = 86400;
    const nowUtc = Math.floor(Date.now() / 1000);

    // Convert to seconds-since-local-midnight (double-mod for negative offsets)
    const nowLocal =
      (((nowUtc + timezoneOffset) % SECONDS_PER_DAY) + SECONDS_PER_DAY) % SECONDS_PER_DAY;
    const sunriseLocal =
      (((sunriseUtc + timezoneOffset) % SECONDS_PER_DAY) + SECONDS_PER_DAY) % SECONDS_PER_DAY;
    const sunsetLocal =
      (((sunsetUtc + timezoneOffset) % SECONDS_PER_DAY) + SECONDS_PER_DAY) % SECONDS_PER_DAY;

    // Day = between sunrise and sunset (local time-of-day)
    return nowLocal < sunriseLocal || nowLocal > sunsetLocal;
  }

  // ── Tier 2: IANA timezone → local hour (always available) ──────────
  if (tz) {
    try {
      const localHourStr = new Date().toLocaleString('en-GB', {
        timeZone: tz,
        hour: 'numeric',
        hour12: false,
      });
      const localHour = parseInt(localHourStr, 10);
      if (!isNaN(localHour)) {
        // Before 6am or after 7pm → night
        return localHour < 6 || localHour >= 19;
      }
    } catch (_e) {
      // Invalid tz string — fall through
    }
  }

  // ── Tier 3: Gateway isDayTime flag (stale snapshot — last resort) ──
  if (isDayTime === true) return false;
  if (isDayTime === false) return true;

  // ── Fallback: assume daytime (safest default) ──────────────────────
  return false;
}
