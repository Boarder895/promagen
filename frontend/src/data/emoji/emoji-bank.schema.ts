import { z } from 'zod';

export const emojiEntrySchema = z.object({
  id: z.string().min(1, 'emoji id must be non-empty'),
  emoji: z.string().min(1, 'emoji glyph must be non-empty'),
});

export type EmojiEntry = z.infer<typeof emojiEntrySchema>;

export const emojiSectionSchema = z.array(emojiEntrySchema);

export const providerEmojiMapSchema = z.record(
  z.string().min(1, 'provider id must be non-empty'),
  z.string().min(1, 'provider emoji must be non-empty'),
);

const baseEmojiBankSchema = z.object({
  // Required sections – extend here if you add more named sections later.
  trends: emojiSectionSchema,
  core: emojiSectionSchema,
  finance: emojiSectionSchema,
  symbols: emojiSectionSchema,
  // Provider → emoji lookup
  providers: providerEmojiMapSchema,
});

/**
 * emojiBankSchema
 *
 * Guarantees:
 * - required sections exist
 * - every entry is { id, emoji }
 * - providers is Record<string, string>
 * - no duplicate ids inside a section
 */
export const emojiBankSchema = baseEmojiBankSchema.superRefine((bank, ctx) => {
  const checkDuplicates = (sectionName: keyof typeof bank) => {
    const value = bank[sectionName];

    if (!Array.isArray(value)) {
      return;
    }

    const seen = new Set<string>();

    for (const entry of value) {
      if (seen.has(entry.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [sectionName],
          message: `Duplicate emoji id "${entry.id}" in section "${String(sectionName)}"`,
        });
      } else {
        seen.add(entry.id);
      }
    }
  };

  checkDuplicates('trends');
  checkDuplicates('core');
  checkDuplicates('finance');
  checkDuplicates('symbols');
});

export type EmojiBank = z.infer<typeof emojiBankSchema>;
