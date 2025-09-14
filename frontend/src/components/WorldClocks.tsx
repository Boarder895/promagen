"use client";

import { useEffect, useState } from "react";

// Minimal demo: live times for your requested cities
const cities = [
  { label: "London", tz: "Europe/London" },
  { label: "New York", tz: "America/New_York" },
  { label: "Johannesburg", tz: "Africa/Johannesburg" },
  { label: "Buenos Aires", tz: "America/Argentina/Buenos_Aires" },
  { label: "São Paulo", tz: "America/Sao_Paulo" },
  { label: "Dubai", tz: "Asia/Dubai" },
  { label: "Tokyo", tz: "Asia/Tokyo" },
  { label: "Shanghai", tz: "Asia/Shanghai" },
  { label: "Sydney", tz: "Australia/Sydney" },
];

function fmt(tz: string, d: Date) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: tz,
  }).format(d);
}

export default function WorldClocks() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="grid gap-2 md:grid-cols-3">
      {cities.map((c) => (
        <div key={c.tz} className="flex items-center justify-between rounded-xl border px-3 py-2">
          <span className="font-medium">{c.label}</span>
          <span className="tabular-nums text-sm text-gray-600">{fmt(c.tz, now)}</span>
        </div>
      ))}
    </div>
  );
}
