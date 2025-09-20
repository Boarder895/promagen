// FRONTEND — NEXT.JS
// frontend/components/WorldClocks.tsx
// Live clocks, reading city list from /api/world-clocks (single source of truth).

"use client";

import React, { useEffect, useMemo, useState } from "react";
import { sunriseUtc } from "../lib/sunrise";

type City = {
  id: string;
  name: string;
  timeZone: string;
  lat: number;
  lon: number;
  flag?: string;
};

function useTick(ms = 1000) {
  const [, setN] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setN((n) => n + 1), ms);
    return () => clearInterval(t);
  }, [ms]);
}

export default function WorldClocks() {
  const [cities, setCities] = useState<City[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useTick(1000);

  useEffect(() => {
    let cancelled = false;
    const fetchCities = async () => {
      try {
        const r = await fetch("/api/world-clocks", { cache: "no-store" });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const json = await r.json();
        if (!cancelled) setCities(json.cities as City[]);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load cities");
      }
    };
    fetchCities();
    return () => { cancelled = true; };
  }, []);

  const now = new Date();

  const sorted = useMemo(() => {
    if (!cities) return [];
    const base = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    return [...cities]
      .map((c) => {
        const sr = sunriseUtc(base, { lat: c.lat, lon: c.lon });
        return { city: c, sunriseUtc: sr, sortKey: sr ? sr.getTime() : Number.POSITIVE_INFINITY };
      })
      .sort((a, b) => a.sortKey - b.sortKey);
  }, [cities, now]);

  if (error) {
    return <div className="pmg-clocks">Couldn’t load clocks: {error}</div>;
  }
  if (!cities) {
    return <div className="pmg-clocks">Loading world clocks…</div>;
  }

  return (
    <div className="pmg-clocks">
      <div className="pmg-clocks__title">World Clocks (ordered by today’s sunrise)</div>
      <div className="pmg-clocks__grid">
        {sorted.map(({ city, sunriseUtc }) => {
          const time = new Intl.DateTimeFormat("en-GB", {
            timeZone: city.timeZone, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
          }).format(now);

          const date = new Intl.DateTimeFormat("en-GB", {
            timeZone: city.timeZone, weekday: "short", day: "2-digit", month: "short", year: "numeric"
          }).format(now);

          const sunriseLocal = sunriseUtc
            ? new Intl.DateTimeFormat("en-GB", { timeZone: city.timeZone, hour: "2-digit", minute: "2-digit", hour12: false }).format(sunriseUtc)
            : "—";

          return (
            <div key={city.id} className="pmg-clock">
              <div className="pmg-clock__name">
                <span className="pmg-clock__flag" aria-hidden="true">{city.flag || "🕒"}</span>
                {city.name}
              </div>
              <div className="pmg-clock__time">{time}</div>
              <div className="pmg-clock__date">{date}</div>
              <div className="pmg-clock__meta">
                <span>Sunrise: {sunriseLocal}</span>
                <span>TZ: {city.timeZone}</span>
              </div>
            </div>
          );
        })}
      </div>

      <style jsx>{`
        .pmg-clocks { border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; background: #fff; }
        .pmg-clocks__title { font-weight: 700; margin-bottom: 12px; }
        .pmg-clocks__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
        .pmg-clock { border: 1px solid #eef0f2; border-radius: 10px; padding: 12px; background: #fafafa; }
        .pmg-clock__name { font-weight: 600; display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
        .pmg-clock__flag { display: inline-block; font-size: 1.1rem; line-height: 1; }
        .pmg-clock__time { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-size: 1.6rem; letter-spacing: 0.5px; margin-bottom: 2px; }
        .pmg-clock__date { color: #4b5563; font-size: 0.9rem; margin-bottom: 6px; }
        .pmg-clock__meta { display: flex; justify-content: space-between; color: #6b7280; font-size: 0.8rem; }
        @media (prefers-color-scheme: dark) {
          .pmg-clocks { background: #0b0d10; border-color: #1f2937; }
          .pmg-clocks__grid .pmg-clock { background: #0f1318; border-color: #1f2937; }
          .pmg-clock__date, .pmg-clock__meta { color: #9ca3af; }
        }
      `}</style>
    </div>
  );
}
