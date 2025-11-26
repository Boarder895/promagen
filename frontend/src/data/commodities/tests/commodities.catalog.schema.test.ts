import commoditiesCatalogJson from '../commodities.catalog.json';
import { commoditiesCatalogSchema } from '../commodities.schema';

describe('commodities.catalog.json schema', () => {
  it('matches the CommoditiesCatalog schema and has unique ids', () => {
    const result = commoditiesCatalogSchema.safeParse(commoditiesCatalogJson);

    if (!result.success) {
      const formatted = JSON.stringify(result.error.format(), null, 2);
      throw new Error(`commodities.catalog.json failed schema validation:\n${formatted}`);
    }

    const data = result.data;

    const ids = data.map((item) => item.id);
    const uniqueIds = new Set(ids);

    if (uniqueIds.size !== ids.length) {
      const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
      throw new Error(`commodities.catalog.json has duplicate ids: ${duplicates.join(', ')}`);
    }

    expect(uniqueIds.size).toBe(ids.length);
  });
});
