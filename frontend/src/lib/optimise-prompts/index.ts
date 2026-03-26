// src/lib/optimise-prompts/index.ts
// ============================================================================
// OPTIMISE-PROMPTS — Barrel export
// ============================================================================

export { resolveGroupPrompt } from './resolve-group-prompt';
export { getProviderGroup, PLATFORM_GROUP_MAP } from './platform-groups';
export type { PlatformGroupId } from './platform-groups';
export type { OptimiseProviderContext, GroupPromptResult, GroupBuilder } from './types';
