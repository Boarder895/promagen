import { z } from 'zod';

export const commodityExchangeMapEntrySchema = z.object({
  commodityId: z.string().min(1, 'commodityId is required'),
  primaryExchangeId: z.string().min(1, 'primaryExchangeId is required'),
  secondaryExchangeIds: z
    .array(z.string().min(1))
    .min(1, 'secondaryExchangeIds must contain at least one exchange id'),
  weight: z.number().int('weight must be an integer').positive('weight must be a positive integer'),
  extraExchangeIds: z.array(z.string().min(1)),
});

export const commodityExchangeMapSchema = z
  .array(commodityExchangeMapEntrySchema)
  .superRefine((items, ctx) => {
    const seenCommodityIds = new Set<string>();

    items.forEach((item, index) => {
      if (seenCommodityIds.has(item.commodityId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, 'commodityId'],
          message: `Duplicate commodityId "${item.commodityId}"`,
        });
      } else {
        seenCommodityIds.add(item.commodityId);
      }
    });
  });

export type CommodityExchangeMapEntry = z.infer<typeof commodityExchangeMapEntrySchema>;
export type CommodityExchangeMap = z.infer<typeof commodityExchangeMapSchema>;
