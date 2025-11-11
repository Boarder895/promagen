"use client";
import * as React from "react";

function toMinutes(hhmm: string | undefined): number {
  if (!hhmm) return 0;
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return 0;
  const h = Number(m[1] ?? 0);
  const mm = Number(m[2] ?? 0);
  return h * 60 + mm;
}

export default function WorldClocksBySunrise({ sunrise }: { sunrise?: string }) {
  const mins = toMinutes(sunrise);
  return <div aria-label="Sunrise time">{mins > 0 ? `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, "0")}` : "—"}</div>;
}
