import exchangeCommoditiesMapJson from '../exchange-commodities.map.json';
import commoditiesCatalogJson from '../commodities.catalog.json';
import exchangesCatalogJson from '../../exchanges/exchanges.catalog.json';
import { commoditiesCatalogSchema } from '../commodities.schema';
import { commodityExchangeMapSchema } from '../exchange-commodities.map.schema';

describe('exchange-commodities.map.json', () => {
  it('matches the commodity–exchange map schema', () => {
    const result = commodityExchangeMapSchema.safeParse(exchangeCommoditiesMapJson);

    if (!result.success) {
      // Helpful debug output in case the JSON drifts.
      console.error(result.error.format());
    }

    expect(result.success).toBe(true);
  });

  it('has exactly one row per commodity in the catalogue', () => {
    const commoditiesCatalog = commoditiesCatalogSchema.parse(commoditiesCatalogJson);

    const map = commodityExchangeMapSchema.parse(exchangeCommoditiesMapJson);

    const commodityIdsInCatalog = new Set(commoditiesCatalog.map((commodity) => commodity.id));
    const commodityIdsInMap = new Set(map.map((row) => row.commodityId));

    const missingInMap: string[] = [];
    const extraInMap: string[] = [];

    commodityIdsInCatalog.forEach((id) => {
      if (!commodityIdsInMap.has(id)) {
        missingInMap.push(id);
      }
    });

    commodityIdsInMap.forEach((id) => {
      if (!commodityIdsInCatalog.has(id)) {
        extraInMap.push(id);
      }
    });

    if (missingInMap.length > 0 || extraInMap.length > 0) {
      console.error(
        'Commodity ids mismatch between commodities.catalog.json and exchange-commodities.map.json',
        { missingInMap, extraInMap },
      );
    }

    expect(missingInMap).toHaveLength(0);
    expect(extraInMap).toHaveLength(0);
  });

  it('only references known exchange ids from exchanges.catalog.json', () => {
    const map = commodityExchangeMapSchema.parse(exchangeCommoditiesMapJson);
    const exchangeRows = exchangesCatalogJson as { id: string }[];

    const knownExchangeIds = new Set(exchangeRows.map((row) => row.id));
    const unknownIds: string[] = [];

    map.forEach((row) => {
      if (!knownExchangeIds.has(row.primaryExchangeId)) {
        unknownIds.push(`primary:${row.primaryExchangeId} (commodityId=${row.commodityId})`);
      }

      row.secondaryExchangeIds.forEach((id) => {
        if (!knownExchangeIds.has(id)) {
          unknownIds.push(`secondary:${id} (commodityId=${row.commodityId})`);
        }
      });

      row.extraExchangeIds.forEach((id) => {
        if (!knownExchangeIds.has(id)) {
          unknownIds.push(`extra:${id} (commodityId=${row.commodityId})`);
        }
      });
    });

    if (unknownIds.length > 0) {
      console.error('Unknown exchange ids in exchange-commodities.map.json:', unknownIds);
    }

    expect(unknownIds).toHaveLength(0);
  });
});
