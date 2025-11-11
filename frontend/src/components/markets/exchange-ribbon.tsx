"use client";

import ExchangeCard from "@/components/markets/exchange-card";
import useRibbonData from "@/hooks/use-ribbon-data";

export default function ExchangeRibbon() {
  const items = useRibbonData();

  return (
    <div className="w-full overflow-x-auto border-y bg-neutral-950 text-neutral-100">
      <ul className="flex gap-6 px-4 py-2 text-sm">
        {items.map((it) => (
          <li key={it.code} className="whitespace-nowrap">
            <ExchangeCard exchange={{ id: it.code, name: it.name, city: it.city, tz: it.tz }} />
          </li>
        ))}
      </ul>
    </div>
  );
}

