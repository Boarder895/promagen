// src/components/markets/exchange-ribbon.tsx
import React from "react";

export type RibbonItem = {
  code: string;       // e.g. "LSE"
  name: string;       // e.g. "London Stock Exchange"
  city: string;       // e.g. "London"
  tz: string;         // IANA tz, e.g. "Europe/London"
  country?: string;   // optional; not all sources set it
};

type Props = {
  items?: RibbonItem[];
  labelledById?: string; // allow external <h2 id="..."> title ownership
};

export function Ribbon({ items = [], labelledById }: Props) {
  return (
    <div
      role="list"
      aria-labelledby={labelledById}
      className="flex gap-2 overflow-x-auto py-2"
      data-testid="exchange-ribbon"
    >
      {items.map((it) => (
        <div
          key={it.code}
          role="listitem"
          className="shrink-0 rounded-xl border px-3 py-2 shadow-sm"
          aria-label={`${it.name} — ${it.city}`}
        >
          <div className="text-sm font-medium">{it.name}</div>
          <div className="text-xs opacity-70">
            {it.city} · {it.tz}
            {it.country ? ` · ${it.country}` : ""}
          </div>
        </div>
      ))}
      {items.length === 0 && (
        <div
          role="note"
          className="text-xs opacity-70 px-1"
          aria-label="No exchanges configured"
        >
          No exchanges configured.
        </div>
      )}
    </div>
  );
}

export default Ribbon;
