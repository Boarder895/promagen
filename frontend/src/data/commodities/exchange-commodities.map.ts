// src/data/commodities/exchange-commodities.map.ts

import exchangesSelectedJson from '../exchanges/exchanges.selected.json';
import exchangesCatalogJson from '../exchanges/exchanges.catalog.json';
import { getCommoditiesForCountryName } from './country-commodities.map';
import type { CountryCommodityMapEntry } from './country-commodities.map';

interface SelectedExchangesFile {
  ids: string[];
}

interface ExchangeCatalogEntry {
  id: string;
  country: string;
}

export interface ExchangeCommodityEntry {
  exchangeId: string;
  country: string;
  energy: string[];
  agriculture: string[];
  metals: string[];
}

const selectedIds: string[] = (exchangesSelectedJson as SelectedExchangesFile).ids;

const exchangeCatalog = exchangesCatalogJson as ExchangeCatalogEntry[];

/**
 * Map selected exchanges to their country commodity groups.
 *
 * For each id in exchanges.selected.json we:
 * - find the matching exchange in exchanges.catalog.json
 * - look up its country in country-commodities.map
 * - return a normalised row with energy / agriculture / metals id arrays
 */
const exchangeCommoditiesMap: ExchangeCommodityEntry[] = selectedIds.map((exchangeId) => {
  const exchange = exchangeCatalog.find((entry) => entry.id === exchangeId);

  if (!exchange) {
    throw new Error(
      `exchange-commodities.map: Selected exchange id "${exchangeId}" is not present in exchanges.catalog.json`,
    );
  }

  const countryCommodities: CountryCommodityMapEntry | undefined = getCommoditiesForCountryName(
    exchange.country,
  );

  return {
    exchangeId,
    country: exchange.country,
    energy: countryCommodities?.energy ?? [],
    agriculture: countryCommodities?.agriculture ?? [],
    metals: countryCommodities?.metals ?? [],
  };
});

export { exchangeCommoditiesMap };
export type { CountryCommodityMapEntry };
