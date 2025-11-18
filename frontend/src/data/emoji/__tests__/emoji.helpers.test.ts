import emojiBankRaw from '../emoji-bank.json';
import { getEmoji, getTrendEmoji, getProviderEmoji, type ProviderLike } from '../emoji';

type EmojiEntry = {
  id: string;
  emoji: string;
};

type EmojiBankJson = {
  trends?: EmojiEntry[];
  core?: EmojiEntry[];
  providers?: Record<string, string>;
};

const emojiBank = emojiBankRaw as EmojiBankJson;

describe('emoji helpers', () => {
  describe('getEmoji', () => {
    it('returns the configured emoji for a known id in trends or core', () => {
      const trends = emojiBank.trends ?? [];
      const core = emojiBank.core ?? [];

      const sourceSection = trends.length > 0 ? trends : core;
      const sectionName = trends.length > 0 ? 'trends' : 'core';

      expect(sourceSection.length).toBeGreaterThan(0);

      const sample = sourceSection[0];

      if (!sample) {
        throw new Error(
          'emoji-bank.json needs at least one emoji entry in trends or core for this test',
        );
      }

      expect(getEmoji(sectionName, sample.id)).toBe(sample.emoji);
    });

    it('returns null when id is missing or empty', () => {
      expect(getEmoji('trends', undefined)).toBeNull();
      expect(getEmoji('trends', null)).toBeNull();
      expect(getEmoji('trends', '')).toBeNull();
    });

    it('returns null for an unknown id', () => {
      expect(getEmoji('trends', '__does_not_exist__')).toBeNull();
    });
  });

  describe('getTrendEmoji', () => {
    it('returns a string emoji for known trend ids when configured', () => {
      const up = getTrendEmoji('up');
      const down = getTrendEmoji('down');
      const flat = getTrendEmoji('flat');

      if (up !== null) {
        expect(typeof up).toBe('string');
        expect(up.length).toBeGreaterThan(0);
      }

      if (down !== null) {
        expect(typeof down).toBe('string');
        expect(down.length).toBeGreaterThan(0);
      }

      if (flat !== null) {
        expect(typeof flat).toBe('string');
        expect(flat.length).toBeGreaterThan(0);
      }
    });

    it('returns null when trend id is missing or unknown', () => {
      expect(getTrendEmoji(undefined)).toBeNull();
      expect(getTrendEmoji(null)).toBeNull();
      // deliberate bad input, runtime path only
      expect(getTrendEmoji('sideways' as any)).toBeNull();
    });
  });

  describe('getProviderEmoji', () => {
    it('returns the configured emoji for each provider id in the providers map', () => {
      const providersMap = emojiBank.providers ?? {};
      const entries = Object.entries(providersMap) as [string, string][];

      expect(entries.length).toBeGreaterThan(0);

      for (const [providerId, glyph] of entries) {
        // We support string ids as input as well as ProviderLike
        expect(getProviderEmoji(providerId)).toBe(glyph);
      }
    });

    it('prefers an explicit emoji on the ProviderLike object over the providers map', () => {
      const providersMap = emojiBank.providers ?? {};
      const entries = Object.entries(providersMap) as [string, string][];

      if (entries.length === 0) {
        // Nothing to assert here; other tests already cover the empty case.
        return;
      }

      const first = entries[0];
      if (!first) {
        throw new Error('Expected at least one provider emoji entry');
      }

      const [providerId] = first;

      const explicit: ProviderLike = {
        id: providerId,
        emoji: '🧪',
      };

      expect(getProviderEmoji(explicit)).toBe('🧪');
    });

    it('returns null for an unknown provider id', () => {
      expect(getProviderEmoji('__unknown_provider__')).toBeNull();
    });
  });
});
