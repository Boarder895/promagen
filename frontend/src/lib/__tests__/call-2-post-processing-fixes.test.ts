// src/lib/__tests__/call-2-post-processing-fixes.test.ts
// ============================================================================
// Regression tests for Call 2 post-processing fixes P14, P15, P16
// ============================================================================
// Targets the three non-healthy rules from the v4.5 harness run:
//   T1.weight_wrap_4_words_max  — REAL_FAILURE  stage_d_fail=0.2408
//   T3.char_count_in_range      — REAL_FAILURE  stage_d_fail=0.1728
//   T4.char_count_under_325     — BORDERLINE    stage_d_fail=0.0524
//
// Expected harness outcomes after deploying these fixes:
//   T1.weight_wrap_4_words_max: stage_d_fail → near 0, rescue_dependency rises
//   T3.char_count_in_range:     stage_d_fail → meaningful reduction (code fixes
//     over-length only; under-length is a prompt quality issue not addressed here,
//     so exact floor depends on over/under mix in the sample)
//   T4.char_count_under_325:    stage_d_fail → near 0
//
// Run: pnpm run test:util -- --testPathPattern="call-2-post-processing-fixes"
// ============================================================================

import {
  enforceT1WeightWrap,
  enforceT3MaxLength,
  enforceT4MaxLength,
  postProcessTiers,
} from '@/lib/harmony-post-processing';

// ============================================================================
// P14: T1 WEIGHT-WRAP ENFORCEMENT (≤4 words)
// ============================================================================

describe('P14: enforceT1WeightWrap', () => {
  // ── Core splitting behaviour ─────────────────────────────────────────────

  it('splits a 6-word phrase, filtering stop-word orphans from prefix', () => {
    // "small girl in a yellow raincoat" = 6 words
    // Noun-anchor tail: "yellow raincoat" (tailLen=2, "yellow" not stop word)
    // Prefix: ["small", "girl", "in", "a"] → filter stop words → ["small", "girl"]
    const input = 'masterpiece, best quality, (small girl in a yellow raincoat:1.3), sharp focus';
    const result = enforceT1WeightWrap(input);

    expect(result.text).toBe(
      'masterpiece, best quality, small, girl, (yellow raincoat:1.3), sharp focus',
    );
    expect(result.fixes).toHaveLength(1);
    expect(result.fixes[0]).toContain('small girl in a yellow raincoat');
    expect(result.skipped).toHaveLength(0);
  });

  it('does NOT split a 4-word phrase — exactly at the limit', () => {
    const input = '(frost-encrusted orange survival suit:1.3)';
    const result = enforceT1WeightWrap(input);

    expect(result.text).toBe(input);
    expect(result.fixes).toHaveLength(0);
  });

  it('splits a 5-word phrase — no stop words in prefix', () => {
    // "rain-soaked gallery deck lighthouse keeper" = 5 words, no stop words
    // Tail: "lighthouse keeper", prefix: "rain-soaked, gallery, deck" (all meaningful)
    const input = '(rain-soaked gallery deck lighthouse keeper:1.4)';
    const result = enforceT1WeightWrap(input);

    expect(result.text).toBe(
      'rain-soaked, gallery, deck, (lighthouse keeper:1.4)',
    );
    expect(result.fixes).toHaveLength(1);
  });

  it('does not touch phrases with exactly 4 words', () => {
    const input = '(weathered iron gallery railing:1.3), (storm waves below:1.2)';
    const result = enforceT1WeightWrap(input);

    expect(result.text).toBe(input);
    expect(result.fixes).toHaveLength(0);
  });

  it('does not touch phrases with 2 or fewer words', () => {
    const input = '(elderly samurai:1.4), (stone bridge:1.3), (golden hour:1.2)';
    const result = enforceT1WeightWrap(input);

    expect(result.text).toBe(input);
    expect(result.fixes).toHaveLength(0);
  });

  it('fixes multiple offending phrases — stop-word guard prevents bad tails', () => {
    // "a very large old stone bridge over river" = 8 words
    //   tailLen=2: "over" is stop word → skip
    //   tailLen=3: "bridge" is not stop → tail = "bridge over river"
    //   prefix meaningful: "very, large, old, stone" (filter "a")
    // "tall young woman in flowing silk dress" = 7 words
    //   tailLen=2: "silk" not stop → tail = "silk dress"
    //   prefix meaningful: "tall, young, woman, flowing" (filter "in")
    const input =
      'masterpiece, (a very large old stone bridge over river:1.3), (tall young woman in flowing silk dress:1.2)';
    const result = enforceT1WeightWrap(input);

    expect(result.text).toContain('(bridge over river:1.3)');
    expect(result.text).not.toContain('(over river:1.3)');
    expect(result.text).toContain('(silk dress:1.2)');
    expect(result.fixes).toHaveLength(2);
  });

  // ── Stop-word guard: the exact failures P14 v2.0 fixes ──────────────────

  it('prevents "(of light:1.3)" — stops preposition-led tail', () => {
    // "dust motes in shaft of light" = 6 words
    // Old P14: tail = "of light" → GARBAGE
    // New P14: tailLen=2 "of" is stop → skip, tailLen=3 "shaft" not stop → "shaft of light"
    const input = '(dust motes in shaft of light:1.3)';
    const result = enforceT1WeightWrap(input);

    expect(result.text).toBe('dust, motes, (shaft of light:1.3)');
    expect(result.text).not.toContain('(of light');
  });

  it('prevents "(to shoulder:1.2)" — stops preposition-led tail', () => {
    // "umbrellas jostling shoulder to shoulder" = 5 words
    // Old P14: tail = "to shoulder" → GARBAGE
    // New P14: tailLen=2 "to" is stop → skip, tailLen=3 "shoulder" not stop → "shoulder to shoulder"
    const input = '(umbrellas jostling shoulder to shoulder:1.2)';
    const result = enforceT1WeightWrap(input);

    expect(result.text).toBe('umbrellas, jostling, (shoulder to shoulder:1.2)');
    expect(result.text).not.toContain('(to shoulder');
  });

  it('filters stop-word orphans: "and" removed from prefix', () => {
    // "mixed warm and cool streetlamps" = 5 words
    // Tail: "cool streetlamps" ("cool" not stop)
    // Prefix: ["mixed", "warm", "and"] → filter → ["mixed", "warm"]
    const input = '(mixed warm and cool streetlamps:1.3)';
    const result = enforceT1WeightWrap(input);

    expect(result.text).toBe('mixed, warm, (cool streetlamps:1.3)');
    expect(result.text).not.toContain(', and,');
  });

  it('filters "through" from prefix — interaction preservation', () => {
    // "traffic lights glowing through misty drizzle" = 6 words
    const input = '(traffic lights glowing through misty drizzle:1.3)';
    const result = enforceT1WeightWrap(input);

    expect(result.text).toBe('traffic, lights, glowing, (misty drizzle:1.3)');
    expect(result.text).not.toContain(', through,');
  });

  // ── Edge cases ──────────────────────────────────────────────────────────

  it('skips nested parentheses — logs but does not fix', () => {
    const input = 'masterpiece, ((nested phrase with many words inside:1.3):1.2)';
    const result = enforceT1WeightWrap(input);

    expect(result.text).toBe(input);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]).toContain('Nested parentheses');
  });

  it('handles text with no weight-wrapped phrases', () => {
    const input = 'masterpiece, best quality, elderly samurai, stone bridge';
    const result = enforceT1WeightWrap(input);

    expect(result.text).toBe(input);
    expect(result.fixes).toHaveLength(0);
  });

  it('does not interfere with double-colon syntax (P14 is parenthetical only)', () => {
    const input = 'elderly samurai standing on a stone bridge at golden hour::1.4';
    const result = enforceT1WeightWrap(input);

    expect(result.text).toBe(input);
    expect(result.fixes).toHaveLength(0);
  });

  it('preserves the weight value exactly', () => {
    // "detailed old weathered stone bridge crossing" = 6 words → tail 2 = "bridge crossing"
    const input = '(detailed old weathered stone bridge crossing:1.2)';
    const result = enforceT1WeightWrap(input);

    expect(result.text).toBe('detailed, old, weathered, stone, (bridge crossing:1.2)');
    expect(result.text).toContain(':1.2)');
    expect(result.fixes).toHaveLength(1);
  });
});

// ============================================================================
// P15: T3 OVER-LENGTH TRUNCATION (280–420 chars)
// ============================================================================

describe('P15: enforceT3MaxLength', () => {
  // ── No-op cases ──────────────────────────────────────────────────────────

  it('returns text unchanged when under 420 chars', () => {
    const text = 'A lone figure grips the iron railing of a lighthouse gallery deck. ' +
      'Storm waves detonate against the jagged rocks below as twilight deepens. ' +
      'The beam sweeps through driving rain, casting a warm arc across the dark coastline.';
    expect(text.length).toBeLessThanOrEqual(420);

    const result = enforceT3MaxLength(text);
    expect(result.text).toBe(text);
    expect(result.truncated).toBe(false);
  });

  it('returns text unchanged when exactly 420 chars', () => {
    const base = 'A lone figure grips the iron railing of a lighthouse gallery deck as enormous storm waves crash against the jagged rocks below at twilight. The sweeping beam cuts through driving rain, casting warm golden arcs across the dark and turbulent coastline where foam churns white. Ancient stones bear the marks of centuries of relentless Atlantic storms and salt erosion.';
    const text = base.padEnd(420, '.').slice(0, 420);
    expect(text.length).toBe(420);

    const result = enforceT3MaxLength(text);
    expect(result.text).toBe(text);
    expect(result.truncated).toBe(false);
  });

  // ── Sentence boundary truncation ──────────────────────────────────────

  it('truncates at last sentence boundary when over 420 chars', () => {
    const sent1 = 'From a low vantage on the storm-lashed coast, a lone keeper grips the iron railing of a lighthouse gallery deck as twilight waves detonate against the jagged rocks below.';
    const sent2 = ' The beam sweeps through driving rain, casting a warm arc of golden light across the dark and turbulent coastline.';
    const sent3 = ' Ancient stones bear the scars of relentless Atlantic storms battering this remote and exposed headland for centuries on end with unrelenting fury and devastation.';
    const text = sent1 + sent2 + sent3;

    expect(text.length).toBeGreaterThan(420);

    const result = enforceT3MaxLength(text);
    expect(result.truncated).toBe(true);
    expect(result.text.length).toBeLessThanOrEqual(420);
    expect(result.text.length).toBeGreaterThanOrEqual(280);
    expect(result.method).toBe('sentence');
    expect(result.text).not.toMatch(/\s$/);
  });

  // ── Clause boundary fallback ──────────────────────────────────────────

  it('falls back to clause boundary when sentence cut would drop below 280', () => {
    // One long sentence with semicolons/dashes — no sentence boundaries
    const text =
      'From a low vantage on the storm-lashed coast, a lone keeper grips the iron railing of a lighthouse gallery deck; ' +
      'twilight waves detonate against the jagged rocks below as the sweeping beam cuts through driving rain and salt spray, ' +
      'casting warm golden arcs across the dark coastline where ancient stones bear the marks of centuries of Atlantic storms — ' +
      'a solitary beacon of defiance standing firm against the relentless fury of nature and time that batters this remote headland endlessly.';

    expect(text.length).toBeGreaterThan(420);

    const result = enforceT3MaxLength(text);
    expect(result.truncated).toBe(true);
    expect(result.text.length).toBeLessThanOrEqual(420);
    expect(['clause', 'comma-fallback']).toContain(result.method);
  });

  // ── Minimum floor enforcement ─────────────────────────────────────────

  it('preserves ≥280 chars when a viable truncation point exists above the floor', () => {
    // Three sentences: first is ~168 chars (above 280 threshold when combined with second),
    // third pushes total over 420. Sentence boundary cut should keep sent1+sent2.
    const sent1 = 'From a low vantage on the storm-lashed coast, a lone keeper grips the iron railing of a lighthouse gallery deck as twilight waves detonate against the jagged rocks below.';
    const sent2 = ' The beam sweeps through driving rain, casting a warm arc of golden light across the dark and turbulent coastline.';
    const sent3 = ' Ancient stones bear the deep scars of relentless Atlantic storms battering this headland for centuries with unrelenting force and unstoppable destructive power.';
    const text = sent1 + sent2 + sent3;

    expect(text.length).toBeGreaterThan(420);

    const result = enforceT3MaxLength(text);
    expect(result.truncated).toBe(true);
    expect(result.text.length).toBeLessThanOrEqual(420);
    expect(result.text.length).toBeGreaterThanOrEqual(280);
  });

  it('does NOT fix under-length T3 — that is a prompt quality issue', () => {
    const shortText = 'A keeper stands on the gallery deck at twilight. Waves crash below.';
    expect(shortText.length).toBeLessThan(280);

    const result = enforceT3MaxLength(shortText);
    expect(result.text).toBe(shortText);
    expect(result.truncated).toBe(false);
  });
});

// ============================================================================
// P16: T4 OVER-LENGTH TRUNCATION (≤325 chars)
// ============================================================================

describe('P16: enforceT4MaxLength', () => {
  // ── No-op case ──────────────────────────────────────────────────────────

  it('returns text unchanged when under 325 chars', () => {
    const text =
      'At twilight on the rain-lashed coast, a lighthouse keeper grips the gallery railing as storm waves crash below. ' +
      'The beam sweeps through driving rain, casting warm light across the dark coastline.';
    expect(text.length).toBeLessThanOrEqual(325);

    const result = enforceT4MaxLength(text);
    expect(result.text).toBe(text);
    expect(result.truncated).toBe(false);
  });

  // ── Sentence boundary truncation ──────────────────────────────────────

  it('truncates at last sentence boundary when over 325 chars', () => {
    const sent1 = 'At twilight on the rain-lashed coast, a lighthouse keeper grips the gallery railing as enormous storm waves crash against the jagged rocks far below.';
    const sent2 = ' The beam sweeps through driving rain, casting a warm arc of golden light across the dark and turbulent coastline.';
    const sent3 = ' Foam churns white against the ancient stones that have weathered centuries of relentless Atlantic fury.';
    const text = sent1 + sent2 + sent3;

    expect(text.length).toBeGreaterThan(325);

    const result = enforceT4MaxLength(text);
    expect(result.truncated).toBe(true);
    expect(result.text.length).toBeLessThanOrEqual(325);
    expect(result.method).toBe('sentence');
  });

  // ── No minimum floor ──────────────────────────────────────────────────

  it('does not enforce a minimum floor — short results are acceptable', () => {
    const text =
      'A keeper stands alone. ' +
      'The beam sweeps through driving rain and salt spray, casting a warm arc of golden light across the dark and turbulent coastline where ancient weathered stones bear the deep scars of centuries of relentless Atlantic storms battering this remote and long-forgotten headland for ages upon ages beyond memory.';

    expect(text.length).toBeGreaterThan(325);

    const result = enforceT4MaxLength(text);
    expect(result.truncated).toBe(true);
    expect(result.text.length).toBeLessThanOrEqual(325);
  });

  // ── Comma fallback ────────────────────────────────────────────────────

  it('falls back to comma when no sentence boundary exists under 325', () => {
    // One continuous sentence >325 chars with commas but no periods
    const text =
      'At twilight on the rain-lashed coast a lighthouse keeper grips the gallery railing as enormous storm waves crash against the jagged rocks far below, ' +
      'the sweeping beam cutting through driving rain and salt spray, casting warm golden arcs across the dark turbulent coastline where ancient weathered stones bear the deep scars of centuries of storms';

    expect(text.length).toBeGreaterThan(325);

    const result = enforceT4MaxLength(text);
    expect(result.truncated).toBe(true);
    expect(result.text.length).toBeLessThanOrEqual(325);
    expect(result.method).toBe('comma-fallback');
    expect(result.text).toMatch(/\.$/);
  });
});

// ============================================================================
// PIPELINE INTEGRATION: postProcessTiers()
// ============================================================================

describe('postProcessTiers integration — new fixes active', () => {
  const makeTiers = (overrides: {
    t1Positive?: string;
    t3Positive?: string;
    t4Positive?: string;
  }) => ({
    tier1: { positive: overrides.t1Positive ?? 'masterpiece, (elderly samurai:1.4), sharp focus', negative: 'blurry, text' },
    tier2: { positive: 'elderly samurai standing on bridge::2.0 --ar 16:9 --v 7 --s 500 --no text, blurry', negative: '' },
    tier3: { positive: overrides.t3Positive ?? 'An elderly samurai stands on a stone bridge at golden hour. Cherry blossoms drift through warm light as mist rises from the valley below.', negative: 'blurry, low quality' },
    tier4: { positive: overrides.t4Positive ?? 'At golden hour, an elderly samurai stands on a stone bridge. Cherry blossoms fall as mist rises from the valley below.', negative: 'blurry' },
  });

  it('P14 fires in pipeline — splits 5+ word T1 weight wraps', () => {
    const result = postProcessTiers(makeTiers({
      t1Positive: 'masterpiece, best quality, (small girl in a yellow raincoat standing alone:1.3), sharp focus',
    }));

    // "small girl in a yellow raincoat standing alone" = 8 words
    // Tail 2 = "standing alone", prefix ejected as unweighted terms
    expect(result.tier1.positive).toContain('(standing alone:1.3)');
    expect(result.tier1.positive).not.toContain('small girl in a yellow raincoat standing alone');
  });

  it('P15 fires in pipeline — truncates T3 over 420 chars', () => {
    const longT3 =
      'From a low vantage on the storm-lashed coast, a lone keeper grips the iron railing of a lighthouse gallery deck as twilight waves detonate against the jagged rocks below. ' +
      'The beam sweeps through driving rain, casting a warm arc of golden light across the dark and turbulent coastline. ' +
      'Ancient stones bear the scars of relentless Atlantic storms battering this remote headland for centuries of unending fury and destruction.';

    expect(longT3.length).toBeGreaterThan(420);

    const result = postProcessTiers(makeTiers({ t3Positive: longT3 }));
    expect(result.tier3.positive.length).toBeLessThanOrEqual(420);
    expect(result.tier3.positive.length).toBeGreaterThanOrEqual(280);
  });

  it('P16 fires in pipeline — truncates T4 over 325 chars', () => {
    const longT4 =
      'At twilight on the rain-lashed coast, a lighthouse keeper grips the gallery railing as enormous storm waves crash against the jagged rocks far below. ' +
      'The beam sweeps through driving rain, casting a warm arc of golden light across the dark coastline. ' +
      'Foam churns white against the ancient weathered stones that have endured centuries of fury.';

    expect(longT4.length).toBeGreaterThan(325);

    const result = postProcessTiers(makeTiers({ t4Positive: longT4 }));
    expect(result.tier4.positive.length).toBeLessThanOrEqual(325);
  });

  it('existing P1/P2/P3/P8/P10 still fire — no regression', () => {
    const result = postProcessTiers({
      tier1: {
        positive: 'masterpiece, (elderly samurai:1.4), sharp focus.',
        negative: 'blurry, text.',
      },
      tier2: {
        positive: 'samurai on bridge::2.0 --ar 16:9 --v 7 --s 500 --no text, blurry --ar 16:9 --v 7 --s 500 --no text, blurry',
        negative: '',
      },
      tier3: {
        positive: 'An elderly samurai stands on a stone bridge at golden hour.',
        negative: 'blurry',
      },
      tier4: {
        positive: 'The atmosphere carries a warm stillness.',
        negative: 'blurry',
      },
    });

    // P2: trailing period stripped from T1
    expect(result.tier1.positive).not.toMatch(/\.$/);
    expect(result.tier1.negative).not.toMatch(/\.$/);
    // P1: T2 deduplication (two --ar blocks → one)
    const arCount = (result.tier2.positive.match(/--ar/g) ?? []).length;
    expect(arCount).toBe(1);
    // P8: meta-opener removed from T4
    expect(result.tier4.positive).not.toMatch(/^The atmosphere/);
  });
});
