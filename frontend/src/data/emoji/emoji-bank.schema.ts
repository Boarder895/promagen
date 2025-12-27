import { z } from 'zod';

export const emojiEntrySchema = z
  .object({
    id: z.string().min(1, 'emoji id must be non-empty'),
    emoji: z.string().min(1, 'emoji glyph must be non-empty'),
  })
  .strict();

export type EmojiEntry = z.infer<typeof emojiEntrySchema>;

export const emojiSectionSchema = z.array(emojiEntrySchema);

export const providerEmojiMapSchema = z.record(
  z.string().min(1, 'provider id must be non-empty'),
  z.string().min(1, 'provider emoji must be non-empty'),
);

const arraySections = [
  'trends',
  'core',
  'finance',
  'currencies',
  'weather',
  'space',
  'sports',
  'seasons',
  'budget_guard',
  'alerts',
  'ui',
  'transport',
  'science',
  'tech',
  'food',
  'nature',
  'music',
  'people',
  'symbols',
] as const;

type ArraySection = (typeof arraySections)[number];

/**
 * emojiBankSchema
 *
 * Guarantees:
 * - required sections exist
 * - each entry is { id, emoji } (strict)
 * - providers is Record<string, string>
 * - no duplicate ids inside any array section
 */
export const emojiBankSchema = z
  .object({
    trends: emojiSectionSchema,
    core: emojiSectionSchema,
    finance: emojiSectionSchema,
    currencies: emojiSectionSchema,
    weather: emojiSectionSchema,
    space: emojiSectionSchema,
    sports: emojiSectionSchema,
    seasons: emojiSectionSchema,
    budget_guard: emojiSectionSchema,
    alerts: emojiSectionSchema,
    ui: emojiSectionSchema,
    transport: emojiSectionSchema,
    science: emojiSectionSchema,
    tech: emojiSectionSchema,
    food: emojiSectionSchema,
    nature: emojiSectionSchema,
    music: emojiSectionSchema,
    people: emojiSectionSchema,
    providers: providerEmojiMapSchema,
    symbols: emojiSectionSchema,
  })
  .strict()
  .superRefine((bank, ctx) => {
    const checkDuplicates = (sectionName: ArraySection) => {
      const entries = bank[sectionName];
      const seen = new Set<string>();

      for (const entry of entries) {
        if (seen.has(entry.id)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [sectionName],
            message: `Duplicate emoji id "${entry.id}" in section "${sectionName}"`,
          });
        } else {
          seen.add(entry.id);
        }
      }
    };

    for (const sectionName of arraySections) {
      checkDuplicates(sectionName);
    }
  });

export type EmojiBank = z.infer<typeof emojiBankSchema>;
