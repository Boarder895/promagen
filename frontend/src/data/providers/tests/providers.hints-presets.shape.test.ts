// frontend/src/data/providers/tests/providers.hints-presets.shape.test.ts
// Lightweight shape tests for paste-hints.ts and presets.ts.

import pasteHints from '../paste-hints';
import PRESETS, { type Preset } from '../presets';
import providers from '../providers.json';

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

describe('providers paste hints & presets', () => {
  it('pasteHints is a small, well-formed Record<string, string>', () => {
    expect(typeof pasteHints).toBe('object');
    expect(pasteHints).not.toBeNull();

    const entries = Object.entries(pasteHints);

    // Intentionally light: just guard against empty keys/values.
    expect(entries.length).toBeGreaterThan(0);

    entries.forEach(([key, value]) => {
      expect(isNonEmptyString(key)).toBe(true);
      expect(isNonEmptyString(value)).toBe(true);
    });
  });

  it('PRESETS is an array of well-formed Preset objects', () => {
    expect(Array.isArray(PRESETS)).toBe(true);

    const seenIds = new Set<string>();

    PRESETS.forEach((preset: Preset) => {
      expect(isNonEmptyString(preset.id)).toBe(true);
      expect(isNonEmptyString(preset.name)).toBe(true);

      // Ids should be unique and slug-like.
      expect(seenIds.has(preset.id)).toBe(false);
      expect(/^[a-z0-9-]+$/.test(preset.id)).toBe(true);
      seenIds.add(preset.id);

      if (preset.params !== undefined) {
        expect(typeof preset.params).toBe('object');
        expect(preset.params).not.toBeNull();
      }
    });
  });

  it('any preset that mentions a providerId refers to a real provider', () => {
    const providerIds = new Set(providers.map((p) => p.id));

    PRESETS.forEach((preset: Preset) => {
      const params = preset.params as Record<string, unknown> | undefined;

      if (params && typeof params.providerId === 'string') {
        expect(providerIds.has(params.providerId)).toBe(true);
      }
    });
  });

  it.skip('optionally ensures coverage: most providers have at least one preset', () => {
    // When you start populating PRESETS with provider-specific entries, you can
    // turn this on to enforce a minimum UX coverage.
    //
    // Example:
    //
    // const providerIds = new Set(providers.map((p) => p.id));
    // const providersWithPresets = new Set(
    //   PRESETS
    //     .map((preset) => (preset.params as any)?.providerId)
    //     .filter((id: unknown): id is string => typeof id === 'string'),
    // );
    //
    // // Guardrail: at least N providers should have presets.
    // expect(providersWithPresets.size).toBeGreaterThanOrEqual(10);
  });
});
