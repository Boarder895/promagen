'use client';

import type { RibbonMarket } from '@/types/ribbon';
import ExchangeColumn from './ExchangeColumn';

export interface ExchangeRibbonProps {
  items: RibbonMarket[];
  onSelect?: (m: RibbonMarket) => void;
}

/**
 * Renders both East and West columns side-by-side.
 * Use inside a container that allows two columns to sit next to each other,
 * or place each column manually if using a 3-col page grid.
 */
function splitEastWest(items: RibbonMarket[]) {
  const east: RibbonMarket[] = [];
  const west: RibbonMarket[] = [];
  for (const m of items) {
    (m.exchange.longitude > 0 ? east : west).push(m);
  }
  east.sort((a, b) => a.exchange.longitude - b.exchange.longitude);
  west.sort((a, b) => a.exchange.longitude - b.exchange.longitude);
  return { east, west };
}

export default function ExchangeRibbon({ items, onSelect }: ExchangeRibbonProps) {
  const { east, west } = splitEastWest(items);
  return (
    <>
      <ExchangeColumn title="Eastern markets" items={east} onSelect={onSelect} />
      <ExchangeColumn title="Western markets" items={west} onSelect={onSelect} />
    </>
  );
}






