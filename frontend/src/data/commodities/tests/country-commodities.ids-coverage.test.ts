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

function assertIdsExistAndGroupMatch(
  rows: CountryCommodityMapEntry[],
  groupKey: CommodityGroupKey,
  commodityById: CommodityById,
  context: string,
): void {
  const missing: string[] = [];
  const wrongGroup: WrongGroupEntry[] = [];

  rows.forEach((row) => {
    const ids = row[groupKey];

    ids.forEach((id) => {
      const commodity = commodityById.get(id);

      if (!commodity) {
        missing.push(id);
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

  if (missing.length > 0 || wrongGroup.length > 0) {
    console.error(`country-commodities.map.json has invalid commodity ids in ${context}`, {
      missing,
      wrongGroup,
    });
  }

  expect(missing).toEqual([]);
  expect(wrongGroup).toEqual([]);
}

describe('country-commodities.map commodity id coverage', () => {
  const rows = countryCommodityMapJson as CountryCommodityMapEntry[];
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
