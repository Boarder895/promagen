// src/components/ribbon/mini-commodities-widget.tsx

import React from 'react';

import commoditiesCatalogue from '@/data/commodities/commodities.catalog.json';
import { getFreeCommodities } from '@/lib/ribbon/selection';
import type { Commodity } from '@/types/finance-ribbon';

export type MiniCommoditiesWidgetProps = {
  title?: string;
};

type CommodityWithUi = Commodity & {
  shortName?: string;
  emoji?: string;
};

function renderChip(commodity: CommodityWithUi): JSX.Element {
  const label = commodity.shortName ?? commodity.name;

  return (
    <li
      key={commodity.id}
      className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-900 ring-1 ring-amber-200"
    >
      {commodity.emoji && <span aria-hidden="true">{commodity.emoji}</span>}
      <span>{label}</span>
    </li>
  );
}

export default function MiniCommoditiesWidget({
  title = 'Commodities',
}: MiniCommoditiesWidgetProps): JSX.Element {
  const selection = getFreeCommodities(commoditiesCatalogue as Commodity[]);
  const items: CommodityWithUi[] = selection.items as CommodityWithUi[];

  const hasSevenItems = items.length === 7;
  const hasCentreGroup = Boolean(selection.centreGroupId);
  const hasCounts = selection.countsByGroup && Object.keys(selection.countsByGroup).length >= 3;
  const canUseGridLayout = selection.isValid && hasSevenItems && hasCentreGroup && hasCounts;

  // Fallback: if the selection is not a clean 2–3–2, render a simple chip row.
  if (!canUseGridLayout) {
    return (
      <section
        aria-label="Mini commodities widget"
        className="rounded-2xl bg-white px-3 py-2 text-xs text-slate-900 shadow-sm ring-1 ring-amber-100"
      >
        <header className="mb-1 flex items-center justify-between">
          <p className="font-semibold">{title}</p>
          <p className="text-[10px] uppercase tracking-wide text-slate-500">Free set snapshot</p>
        </header>

        <ul className="flex flex-wrap justify-centre gap-1.5" data-testid="mini-commodities-widget">
          {items.map(renderChip)}
        </ul>
      </section>
    );
  }

  const { centreGroupId, countsByGroup } = selection;
  const groupIds = Object.keys(countsByGroup);
  const sideGroupIds = groupIds.filter((id) => id !== centreGroupId);

  // Keep a stable left/right ordering between the two side groups.
  sideGroupIds.sort();

  const [leftGroupId, rightGroupId] = sideGroupIds;

  const leftItems = items.filter((c) => c.group === leftGroupId);
  const centreItems = items.filter((c) => c.group === centreGroupId);
  const rightItems = items.filter((c) => c.group === rightGroupId);

  return (
    <section
      aria-label="Mini commodities widget"
      className="rounded-2xl bg-white px-3 py-2 text-xs text-slate-900 shadow-sm ring-1 ring-amber-100"
    >
      <header className="mb-1 flex items-center justify-between">
        <p className="font-semibold">{title}</p>
        <p className="text-[10px] uppercase tracking-wide text-slate-500">Free set snapshot</p>
      </header>

      <div className="grid grid-cols-3 gap-1.5" data-testid="mini-commodities-widget">
        <ul className="flex flex-col items-start gap-1.5">{leftItems.map(renderChip)}</ul>
        <ul className="flex flex-col items-centre gap-1.5">{centreItems.map(renderChip)}</ul>
        <ul className="flex flex-col items-end gap-1.5">{rightItems.map(renderChip)}</ul>
      </div>
    </section>
  );
}
