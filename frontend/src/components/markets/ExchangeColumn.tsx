'use client';

import type { RibbonMarket } from '@/types/ribbon';
import ExchangeCard from './ExchangeCard';

export interface ExchangeColumnProps {
  items: RibbonMarket[];
  title: string;
  onSelect?: (m: RibbonMarket) => void;
}

export default function ExchangeColumn({ items, title, onSelect }: ExchangeColumnProps) {
  return (
    <div className="flex min-w-[300px] flex-col gap-3" aria-label={`${title} markets`}>
      <div className="pl-1 text-xs uppercase tracking-wide opacity-60">{title}</div>
      {items.map((m) => (
        <ExchangeCard key={m.exchange.id} m={m} onClick={onSelect} />
      ))}
    </div>
  );
}


