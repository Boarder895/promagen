// src/lib/prompt-compression.ts
// ============================================================================
// PROMPT COMPRESSION - RE-EXPORT
// ============================================================================
// This file re-exports from compress.ts for backward compatibility.
// The main compression logic lives in compress.ts.
//
// Authority: docs/authority/prompt-builder-page.md
// ============================================================================

// Re-export everything from the main compression module
export {
  compressPrompt,
  getPlatformTier,
  getPlatformConfig,
  getSupportedCategories,
  analyzeCompression,
  supportsFullShorthand,
  supportsMidjourneySyntax,
  getSupportedPlatforms,
} from '@/lib/compress';

// Re-export types
export type {
  CompressionTier,
  CompressionCategory,
  CompressionResult,
  CompressionPassResult,
  CompressionOptions,
} from '@/types/compression';
