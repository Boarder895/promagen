"use client";

import React, { useEffect, useMemo, useState } from "react";
import { sunriseUtc } from "@/lib/sunrise";

type City = {
  id: string;
  name: string;
  timeZone: string;
  lat: number;
  lon: number;
  flag?: string;
};

function useTick(ms = 1000) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setN((x) => x + 1), ms);
    return () => clearInterval(t);
  }, [ms]);
  return n;
}

export default function WorldClocks() {
  const [cities, setCities] = useState<City[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Drive re-renders once per second, but we don't need the value.
  useTick(1000);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/world-clocks", { cache: "no-store" });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const json = await r.json();
        if (!cancelled) setCities(json.cities as City[]);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load cities");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Current time used for display only (no memo needed).
  const now = new Date();

  // Only reshuffle ordering when the *day* changes or the city list changes.
  const dayKey = `${now.getUTCFullYear()}-${now.getUTCMonth()}-${now.getUTCDate()}`;

  const sorted = useMemo(() => {
    if (!cities) return [];
    const [y, m, d] = dayKey.split("-").map(Number);
    const base = new Date(Date.UTC(y, m, d)); // midnight UTC today
    return [...cities]
      .map((c) => {
        const sr = sunriseUtc(base, { lat: c.lat, lon: c.lon });
        return {
          city: c,
          sunriseUtc: sr,
          sortKey: sr ? sr.getTime() : Number.POSITIVE_INFINITY,
        };
      })
      .sort((a, b) => a.sortKey - b.sortKey);
  }, [cities, dayKey]);

  if (error) return <div className="pmg-clocks">Couldn&rsquo;t load clocks: {error}</div>;
  if (!cities) return <div className="pmg-clocks">Loading world clocks&hellip;</div>;

  return (
    <div className="pmg-clocks">
      <div className="pmg-clocks__title">World Clocks (ordered by today&rsquo;s sunrise)</div>
      <div className="pmg-clocks__grid">
        {sorted.map(({ city, sunriseUtc }) => {
          const time = new Intl.DateTimeFormat("en-GB", {
            timeZone: city.timeZone,
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
          }).format(now);

          const date = new Intl.DateTimeFormat("en-GB", {
            timeZone: city.timeZone,
            weekday: "short",
            day: "2-digit",
            month: "short",
            year: "numeric",
          }).format(now);

          const sunriseLocal = sunriseUtc
            ? new Intl.DateTimeFormat("en-GB", {
                timeZone: city.timeZone,
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              }).format(sunriseUtc)
            : "ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¿Ãƒâ€šÃ‚Â½";

          return (
            <div key={city.id} className="pmg-clock">
              <div className="pmg-clock__name">
                <span className="pmg-clock__flag" aria-hidden="true">
                  {city.flag || "??"}
                </span>
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
    </div>
  );
}




