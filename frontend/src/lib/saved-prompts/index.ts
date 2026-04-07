// src/lib/saved-prompts/index.ts
// ============================================================================
// SAVED PROMPTS — Module Barrel Export (v1.0.0)
// ============================================================================
// Re-exports all public API from the saved-prompts database module.
// Import as: import { getPromptsForUser, insertPrompt } from '@/lib/saved-prompts';
//
// Authority: docs/authority/saved-page.md §13.2
// Existing features preserved: Yes (new file, no modifications)
// ============================================================================

export {
  // Constants
  MAX_PROMPTS_PER_USER,

  // Table setup
  hasDatabaseConfigured,
  ensureSavedPromptsTable,

  // Health
  checkHealth,

  // CRUD (all scoped by userId)
  countForUser,
  getPromptsForUser,
  getPromptForUser,
  insertPrompt,
  updatePrompt,
  deletePrompt,
  deleteAllForUser,

  // Folder operations (batch)
  renameFolder,
  deleteFolder,

  // Sync
  syncFromLocalStorage,
} from './database';

export type {
  DbSavedPrompt,
  SavedPromptInput,
  SavedPromptsHealth,
} from './database';
