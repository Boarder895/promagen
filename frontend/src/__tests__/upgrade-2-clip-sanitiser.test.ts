// src/__tests__/upgrade-2-clip-sanitiser.test.ts
// ============================================================================
// UPGRADE 2 — CLIP Syntax Sanitiser Tests
// ============================================================================
//
// Validates that stray periods from natural-language customValues are
// cleaned from keyword-mode output (Tier 1 CLIP, Tier 2 MJ, Flux).
//
// Bug: customValues written as sentences ("Natural daylight. Lumpy stratocumulus
// layer with light breaks overhead.") survive into CLIP format where periods
// confuse tokenisers and deweight downstream tokens.
//
// Fix: sanitiseClipTokens() replaces ". " with ", " and strips trailing periods.
// ============================================================================

import { sanitiseClipTokens } from '@/lib/prompt-builder';

// ============================================================================
// Direct sanitiseClipTokens() tests
// ============================================================================

describe('sanitiseClipTokens', () => {
  it('replaces mid-text sentence periods with commas', () => {
    const input =
      'Natural daylight. Lumpy stratocumulus layer with light breaks overhead';
    const result = sanitiseClipTokens(input);
    expect(result).toBe(
      'Natural daylight, lumpy stratocumulus layer with light breaks overhead',
    );
  });

  it('strips trailing period', () => {
    const input = 'midground tack-sharp.';
    const result = sanitiseClipTokens(input);
    expect(result).toBe('midground tack-sharp');
  });

  it('handles both mid-text and trailing periods together', () => {
    const input =
      'Natural daylight. Lumpy stratocumulus layer with light breaks overhead.';
    const result = sanitiseClipTokens(input);
    expect(result).toBe(
      'Natural daylight, lumpy stratocumulus layer with light breaks overhead',
    );
  });

  it('preserves decimal numbers (f/1.4, 0.5)', () => {
    const input = 'Shot on Canon EOS R5, 90mm f/1.4, sharp focus';
    const result = sanitiseClipTokens(input);
    expect(result).toBe('Shot on Canon EOS R5, 90mm f/1.4, sharp focus');
  });

  it('preserves ellipsis (...)', () => {
    const input = 'dreamy atmosphere... soft glow';
    const result = sanitiseClipTokens(input);
    expect(result).toBe('dreamy atmosphere... soft glow');
  });

  it('handles multiple sentence periods in one string', () => {
    const input =
      'Bright sunlight. Blue sky overhead. White clouds drifting.';
    const result = sanitiseClipTokens(input);
    expect(result).toBe(
      'Bright sunlight, blue sky overhead, white clouds drifting',
    );
  });

  it('collapses double commas from period cleanup', () => {
    const input = 'warm glow., soft light';
    const result = sanitiseClipTokens(input);
    expect(result).toBe('warm glow, soft light');
  });

  it('passes through clean CLIP text unchanged', () => {
    const input =
      'masterpiece, highly detailed, Istanbul, photorealistic, moonlight';
    const result = sanitiseClipTokens(input);
    expect(result).toBe(input);
  });

  it('handles empty string', () => {
    expect(sanitiseClipTokens('')).toBe('');
  });

  it('handles string with only a period', () => {
    expect(sanitiseClipTokens('.')).toBe('');
  });

  it('preserves CLIP weight syntax (token:1.3)', () => {
    const input = '(Istanbul:1.3), (moonlight:1.2), sharp focus';
    const result = sanitiseClipTokens(input);
    expect(result).toBe('(Istanbul:1.3), (moonlight:1.2), sharp focus');
  });

  it('lowercases first letter after converted period', () => {
    // "daylight. Lumpy" → "daylight, lumpy" (not "daylight, Lumpy")
    const input = 'Natural daylight. Lumpy stratocumulus';
    const result = sanitiseClipTokens(input);
    expect(result).toBe('Natural daylight, lumpy stratocumulus');
  });

  it('fixes the real Vientiane bug (lighting duplicate with period)', () => {
    const input =
      'bright daylight with passing cumulus cloud shadows. Southerly 12 km/h breeze';
    const result = sanitiseClipTokens(input);
    expect(result).toBe(
      'bright daylight with passing cumulus cloud shadows, southerly 12 km/h breeze',
    );
  });

  it('fixes the real Warsaw bug (lighting customValue with period)', () => {
    const input =
      'Natural daylight. Lumpy stratocumulus layer with light breaks overhead.';
    const result = sanitiseClipTokens(input);
    expect(result).toBe(
      'Natural daylight, lumpy stratocumulus layer with light breaks overhead',
    );
  });

  it('strips period before comma separator (overhead., bug)', () => {
    const input =
      'Natural daylight, low rolling stratocumulus blanket overhead., Southerly 12 km/h breeze';
    const result = sanitiseClipTokens(input);
    expect(result).toBe(
      'Natural daylight, low rolling stratocumulus blanket overhead, Southerly 12 km/h breeze',
    );
  });

  it('preserves decimal before comma (f/1.4, safe)', () => {
    const input = '50mm f/1.4, sharp focus';
    const result = sanitiseClipTokens(input);
    expect(result).toBe('50mm f/1.4, sharp focus');
  });
});
