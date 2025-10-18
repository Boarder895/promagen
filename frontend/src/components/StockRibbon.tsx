// components/StockRibbon.tsx
"use client";

import { exchangesUI } from "@/lib/exchanges-ui";

export default function StockRibbon() {
  const rows = exchangesUI;

  return (
    <div className="flex flex-wrap gap-3 text-sm">
      {rows.map((e) => (
        <div key={e.exchange} className="px-3 py-1 rounded-full border">
          <span className="font-semibold">{e.code}</span>
          <span className="opacity-60"> · {e.city}</span>
          <span> · {e.isOpen ? "Open" : "Closed"}</span>
          {typeof e.temp === "number" && <span className="opacity-60"> · {e.temp}°</span>}
          {e.localTime && <span className="opacity-60"> · {e.localTime}</span>}
        </div>
      ))}
    </div>
  );
}






