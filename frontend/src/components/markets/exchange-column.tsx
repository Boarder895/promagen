'use client';

import ExchangeCard from './exchange-card';
import type { RibbonMarket } from '@/types/ribbon';
import type { Exchange } from '@/data/exchanges';

export interface ExchangeColumnProps {
  items: RibbonMarket[];
  title: string;
}

/**
 * ExchangeCard expects { exchange: Exchange }.
 * Your RibbonMarket.exchange is a lighter "ExchangeInfo".
 * Build the required Exchange object without adding unknown fields.
 */
export default function ExchangeColumn({ items, title }: ExchangeColumnProps) {
  return (
    <div className="flex min-w-[300px] flex-col gap-3" aria-label={`${title} markets`}>
      <div className="pl-1 text-xs uppercase tracking-wide opacity-60">{title}</div>
      {items.map((m) => {
        const ex: Exchange = {
          id: m.exchange.id,
          // "name" is required on Exchange; fall back to city or id if missing.
          name: (m.exchange as any).name ?? m.exchange.city ?? m.exchange.id,
          city: m.exchange.city,
          tz: m.exchange.tz,
        };
        return <ExchangeCard key={ex.id} exchange={ex} />;
      })}
    </div>
  );
}

