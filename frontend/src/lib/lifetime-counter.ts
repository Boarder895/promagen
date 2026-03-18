// src/lib/lifetime-counter.ts
// ============================================================================
// LIFETIME PROMPT COUNTER — tracks total prompts crafted (copies + saves)
// ============================================================================
// Stored in localStorage under 'promagen:lifetime_prompts'.
// Called from copy handlers in prompt-builder.tsx and enhanced-educational-preview.tsx.
// ProGemBadge reads this value to determine the user's gem tier.
// ============================================================================

const LIFETIME_KEY = 'promagen:lifetime_prompts';

/** Increment the lifetime prompt counter by 1. */
export function incrementLifetimePrompts(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const current = parseInt(localStorage.getItem(LIFETIME_KEY) ?? '0', 10) || 0;
    const next = current + 1;
    localStorage.setItem(LIFETIME_KEY, String(next));
    return next;
  } catch {
    return 0;
  }
}

/** Read the current lifetime prompt count. */
export function getLifetimePrompts(): number {
  if (typeof window === 'undefined') return 0;
  try {
    return parseInt(localStorage.getItem(LIFETIME_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}
