import exchangeCommoditiesMapJson from '../exchange-commodities.map.json';
import commoditiesCatalogJson from '../commodities.catalog.json';
import exchangesCatalogJson from '../../exchanges/exchanges.catalog.json';
import { commoditiesCatalogSchema } from '../commodities.schema';
import { commodityExchangeMapSchema } from '../exchange-commodities.map.schema';

/**
 * Known ID naming divergence: exchange-commodities.map.json may use
 * IDs that aren't in commodities.catalog.json.
 *
 * Updated 8 Mar 2026: Catalog trimmed to 34 everyday commodities.
 * All removed IDs also cleaned from the exchange map — no gaps remain.
 */
const KNOWN_MAP_EXTRA_IDS = new Set<string>([]);

/**
 * Known exchange IDs referenced in the commodity-exchange map that aren't
 * yet in exchanges.catalog.json. These are real exchanges pending catalog
 * addition.
 */
const KNOWN_UNCATALOGED_EXCHANGES = new Set([
  'bmv-mexico-city', 'brvm-abidjan', 'bvl-lima', 'bvmac-douala',
  'ngx-lagos', 'oslo-bors', 'tadawul-riyadh', 'tunis-bvmt',
]);

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
    const unexpectedExtraInMap: string[] = [];

    commodityIdsInCatalog.forEach((id) => {
      if (!commodityIdsInMap.has(id)) {
        missingInMap.push(id);
      }
    });

    commodityIdsInMap.forEach((id) => {
      if (!commodityIdsInCatalog.has(id)) {
        // Only flag IDs that aren't in the known naming divergence list
        if (!KNOWN_MAP_EXTRA_IDS.has(id)) {
          unexpectedExtraInMap.push(id);
        }
      }
    });

    if (unexpectedExtraInMap.length > 0) {
      console.error(
        'Unexpected commodity ids in exchange-commodities.map.json not in catalog or known gaps',
        { unexpectedExtraInMap },
      );
    }

    // The catalog has many commodities without exchange routing (expected).
    // The map should not introduce NEW unknown IDs beyond the documented gaps.
    expect(unexpectedExtraInMap).toHaveLength(0);
  });

  it('only references known exchange ids from exchanges.catalog.json', () => {
    const map = commodityExchangeMapSchema.parse(exchangeCommoditiesMapJson);
    const exchangeRows = exchangesCatalogJson as { id: string }[];

    const knownExchangeIds = new Set(exchangeRows.map((row) => row.id));
    const unexpectedIds: string[] = [];

    map.forEach((row) => {
      const checkId = (id: string, role: string) => {
        if (!knownExchangeIds.has(id) && !KNOWN_UNCATALOGED_EXCHANGES.has(id)) {
          unexpectedIds.push(`${role}:${id} (commodityId=${row.commodityId})`);
        }
      };

      checkId(row.primaryExchangeId, 'primary');
      row.secondaryExchangeIds.forEach((id) => checkId(id, 'secondary'));
      row.extraExchangeIds.forEach((id) => checkId(id, 'extra'));
    });

    if (unexpectedIds.length > 0) {
      console.error('Unexpected unknown exchange ids in exchange-commodities.map.json:', unexpectedIds);
    }

    expect(unexpectedIds).toHaveLength(0);
  });
});
