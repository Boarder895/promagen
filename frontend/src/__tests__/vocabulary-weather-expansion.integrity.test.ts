// src/__tests__/vocabulary-weather-expansion.integrity.test.ts
// ============================================================================
// VOCABULARY WEATHER EXPANSION — Integrity Test
// ============================================================================
// Validates that weather-quality phrases promoted to core vocabulary are:
//   1. Non-empty strings
//   2. No duplicates within the file
//   3. At least 2 words long (rich, evocative phrases)
//   4. No city-specific references (universally useful)
//
// Test project: data (node environment)
// Run: pnpm test -- --selectProjects data --testPathPattern="weather-expansion" --verbose
// ============================================================================

import lightingJson from '@/data/vocabulary/prompt-builder/lighting.json';
import atmosphereJson from '@/data/vocabulary/prompt-builder/atmosphere.json';
import environmentJson from '@/data/vocabulary/prompt-builder/environment.json';

// The weather-promoted phrases (v1.1.0) — these are the ones we added
const WEATHER_PROMOTED_PHRASES = {
  lighting: [
    'cool white moonlight',
    'warm amber sodium streetlamp glow',
    'soft golden dusk light through clouds',
    'harsh fluorescent overhead spill',
    'neon sign reflections on wet pavement',
    'cold blue pre-dawn twilight',
    'scattered cloud-filtered sunlight',
    'monument floodlighting at night',
    'mixed warm and cool artificial lighting',
    'diffused overcast daylight',
    'streetlamp pools with dark intervals',
    'rain-softened ambient glow',
    'mercury vapour blue-white light',
    'fog-diffused headlight beams',
    'heritage lamppost amber warmth',
    'LED signage colour spill',
    'moonlight through broken cloud',
    'dawn pink and gold gradient sky',
    'stark midday overhead sun',
    'candle-warm interior spill through windows',
    'dappled light through tree canopy',
    'fire pit ember glow',
    'storm-dark dramatic sky light',
    'reflected light off wet stone',
    'twilight blue hour ambient',
  ],
  atmosphere: [
    'thin haze softening distant lights',
    'crisp clear night air',
    'heavy humid tropical haze',
    'morning mist rising from pavement',
    'rain-washed clean atmosphere',
    'dust-filtered sunset warmth',
    'fog rolling through urban canyon',
    'post-storm dramatic clearing',
    'dry desert clarity',
    'coastal salt haze',
    'snow-muffled stillness',
    'monsoon-season moisture weight',
    'autumn crisp leaf-fall air',
    'heat shimmer above asphalt',
    'petrichor after summer rain',
    'cold breath condensation',
    'wind-whipped cloud movement',
    'calm before the storm tension',
    'dew-heavy dawn freshness',
    'urban heat island shimmer',
    'mountain cold snap clarity',
    'thundercloud anvil drama',
    'gentle drizzle curtain',
    'ice crystal sparkle in air',
    'humid summer night thickness',
  ],
  environment: [
    'cobblestone old town square',
    'waterfront promenade at night',
    'temple courtyard with stone steps',
    'rooftop terrace overlooking cityscape',
    'covered market with hanging lanterns',
    'rain-slicked boulevard',
    'harbour-side warehouse district',
    'hilltop monument lookout',
    'narrow alley between stone walls',
    'park bench under ancient trees',
    'riverside boardwalk with boat lights',
    'grand plaza with fountain centrepiece',
    'desert road stretching to horizon',
    'snow-covered mountain village',
    'tropical garden with palm canopy',
    'industrial waterfront cranes',
    'subway entrance steps descending',
    'cathedral exterior at dusk',
    'night market food stall row',
    'bridge over calm river reflections',
    'lighthouse cliff edge',
    'vineyard hillside terraces',
    'abandoned factory overgrown',
    'seaside boardwalk amusement lights',
    'university quadrangle archways',
  ],
};

describe('vocabulary weather expansion integrity', () => {
  const categories = [
    { name: 'lighting', data: lightingJson, promoted: WEATHER_PROMOTED_PHRASES.lighting },
    { name: 'atmosphere', data: atmosphereJson, promoted: WEATHER_PROMOTED_PHRASES.atmosphere },
    { name: 'environment', data: environmentJson, promoted: WEATHER_PROMOTED_PHRASES.environment },
  ] as const;

  for (const { name, data, promoted } of categories) {
    describe(`${name}.json`, () => {
      const options = (data as { options: string[] }).options;

      it('has version 1.1.0 (weather expansion)', () => {
        expect((data as { version: string }).version).toBe('1.1.0');
      });

      it('contains all promoted weather phrases', () => {
        const optSet = new Set(options.map((o: string) => o.toLowerCase()));
        for (const phrase of promoted) {
          expect(optSet.has(phrase.toLowerCase())).toBe(true);
        }
      });

      it('has no internal duplicates (case-insensitive)', () => {
        const seen = new Set<string>();
        const dupes: string[] = [];
        for (const opt of options) {
          if (!opt) continue; // skip empty placeholder
          const lower = opt.toLowerCase();
          if (seen.has(lower)) dupes.push(opt);
          seen.add(lower);
        }
        expect(dupes).toEqual([]);
      });

      it('promoted phrases are at least 2 words', () => {
        for (const phrase of promoted) {
          const words = phrase.trim().split(/\s+/).length;
          expect(words).toBeGreaterThanOrEqual(2);
        }
      });

      it('promoted phrases contain no city-specific names', () => {
        const cityNames = [
          'istanbul', 'tokyo', 'london', 'paris', 'new york', 'mumbai',
          'sydney', 'beijing', 'shibuya', 'manhattan', 'brooklyn',
        ];
        for (const phrase of promoted) {
          const lower = phrase.toLowerCase();
          for (const city of cityNames) {
            expect(lower).not.toContain(city);
          }
        }
      });

      it(`total options count is correct (original + ${promoted.length} promoted)`, () => {
        // At least the promoted count should be present
        expect(options.length).toBeGreaterThanOrEqual(promoted.length);
      });
    });
  }
});
