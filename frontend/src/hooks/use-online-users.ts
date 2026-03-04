// src/hooks/use-online-users.ts
// ============================================================================
// ONLINE USERS HOOK — Heartbeat sender + polling
// ============================================================================
// Two responsibilities:
// 1. Sends POST /api/heartbeat every 60 seconds with the user's country code
//    (derived from Intl timezone — not PII)
// 2. Polls GET /api/online-users every 30 seconds for aggregated counts
//
// The component should only render when total ≥ 50 (threshold gate §8.2).
//
// Authority: docs/authority/homepage.md §8.4, §8.5
// Existing features preserved: Yes (additive hook only)
// ============================================================================

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { OnlineUsersResponse, OnlineCountryEntry } from '@/types/homepage';

// ============================================================================
// TYPES
// ============================================================================

export interface UseOnlineUsersResult {
  /** Total concurrent users across all countries */
  total: number;
  /** Per-country breakdown, sorted by count descending */
  countries: OnlineCountryEntry[];
  /** True during initial fetch only */
  isLoading: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Heartbeat interval: 60 seconds per spec §8.4. */
const HEARTBEAT_INTERVAL_MS = 60_000;

/** Online users poll interval: 30 seconds per spec §8.5. */
const POLL_INTERVAL_MS = 30_000;

/** Fetch timeout: fail fast, don't block UI. */
const FETCH_TIMEOUT_MS = 5_000;

// ============================================================================
// TIMEZONE → COUNTRY CODE MAPPING
// ============================================================================
// Best-effort mapping from IANA timezone to ISO 3166-1 alpha-2 country code.
// IANA timezones use the form "Region/City" — the region often maps to a country.
// This is NOT PII: timezones are shared by millions of people.
// ============================================================================

const TZ_TO_COUNTRY: Record<string, string> = {
  // Europe
  'Europe/London': 'GB', 'Europe/Paris': 'FR', 'Europe/Berlin': 'DE',
  'Europe/Madrid': 'ES', 'Europe/Rome': 'IT', 'Europe/Amsterdam': 'NL',
  'Europe/Brussels': 'BE', 'Europe/Zurich': 'CH', 'Europe/Vienna': 'AT',
  'Europe/Stockholm': 'SE', 'Europe/Oslo': 'NO', 'Europe/Copenhagen': 'DK',
  'Europe/Helsinki': 'FI', 'Europe/Warsaw': 'PL', 'Europe/Prague': 'CZ',
  'Europe/Budapest': 'HU', 'Europe/Bucharest': 'RO', 'Europe/Athens': 'GR',
  'Europe/Istanbul': 'TR', 'Europe/Lisbon': 'PT', 'Europe/Dublin': 'IE',
  'Europe/Moscow': 'RU', 'Europe/Kiev': 'UA', 'Europe/Belgrade': 'RS',
  'Europe/Zagreb': 'HR', 'Europe/Sofia': 'BG', 'Europe/Vilnius': 'LT',
  'Europe/Riga': 'LV', 'Europe/Tallinn': 'EE',
  // Americas
  'America/New_York': 'US', 'America/Chicago': 'US', 'America/Denver': 'US',
  'America/Los_Angeles': 'US', 'America/Phoenix': 'US', 'America/Anchorage': 'US',
  'Pacific/Honolulu': 'US', 'America/Toronto': 'CA', 'America/Vancouver': 'CA',
  'America/Edmonton': 'CA', 'America/Winnipeg': 'CA', 'America/Halifax': 'CA',
  'America/St_Johns': 'CA', 'America/Mexico_City': 'MX', 'America/Cancun': 'MX',
  'America/Sao_Paulo': 'BR', 'America/Rio_Branco': 'BR', 'America/Manaus': 'BR',
  'America/Argentina/Buenos_Aires': 'AR', 'America/Santiago': 'CL',
  'America/Lima': 'PE', 'America/Bogota': 'CO', 'America/Caracas': 'VE',
  // Asia
  'Asia/Tokyo': 'JP', 'Asia/Seoul': 'KR', 'Asia/Shanghai': 'CN',
  'Asia/Hong_Kong': 'HK', 'Asia/Taipei': 'TW', 'Asia/Singapore': 'SG',
  'Asia/Kuala_Lumpur': 'MY', 'Asia/Bangkok': 'TH', 'Asia/Jakarta': 'ID',
  'Asia/Manila': 'PH', 'Asia/Ho_Chi_Minh': 'VN', 'Asia/Kolkata': 'IN',
  'Asia/Colombo': 'LK', 'Asia/Dhaka': 'BD', 'Asia/Karachi': 'PK',
  'Asia/Kathmandu': 'NP', 'Asia/Dubai': 'AE', 'Asia/Riyadh': 'SA',
  'Asia/Qatar': 'QA', 'Asia/Kuwait': 'KW', 'Asia/Tehran': 'IR',
  'Asia/Baghdad': 'IQ', 'Asia/Jerusalem': 'IL', 'Asia/Beirut': 'LB',
  // Oceania
  'Australia/Sydney': 'AU', 'Australia/Melbourne': 'AU', 'Australia/Brisbane': 'AU',
  'Australia/Perth': 'AU', 'Australia/Adelaide': 'AU', 'Australia/Hobart': 'AU',
  'Pacific/Auckland': 'NZ', 'Pacific/Fiji': 'FJ',
  // Africa
  'Africa/Cairo': 'EG', 'Africa/Lagos': 'NG', 'Africa/Nairobi': 'KE',
  'Africa/Johannesburg': 'ZA', 'Africa/Casablanca': 'MA', 'Africa/Tunis': 'TN',
  'Africa/Accra': 'GH', 'Africa/Addis_Ababa': 'ET',
};

/**
 * Derive the user's country code from their IANA timezone.
 * Returns 'XX' if timezone can't be mapped.
 */
function getCountryFromTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!tz) return 'XX';
    return TZ_TO_COUNTRY[tz] ?? 'XX';
  } catch {
    return 'XX';
  }
}

// ============================================================================
// HOOK
// ============================================================================

export function useOnlineUsers(): UseOnlineUsersResult {
  const [total, setTotal] = useState(0);
  const [countries, setCountries] = useState<OnlineCountryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const mountedRef = useRef(true);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Send heartbeat ────────────────────────────────────────────────────
  const sendHeartbeat = useCallback(async () => {
    try {
      const countryCode = getCountryFromTimezone();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      await fetch('/api/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ countryCode }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
    } catch {
      // Silent failure — heartbeat is best-effort
    }
  }, []);

  // ── Fetch online users ────────────────────────────────────────────────
  const fetchOnlineUsers = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      const res = await fetch('/api/online-users', {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!mountedRef.current) return;
      if (!res.ok) return;

      const data: OnlineUsersResponse = await res.json();
      if (!mountedRef.current) return;

      setTotal(data.total);
      setCountries(data.countries);
    } catch {
      // Silent failure — keep last-good data
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  // ── Mount: start heartbeat + polling ──────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;

    // Immediate heartbeat + fetch
    void sendHeartbeat();
    void fetchOnlineUsers();

    // Start intervals
    heartbeatRef.current = setInterval(() => {
      if (mountedRef.current) void sendHeartbeat();
    }, HEARTBEAT_INTERVAL_MS);

    pollRef.current = setInterval(() => {
      if (mountedRef.current) void fetchOnlineUsers();
    }, POLL_INTERVAL_MS);

    return () => {
      mountedRef.current = false;
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [sendHeartbeat, fetchOnlineUsers]);

  return { total, countries, isLoading };
}
