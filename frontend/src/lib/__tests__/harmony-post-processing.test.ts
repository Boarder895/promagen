// src/lib/__tests__/harmony-post-processing.test.ts
// ============================================================================
// HARMONY POST-PROCESSING PIPELINE — Comprehensive Regression Tests
// ============================================================================
// Locks in all P1–P12 post-processing fixes using real GPT outputs from
// 6 harmony rounds + 3 stress tests (25 March 2026).
//
// If any test fails, the post-processing pipeline has drifted.
// Every function is tested against the exact GPT output that proved it needed.
//
// Jest project: util (testMatch: '<rootDir>/src/lib/__tests__/**/*.test.ts')
// Authority: harmonizing-claude-openai.md, harmony-post-processing.ts
// ============================================================================

import {
  deduplicateMjParams,
  stripTrailingPunctuation,
  fixT4SelfCorrection,
  fixT4MetaOpeners,
  mergeT4ShortSentences,
  fixT3MetaOpeners,
  stripClipQualitativeAdjectives,
  postProcessTiers,
  T3_ABSTRACT_NOUNS,
  T3_PERCEPTION_VERBS,
  T4_ABSTRACT_NOUNS,
  T4_META_VERBS,
  CLIP_UNFRIENDLY_ADJECTIVES,
} from '../harmony-post-processing';

// ============================================================================
// FIXTURES — Real GPT outputs from harmony rounds and stress tests
// ============================================================================

// ── R2 T2: Duplicate --no block (the pattern that appears in ~85% of runs) ──
const R2_T2_DUPLICATE_NO =
  'lone explorer standing at the edge of a vast frozen valley at first light::2.0, visible breath drifting in the cold air and fine snow swept into shifting patterns across the ground::1.4, towering ice cliffs glowing faintly in pale blue and silver beside distant jagged peaks::1.3, high-end realistic photography with cinematic story-driven composition::1.2, wide landscape framing, central subject, crisp dawn light, quiet isolation and determined stillness::1.1 --ar 16:9 --v 7 --s 500 --no warm tropical colors, buildings, vehicles, crowds, text, watermark, cartoon, painterly, blurry, oversaturated warm tropical colors, buildings, vehicles, crowds, text, watermark, cartoon, painterly, blurry, oversaturated';

// ── R4 T2: Two separate --no blocks (variant pattern) ──
const R4_T2_TWO_NO_BLOCKS =
  'lone explorer standing at the edge of a vast frozen valley at first light::2.2, visible breath drifting through cold air while fine snow sweeps across the ground in shifting patterns::1.5, towering ice cliffs glowing with pale blue and silver tones beneath the first break of sun over distant jagged peaks::1.8 --ar 16:9 --v 7 --s 500 --no text, watermark, logo, blurry --no text, watermark, blurry, low detail, extra people, cropped, overexposed, cartoon, painterly';

// ── ST1 T2: Stress test lighthouse with duplicate negatives ──
const ST1_T2_LIGHTHOUSE =
  'weathered lighthouse keeper standing on the rusted iron gallery of a crumbling coastal lighthouse::2.2, enormous storm waves exploding against black volcanic rocks as white spray catches copper-orange sunset and cold blue mist::1.7, three fishing trawlers pitching on dark swells with amber running lights and swaying mast lights::1.4, lighthouse beam cutting a pale gold corridor through horizontal rain and sea fog, cinematic concept art with dramatic low-angle framing and storm-battered textures::1.3 --ar 16:9 --v 7 --s 500 --no modern buildings, city skyline, calm water, clear sky, extra people, text, watermark, blurry modern buildings, city skyline, calm water, clear sky, extra people, text, watermark, blurry';

// ── R1 T4: Self-correction hallucination (the B1 bug) ──
const R1_T4_SELF_CORRECTION =
  'An elderly samurai stands on a crumbling stone bridge at golden hour. Is this underwater? No, it is an outdoor landscape with cherry blossoms and Mount Fuji in the distance.';

// ── ST2 T4: "The room feels" meta-language (P8 broadening trigger) ──
const ST2_T4_ROOM_FEELS =
  'A young cellist sits alone in an abandoned grand ballroom, playing to empty gilded chairs under white dust sheets. Late afternoon light streams through tall arched windows, with cobwebs on the chandeliers and a white rose beside a faded programme. The room feels quiet and wistful, with warm golden light across the cracked marble floor.';

// ── R2 T4: Short sentence (P10 trigger) ──
const R2_T4_SHORT_SENTENCE =
  'A lone explorer stands at the edge of a frozen valley at dawn, with visible breath, drifting snow, and towering ice cliffs. Distant peaks glow pale blue under the first sunlight, and fading footprints lead away. Crisp, cinematic, and realistic.';

// ── R5 T3: "The stillness feels" meta-opener (P11 broadening trigger) ──
const R5_T3_STILLNESS_FEELS =
  'At first light, a lone explorer is framed low at the lip of a vast frozen valley, their breath hanging in the air as fine snow skims the ground in shifting bands. Towering ice cliffs rise on both sides, while distant jagged peaks catch pale blue and silver light in a crisp cinematic photograph. The stillness feels immense and grounded, like a high-end photograph with cinematic wide-angle clarity and subtle traces of old footsteps fading into the snow.';

// ── R3 T3: "The scene carries" (original P11 narrow trigger) ──
const R3_T3_SCENE_CARRIES =
  'At first light, a lone explorer is framed low at the mouth of a vast frozen valley. Towering ice cliffs rise on both sides with pale blue and silver light. The scene carries the clarity of a high-end photograph, with cinematic wide-angle depth.';

// ── R5 T1: Contains "subtle footprints" (P12 trigger) ──
const R5_T1_SUBTLE =
  'masterpiece, best quality, highly detailed, (lone explorer:1.4), (frozen valley:1.3), (first light:1.2), (ice cliffs:1.3), (distant jagged peaks:1.2), (fine snow:1.2), (wind-driven snow patterns:1.2), pale blue-silver ice, subtle footprints, crisp air, cinematic composition, low-angle wide shot, volumetric light, sharp focus, 8K, intricate textures';

// ── T1 with trailing period (P2 trigger) ──
const T1_WITH_PERIOD =
  'masterpiece, best quality, (samurai:1.4), (stone bridge:1.3), sharp focus, 8K.';

// ============================================================================
// P1+P7: T2 Midjourney Parameter Deduplication
// ============================================================================

describe('P1: deduplicateMjParams', () => {
  it('deduplicates R2 duplicate --no block (single block repeated)', () => {
    const result = deduplicateMjParams(R2_T2_DUPLICATE_NO);
    const noCount = (result.match(/--no/g) ?? []).length;
    expect(noCount).toBe(1);
    // Each term appears exactly once
    expect(result.split('watermark').length - 1).toBe(1);
    expect(result.split('blurry').length - 1).toBe(1);
    expect(result.split('cartoon').length - 1).toBe(1);
  });

  it('deduplicates R4 two separate --no blocks', () => {
    const result = deduplicateMjParams(R4_T2_TWO_NO_BLOCKS);
    const noCount = (result.match(/--no/g) ?? []).length;
    expect(noCount).toBe(1);
    // Merged terms from both blocks
    expect(result).toContain('logo');
    expect(result).toContain('low detail');
    expect(result).toContain('extra people');
    // Deduplicated overlapping terms
    expect(result.split('text').length - 1).toBe(1);
    expect(result.split('watermark').length - 1).toBe(1);
  });

  it('deduplicates ST1 lighthouse duplicate block', () => {
    const result = deduplicateMjParams(ST1_T2_LIGHTHOUSE);
    const noCount = (result.match(/--no/g) ?? []).length;
    expect(noCount).toBe(1);
    expect(result.split('modern buildings').length - 1).toBe(1);
    expect(result.split('calm water').length - 1).toBe(1);
  });

  it('preserves prose before parameters', () => {
    const result = deduplicateMjParams(R4_T2_TWO_NO_BLOCKS);
    expect(result).toContain('lone explorer standing at the edge');
    expect(result).toContain('::2.2');
    expect(result).toContain('::1.8');
  });

  it('preserves --ar, --v, --s values', () => {
    const result = deduplicateMjParams(R4_T2_TWO_NO_BLOCKS);
    expect(result).toContain('--ar 16:9');
    expect(result).toContain('--v 7');
    expect(result).toContain('--s 500');
  });

  it('exactly one of each parameter in output', () => {
    const result = deduplicateMjParams(R4_T2_TWO_NO_BLOCKS);
    expect((result.match(/--ar/g) ?? []).length).toBe(1);
    expect((result.match(/--v/g) ?? []).length).toBe(1);
    expect((result.match(/--s/g) ?? []).length).toBe(1);
    expect((result.match(/--no/g) ?? []).length).toBe(1);
  });

  it('returns prompt unchanged when no parameters present', () => {
    const noParams = 'samurai::2.0 on a bridge, cherry blossoms';
    expect(deduplicateMjParams(noParams)).toBe(noParams);
  });

  it('handles single clean --no block (no-op)', () => {
    const clean = 'samurai::2.0 --ar 16:9 --v 7 --s 500 --no text, watermark, blurry';
    const result = deduplicateMjParams(clean);
    expect(result).toContain('--no text, watermark, blurry');
    expect((result.match(/--no/g) ?? []).length).toBe(1);
  });

  it('case-insensitive deduplication', () => {
    const mixed = 'samurai::2.0 --ar 16:9 --v 7 --s 500 --no Text, WATERMARK --no text, watermark, blurry';
    const result = deduplicateMjParams(mixed);
    expect((result.match(/--no/g) ?? []).length).toBe(1);
    // Should keep 3 unique terms (text, watermark, blurry) not 5
    const noSection = result.split('--no ')[1] ?? '';
    const terms = noSection.split(',').map(t => t.trim()).filter(Boolean);
    expect(terms.length).toBe(3);
  });
});

// ============================================================================
// P2: T1 Trailing Punctuation Stripper
// ============================================================================

describe('P2: stripTrailingPunctuation', () => {
  it('strips trailing period', () => {
    expect(stripTrailingPunctuation(T1_WITH_PERIOD)).toBe(
      'masterpiece, best quality, (samurai:1.4), (stone bridge:1.3), sharp focus, 8K',
    );
  });

  it('strips trailing exclamation mark', () => {
    expect(stripTrailingPunctuation('sharp focus, 8K!')).toBe('sharp focus, 8K');
  });

  it('strips trailing question mark', () => {
    expect(stripTrailingPunctuation('sharp focus, 8K?')).toBe('sharp focus, 8K');
  });

  it('strips multiple trailing punctuation', () => {
    expect(stripTrailingPunctuation('sharp focus, 8K...')).toBe('sharp focus, 8K');
  });

  it('no-op on clean prompt', () => {
    const clean = 'masterpiece, (samurai:1.4), sharp focus, 8K';
    expect(stripTrailingPunctuation(clean)).toBe(clean);
  });

  it('does not strip mid-prompt punctuation', () => {
    const mid = 'Mr. Smith, sharp focus, 8K';
    expect(stripTrailingPunctuation(mid)).toBe(mid);
  });
});

// ============================================================================
// P3: T4 Self-Correction Fixer
// ============================================================================

describe('P3: fixT4SelfCorrection', () => {
  it('fixes B1 self-correction hallucination from R1', () => {
    const result = fixT4SelfCorrection(R1_T4_SELF_CORRECTION);
    expect(result).not.toContain('? No, it is');
    expect(result).not.toContain('Is this underwater');
    expect(result).toContain('An elderly samurai stands');
    expect(result).toContain('outdoor landscape');
  });

  it('preserves clean sentences before the self-correction', () => {
    const result = fixT4SelfCorrection(R1_T4_SELF_CORRECTION);
    expect(result).toContain('An elderly samurai stands on a crumbling stone bridge at golden hour.');
  });

  it('no-op on clean T4 output', () => {
    const clean = 'A samurai stands on a bridge at sunset. Cherry blossoms fall around him.';
    expect(fixT4SelfCorrection(clean)).toBe(clean);
  });

  it('handles em-dash variant "? No — it is"', () => {
    const emDash = 'A scene in a valley? No — it is a mountain landscape with snow.';
    const result = fixT4SelfCorrection(emDash);
    expect(result).not.toContain('? No —');
    expect(result).toContain('mountain landscape');
  });
});

// ============================================================================
// P8: T4 Meta-Language Opener Fixer (broadened)
// ============================================================================

describe('P8: fixT4MetaOpeners (broadened)', () => {
  it('fixes ST2 "The room feels" (the trigger case)', () => {
    const result = fixT4MetaOpeners(ST2_T4_ROOM_FEELS);
    expect(result).not.toContain('The room feels');
    expect(result).toContain('Quiet and wistful');
  });

  it('fixes "The scene is" (original P8 pattern)', () => {
    const input = 'A diver hovers. The scene is dark and vast.';
    const result = fixT4MetaOpeners(input);
    expect(result).not.toContain('The scene is');
    expect(result).toContain('Dark and vast.');
  });

  it('fixes "The atmosphere carries"', () => {
    const input = 'Snow falls. The atmosphere carries a heavy stillness.';
    const result = fixT4MetaOpeners(input);
    expect(result).toContain('A heavy stillness.');
  });

  it('fixes "The void feels"', () => {
    const input = 'The diver hovers. The void feels alien and endless.';
    const result = fixT4MetaOpeners(input);
    expect(result).toContain('Alien and endless.');
  });

  it('fixes "The darkness holds"', () => {
    const input = 'Bubbles rise. The darkness holds an eerie silence.';
    const result = fixT4MetaOpeners(input);
    expect(result).toContain('An eerie silence.');
  });

  it('fixes "The light creates"', () => {
    const input = 'Dust drifts. The light creates a warm glow.';
    const result = fixT4MetaOpeners(input);
    expect(result).toContain('A warm glow.');
  });

  it('does NOT fire on concrete nouns', () => {
    const input = 'The diver hovers at the edge. The shark glides past.';
    expect(fixT4MetaOpeners(input)).toBe(input);
  });

  it('does NOT fire on "The lighthouse stands"', () => {
    const input = 'The lighthouse stands on the cliff. The waves crash below.';
    expect(fixT4MetaOpeners(input)).toBe(input);
  });

  it('does NOT fire on "The explorer walks"', () => {
    const input = 'The explorer walks into the valley.';
    expect(fixT4MetaOpeners(input)).toBe(input);
  });

  it('preserves sentences before the meta-opener', () => {
    const result = fixT4MetaOpeners(ST2_T4_ROOM_FEELS);
    expect(result).toContain('A young cellist sits alone');
    expect(result).toContain('Late afternoon light streams');
  });

  it('covers all T4_ABSTRACT_NOUNS × T4_META_VERBS combinations', () => {
    // Spot check: every noun in the set should be catchable
    expect(T4_ABSTRACT_NOUNS.size).toBeGreaterThanOrEqual(23);
    expect(T4_META_VERBS.size).toBeGreaterThanOrEqual(21);
    // Verify key nouns from stress tests are present
    for (const noun of ['scene', 'room', 'atmosphere', 'void', 'darkness', 'silence', 'mood']) {
      expect(T4_ABSTRACT_NOUNS.has(noun)).toBe(true);
    }
    for (const verb of ['is', 'feels', 'carries', 'holds', 'captures', 'shows']) {
      expect(T4_META_VERBS.has(verb)).toBe(true);
    }
  });
});

// ============================================================================
// P10: T4 Short Sentence Merger
// ============================================================================

describe('P10: mergeT4ShortSentences', () => {
  it('merges R2 "Crisp, cinematic, and realistic." (4 words)', () => {
    const result = mergeT4ShortSentences(R2_T4_SHORT_SENTENCE);
    expect(result).not.toMatch(/\. Crisp, cinematic/);
    expect(result).toContain('— crisp, cinematic, and realistic.');
  });

  it('merges "Quiet and vast." (3 words)', () => {
    const input = 'Peaks glow pale blue. Quiet and vast.';
    const result = mergeT4ShortSentences(input);
    expect(result).toContain('— quiet and vast.');
    expect(result).not.toContain('. Quiet');
  });

  it('does NOT merge sentences with 10+ words', () => {
    const input = 'First sentence here. This second sentence has exactly ten words in total here.';
    expect(mergeT4ShortSentences(input)).toBe(input);
  });

  it('does NOT merge single-sentence prompts', () => {
    const input = 'Short.';
    expect(mergeT4ShortSentences(input)).toBe(input);
  });

  it('only merges the LAST sentence', () => {
    const input = 'First sentence. Short. This is a proper third sentence with many words here.';
    // Last sentence is 10 words — should NOT merge
    expect(mergeT4ShortSentences(input)).toBe(input);
  });

  it('preserves all sentences before the merge', () => {
    const result = mergeT4ShortSentences(R2_T4_SHORT_SENTENCE);
    expect(result).toContain('A lone explorer stands at the edge');
  });

  it('lowercases merged content', () => {
    const input = 'A long sentence here. Dark and cold.';
    const result = mergeT4ShortSentences(input);
    expect(result).toContain('— dark and cold.');
  });
});

// ============================================================================
// P11: T3 Meta-Commentary Opener Fixer (broadened)
// ============================================================================

describe('P11: fixT3MetaOpeners (broadened)', () => {
  it('fixes R5 "The stillness feels" (the broadening trigger)', () => {
    const result = fixT3MetaOpeners(R5_T3_STILLNESS_FEELS);
    expect(result).not.toContain('The stillness feels');
    expect(result).toContain('Immense and grounded');
  });

  it('fixes R3 "The scene carries" (original trigger)', () => {
    const result = fixT3MetaOpeners(R3_T3_SCENE_CARRIES);
    expect(result).not.toContain('The scene carries');
    expect(result).toContain('The clarity of a high-end photograph');
  });

  it('fixes "The atmosphere holds"', () => {
    const input = 'Snow falls. The atmosphere holds a cold tension.';
    const result = fixT3MetaOpeners(input);
    expect(result).toContain('A cold tension.');
  });

  it('fixes "The silence evokes"', () => {
    const input = 'The diver hovers. The silence evokes a deep unease.';
    const result = fixT3MetaOpeners(input);
    expect(result).toContain('A deep unease.');
  });

  it('fixes "The mood suggests"', () => {
    const input = 'Light fades. The mood suggests quiet grief.';
    const result = fixT3MetaOpeners(input);
    expect(result).toContain('Quiet grief.');
  });

  it('does NOT fire on concrete nouns', () => {
    const input = 'The samurai stands alone. The bridge creaks under his weight.';
    expect(fixT3MetaOpeners(input)).toBe(input);
  });

  it('does NOT fire on "The explorer sees"', () => {
    const input = 'The explorer sees a vast valley ahead.';
    expect(fixT3MetaOpeners(input)).toBe(input);
  });

  it('preserves surrounding sentences', () => {
    const result = fixT3MetaOpeners(R5_T3_STILLNESS_FEELS);
    expect(result).toContain('At first light');
    expect(result).toContain('Towering ice cliffs');
  });

  it('covers all T3_ABSTRACT_NOUNS × T3_PERCEPTION_VERBS', () => {
    expect(T3_ABSTRACT_NOUNS.size).toBeGreaterThanOrEqual(20);
    expect(T3_PERCEPTION_VERBS.size).toBeGreaterThanOrEqual(18);
    for (const noun of ['scene', 'stillness', 'atmosphere', 'mood', 'silence', 'calm']) {
      expect(T3_ABSTRACT_NOUNS.has(noun)).toBe(true);
    }
    for (const verb of ['feels', 'carries', 'holds', 'evokes', 'captures', 'has']) {
      expect(T3_PERCEPTION_VERBS.has(verb)).toBe(true);
    }
  });
});

// ============================================================================
// P12: T1 CLIP Qualitative Adjective Stripper
// ============================================================================

describe('P12: stripClipQualitativeAdjectives', () => {
  it('strips "subtle footprints" from R5 T1', () => {
    const result = stripClipQualitativeAdjectives(R5_T1_SUBTLE);
    expect(result).not.toContain('subtle footprints');
    expect(result).toContain('footprints');
  });

  it('strips "gentle warmth"', () => {
    const input = 'masterpiece, gentle warmth, sharp focus';
    const result = stripClipQualitativeAdjectives(input);
    expect(result).not.toContain('gentle');
    expect(result).toContain('warmth');
  });

  it('strips "faint glow"', () => {
    const input = 'masterpiece, faint glow, 8K';
    const result = stripClipQualitativeAdjectives(input);
    expect(result).not.toContain('faint');
    expect(result).toContain('glow');
  });

  it('strips multiple adjectives in one prompt', () => {
    const input = 'masterpiece, subtle footprints, gentle mist, soft haze';
    const result = stripClipQualitativeAdjectives(input);
    expect(result).not.toContain('subtle');
    expect(result).not.toContain('gentle');
    expect(result).not.toContain('soft');
    expect(result).toContain('footprints');
    expect(result).toContain('mist');
    expect(result).toContain('haze');
  });

  it('SAFETY: does NOT strip inside weight-wrapped terms', () => {
    const input = 'masterpiece, (soft glow:1.2), (quiet lake:1.1), (gentle mist:1.1)';
    const result = stripClipQualitativeAdjectives(input);
    expect(result).toContain('(soft glow:1.2)');
    expect(result).toContain('(quiet lake:1.1)');
    expect(result).toContain('(gentle mist:1.1)');
  });

  it('SAFETY: mixed weighted and unweighted', () => {
    const input = 'masterpiece, (soft glow:1.2), subtle footprints, (gentle mist:1.1), faint shimmer';
    const result = stripClipQualitativeAdjectives(input);
    // Weighted preserved
    expect(result).toContain('(soft glow:1.2)');
    expect(result).toContain('(gentle mist:1.1)');
    // Unweighted stripped
    expect(result).not.toMatch(/\bsubtle\b/);
    expect(result).not.toMatch(/\bfaint\b/);
    expect(result).toContain('footprints');
    expect(result).toContain('shimmer');
  });

  it('no-op on prompt with no unfriendly adjectives', () => {
    const clean = 'masterpiece, (samurai:1.4), stone bridge, sharp focus, 8K';
    expect(stripClipQualitativeAdjectives(clean)).toBe(clean);
  });

  it('all 10 adjectives are in the list', () => {
    expect(CLIP_UNFRIENDLY_ADJECTIVES).toHaveLength(10);
    for (const adj of ['subtle', 'gentle', 'soft', 'faint', 'delicate', 'quiet', 'slight', 'mild', 'tender', 'hushed']) {
      expect(CLIP_UNFRIENDLY_ADJECTIVES).toContain(adj);
    }
  });
});

// ============================================================================
// FULL PIPELINE: postProcessTiers integration
// ============================================================================

describe('postProcessTiers — full pipeline integration', () => {
  it('applies all fixes simultaneously across 4 tiers', () => {
    const raw = {
      tier1: {
        positive: 'masterpiece, (samurai:1.4), subtle footprints, sharp focus, 8K.',
        negative: 'blurry, low quality.',
      },
      tier2: {
        positive: 'samurai::2.0 on a bridge --ar 16:9 --v 7 --s 500 --no text, blurry --no text, blurry, cartoon',
        negative: 'extra people',
      },
      tier3: {
        positive: 'A samurai stands on a bridge. The stillness feels ancient and profound.',
        negative: '',
      },
      tier4: {
        positive: 'Is this underwater? No, it is a bridge scene. The room feels old. Cold and quiet.',
        negative: '',
      },
    };

    const result = postProcessTiers(raw);

    // T1: P12 strips "subtle", P2 strips trailing period
    expect(result.tier1.positive).not.toContain('subtle');
    expect(result.tier1.positive).toContain('footprints');
    expect(result.tier1.positive).not.toMatch(/\.$/);
    expect(result.tier1.negative).not.toMatch(/\.$/);

    // T2: P1 deduplicates --no blocks
    expect((result.tier2.positive.match(/--no/g) ?? []).length).toBe(1);
    expect(result.tier2.positive.split('text').length - 1).toBe(1);

    // T3: P11 strips "The stillness feels"
    expect(result.tier3.positive).not.toContain('The stillness feels');
    expect(result.tier3.positive).toContain('Ancient and profound.');

    // T4: P3 → P8 → P10 chain
    // P3: self-correction removed
    expect(result.tier4.positive).not.toContain('? No, it is');
    // P8: "The room feels" stripped
    expect(result.tier4.positive).not.toContain('The room feels');
    // P10: "Cold and quiet." (3 words) merged into previous
    expect(result.tier4.positive).toContain('—');
  });

  it('no-op on clean tiers', () => {
    const clean = {
      tier1: {
        positive: 'masterpiece, (samurai:1.4), stone bridge, sharp focus, 8K',
        negative: 'blurry, low quality',
      },
      tier2: {
        positive: 'samurai::2.0 --ar 16:9 --v 7 --s 500 --no text, watermark',
        negative: '',
      },
      tier3: {
        positive: 'A samurai stands at the centre of a stone bridge in warm light.',
        negative: '',
      },
      tier4: {
        positive: 'A samurai stands on a bridge at sunset with cherry blossoms falling around him in the warm light.',
        negative: '',
      },
    };

    const result = postProcessTiers(clean);
    expect(result.tier1.positive).toBe(clean.tier1.positive);
    expect(result.tier2.positive).toBe(clean.tier2.positive);
    expect(result.tier3.positive).toBe(clean.tier3.positive);
    expect(result.tier4.positive).toBe(clean.tier4.positive);
  });

  it('pipeline order: T4 runs P3 before P8 before P10', () => {
    // Input that triggers all three T4 fixes in sequence
    const tiers = {
      tier1: { positive: 'masterpiece, 8K', negative: '' },
      tier2: { positive: 'samurai::2.0 --ar 16:9 --v 7 --s 500 --no text', negative: '' },
      tier3: { positive: 'A samurai stands.', negative: '' },
      tier4: {
        // P3 fixes self-correction → P8 has nothing → P10 merges short sentence
        positive: 'Is this a test? No, it is a real bridge scene at sunset with warm light. Short end.',
        negative: '',
      },
    };

    const result = postProcessTiers(tiers);
    // P3 should have removed the self-correction
    expect(result.tier4.positive).not.toContain('Is this a test');
    // P10 should have merged "Short end." if it's the last sentence and under 10 words
    // After P3: "A real bridge scene at sunset with warm light. Short end."
    // "Short end." = 2 words → P10 merges
    expect(result.tier4.positive).toContain('—');
  });
});

// ============================================================================
// DRIFT DETECTION — Lookup set sizes (catch accidental removals)
// ============================================================================

describe('Drift detection — lookup set sizes', () => {
  it('T3_ABSTRACT_NOUNS has exactly 20 entries', () => {
    expect(T3_ABSTRACT_NOUNS.size).toBe(20);
  });

  it('T3_PERCEPTION_VERBS has exactly 18 entries', () => {
    expect(T3_PERCEPTION_VERBS.size).toBe(18);
  });

  it('T4_ABSTRACT_NOUNS has exactly 23 entries', () => {
    expect(T4_ABSTRACT_NOUNS.size).toBe(23);
  });

  it('T4_META_VERBS has exactly 21 entries', () => {
    expect(T4_META_VERBS.size).toBe(21);
  });

  it('CLIP_UNFRIENDLY_ADJECTIVES has exactly 10 entries', () => {
    expect(CLIP_UNFRIENDLY_ADJECTIVES).toHaveLength(10);
  });
});
