// src/__tests__/conversion-telemetry.test.ts
import { PromptTelemetryEventSchema } from '@/types/prompt-telemetry';

function buildValid(o: Record<string, unknown> = {}) {
  return {
    sessionId: '550e8400-e29b-41d4-a716-446655440000', attemptNumber: 1,
    selections: { subject: ['portrait'], style: ['photorealistic'], lighting: ['golden hour'], colour: ['warm tones'] },
    categoryCount: 4, charLength: 120, score: 92, scoreFactors: { coherence: 90, fill: 95 },
    platform: 'flux', tier: 3 as const, sceneUsed: null,
    outcome: { copied: true, saved: false, returnedWithin60s: false, reusedFromLibrary: false },
    ...o,
  };
}

describe('Conversion Telemetry', () => {
  it('should accept event WITHOUT conversionMeta', () => {
    expect(PromptTelemetryEventSchema.safeParse(buildValid()).success).toBe(true);
  });

  it('should accept valid conversionMeta', () => {
    expect(PromptTelemetryEventSchema.safeParse(buildValid({
      conversionMeta: { fidelityConverted: 2, fidelityDeferred: 1, negativesConverted: 3, negativesDeferred: 0, budgetCeiling: 80, budgetRemaining: 15, parametricCount: 0 },
    })).success).toBe(true);
  });

  it('should accept all-zero conversionMeta', () => {
    expect(PromptTelemetryEventSchema.safeParse(buildValid({
      conversionMeta: { fidelityConverted: 0, fidelityDeferred: 0, negativesConverted: 0, negativesDeferred: 0, budgetCeiling: 0, budgetRemaining: 0, parametricCount: 0 },
    })).success).toBe(true);
  });

  it('should accept negative budgetRemaining', () => {
    expect(PromptTelemetryEventSchema.safeParse(buildValid({
      conversionMeta: { fidelityConverted: 1, fidelityDeferred: 0, negativesConverted: 0, negativesDeferred: 0, budgetCeiling: 30, budgetRemaining: -5, parametricCount: 1 },
    })).success).toBe(true);
  });

  it('should reject missing fields in conversionMeta', () => {
    expect(PromptTelemetryEventSchema.safeParse(buildValid({
      conversionMeta: { fidelityConverted: 2 },
    })).success).toBe(false);
  });

  it('should reject negative counts', () => {
    expect(PromptTelemetryEventSchema.safeParse(buildValid({
      conversionMeta: { fidelityConverted: -1, fidelityDeferred: 0, negativesConverted: 0, negativesDeferred: 0, budgetCeiling: 80, budgetRemaining: 0, parametricCount: 0 },
    })).success).toBe(false);
  });

  it('should reject counts over 20', () => {
    expect(PromptTelemetryEventSchema.safeParse(buildValid({
      conversionMeta: { fidelityConverted: 25, fidelityDeferred: 0, negativesConverted: 0, negativesDeferred: 0, budgetCeiling: 80, budgetRemaining: 0, parametricCount: 0 },
    })).success).toBe(false);
  });

  it('should reject budgetRemaining below -500', () => {
    expect(PromptTelemetryEventSchema.safeParse(buildValid({
      conversionMeta: { fidelityConverted: 0, fidelityDeferred: 0, negativesConverted: 0, negativesDeferred: 0, budgetCeiling: 80, budgetRemaining: -600, parametricCount: 0 },
    })).success).toBe(false);
  });

  it('should preserve all fields through validation', () => {
    const meta = { fidelityConverted: 2, fidelityDeferred: 1, negativesConverted: 3, negativesDeferred: 0, budgetCeiling: 80, budgetRemaining: 15, parametricCount: 2 };
    const r = PromptTelemetryEventSchema.safeParse(buildValid({ conversionMeta: meta }));
    expect(r.success).toBe(true);
    if (r.success) { expect(r.data.conversionMeta).toEqual(meta); }
  });
});
