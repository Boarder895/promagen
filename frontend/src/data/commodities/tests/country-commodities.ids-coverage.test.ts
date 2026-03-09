import commoditiesCatalogJson from '../commodities.catalog.json';
import countryCommodityMapJson from '../country-commodities.map.json';
import type { CountryCommodityMapEntry } from '../country-commodities.map';

type CommodityGroupKey = 'energy' | 'agriculture' | 'metals';

interface CommodityLookupItem {
  id: string;
  group: CommodityGroupKey;
}

type CommodityById = Map<string, CommodityLookupItem>;

function buildCommodityIndex(): CommodityById {
  const byId: CommodityById = new Map();

  (commoditiesCatalogJson as CommodityLookupItem[]).forEach((item) => {
    byId.set(item.id, item);
  });

  return byId;
}

interface WrongGroupEntry {
  id: string;
  expected: CommodityGroupKey;
  actual: CommodityGroupKey | string;
}

/**
 * Known ID naming divergence: country-commodities.map.json may use
 * benchmark names that differ from commodities.catalog.json IDs.
 *
 * Updated 8 Mar 2026: Catalog trimmed to 34 everyday commodities.
 * All removed IDs also cleaned from the country map — no gaps remain.
 */
const KNOWN_NAMING_GAPS: Record<CommodityGroupKey, Set<string>> = {
  energy: new Set([]),
  agriculture: new Set([]),
  metals: new Set([]),
};

function assertIdsExistAndGroupMatch(
  rows: CountryCommodityMapEntry[],
  groupKey: CommodityGroupKey,
  commodityById: CommodityById,
  context: string,
): void {
  const unexpectedMissing: string[] = [];
  const wrongGroup: WrongGroupEntry[] = [];
  const knownGaps = KNOWN_NAMING_GAPS[groupKey];

  rows.forEach((row) => {
    const ids = row[groupKey];

    ids.forEach((id) => {
      // Skip IDs in the known naming divergence list
      if (knownGaps.has(id)) return;

      const commodity = commodityById.get(id);

      if (!commodity) {
        unexpectedMissing.push(id);
        return;
      }

      if (commodity.group !== groupKey) {
        wrongGroup.push({
          id,
          expected: groupKey,
          actual: commodity.group,
        });
      }
    });
  });

  if (unexpectedMissing.length > 0 || wrongGroup.length > 0) {
    console.error(`country-commodities.map.json has unexpected invalid commodity ids in ${context}`, {
      unexpectedMissing: [...new Set(unexpectedMissing)],
      wrongGroup,
    });
  }

  // No NEW unknown IDs beyond the documented naming gaps
  expect(unexpectedMissing).toEqual([]);
  // Group assignment is always strictly checked
  expect(wrongGroup).toEqual([]);
}

describe('country-commodities.map commodity id coverage', () => {
  const rows = countryCommodityMapJson as unknown as CountryCommodityMapEntry[];
  const commodityById = buildCommodityIndex();

  it('only references valid energy commodity ids in energy columns', () => {
    assertIdsExistAndGroupMatch(rows, 'energy', commodityById, 'energy columns');
  });

  it('only references valid agriculture commodity ids in agriculture columns', () => {
    assertIdsExistAndGroupMatch(rows, 'agriculture', commodityById, 'agriculture columns');
  });

  it('only references valid metals commodity ids in metals columns', () => {
    assertIdsExistAndGroupMatch(rows, 'metals', commodityById, 'metals columns');
  });
});
