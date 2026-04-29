// src/components/prompts/library/index.ts
// ============================================================================
// LIBRARY COMPONENTS INDEX
// ============================================================================
// Pass 5d-ii (28 Apr 2026) — Library cluster reduced to the live SaveIcon
// + QuickSaveToast pair. The orphan library UI components (SavedPromptCard,
// PromptLibraryGrid, LibraryLeftRail/RightRail, ReformatPreview, PromptDiff,
// KeyboardShortcutsOverlay) were deleted alongside their consumer
// LibraryClient (/studio/library now redirects to /platforms).
//
// SaveIcon stays: it's used by weather-prompt-tooltip, commodity-prompt-
// tooltip, pro-promagen-client, community-pulse, prompt-showcase.
// QuickSaveToastGlobal stays: it's mounted in app/layout.tsx.
// ============================================================================

export { QuickSaveToast, triggerQuickSaveToast } from './quick-save-toast';
export { QuickSaveToastGlobal } from './quick-save-toast-global';
export { SaveIcon } from './save-icon';

export type { QuickSaveToastData, QuickSaveToastProps } from './quick-save-toast';
export type { SaveIconProps } from './save-icon';
