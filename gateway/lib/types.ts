// gateway/lib/types.ts
// ============================================================================
// TYPE RE-EXPORTS - Backwards Compatibility
// ============================================================================
// Re-exports types from schemas.ts for backwards compatibility.
// New code should import directly from schemas.ts.
//
// DEPRECATED: Import from './schemas.js' instead.
// ============================================================================

// Re-export all types from schemas for backwards compatibility
export type {
  FxRibbonPair,
  FxRibbonQuote,
  FxRibbonPairQuote,
  FxRibbonResult,
  FxAdapterRequest,
  FxAdapterResponse,
} from './schemas.js';

// Re-export FxMode for backwards compatibility
export type FxMode = 'live' | 'cached';
