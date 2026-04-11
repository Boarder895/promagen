// src/lib/call-3-transforms/attention-curves.ts
// ============================================================================
// ATTENTION WEIGHT CURVES — Platform-specific position → weight functions
// ============================================================================
// Architecture: call-3-quality-architecture-v0.2.0.md §3.2, §5.2
//
// These functions map a token position to an estimated attention weight.
// They encode the working hypotheses from §3.2:
//   - CLIP: exponential front-decay (strong front-loading)
//   - T5:   mild linear decay (near-uniform self-attention, but
//           cross-attention gives early clauses disproportionate influence)
//   - LLM:  near-uniform semantic processing
//
// All curves return values in [0.0, 1.0] with position 0 = 1.0.
//
// IMPORTANT: These are working hypotheses, not measurements (§3.2).
// "Controlled generation tests with anchors at different positions
// producing identical images would disprove this."
// ============================================================================

/**
 * CLIP ViT-L/14 attention curve — exponential front-decay.
 *
 * Models the observed behaviour: earlier tokens have stronger influence
 * on the generated image. Promagen's stacking research shows diminishing
 * returns past position ~30. The Midjourney founder confirmed words 1–5
 * are very influential, words 40+ are largely ignored.
 *
 * Curve: e^(-2.5 × position / tokenLimit)
 *   Position  0: 1.000
 *   Position 15: 0.613  (subject zone — still high)
 *   Position 30: 0.376  (past the ~30 diminishing returns threshold)
 *   Position 50: 0.197  (low influence)
 *   Position 77: 0.079  (near-zero practical impact)
 *
 * @param position   Token position (0-indexed)
 * @param tokenLimit Hard encoder limit (77 for CLIP)
 * @returns Attention weight 0.0–1.0
 */
export function clipAttentionCurve(position: number, tokenLimit: number): number {
  if (tokenLimit <= 0) return 1.0;
  if (position < 0) return 1.0;
  if (position >= tokenLimit) return 0.0;

  // Decay constant 2.5 gives ~0.38 at 30/77, ~0.08 at 77/77
  const decay = 2.5;
  return Math.exp(-decay * (position / tokenLimit));
}

/**
 * T5-XXL attention curve — mild linear decay.
 *
 * T5's self-attention is near-uniform, but the diffusion model's
 * cross-attention layer gives disproportionate weight to early clauses
 * (§3.2 hypothesis). First-sentence anchors dominate generated images
 * on Flux.
 *
 * Curve: linear from 1.0 at position 0 to 0.7 at tokenLimit
 *   Position   0: 1.000
 *   Position 128: 0.925
 *   Position 256: 0.850
 *   Position 512: 0.700
 *
 * @param position   Token position (0-indexed)
 * @param tokenLimit Encoder limit (512 for T5)
 * @returns Attention weight 0.7–1.0
 */
export function t5AttentionCurve(position: number, tokenLimit: number): number {
  if (tokenLimit <= 0) return 1.0;
  if (position < 0) return 1.0;
  if (position >= tokenLimit) return 0.7;

  // Linear decay from 1.0 to 0.7 across the full window
  const minWeight = 0.7;
  return 1.0 - ((1.0 - minWeight) * (position / tokenLimit));
}

/**
 * LLM-based attention curve — near-uniform.
 *
 * LLM encoders (ChatGLM3, DALL-E's GPT-4 rewriter) process the full
 * prompt semantically. Position has minimal effect on attention.
 *
 * Constant: 0.95 everywhere (slight decay to acknowledge that early
 * content still has marginal priority in practice).
 *
 * @param _position  Token position (unused — attention is uniform)
 * @param _tokenLimit Encoder limit (unused)
 * @returns Attention weight ~0.95
 */
export function llmAttentionCurve(_position: number, _tokenLimit: number): number {
  return 0.95;
}

/**
 * Select the appropriate attention curve for an encoder family.
 *
 * @param encoderFamily The platform's encoder family from its DNA profile
 * @returns The attention curve function for that encoder
 */
export function getAttentionCurve(
  encoderFamily: 'clip' | 't5' | 'llm_rewrite' | 'llm_semantic' | 'proprietary',
): (position: number, tokenLimit: number) => number {
  switch (encoderFamily) {
    case 'clip':
      return clipAttentionCurve;
    case 't5':
      return t5AttentionCurve;
    case 'llm_rewrite':
    case 'llm_semantic':
      return llmAttentionCurve;
    case 'proprietary':
      // Proprietary encoders: use mild linear decay as safe default
      // until empirical profiling provides better data
      return t5AttentionCurve;
  }
}
