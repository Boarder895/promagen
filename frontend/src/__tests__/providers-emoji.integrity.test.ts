import providers from '../data/providers/providers.json';
import emojiBank from '../data/emoji/emoji-bank.json';

type Provider = {
  id: string;
};

const ALLOWED_NON_PROVIDER_EMOJI_IDS = new Set<string>([
  // Put any explicit fallback ids here if you use them, e.g.:
  // "default_provider",
]);

describe('providers ↔ emoji integrity', () => {
  it('every provider has an emoji mapping (or an allowed fallback)', () => {
    const providerEmojiIds = new Set(Object.keys(emojiBank.providers));
    const missing: string[] = [];

    (providers as Provider[]).forEach((provider) => {
      if (!providerEmojiIds.has(provider.id)) {
        // If you decide some providers intentionally share a fallback,
        // add those ids to ALLOWED_NON_PROVIDER_EMOJI_IDS instead.
        if (!ALLOWED_NON_PROVIDER_EMOJI_IDS.has(provider.id)) {
          missing.push(provider.id);
        }
      }
    });

    expect(missing).toEqual([]);
  });

  it('emoji mappings only reference known providers or allowed fallback ids', () => {
    const providerIds = new Set((providers as Provider[]).map((p) => p.id));
    const invalid: string[] = [];

    for (const providerId of Object.keys(emojiBank.providers)) {
      if (!providerIds.has(providerId) && !ALLOWED_NON_PROVIDER_EMOJI_IDS.has(providerId)) {
        invalid.push(providerId);
      }
    }

    expect(invalid).toEqual([]);
  });
});
