"use client";

import { exchangesUI, type ExchangeUI } from "@/lib/exchanges-ui";

export default function StockRibbon() {
  return (
    <div className="flex flex-wrap gap-3 text-sm">
      {exchangesUI.map((e: ExchangeUI) => (
        <div key={e.id} className="px-3 py-1 rounded-full border border-white/10 bg-white/5">
          <span className="font-semibold">{e.code}</span>{" "}
          <span className="opacity-70">• {e.city}</span>{" "}
          <span>• {e.open ? "Open" : "Closed"}</span>{" "}
          <span className="opacity-70">{typeof e.temp === "number" ? `${e.temp}°` : ""}</span>{" "}
          <span className="opacity-70">{e.localtime ? `• ${e.localtime}` : ""}</span>
        </div>
      ))}
    </div>
  );
}









