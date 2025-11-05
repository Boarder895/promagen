"use client";

import * as React from "react";

type Market = {
  id: string;
  city: string;
  tz: string;
  latitude: number;
  longitude: number;
  hoursTemplate?: string | null;
  workdays?: string | null;
  holidaysRef?: string | null;
  exceptions?: { date: string; closed?: boolean; open?: string; close?: string }[];
  tempC?: number | null;
  tempF?: number | null;
  condition?: string | null;
};

type ApiPayload =
  | { ok: true; count: number; data: Market[] }
  | { ok: false; error: string };

const FETCH_URL = "/api/snapshot/weather";
const POLL_MS = 5 * 60 * 1000; // 5m

function splitEastWest(markets: Market[]) {
  const east = markets.filter(m => m.longitude >= 0).sort((a, b) => a.longitude - b.longitude);
  const west = markets.filter(m => m.longitude < 0).sort((a, b) => a.longitude - b.longitude);
  return { east, west };
}

function useWeather() {
  const [data, setData] = React.useState<Market[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    try {
      const res = await fetch(FETCH_URL, { cache: "no-store" });
      const json: ApiPayload = await res.json();
      if (!json.ok) throw new Error(json.error || "Bad response");
      setData(json.data);
      setError(null);
    } catch (e: unknown) {
      setError((e as Error)?.message ?? String(e));
    }
  }, []);

  React.useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  return { data, error };
}

export default function WeatherRibbon() {
  const { data, error } = useWeather();
  if (error) return null;
  if (!data) return null;

  const { east, west } = splitEastWest(data);

  return (
    <div className="w-full border-y border-slate-200 bg-white/70 backdrop-blur">
      <div className="mx-auto max-w-[1400px] px-4 py-2 flex items-center gap-6">
        <section className="flex-1 flex items-center gap-4 overflow-x-auto">
          {east.map((m) => (
            <Tile key={m.id} city={m.city} tempC={m.tempC} />
          ))}
        </section>
        <section className="flex-1 flex items-center gap-4 justify-end overflow-x-auto">
          {west.map((m) => (
            <Tile key={m.id} city={m.city} tempC={m.tempC} />
          ))}
        </section>
      </div>
    </div>
  );
}

function Tile({ city, tempC }: { city: string; tempC?: number | null }) {
  const temp = typeof tempC === "number" ? `${Math.round(tempC)}?C` : "?";
  return (
    <div className="px-2 py-1 rounded-md bg-white/80 border border-slate-200 text-sm flex items-center gap-2">
      <span className="font-medium">{city}</span>
      <span className="text-slate-500">{temp}</span>
    </div>
  );
}









