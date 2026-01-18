import { z } from 'zod';

export const commodityGroups = ['energy', 'agriculture', 'metals'] as const;
export type CommodityGroup = (typeof commodityGroups)[number];

export const commoditySubGroups = [
  // Energy
  'crude_oil',
  'natural_gas',
  'refined_products',
  'distillates',
  'gasoline',
  'lng',
  'coal',
  'biofuels',
  'power',
  'emissions',
  // Agriculture
  'grains',
  'softs',
  'livestock',
  'oilseeds',
  'oilseeds_products',
  'fertilisers',
  // Metals
  'precious',
  'base',
  'battery_metals',
] as const;

export type CommoditySubGroup = (typeof commoditySubGroups)[number];

export const quoteCurrencies = ['USD', 'EUR', 'GBP'] as const;
export type QuoteCurrency = (typeof quoteCurrencies)[number];

export const commodityGeoLevels = ['country', 'region', 'multi_country'] as const;
export type CommodityGeoLevel = (typeof commodityGeoLevels)[number];

export const commoditySchema = z.object({
  id: z.string().min(1, 'id is required'),
  name: z.string().min(1, 'name is required'),
  shortName: z.string().min(1, 'shortName is required'),
  symbol: z.string().min(1, 'symbol is required'),

  group: z.enum(commodityGroups, {
    description: 'Top-level commodity group (energy, agriculture, metals)',
  }),

  subGroup: z.enum(commoditySubGroups, {
    description: 'Commodity subgroup within the group',
  }),

  emoji: z.string().min(1, 'emoji is required'),

  quoteCurrency: z.enum(quoteCurrencies, {
    description: 'Quote currency, e.g. USD / EUR / GBP',
  }),

  isActive: z.boolean(),
  isSelectableInRibbon: z.boolean(),

  priority: z
    .number()
    .int('priority must be an integer')
    .positive('priority must be a positive integer'),

  tags: z.array(z.string().min(1)).min(1, 'tags must contain at least one tag'),

  ribbonLabel: z.string().min(1, 'ribbonLabel is required'),
  ribbonSubtext: z.string().min(1, 'ribbonSubtext is required'),

  geoLevel: z.enum(commodityGeoLevels, {
    description: 'Geographic grouping used for the ribbon map / flags',
  }),

  displayCountryCodes: z
    .array(z.string().regex(/^[A-Z]{2}$/, 'displayCountryCodes must be ISO-3166-1 alpha-2'))
    .min(1, 'displayCountryCodes must contain at least one country code'),

  // Tooltip fields (optional)
  yearFirstTraded: z
    .number()
    .int('yearFirstTraded must be an integer')
    .min(1800, 'yearFirstTraded must be 1800 or later')
    .max(2030, 'yearFirstTraded must be 2030 or earlier')
    .optional(),

  fact: z.string().max(150, 'fact must be 150 characters or less').optional(),
});

export type Commodity = z.infer<typeof commoditySchema>;

export const commoditiesCatalogSchema = z.array(commoditySchema).superRefine((items, ctx) => {
  const seenIds = new Set<string>();

  items.forEach((item, index) => {
    if (seenIds.has(item.id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [index, 'id'],
        message: `Duplicate commodity id "${item.id}"`,
      });
    } else {
      seenIds.add(item.id);
    }
  });
});

export type CommoditiesCatalog = z.infer<typeof commoditiesCatalogSchema>;
