'use client';

import ExchangeCard from './exchange-card';
import type { RibbonMarket } from '@/types/ribbon';

export interface ExchangeColumnProps {
  items: RibbonMarket[];
  title: string;
}

export default function ExchangeColumn({ items, title }: ExchangeColumnProps) {
  return (
    <div className="flex min-w-[300px] flex-col gap-3" aria-label={`${title} markets`}>
      <div className="pl-1 text-xs uppercase tracking-wide opacity-60">{title}</div>
      {items.map((m) => {
        const ex = {
          id: m.exchange.id,
          name: (m.exchange as any).name ?? m.exchange.city ?? m.exchange.id,
          city: m.exchange.city,
        };
        return <ExchangeCard key={ex.id} exchange={ex} />;
      })}
    </div>
  );
}
